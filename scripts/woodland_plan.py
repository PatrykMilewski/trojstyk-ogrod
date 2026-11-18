"""Generate measured private woody planting beds for the three-house garden model (Shapely 2)."""
import argparse
import json
import math
import re
from pathlib import Path

from shapely.affinity import rotate, translate
from shapely.geometry import GeometryCollection, LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent
TARGET = 0.3075
# Order matches consecutive cadastral edges. Deeper beds face the open garden edges.
EDGE_WEIGHTS = {
    "190": (1.15, 1.2, .85, .65, .72),
    "191": (.95, 1.2, 1.05, 1.1, .7, .85),
    "193": (.85, 1.22, 1.18, .85, .82, .65),
}


def sources(model):
    if model:
        text = model.read_text()
        assignment = re.search(r"const\s*\[\s*source\s*,\s*garden\s*,\s*house\s*,\s*neighbors\s*\]\s*=\s*(?=\[)", text)
        if not assignment:
            raise ValueError(f"No embedded metric model in {model}")
        (source, garden, _, site), _ = json.JSONDecoder().raw_decode(text, assignment.end())
    else:
        source, garden, site = (
            json.loads((ROOT.parent / path).read_text())
            for path in ("results.json", "icon3d-garden.json", "neighbors/site-three.json")
        )
    return next(v for v in source["variants"] if v["id"] == "aktualny"), garden, site


def surface(item):
    return Polygon(item["ring"], item.get("holes", []))


def object_footprint(item):
    if "ring" in item:
        return surface(item)
    x, y = item["center"]
    w, d = item["w"] / 2, item["d"] / 2
    return translate(rotate(box(-w, -d, w, d), item["angleDeg"]), x, y)


def figures(garden, site):
    # Lawn clearings around static figures in people-dogs.js.
    meta = garden["metadata"]
    def shared_xy(x, y):
        return [a*x+b*y+t for (a, b), t in zip(meta["sharedRotation"], meta["sharedTranslation"])]

    return [Point(xy[:2]).buffer(1.15) for xy in [
        (2, -7), (3.2, -6.5), (6, -6), (7, -6), (4.5, 34.3),
        shared_xy(-7.2, 17.6), shared_xy(-7, 18.2), shared_xy(27, 13.6),
        site["figurePlacements"]["person-191-front"]["position"],
    ]]


def occupied(plot, garden, site):
    fixed = [shape(plot["reserve"]).buffer(1.15), shape(plot["driveway"]).buffer(.65)]
    for layout in site["layouts"].values():
        fixed.append(shape(layout["reservation"]).buffer(1.15))
    fixed += [shape(s["geometry"]).buffer(.65) for s in site["surfaces"]]
    for collection in (garden, site["gardenAdditions"]):
        for p in collection["polygons"]:
            if p["kind"] not in ("planting", "lawn"):
                clearance = 1.1 if p["kind"] == "gravel" else .55
                fixed.append(surface(p).buffer(clearance))
        fixed += [object_footprint(o).buffer(.65) for o in collection["objects"]]
        fixed += [Point(c["center"]).buffer(4.2) for c in collection["circles"] if c["kind"] == "firepit"]
        fixed += [LineString(line["points"]).buffer(1.25) for line in collection["lines"]
                  if line["kind"] in ("wicket", "drive_gate")]
    fixed += [LineString(gate["points"]).buffer(1.25) for gate in site["vehicleGates"]]
    return unary_union(fixed + figures(garden, site))


def polygon_parts(g):
    if g.geom_type == "Polygon":
        return [g]
    return [p for member in getattr(g, "geoms", []) for p in polygon_parts(member)]


def design(parcel_id, parcel, free, existing):
    points = list(parcel.exterior.coords)
    edges = [LineString([a, b]) for a, b in zip(points, points[1:])]
    weights = EDGE_WEIGHTS[parcel_id]
    if len(edges) != len(weights):
        raise ValueError(f"Parcel {parcel_id} geometry changed; review the perimeter design")
    tree_beds = [Point(t["center"]).buffer(1.15) for t in existing if parcel.covers(Point(t["center"]))]

    def beds(width):
        perimeter = [edge.buffer(width * weight) for edge, weight in zip(edges, weights)]
        raw = free.intersection(unary_union(perimeter + tree_beds))
        # Remove unplantable slivers and round clipped corners before measuring.
        smooth = raw.buffer(-.35, quad_segs=5).buffer(.35, quad_segs=5).intersection(raw)
        return unary_union([p for p in polygon_parts(smooth) if p.area >= 3.5])

    lo, hi = 0, 12
    target = parcel.area * TARGET
    if beds(hi).area < target:
        raise ValueError(f"Insufficient available planting area on /{parcel_id}")
    for _ in range(24):
        mid = (lo + hi) / 2
        if beds(mid).area < target:
            lo = mid
        else:
            hi = mid
    return beds(hi)


def new_trees(beds, parcel, obstacles, existing):
    # Select separated understory trees with their whole crowns inside the beds.
    safe = beds.buffer(-1.5).intersection(parcel.buffer(-2.1)).difference(obstacles.buffer(.5))
    min_x, min_y, max_x, max_y = safe.bounds if not safe.is_empty else (0, 0, 0, 0)
    points = [Point(x, y) for x in range(math.ceil(min_x), math.ceil(max_x))
              for y in range(math.ceil(min_y), math.ceil(max_y)) if safe.covers(Point(x, y))]
    neighbors = [Point(t["center"]) for t in existing]
    result = []
    for height, radius in [(4.8, 1.45), (4.3, 1.3), (3.9, 1.2)]:
        if not points:
            break
        point = max(points, key=lambda p: min(p.distance(q) for q in neighbors))
        if min(point.distance(q) for q in neighbors) < 5.2:
            break
        neighbors.append(point)
        result.append(dict(center=[point.x, point.y], height=height, crownRadius=radius))
    return result


def generate(plot, garden, site):
    obstacles = occupied(plot, garden, site)
    existing = garden["trees"] + site["gardenAdditions"]["trees"]
    result = []
    for parcel_id in EDGE_WEIGHTS:
        parcel = shape(site["parcels"][parcel_id])
        free = parcel.buffer(-.4, join_style="mitre").difference(obstacles)
        beds = design(parcel_id, parcel, free, existing)
        parts = sorted(polygon_parts(beds), key=lambda p: -p.area)
        polygons = [dict(ring=list(p.exterior.coords), holes=[list(h.coords) for h in p.interiors]) for p in parts]
        drawn = unary_union([surface(p) for p in polygons])
        assert drawn.is_valid and drawn.difference(free).area < 1e-7
        assert drawn.intersection(obstacles).area < 1e-7 and drawn.difference(parcel).area < 1e-7
        assert abs(drawn.area - sum(p.area for p in parts)) < 1e-7
        assert .305 <= drawn.area / parcel.area <= .31
        result.append(dict(id=parcel_id, boundary=list(parcel.exterior.coords), beds=polygons,
                           areaM2=parcel.area, plantedAreaM2=drawn.area,
                           trees=new_trees(drawn, parcel, obstacles, existing)))
    return dict(parcels=result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    published = ROOT.parent / "trzy-domy-3d"
    model = published / "index.html" if published.is_dir() else None
    output = (published if published.is_dir() else ROOT) / "woodland-plan.json"
    parser.add_argument("--model", type=Path, default=model, help="Standalone scene index.html with four embedded source objects")
    parser.add_argument("--output", type=Path, default=output)
    args = parser.parse_args()
    data = generate(*sources(args.model))
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    for p in data["parcels"]:
        print(f'775/{p["id"]}  {p["plantedAreaM2"]:.2f} / {p["areaM2"]:.2f} m²'
              f'  {100*p["plantedAreaM2"]/p["areaM2"]:.2f}%  {len(p["trees"])} new trees')
