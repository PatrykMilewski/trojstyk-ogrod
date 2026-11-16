"""Render a readable, static dimension page from the reviewed JSON registry."""
import hashlib
import json
import shutil
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'trzy-domy-3d/model-dimensions.json'
registry = json.loads(SOURCE.read_text())


def number(value):
    return f'{value:.6f}'.rstrip('0').rstrip('.').replace('.', ',')


def dimensions(values):
    return ' × '.join(number(value) for value in values)


def table(headers, rows):
    head = ''.join(f'<th scope="col">{escape(text)}</th>' for text in headers)
    body = ''.join('<tr>' + ''.join(f'<td>{escape(str(cell))}</td>' for cell in row) + '</tr>' for row in rows)
    return f'<div class="table-scroll"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def section(title, content):
    return f'<section><h2>{escape(title)}</h2>{content}</section>'


content = section('Domy', table(['Działka / projekt', 'Gabaryt katalogowy W × D (m)', 'Najwyższy punkt modelu Z (m)'], [
    [f"/{h['parcel']} · {h['name']}", dimensions(h['catalogueEnvelopeM'].values()), number(h['modelMaxZM'])]
    for h in registry['houses']]))
content += section('Wyposażenie — rzut i pełny model', '<p>Rzut nie obejmuje wystających detali. Gabaryt 3D obejmuje np. parapet, uchwyty i siatkę; jest mierzony w osiach obiektu, po usunięciu jego obrotu na działce.</p>' + table(
    ['Obiekt / działka', 'Rzut W × D (m)', 'Pełny model W × D × H (m)', 'Podstawa wymiaru'], [
        [f"{o['name']} · {'trójstyk' if o['parcel'] == 'shared' else '/' + o['parcel']}", dimensions(o['planFootprintM']), dimensions(o['boundsLocalM']['size']), o['source']]
        for o in registry['objects']]))
content += section('Detale i przyjęte wymiary', table(['Element', 'Wymiary / parametry', 'Podstawa'], [
    [d['name'], '; '.join(f'{label}: {number(value)}' for label, value in zip(d['labels'], d['values'])), d['source']]
    for d in registry['details']]))
content += section('Ludzie i psy w skali', table(['Osoba', 'Wzrost (m)'], [
    [p['id'], number(p['heightM'])] for p in registry['people']]) + table(
    ['Pies / działka', 'Wysokość w kłębie (m)', 'Długość samego tułowia (m)'], [
        [f"{d['breed']} · /{d['parcel']}", number(d['shoulderHeightM']), number(d['torsoLengthM'])] for d in registry['dogs']]))
content += section('Nasadzenia — wartości nominalne koncepcji', table(['Drzewo', 'Wysokość nominalna (m)', 'Promień korony (m)'], [
    [t['id'], number(t['height']), number(t['crownRadius'])] for t in registry['trees']]))
content += section('Odsunięcia przyjęte w modelu', table(['Granica', 'Odległość (m)'], [
    ['Droga', number(registry['clearances']['roadM'])],
    ['Pozostałe granice — przyjęte założenie', number(registry['clearances']['otherBoundariesAssumedM'])],
    ['/191 od południowego wschodu — instrukcja użytkownika', number(registry['clearances']['parcel191SoutheastM'])]]))
notes = ''.join(f'<li>{escape(text)}</li>' for text in registry['conventions'])
sources = ''.join(f'<li><b>{escape(name)}</b>: ' + (f'<a href="{escape(value, quote=True)}" rel="noopener">źródło</a>' if value.startswith('https://') else escape(value)) + '</li>' for name, value in registry['sources'].items())
content += section('Pochodzenie i zasady zmian', f'<ul>{notes}</ul><ul>{sources}</ul>')
fingerprint = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
html = f'''<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="model-dimensions-sha256" content="{fingerprint}"><title>Wymiary · trzy domy i trójstyk</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#f3f1eb;color:#243c32;font:15px/1.6 system-ui,sans-serif}}main{{max-width:1180px;margin:auto;padding:32px 24px 60px}}h1,h2{{font-family:Georgia,serif;font-weight:400}}h1{{font-size:38px;line-height:1.15}}h2{{font-size:26px}}section{{margin-top:28px;padding:24px;background:#fcfbf7;border:1px solid #d3dace;border-radius:12px}}a{{color:#275e4b}}nav{{display:flex;gap:18px;flex-wrap:wrap}}.eyebrow{{font-size:12px;letter-spacing:2px}}.table-scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:13px;margin-top:18px}}th,td{{padding:12px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #d3dace;overflow-wrap:anywhere}}th{{color:#426c58;background:#edf1e7}}td:first-child{{font-weight:600}}li{{margin:8px 0}}.version{{color:#65746a}}@media(max-width:640px){{main{{padding:20px 14px}}section{{padding:16px 12px}}h1{{font-size:30px}}table{{min-width:620px}}}}</style></head>
<body><main><nav><a href="./">← Model 3D</a><a href="../">Konfigurator trójstyku</a><a href="model-dimensions.json" download>Pobierz rejestr JSON</a></nav>
<p class="eyebrow">775/190 · /191 · /193</p><h1>Wymiary modelu</h1><p class="version">Zamrożona wersja {escape(registry['modelVersion'])} · metry · jednakowa skala X / Y / Z</p>
<p>To stały punkt odniesienia do dalszych zmian. Dane katalogowe, wymiary schematu i założenia modelu są opisane osobno. Liczby po przecinku służą kontroli modelu i nie oznaczają dokładności projektu budowlanego.</p>{content}</main></body></html>'''
destination = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE.parent
destination.mkdir(parents=True, exist_ok=True)
(destination / 'wymiary.html').write_text(html)
if destination.resolve() != SOURCE.parent.resolve():
    shutil.copyfile(SOURCE, destination / SOURCE.name)
print(f'Dimension page written: {destination / "wymiary.html"}')
