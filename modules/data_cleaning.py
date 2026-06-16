"""
KAVACH — Data Cleaning Pipeline
Produces: dataset/violations_clean.pkl
Consumed by: ALL modules (1-7)

Loads raw CSV, parses JSON columns, adds derived features
(vehicle_weight, time_multiplier, geohash zone), and saves
a clean DataFrame for all downstream modules.

Usage:
    python modules/data_cleaning.py
"""

import json
import sys
import warnings
from pathlib import Path

import geohash2
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_CSV = PROJECT_ROOT / "Dataset" / "jan to may police violation_anonymized791b166.csv"
OUTPUT_PKL = PROJECT_ROOT / "Dataset" / "violations_clean.pkl"

# ─── Constants ────────────────────────────────────────────
VEHICLE_WEIGHTS = {
    "SCOOTER": 1.0,
    "MOPED": 0.8,
    "MOTOR CYCLE": 1.0,
    "CAR": 2.0,
    "JEEP": 2.0,
    "VAN": 2.5,
    "PASSENGER AUTO": 1.5,
    "GOODS AUTO": 1.5,
    "MAXI-CAB": 3.0,
    "TEMPO": 3.0,
    "LGV": 5.0,
    "LORRY/GOODS VEHICLE": 6.0,
    "HGV": 8.0,
    "TANKER": 10.0,
    "BUS (BMTC/KSRTC)": 6.0,
    "PRIVATE BUS": 5.0,
}
DEFAULT_VEHICLE_WEIGHT = 1.5

GEOHASH_PRECISION = 6  # ~1.2km × 0.6km cells — universal zone_id


def get_time_multiplier(hour: int) -> float:
    """Return congestion time multiplier based on hour of day."""
    if 7 <= hour <= 9:
        return 2.5   # morning rush
    if 17 <= hour <= 19:
        return 2.5   # evening rush
    if 11 <= hour <= 16:
        return 1.5   # daytime
    return 0.8        # night / off-peak


def safe_parse_json(val):
    """Parse a JSON array string, handling edge cases."""
    if pd.isna(val) or val == "NULL" or val == "":
        return []
    if isinstance(val, list):
        return val
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return []


def compute_geohash(lat: float, lng: float) -> str:
    """Encode lat/lng to geohash at project-standard precision."""
    try:
        return geohash2.encode(lat, lng, precision=GEOHASH_PRECISION)
    except Exception:
        return ""


def run_cleaning():
    """Main cleaning pipeline. Returns the cleaned DataFrame."""

    # ── 1. Load raw CSV ──────────────────────────────────
    print(f"[1/7] Loading raw CSV from {RAW_CSV} ...")
    if not RAW_CSV.exists():
        print(f"ERROR: Raw CSV not found at {RAW_CSV}")
        sys.exit(1)

    df = pd.read_csv(
        RAW_CSV,
        dtype={
            "id": str,
            "vehicle_type": str,
            "police_station": str,
            "junction_name": str,
            "data_sent_to_scita": str,
            "validation_status": str,
            "center_code": str,
        },
        low_memory=False,
    )
    print(f"    Loaded {len(df):,} rows, {len(df.columns)} columns")

    # ── 2. Drop rows without valid GPS ───────────────────
    print("[2/7] Cleaning coordinates ...")
    before = len(df)
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[(df["latitude"] != 0) & (df["longitude"] != 0)]
    # Bengaluru bounding box sanity check (generous)
    df = df[
        (df["latitude"].between(12.7, 13.2))
        & (df["longitude"].between(77.3, 77.9))
    ]
    print(f"    Dropped {before - len(df):,} rows with invalid coords -> {len(df):,} remain")

    # ── 3. Clean text columns ────────────────────────────
    print("[3/7] Cleaning text columns ...")
    df["vehicle_type"] = df["vehicle_type"].str.strip().str.upper()
    df["police_station"] = df["police_station"].str.strip()
    df["junction_name"] = df["junction_name"].fillna("No Junction").str.strip()
    df["validation_status"] = df["validation_status"].fillna("unknown").str.strip().str.lower()

    # Parse boolean: data_sent_to_scita
    df["data_sent_to_scita"] = df["data_sent_to_scita"].map(
        {"TRUE": True, "True": True, "true": True,
         "FALSE": False, "False": False, "false": False}
    ).fillna(False).astype(bool)

    # ── 4. Parse JSON array columns ──────────────────────
    print("[4/7] Parsing violation_type & offence_code JSON arrays ...")
    df["violation_type"] = df["violation_type"].apply(safe_parse_json)
    df["offence_code"] = df["offence_code"].apply(safe_parse_json)

    # ── 5. Derive temporal columns ───────────────────────
    print("[5/7] Deriving temporal features ...")
    # Parse datetime explicitly (handles timezone offsets like +00)
    df["created_datetime"] = pd.to_datetime(df["created_datetime"], utc=True, errors="coerce")
    df = df.dropna(subset=["created_datetime"])

    df["hour"] = df["created_datetime"].dt.hour
    df["dow"] = df["created_datetime"].dt.dayofweek   # 0=Mon
    df["month"] = df["created_datetime"].dt.month
    df["date"] = df["created_datetime"].dt.date

    # ── 6. Add vehicle_weight + time_multiplier ──────────
    print("[6/7] Adding vehicle_weight and time_multiplier ...")
    df["vehicle_weight"] = df["vehicle_type"].map(VEHICLE_WEIGHTS).fillna(DEFAULT_VEHICLE_WEIGHT)
    df["time_multiplier"] = df["hour"].apply(get_time_multiplier)

    # ── 7. Compute geohash zone ──────────────────────────
    print("[7/7] Computing geohash zones (precision={}) ...".format(GEOHASH_PRECISION))
    df["geohash"] = [
        compute_geohash(lat, lng)
        for lat, lng in zip(df["latitude"].values, df["longitude"].values)
    ]
    # Drop rows where geohash failed
    df = df[df["geohash"] != ""]

    # ── Select final columns ─────────────────────────────
    keep_cols = [
        "id", "latitude", "longitude",
        "vehicle_type", "violation_type", "offence_code",
        "created_datetime", "police_station", "junction_name",
        "data_sent_to_scita", "validation_status", "center_code",
        "hour", "dow", "month", "date",
        "vehicle_weight", "time_multiplier", "geohash",
    ]
    df = df[keep_cols].reset_index(drop=True)

    return df


def print_summary(df: pd.DataFrame):
    """Print diagnostic summary of the cleaned dataset."""
    print("\n" + "=" * 60)
    print("CLEANING COMPLETE — Summary")
    print("=" * 60)
    print(f"  Total rows:           {len(df):,}")
    print(f"  Date range:           {df['created_datetime'].min()} -> {df['created_datetime'].max()}")
    print(f"  Unique zones:         {df['geohash'].nunique():,}")
    print(f"  Unique junctions:     {df[df['junction_name'] != 'No Junction']['junction_name'].nunique()}")
    print(f"  Police stations:      {df['police_station'].nunique()}")
    print(f"  Vehicle types:        {df['vehicle_type'].nunique()}")
    print()
    print("  Top 5 vehicle types:")
    for vt, cnt in df["vehicle_type"].value_counts().head().items():
        print(f"    {vt:25s} {cnt:>7,}  (weight={VEHICLE_WEIGHTS.get(vt, DEFAULT_VEHICLE_WEIGHT)})")
    print()
    print("  Top 5 zones (geohash):")
    for gh, cnt in df["geohash"].value_counts().head().items():
        print(f"    {gh}  ->  {cnt:>6,} violations")
    print()
    print("  Enforcement rate:     {:.1%}".format(df["data_sent_to_scita"].mean()))
    print("  Approval rate:        {:.1%}".format(
        (df["validation_status"] == "approved").sum()
        / max(1, ((df["validation_status"] == "approved") | (df["validation_status"] == "rejected")).sum())
    ))
    print("=" * 60)


if __name__ == "__main__":
    df = run_cleaning()
    print_summary(df)

    # Save
    OUTPUT_PKL.parent.mkdir(parents=True, exist_ok=True)
    df.to_pickle(OUTPUT_PKL)
    print(f"\nSaved -> {OUTPUT_PKL}  ({OUTPUT_PKL.stat().st_size / 1e6:.1f} MB)")
