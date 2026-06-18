"""
KAVACH — Temporal Prediction Module
LightGBM model predicting violation counts per zone per hour for the next 24 hours.

Run: python modules/temporal_prediction.py
Outputs:
    outputs/zone_temporal_predictions.json
    models/temporal_model.pkl
"""

import sys
import json
import pickle
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from itertools import product
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error

sys.stdout.reconfigure(encoding="utf-8")
import lightgbm as lgb

warnings.filterwarnings("ignore")

ROOT        = Path(__file__).resolve().parent.parent
DATA_PATH   = ROOT / "Dataset" / "violations_clean.pkl"
MODEL_PATH  = ROOT / "models"  / "temporal_model.pkl"
OUTPUT_PATH = ROOT / "outputs" / "zone_temporal_predictions.json"

LGBM_PARAMS = {
    "n_estimators":     500,
    "learning_rate":    0.05,
    "max_depth":        8,
    "num_leaves":       63,
    "min_child_samples": 20,
    "subsample":        0.8,
    "colsample_bytree": 0.8,
    "reg_alpha":        0.1,
    "reg_lambda":       0.1,
    "random_state":     42,
    "n_jobs":           -1,
    "verbose":          -1,
}

FEATURES = [
    "hour", "dow", "month", "is_weekend",
    "zone_encoded",
    "zone_historical_avg", "zone_hour_avg",
    "lag_1h", "lag_24h", "lag_168h",
    "rolling_7d_avg",
]

MIN_VIOLATIONS = 5   # minimum total violations for a zone to appear in output


# ── Data loading ──────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    """Load violations_clean.pkl produced by data_cleaning.py."""
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found. Run data_cleaning.py first.")
        sys.exit(1)
    print("Loading violations_clean.pkl...")
    df = pd.read_pickle(DATA_PATH)
    print(f"  {len(df):,} rows  |  {df['geohash'].nunique()} zones")
    return df


# ── Time-series construction ──────────────────────────────────────────────────

def build_complete_time_series(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate violations per (geohash, date, hour) and expand to a complete
    hourly grid (every zone × every date × every hour = 0 where no violations).
    This is required so shift-based lag features never skip time steps.
    """
    print("Building complete hourly time series...")

    df = df.copy()
    df["_date"] = pd.to_datetime(df["created_datetime"]).dt.normalize()

    hourly = (
        df.groupby(["geohash", "_date", "hour"])
        .size()
        .reset_index(name="violation_count")
    )

    all_zones = df["geohash"].unique()
    all_dates = pd.date_range(df["_date"].min(), df["_date"].max(), freq="D")

    full_idx = pd.MultiIndex.from_product(
        [all_zones, all_dates, range(24)],
        names=["geohash", "_date", "hour"],
    )
    ts = pd.DataFrame(index=full_idx).reset_index()
    ts = ts.merge(hourly, on=["geohash", "_date", "hour"], how="left")
    ts["violation_count"] = ts["violation_count"].fillna(0.0)
    ts = ts.sort_values(["geohash", "_date", "hour"]).reset_index(drop=True)

    print(f"  Grid: {len(ts):,} rows  ({ts['geohash'].nunique()} zones × {len(all_dates)} days × 24h)")
    return ts


def add_lag_features(ts: pd.DataFrame) -> pd.DataFrame:
    """
    Add lag and rolling features within each zone's time series.
    Grouped shift on a complete grid means shift(1)=previous hour exactly.
    """
    print("Computing lag features...")
    grp = ts.groupby("geohash")["violation_count"]

    ts["lag_1h"]   = grp.shift(1).fillna(0.0)
    ts["lag_24h"]  = grp.shift(24).fillna(0.0)
    ts["lag_168h"] = grp.shift(168).fillna(0.0)

    # 7-day rolling average at each position (shifted by 1 to avoid leakage)
    ts["rolling_7d_avg"] = (
        grp.transform(lambda x: x.shift(1).rolling(168, min_periods=24).mean())
        .fillna(0.0)
    )
    return ts


def add_static_features(ts: pd.DataFrame) -> tuple[pd.DataFrame, LabelEncoder]:
    """
    Add calendar features, zone label encoding, and data-driven zone-hour weights.
    The zone_hour_avg is a per-(zone, hour) historical mean — it replaces the
    synthetic uniform time_multiplier from the cleaned dataset.
    """
    print("Adding calendar and zone features...")

    ts["dow"]        = ts["_date"].dt.dayofweek
    ts["month"]      = ts["_date"].dt.month
    ts["is_weekend"] = (ts["dow"] >= 5).astype(np.int8)

    le = LabelEncoder()
    ts["zone_encoded"] = le.fit_transform(ts["geohash"])

    zone_hist = (
        ts.groupby("geohash")["violation_count"]
        .mean()
        .rename("zone_historical_avg")
    )
    ts = ts.merge(zone_hist, on="geohash")

    # Data-driven hourly density per zone (the key improvement over synthetic multiplier)
    zone_hour_avg = (
        ts.groupby(["geohash", "hour"])["violation_count"]
        .mean()
        .rename("zone_hour_avg")
        .reset_index()
    )
    ts = ts.merge(zone_hour_avg, on=["geohash", "hour"])

    return ts, le


# ── Vehicle mix ───────────────────────────────────────────────────────────────

def compute_vehicle_mix(df: pd.DataFrame) -> dict:
    """Per-zone vehicle type proportions from historical violations."""
    print("Computing vehicle mix per zone...")

    mix = (
        df.groupby(["geohash", "vehicle_type"])
        .size()
        .reset_index(name="cnt")
    )
    totals = mix.groupby("geohash")["cnt"].transform("sum")
    mix["prop"] = mix["cnt"] / totals

    zone_mix = {}
    for zone, grp in mix.groupby("geohash"):
        result, other = {}, 0.0
        for _, row in grp.nlargest(15, "prop").iterrows():
            if row["prop"] >= 0.03:
                result[row["vehicle_type"]] = round(float(row["prop"]), 2)
            else:
                other += row["prop"]
        if other > 0:
            result["OTHER"] = round(other, 2)
        # Renormalize to sum exactly to 1.0
        total = sum(result.values())
        if total > 0:
            result = {k: round(v / total, 2) for k, v in result.items()}
        zone_mix[zone] = result

    return zone_mix


# ── Training and evaluation ───────────────────────────────────────────────────

def train_model(ts: pd.DataFrame) -> tuple:
    """
    Temporal split: Nov 2023 – Mar 2024 = train, Apr 2024 = test.
    Returns model, global RMSE, global MAE, per-zone RMSE dict.
    """
    print("Splitting train / test (temporal)...")

    train_mask = ts["_date"] < "2024-04-01"
    test_mask  = ts["_date"] >= "2024-04-01"

    X_train, y_train = ts.loc[train_mask, FEATURES], ts.loc[train_mask, "violation_count"]
    X_test,  y_test  = ts.loc[test_mask,  FEATURES], ts.loc[test_mask,  "violation_count"]

    print(f"  Train: {len(X_train):,} rows  |  Test: {len(X_test):,} rows")
    print("Training LightGBM...")

    model = lgb.LGBMRegressor(**LGBM_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[
            lgb.early_stopping(50, verbose=False),
            lgb.log_evaluation(100),
        ],
    )

    preds = np.maximum(0.0, model.predict(X_test))
    rmse  = float(np.sqrt(mean_squared_error(y_test, preds)))
    mae   = float(mean_absolute_error(y_test, preds))
    print(f"\n  Global RMSE : {rmse:.4f}")
    print(f"  Global MAE  : {mae:.4f}")

    # Per-zone RMSE on test set
    ts_test = ts[test_mask].copy()
    ts_test["_pred"] = preds
    zone_rmse = {}
    for zone, grp in ts_test.groupby("geohash"):
        if len(grp) > 1:
            zone_rmse[zone] = float(
                np.sqrt(mean_squared_error(grp["violation_count"], grp["_pred"]))
            )

    # Top-20 zones by test-set violation volume
    top20 = (
        ts_test.groupby("geohash")["violation_count"]
        .sum()
        .nlargest(20)
        .index.tolist()
    )
    print("\n  Per-zone RMSE — top 20 zones (test set):")
    for z in top20:
        print(f"    {z}  {zone_rmse.get(z, 0.0):.3f}")

    return model, rmse, mae, zone_rmse


# ── Prediction generation ─────────────────────────────────────────────────────

def generate_predictions(
    ts: pd.DataFrame,
    model: lgb.LGBMRegressor,
    zone_rmse: dict,
    global_rmse: float,
) -> pd.DataFrame:
    """
    Predict violations for every (zone, hour) in the next 24 hours.
    Uses the last available date's actual values as lag context.
    """
    print("\nGenerating 24h predictions per zone...")

    last_date   = ts["_date"].max()
    week_ago    = last_date - pd.Timedelta(days=7)
    next_dow    = (last_date.dayofweek + 1) % 7
    next_month  = last_date.month
    is_weekend  = int(next_dow >= 5)

    # Filter to zones with enough history
    zone_totals = ts.groupby("geohash")["violation_count"].sum()
    valid_zones = zone_totals[zone_totals >= MIN_VIOLATIONS].index.tolist()
    ts_v = ts[ts["geohash"].isin(valid_zones)]

    # Lookup tables (indexed for O(1) access)
    last_day_lookup = (
        ts_v[ts_v["_date"] == last_date]
        .set_index(["geohash", "hour"])["violation_count"]
    )
    week_ago_lookup = (
        ts_v[ts_v["_date"] == week_ago]
        .set_index(["geohash", "hour"])["violation_count"]
    )
    rolling_lookup = (
        ts_v[
            (ts_v["_date"] > last_date - pd.Timedelta(days=7)) &
            (ts_v["_date"] <= last_date)
        ]
        .groupby(["geohash", "hour"])["violation_count"]
        .mean()
    )

    # Zone-level static features
    zone_static = ts_v.groupby("geohash").agg(
        zone_encoded=("zone_encoded", "first"),
        zone_historical_avg=("zone_historical_avg", "first"),
    )
    zone_hour_avg_lookup = (
        ts_v.groupby(["geohash", "hour"])["zone_hour_avg"].first()
    )

    # Build prediction rows vectorised over (zone × hour)
    rows = []
    for zone in valid_zones:
        enc  = int(zone_static.loc[zone, "zone_encoded"])
        hist = float(zone_static.loc[zone, "zone_historical_avg"])

        for hour in range(24):
            prev_hour = (hour - 1) % 24

            lag24h  = float(last_day_lookup.get((zone, hour),     0.0))
            lag1h   = float(last_day_lookup.get((zone, prev_hour), 0.0))
            lag168h = float(week_ago_lookup.get((zone, hour),      0.0))
            roll7d  = float(rolling_lookup.get((zone, hour),       0.0))
            zha     = float(zone_hour_avg_lookup.get((zone, hour), 0.0))

            rows.append({
                "geohash":            zone,
                "hour":               hour,
                "dow":                next_dow,
                "month":              next_month,
                "is_weekend":         is_weekend,
                "zone_encoded":       enc,
                "zone_historical_avg": hist,
                "zone_hour_avg":      zha,
                "lag_1h":             lag1h,
                "lag_24h":            lag24h,
                "lag_168h":           lag168h,
                "rolling_7d_avg":     roll7d,
            })

    pred_df = pd.DataFrame(rows)
    pred_df["predicted"] = np.maximum(0.0, model.predict(pred_df[FEATURES]))
    pred_df["zone_rmse"] = pred_df["geohash"].map(zone_rmse).fillna(global_rmse)

    print(f"  {len(pred_df):,} predictions  ({len(valid_zones)} zones × 24h)")
    return pred_df


# ── Output formatting ─────────────────────────────────────────────────────────

def build_output_json(pred_df: pd.DataFrame, zone_mix: dict) -> list:
    """Format prediction DataFrame into the required JSON schema."""
    output = []
    for _, row in pred_df.iterrows():
        zone   = row["geohash"]
        pred   = float(row["predicted"])
        z_rmse = float(row["zone_rmse"])
        output.append({
            "zone_id":               zone,
            "hour":                  int(row["hour"]),
            "predicted_violations":  round(pred, 1),
            "predicted_vehicle_mix": zone_mix.get(zone, {"OTHER": 1.0}),
            "confidence_lower":      round(max(0.0, pred - 1.5 * z_rmse), 1),
            "confidence_upper":      round(pred + 1.5 * z_rmse, 1),
        })
    return output


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("KAVACH — Temporal Prediction Module")
    print("=" * 60)

    df = load_data()

    ts = build_complete_time_series(df)
    ts = add_lag_features(ts)
    ts, le = add_static_features(ts)

    vehicle_mix = compute_vehicle_mix(df)

    model, global_rmse, global_mae, zone_rmse = train_model(ts)

    # Save model bundle
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model":           model,
        "label_encoder":   le,
        "feature_columns": FEATURES,
        "metrics":         {"rmse": global_rmse, "mae": global_mae},
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(bundle, f)
    print(f"\nModel saved  ->  {MODEL_PATH}")

    pred_df = generate_predictions(ts, model, zone_rmse, global_rmse)
    output  = build_output_json(pred_df, vehicle_mix)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    n_zones = len(pred_df["geohash"].unique())
    print(f"Output saved ->  {OUTPUT_PATH}")
    print(f"  {len(output):,} entries  ({n_zones} zones x 24 hours)")
    print("\nDone.")


if __name__ == "__main__":
    main()
