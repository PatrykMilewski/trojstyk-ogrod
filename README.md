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

Domyślny wariant pochodzi z pliku `moj-ogrod (11).json`. „Przywróć układ startowy” przywraca ten wariant. Podkład działek jest stały; konfigurator nie pobiera innych działek po adresie.

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

## Geometria i ograniczenia

Granice ULDK z 11.11.2026, obliczenia w metrach na lokalnym układzie opartym na EPSG:2177. Domy ustawione orientacyjnie. To koncepcja, nie pomiar geodezyjny ani projekt wykonawczy. Ostrzeżenia pomagają wykryć nakładanie obiektów i wyjście poza płot, ale nie potwierdzają zgodności budowlanej ani wymaganych stref bezpieczeństwa.

Chodnik jest wirtualną rezerwą, liczoną osobno od zagospodarowania. Nakładające się powierzchnie wyposażenia są liczone raz. „Wolne” nie jest równoznaczne z powierzchnią biologicznie czynną.

Biblioteka `polygon-clipping` oraz zależności mają informacje licencyjne dołączone na końcu wygenerowanego HTML.

## Model 3D działek

Osobna podstrona `trzy-domy-3d/index.html` przedstawia trzy domy, prywatne ogrody i wspólny trójstyk. Obrót lewym przyciskiem myszy; dwa palce na touchpadzie lub kółko przesuwają widok. Szczypnięcie, Ctrl+kółko i przyciski ＋/− przybliżają. Przesuwanie działa też prawym przyciskiem i dwoma palcami na ekranie dotykowym. Przyciski przybliżają wybraną działkę, wspólną strefę lub psy.

Model zachowuje metryczną geometrię i gabaryty katalogowe. Dachy, stolarka, wyposażenie i zieleń są koncepcją; teren przyjęto płaski. Sauna ma rzut 3 × 2,4 m i czerwony dach 45° bez okapu; trampolina jest na poziomie gruntu. Sauna ma oddzielne drzwi i okno, a trzy furtki wspólnego ogrodu mają światło 1,2 m i są uchylone o 20°. Nad stołem na /193 jest ażurowa pergola z lamelami ustawionymi pod kątem 55°. Podziały przeszkleń mają przestrzenne ciemne ramy. Okna dachowe /191 powiększono poglądowo do 94 × 140 cm (wymiar po połaci). Golden retriever jest na /190, mops na /193, a każda działka ma co najmniej dwie osoby w skali.

Podstrona jest samodzielna, działa offline i nie korzysta z zapisów lokalnych konfiguratora. Three.js r186 i OrbitControls (MIT) oraz dane modelu są osadzone w HTML; informacje licencyjne pozostają w dołączonym kodzie bibliotek. Zwykły build edytora nie nadpisuje tej podstrony.

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
