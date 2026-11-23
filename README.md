# Trójstyk — edytor ogrodu

**[Otwórz edytor](https://patrykmilewski.github.io/trojstyk-ogrod/)** · **[Model 3D trzech domów](https://patrykmilewski.github.io/trojstyk-ogrod/trzy-domy-3d/)**

Interaktywny rzut wspólnej przestrzeni działek 775/193, 775/190 i 775/191 w Chwaszczynie. Każdy może przygotować własny wariant na tym podkładzie.

- Przeciąganie wyposażenia, obrót i zmiana wymiarów; sauna z podestem oraz balia z podbudową jako zestawy. Podest ma niezależnie regulowaną szerokość od ściany i długość wzdłuż ściany, jest wyśrodkowany przy saunie.
- Edycja płotu: najedź i kliknij „+”, następnie przeciągnij punkt.
- Furtki i bramy o regulowanej szerokości.
- Każdy z czterech narożników piasku może być zaokrąglony albo kanciasty; ustawienia zapisują się w JSON-ie.
- Piasek przesuwa urządzenia stojące na nim; poszczególne urządzenia można przesuwać osobno.
- Wirtualny chodnik łączący furtki z przeciąganym skrzyżowaniem i uchwytami łuków.
- Bilans powierzchni działek na żywo, osobne pole chodnika oraz przełącznik wymiarów elementów.
- Ludzie jako ilustracje przypisane do wyposażenia, bez wpływu na powierzchnie.
- Cofanie, ponawianie, zapis i odczyt JSON oraz eksport SVG.

## Własny układ

Zmiany zapisują się automatycznie **tylko w lokalnej pamięci przeglądarki**. Nie zmieniają strony ani układów innych osób. Przycisk „Zapisz układ” pobiera JSON — można przesłać go komuś i użyć „Wczytaj”. Nie jest to edycja współdzielona w czasie rzeczywistym. Wyczyszczenie danych przeglądarki usuwa zapis lokalny, dlatego warto pobierać kopie JSON.

Domyślny wariant pochodzi z pliku `moj-ogrod (1).json`. „Przywróć układ startowy” przywraca ten wariant. Podkład działek jest stały; konfigurator nie pobiera innych działek po adresie.

Spacja + przeciągnięcie przesuwa widok, kółko myszy zmienia przybliżenie. R / Shift+R obraca wybrany element o 15°. Przycisk „Wymiary elementów” pokazuje rozmiary na mapie i w tabeli, osobno dla sauny i podestu.

## Uruchomienie i budowanie

Wymagania: Node.js z npm oraz Python 3.

```sh
npm ci
npm run check
npm run build
python3 -m http.server 8000
```

Otwórz http://localhost:8000. Gotowy `index.html` jest samodzielny i działa też offline. Kod, style i dane źródłowe są w `src/`, składanie HTML w `scripts/build.py`. Po zmianach źródeł przebuduj i zatwierdź także `index.html`.

GitHub Pages publikuje pliki z katalogu głównego gałęzi `main`. Nie wymaga serwera aplikacyjnego, kont użytkowników ani kluczy API.

### Aktualna wersja modelu 3D

Kolejne zmiany modelu wprowadzaj w `trzy-domy-3d/` i jego źródłach na podstawie bieżącej gałęzi `main`. Tag `checkpoint/193-przed-odbiciem` wskazuje opublikowany stan całego repozytorium sprzed odbicia domu /193. Ten tag służy do odtworzenia lub porównania wcześniejszej wersji.

## Geometria i ograniczenia

Granice ULDK z 11.11.2026, obliczenia w metrach na lokalnym układzie opartym na EPSG:2177. Domy ustawione orientacyjnie. To koncepcja, nie pomiar geodezyjny ani projekt wykonawczy. Ostrzeżenia pomagają wykryć nakładanie obiektów i wyjście poza płot, ale nie potwierdzają zgodności budowlanej ani wymaganych stref bezpieczeństwa.

Chodnik jest wirtualną rezerwą, liczoną osobno od zagospodarowania. Nakładające się powierzchnie wyposażenia są liczone raz. „Wolne” nie jest równoznaczne z powierzchnią biologicznie czynną.

Biblioteka `polygon-clipping` oraz zależności mają informacje licencyjne dołączone na końcu wygenerowanego HTML.

## Model 3D działek

Osobna podstrona `trzy-domy-3d/index.html` przedstawia trzy domy, prywatne ogrody i wspólny trójstyk. Obrót lewym przyciskiem myszy; dwa palce na touchpadzie lub kółko przesuwają widok. Szczypnięcie, Ctrl+kółko i przyciski ＋/− przybliżają. Przesuwanie działa też prawym przyciskiem i dwoma palcami na ekranie dotykowym. Przyciski przybliżają wybraną działkę, wspólną strefę lub psy.

Model zachowuje metryczną geometrię i gabaryty katalogowe. Dachy, stolarka, wyposażenie i zieleń są koncepcją; teren przyjęto płaski. Sauna ma rzut 3 × 2,4 m i czerwony dach 45° bez okapu; trampolina jest na poziomie gruntu. Sauna ma oddzielne drzwi i okno, a trzy furtki wspólnego ogrodu mają światło 1,2 m i są uchylone o 20°. Nad stołem na /193 jest pergola ze zsuwaną tkaniną. Przełącznik przy słupie pozwala odsłonić taras lub rozwinąć osłonę. Podziały przeszkleń mają przestrzenne ciemne ramy. Okna dachowe /191 powiększono poglądowo do 94 × 140 cm (wymiar po połaci). Golden retriever jest na /190, mops na /193, a każda działka ma co najmniej dwie osoby w skali.

Podstrona jest samodzielna, działa offline i nie korzysta z zapisów lokalnych konfiguratora. Three.js r186 i OrbitControls (MIT) oraz dane modelu są osadzone w HTML; informacje licencyjne pozostają w dołączonym kodzie bibliotek. Zwykły build edytora nie nadpisuje tej podstrony.

Obrysy rabat z drzewami i krzewami, współrzędne nowych drzew i bilans każdej działki zawiera [plan nasadzeń](trzy-domy-3d/woodland-plan.json). Te same obrysy są osadzone w scenie i na rzucie. Kontrola `npm run check` oblicza ich sumę geometryczną w granicach każdej działki i sprawdza próg 30%. Generator korzysta z metrycznych danych aktualnego modelu i biblioteki Shapely 2.

```sh
python3 scripts/woodland_plan.py --model trzy-domy-3d/index.html --output trzy-domy-3d/woodland-plan.json
```

### Stały rejestr wymiarów

[Czytelna tabela wymiarów](https://patrykmilewski.github.io/trojstyk-ogrod/trzy-domy-3d/wymiary.html) powstaje wyłącznie z pliku [`trzy-domy-3d/model-dimensions.json`](trzy-domy-3d/model-dimensions.json). Ten plik przechowuje gabaryty trzech domów, 23 obiektów wyposażenia, detale, odsunięcia, drzewa, ludzi i psy. Rozróżnia gabaryt katalogowy, nominalny rzut i zmierzoną obwiednię wierzchołków modelu, która uwzględnia wystające detale. Część wymiarów jest założeniem koncepcji, co wskazano przy danych.

`npm run check` porównuje model z rejestrem i uruchamia testy wykrywania zmian. Odciski SHA-256 obejmują dane sceny (również ustawienie i granice) oraz kod proceduralnej geometrii. Zmiana wymiaru, skali lub ustawienia powoduje błąd kontroli; odcisk kodu jest celowo czuły także na jego inne zmiany. Sam tekst interfejsu można zmienić bez naruszenia blokady. GitHub Actions wykonuje tę kontrolę po pushu i w pull requestach; jest ona niezależna od mechanizmu wdrożenia Pages.

Rejestru **nie regeneruje się automatycznie**. Przy uzgodnionej zmianie należy porównać geometrię z poprzednią wersją, zmierzyć ją ponownie, zaktualizować odpowiednie liczby i odciski oraz zwiększyć `modelVersion`. Sama aktualizacja odcisku bez przeglądu wymiarów nie jest weryfikacją. `npm run build` odświeża tabelę, lecz nie zmienia rejestru ani modelu 3D.

### Kontekst i ustawienie — wersja 2026-11-16.3

Oba domy /190 i /191 odbito względem ich rzeczywistego ustawienia w modelu 2026-11-16.2, zachowując skalę i fronty garażowe przy tych samych drogach. /191 przesunięto do północno-zachodniego limitu: środek domu około 3,320441 m na zachód i 3,084201 m na północ siatki EPSG:2177. Obecne odsunięcia: 5 m od drogi, 4 m od NW i minimum 13,598287 m od SE, przy wymaganym minimum 10,5 m. /190 pozostaje na skrajnym północnym położeniu; odbicie zmienia stronę garażu. Oba ustawienia maksymalizują północ siatki w przyjętych ograniczeniach i są najwyżej 1 cm od skrajnej górnej współrzędnej schematu. Taras /191 pozostaje w całości. Rejestr zawiera macierze poprzednie, nowe i względne odbicia.

Dodano osiem samochodów: po dwa na podjazdach /190, /191, /193 i dwa na /133. Wymiary typów w `vehicleTypes` rejestru są używane przy rozmieszczaniu i rysowaniu pojazdów. Obrysy pojazdów są sprawdzane względem nawierzchni; modele nie zmieniają skali domów ani ogrodu.

Dodano pustą /192, /41 oraz pełny urzędowy wielokąt drogi /133 bez bufora i poszerzania. Przycisk „Droga /133” obejmuje całą drogę; pozostałe przyciski pokazują szczegóły. Jest to granica działki drogowej, nie obrys utwardzonej jezdni.

Budynek /41 ma źródłowy ośmiowierzchołkowy obrys EGiB Starosty Kartuskiego `220508_5.0004.2159_BUD`, 104,3313 m². Usługa nie podała wysokości ani liczby kondygnacji. Przyjęto uzgodnione parter i piętro po 2,6 m: ściany 5,2 m, attyka 5,5 m, kominy 6,05 m. Elewacja, balkony i otwory są poglądowe według zdjęć. Rejestr zawiera źródłowe współrzędne, adresy usług, długości boków i jawne założenia. Precyzja współrzędnych 0,01 m nie potwierdza dokładności pomiaru terenowego.

[Rzut kontrolny SVG](https://patrykmilewski.github.io/trojstyk-ogrod/trzy-domy-3d/plan-kontrolny.svg) pokazuje działki, obrysy budynków, przyjęte odsunięcia i osobny podgląd całej drogi. Odcisk pliku planu również podlega kontroli.

## Słońce i podkłady Geoportalu (2026-11-16.5)

Przycisk **Słońce i mapy** otwiera datę i godzinę Europe/Warsaw, podkład ortofoto lub wysokości NMT, oraz niezależne warstwy wody i prądu. Zegar nie zależy od strefy przeglądarki. Obliczenia NOAA/Meeus sprawdzono z sześcioma niezależnymi pozycjami NREL SPA; uwzględniono zbieżność południków EPSG:2177. Nocą wyłącza się bezpośrednie światło słońca, lecz pozostaje oświetlenie podglądu. Teren jest płaski, przeszkody spoza modelu i refrakcja pominięte.

Ortofotomapa GUGiK ma prawidłową georeferencję EPSG:2177 i obszar 360 × 360 m. Indeks wskazuje 2024 w centrum; dokładna data nalotu nie jest dostępna. Cienie zdjęcia są stałe. NMT WCS ma siatkę 1 m i wysokości PL-EVRF2007-NH; kolory nie deformują budynków ani terenu. Woda i prąd są oryginalnym obrazem publicznego WMS Starosty Kartuskiego, przyciętym do 150 m od rzeczywistego styku działek. Brak linii nie potwierdza braku sieci. Warstwy nie określają głębokości, przepustowości ani możliwości przyłączenia. Szczegóły i adresy zapytań zapisano w `trzy-domy-3d/map-sources.json`.

Na każdym podjeździe pozostał jeden samochód, na drodze dwa. Ściana /41 zwrócona ku /191 ma tylko lewe górne okno. Wymiary domów i wyposażenia oraz ustawienie domów pozostają zgodne z wersją .3. Nowe moduły są w `src/model/`; HTML osadza ich kopie, a `npm run check` kontroluje ich zgodność, algorytm słońca i rejestr danych.

Tryb cieni automatycznie wybiera „Bez podkładu”. Suwaki dnia roku i godziny synchronizują się z datą i czasem. Odtwarzanie/Pauza przesuwa bezwzględny czas zgodnie z zegarem monotonicznym: domyślnie 1 h / 3 s, regulacja 1–15 s na godzinę. Obsługiwane są zmiany daty i DST; ukrycie karty zatrzymuje odtwarzanie. Obniżone oświetlenie rozproszone zwiększa kontrast cieni.

Media obejmują 150 m; linie mają graficzne pogrubienie i jasną obwódkę. Wodę odzyskano z urzędowego WMS EPSG:2180 i przeliczono do EPSG:2177, bez dopasowywania geometrii. Dokładne zapytania i ograniczenia zapisano w `map-sources.json`. Grubość grafiki nie oznacza średnicy przewodu.

Na otwartych polach rośnie modelowe zboże 0,8–1 m; maski wykluczają drogi i zabudowę. Pięć drzew przy /41 ma wysokości 11, 10,5, 10, 9 i 9 m oraz orientacyjne pozycje z ortofotomapy. Wymiary i założenia są w rejestrze, a geometria pól i pozycje drzew w `trzy-domy-3d/vegetation-data.json`.

## Układ wspólnego ogrodu 2026-11-16.6

Plik `moj-ogrod (1).json` zapisano bez zmian w `src/default-layout.json` i przeniesiono do modelu 3D z tym samym obrysem, wyposażeniem, częściami zestawów, furtkami i chodnikiem. Powierzchnia wspólna wynosi 156,189 m². Zachowano ostrzeżenie o piasku poza płotem (około 0,233 m²); piasek nie jest przycinany. Dojścia prywatne połączono z nowymi pozycjami furtek, bez przesuwania domów. Zboże ma ciemniejszą, bardziej zieloną barwę.

Zapisane lokalnie układy odwiedzających pozostają zachowane. Aby zobaczyć nowy domyślny układ w dotychczas używanej przeglądarce, wybierz „Przywróć układ startowy”. Rejestr wymiarów kontroluje odcisk źródłowego pliku, aby konfigurator i model 3D nie rozchodziły się przy kolejnych aktualizacjach.


## Spacer, widok i cienie 2026-11-16.7

„Spacer · 1,7 m” przełącza na perspektywę z wysokości oczu 1,70 m. WASD lub strzałki poruszają obserwatorem, przeciągnięcie rozgląda, Esc kończy spacer. Na telefonie służą do tego cztery przyciski ruchu. Domy /190, /191, /193 i /41 blokują ruch; płoty i wyposażenie ogrodu są przenikalne. Promień kolizji wynosi 0,28 m, prędkość 2,2 m/s. Wyjście przywraca widok orbitalny.

Zakres głębokości kamery obejmuje scenę również po przybliżeniu do psa i późniejszym oddaleniu. Widoczne deski płotów nie rzucają oddzielnych cieni: odcinki płotu i otwarte furtki używają ciągłych paneli cienia. Suwak ciemności steruje intensywnością cieni w zakresie 0–100%. Daty przesileń i równonocy są obliczane w przybliżeniu dla wybranego roku, z zachowaniem wybranej godziny; „Dzisiaj” ustawia aktualny czas polski.

Trzy drzewa przy /41 przesunięto bliżej siebie i domu na podstawie połączonej korony widocznej na ortofotomapie. Pnie są ukryte, więc pozycje są reprezentatywnymi założeniami, nie pomiarem. Wysokości 11 / 10,5 / 10 / 9 / 9 m i geometria pól zostały zachowane. Czerwona strzałka N o szerokości trzonu 0,44 m leży w środku skrzyżowania działki drogowej /133. Usunięto etykietę bramy /191.


## Sterowanie i zegar 2026-11-16.8

Skróty działek, psów, trójstyku, spaceru i pozostałych widoków znajdują się w menu „Widoki i sterowanie”. „Słońce i mapy” oraz „Reset widoku” pozostają osobno. Po aktywacji słońca u dołu wyświetla się bieżąca godzina symulacji, również po zamknięciu panelu; status w panelu mówi tylko, czy słońce jest nad/pod horyzontem. Usunięto górny baner i pionową adnotację wysokości /193. Dokumenty „Wymiary” i „Rzut 2D” oraz dotychczasowy opis są w dwóch sekcjach „Informacje”.

Podczas spaceru Shift zwiększa prędkość z 2,2 do 4,84 m/s, a spacja rozpoczyna skok o wysokości 0,6 m. Po lądowaniu oczy wracają do 1,70 m. Przytrzymanie spacji nie powoduje kolejnych skoków, a skok w powietrzu jest zablokowany. Kolizje z domami pozostają aktywne podczas biegu i skoku. Na ekranach dotykowych dodano przyciski sprintu i skoku.


## Kompaktowy skrót spaceru 2026-11-16.9

Dolny panel spaceru zawiera wyłącznie tekst ze skrótami sterowania, bez przycisków ruchu, sprintu, skoku i wyjścia. Jest niski, nie przechwytuje kliknięć i zawija tekst na małych ekranach. Wyjście pozostaje pod Esc oraz w menu „Widoki i sterowanie”.

## Wnętrze Icon i sauna 2026-11-16.10

Menu „Widoki i sterowanie” zawiera wejście do wnętrza /193. Parter i poddasze odtworzono z rzutów oraz przekroju Stodoły Icon, z otwartymi przejściami, ścianami, meblami i schodami. Poziom poddasza to +3,20 m; salon zachowuje pustkę do dachu. Dane, źródła i przybliżenia są w `trzy-domy-3d/interior-data.json`, a ich hash w rejestrze wymiarów. To rekonstrukcja poglądowa rysunków rastrowych, nie dokumentacja wykonawcza.

Spacer uwzględnia wysokość podłogi, kolizje ze ścianami i nadprożami oraz schody w obie strony. Shift i spacja zachowują sprint i skok. Drzwi sauny przeniesiono na szczyt od podestu; okno ma 2 × 1,4 m. Zachowano gabaryty sauny oraz ustawienie i gabaryty domów.

## Spacer na telefonie 2026-11-17.1

Na małych ekranach oraz urządzeniach dotykowych dolny panel spaceru pokazuje przyciski „Przód” i „Tył”. Przytrzymanie uruchamia ruch, a puszczenie go zatrzymuje; drugim palcem można równocześnie rozglądać się po scenie. Na komputerze pozostaje kompaktowy tekst skrótów.

## Dwa dostępne wnętrza 2026-11-17.2

Menu „Widoki i sterowanie” umożliwia wejście do /190 i /193. Willa Floryda 6 ma odtworzony parter i piętro +3,35 m, z meblami, przejściami i schodami; wysokości pomieszczeń wynoszą 3,00 i 2,70 m. Zachowano obecne odbicie i ustawienie na działce.

Układ /193 porównano ponownie z rzutami wydawcy: poprawiono kierunki łóżek i sofy, szafy przy ścianach, wyposażenie kuchni i łazienek oraz pełną ścianę pokoju przy antresoli. Pozycje, gabaryty i kierunki mebli zapisano w plikach `trzy-domy-3d/interior-data.json` i `trzy-domy-3d/floryda-interior-data.json`, kontrolowanych odciskami w rejestrze. Rysunki rastrowe i symbole wyposażenia nie zapewniają dokładności wykonawczej; niepewności opisano w danych.

Spacer działa w obu budynkach, z kolizjami ścian i stropów; /191 i /41 pozostają zamknięte. Zachowano sprint, skok oraz przyciski Przód/Tył na telefonie.

## Poprawki wnętrz 2026-11-17.3

Usunięto nakładające się powierzchnie trawy, podłóg, blatów i ram okiennych; podkłady map mają otwory pod oboma dostępnymi wnętrzami. Zakres głębokości kamery spaceru dopasowuje się do sceny.

W /193 otwory drzwiowe są wycięte w rzeczywistej geometrii ścian, a ściany poddasza dochodzą do skosów. Przy stole jest sześć krzeseł, po trzy przy długich bokach, z odstępem siedziska od blatu 6 cm. Poprawiono ciągłość podłóg oraz podparcie i połączenia balustrad.

Niezależny przegląd /190 objął wszystkie 21 pomieszczeń i porównanie z rzutami oraz przekrojem MG Projekt. Schody skorygowano do 12 + 6 podniesień ze spocznikiem +2,23 m; poprawiono otwór w stropie, przejście do pomieszczenia pod schodami, ścianę garderoby, wyposażenie i kierunki mebli. Usunięto nieobecne w rzucie boczne okno kuchni. Geometria ścian pod schodami i symbole wyposażenia pozostają przybliżeniem rysunków źródłowych.

## Przeszklenia i światło 2026-11-17.4

Górne okno salonu /193 zachowuje cały kształt i podziały; jego szyby cofnięto o 1,10 m do płaszczyzny dolnego przeszklenia (lokalne y=16,85 m). Usunięto błędne trójkąty ściany powstające przy wierzchołku obrysu i domknięto wnękę, pozostawiając zewnętrzny szczyt w dawnym miejscu.

Dom /193 ma osiem okien dachowych według lustrzanego rzutu poddasza. Jedno przypada na pokój 1.1, trzy na pokój 1.3 i po jednym na obie łazienki, garderobę i pralnię. Nad salonem połać jest pełna. Otwory w pokryciu i okładzinie przepuszczają bezpośrednie światło. Rejestr podaje lokalne środki i przyjęte wymiary szyb. Układ sześciu okien domu /191 pozostaje zgodny z jego modelem.

## Elewacja i płaski pas między szybami 2026-11-17.5

Usunięto zewnętrzne powierzchnie zamykające ściany na wypukłych narożnikach, które pokrywały się z ciemną elewacją. Wklęsłe połączenia zachowują potrzebne zamknięcia od środka. Wewnętrzne powierzchnie kończą się na wewnętrznych narożnikach. Na poziomie 2,80 m usunięto zakryte, zdublowane powierzchnie połączenia ścian i stropu, zachowując widoczne spody nadwieszeń. Krawędź stropu i podłogi piętra cofnięto o 0,18 m do wnętrza grubości ściany; otwory schodów i antresoli oraz zewnętrzny obrys domu pozostają bez zmian.

Pas między dolnym i górnym przeszkleniem salonu ma lico na y=16,85 m, wspólne z szybami. Jego grubość 0,12 m mieści się za tą płaszczyzną, wysokość obejmuje z=2,35–3,20 m. Usunięto wysuniętą półkę i zasłaniający ją dawny pas ściany. Zachowano pełne górne okno i wszystkie okna dachowe.

## Widoczne słońce i zegar 2026-11-17.6

Symulacja pokazuje tarczę słońca o średnicy kątowej 0,53° w kierunku obliczonym dla wybranej daty i godziny. Podczas spaceru można patrzeć na słońce; budynki, drzewa i inne obiekty zasłaniają je. Przy horyzoncie tarcza oraz bezpośrednie światło stają się pomarańczowe, a niebo przechodzi przez zmierzch do nocy. Kolory są poglądowym modelem czystego nieba, nie prognozą atmosfery. Oddzielna warstwa nieba nie zmienia obwiedni geometrii ani precyzji głębi.

Dolny zegar ma przycisk play/pause współdzielący stan i tempo z panelem „Słońce i mapy”. Działa także podczas spaceru i na telefonie. Geometria i wszystkie dotychczasowe wymiary pozostały niezmienione.

## Większa tarcza słońca 2026-11-17.7

Tarczę powiększono wizualnie dwukrotnie: średnica kątowa w obrazie wynosi 1,06° zamiast 0,53°. To ułatwienie widoczności podczas spaceru; obliczany kierunek słońca oraz geometria cieni pozostają bez zmian.

## Domyślne niebo 2026-11-17.8

Niebo, tarcza słońca i barwa światła są widoczne od pierwszego wyświetlenia modelu, również podczas spaceru bez otwierania panelu. Dolny zegar i sterowanie odtwarzaniem ujawniają się dopiero po otwarciu „Słońce i mapy”. Początkowa data i godzina pozostają 20.07.2026, 15:50 czasu polskiego.

## Szybki spacer 2026-11-17.9

Przycisk „Spacer” na głównym pasku, obok „Widoki i sterowanie”, przełącza ten sam tryb chodzenia co „Spacer · 1,7 m” w menu. Oba przyciski współdzielą stan; Esc, reset widoku i wejścia do wnętrz także go aktualizują.

## Kuchnia /193 · 2026-11-20.1

Blat zlewozmywaka i wyspa w kuchni /193 mają matowy laminat w kolorze ciemnego orzecha. Tekstura pochodzi z dostarczonego zdjęcia dekoru. Słoje biegną wzdłuż blatu i schodzą po obu bocznych płytach wyspy. Cienka brązowa krawędź odwzorowuje obrzeże widoczne na zdjęciu próbki. Wyspa ma 382,3 × 105 cm.

Wysoki front tuż obok przejścia do spiżarni otwiera się po kliknięciu lub dotknięciu. W środku są stacja robota i półki. Podcięcie frontu ma 48 × 13,5 cm. Apple TV jest w uchwycie przy projektorze.
