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


def context_building_rows(buildings):
    rows=[]
    for b in buildings:
        rows.extend([
            ['Powierzchnia obrysu', number(b['footprintAreaM2'])+' m²', 'EGiB, osiem narożników'],
            ['Długości kolejnych odcinków ścian', '; '.join(number(v)+' m' for v in b['edgeLengthsM']), 'obliczone z współrzędnych EGiB'],
            ['Kondygnacje modelu', str(b['assumedStoreys'])+' × '+number(b['assumedStoreyHeightM'])+' m', 'uzgodnione założenie użytkownika'],
            ['Góra ścian / attyka / kominy', ' / '.join(number(v) for v in [b['wallHeightM'],b['roofEdgeHeightM'],b['chimneyTopM']])+' m', 'założenie modelu']])
    return rows


content = section('Domy', table(['Działka / projekt', 'Gabaryt katalogowy W × D (m)', 'Najwyższy punkt modelu Z (m)'], [
    [f"/{h['parcel']} · {h['name']}", dimensions(h['catalogueEnvelopeM'].values()), number(h['modelMaxZM'])]
    for h in registry['houses']]))
content += section('Kontekst z Geoportalu — budynek /41', '<p>Obrys z powiatowej EGiB; dokładność położenia nie została podana przez usługę. Źródło nie zawiera wysokości ani liczby kondygnacji. Elewacja, balkony i kominy są poglądowe według zdjęć.</p>' + table(
    ['Element', 'Wymiar / wartość', 'Podstawa'], context_building_rows(registry['contextBuildings'])))
content += section('Dodatkowe działki i droga /133', '<p>/192 pozostaje pusta. Droga ma pełny urzędowy obrys, bez buforowania i poszerzania; jest to działka drogowa, nie deklaracja szerokości jezdni.</p>' + table(
    ['Działka', 'Powierzchnia geometrii (m²)', 'Długości boków (m)'], [
        ['/'+p['parcel'], number(p['areaM2']), '; '.join(number(v) for v in p['edgeLengthsM'])]
        for p in [*registry['contextParcels'], registry['road']]]))
if 'woodyPlanting' in registry:
    rule = registry['woodyPlanting']
    planting = json.loads((SOURCE.parent / rule['dataFile']).read_text())
    rows = []
    for parcel in planting['parcels']:
        area, planted = parcel['areaM2'], parcel['plantedAreaM2']
        required = area * rule['minimumPercent'] / 100
        rows.append(['/' + parcel['id'], number(round(area, 2)), number(round(required, 2)),
                     number(round(planted, 2)), number(round(planted / area * 100, 2)),
                     number(round(planted - required, 2))])
    content += section('Drzewa i krzewy na działkach budowlanych',
        '<p>MPZP wymaga obsadzenia drzewami i krzewami co najmniej 30% terenu każdej działki. '
        'Bilans koncepcji obejmuje grunt w granicach zaprojektowanych nasadzeń. '
        'Obrysy są wspólne dla rzutu i modelu 3D. Trawnik, rzuty koron i powierzchnię wspólnego ogrodu pominięto.</p>'
        + table(['Działka', 'Powierzchnia (m²)', 'Wymagane 30% (m²)', 'Nasadzenia (m²)',
                 'Udział (%)', 'Zapas (m²)'], rows)
        + '<p>Na /193 obrysy rabat omijają oba pola rozsączające, zbiorniki, pokrywy i dojścia serwisowe. '
        'Dwie wywiewki tuneli ściekowych znajdują się po około 1,03 m od krawędzi krzewów. '
        'Udział nasadzeń w tabeli uwzględnia te wyłączenia.</p>'
        + '<p><a href="plan-kontrolny.svg">Rzut nasadzeń</a> · <a href="woodland-plan.json">Obrysy i bilans (JSON)</a> · '
        '<a href="https://bip.zukowo.pl/api/files/108363#page=3">Uchwała XLV/781/2002, pkt 1.4 lit. a</a></p>')
content += section('Aktualny układ wspólnego ogrodu', '<p>Źródło: dokładny plik moj-ogrod (1).json, wspólny dla konfiguratora 2D i modelu 3D. Zachowano około 0,23 m² piasku poza płotem; układ nie jest automatycznie poprawiany.</p>' + table(
    ['Parametr', 'Wartość'], [
        ['Powierzchnia wspólna (m²)', number(registry['sharedAreaM2'])],
        ['Chodnik wspólny (m²)', number(registry['sharedLayout']['sourceMetrics']['walkwayArea'])],
        ['Długość stałego płotu (m)', number(registry['sharedLayout']['sourceMetrics']['fenceLength'])],
        ['Furtki', '3 × 1,2 m'],
        ['Piasek — gabaryt przed zaokrągleniem (m)', '10 × 6,5']]))
content += section('Wyposażenie — rzut i pełny model', '<p>Rzut nie obejmuje wystających detali. Gabaryt 3D obejmuje np. parapet, uchwyty i siatkę; jest mierzony w osiach obiektu, po usunięciu jego obrotu na działce.</p>' + table(
    ['Obiekt / działka', 'Rzut W × D (m)', 'Pełny model W × D × H (m)', 'Podstawa wymiaru'], [
        [f"{o['name']} · {'trójstyk' if o['parcel'] == 'shared' else '/' + o['parcel']}", dimensions(o['planFootprintM']), dimensions(o['boundsLocalM']['size']), o['source']]
        for o in registry['objects']]))
content += section('Detale i przyjęte wymiary', table(['Element', 'Wymiary / parametry', 'Podstawa'], [
    [d['name'], '; '.join(f'{label}: {number(value)}' for label, value in zip(d['labels'], d['values'])), d['source']]
    for d in registry['details']]))
content += '<div id="oczyszczalnia"></div>' + section('Instalacje /193', '''
<p>Wybierz „Widoki i sterowanie” → „Instalacje”, a następnie układ i kondygnację. Za domem, po stronie ogrodu, znajdują się zbiornik BioDisc oraz całe pole tuneli. W zwykłym widoku można odnaleźć pokrywę zbiornika, studzienkę rozdzielczą i dwie niskie wywiewki. Włazy deszczówki są po północno-wschodniej stronie domu. W widoku instalacji można prześledzić drogę wody i ścieków pod ziemią.</p>
<p><strong>Co się stanie, gdy powstanie kanalizacja?</strong> Jeżeli przed budową dostępnej sieci na działce działa już legalnie wykonana przydomowa oczyszczalnia spełniająca wymagania odrębnych przepisów, art. 5 ust. 1 pkt 2 zwalnia nieruchomość z obowiązku późniejszego przyłączenia. Przy szczelnym szambie zmiana planu 05029z przewiduje po wykonaniu sieci likwidację zbiornika i podłączenie budynku. <a href="https://eli.gov.pl/api/acts/DU/2025/733/text/U/D20250733Lj.pdf">Ustawa o utrzymaniu czystości i porządku w gminach</a> · <a href="https://bip.zukowo.pl/api/files/108360">Uchwała IV/52/2006, § 1 ust. 2</a>.</p>
<p><strong>Budowa nowej oczyszczalni na /193.</strong> Plan przewiduje docelową kanalizację komunalną i przejściowo dopuszcza szczelne szambo. Przed wyborem oczyszczalni trzeba ustalić z operatorem, czy działkę można już przyłączyć, i potwierdzić warunki gruntowo-wodne dla rozsączu. Oczyszczalnię pokazano warunkowo. <a href="https://orzeczenia.nsa.gov.pl/doc/183FB7753A">Wyrok NSA II OSK 628/25 dotyczący zakresu ustaleń MPZP w innej gminie</a>.</p>
''' + table(['Element', 'Wymiary i założenia modelu'], [
    ['Zbiornik Kingspan BioDisc BA', 'Złoże obrotowe, 6 RLM, do 1,2 m³/d. Wariant katalogowy z wlotem 0,75 m i nadstawką GRP 0,20 m. Średnica wynosi 1,995 m, wysokość łączna 2,66 m, a zagłębienie wlotu 0,95 m. Dno zbiornika leży 2,35 m pod terenem.'],
    ['Pole tuneli MPI DrainTunel 150', 'Dwa rzędy po pięć modułów długości 1,20 m. Przerwa 1,00 m między rzędami. Obrys z deklami około 6,09 × 2,00 m.'],
    ['Położenie oczyszczalni', 'Cały zbiornik leży co najmniej 5,17 m za linią tylnej elewacji salonu i 3,75 m za linią końca tarasu, patrząc od bramy wjazdowej. Najkrótsze odległości od płaszcza wynoszą 5,43 m do domu, 4,08 m do tarasu, 5,00 m do granicy i 3,15 m do pnia drzewa. Od krawędzi pola tuneli do domu jest 9,55 m, do tarasu 8,13 m, do granicy 4,34 m, do podjazdu 27,68 m i do najbliższego pnia 3,14 m.'],
    ['Dostęp do zbiornika', 'Od lewego brzegu podjazdu wzdłuż garażu prowadzi pas wolny od krzewów o szerokości 0,90 m. Jego oś ma 26,88 m do brzegu pokrywy i 27,88 m do środka zbiornika. Wokół zbiornika przewidziano co najmniej 1,00 m wolnej przestrzeni do serwisu. Przed zamówieniem wywozu osadu trzeba potwierdzić u wykonawcy miejsce postoju pojazdu i zasięg węża.'],
    ['Dopływ do tuneli', 'Ścieki odpływają przez tylną ścianę domu przewodem DN110 długości 21,43 m. Przy spadku 2% dno przewodu obniża się z −0,521 m przy domu do −0,950 m przy wlocie do BioDisc. Tuż za ścianą górę przewodu osłania około 0,41 m gruntu. Przy adaptacji należy sprawdzić potrzebę izolacji przed przemarzaniem i przewidzieć rewizje do czyszczenia na załamaniach trasy. Ścieki oczyszczone płyną do studzienki kolejnym odcinkiem o długości 8,56 m i spadku 1%, od −1,035 do −1,121 m. Studzienka zasila dwa rzędy tuneli odnogami ze spadkiem 2%. Dna obu wlotów są na rzędnej −1,161 m.'],
]) + '''<p>Dobór dziesięciu tuneli zakłada pięć osób i dobrze przepuszczalny grunt. Góra tuneli leży 0,99 m pod terenem, z 21 cm zapasu względem dopuszczalnego przez MPI przykrycia 1,20 m. Archiwalny model terenu na narożnikach pola wskazuje od 156,287 do 156,336 m n.p.m. Przed budową potrzebna jest niwelacja i sprawdzenie przykrycia na obu końcach każdej nitki. Podstawy leżą 1,35 m pod terenem, na warstwie kruszywa grubości 0,11 m. Przyjmując spód kruszywa za miejsce wprowadzania ścieków, wymagane 1,50 m warstwy gruntu oznacza najwyższy użytkowy poziom wodonośny na głębokości co najmniej 2,96 m. Jego położenie i przepuszczalność gruntu wymagają badań.</p>
<p>Projektant powinien potwierdzić rzędne odpływu z domu oraz sprawdzić lokalizację studni także na sąsiednich działkach. Przy wymaganym biologicznym oczyszczeniu ścieków rozporządzenie przewiduje co najmniej 30 m od osi studni dostarczającej wodę przeznaczoną do spożycia do najbliższego przewodu rozsączającego. <a href="https://eli.gov.pl/api/acts/DU/2019/1311/text.html">Warunki wprowadzania ścieków do ziemi, § 11 ust. 4–5</a> · <a href="https://eli.gov.pl/api/acts/DU/2022/1225/text.html">Warunki techniczne, § 31 ust. 1 pkt 4</a>.</p>
<p><a href="https://waterandsafestorage.kingspan.com/pl/p/biodisc-domowa-oczyszczalnia-sciekow/">Dane Kingspan BioDisc</a> · <a href="https://www.klar-environment.com/pdf/PD0094-24BA-BB_Installation_Guidelines.pdf">Instrukcja montażu Kingspan, pkt 1.3.6 i 1.3.9</a> · <a href="https://mpi.com.pl/wp-content/uploads/2023/03/Instrukcja-montazu-tunele-rozsaczajace-Draintunel-150-l.pdf#page=4">Wytyczne doboru tuneli MPI</a></p>''')
content += table(['Układ', 'Rozwiązanie koncepcyjne'], [
    ['Ethernet', 'Siedem oddzielnych przewodów kat. 6 do panelu krosowego i switcha w kotłowni. Porty 1–3: salon przy szafce RTV, bawialnia i gabinet. Porty 4–6: pokój 1, pokój 2 i sypialnia. Port 7: zakończenie w szczelnej puszce na połaci pod przyszłą antenę PoE. Port 8 łączy switch z routerem. Dla anteny należy dobrać zasilanie PoE do urządzenia i przewidzieć ochronę przepięciową oraz koordynację z instalacją odgromową.'],
    ['Zmywarka do zabudowy', 'Moduł 60 cm obok szafki zlewu, po stronie lodówki. Kliknięcie frontu odsłania kosze. Dopływ zimnej wody z zaworem, wąż odpływowy z wysoką pętlą i przyłączem do syfonu oraz gniazdo 230 V w sąsiedniej szafce są pokazane w odpowiednich warstwach.'],
    ['Ogrzewanie podłogowe', 'Na parterze jest 17 pętli, a na poddaszu 13. Rozstaw w trzech łazienkach wynosi do 12 cm. Pętle obejmują także powierzchnię pod szafkami, wyspą i wyposażeniem łazienek oraz posadzkę pod schodami na parterze. Położenie kotew schodów, stelaży, odpływów i dylatacji wymaga koordynacji przed wykonaniem wylewki. Modelowe długości pętli z dojściami do rozdzielaczy to ok. 1071 m na parterze i 889 m na poddaszu. Najdłuższa pętla ma ok. 89 m. Projekt wykonawczy wymaga obliczenia strat ciepła, mocy i oporów hydraulicznych dla poszczególnych obiegów.'],
    ['Pompa ciepła', 'Zasilanie i powrót od monobloku biegną nisko, z podejściami do króćców jednostek. Odcinek na zewnątrz wymaga izolacji i ochrony przed zamarzaniem zgodnej z instrukcją urządzenia.'],
    ['Instalacja wodna i kanalizacyjna', 'Zimna i ciepła woda do punktów poboru. Osobny powrót cyrkulacji CWU biegnie z obu kondygnacji do zasobnika przez pompę. W pralni są dwa przyłącza odpływowe, dla pralki i dla skroplin z suszarki. Otwarta wywiewka kanalizacyjna wystaje 0,62 m ponad połać przy kalenicy. Rura przechodzi przez otwór w dachu, a kołnierz uszczelnia przejście. Dno przewodu przy przejściu przez tylną ścianę domu leży na rzędnej −0,521 m.'],
    ['Rynny i rewizje przy cokole', 'Otwarte koryta są zagłębione w krawędzi dachu, w obrysie elewacji. Dwa kosze odprowadzają wodę do wewnętrznych narożników, a koryta mają spadek 3 mm/m do czterech wpustów. Piony o przekroju 70 × 80 mm biegną za elewacją. Przy każdym pionie zdejmowane drzwiczki w cokole odsłaniają korek czyszczaka.'],
    ['Zbiornik deszczówki', 'Po stronie północno-wschodniej znajduje się zakryty zbiornik o pojemności użytkowej 6 m³ i obrysie 2,00 × 2,90 m. Od jego ściany do domu jest 1,36 m, do tarasu 0,50 m, a do granicy 0,70 m. Woda z czterech pionów trafia przez filtr do zbiornika. Przelew grawitacyjny zasila osobne pole deszczowe.'],
    ['Rozsącz i dojścia', '22 skrzynki GRAF EcoBloc Inspect 420 w jednej warstwie tworzą literę L. Pole ma 8,00 m długości i 0,80 m szerokości, z poszerzeniem do 3,20 m. Powierzchnia dna wynosi 14,08 m², a pojemność netto 8,91 m³. Do filtra, włazu zbiornika i rewizji prowadzą dojścia szerokości 0,90 m. W rabacie przy płocie umieszczono inspekcję dolnego kanału i niskie odpowietrzenie.'],
    ['Odstępy pola deszczowego', 'Od skraju skrzynek do ogrodzenia strefy wspólnej jest 1,01 m, do granicy działki sąsiada 2,01 m, do domu 3,19 m, a do najbliższego pnia 4,96 m. Około 3,83 m² skrzynek leży pod ścieżką pieszą. Pola wody deszczowej i ścieków dzieli 8,10 m. Za tarasem przewód ścieków bytowych przechodzi nad deszczówką. Minimalny prześwit między ściankami rur wynosi 0,15 m. Projektant powinien dobrać zabezpieczenie skrzyżowania.'],
    ['Posadowienie skrzynek', 'Dno skrzynek leży 1,67 m pod terenem. Z podsypką 0,10 m głębokość wykopu wynosi 1,77 m. GRAF przewiduje odległość od budynku co najmniej 1,5 × głębokość wykopu, od pni co najmniej docelową średnicę korony i minimum 1 m gruntu do średniego najwyższego spodziewanego poziomu wód gruntowych. Dla tej lokalizacji oznacza to co najmniej 2,77 m pod terenem.'],
    ['Kolejność robót', 'Wąskie ramię pola przebiega 0,36 m od tarasu. Instrukcja GRAF przewiduje około 1 m przestrzeni roboczej wokół skrzynek. Wykop zaplanowano przed budową tarasu. Wspólny przekrój wykopów, posadowienie zbiornika przy fundamentach i ogrodzeniu oraz zabezpieczenie sąsiednich instalacji wymagają opracowania przez projektanta.'],
    ['Założenia retencji', 'Dla 206,3 m² rzutu dachu, opadu 30 mm i współczynnika spływu 0,90 dopływ wynosi ok. 5,57 m³. Dostępna retencja zależy od napełnienia zbiornika. Przed realizacją trzeba sprawdzić przepustowość wpustów dla deszczu miarodajnego oraz potwierdzić badaniami tempo infiltracji, poziomy i kierunek przepływu wód w gruncie, również w stronę sąsiada.'],
]) + '<p><a href="https://galeco.pl/produkty/systemy-rynnowe/system-rynnowy-galeco-bezokapowy/">System bezokapowy Galeco</a> · <a href="https://www.graf.info/fileadmin/Files_All_General/Documents/Dimension_drawing/EBA_Ecobloc_Inspect_420.pdf#page=24">Instrukcja GRAF EcoBloc Inspect 420, pkt 5–7</a></p>'
content += section('Samochody w skali', table(['Pojazd / miejsce', 'Długość × szerokość × wysokość (m)'], [
    [c['id']+' · '+c['location'].replace('driveway-','podjazd /').replace('road-133','droga /133'),
     dimensions([c['measuredLength'],c['measuredWidth'],c['measuredHeight']])] for c in registry['cars']]))
solar = registry['solarSimulation']
content += section('Symulacja słońca i mapy', '<p>Pozycja słońca dla wybranej daty i godziny lokalnej. Cienie zależą od geometrii modelu; teren pozostaje płaski. Ortofotomapa zawiera własne, utrwalone cienie. Warstwa NMT pokazuje wysokości barwami i nie zmienia poziomu budynków.</p>' + table(
    ['Parametr', 'Wartość'], [
        ['Szerokość / długość geograficzna (°)', number(solar['latitude'])+' / '+number(solar['longitude'])],
        ['Strefa czasowa', solar['timeZone']+' — automatyczny czas letni i zimowy'],
        ['Zbieżność południków EPSG:2177', number(solar['gridConvergenceDeg'])+'°'],
        ['Algorytm', solar['algorithm']],
        ['Początkowa data i godzina', solar['defaultLocalDateTime']],
        ['Tempo odtwarzania', '1 godzina / 3 sekundy, regulacja 1–15 sekund na godzinę'],
        ['Sterowanie', 'Suwaki dnia roku i godziny; play/pause w panelu i przy dolnym zegarze; aktywacja wyłącza podkład'],
        ['Widoczne słońce', 'Tarcza wizualnie powiększona 2× do 1,06°; kierunek astronomiczny bez zmian; ciepłe barwy przy horyzoncie'],
        ['Kolory nieba i światła', 'Poglądowy model czystego nieba i zmierzchu, bez prognozy pogody'],
        ['Promień mapy wody i prądu', '150 m od rzeczywistego wspólnego wierzchołka działek'],
        ['Siatka NMT / układ wysokości', '1 m / PL-EVRF2007-NH'],
        ['Ortofotomapa', '360 × 360 m; indeks 2024 w centrum, dokładna data nalotu nieznana']]) + '<p><a href="map-sources.json">Pełne źródła map, współrzędne i parametry eksportu</a></p>')
content += section('Spacer i widoczność', table(['Parametr', 'Wartość'], [
    ['Wysokość oczu', number(registry['navigation']['walkEyeHeightM'])+' m'],
    ['Promień kolizji', number(registry['navigation']['walkCollisionRadiusM'])+' m'],
    ['Prędkość chodu / sprintu', number(registry['navigation']['walkSpeedMPerSecond'])+' / '+number(registry['navigation']['sprintSpeedMPerSecond'])+' m/s'],
    ['Skok — maksymalne podniesienie oczu', number(registry['navigation']['jumpApexM'])+' m ponad poziom 1,70 m'],
    ['Przeszkody', 'Domy /191 i /41 oraz ściany wnętrz /190 i /193; przejścia drzwiowe i schody obu wnętrz dostępne. Przez płoty można przechodzić'],
    ['Cienie płotu', 'Ciągły panel odpowiadający przebiegowi płotu, bez cieni pojedynczych desek'],
    ['Regulacja cieni', '0–100%; daty przesileń i równonocy dla wybranego roku, przybliżone']]))
if 'interior' in registry:
    interior = registry['interior']
    vestibule = interior['entranceWardrobe']
    office = interior['officeStorage']
    glazing = interior['gardenGlazing']['lowerOpening']
    model = json.loads((SOURCE.parent / 'interior-data.json').read_text())
    finishes = model['metadata']['finishSchedule']
    furniture = {item['id']: item for item in model['furniture']}
    desks = [item for item in furniture.values() if item['room'] == '0.9' and item['type'] == 'table']
    desk_sizes = [dimensions([d['box'][2] - d['box'][0], d['box'][3] - d['box'][1]]) + ' m na wysokości ' + number(d['worktopHeightM'] * 100) + ' cm' for d in desks]
    bed = furniture['guest-sofa-bed']
    unfolded = bed['unfoldedBox']
    content += section('Wnętrze Stodoła Icon /193', '<p>Odtworzenie z publicznych rzutów i przekroju; położenia ścian i otworów są przybliżone. Pozycje i orientacje mebli porównano z rzutami; wymiary symboli są przybliżone i zapisane w danych. Pokój przy antresoli oddziela pełna ściana. Salon zachowuje pustkę do dachu.</p>' + table(['Element', 'Wartość'], [
        ['Podłoga poddasza', '3,20 m'], ['Sufit parteru', '2,80 m'], ['Schody', '18 podniesień po 3,20/18 m; szerokość biegu 0,90 m; stopnica 0,26 m'],
        ['Wiatrołap z garderobą', f"{number(vestibule['catalogueAreaM2'])} m² według rzutu, obrys L w prostokącie {dimensions(vestibule['outerSizeM'])} m"],
        ['Zabudowa od strony gabinetu', f"{office['numberOfModules']} moduły, długość {number(office['cabinetRunM'])} m, głębokość {number(office['cabinetDepthM'])} m"],
        ['Biurka w gabinecie', finishes['officeDeskFinish'] + ' ' + ' oraz '.join(desk_sizes)],
        ['Wykończenia fornirowane', finishes['veneerDescription']],
        ['Sofa w bawialni po rozłożeniu', dimensions([unfolded[3] - unfolded[1], unfolded[2] - unfolded[0]]) + ' m wraz z ramą. Powierzchnia spania ' + dimensions(bed['sleepingSurface']) + ' m (założenie modelu)'],
        ['Dolne okno salonu od ogrodu', f"{glazing['panels']} równe pola, otwór {dimensions([glazing['widthM'], glazing['heightM']])} m"],
        ['Krzesła przy stole', '6 sztuk, po 3 przy długich bokach; odstęp siedziska od blatu 0,06 m'], ['Dane i źródła', 'interior-data.json']]) + '<p><a href="interior-data.json">Pobierz współrzędne, wymiary i założenia wnętrza</a></p>')
    points = model['electrical']['points']
    content += section('Detale wnętrza /193', table(['Element', 'Wymiar w modelu'], [
        [label, dimensions([furniture[key]['box'][2] - furniture[key]['box'][0],
                            furniture[key]['box'][3] - furniture[key]['box'][1], furniture[key]['height']]) + ' m']
        for key, label in [('entry-console', 'Konsola w wiatrołapie'), ('entry-pouf', 'Puf w wiatrołapie'),
                           ('office-bookcase', 'Zabudowa w gabinecie'),
                           ('office-pug-bed', 'Legowisko w gabinecie'), ('master-pug-bed', 'Legowisko w sypialni')]
    ] + [['Osprzęt JLM Loft', f"{sum(p['type'] == 'switch' for p in points)} łączników i {sum(p['type'] != 'switch' for p in points)} gniazd. Okrągła ramka o średnicy {number(model['electrical']['frameDiameterM'] * 1000)} mm."],
         ['Położenie osprzętu', 'Wysokości i pozycje w modelu są propozycją aranżacyjną. Zestawienie punktów znajduje się w danych wnętrza.']]))
    if 'projection' in interior:
        screen, bays = interior['projection'], interior['garageBays']
        content += section('Wyposażenie domu /193', table(['Element', 'Wymiar w modelu'], [
            ['Obraz na białej ścianie malowanej farbą projekcyjną', dimensions([screen['widthM'], screen['heightM']]) + ' m (' + number(screen['diagonalInches']) + '″)'],
            ['Stanowiska w garażu', str(bays['count']) + ' stanowiska po ' + dimensions([bays['widthM'], bays['lengthM']]) + ' m. W trybie spaceru można przejść przez oba auta.'],
            *[[car['model'] + ' · ' + car['paint'], dimensions([car['length'], car['bodyWidth'], car['height']]) + ' m. Szerokość z lusterkami ' + number(car['mirrorWidth']) + ' m.'] for car in model['garageFitout']['vehicles']],
            ['Drzwi przechodnie w spacerze', 'Szklane skrzydło wiatrołapu i ukryty front kuchenny']]))
if 'florydaInterior' in registry:
    content += section('Wnętrze Willa Floryda 6 /190', '<p>Ściany, otwory i wyposażenie odtworzono z rzutów MG Projekt. Wysokości pochodzą z przekroju; położenia ścian i mebli odczytane z rastra są przybliżone. Dom, wnętrze i przeszklenia odbito lewo–prawo względem wersji 2026-11-19.18. Środek rezerwy pozostał na miejscu.</p>' + table(['Element', 'Wartość'], [
        ['Podłoga piętra', '3,35 m'], ['Wysokość parteru / piętra', '3,00 / 2,70 m'],
        ['Schody', '12 + 6 podniesień; spocznik +2,23 m; stopnica 0,27 m'], ['Sterowanie', 'Widoki i sterowanie → Wnętrze /190']]) + '<p><a href="floryda-interior-data.json">Współrzędne, wymiary, meble i źródła /190</a></p>')
if 'roofWindows' in registry:
    content += section('Przeszklenie salonu i okna dachowe', '<p>Górne przeszklenie /193 cofnięto o 1,10 m do dolnych szyb, zachowując jego kształt i zewnętrzny obrys szczytu. Pas między szybami jest płaski: lico na wspólnej płaszczyźnie szyb, grubość 0,12 m za nią, wysokość 2,35–3,20 m. Krawędź stropu jest schowana 0,18 m wewnątrz ściany, aby nie pokrywała się z elewacją. Wycięcia przechodzą przez pokrycie dachu i wewnętrzną okładzinę /193; szyby przepuszczają bezpośrednie światło, ramy rzucają cień.</p>' + table(['Okno', 'Działka', 'Szerokość × długość po połaci (m)'], [[w['id'], '/'+w['parcel'], number(w['widthM'])+' × '+number(w['heightM'])] for w in registry['roofWindows']['openings']]) + '<p>Na /193 numery okien odpowiadają pomieszczeniom na rzucie poddasza. W pokoju 1.3 są trzy okna w rzędzie. Połać nad salonem jest pełna. Wymiary szyb i ich środki to przybliżenia modelowe.</p>')
content += section('Ludzie i psy w skali', table(['Osoba', 'Wzrost (m)'], [
    [p['id'], number(p['heightM'])] for p in registry['people']]) + table(
    ['Pies / działka', 'Wysokość w kłębie (m)', 'Długość samego tułowia (m)'], [
        [f"{d['breed']} · /{d['parcel']}", number(d['shoulderHeightM']), number(d['torsoLengthM'])] for d in registry['dogs']]))
content += section('Nasadzenia — wartości nominalne koncepcji', table(['Drzewo', 'Wysokość nominalna (m)', 'Promień korony (m)'], [
    [t['id'], number(t['height']), number(t['crownRadius'])] for t in registry['trees']]))
content += section('Odsunięcia projektowanych domów /190, /191 i /193', table(['Granica', 'Odległość (m)'], [
    ['Droga', number(registry['clearances']['roadM'])],
    ['Pozostałe granice — przyjęte założenie', number(registry['clearances']['otherBoundariesAssumedM'])],
    ['/190 od drogi po stronie północno-wschodniej — rezerwa', number(registry['placementPins']['190']['northeastPlacement']['activeSetbacks'][0]['actualM'])],
    ['/190 od ukośnej krawędzi drogi — rezerwa', number(registry['placementPins']['190']['northeastPlacement']['activeSetbacks'][1]['actualM'])],
    ['/190 — maksymalne dalsze przesunięcie środka ku NE', number(registry['placementPins']['190']['northeastPlacement']['maximumTranslationM'])],
    ['/191 od SE — wymagane minimum', number(registry['clearances']['parcel191SoutheastM'])],
    ['/191 od SE — rzeczywiste minimum w modelu', number(registry['clearances']['actualParcel191SoutheastM'])],
    ['/191 od NW — rzeczywiste odsunięcie w modelu', number(registry['clearances']['parcel191NorthwestM'])]]))
surroundings = registry['surroundingVegetation']
content += section('Otaczające pola i drzewa przy /41', '<p>Pozycje drzew i granice pól oszacowano z ortofotomapy. Trzy drzewa przy domu /41 tworzą ciaśniejszą grupę; pnie ukryte pod połączonymi koronami nie są widoczne, więc ich położenie pozostaje założeniem. Wysokości drzew przyjęto według wskazania użytkownika; nie są pomiarem. Zboże jest scenariuszem wizualnym.</p>' + table(
    ['Drzewo', 'Wysokość (m)', 'Promień korony (m)', 'Środek X / Y modelu (m)'], [
        [t['id'], number(t['height']), number(t['crownRadius']), ' / '.join(number(v) for v in t['center'])]
        for t in surroundings['trees']]) + '<p>Zboże: wysokość 0,8–1 m; rośliny instancjonowane w kępach. Drogi, zabudowa i zaprojektowane ogrody wyłączone z pól.</p>')
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
