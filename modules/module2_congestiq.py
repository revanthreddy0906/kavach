"""
KAVACH — Module 2: CongestIQ Score
Produces: outputs/zone_congestiq.json
Depends on: dataset/violations_clean.pkl, outputs/cascade_data.json

Composite scoring formula per zone:
  CongestIQ = Σ(vehicle_weight × time_multiplier × cascade_reach)

Normalized, ranked, and enriched with per-zone metadata for
the heatmap API and downstream modules.

Usage:
    python modules/module2_congestiq.py
"""

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PKL_PATH = PROJECT_ROOT / "Dataset" / "violations_clean.pkl"
CASCADE_PATH = PROJECT_ROOT / "outputs" / "cascade_data.json"
OUTPUT_PATH = PROJECT_ROOT / "outputs" / "zone_congestiq.json"


def load_data():
    """Load violations and cascade data."""
    if not PKL_PATH.exists():
        print(f"ERROR: {PKL_PATH} not found. Run data_cleaning.py first.")
        sys.exit(1)
    df = pd.read_pickle(PKL_PATH)
    print(f"  Loaded {len(df):,} violations")

    cascade_data = {}
    if CASCADE_PATH.exists():
        with open(CASCADE_PATH) as f:
            cascade_data = json.load(f)
        print(f"  Loaded cascade data for {len(cascade_data)} zones")
    else:
        print(f"  WARNING: {CASCADE_PATH} not found. cascade_reach will default to 1.")

    return df, cascade_data


def compute_congestiq(df: pd.DataFrame, cascade_data: dict) -> list:
    """
    Compute CongestIQ score per zone (geohash).

    Formula:
        Raw CongestIQ = Σ (vehicle_weight × time_multiplier) across all violations
        cascade_reach = number of downstream road nodes at 60min from Module 1
        Final CongestIQ = Raw × log2(1 + cascade_reach)

    The log scaling of cascade_reach prevents extreme outliers from
    dominating while still rewarding zones with wide impact.
    """
    print("\n[CONGESTIQ] Computing per-zone scores ...")

    # ── Per-violation weighted contribution ───────────────
    df["weighted_contribution"] = df["vehicle_weight"] * df["time_multiplier"]

    # ── Aggregate per zone ────────────────────────────────
    zone_stats = df.groupby("geohash").agg(
        lat=("latitude", "mean"),
        lng=("longitude", "mean"),
        total_violations=("id", "count"),
        raw_congestiq=("weighted_contribution", "sum"),
        # Vehicle distribution
        dominant_vehicle=("vehicle_type", lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else "UNKNOWN"),
        avg_vehicle_weight=("vehicle_weight", "mean"),
        # Violation types
        primary_violation=("violation_type", lambda x: _most_common_violation(x)),
        # Temporal patterns
        peak_hour=("hour", lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else 8),
        # Enforcement
        enforcement_rate=("data_sent_to_scita", "mean"),
        # Unique days active
        active_days=("date", "nunique"),
    ).reset_index()

    # ── Cascade reach multiplier ──────────────────────────
    zone_stats["cascade_reach"] = zone_stats["geohash"].map(
        lambda z: cascade_data.get(z, {}).get("cascade_reach", 1)
    )

    # Log-scaled cascade factor: log2(1 + reach) ensures:
    #   reach=0 -> factor=0 (effectively 1 after +1 in formula)
    #   reach=10 -> factor~3.5
    #   reach=100 -> factor~6.7
    #   reach=1000 -> factor~10
    zone_stats["cascade_factor"] = np.log2(1 + zone_stats["cascade_reach"])

    # ── Final CongestIQ ───────────────────────────────────
    zone_stats["congestiq_score"] = zone_stats["raw_congestiq"] * zone_stats["cascade_factor"]

    # ── Violations per day (intensity) ────────────────────
    zone_stats["violations_per_day"] = (
        zone_stats["total_violations"] / zone_stats["active_days"].clip(lower=1)
    )

    # ── Hourly pattern analysis ───────────────────────────
    # Compute per-zone hourly distribution for predicted_score_6h
    hourly = df.groupby(["geohash", "hour"]).agg(
        hourly_congestiq=("weighted_contribution", "sum"),
    ).reset_index()

    # For each zone, predict score 6 hours from peak
    zone_hour_scores = {}
    for zone_id in zone_stats["geohash"].values:
        z_hourly = hourly[hourly["geohash"] == zone_id].set_index("hour")["hourly_congestiq"]
        if z_hourly.empty:
            zone_hour_scores[zone_id] = 0
            continue
        peak = z_hourly.idxmax()
        future_hour = (peak + 6) % 24
        zone_hour_scores[zone_id] = z_hourly.get(future_hour, z_hourly.mean())

    zone_stats["predicted_score_6h"] = zone_stats["geohash"].map(zone_hour_scores)

    # Apply cascade factor to predicted score too
    zone_stats["predicted_score_6h"] = (
        zone_stats["predicted_score_6h"] * zone_stats["cascade_factor"]
    )

    # ── Rank zones ────────────────────────────────────────
    zone_stats = zone_stats.sort_values("congestiq_score", ascending=False).reset_index(drop=True)
    zone_stats["rank"] = range(1, len(zone_stats) + 1)

    # ── Severity classification ───────────────────────────
    p75 = zone_stats["congestiq_score"].quantile(0.75)
    p90 = zone_stats["congestiq_score"].quantile(0.90)

    def classify_severity(score):
        if score >= p90:
            return "critical"
        if score >= p75:
            return "high"
        if score >= zone_stats["congestiq_score"].median():
            return "medium"
        return "low"

    zone_stats["severity"] = zone_stats["congestiq_score"].apply(classify_severity)

    return zone_stats


def _most_common_violation(violation_lists):
    """Extract the most common violation from nested lists."""
    flat = []
    for vlist in violation_lists:
        if isinstance(vlist, list):
            flat.extend(vlist)
    if not flat:
        return "UNKNOWN"
    return pd.Series(flat).mode().iloc[0]


def format_output(zone_stats: pd.DataFrame) -> list:
    """Format zone stats into the API-contract JSON schema."""
    output = []
    for _, row in zone_stats.iterrows():
        output.append({
            "zone_id": row["geohash"],
            "lat": round(row["lat"], 6),
            "lng": round(row["lng"], 6),
            "congestiq_score": round(float(row["congestiq_score"]), 1),
            "raw_congestiq": round(float(row["raw_congestiq"]), 1),
            "cascade_reach": int(row["cascade_reach"]),
            "cascade_factor": round(float(row["cascade_factor"]), 2),
            "total_violations": int(row["total_violations"]),
            "violations_per_day": round(float(row["violations_per_day"]), 1),
            "primary_violation": row["primary_violation"],
            "dominant_vehicle": row["dominant_vehicle"],
            "avg_vehicle_weight": round(float(row["avg_vehicle_weight"]), 2),
            "peak_hour": int(row["peak_hour"]),
            "enforcement_rate": round(float(row["enforcement_rate"]), 4),
            "predicted_score_6h": round(float(row["predicted_score_6h"]), 1),
            "severity": row["severity"],
            "rank": int(row["rank"]),
        })
    return output


def main():
    print("=" * 60)
    print("KAVACH — Module 2: CongestIQ Score")
    print("=" * 60)

    # Load data
    print("\n[STEP 1] Loading data ...")
    df, cascade_data = load_data()

    # Compute CongestIQ
    zone_stats = compute_congestiq(df, cascade_data)

    # Format and save
    output = format_output(zone_stats)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  Saved -> {OUTPUT_PATH}")
    print(f"  Zones: {len(output)}")

    # Summary
    print(f"\n{'=' * 60}")
    print("CONGESTIQ SUMMARY")
    print(f"  Total zones scored:    {len(output)}")
    print(f"  Score range:           {output[-1]['congestiq_score']:.1f} -> {output[0]['congestiq_score']:.1f}")
    print(f"  Mean score:            {zone_stats['congestiq_score'].mean():.1f}")
    print(f"  Median score:          {zone_stats['congestiq_score'].median():.1f}")
    severity_counts = zone_stats["severity"].value_counts()
    for sev in ["critical", "high", "medium", "low"]:
        cnt = severity_counts.get(sev, 0)
        print(f"  {sev:12s} zones:   {cnt}")
    print(f"\n  Top 10 zones:")
    for item in output[:10]:
        print(f"    #{item['rank']:3d}  {item['zone_id']}  score={item['congestiq_score']:8.1f}  "
              f"reach={item['cascade_reach']:4d}  violations={item['total_violations']:5d}  "
              f"vehicle={item['dominant_vehicle']}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
