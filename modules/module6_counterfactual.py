"""
KAVACH — Module 6: Counterfactual Simulation Engine
Produces: outputs/counterfactual.json
Depends on: dataset/violations_clean.pkl, outputs/zone_congestiq.json

"What if the top underperforming zones had 80% enforcement?"

Trains a model: enforcement_rate -> violation_reduction per zone.
Runs counterfactual scenarios at multiple enforcement rate levels.
Converts CongestIQ savings to real-world hours saved (the Flipkart closer).

Key output for judges:
  - Monthly congestion-hours saved across Bengaluru
  - Delivery hours saved for Flipkart's logistics fleet

Usage:
    python modules/module6_counterfactual.py
"""

import json
import pickle
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PKL_PATH = PROJECT_ROOT / "Dataset" / "violations_clean.pkl"
CONGESTIQ_PATH = PROJECT_ROOT / "outputs" / "zone_congestiq.json"
OUTPUT_PATH = PROJECT_ROOT / "outputs" / "counterfactual.json"
MODEL_PATH = PROJECT_ROOT / "models" / "counterfactual_model.pkl"

# ─── Parameters ───────────────────────────────────────────
# Scenarios to simulate
ENFORCEMENT_RATES = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00]

# Conversion factors for real-world impact
# Average time stuck in parking-congestion per violation event (minutes)
AVG_DELAY_PER_VIOLATION_MIN = 2.5
# Number of vehicles affected per violation (cascade multiplier)
AVG_VEHICLES_AFFECTED = 8
# Working hours per month
WORKING_HOURS_PER_MONTH = 22 * 10  # 22 days × 10 active traffic hours
# Flipkart delivery fleet proportion of total road traffic in Bengaluru
FLIPKART_FLEET_PROPORTION = 0.03  # ~3% of commercial vehicles


def load_data():
    """Load violations and CongestIQ scores."""
    if not PKL_PATH.exists():
        print(f"ERROR: {PKL_PATH} not found. Run data_cleaning.py first.")
        sys.exit(1)
    df = pd.read_pickle(PKL_PATH)
    print(f"  Loaded {len(df):,} violations")

    if not CONGESTIQ_PATH.exists():
        print(f"ERROR: {CONGESTIQ_PATH} not found. Run module2_congestiq.py first.")
        sys.exit(1)
    with open(CONGESTIQ_PATH) as f:
        congestiq = json.load(f)
    print(f"  Loaded CongestIQ for {len(congestiq)} zones")

    return df, congestiq


def build_zone_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build feature matrix for the enforcement -> violation reduction model.
    Each row = one zone (geohash).
    """
    print("\n[FEATURES] Building zone feature matrix ...")

    zone_features = df.groupby("geohash").agg(
        total_violations=("id", "count"),
        enforcement_rate=("data_sent_to_scita", "mean"),
        avg_vehicle_weight=("vehicle_weight", "mean"),
        avg_time_multiplier=("time_multiplier", "mean"),
        violation_diversity=("violation_type", lambda x: len(set(v for vl in x for v in vl if isinstance(vl, list)))),
        vehicle_diversity=("vehicle_type", "nunique"),
        peak_hour=("hour", lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 8),
        weekend_ratio=("dow", lambda x: (x >= 5).mean()),
        active_days=("date", "nunique"),
        lat=("latitude", "mean"),
        lng=("longitude", "mean"),
    ).reset_index()

    # Violations per day
    zone_features["violations_per_day"] = (
        zone_features["total_violations"] / zone_features["active_days"].clip(lower=1)
    )

    # Filter: only zones with enough data
    zone_features = zone_features[zone_features["total_violations"] >= 10].reset_index(drop=True)

    print(f"  Built features for {len(zone_features)} zones")
    return zone_features


def train_enforcement_model(zone_features: pd.DataFrame):
    """
    Train a model: enforcement_rate -> violation intensity.

    We model the relationship between enforcement rate and violation density
    using historical cross-zone variation. Zones with higher enforcement
    tend to have lower violation rates per capita.

    The model learns: violation_intensity = f(enforcement_rate, zone_characteristics)
    Counterfactual: what would violation_intensity be if enforcement_rate = X?
    """
    print("\n[MODEL] Training enforcement impact model ...")

    feature_cols = [
        "enforcement_rate", "avg_vehicle_weight", "avg_time_multiplier",
        "violation_diversity", "vehicle_diversity", "weekend_ratio",
        "lat", "lng",
    ]
    target = "violations_per_day"

    X = zone_features[feature_cols].values
    y = zone_features[target].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = GradientBoostingRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=10,
        subsample=0.8,
        random_state=42,
    )
    model.fit(X_scaled, y)

    # Cross-validation
    cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring="neg_mean_absolute_error")
    mae = -cv_scores.mean()
    print(f"  5-fold CV MAE: {mae:.2f} violations/day")
    print(f"  Feature importances:")
    for fname, imp in sorted(zip(feature_cols, model.feature_importances_), key=lambda x: -x[1]):
        print(f"    {fname:25s} {imp:.4f}")

    # Save model
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model_bundle = {
        "model": model,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "mae": mae,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model_bundle, f)
    print(f"  Model saved -> {MODEL_PATH}")

    return model, scaler, feature_cols


def run_counterfactual(
    zone_features: pd.DataFrame,
    congestiq: list,
    model,
    scaler,
    feature_cols: list,
) -> list:
    """
    Run counterfactual simulations at multiple enforcement rates.
    For each rate, predict what violations would be if all underperforming
    zones were lifted to that enforcement rate.
    """
    print("\n[COUNTERFACTUAL] Running simulations ...")

    # Build CongestIQ lookup
    ciq_map = {z["zone_id"]: z for z in congestiq}

    # Current baseline
    baseline_total_ciq = sum(z["congestiq_score"] for z in congestiq)
    baseline_total_violations = zone_features["total_violations"].sum()

    # Get current mean enforcement rate
    current_mean_enforcement = zone_features["enforcement_rate"].mean()
    print(f"  Current mean enforcement rate: {current_mean_enforcement:.2%}")
    print(f"  Baseline total CongestIQ:      {baseline_total_ciq:,.0f}")

    scenarios = []

    for target_rate in ENFORCEMENT_RATES:
        # Identify underperforming zones (below target)
        underperforming = zone_features[zone_features["enforcement_rate"] < target_rate].copy()

        if underperforming.empty:
            # All zones already meet or exceed this rate
            scenarios.append(_build_scenario(
                target_rate, baseline_total_ciq, baseline_total_ciq,
                baseline_total_violations, baseline_total_violations,
                [], ciq_map
            ))
            continue

        # Simulate: replace enforcement_rate with target_rate for underperforming zones
        simulated_features = zone_features.copy()
        mask = simulated_features["enforcement_rate"] < target_rate
        original_rates = simulated_features.loc[mask, "enforcement_rate"].copy()
        simulated_features.loc[mask, "enforcement_rate"] = target_rate

        # Predict new violations per day for all zones
        X_sim = simulated_features[feature_cols].values
        X_sim_scaled = scaler.transform(X_sim)
        predicted_vpd = model.predict(X_sim_scaled)
        predicted_vpd = np.clip(predicted_vpd, 0, None)  # no negative violations

        # Compute violation reduction per zone
        original_vpd = zone_features["violations_per_day"].values
        vpd_ratio = predicted_vpd / np.clip(original_vpd, 0.01, None)
        vpd_ratio = np.clip(vpd_ratio, 0.1, 1.5)  # sanity bounds

        # Apply ratio to CongestIQ scores
        simulated_ciq_total = 0
        zone_impacts = []
        for idx, row in zone_features.iterrows():
            zone_id = row["geohash"]
            if zone_id in ciq_map:
                original_ciq = ciq_map[zone_id]["congestiq_score"]
                simulated_ciq = original_ciq * vpd_ratio[idx]
                simulated_ciq_total += simulated_ciq

                if mask.iloc[idx]:  # only track impacted zones
                    zone_impacts.append({
                        "zone_id": zone_id,
                        "baseline": round(original_ciq, 1),
                        "simulated": round(simulated_ciq, 1),
                        "reduction_pct": round((1 - vpd_ratio[idx]) * 100, 1),
                        "original_enforcement": round(original_rates.get(idx, row["enforcement_rate"]), 4),
                    })
            else:
                # Zone not in CongestIQ (small zone), add minimal score
                simulated_ciq_total += 0

        # Add non-modeled zones (unchanged)
        for z in congestiq:
            if z["zone_id"] not in zone_features["geohash"].values:
                simulated_ciq_total += z["congestiq_score"]

        # Sort impacts by reduction
        zone_impacts.sort(key=lambda x: x["reduction_pct"], reverse=True)

        simulated_violations = predicted_vpd.sum() * zone_features["active_days"].mean()

        scenarios.append(_build_scenario(
            target_rate, baseline_total_ciq, simulated_ciq_total,
            baseline_total_violations, simulated_violations,
            zone_impacts[:20], ciq_map
        ))

    return scenarios


def _build_scenario(
    target_rate, baseline_ciq, simulated_ciq,
    baseline_violations, simulated_violations,
    top_impacts, ciq_map
) -> dict:
    """Build a single counterfactual scenario output."""
    reduction_pct = max(0, (1 - simulated_ciq / max(1, baseline_ciq)) * 100)
    violation_reduction = max(0, baseline_violations - simulated_violations)

    # Convert to hours saved
    # Each prevented violation avoids AVG_DELAY × AVG_VEHICLES_AFFECTED person-minutes
    person_minutes_saved_daily = (
        violation_reduction / max(1, 180)  # daily reduction
        * AVG_DELAY_PER_VIOLATION_MIN
        * AVG_VEHICLES_AFFECTED
    )
    hours_saved_monthly = person_minutes_saved_daily * 30 / 60

    # Flipkart delivery hours
    delivery_hours_saved = hours_saved_monthly * FLIPKART_FLEET_PROPORTION

    return {
        "scenario": f"enforcement_rate_{int(target_rate*100)}pct",
        "target_enforcement_rate": target_rate,
        "baseline_congestiq": round(baseline_ciq, 0),
        "simulated_congestiq": round(simulated_ciq, 0),
        "reduction_pct": round(reduction_pct, 1),
        "baseline_violations": int(baseline_violations),
        "simulated_violations": int(simulated_violations),
        "violation_reduction": int(max(0, baseline_violations - simulated_violations)),
        "hours_saved_monthly": round(hours_saved_monthly, 0),
        "delivery_hours_saved_monthly": round(delivery_hours_saved, 0),
        "top_zones_impacted": top_impacts,
    }


def main():
    print("=" * 60)
    print("KAVACH — Module 6: Counterfactual Simulation Engine")
    print("=" * 60)

    # Load data
    print("\n[STEP 1] Loading data ...")
    df, congestiq = load_data()

    # Build features
    zone_features = build_zone_features(df)

    # Train model
    model, scaler, feature_cols = train_enforcement_model(zone_features)

    # Run counterfactual scenarios
    scenarios = run_counterfactual(zone_features, congestiq, model, scaler, feature_cols)

    # Save
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(scenarios, f, indent=2)

    print(f"\n  Saved -> {OUTPUT_PATH}")
    print(f"  Scenarios: {len(scenarios)}")

    # Summary
    print(f"\n{'=' * 60}")
    print("COUNTERFACTUAL SUMMARY")
    print(f"  {'Rate':>6s}  {'Baseline CIQ':>14s}  {'Simulated CIQ':>14s}  {'Reduction':>10s}  {'Hours/mo':>10s}  {'Delivery hrs':>12s}")
    print(f"  {'-'*6}  {'-'*14}  {'-'*14}  {'-'*10}  {'-'*10}  {'-'*12}")
    for s in scenarios:
        print(f"  {s['target_enforcement_rate']:>5.0%}  "
              f"{s['baseline_congestiq']:>14,.0f}  "
              f"{s['simulated_congestiq']:>14,.0f}  "
              f"{s['reduction_pct']:>9.1f}%  "
              f"{s['hours_saved_monthly']:>10,.0f}  "
              f"{s['delivery_hours_saved_monthly']:>12,.0f}")

    # Highlight the 80% scenario (main presentation slide)
    s80 = next((s for s in scenarios if s["target_enforcement_rate"] == 0.80), None)
    if s80:
        print(f"\n  * KEY FINDING (80% enforcement):")
        print(f"    CongestIQ reduction:  {s80['reduction_pct']:.1f}%")
        print(f"    Hours saved/month:    {s80['hours_saved_monthly']:,.0f}")
        print(f"    Delivery hours saved: {s80['delivery_hours_saved_monthly']:,.0f}")
        if s80["top_zones_impacted"]:
            print(f"    Top impacted zone:    {s80['top_zones_impacted'][0]['zone_id']} "
                  f"(down {s80['top_zones_impacted'][0]['reduction_pct']:.1f}%)")

    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
