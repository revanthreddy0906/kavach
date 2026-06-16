"""
KAVACH — Module 1: CascadeMap + Module 5 (Spillover Detection)
Produces: outputs/cascade_data.json
Depends on: dataset/violations_clean.pkl, Bengaluru OSM road network

For each high-violation zone:
  1. Finds nearest road node on Bengaluru's OSM graph
  2. Computes ego-graph expansion at 15 / 30 / 60 min travel time
  3. Extracts downstream affected node coordinates per time frame
  4. Runs time-windowed DBSCAN for spillover detection
  5. Builds primary -> secondary -> tertiary propagation chains

Usage:
    python modules/module1_cascade.py
"""

import json
import sys
import warnings
from collections import defaultdict
from pathlib import Path

import geohash2
import networkx as nx
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.cluster import DBSCAN

warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PKL_PATH = PROJECT_ROOT / "Dataset" / "violations_clean.pkl"
GRAPH_CACHE = PROJECT_ROOT / "Dataset" / "bengaluru_roads.graphml"
OUTPUT_CASCADE = PROJECT_ROOT / "outputs" / "cascade_data.json"
OUTPUT_SPILLOVER = PROJECT_ROOT / "outputs" / "spillover_data.json"

# ─── Parameters ───────────────────────────────────────────
TOP_N_ZONES = 200          # number of highest-violation zones to compute cascades for
TIME_FRAMES_MIN = [15, 30, 60]  # cascade expansion at these travel-time thresholds (minutes)
MAX_NODES_PER_FRAME = 500  # cap node coords per frame to keep JSON manageable

# Spillover detection
DBSCAN_EPS_METERS = 200    # max cluster distance
DBSCAN_MIN_SAMPLES = 5     # min points to form a cluster
SPILLOVER_WINDOW_MIN = 30  # time window for clustering
SPILLOVER_PROXIMITY_M = 200  # distance threshold for spillover linkage

# Bengaluru bounding box for OSMnx download
BLR_BBOX = (13.10, 12.80, 77.80, 77.45)  # (north, south, east, west)


def load_violations() -> pd.DataFrame:
    """Load the cleaned violations DataFrame."""
    if not PKL_PATH.exists():
        print(f"ERROR: {PKL_PATH} not found. Run data_cleaning.py first.")
        sys.exit(1)
    df = pd.read_pickle(PKL_PATH)
    print(f"  Loaded {len(df):,} violations, {df['geohash'].nunique()} zones")
    return df


def load_or_download_graph():
    """Load cached OSM road graph, or download via OSMnx and cache."""
    if GRAPH_CACHE.exists():
        print(f"  Loading cached road graph from {GRAPH_CACHE} ...")
        import osmnx as ox
        G = ox.load_graphml(GRAPH_CACHE)
        print(f"  Graph loaded: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")
        return G

    print("  Downloading Bengaluru road network via OSMnx (first run, ~2-5 min) ...")
    import osmnx as ox
    ox.settings.use_cache = True
    ox.settings.log_console = False

    # Download drivable road network for Bengaluru
    G = ox.graph_from_place("Bengaluru, Karnataka, India", network_type="drive")

    # Add edge speeds (inferred from road type) and travel times (seconds)
    G = ox.add_edge_speeds(G)
    G = ox.add_edge_travel_times(G)

    # Cache for future runs
    GRAPH_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ox.save_graphml(G, GRAPH_CACHE)
    print(f"  Graph saved: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges -> {GRAPH_CACHE}")
    return G


def ensure_travel_times(G):
    """Ensure all edges have travel_time attribute. Fill missing with length/30kmh."""
    missing = 0
    for u, v, data in G.edges(data=True):
        if "travel_time" not in data:
            length = data.get("length", 100)  # meters
            data["travel_time"] = length / (30 * 1000 / 3600)  # 30 km/h fallback -> seconds
            missing += 1
    if missing > 0:
        print(f"  Filled {missing:,} edges with fallback travel_time (30 km/h)")
    return G


def build_node_kdtree(G):
    """Build a KD-tree from graph node coordinates for fast nearest-node lookup."""
    node_ids = list(G.nodes())
    coords = np.array([(G.nodes[n]["y"], G.nodes[n]["x"]) for n in node_ids])
    tree = cKDTree(coords)
    return tree, node_ids, coords


def find_nearest_node(tree, node_ids, lat, lng):
    """Find the nearest graph node to a given lat/lng."""
    _, idx = tree.query([lat, lng])
    return node_ids[idx]


def compute_ego_cascade(G, center_node, time_minutes, node_coords_map):
    """
    Compute the ego graph from center_node within time_minutes travel time.
    Returns list of [lat, lng] for all nodes in the ego graph.
    """
    radius_seconds = time_minutes * 60

    try:
        ego = nx.ego_graph(G, center_node, radius=radius_seconds, distance="travel_time")
        nodes = list(ego.nodes())

        # Extract coordinates
        coords = []
        for n in nodes:
            if n in node_coords_map:
                lat, lng = node_coords_map[n]
                coords.append([round(lat, 6), round(lng, 6)])

        # Cap to keep JSON size manageable
        if len(coords) > MAX_NODES_PER_FRAME:
            indices = np.random.RandomState(42).choice(len(coords), MAX_NODES_PER_FRAME, replace=False)
            coords = [coords[i] for i in sorted(indices)]

        return coords
    except Exception as e:
        # Node might be isolated or unreachable
        return []


def compute_zone_cascades(df: pd.DataFrame, G, top_n: int = TOP_N_ZONES):
    """
    For the top N zones by violation count, compute cascade expansion
    at 15, 30, 60 min travel time thresholds.
    """
    print(f"\n[CASCADE] Computing cascades for top {top_n} zones ...")

    # Build KD-tree for fast node lookup
    print("  Building node KD-tree ...")
    tree, node_ids, coords = build_node_kdtree(G)

    # Node coordinate map for extraction
    node_coords_map = {nid: (G.nodes[nid]["y"], G.nodes[nid]["x"]) for nid in G.nodes()}

    # Get top N zones by violation count
    zone_counts = df["geohash"].value_counts().head(top_n)
    top_zones = zone_counts.index.tolist()

    # Compute zone centroids
    zone_centroids = df.groupby("geohash").agg(
        lat=("latitude", "mean"),
        lng=("longitude", "mean"),
        count=("id", "count"),
        primary_violation=("violation_type", lambda x: _most_common_violation(x)),
        dominant_vehicle=("vehicle_type", lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else "UNKNOWN"),
    ).loc[top_zones]

    # Compute cascades
    cascade_data = {}
    for i, (zone_id, row) in enumerate(zone_centroids.iterrows()):
        if (i + 1) % 20 == 0 or i == 0:
            print(f"  Processing zone {i+1}/{len(zone_centroids)}: {zone_id} ...")

        center_node = find_nearest_node(tree, node_ids, row["lat"], row["lng"])

        frames = []
        for t_min in TIME_FRAMES_MIN:
            node_coords = compute_ego_cascade(G, center_node, t_min, node_coords_map)
            frames.append({
                "minutes": t_min,
                "affected_nodes": len(node_coords),
                "nodes": node_coords,
            })

        cascade_data[zone_id] = {
            "zone_id": zone_id,
            "center_lat": round(row["lat"], 6),
            "center_lng": round(row["lng"], 6),
            "violation_count": int(row["count"]),
            "primary_violation": row["primary_violation"],
            "dominant_vehicle": row["dominant_vehicle"],
            "trigger_time": _peak_hour_for_zone(df, zone_id),
            "cascade_reach": frames[-1]["affected_nodes"] if frames else 0,
            "frames": frames,
        }

    print(f"  Cascades computed for {len(cascade_data)} zones")
    return cascade_data


def _most_common_violation(violation_lists):
    """Extract the most common single violation from lists of violations."""
    flat = []
    for vlist in violation_lists:
        if isinstance(vlist, list):
            flat.extend(vlist)
    if not flat:
        return "UNKNOWN"
    return pd.Series(flat).mode().iloc[0]


def _peak_hour_for_zone(df: pd.DataFrame, zone_id: str) -> str:
    """Return the peak violation hour for a zone as HH:00 string."""
    zone_df = df[df["geohash"] == zone_id]
    if zone_df.empty:
        return "08:00"
    peak_hour = zone_df["hour"].mode().iloc[0]
    return f"{int(peak_hour):02d}:00"


# ─── Module 5: Spillover Detection ───────────────────────

def haversine_meters(lat1, lng1, lat2, lng2):
    """Haversine distance in meters between two points."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlam = np.radians(lng2 - lng1)
    a = np.sin(dphi / 2) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlam / 2) ** 2
    return 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def detect_spillovers(df: pd.DataFrame) -> dict:
    """
    Time-windowed DBSCAN spillover detection.

    If a new cluster appears within 200m of a saturated cluster
    within 30 minutes, classify as spillover.
    Builds primary -> secondary -> tertiary propagation graph.
    """
    print("\n[SPILLOVER] Running time-windowed DBSCAN ...")

    # Sort by time
    df_sorted = df.sort_values("created_datetime").copy()

    # Create time windows (30 min)
    df_sorted["time_window"] = (
        df_sorted["created_datetime"]
        .dt.floor(f"{SPILLOVER_WINDOW_MIN}min")
    )

    # Approximate degree-to-meter conversion for Bengaluru (~12.97°N)
    # 1° lat ~ 111,320 m, 1° lng ~ 111,320 * cos(12.97°) ~ 108,500 m
    eps_degrees = DBSCAN_EPS_METERS / 111_320  # ~0.0018°

    windows = sorted(df_sorted["time_window"].unique())
    print(f"  {len(windows)} time windows of {SPILLOVER_WINDOW_MIN}min each")

    # Track clusters per window
    window_clusters = {}  # {window: [(centroid_lat, centroid_lng, size, zone_id), ...]}
    spillover_events = []
    propagation_graph = defaultdict(list)  # {primary_zone: [secondary_zones]}

    for w_idx, window in enumerate(windows):
        w_df = df_sorted[df_sorted["time_window"] == window]
        if len(w_df) < DBSCAN_MIN_SAMPLES:
            window_clusters[window] = []
            continue

        coords = w_df[["latitude", "longitude"]].values
        clustering = DBSCAN(
            eps=eps_degrees,
            min_samples=DBSCAN_MIN_SAMPLES,
            metric="euclidean",
        ).fit(coords)

        labels = clustering.labels_
        clusters = []
        for label in set(labels):
            if label == -1:
                continue
            mask = labels == label
            cluster_coords = coords[mask]
            centroid = cluster_coords.mean(axis=0)
            # Determine the dominant zone in this cluster
            cluster_zones = w_df.iloc[mask]["geohash"].values
            dominant_zone = pd.Series(cluster_zones).mode().iloc[0]
            clusters.append({
                "centroid_lat": centroid[0],
                "centroid_lng": centroid[1],
                "size": int(mask.sum()),
                "zone_id": dominant_zone,
                "is_saturated": mask.sum() >= DBSCAN_MIN_SAMPLES * 3,
            })

        # Check for spillovers: compare with previous window
        if w_idx > 0 and windows[w_idx - 1] in window_clusters:
            prev_clusters = window_clusters[windows[w_idx - 1]]
            prev_saturated = [c for c in prev_clusters if c["is_saturated"]]

            for curr_c in clusters:
                for prev_c in prev_saturated:
                    dist = haversine_meters(
                        prev_c["centroid_lat"], prev_c["centroid_lng"],
                        curr_c["centroid_lat"], curr_c["centroid_lng"],
                    )
                    # New cluster near a saturated cluster = spillover
                    if (
                        dist <= SPILLOVER_PROXIMITY_M
                        and dist > 10  # not the same exact cluster
                        and curr_c["zone_id"] != prev_c["zone_id"]
                    ):
                        spillover_events.append({
                            "timestamp": str(window),
                            "primary_zone": prev_c["zone_id"],
                            "secondary_zone": curr_c["zone_id"],
                            "distance_m": round(dist, 1),
                            "primary_size": prev_c["size"],
                            "secondary_size": curr_c["size"],
                        })
                        propagation_graph[prev_c["zone_id"]].append(curr_c["zone_id"])

        window_clusters[window] = clusters

    # Build propagation chains (primary -> secondary -> tertiary)
    propagation_chains = []
    for primary, secondaries in propagation_graph.items():
        secondary_set = list(set(secondaries))
        tertiaries = []
        for sec in secondary_set:
            if sec in propagation_graph:
                tertiaries.extend(propagation_graph[sec])
        tertiary_set = list(set(tertiaries) - {primary} - set(secondary_set))

        propagation_chains.append({
            "primary_zone": primary,
            "secondary_zones": secondary_set[:10],  # cap for JSON size
            "tertiary_zones": tertiary_set[:10],
            "total_spillover_events": sum(1 for e in spillover_events if e["primary_zone"] == primary),
        })

    # Sort by most spillover events
    propagation_chains.sort(key=lambda x: x["total_spillover_events"], reverse=True)

    spillover_result = {
        "total_spillover_events": len(spillover_events),
        "unique_primary_zones": len(propagation_graph),
        "propagation_chains": propagation_chains[:50],  # top 50
        "sample_events": spillover_events[:100],  # sample for dashboard
        "params": {
            "eps_meters": DBSCAN_EPS_METERS,
            "min_samples": DBSCAN_MIN_SAMPLES,
            "window_minutes": SPILLOVER_WINDOW_MIN,
            "proximity_meters": SPILLOVER_PROXIMITY_M,
        },
    }

    print(f"  Detected {len(spillover_events)} spillover events")
    print(f"  {len(propagation_graph)} primary zones with cascading spillovers")
    if propagation_chains:
        top = propagation_chains[0]
        print(f"  Worst primary zone: {top['primary_zone']} -> "
              f"{len(top['secondary_zones'])} secondary, {len(top['tertiary_zones'])} tertiary")

    return spillover_result


def enrich_cascade_with_spillover(cascade_data: dict, spillover: dict) -> dict:
    """Add spillover metadata to cascade entries."""
    # Build lookup: zone_id -> spillover info
    spillover_lookup = {}
    for chain in spillover["propagation_chains"]:
        z = chain["primary_zone"]
        spillover_lookup[z] = {
            "is_spillover_source": True,
            "secondary_zones": chain["secondary_zones"],
            "tertiary_zones": chain["tertiary_zones"],
            "spillover_event_count": chain["total_spillover_events"],
        }

    # Also mark secondary zones
    all_secondary = set()
    for chain in spillover["propagation_chains"]:
        all_secondary.update(chain["secondary_zones"])

    for zone_id, data in cascade_data.items():
        if zone_id in spillover_lookup:
            data["spillover"] = spillover_lookup[zone_id]
        elif zone_id in all_secondary:
            data["spillover"] = {
                "is_spillover_source": False,
                "is_spillover_target": True,
            }
        else:
            data["spillover"] = {
                "is_spillover_source": False,
                "is_spillover_target": False,
            }

    return cascade_data


def main():
    print("=" * 60)
    print("KAVACH — Module 1: CascadeMap + Spillover Detection")
    print("=" * 60)

    # Step 1: Load violations
    print("\n[STEP 1] Loading violations ...")
    df = load_violations()

    # Step 2: Load road network
    print("\n[STEP 2] Loading Bengaluru road network ...")
    G = load_or_download_graph()
    G = ensure_travel_times(G)

    # Step 3: Compute cascade zones
    cascade_data = compute_zone_cascades(df, G, top_n=TOP_N_ZONES)

    # Step 4: Spillover detection
    spillover = detect_spillovers(df)

    # Step 5: Enrich cascade with spillover data
    print("\n[ENRICH] Merging spillover data into cascade output ...")
    cascade_data = enrich_cascade_with_spillover(cascade_data, spillover)

    # Step 6: Save outputs
    OUTPUT_CASCADE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CASCADE, "w") as f:
        json.dump(cascade_data, f, indent=2, default=str)
    print(f"\n  Saved cascade_data.json -> {OUTPUT_CASCADE}")
    print(f"  Zones: {len(cascade_data)}, File size: {OUTPUT_CASCADE.stat().st_size / 1e6:.1f} MB")

    with open(OUTPUT_SPILLOVER, "w") as f:
        json.dump(spillover, f, indent=2, default=str)
    print(f"  Saved spillover_data.json -> {OUTPUT_SPILLOVER}")

    # Summary
    total_affected_60min = sum(
        d["cascade_reach"] for d in cascade_data.values()
    )
    print(f"\n{'=' * 60}")
    print(f"CASCADE SUMMARY")
    print(f"  Zones processed:     {len(cascade_data)}")
    print(f"  Total nodes at 60m:  {total_affected_60min:,}")
    print(f"  Avg cascade reach:   {total_affected_60min / max(1, len(cascade_data)):.0f} nodes")
    print(f"  Spillover events:    {spillover['total_spillover_events']}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
