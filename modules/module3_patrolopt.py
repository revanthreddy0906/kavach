"""
KAVACH — Module 3: PatrolOpt Engine
Produces: outputs/patrol_plan.json
Depends on: outputs/zone_congestiq.json
Optional:   outputs/zone_temporal_predictions.json (from Laksh)

Given predicted violation density per zone and N available patrol units,
compute optimal deployment schedule using a greedy priority queue.

Strategy:
  - For each hour block (0-23), rank zones by expected CongestIQ impact
  - Assign units to highest-priority zones using diminishing returns model
  - Estimate predicted reduction % based on enforcement response curves

Usage:
    python modules/module3_patrolopt.py
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
CONGESTIQ_PATH = PROJECT_ROOT / "outputs" / "zone_congestiq.json"
PREDICTIONS_PATH = PROJECT_ROOT / "outputs" / "zone_temporal_predictions.json"
PKL_PATH = PROJECT_ROOT / "Dataset" / "violations_clean.pkl"
OUTPUT_PATH = PROJECT_ROOT / "outputs" / "patrol_plan.json"

# ─── Parameters ───────────────────────────────────────────────
TOTAL_PATROL_UNITS = 30       # total units available across all zones
MAX_UNITS_PER_ZONE = 3        # max units assignable to a single zone
TOP_ZONES_PER_HOUR = 15       # max zones to staff per hour
REDUCTION_PER_UNIT = 0.20     # first unit reduces violations by 20%
DIMINISHING_FACTOR = 0.6      # each additional unit: 60% of previous unit's effect

# Travel time parameters (calibrated against Google Maps routing for Bengaluru)
PEAK_SPEED_KMH = 20.0         # avg speed in peak hours (km/h) — DULT Bengaluru data
OFFPEAK_SPEED_KMH = 30.0      # avg speed in off-peak hours (km/h)
PEAK_HOURS = set(range(7, 11)) | set(range(17, 21))  # 7-10am, 5-8pm
SHIFT_BLOCK_HOURS = 2         # each patrol block is 2 hours
EARTH_RADIUS_KM = 6371.0      # for haversine

# Time multipliers for patrol demand (higher = more units needed)
HOUR_DEMAND_PROFILE = {
    0: 0.2, 1: 0.1, 2: 0.1, 3: 0.1, 4: 0.1, 5: 0.3,
    6: 0.6, 7: 1.0, 8: 1.0, 9: 1.0, 10: 0.7,
    11: 0.6, 12: 0.6, 13: 0.6, 14: 0.6, 15: 0.7,
    16: 0.8, 17: 1.0, 18: 1.0, 19: 1.0, 20: 0.7,
    21: 0.5, 22: 0.3, 23: 0.2,
}


def haversine_km(lat1, lng1, lat2, lng2):
    """Compute great-circle distance between two lat/lng points in km."""
    lat1, lng1, lat2, lng2 = map(np.radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(a))


def estimate_travel_time_min(lat1, lng1, lat2, lng2, hour):
    """Estimate travel time in minutes given hour of day and Bengaluru traffic."""
    dist = haversine_km(lat1, lng1, lat2, lng2)
    # Road distance is ~1.2x haversine in Bengaluru (arterial network)
    road_dist = dist * 1.2
    speed = PEAK_SPEED_KMH if hour in PEAK_HOURS else OFFPEAK_SPEED_KMH
    return round(road_dist / speed * 60, 1), round(road_dist, 1)


def load_data():
    """Load CongestIQ scores, temporal predictions, and raw violations."""
    # CongestIQ (required)
    if not CONGESTIQ_PATH.exists():
        print(f"ERROR: {CONGESTIQ_PATH} not found. Run module2_congestiq.py first.")
        sys.exit(1)
    with open(CONGESTIQ_PATH) as f:
        congestiq = json.load(f)
    print(f"  Loaded CongestIQ for {len(congestiq)} zones")

    # Temporal predictions (optional — from Laksh)
    predictions = None
    if PREDICTIONS_PATH.exists():
        with open(PREDICTIONS_PATH) as f:
            predictions = json.load(f)
        print(f"  Loaded temporal predictions: {len(predictions)} entries")
    else:
        print(f"  WARNING: {PREDICTIONS_PATH} not found. Using historical hourly patterns.")

    # Raw violations for historical patterns
    df = None
    if PKL_PATH.exists():
        df = pd.read_pickle(PKL_PATH)
        print(f"  Loaded {len(df):,} raw violations for hourly patterns")

    return congestiq, predictions, df


def build_hourly_zone_scores(congestiq: list, predictions: list, df: pd.DataFrame) -> dict:
    """
    Build a matrix of expected CongestIQ per zone per hour.
    Uses Laksh's predictions if available, else historical patterns.

    Returns: {hour: [{zone_id, lat, lng, expected_congestiq, predicted_violations, ...}]}
    """
    # Build zone lookup
    zone_map = {z["zone_id"]: z for z in congestiq}

    if predictions:
        return _build_from_predictions(zone_map, predictions)
    elif df is not None:
        return _build_from_historical(zone_map, df)
    else:
        return _build_uniform(zone_map)


def _build_from_predictions(zone_map: dict, predictions: list) -> dict:
    """Use Laksh's LightGBM predictions to weight zones by hour."""
    hourly_scores = {h: [] for h in range(24)}

    # Group predictions by hour
    pred_by_hour = {}
    for p in predictions:
        h = p["hour"]
        if h not in pred_by_hour:
            pred_by_hour[h] = []
        pred_by_hour[h].append(p)

    for hour in range(24):
        hour_preds = pred_by_hour.get(hour, [])
        for p in hour_preds:
            zone_id = p["zone_id"]
            if zone_id not in zone_map:
                continue
            z = zone_map[zone_id]
            predicted_v = p["predicted_violations"]
            # Scale CongestIQ by predicted violation ratio
            base_daily_avg = z["total_violations"] / max(1, z.get("active_days", 180))
            hourly_ratio = predicted_v / max(0.1, base_daily_avg / 24)
            expected_ciq = z["congestiq_score"] * hourly_ratio * HOUR_DEMAND_PROFILE.get(hour, 0.5)

            hourly_scores[hour].append({
                "zone_id": zone_id,
                "zone_lat": z["lat"],
                "zone_lng": z["lng"],
                "expected_congestiq": round(expected_ciq, 1),
                "predicted_violations": round(predicted_v, 1),
                "current_congestiq": z["congestiq_score"],
                "cascade_reach": z["cascade_reach"],
                "severity": z.get("severity", "medium"),
            })

        # Sort by expected CongestIQ descending
        hourly_scores[hour].sort(key=lambda x: x["expected_congestiq"], reverse=True)

    return hourly_scores


def _build_from_historical(zone_map: dict, df: pd.DataFrame) -> dict:
    """Use historical violation patterns when predictions aren't available."""
    hourly_scores = {h: [] for h in range(24)}

    # Compute per-zone, per-hour violation counts
    hourly_counts = df.groupby(["geohash", "hour"]).agg(
        violations=("id", "count"),
        weighted_sum=("vehicle_weight", lambda x: (x * df.loc[x.index, "time_multiplier"]).sum()),
    ).reset_index()

    # Total violations per zone for normalization
    zone_totals = df.groupby("geohash")["id"].count()

    for hour in range(24):
        h_data = hourly_counts[hourly_counts["hour"] == hour]
        for _, row in h_data.iterrows():
            zone_id = row["geohash"]
            if zone_id not in zone_map:
                continue
            z = zone_map[zone_id]

            # Proportion of violations at this hour
            total = zone_totals.get(zone_id, 1)
            hour_ratio = row["violations"] / total

            expected_ciq = z["congestiq_score"] * hour_ratio * 24  # scale to single-hour weight
            expected_ciq *= HOUR_DEMAND_PROFILE.get(hour, 0.5)

            hourly_scores[hour].append({
                "zone_id": zone_id,
                "zone_lat": z["lat"],
                "zone_lng": z["lng"],
                "expected_congestiq": round(expected_ciq, 1),
                "predicted_violations": round(float(row["violations"]) / max(1, df["date"].nunique()), 1),
                "current_congestiq": z["congestiq_score"],
                "cascade_reach": z["cascade_reach"],
                "severity": z.get("severity", "medium"),
            })

        hourly_scores[hour].sort(key=lambda x: x["expected_congestiq"], reverse=True)

    return hourly_scores


def _build_uniform(zone_map: dict) -> dict:
    """Fallback: uniform distribution when no temporal data available."""
    hourly_scores = {h: [] for h in range(24)}
    for hour in range(24):
        demand = HOUR_DEMAND_PROFILE.get(hour, 0.5)
        for zone_id, z in zone_map.items():
            hourly_scores[hour].append({
                "zone_id": zone_id,
                "zone_lat": z["lat"],
                "zone_lng": z["lng"],
                "expected_congestiq": round(z["congestiq_score"] * demand, 1),
                "predicted_violations": round(z["total_violations"] / 180 * demand, 1),
                "current_congestiq": z["congestiq_score"],
                "cascade_reach": z["cascade_reach"],
                "severity": z.get("severity", "medium"),
            })
        hourly_scores[hour].sort(key=lambda x: x["expected_congestiq"], reverse=True)
    return hourly_scores


def compute_reduction_pct(units_assigned: int) -> float:
    """
    Compute expected violation reduction for a given number of patrol units.
    Uses diminishing returns model:
      1 unit  -> 20%
      2 units -> 20% + 12% = 32%
      3 units -> 20% + 12% + 7.2% = 39.2%
    """
    reduction = 0.0
    for i in range(units_assigned):
        unit_effect = REDUCTION_PER_UNIT * (DIMINISHING_FACTOR ** i)
        reduction += unit_effect * (1 - reduction)  # compound on remaining
    return round(reduction * 100, 1)


def greedy_assign_patrols(hourly_scores: dict) -> list:
    """
    Greedy patrol assignment: for each hour, assign units
    to highest-priority zones with diminishing returns.
    """
    print("\n[PATROLOPT] Running greedy patrol assignment ...")
    patrol_plan = []

    for hour in range(24):
        demand_factor = HOUR_DEMAND_PROFILE.get(hour, 0.5)
        available_units = max(1, int(TOTAL_PATROL_UNITS * demand_factor))
        zones = hourly_scores[hour][:TOP_ZONES_PER_HOUR]

        if not zones:
            continue

        # Priority queue: assign units one at a time to highest-impact zone
        assignments = {}  # zone_id -> units
        remaining = available_units

        while remaining > 0 and zones:
            best_zone = None
            best_marginal = -1

            for z in zones:
                zid = z["zone_id"]
                current_units = assignments.get(zid, 0)
                if current_units >= MAX_UNITS_PER_ZONE:
                    continue

                # Marginal reduction from adding one more unit
                current_red = compute_reduction_pct(current_units) / 100
                next_red = compute_reduction_pct(current_units + 1) / 100
                marginal = (next_red - current_red) * z["expected_congestiq"]

                if marginal > best_marginal:
                    best_marginal = marginal
                    best_zone = z

            if best_zone is None:
                break

            zid = best_zone["zone_id"]
            assignments[zid] = assignments.get(zid, 0) + 1
            remaining -= 1

        # Build plan entries for this hour
        hour_entries = []
        for z in zones:
            zid = z["zone_id"]
            units = assignments.get(zid, 0)
            if units == 0:
                continue

            reduction_pct = compute_reduction_pct(units)
            post_ciq = z["current_congestiq"] * (1 - reduction_pct / 100)

            hour_entries.append({
                "hour": hour,
                "zone_id": zid,
                "zone_lat": z["zone_lat"],
                "zone_lng": z["zone_lng"],
                "priority_rank": 0,  # will be set below
                "units_assigned": units,
                "predicted_violations": z["predicted_violations"],
                "expected_congestiq": z["expected_congestiq"],
                "predicted_reduction_pct": reduction_pct,
                "current_congestiq": z["current_congestiq"],
                "post_patrol_congestiq": round(post_ciq, 1),
                "cascade_reach": z["cascade_reach"],
                "severity": z["severity"],
            })

        # Rank by units then by expected CongestIQ
        hour_entries.sort(key=lambda x: (-x["units_assigned"], -x["expected_congestiq"]))
        for rank, entry in enumerate(hour_entries, 1):
            entry["priority_rank"] = rank

        patrol_plan.extend(hour_entries)

    return patrol_plan


def build_unit_itineraries(patrol_plan: list, zone_lookup: dict) -> dict:
    """
    Convert flat patrol plan into per-unit itineraries with travel times.
    Groups assignments by hour blocks and assigns each unit a sequential route.

    Returns:
        {
            "unit_itineraries": [...],
            "fleet_summary": {...}
        }
    """
    print("\n[TRAVEL] Building unit itineraries with travel times ...")

    # Group assignments by hour
    by_hour = {}
    for entry in patrol_plan:
        h = entry["hour"]
        if h not in by_hour:
            by_hour[h] = []
        by_hour[h].append(entry)

    # Create shift blocks: group hours into 2-hour blocks
    # Shifts: 6-8, 8-10, 10-12, 12-14, 14-16, 16-18, 18-20, 20-22
    shift_blocks = []
    for start_hour in range(6, 22, SHIFT_BLOCK_HOURS):
        block_hours = list(range(start_hour, start_hour + SHIFT_BLOCK_HOURS))
        # Collect unique zones assigned in this block
        block_zones = []
        seen_zones = set()
        for h in block_hours:
            for entry in by_hour.get(h, []):
                if entry["zone_id"] not in seen_zones:
                    block_zones.append(entry)
                    seen_zones.add(entry["zone_id"])
        shift_blocks.append({
            "start_hour": start_hour,
            "end_hour": start_hour + SHIFT_BLOCK_HOURS,
            "zones": block_zones,
        })

    # Assign units to shift blocks
    # Each unit works a full day, moving between blocks
    itineraries = []
    total_transit_min = 0
    total_patrol_min = 0
    infeasible_count = 0
    total_distance_km = 0

    for unit_id in range(1, TOTAL_PATROL_UNITS + 1):
        assignments = []
        prev_lat = None
        prev_lng = None
        unit_transit = 0
        unit_distance = 0

        for block in shift_blocks:
            # Pick zone for this unit: prefer nearby zones to minimize transit
            zones = block["zones"]
            if not zones:
                continue

            if prev_lat is not None:
                # Sort zones by distance from current position, then pick by unit rank
                zones_with_dist = []
                for z in zones:
                    d = haversine_km(prev_lat, prev_lng, z["zone_lat"], z["zone_lng"])
                    zones_with_dist.append((d, z))
                zones_with_dist.sort(key=lambda x: x[0])

                # Pick from sorted list by unit index (keeps distribution across zones)
                zone_idx = (unit_id - 1) % len(zones_with_dist)
                entry = zones_with_dist[zone_idx][1]
            else:
                # First assignment — no previous location, use round-robin
                zone_idx = (unit_id - 1) % len(zones)
                entry = zones[zone_idx]

            zid = entry["zone_id"]

            # Get display name
            z_info = zone_lookup.get(zid, {})
            display_name = z_info.get("display_name", zid)

            # Calculate travel time from previous assignment
            travel_min = None
            distance_km = None
            feasible = True

            if prev_lat is not None:
                travel_min, distance_km = estimate_travel_time_min(
                    prev_lat, prev_lng,
                    entry["zone_lat"], entry["zone_lng"],
                    block["start_hour"]
                )
                # Feasible if travel time < shift block duration (2 hours = 120 min)
                # Practically, transit < 45 min is acceptable for Bengaluru
                feasible = bool(travel_min <= 45)
                unit_transit += float(travel_min)
                unit_distance += float(distance_km)
                if not feasible:
                    infeasible_count += 1

            assignments.append({
                "block": f"{block['start_hour']:02d}:00-{block['end_hour']:02d}:00",
                "start_hour": int(block["start_hour"]),
                "zone_id": zid,
                "zone_name": display_name,
                "zone_lat": float(entry["zone_lat"]),
                "zone_lng": float(entry["zone_lng"]),
                "travel_from_prev_min": float(travel_min) if travel_min is not None else None,
                "distance_from_prev_km": float(distance_km) if distance_km is not None else None,
                "feasible": feasible,
                "expected_congestiq": float(entry["expected_congestiq"]),
                "predicted_reduction_pct": float(entry["predicted_reduction_pct"]),
            })

            prev_lat = entry["zone_lat"]
            prev_lng = entry["zone_lng"]

        if not assignments:
            continue

        # Build route description
        route_parts = []
        for a in assignments:
            part = f"{a['zone_name']} {a['block'].split('-')[0]}"
            if a["travel_from_prev_min"] is not None:
                part += f" ({a['distance_from_prev_km']}km, ~{a['travel_from_prev_min']}min)"
            route_parts.append(part)
        route_desc = " -> ".join(route_parts)

        shift_hours = (assignments[-1]["start_hour"] + SHIFT_BLOCK_HOURS - assignments[0]["start_hour"])
        patrol_time = max(0, shift_hours * 60 - unit_transit)

        itineraries.append({
            "unit_id": unit_id,
            "unit_label": f"Unit {unit_id:02d}",
            "shift_start": f"{assignments[0]['start_hour']:02d}:00",
            "shift_end": f"{assignments[-1]['start_hour'] + SHIFT_BLOCK_HOURS:02d}:00",
            "total_assignments": len(assignments),
            "total_transit_min": round(unit_transit, 1),
            "total_distance_km": round(unit_distance, 1),
            "effective_patrol_min": round(patrol_time, 1),
            "route_description": route_desc,
            "assignments": assignments,
        })

        total_transit_min += unit_transit
        total_patrol_min += patrol_time
        total_distance_km += unit_distance

    fleet_summary = {
        "total_units": len(itineraries),
        "avg_transit_min_per_unit": round(total_transit_min / max(1, len(itineraries)), 1),
        "avg_patrol_min_per_unit": round(total_patrol_min / max(1, len(itineraries)), 1),
        "avg_distance_km_per_unit": round(total_distance_km / max(1, len(itineraries)), 1),
        "total_distance_km": round(total_distance_km, 1),
        "infeasible_assignments": infeasible_count,
        "patrol_efficiency_pct": round(total_patrol_min / max(1, total_patrol_min + total_transit_min) * 100, 1),
    }

    print(f"  Built itineraries for {len(itineraries)} units")
    print(f"  Avg transit per unit: {fleet_summary['avg_transit_min_per_unit']} min")
    print(f"  Avg patrol per unit:  {fleet_summary['avg_patrol_min_per_unit']} min")
    print(f"  Infeasible:           {infeasible_count}")
    print(f"  Fleet efficiency:     {fleet_summary['patrol_efficiency_pct']}%")

    return {
        "unit_itineraries": itineraries,
        "fleet_summary": fleet_summary,
    }


def main():
    print("=" * 60)
    print("KAVACH -- Module 3: PatrolOpt Engine")
    print("=" * 60)

    # Load data
    print("\n[STEP 1] Loading data ...")
    congestiq, predictions, df = load_data()

    # Build zone lookup for display names
    zone_lookup = {z["zone_id"]: z for z in congestiq}

    # Build hourly zone scores
    print("\n[STEP 2] Building hourly zone score matrix ...")
    hourly_scores = build_hourly_zone_scores(congestiq, predictions, df)

    # Greedy patrol assignment
    patrol_plan = greedy_assign_patrols(hourly_scores)

    # Build unit itineraries with travel times
    travel_data = build_unit_itineraries(patrol_plan, zone_lookup)

    # Save combined output
    output = {
        "plan": patrol_plan,
        "unit_itineraries": travel_data["unit_itineraries"],
        "fleet_summary": travel_data["fleet_summary"],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n  Saved -> {OUTPUT_PATH}")
    print(f"  Total plan entries: {len(patrol_plan)}")

    # Summary
    plan_df = pd.DataFrame(patrol_plan)
    print(f"\n{'=' * 60}")
    print("PATROL PLAN SUMMARY")
    print(f"  Total patrol units:     {TOTAL_PATROL_UNITS}")
    print(f"  Hours covered:          {plan_df['hour'].nunique()}")
    print(f"  Zones covered:          {plan_df['zone_id'].nunique()}")
    print(f"  Total assignments:      {len(patrol_plan)}")
    print(f"  Total units deployed:   {plan_df['units_assigned'].sum()}")
    print(f"  Avg reduction %:        {plan_df['predicted_reduction_pct'].mean():.1f}%")

    # Travel summary
    fs = travel_data["fleet_summary"]
    print(f"\nTRAVEL & ROUTING")
    print(f"  Fleet efficiency:       {fs['patrol_efficiency_pct']}% (patrol vs transit)")
    print(f"  Avg transit/unit:       {fs['avg_transit_min_per_unit']} min")
    print(f"  Avg distance/unit:      {fs['avg_distance_km_per_unit']} km")
    print(f"  Infeasible transits:    {fs['infeasible_assignments']}")
    print(f"  Total fleet distance:   {fs['total_distance_km']} km")

    # Sample itinerary
    print(f"\nSAMPLE ITINERARY (Unit 01):")
    if travel_data["unit_itineraries"]:
        u1 = travel_data["unit_itineraries"][0]
        print(f"  Shift: {u1['shift_start']} - {u1['shift_end']}")
        print(f"  Route: {u1['route_description']}")
        print(f"  Transit: {u1['total_transit_min']} min | Distance: {u1['total_distance_km']} km")

    print(f"\n  Peak hours (most units):")
    hourly_units = plan_df.groupby("hour")["units_assigned"].sum().sort_values(ascending=False)
    for hour, units in hourly_units.head(5).items():
        zones_at_hour = plan_df[plan_df["hour"] == hour]["zone_id"].nunique()
        print(f"    Hour {hour:02d}:00  ->  {units} units across {zones_at_hour} zones")
    print(f"\n  Top 5 priority zones (most total units across day):")
    zone_total = plan_df.groupby("zone_id")["units_assigned"].sum().sort_values(ascending=False)
    for zone_id, total_units in zone_total.head(5).items():
        hours_active = plan_df[plan_df["zone_id"] == zone_id]["hour"].tolist()
        name = zone_lookup.get(zone_id, {}).get("display_name", zone_id)
        print(f"    {name} ({zone_id})  ->  {total_units} total units, hours: {hours_active}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
