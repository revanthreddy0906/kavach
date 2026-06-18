"""
KAVACH — Predicted Score Enrichment
Replaces the heuristic predicted_score_6h in zone_congestiq.json with ML-derived
values from zone_temporal_predictions.json.

Formula:
    ciq_per_violation = zone's congestiq_score / zone's total_violations
    predicted_score_6h = sum(predicted_violations for next 6 hours) x ciq_per_violation

Run: python modules/enrich_predicted_scores.py [--hour H]
     --hour H : reference hour (0-23). Defaults to current system hour.
"""

import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

ROOT          = Path(__file__).resolve().parent.parent
CONGESTIQ_PATH = ROOT / "outputs" / "zone_congestiq.json"
TEMPORAL_PATH  = ROOT / "outputs" / "zone_temporal_predictions.json"

sys.stdout.reconfigure(encoding="utf-8")


def load_files():
    for path in (CONGESTIQ_PATH, TEMPORAL_PATH):
        if not path.exists():
            print(f"ERROR: {path} not found.")
            sys.exit(1)

    with open(CONGESTIQ_PATH) as f:
        congestiq = json.load(f)
    with open(TEMPORAL_PATH) as f:
        temporal = json.load(f)

    print(f"Loaded {len(congestiq)} zones from zone_congestiq.json")
    print(f"Loaded {len(temporal)} predictions from zone_temporal_predictions.json")
    return congestiq, temporal


def build_prediction_lookup(temporal: list) -> dict:
    """Index predictions as {zone_id: {hour: predicted_violations}}."""
    lookup = {}
    for entry in temporal:
        zone = entry["zone_id"]
        hour = entry["hour"]
        pred = entry["predicted_violations"]
        lookup.setdefault(zone, {})[hour] = pred
    return lookup


def compute_predicted_score_6h(
    zone_entry: dict,
    pred_lookup: dict,
    ref_hour: int,
) -> float:
    """
    Sum predicted violations over the next 6 hours, scale by the zone's
    historical CongestIQ-per-violation rate to get a predicted CongestIQ score.
    """
    zone_id           = zone_entry["zone_id"]
    total_violations  = zone_entry.get("total_violations", 0)
    congestiq_score   = zone_entry.get("congestiq_score", 0.0)

    if total_violations <= 0 or congestiq_score <= 0:
        return 0.0

    ciq_per_violation = congestiq_score / total_violations

    zone_preds = pred_lookup.get(zone_id, {})
    predicted_6h = sum(
        zone_preds.get((ref_hour + offset) % 24, 0.0)
        for offset in range(6)
    )

    return round(predicted_6h * ciq_per_violation, 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--hour", type=int, default=datetime.now().hour,
        help="Reference hour for the 6h window (0-23). Defaults to current hour."
    )
    args = parser.parse_args()
    ref_hour = args.hour % 24

    print(f"Reference hour: {ref_hour}:00  (predicting {ref_hour}:00 - {(ref_hour+6)%24}:00)")

    congestiq, temporal = load_files()
    pred_lookup = build_prediction_lookup(temporal)

    updated = 0
    for zone in congestiq:
        new_score = compute_predicted_score_6h(zone, pred_lookup, ref_hour)
        if zone.get("predicted_score_6h") != new_score:
            zone["predicted_score_6h"] = new_score
            updated += 1

    with open(CONGESTIQ_PATH, "w") as f:
        json.dump(congestiq, f, indent=2)

    print(f"Updated {updated} zones in zone_congestiq.json")
    print(f"Output saved -> {CONGESTIQ_PATH}")
    print("Done.")


if __name__ == "__main__":
    main()
