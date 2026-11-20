"""Check modelled pipe and excavation depths against a GUGiK 1 m ASCII grid (numpy and pyproj)."""
import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.affinity import scale
from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]


def read_scene_and_routes():
    html = (ROOT / "trzy-domy-3d/index.html").read_text()
    model, _ = json.JSONDecoder().raw_decode(html.split("const [source,garden,house,neighbors]=", 1)[1])
    script = """import {rainHydraulics193} from './src/model/rain-services.js';
console.log(JSON.stringify(rainHydraulics193()));"""
    result = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", script],
                            cwd=ROOT, capture_output=True, text=True, check=True)
    return model[2]["metadata"], json.loads(result.stdout)


def sample_ground(path, meta):
    with path.open() as stream:
        header = {k.lower(): float(v) for k, v in (stream.readline().split() for _ in range(5))}
        grid = np.loadtxt(stream)
    assert grid.shape == (int(header["nrows"]), int(header["ncols"]))
    transform = Transformer.from_crs(2177, 2180, always_xy=True)
    origin = np.asarray(meta["origin2177"]) + meta["translation"]
    matrix = np.asarray(meta["matrix"])

    def ground(xy):
        xy = np.array(xy, dtype=float, ndmin=2)
        xy[:, 0] = meta["dimensions"]["width"] - xy[:, 0]
        east, north = transform.transform(*(xy @ matrix.T + origin).T)
        col = (east - header["xllcorner"]) / header["cellsize"] - .5
        row = header["nrows"] - .5 - (north - header["yllcorner"]) / header["cellsize"]
        i, j = np.floor(col).astype(int), np.floor(row).astype(int)
        if np.any(i < 0) or np.any(j < 0) or np.any(i+1 >= grid.shape[1]) or np.any(j+1 >= grid.shape[0]):
            raise ValueError("Raster does not cover the site")
        dx, dy = col - i, row - j
        values = ((1-dy) * ((1-dx)*grid[j, i] + dx*grid[j, i+1]) +
                  dy * ((1-dx)*grid[j+1, i] + dx*grid[j+1, i+1]))
        if not np.all((values > 100) & (values < 200)):
            raise ValueError("Missing terrain values or wrong elevation datum for this site")
        return values

    return ground


def rectangle(x, y, width, depth):
    xs = np.linspace(x, x+width, math.ceil(width/.20)+1)
    ys = np.linspace(y, y+depth, math.ceil(depth/.20)+1)
    return np.array([[px, py] for px in xs for py in ys])


def station_points(paths):
    return np.concatenate([np.linspace(a, b, math.ceil(math.dist(a[:2], b[:2])/.20)+1)
                           for path in paths for a, b in zip(path, path[1:])])


def span(values):
    return [round(float(np.min(values)), 3), round(float(np.max(values)), 3)]


def report(grid):
    meta, layout = read_scene_and_routes()
    ground = sample_ground(grid, meta)
    datum = float(ground([[4.25, 8.46]])[0])
    result = {"assumedDatumEVRF2007M": datum, "pipeGroups": {}, "beds": []}
    deepest = None
    for name, routes in {
        "SW planted bed to field chamber": [layout["gardenOutlet"]],
        "SE downpipes to tank": [*layout["east"], layout["eastTrunk"], layout["tankInlet"]],
        "SE overflow and shared field pipes": [layout["overflow"], *layout["feeds"]],
    }.items():
        pts = station_points(routes)
        invert = ground(pts[:, :2])-datum-pts[:, 2]+.065
        result["pipeGroups"][name] = {"invertDepthM": span(invert), "excavationWith10cmM": span(invert+.10)}
        i = int(np.argmax(invert))
        if deepest is None or invert[i] > deepest[0]:
            deepest = (float(invert[i]), name, pts[i, :2])
    depth, group, point = deepest
    result["deepestPipe"] = {"group": group, "iconPlanXYM": point.round(3).tolist(),
                             "invertDepthM": round(depth, 3), "excavationWith10cmM": round(depth+.10, 3)}
    for key in ("eastIn", "eastOut"):
        x, y, z = layout[key]
        result[key+"FilterInvertDepthM"] = round(float(ground([[x, y]])[0])-datum-z+.065, 3)
    for bed, feed in zip(layout["fields"], layout["feeds"]):
        terrain = ground(rectangle(bed["x"], bed["y"], bed["width"], bed["depth"]))
        center_depth = terrain-datum-feed[-1][2]
        result["beds"].append({"topCoverM": span(center_depth-bed["height"]/2),
                               "excavationWith10cmM": span(center_depth+bed["height"]/2+.10)})
    tank = layout["tank"]
    x, y = tank["center"]
    w, d = tank["outside"]
    shell = ground(rectangle(x-w/2, y-d/2, w, d))-datum-tank["bottom"]
    result["tank"] = {"shellBottomDepthM": span(shell), "excavationWith10cmM": span(shell+.10)}
    garden = layout["garden"]
    ring = Polygon(garden["ring"])
    gravel = scale(ring, .965, .965, origin=tuple(garden["pivot"]))
    pipe = LineString([p[:2] for p in layout["underdrain"]])
    assert gravel.covers(pipe.buffer(garden["drainRadius"]+.10)), "perforated pipe needs side gravel cover"
    x0, y0, x1, y1 = ring.bounds
    stations = [xy for xy in rectangle(x0, y0, x1-x0, y1-y0) if ring.covers(Point(xy))]
    terrain = ground([*garden["ring"], *stations])-datum
    carrier = station_points([*layout["west"], layout["spout"]])
    carrier_clearance = datum+carrier[:, 2]-.065-ground(carrier[:, :2])
    outfall = layout["gardenOutlet"]
    chamber_inverts = [p[-1][2]-.065 for p in (outfall, layout["overflow"])]
    high_water = max(feed[-1][2]+field["height"]/2 for feed, field in zip(layout["feeds"],layout["fields"]))
    assert min(chamber_inverts)>high_water
    assert layout["spout"][-1][2]-.065>garden["rim"]>garden["crest"]>garden["floor"]
    assert min(carrier_clearance)>0
    assert all(garden["linerBase"]<point[2]-garden["drainRadius"] and
               point[2]+garden["drainRadius"]<garden["floor"]-garden["soilDepth"] for point in layout["underdrain"])
    length = sum(math.dist(a[:2],b[:2]) for a,b in zip(outfall,outfall[1:]))
    result["rainGarden"] = {
        "footprintM2": round(ring.area,3), "pondDepthM": round(garden["pondDepth"],3),
        "conservativeStorageM3": round(garden["storageM3"],3), "directRain30mmM3": round(ring.area*.030,3),
        "existingTerrainEVRF2007M": span(terrain+datum),
        "floorOverflowRimEVRF2007M": [round(datum+garden[k],3) for k in ("floor","crest","rim")],
        "linerBaseExcavationM": span(terrain-garden["linerBase"]),
        "facadeCollectorInvertAboveGroundM": span(carrier_clearance),
        "inletInvertAbovePondCrestM": round(layout["spout"][-1][2]-.065-garden["crest"],3),
        "underdrainStartsEndsEVRF2007M": [round(datum+p[2]-garden["drainRadius"],3) for p in layout["underdrain"]],
        "gardenOutfallLengthM": round(length,3),
        "gardenOutfallStartEndInvertEVRF2007M": [round(datum+outfall[i][2]-.065,3) for i in (0,-1)],
        "fieldTopBelowLowerIncomingInvertM": round(min(chamber_inverts)-high_water,3)}
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("grid", type=Path, help="ASCII grid EPSG:2180 from the height sourceURL in map-sources.json")
    print(json.dumps(report(parser.parse_args().grid), indent=2))
