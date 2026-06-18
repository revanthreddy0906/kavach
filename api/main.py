"""
KAVACH — FastAPI Backend
Parking Congestion Cascade Intelligence Platform

All endpoints read from pre-computed JSON files in outputs/.
If a JSON file doesn't exist yet, returns mock data so the dashboard is never broken.

Run with: python -m uvicorn api.main:app --reload --port 8000
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

app = FastAPI(title="KAVACH API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"


def load_json_or_mock(filename: str, mock_data):
    """Load from outputs/ if available, otherwise return mock data."""
    filepath = OUTPUTS_DIR / filename
    if filepath.exists():
        with open(filepath) as f:
            return json.load(f)
    return mock_data


# ═══════════════════════════════════════════════════════════
# MOCK DATA
# ═══════════════════════════════════════════════════════════

MOCK_HEATMAP = [
    {"zone_id": "tdr3ub", "lat": 12.9255, "lng": 77.6186, "congestiq_score": 847.3,
     "cascade_reach": 23, "primary_violation": "WRONG PARKING", "dominant_vehicle": "CAR",
     "predicted_score_6h": 1240.5},
    {"zone_id": "tdr3u9", "lat": 12.9716, "lng": 77.5946, "congestiq_score": 623.1,
     "cascade_reach": 15, "primary_violation": "NO PARKING", "dominant_vehicle": "SCOOTER",
     "predicted_score_6h": 890.2},
    {"zone_id": "tdr3vp", "lat": 12.9352, "lng": 77.6245, "congestiq_score": 912.7,
     "cascade_reach": 31, "primary_violation": "WRONG PARKING", "dominant_vehicle": "AUTO",
     "predicted_score_6h": 1350.8},
    {"zone_id": "tdr3un", "lat": 12.9785, "lng": 77.5712, "congestiq_score": 234.5,
     "cascade_reach": 5, "primary_violation": "SIGNAL JUMP", "dominant_vehicle": "TWO WHEELER",
     "predicted_score_6h": 310.2},
    {"zone_id": "tdr3uc", "lat": 12.9610, "lng": 77.6050, "congestiq_score": 756.2,
     "cascade_reach": 19, "primary_violation": "WRONG PARKING", "dominant_vehicle": "CAR",
     "predicted_score_6h": 1020.4},
    {"zone_id": "tdr3vh", "lat": 12.9448, "lng": 77.6312, "congestiq_score": 445.8,
     "cascade_reach": 10, "primary_violation": "NO PARKING", "dominant_vehicle": "LORRY",
     "predicted_score_6h": 580.1},
    {"zone_id": "tdr3ue", "lat": 12.9523, "lng": 77.5834, "congestiq_score": 189.3,
     "cascade_reach": 3, "primary_violation": "OVER SPEED", "dominant_vehicle": "CAR",
     "predicted_score_6h": 245.7},
    {"zone_id": "tdr3v5", "lat": 12.9891, "lng": 77.6103, "congestiq_score": 567.4,
     "cascade_reach": 14, "primary_violation": "WRONG PARKING", "dominant_vehicle": "SCOOTER",
     "predicted_score_6h": 780.6},
    {"zone_id": "tdr3uk", "lat": 12.9178, "lng": 77.5689, "congestiq_score": 723.1,
     "cascade_reach": 18, "primary_violation": "NO PARKING", "dominant_vehicle": "AUTO",
     "predicted_score_6h": 950.3},
    {"zone_id": "tdr3vr", "lat": 12.9034, "lng": 77.6421, "congestiq_score": 891.6,
     "cascade_reach": 27, "primary_violation": "WRONG PARKING", "dominant_vehicle": "CAR",
     "predicted_score_6h": 1280.9},
    {"zone_id": "tdr3us", "lat": 12.9667, "lng": 77.5523, "congestiq_score": 312.7,
     "cascade_reach": 7, "primary_violation": "SIGNAL JUMP", "dominant_vehicle": "TWO WHEELER",
     "predicted_score_6h": 420.3},
    {"zone_id": "tdr3vm", "lat": 12.9945, "lng": 77.5876, "congestiq_score": 478.9,
     "cascade_reach": 11, "primary_violation": "NO PARKING", "dominant_vehicle": "SCOOTER",
     "predicted_score_6h": 610.5},
    {"zone_id": "tdr3uf", "lat": 13.0012, "lng": 77.6198, "congestiq_score": 654.3,
     "cascade_reach": 16, "primary_violation": "WRONG PARKING", "dominant_vehicle": "LORRY",
     "predicted_score_6h": 870.1},
    {"zone_id": "tdr3v2", "lat": 12.9123, "lng": 77.5567, "congestiq_score": 398.2,
     "cascade_reach": 9, "primary_violation": "OVER SPEED", "dominant_vehicle": "CAR",
     "predicted_score_6h": 530.8},
    {"zone_id": "tdr3vt", "lat": 13.0234, "lng": 77.6345, "congestiq_score": 145.6,
     "cascade_reach": 2, "primary_violation": "NO PARKING", "dominant_vehicle": "TWO WHEELER",
     "predicted_score_6h": 198.4},
    {"zone_id": "tdr3uw", "lat": 12.9489, "lng": 77.6478, "congestiq_score": 534.1,
     "cascade_reach": 13, "primary_violation": "WRONG PARKING", "dominant_vehicle": "AUTO",
     "predicted_score_6h": 720.6},
    {"zone_id": "tdr3v8", "lat": 13.0156, "lng": 77.5734, "congestiq_score": 267.8,
     "cascade_reach": 6, "primary_violation": "SIGNAL JUMP", "dominant_vehicle": "SCOOTER",
     "predicted_score_6h": 355.2},
    {"zone_id": "tdr3ug", "lat": 12.9312, "lng": 77.5912, "congestiq_score": 812.4,
     "cascade_reach": 22, "primary_violation": "WRONG PARKING", "dominant_vehicle": "CAR",
     "predicted_score_6h": 1150.7},
    {"zone_id": "tdr3ve", "lat": 13.0378, "lng": 77.6089, "congestiq_score": 156.9,
     "cascade_reach": 4, "primary_violation": "NO PARKING", "dominant_vehicle": "TWO WHEELER",
     "predicted_score_6h": 210.3},
    {"zone_id": "tdr3ut", "lat": 12.9567, "lng": 77.6534, "congestiq_score": 689.5,
     "cascade_reach": 17, "primary_violation": "WRONG PARKING", "dominant_vehicle": "LORRY",
     "predicted_score_6h": 920.8},
]


def _generate_cascade_nodes(center_lat: float, center_lng: float, count: int, radius: float):
    """Generate mock cascade nodes around a center point."""
    import random
    random.seed(int(center_lat * 10000) + int(center_lng * 10000) + count)
    nodes = []
    for _ in range(count):
        lat = center_lat + random.uniform(-radius, radius)
        lng = center_lng + random.uniform(-radius, radius)
        nodes.append([round(lat, 4), round(lng, 4)])
    return nodes


MOCK_CASCADE = {}
for zone in MOCK_HEATMAP:
    zid = zone["zone_id"]
    clat, clng = zone["lat"], zone["lng"]
    MOCK_CASCADE[zid] = {
        "zone_id": zid,
        "center_lat": clat,
        "center_lng": clng,
        "trigger_time": "08:15",
        "frames": [
            {"minutes": 15, "affected_nodes": max(3, zone["cascade_reach"] // 3),
             "nodes": _generate_cascade_nodes(clat, clng, max(3, zone["cascade_reach"] // 3), 0.005)},
            {"minutes": 30, "affected_nodes": max(6, zone["cascade_reach"] * 2 // 3),
             "nodes": _generate_cascade_nodes(clat, clng, max(6, zone["cascade_reach"] * 2 // 3), 0.012)},
            {"minutes": 60, "affected_nodes": zone["cascade_reach"] * 3,
             "nodes": _generate_cascade_nodes(clat, clng, zone["cascade_reach"] * 3, 0.025)},
        ]
    }

# Top 10 zones by congestiq_score for patrol plans
_top_zones = sorted(MOCK_HEATMAP, key=lambda z: z["congestiq_score"], reverse=True)[:10]

MOCK_PATROL_PLAN = []
for hour in range(24):
    for rank, zone in enumerate(_top_zones, start=1):
        # More units during peak hours (7-10, 17-20)
        is_peak = hour in range(7, 11) or hour in range(17, 21)
        units = 3 if (is_peak and rank <= 3) else 2 if (is_peak or rank <= 5) else 1
        base_violations = zone["congestiq_score"] / 50
        # Scale violations by time of day
        time_factor = 1.5 if is_peak else 0.6 if hour in range(0, 6) else 1.0
        predicted = round(base_violations * time_factor, 1)
        reduction = round(25 + (units * 8) + (rank * -0.5), 1)
        current_ciq = zone["congestiq_score"]
        post_ciq = round(current_ciq * (1 - reduction / 100), 1)

        MOCK_PATROL_PLAN.append({
            "hour": hour,
            "zone_id": zone["zone_id"],
            "zone_lat": zone["lat"],
            "zone_lng": zone["lng"],
            "priority_rank": rank,
            "units_assigned": units,
            "predicted_violations": predicted,
            "predicted_reduction_pct": reduction,
            "current_congestiq": current_ciq,
            "post_patrol_congestiq": post_ciq,
        })

MOCK_ENFORCEMENT = [
    {"police_station": "Upparpet", "total_violations": 34468, "enforcement_rate": 0.4112,
     "approval_rate": 0.6534, "anomaly_score": -0.2847, "is_anomaly": True, "rank": 1},
    {"police_station": "Cottonpet", "total_violations": 28934, "enforcement_rate": 0.4523,
     "approval_rate": 0.7012, "anomaly_score": -0.2134, "is_anomaly": True, "rank": 2},
    {"police_station": "Kengeri", "total_violations": 12456, "enforcement_rate": 0.5234,
     "approval_rate": 0.5678, "anomaly_score": -0.1856, "is_anomaly": True, "rank": 3},
    {"police_station": "Jnanabharathi", "total_violations": 8923, "enforcement_rate": 0.5812,
     "approval_rate": 0.6234, "anomaly_score": -0.1423, "is_anomaly": True, "rank": 4},
    {"police_station": "VV Puram", "total_violations": 31245, "enforcement_rate": 0.7312,
     "approval_rate": 0.8234, "anomaly_score": 0.0234, "is_anomaly": False, "rank": 5},
    {"police_station": "Hanumanthanagar", "total_violations": 22567, "enforcement_rate": 0.7523,
     "approval_rate": 0.8456, "anomaly_score": 0.0512, "is_anomaly": False, "rank": 6},
    {"police_station": "Girinagar", "total_violations": 18934, "enforcement_rate": 0.7645,
     "approval_rate": 0.8012, "anomaly_score": 0.0678, "is_anomaly": False, "rank": 7},
    {"police_station": "Vijayanagar", "total_violations": 25678, "enforcement_rate": 0.7823,
     "approval_rate": 0.8567, "anomaly_score": 0.0845, "is_anomaly": False, "rank": 8},
    {"police_station": "Basavanagudi", "total_violations": 19345, "enforcement_rate": 0.7912,
     "approval_rate": 0.8734, "anomaly_score": 0.0923, "is_anomaly": False, "rank": 9},
    {"police_station": "Jayanagar", "total_violations": 27834, "enforcement_rate": 0.8123,
     "approval_rate": 0.8912, "anomaly_score": 0.1234, "is_anomaly": False, "rank": 10},
    {"police_station": "JP Nagar", "total_violations": 15678, "enforcement_rate": 0.8234,
     "approval_rate": 0.9012, "anomaly_score": 0.1456, "is_anomaly": False, "rank": 11},
    {"police_station": "Koramangala", "total_violations": 32156, "enforcement_rate": 0.8345,
     "approval_rate": 0.8856, "anomaly_score": 0.1567, "is_anomaly": False, "rank": 12},
    {"police_station": "HSR Layout", "total_violations": 21345, "enforcement_rate": 0.8512,
     "approval_rate": 0.9123, "anomaly_score": 0.1723, "is_anomaly": False, "rank": 13},
    {"police_station": "Whitefield", "total_violations": 17234, "enforcement_rate": 0.8678,
     "approval_rate": 0.9234, "anomaly_score": 0.1934, "is_anomaly": False, "rank": 14},
    {"police_station": "Indiranagar", "total_violations": 29456, "enforcement_rate": 0.8823,
     "approval_rate": 0.9345, "anomaly_score": 0.2123, "is_anomaly": False, "rank": 15},
]

MOCK_COUNTERFACTUAL = {
    "scenarios": [
        {
            "scenario": "enforcement_rate_90pct",
            "target_enforcement_rate": 0.90,
            "baseline_congestiq": 7802207,
            "simulated_congestiq": 7260788,
            "reduction_pct": 6.9,
            "violation_reduction": 0,
            "zones_affected": 306,
            "hours_saved_monthly": 34635,
            "flipkart": {
                "delivery_hours_saved_monthly": 10912,
                "monthly_cost_savings_inr": 1964160,
                "annual_cost_savings_inr": 23569920,
                "annual_cost_savings_crore": 2.36,
                "monthly_sla_rescues": 18187,
                "deliveries_improved_daily": 840
            },
            "top_zones_impacted": []
        }
    ],
    "flipkart_corridors": [],
    "pitch_numbers": {}
}

MOCK_ARCHETYPES = [
    {"junction_name": "BTP051 - Safina Plaza Junction", "archetype": "Commercial Morning Rush",
     "archetype_id": 2, "peak_hour": 9, "dominant_vehicle": "CAR", "enforcement_rate": 0.71,
     "violation_type_diversity": 3, "weekend_ratio": 0.35, "avg_violations_per_day": 45.2,
     "playbook": "Deploy 2 units at 7:30am, prioritize CAR enforcement, clear by 10am",
     "cluster_center": [9.0, 2.0, 0.71, 3.2, 0.35, 45.2]},
    {"junction_name": "BTP023 - Majestic Bus Stand", "archetype": "Transit Hub Chaos",
     "archetype_id": 1, "peak_hour": 8, "dominant_vehicle": "AUTO", "enforcement_rate": 0.45,
     "violation_type_diversity": 5, "weekend_ratio": 0.82, "avg_violations_per_day": 78.4,
     "playbook": "Deploy 3 units at 7:00am, focus AUTO + BUS violations, maintain till 11am",
     "cluster_center": [8.0, 1.0, 0.45, 5.0, 0.82, 78.4]},
    {"junction_name": "BTP078 - Silk Board Junction", "archetype": "IT Corridor Bottleneck",
     "archetype_id": 3, "peak_hour": 18, "dominant_vehicle": "CAR", "enforcement_rate": 0.62,
     "violation_type_diversity": 2, "weekend_ratio": 0.18, "avg_violations_per_day": 62.8,
     "playbook": "Deploy 2 units at 5:00pm, focus WRONG PARKING, clear by 8pm",
     "cluster_center": [18.0, 3.0, 0.62, 2.0, 0.18, 62.8]},
    {"junction_name": "BTP015 - KR Market", "archetype": "Market Zone Persistent",
     "archetype_id": 4, "peak_hour": 10, "dominant_vehicle": "LORRY", "enforcement_rate": 0.38,
     "violation_type_diversity": 4, "weekend_ratio": 0.91, "avg_violations_per_day": 89.1,
     "playbook": "Deploy 3 units at 6:00am, restrict LORRY entry after 8am, continuous patrol",
     "cluster_center": [10.0, 4.0, 0.38, 4.0, 0.91, 89.1]},
    {"junction_name": "BTP034 - MG Road", "archetype": "Commercial Morning Rush",
     "archetype_id": 2, "peak_hour": 9, "dominant_vehicle": "CAR", "enforcement_rate": 0.74,
     "violation_type_diversity": 3, "weekend_ratio": 0.42, "avg_violations_per_day": 38.6,
     "playbook": "Deploy 2 units at 8:00am, prioritize NO PARKING enforcement, clear by 11am",
     "cluster_center": [9.0, 2.0, 0.74, 3.0, 0.42, 38.6]},
    {"junction_name": "BTP045 - Jayanagar 4th Block", "archetype": "Residential Evening Surge",
     "archetype_id": 5, "peak_hour": 19, "dominant_vehicle": "TWO WHEELER", "enforcement_rate": 0.81,
     "violation_type_diversity": 2, "weekend_ratio": 0.55, "avg_violations_per_day": 25.3,
     "playbook": "Deploy 1 unit at 5:30pm, focus TWO WHEELER violations near schools, clear by 8pm",
     "cluster_center": [19.0, 5.0, 0.81, 2.0, 0.55, 25.3]},
    {"junction_name": "BTP067 - Hebbal Flyover", "archetype": "IT Corridor Bottleneck",
     "archetype_id": 3, "peak_hour": 17, "dominant_vehicle": "CAR", "enforcement_rate": 0.58,
     "violation_type_diversity": 2, "weekend_ratio": 0.22, "avg_violations_per_day": 55.7,
     "playbook": "Deploy 2 units at 4:30pm, focus WRONG PARKING + SIGNAL JUMP, clear by 8pm",
     "cluster_center": [17.0, 3.0, 0.58, 2.0, 0.22, 55.7]},
    {"junction_name": "BTP012 - Town Hall", "archetype": "Transit Hub Chaos",
     "archetype_id": 1, "peak_hour": 8, "dominant_vehicle": "AUTO", "enforcement_rate": 0.52,
     "violation_type_diversity": 4, "weekend_ratio": 0.75, "avg_violations_per_day": 67.2,
     "playbook": "Deploy 2 units at 7:00am, focus AUTO enforcement, coordinate with traffic signals",
     "cluster_center": [8.0, 1.0, 0.52, 4.0, 0.75, 67.2]},
    {"junction_name": "BTP089 - Marathahalli Bridge", "archetype": "IT Corridor Bottleneck",
     "archetype_id": 3, "peak_hour": 18, "dominant_vehicle": "CAR", "enforcement_rate": 0.55,
     "violation_type_diversity": 3, "weekend_ratio": 0.20, "avg_violations_per_day": 71.4,
     "playbook": "Deploy 3 units at 5:00pm, focus WRONG PARKING, coordinate with Silk Board",
     "cluster_center": [18.0, 3.0, 0.55, 3.0, 0.20, 71.4]},
    {"junction_name": "BTP056 - Banashankari Circle", "archetype": "Residential Evening Surge",
     "archetype_id": 5, "peak_hour": 18, "dominant_vehicle": "TWO WHEELER", "enforcement_rate": 0.76,
     "violation_type_diversity": 2, "weekend_ratio": 0.48, "avg_violations_per_day": 31.5,
     "playbook": "Deploy 1 unit at 5:00pm, focus TWO WHEELER + SCOOTER violations, clear by 8pm",
     "cluster_center": [18.0, 5.0, 0.76, 2.0, 0.48, 31.5]},
]


# ═══════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@app.get("/api/heatmap")
def heatmap():
    """Returns all zones with their CongestIQ scores for heatmap overlay.

    Source: outputs/zone_congestiq.json
    """
    return load_json_or_mock("zone_congestiq.json", MOCK_HEATMAP)


@app.get("/api/cascade/{zone_id}")
def cascade(zone_id: str):
    """Returns cascade animation frames for a specific zone.

    Source: outputs/cascade_data.json — dict keyed by zone_id.
    zone_id is a geohash6 string like 'tdr3ub', NOT an integer.
    """
    data = load_json_or_mock("cascade_data.json", MOCK_CASCADE)

    # cascade_data.json is a dict keyed by zone_id
    if isinstance(data, dict):
        if zone_id in data:
            return data[zone_id]
        return {"error": f"Zone {zone_id} not found", "available_zones": list(data.keys())}

    # If it's a list, search by zone_id
    for entry in data:
        if entry.get("zone_id") == zone_id:
            return entry
    return {"error": f"Zone {zone_id} not found"}


@app.get("/api/patrol-plan")
def patrol_plan(hour: Optional[int] = Query(None, ge=0, le=23)):
    """Returns patrol deployment plan for a given hour (0-23).

    Source: outputs/patrol_plan.json
    Query params: hour (int, 0-23). If no hour param, return all 24 hours.
    """
    data = load_json_or_mock("patrol_plan.json", MOCK_PATROL_PLAN)

    # Handle new nested format: {plan: [...], unit_itineraries: [...], fleet_summary: {...}}
    plan_entries = data.get("plan", data) if isinstance(data, dict) else data

    if hour is not None:
        return [entry for entry in plan_entries if entry.get("hour") == hour]
    return plan_entries


@app.get("/api/patrol-itineraries")
def patrol_itineraries():
    """Returns per-unit patrol itineraries with travel times and fleet summary.

    Source: outputs/patrol_plan.json (unit_itineraries + fleet_summary sections)
    """
    data = load_json_or_mock("patrol_plan.json", MOCK_PATROL_PLAN)

    if isinstance(data, dict) and "unit_itineraries" in data:
        return {
            "unit_itineraries": data["unit_itineraries"],
            "fleet_summary": data.get("fleet_summary", {}),
        }
    return {"unit_itineraries": [], "fleet_summary": {}}


@app.get("/api/weather-sensitivity")
def weather_sensitivity():
    """Returns weather-violation correlation analysis.

    Source: outputs/weather_sensitivity.json (produced by module_weather.py)
    """
    data = load_json_or_mock("weather_sensitivity.json", {
        "city_summary": {}, "zones": [], "hourly_shift": [], "vehicle_impact": []
    })
    return data


@app.get("/api/enforcement")
def enforcement():
    """Returns per-station enforcement anomaly analysis.

    Source: outputs/enforcement_anomalies.json (produced by Module 4).
    """
    return load_json_or_mock("enforcement_anomalies.json", MOCK_ENFORCEMENT)


@app.get("/api/counterfactual")
def counterfactual(enforcement_rate: Optional[float] = Query(None, ge=0.5, le=1.0)):
    data = load_json_or_mock("counterfactual.json", MOCK_COUNTERFACTUAL)

    # Handle new nested format
    if isinstance(data, dict) and "scenarios" in data:
        scenarios = data["scenarios"]
        flipkart_corridors = data.get("flipkart_corridors", [])
        pitch_numbers = data.get("pitch_numbers", {})
    else:
        scenarios = data if isinstance(data, list) else []
        flipkart_corridors = []
        pitch_numbers = {}

    # If no rate specified, return ALL scenarios + extras for slider
    if enforcement_rate is None:
        return {
            "scenarios": scenarios,
            "flipkart_corridors": flipkart_corridors,
            "pitch_numbers": pitch_numbers
        }

    # Find closest matching scenario
    def _get_rate(s):
        rate = s.get("target_enforcement_rate", s.get("enforcement_rate"))
        if isinstance(rate, (int, float)):
            return abs(rate - enforcement_rate)
        return abs(_parse_rate_from_scenario(s.get("scenario", "")) - enforcement_rate)

    closest = min(scenarios, key=_get_rate)

    return {
        "scenario": closest,
        "flipkart_corridors": flipkart_corridors,
        "pitch_numbers": pitch_numbers
    }


def _parse_rate_from_scenario(scenario_name: str) -> float:
    """Extract enforcement rate from scenario name like 'enforcement_rate_80pct'."""
    try:
        pct_str = scenario_name.replace("enforcement_rate_", "").replace("pct", "")
        return int(pct_str) / 100.0
    except (ValueError, AttributeError):
        return 0.0


@app.get("/api/archetypes")
def archetypes():
    """Returns junction archetype classifications.

    Source: outputs/junction_archetypes.json (Laksh produces).
    """
    return load_json_or_mock("junction_archetypes.json", MOCK_ARCHETYPES)


@app.get("/api/daily-briefing")
def daily_briefing():
    """Generates Commissioner's Daily Briefing from all module outputs.

    Synthesizes zone_congestiq, patrol_plan, enforcement_anomalies,
    weather_sensitivity, spillover_data, and counterfactual into a
    structured natural language report.
    """
    from datetime import date

    # Load all data
    zones = load_json_or_mock("zone_congestiq.json", [])
    patrol_raw = load_json_or_mock("patrol_plan.json", {})
    enforcement = load_json_or_mock("enforcement_anomalies.json", [])
    weather = load_json_or_mock("weather_sensitivity.json", {})
    spillover = load_json_or_mock("spillover_data.json", {})
    counterfactual = load_json_or_mock("counterfactual.json", {})

    # Sort zones by CongestIQ
    zones_sorted = sorted(zones, key=lambda z: z.get("congestiq_score", 0), reverse=True)

    # ── Priority Zones ──
    top_zones = zones_sorted[:5]
    priority_alerts = []
    for z in top_zones:
        name = z.get("display_name", z.get("zone_id", "Unknown"))
        ciq = z.get("congestiq_score", 0)
        peak = z.get("peak_hour", 0)
        vpd = z.get("violations_per_day", 0)
        primary = z.get("primary_violation", "PARKING")
        severity = z.get("severity", "high")

        priority_alerts.append({
            "zone_id": z.get("zone_id"),
            "zone_name": name,
            "congestiq": round(ciq),
            "severity": severity,
            "peak_hour": peak,
            "violations_per_day": round(vpd, 1),
            "primary_violation": primary,
            "text": (
                f"{name} is a {severity}-priority zone with a CongestIQ of "
                f"{ciq:,.0f}, averaging {vpd:.1f} violations per day. "
                f"Peak activity at {peak:02d}:00. Primary offence: {primary}."
            ),
        })

    # ── Patrol Deployment ──
    plan = patrol_raw.get("plan", patrol_raw) if isinstance(patrol_raw, dict) else patrol_raw
    fleet = patrol_raw.get("fleet_summary", {}) if isinstance(patrol_raw, dict) else {}

    total_units = fleet.get("total_units", 30)
    efficiency = fleet.get("patrol_efficiency_pct", 0)
    zones_covered = len(set(e.get("zone_id") for e in plan)) if isinstance(plan, list) else 0
    avg_reduction = 0
    if isinstance(plan, list) and plan:
        reductions = [e.get("predicted_reduction_pct", 0) for e in plan if e.get("predicted_reduction_pct")]
        avg_reduction = sum(reductions) / len(reductions) if reductions else 0

    # Top zone for the next shift block (6-8am)
    morning_entries = [e for e in plan if isinstance(e, dict) and e.get("hour") in [6, 7]] if isinstance(plan, list) else []
    morning_entries.sort(key=lambda e: e.get("units_assigned", 0), reverse=True)

    patrol_summary = {
        "total_units": total_units,
        "zones_covered": zones_covered,
        "avg_reduction_pct": round(avg_reduction, 1),
        "fleet_efficiency_pct": round(efficiency, 1),
        "morning_priority": morning_entries[0].get("zone_id") if morning_entries else None,
        "morning_units": morning_entries[0].get("units_assigned", 0) if morning_entries else 0,
        "text": (
            f"Patrol deployment: {total_units} units across {zones_covered} zones, "
            f"achieving an estimated {avg_reduction:.1f}% average congestion reduction. "
            f"Fleet efficiency: {efficiency:.1f}% (patrol vs transit time)."
        ),
    }

    # ── Enforcement Gaps ──
    # Filter out "No Police Station" — it's a data gap, not a real station
    anomalies = [
        s for s in enforcement
        if s.get("is_anomaly")
        and "no police" not in s.get("police_station", "").lower()
        and s.get("police_station", "").strip() != ""
    ]
    enforcement_gaps = []
    city_avg_rate = 0
    if enforcement:
        rates = [s.get("enforcement_rate", 0) for s in enforcement]
        city_avg_rate = sum(rates) / len(rates) if rates else 0

    for s in sorted(anomalies, key=lambda x: x.get("enforcement_rate", 1))[:3]:
        station = s.get("police_station", "Unknown")
        rate = s.get("enforcement_rate", 0)
        gap_pp = round((city_avg_rate - rate) * 100, 1)
        total = s.get("total_violations", 0)

        # Get top SHAP reason
        reasons = s.get("anomaly_reasons", [])
        top_reason = reasons[0].get("detail", "") if reasons else ""

        enforcement_gaps.append({
            "station": station,
            "enforcement_rate": round(rate * 100, 1),
            "gap_pp": gap_pp,
            "total_violations": total,
            "top_reason": top_reason,
            "text": (
                f"{station} enforcement rate is {rate*100:.1f}% — "
                f"{gap_pp:.0f} percentage points below the city average of {city_avg_rate*100:.1f}%. "
                f"Flagged for review. {top_reason}"
            ),
        })

    # ── Weather Alerts ──
    weather_zones = weather.get("zones", [])
    weather_surges = [z for z in weather_zones if z.get("sensitivity") == "high_increase"][:3]
    weather_alerts = []
    for z in weather_surges:
        weather_alerts.append({
            "zone_name": z.get("zone_name"),
            "pct_change": z.get("pct_change"),
            "rain_vpd": z.get("rain_vpd"),
            "dry_vpd": z.get("dry_vpd"),
            "text": (
                f"Historical data shows {z.get('zone_name')} violations surge "
                f"{z.get('pct_change')}% on rainy days ({z.get('rain_vpd')}/day vs "
                f"{z.get('dry_vpd')}/day on dry days). "
                f"{z.get('recommendation', 'Pre-position extra patrol during rainfall.')}"
            ),
        })

    # ── Spillover & Network ──
    spillover_total = spillover.get("total_spillover_events", 0)
    spreader_zones = spillover.get("unique_primary_zones", 0)

    # ── Economic Impact (from counterfactual) ──
    pitch = counterfactual.get("pitch_numbers", {}).get("at_90pct_enforcement", {})
    annual_savings = pitch.get("annual_savings_crore", 0)
    delivery_hours = pitch.get("delivery_hours_monthly", 0)
    sla_rescues = pitch.get("monthly_sla_rescues", 0)

    # ── Cost per violation estimate ──
    # Defensible: avg 45 vehicles affected (arterial, peak hour)
    # Value of time: ₹175/hour (NITI Aayog), avg delay 8.4 min
    cost_per_violation = round(45 * (8.4 / 60) * 175)

    # ── Build full briefing text ──
    today = date.today().strftime("%B %d, %Y")
    briefing_lines = [
        f"KAVACH Daily Intelligence Briefing — {today}",
        "",
        "━━━━ PRIORITY ZONES ━━━━",
    ]
    for pa in priority_alerts[:3]:
        briefing_lines.append(f"▸ {pa['text']}")
    briefing_lines.append("")

    briefing_lines.append("━━━━ PATROL DEPLOYMENT ━━━━")
    briefing_lines.append(f"▸ {patrol_summary['text']}")
    if morning_entries:
        me = morning_entries[0]
        zone_name = next((z.get("display_name", me["zone_id"]) for z in zones if z.get("zone_id") == me.get("zone_id")), me.get("zone_id"))
        briefing_lines.append(
            f"▸ Morning priority (06:00-08:00): {zone_name} — {me.get('units_assigned', 0)} units recommended."
        )
    briefing_lines.append("")

    if enforcement_gaps:
        briefing_lines.append("━━━━ ENFORCEMENT GAPS ━━━━")
        for eg in enforcement_gaps:
            briefing_lines.append(f"▸ {eg['text']}")
        briefing_lines.append("")

    if weather_alerts:
        briefing_lines.append("━━━━ WEATHER SENSITIVITY ━━━━")
        for wa in weather_alerts:
            briefing_lines.append(f"▸ {wa['text']}")
        briefing_lines.append("")

    briefing_lines.append("━━━━ NETWORK INTELLIGENCE ━━━━")
    briefing_lines.append(
        f"▸ {spillover_total} spillover events detected across the analysis period. "
        f"{spreader_zones} zones identified as active congestion super-spreaders."
    )
    briefing_lines.append(
        f"▸ Economic impact: Each violation at a major junction costs the city an estimated "
        f"₹{cost_per_violation:,} in lost productivity (45 vehicles affected, "
        f"8.4 min avg delay, ₹175/hr value of time)."
    )
    if annual_savings:
        briefing_lines.append(
            f"▸ At 90% enforcement, KAVACH projects ₹{annual_savings} crore annual savings, "
            f"{delivery_hours:,.0f} delivery hours recovered monthly, "
            f"and {sla_rescues:,.0f} SLA-at-risk deliveries rescued per month."
        )

    return {
        "date": today,
        "briefing_text": "\n".join(briefing_lines),
        "priority_zones": priority_alerts,
        "patrol_summary": patrol_summary,
        "enforcement_gaps": enforcement_gaps,
        "weather_alerts": weather_alerts,
        "network_stats": {
            "spillover_events": spillover_total,
            "super_spreader_zones": spreader_zones,
        },
        "economic_impact": {
            "cost_per_violation_inr": cost_per_violation,
            "annual_savings_crore": annual_savings,
            "delivery_hours_monthly": delivery_hours,
            "sla_rescues_monthly": sla_rescues,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
