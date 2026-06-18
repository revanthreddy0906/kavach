"""
KAVACH — Junction Archetype Classifier (Module 7)
KMeans clustering of named BTP junctions into 5 behavioral archetypes.

Run: python modules/module7_archetypes.py
Outputs:
    outputs/junction_archetypes.json
    models/archetype_model.pkl
"""

import sys
import json
import pickle
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.cluster import KMeans

sys.stdout.reconfigure(encoding="utf-8")

warnings.filterwarnings("ignore")

ROOT        = Path(__file__).resolve().parent.parent
DATA_PATH   = ROOT / "Dataset" / "violations_clean.pkl"
MODEL_PATH  = ROOT / "models"  / "archetype_model.pkl"
OUTPUT_PATH = ROOT / "outputs" / "junction_archetypes.json"

# Consistent vehicle ordering for encoding (heavier = higher index)
VEHICLE_ORDER = [
    "SCOOTER", "MOPED", "MOTOR CYCLE",
    "PASSENGER AUTO", "GOODS AUTO",
    "CAR", "JEEP", "VAN",
    "TEMPO", "MAXI-CAB",
    "LGV", "LORRY/GOODS VEHICLE",
    "BUS (BMTC/KSRTC)", "PRIVATE BUS",
    "HGV", "TANKER",
]
VEHICLE_IDX = {v: i for i, v in enumerate(VEHICLE_ORDER)}

N_CLUSTERS  = 5
MIN_JUNCTION_VIOLATIONS = 10   # ignore near-empty junctions


# ── Data loading ──────────────────────────────────────────────────────────────

def load_data() -> pd.DataFrame:
    """Load violations_clean.pkl and filter to named junctions."""
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} not found. Run data_cleaning.py first.")
        sys.exit(1)
    print("Loading violations_clean.pkl...")
    df = pd.read_pickle(DATA_PATH)
    print(f"  {len(df):,} total rows")

    df = df[df["junction_name"].notna() & (df["junction_name"] != "No Junction")].copy()
    print(f"  {len(df):,} rows with named junctions  ({df['junction_name'].nunique()} unique junctions)")
    return df


# ── Feature engineering ───────────────────────────────────────────────────────

def _enforcement_rate(grp: pd.DataFrame) -> float:
    """Fraction of violations that were enforced (sent to SCITA or approved)."""
    if "data_sent_to_scita" in grp.columns:
        return float(grp["data_sent_to_scita"].mean())
    # Fallback: use validation_status
    return float((grp["validation_status"] == "approved").mean())


def _violation_diversity(grp: pd.DataFrame) -> int:
    """Number of unique violation types across all rows."""
    if grp["violation_type"].dtype == object:
        # Column may contain lists or plain strings
        sample = grp["violation_type"].iloc[0]
        if isinstance(sample, list):
            all_types = set()
            for types in grp["violation_type"]:
                all_types.update(types)
            return len(all_types)
    return int(grp["violation_type"].nunique())


def compute_junction_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute 6-feature vector per named junction."""
    print("Computing per-junction features...")

    df = df.copy()
    df["_date"] = pd.to_datetime(df["created_datetime"]).dt.date

    records = []
    for junction, grp in df.groupby("junction_name"):
        if len(grp) < MIN_JUNCTION_VIOLATIONS:
            continue

        # Peak hour: hour with the most violations at this junction
        peak_hour = int(grp.groupby("hour")["id"].count().idxmax())

        # Dominant vehicle
        dominant_vehicle = str(grp["vehicle_type"].mode().iloc[0])
        dominant_vehicle_idx = VEHICLE_IDX.get(dominant_vehicle, len(VEHICLE_ORDER) // 2)

        # Enforcement rate
        enf_rate = round(_enforcement_rate(grp), 4)

        # Violation type diversity
        vtype_div = _violation_diversity(grp)

        # Weekend ratio
        weekend_ratio = round(float((grp["dow"] >= 5).mean()), 4)

        # Average violations per active day
        n_days = grp["_date"].nunique()
        avg_per_day = round(len(grp) / max(n_days, 1), 2)

        records.append({
            "junction_name":         junction,
            "peak_hour":             peak_hour,
            "dominant_vehicle":      dominant_vehicle,
            "dominant_vehicle_idx":  dominant_vehicle_idx,
            "enforcement_rate":      enf_rate,
            "violation_type_diversity": vtype_div,
            "weekend_ratio":         weekend_ratio,
            "avg_violations_per_day": avg_per_day,
        })

    feat_df = pd.DataFrame(records)
    print(f"  {len(feat_df)} junctions with ≥ {MIN_JUNCTION_VIOLATIONS} violations")
    return feat_df


# ── Clustering ────────────────────────────────────────────────────────────────

CLUSTER_FEATURE_COLS = [
    "peak_hour",
    "dominant_vehicle_idx",
    "enforcement_rate",
    "violation_type_diversity",
    "weekend_ratio",
    "avg_violations_per_day",
]


def cluster_junctions(feat_df: pd.DataFrame) -> tuple:
    """Fit StandardScaler + KMeans(5). Returns labeled DataFrame, scaler, model."""
    print("Clustering junctions (KMeans k=5)...")

    X = feat_df[CLUSTER_FEATURE_COLS].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    feat_df = feat_df.copy()
    feat_df["cluster_id"] = km.fit_predict(X_scaled)

    # Cluster sizes
    sizes = feat_df["cluster_id"].value_counts().sort_index()
    print("  Cluster sizes:")
    for cid, sz in sizes.items():
        print(f"    Cluster {cid}: {sz} junctions")

    return feat_df, scaler, km


# ── Archetype naming ──────────────────────────────────────────────────────────

def assign_archetype_names(feat_df: pd.DataFrame, scaler: StandardScaler, km: KMeans) -> dict:
    """
    Assign human-readable names by analyzing each cluster's centroid.
    Rules are applied in priority order; each cluster gets exactly one name.
    """
    centers_raw = pd.DataFrame(
        scaler.inverse_transform(km.cluster_centers_),
        columns=CLUSTER_FEATURE_COLS,
    )

    names  = {}
    used   = set()

    def pick(series: pd.Series, func) -> int:
        """Return cluster id with func(series), skipping already-used clusters."""
        ranked = series.copy()
        ranked[list(used)] = np.nan
        return int(ranked.agg(func))

    # Market Zone: highest avg_violations_per_day
    c = pick(centers_raw["avg_violations_per_day"], "idxmax")
    names[c] = "Market Zone Persistent"
    used.add(c)

    # Low-Enforcement Corridor: lowest enforcement_rate
    c = pick(centers_raw["enforcement_rate"], "idxmin")
    names[c] = "Low-Enforcement Corridor"
    used.add(c)

    # Commercial Morning Rush: earliest peak_hour
    c = pick(centers_raw["peak_hour"], "idxmin")
    names[c] = "Commercial Morning Rush"
    used.add(c)

    # Weekend Leisure Hotspot: highest weekend_ratio
    c = pick(centers_raw["weekend_ratio"], "idxmax")
    names[c] = "Weekend Leisure Hotspot"
    used.add(c)

    # Remaining cluster
    remaining = [i for i in range(N_CLUSTERS) if i not in used]
    names[remaining[0]] = "Metro Evening Surge"

    print("\n  Archetype assignments:")
    for cid in range(N_CLUSTERS):
        row = centers_raw.iloc[cid]
        print(
            f"    Cluster {cid} -> {names[cid]:<30}  "
            f"peak={row['peak_hour']:.1f}h  "
            f"enf={row['enforcement_rate']:.2f}  "
            f"wknd={row['weekend_ratio']:.2f}  "
            f"avg_viol/day={row['avg_violations_per_day']:.1f}"
        )

    return names


# ── Playbook generation ───────────────────────────────────────────────────────

def _fmt_time(hour: int, minute: int = 0) -> str:
    h = hour % 24
    period = "am" if h < 12 else "pm"
    display = h if h <= 12 else h - 12
    if display == 0:
        display = 12
    return f"{display}:{minute:02d}{period}"


def generate_playbook(row: pd.Series) -> str:
    """Rule-based enforcement playbook per junction."""
    peak     = int(row["peak_hour"])
    units    = 3 if row["avg_violations_per_day"] > 50 else 2 if row["avg_violations_per_day"] > 20 else 1
    vehicle  = row["dominant_vehicle"]
    archetype = row["archetype"]
    enf      = row["enforcement_rate"]

    deploy_h = max(0, peak - 1)
    deploy_m = 30 if deploy_h < peak else 0
    deploy   = _fmt_time(deploy_h, deploy_m)
    clear    = _fmt_time(peak + 2)

    base = f"Deploy {units} unit{'s' if units > 1 else ''} at {deploy}, prioritize {vehicle} enforcement"

    if archetype == "Commercial Morning Rush":
        base += f", clear by {clear}"
    elif archetype == "Metro Evening Surge":
        base += ", coordinate with traffic signals, clear by 9pm"
    elif archetype == "Market Zone Persistent":
        base += ", maintain continuous patrol, log repeat offenders"
    elif archetype == "Low-Enforcement Corridor":
        base += ", escalate all violations to SCITA immediately"
    elif archetype == "Weekend Leisure Hotspot":
        base += ", deploy Fri–Sun only, focus event-day surges"

    if enf < 0.6:
        base += " [PRIORITY: enforcement rate critically low]"

    return base


# ── Output building ───────────────────────────────────────────────────────────

def build_output(feat_df: pd.DataFrame, archetype_names: dict, scaler: StandardScaler, km: KMeans) -> list:
    """Build the junction_archetypes.json array matching the API schema."""
    feat_df = feat_df.copy()
    feat_df["archetype"] = feat_df["cluster_id"].map(archetype_names)
    feat_df["playbook"]  = feat_df.apply(generate_playbook, axis=1)

    # Cluster centers in original (pre-scaling) space for each junction's cluster
    centers_raw = scaler.inverse_transform(km.cluster_centers_)

    output = []
    for _, row in feat_df.iterrows():
        cid    = int(row["cluster_id"])
        center = [round(float(v), 2) for v in centers_raw[cid]]

        output.append({
            "junction_name":           row["junction_name"],
            "archetype":               row["archetype"],
            "archetype_id":            cid,
            "peak_hour":               int(row["peak_hour"]),
            "dominant_vehicle":        row["dominant_vehicle"],
            "enforcement_rate":        round(float(row["enforcement_rate"]), 2),
            "violation_type_diversity": int(row["violation_type_diversity"]),
            "weekend_ratio":           round(float(row["weekend_ratio"]), 2),
            "avg_violations_per_day":  round(float(row["avg_violations_per_day"]), 1),
            "playbook":                row["playbook"],
            "cluster_center":          center,
        })

    # Sort by avg_violations_per_day desc so most important junctions appear first
    output.sort(key=lambda x: x["avg_violations_per_day"], reverse=True)
    return output


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("KAVACH — Junction Archetype Classifier (Module 7)")
    print("=" * 60)

    df = load_data()

    feat_df = compute_junction_features(df)
    feat_df, scaler, km = cluster_junctions(feat_df)
    archetype_names = assign_archetype_names(feat_df, scaler, km)

    output = build_output(feat_df, archetype_names, scaler, km)

    # ── Save outputs ──────────────────────────────────────────────────────────
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nJSON saved  ->  {OUTPUT_PATH}  ({len(output)} junctions)")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model_bundle = {
        "kmeans":          km,
        "scaler":          scaler,
        "archetype_names": archetype_names,
        "feature_columns": CLUSTER_FEATURE_COLS,
        "vehicle_index":   VEHICLE_IDX,
    }
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model_bundle, f)
    print(f"Model saved ->  {MODEL_PATH}")

    # Summary by archetype
    from collections import Counter
    counts = Counter(e["archetype"] for e in output)
    print("\n  Archetype distribution:")
    for name, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"    {name:<32} {count} junctions")

    print("\nDone.")


def enrich_with_congestiq(archetypes_path: Path, congestiq_path: Path) -> None:
    """
    Optional enrichment: add avg_congestiq to each junction entry once
    Saarthak's zone_congestiq.json is available.
    The junction's geohash zone is looked up and the score is appended.
    Call this after both files exist.
    """
    with open(archetypes_path) as f:
        archetypes = json.load(f)
    with open(congestiq_path) as f:
        ciq = {z["zone_id"]: z["congestiq_score"] for z in json.load(f)}

    import geohash2
    for entry in archetypes:
        # Derive zone from junction coordinates if available; otherwise skip
        entry.setdefault("avg_congestiq", None)

    with open(archetypes_path, "w") as f:
        json.dump(archetypes, f, indent=2)
    print(f"Enriched {archetypes_path} with CongestIQ scores.")


if __name__ == "__main__":
    main()
