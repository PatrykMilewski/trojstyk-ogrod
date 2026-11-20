"""Rebuild the two private /193 stepping-stone routes from the current metric site."""
import argparse
import json
import math
import random
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import nearest_points, unary_union

from woodland_plan import polygon_parts, sources, surface


PALETTE = ('#dfdacb', '#d5cfc0', '#e4dfd2', '#dbd5c6', '#d2cdbf')


def terrace_point(house, terrace, x):
    meta = house['metadata']
    u, v = meta['dimensions']['width'] - x, 19.55
    xy = [a*u + b*v + t for (a, b), t in zip(meta['matrix'], meta['translation'])]
    return nearest_points(Point(xy), terrace.boundary)[1]


def stone_ring(rng, center, direction, width, length):
    count = rng.randint(6, 9)
    phase = rng.uniform(0, math.tau)
    outline = []
    for i in range(count):
        angle = phase + math.tau*(i + rng.uniform(-.14, .14))/count
        radius = rng.uniform(.81, 1)
        outline.append((radius*math.cos(angle), radius*math.sin(angle)))
    us, vs = zip(*outline)
    du, dv = direction
    points = []
    for u, v in outline:
        across = ((u-min(us))/(max(us)-min(us)) - .5)*width
        along = ((v-min(vs))/(max(vs)-min(vs)) - .5)*length
        points.append((center.x + du*along - dv*across, center.y + dv*along + du*across))
    return Polygon(points)


def flagstones(route_id, start, end, free, seed):
    line = LineString([start, end])
    count = round(line.length/.65)
    pitch = line.length/count
    dx, dy = (end.x - start.x)/line.length, (end.y - start.y)/line.length
    rng = random.Random(seed)
    stones, gaps = [], []
    for i in range(count):
        mid = line.interpolate((i+.5)*pitch)
        offset = rng.uniform(-.035, .035)
        center = Point(mid.x - dy*offset, mid.y + dx*offset)
        ring = stone_ring(rng, center, (dx, dy), rng.uniform(.50,.61), rng.uniform(.41,.49))
        clipped = ring.intersection(free)
        assert clipped.geom_type == 'Polygon' and clipped.area > .84*ring.area
        if stones:
            gaps.append(clipped.distance(surface(stones[-1])))
        stones.append(dict(id=f'flagstone-{route_id}-{i+1:02d}', kind='flagstone', route=route_id,
                           name='Kamień do paleniska' if route_id == 'fire' else 'Kamień do furtki trójstyku',
                           ring=list(clipped.exterior.coords), holes=[], z=.006, height=.035,
                           color=rng.choice(PALETTE)))
    assert min(gaps) >= .12 and max(gaps) < .34
    assert start.distance(surface(stones[0])) < .25 and end.distance(surface(stones[-1])) < .25
    return stones, dict(id=route_id, ends=list(line.coords), lengthM=line.length,
                        count=count, stepM=pitch, minGapM=min(gaps), maxGapM=max(gaps))


def build_paths(plot, garden, house):
    retained = [p for p in garden['polygons'] if p['id'] != 'kitchen-pad'
                and not p['id'].startswith(('private-path', 'private-lawn', 'flagstone-'))]
    regions = {p['id']:surface(p) for p in retained}
    private = shape(plot['garden']).difference(regions['shared-zone'])
    planted = unary_union([surface(p) for p in retained if p['kind'] == 'planting'])
    fire = regions['fire-gravel']
    available = private.difference(planted.union(fire))
    wicket = LineString(next(g['points'] for g in garden['lines'] if g['id']=='brama-193-0'))
    fire_angle = math.radians(132)
    entrance = Point(fire.centroid.x + 3*math.cos(fire_angle), fire.centroid.y + 3*math.sin(fire_angle))
    terrace = shape(plot['terrace'])
    routes = [('fire', 5.7, nearest_points(entrance, fire.boundary)[1], 193),
              ('wicket', 15.05, wicket.centroid, 2193)]
    stones, details = [], []
    for name, terrace_x, end, seed in routes:
        run, measurements = flagstones(name, terrace_point(house, terrace, terrace_x), end,
                                       available.buffer(-.035), seed)
        stones.extend(run)
        details.append(measurements)
    stone_area = unary_union([surface(p) for p in stones])
    lawn = available.difference(stone_area)
    lawns = sorted((p for p in polygon_parts(lawn) if p.area > 1e-6), key=lambda p:-p.area)
    assert abs(sum(p.area for p in lawns) + stone_area.area + planted.area + fire.area - private.area) < 1e-4
    assert stone_area.distance(shape(plot['house'])) > 1 and stone_area.disjoint(regions['shared-zone'])
    assert all(stone_area.distance(Point(t['center'])) > t['crownRadius'] for t in garden['trees'])
    garden['polygons'] = retained + stones + [dict(id='private-lawn' if i==0 else f'private-lawn-{i}',
        kind='lawn', name='Prywatny trawnik', ring=list(p.exterior.coords),
        holes=[list(r.coords) for r in p.interiors], z=.022, color='#85a863') for i,p in enumerate(lawns)]
    garden['objects'] = [o for o in garden['objects'] if o['id'] != 'outdoor-kitchen']
    garden['labels'] = [o for o in garden['labels'] if o['text'] != 'Kuchnia ogrodowa']
    garden['metadata']['areasM2'].update(lawn=lawn.area, privatePaths=stone_area.area, kitchenPaving=0)
    garden['metadata']['flagstoneRoutes'] = details
    return garden


def sync_editor(path, plot, garden):
    editor = json.loads(path.read_text())
    (a,b),(c,d) = garden['metadata']['sharedRotation']
    tx, ty = garden['metadata']['sharedTranslation']

    def project(xy):
        x, y = xy[0]-tx, xy[1]-ty
        return [a*x+c*y, b*x+d*y]

    for key, feature in [('houses','house'),('terraces','terrace'),('driveways','driveway'),('entries','entry')]:
        editor.setdefault(key, {})['193'] = [project(xy) for xy in plot[feature]['coordinates'][0][:-1]]
    fire = next(item for item in garden['circles'] if item['id']=='fire-bowl')
    editor['garden193'] = dict(surfaces=[dict(id=p['id'], color=p['color'], ring=[project(xy) for xy in p['ring'][:-1]])
        for p in garden['polygons'] if p['kind']=='flagstone' or p['id']=='fire-gravel'],
        bowl=dict(center=project(fire['center']), radius=fire['radius']))
    path.write_text(json.dumps(editor, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True, help='Current standalone model HTML')
    parser.add_argument('--output', type=Path, required=True, help='Garden JSON consumed by the scene generator')
    parser.add_argument('--editor', type=Path, help='Update the 2D editor metric background')
    args = parser.parse_args()
    plot, garden, _, house = sources(args.model)
    garden = build_paths(plot, garden, house)
    if args.editor:
        sync_editor(args.editor, plot, garden)
    args.output.write_text(json.dumps(garden, ensure_ascii=False, indent=2))
    print(json.dumps(garden['metadata']['flagstoneRoutes'], indent=2))
