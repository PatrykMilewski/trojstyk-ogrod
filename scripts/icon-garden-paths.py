"""Rebuild the two private /193 stepping-stone routes from the current metric site."""
import argparse
import json
import math
import random
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import nearest_points, substring, unary_union

from woodland_plan import garden_services, polygon_parts, sources, surface


PALETTE = ('#dfdacb', '#d5cfc0', '#e4dfd2', '#dbd5c6', '#d2cdbf')


def plan_point(house, x, y):
    meta = house['metadata']
    u = meta['dimensions']['width'] - x
    return Point([a*u + b*y + t for (a, b), t in zip(meta['matrix'], meta['translation'])])


def terrace_exit(house, facade, terrace, wicket):
    opening = next(o for o in facade['openings'] if not o['glass'])
    center = (opening['start'] + opening['end']) / 2
    door = LineString([facade['a'], facade['b']]).interpolate(center)
    threshold = plan_point(house, door.x - facade['thickness']/2 - .055, door.y)
    gate = wicket.centroid
    # Leave the deck seven degrees toward the service lawn to clear the rain-field excavation.
    heading = math.atan2(gate.y-threshold.y, gate.x-threshold.x) + math.radians(7)
    dx, dy = math.cos(heading), math.sin(heading)
    reach = threshold.distance(gate)
    walk = LineString([threshold, (threshold.x + reach*dx, threshold.y + reach*dy)])
    deck = walk.intersection(terrace)
    assert deck.geom_type == 'LineString' and deck.distance(threshold) < .7
    start = max((Point(p) for p in deck.coords), key=threshold.distance)
    # Tangent to the walk across the boards, ending at the existing wicket.
    radius = start.distance(gate)**2 / (2*(-dy*(gate.x-start.x) + dx*(gate.y-start.y)))
    return start, Point(start.x-dy*radius, start.y+dx*radius)


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


def flagstones(route_id, start, end, free, seed, arc=None):
    line = LineString([start, end])
    length = line.length
    if arc:
        radius = start.distance(arc)
        length = 2*radius*math.asin(line.length/(2*radius))
        initial_angle = math.atan2(start.y-arc.y, start.x-arc.x)
    first_center = .30
    count = 2 * round((length - first_center) / .60)
    pitch = (length - 2*first_center) / (count-1)
    row_spacing = .34
    dx, dy = (end.x - start.x)/line.length, (end.y - start.y)/line.length
    rng = random.Random(seed)
    stones, gaps = [], []
    for i in range(count):
        station = first_center + i*pitch
        if arc:
            angle = initial_angle - station/radius
            dx, dy = math.sin(angle), -math.cos(angle)
            mid = Point(arc.x-radius*dy, arc.y+radius*dx)
        else:
            mid = line.interpolate(station)
        # The approach to the wicket leaves the angled deck edge with the right foot.
        left = i % 2 == (1 if route_id == 'wicket' else 0)
        offset = row_spacing / 2 if left else -row_spacing / 2
        center = Point(mid.x - dy*offset, mid.y + dx*offset)
        # Keep enough flat stone under the entire foot even at the irregular corners.
        sole = Polygon([(center.x + dx*v - dy*u, center.y + dy*v + dx*u)
                        for u, v in [(-.055,-.14), (.055,-.14), (.055,.14), (-.055,.14)]])
        for _ in range(100):
            ring = stone_ring(rng, center, (dx, dy), rng.uniform(.28, .33), rng.uniform(.38, .44))
            if ring.covers(sole) and free.covers(ring):
                break
        else:
            raise ValueError(f'No full stone fits step {i+1} on {route_id}')
        if stones:
            gaps.append(ring.distance(surface(stones[-1])))
        stones.append(dict(id=f'flagstone-{route_id}-{i+1:02d}', kind='flagstone', route=route_id,
                           row='left' if left else 'right', center=list(center.coords[0]),
                           name='Kamień do paleniska' if route_id == 'fire' else 'Kamień do furtki trójstyku',
                           ring=list(ring.exterior.coords), holes=[], z=.006, height=.035,
                           color=rng.choice(PALETTE)))
    stride = math.hypot(pitch, row_spacing)
    assert .57 <= 2*pitch <= .63 and min(gaps) > .01
    assert start.distance(surface(stones[0])) < .30 and end.distance(surface(stones[-1])) < .30
    details = dict(id=route_id, ends=list(line.coords), lengthM=length, count=count,
                        firstCenterM=first_center, stepM=pitch, sameRowPitchM=2*pitch,
                        rowSpacingM=row_spacing, footfallM=stride,
                        minGapM=min(gaps), maxGapM=max(gaps))
    if arc:
        details['clockwiseArcCenter'] = list(arc.coords[0])
        details['footfallM'] = sum(math.dist(a['center'], b['center']) for a,b in zip(stones, stones[1:]))/(count-1)
    return stones, details


def set_sliding_gate(garden, plot):
    gate = next(line for line in garden['lines'] if line['kind'] == 'drive_gate')
    a,b = gate['points']
    length = math.dist(a,b)
    ux,uy = (b[0]-a[0])/length,(b[1]-a[1])/length
    nx,ny = -uy,ux
    if not shape(plot['driveway']).covers(Point((a[0]+b[0])/2+nx,(a[1]+b[1])/2+ny)):
        nx,ny = -nx,-ny
    def point(u,v):
        return [a[0]+ux*u+nx*v, a[1]+uy*u+ny*v]
    gate.pop('swing',None)
    width,tail=length+.09,2.65
    travel=length+.18
    closed=[point(-.045,.24),point(-.045+width,.24)]
    pocket=[point(-.045+travel,.24),point(-.045+travel+width+tail,.24)]
    gate['slide']=dict(closed=closed,pocket=pocket,tailM=tail)



def add_street_entry(plot, garden, house):
    set_sliding_gate(garden,plot)
    width, distance_to_drive = 1.2, .25
    drive = plot['driveway']['coordinates'][0]
    road = LineString(next(l['points'] for l in garden['lines'] if l['kind'] == 'drive_gate'))
    ux, uy = [(b-a)/road.length for a,b in zip(*road.coords)]
    drive_edge = LineString([drive[-2],drive[-3]])
    street = drive_edge.coords[0]
    rear = drive_edge.interpolate(width).coords[0]
    def offset(point, metres):
        return [point[0]-ux*metres, point[1]-uy*metres]
    front = [offset(street,s) for s in (width+distance_to_drive,distance_to_drive)]
    walk = Polygon([*front, street, rear, offset(rear,width+distance_to_drive)])
    services = garden_services(house)
    assert all(walk.disjoint(surface(o)) for o in services['access'] + services['footprints'])
    if not any(l['kind'] == 'street_wicket' for l in garden['lines']):
        fence = next(l for l in garden['lines'] if l['kind'] == 'parcel_fence'
                     and all(LineString(l['points']).distance(Point(p)) < 1e-5 for p in front))
        line = LineString(fence['points'])
        lo, hi = sorted(line.project(Point(p)) for p in front)
        i = garden['lines'].index(fence)
        garden['lines'][i:i+1] = [
            {**fence, 'points': list(substring(line,0,lo).coords)},
            {**fence, 'id': fence['id']+'-street', 'points': list(substring(line,hi,line.length).coords)}]
        garden['lines'].append(dict(id='street-wicket-193', kind='street_wicket', name='Furtka wejściowa /193',
                                    points=front, width=.055, height=1.6, z=0))
    garden['polygons'] = [p for p in garden['polygons'] if p['id'] != 'street-walk-193']
    lawn_area = 0
    for lawn in (p for p in garden['polygons'] if p['kind'] == 'lawn'):
        clipped = surface(lawn).difference(walk)
        lawn.update(ring=list(clipped.exterior.coords), holes=[list(r.coords) for r in clipped.interiors])
        lawn_area += clipped.area
    garden['polygons'].append(dict(id='street-walk-193', kind='paving', name='Szara kostka granitowa od furtki',
                                   ring=list(walk.exterior.coords), holes=[], color='#b9b9b5', z=.035))
    garden['metadata']['areasM2'].update(lawn=lawn_area, streetWalk=walk.area)
    return garden


def build_paths(plot, garden, house, interior):
    retained = [p for p in garden['polygons'] if p['id'] not in ('kitchen-pad', 'shared-path')
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
    facade = next(f for f in interior['facades'] if f['id'] == 'facade-terrace')
    wicket_start, arc = terrace_exit(house, facade, terrace, wicket)
    routes = [('fire', nearest_points(plan_point(house, 5.7, 19.55), terrace.boundary)[1],
               nearest_points(entrance, fire.boundary)[1], 193, None),
              ('wicket', wicket_start, wicket.centroid, 2193, arc)]
    stones, details = [], []
    for name, start, end, seed, curve in routes:
        free = available.buffer(-.035)
        if curve:
            for field in garden_services(house)['footprints']:
                if field['id'].startswith('rain-field-'):
                    free = free.difference(surface(field).buffer(1.0))
        run, measurements = flagstones(name, start, end, free, seed, curve)
        landing = fire if name == 'fire' else wicket
        assert all(terrace.distance(surface(stone)) < .45 for stone in run[:2])
        assert all(landing.distance(surface(stone)) < .45 for stone in run[-2:])
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
    return add_street_entry(plot, garden, house)


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
        for p in garden['polygons'] if p['kind']=='flagstone' or p['id'] in ('fire-gravel','street-walk-193')],
        bowl=dict(center=project(fire['center']), radius=fire['radius']))
    slide = next(line['slide'] for line in garden['lines'] if line['kind']=='drive_gate')
    editor['garden193']['driveGate'] = {k:list(map(project,slide[k])) for k in ('closed','pocket')}
    path.write_text(json.dumps(editor, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True, help='Current standalone model HTML')
    parser.add_argument('--output', type=Path, required=True, help='Garden JSON consumed by the scene generator')
    parser.add_argument('--editor', type=Path, help='Update the 2D editor metric background')
    args = parser.parse_args()
    plot, garden, _, house = sources(args.model)
    model = args.model.read_text()
    marker = 'const interiorData='
    interior, _ = json.JSONDecoder().raw_decode(model, model.index(marker)+len(marker))
    garden = build_paths(plot, garden, house, interior)
    if args.editor:
        sync_editor(args.editor, plot, garden)
    args.output.write_text(json.dumps(garden, ensure_ascii=False, indent=2))
    print(json.dumps(garden['metadata']['flagstoneRoutes'], indent=2))
