# Trójstyk — edytor ogrodu

**[Otwórz edytor](https://patrykmilewski.github.io/trojstyk-ogrod/)**

Interaktywny rzut wspólnej przestrzeni działek 775/193, 775/190 i 775/191 w Chwaszczynie. Każdy może przygotować własny wariant na tym podkładzie.

- Przeciąganie wyposażenia, obrót i zmiana wymiarów; sauna z podestem oraz balia z podbudową jako zestawy.
- Edycja płotu: najedź i kliknij „+”, następnie przeciągnij punkt.
- Furtki i bramy o regulowanej szerokości.
- Piasek przesuwa urządzenia stojące na nim; poszczególne urządzenia można przesuwać osobno.
- Wirtualny chodnik łączący furtki z przeciąganym skrzyżowaniem i uchwytami łuków.
- Bilans powierzchni działek na żywo, osobne pole chodnika oraz przełącznik wymiarów elementów.
- Ludzie jako ilustracje przypisane do wyposażenia, bez wpływu na powierzchnie.
- Cofanie, ponawianie, zapis i odczyt JSON oraz eksport SVG.

## Własny układ

Zmiany zapisują się automatycznie **tylko w lokalnej pamięci przeglądarki**. Nie zmieniają strony ani układów innych osób. Przycisk „Zapisz układ” pobiera JSON — można przesłać go komuś i użyć „Wczytaj”. Nie jest to edycja współdzielona w czasie rzeczywistym. Wyczyszczenie danych przeglądarki usuwa zapis lokalny, dlatego warto pobierać kopie JSON.

Domyślny wariant pochodzi z pliku `moj-ogrod (8).json`. „Przywróć układ startowy” przywraca ten wariant. Podkład działek jest stały; konfigurator nie pobiera innych działek po adresie.

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
