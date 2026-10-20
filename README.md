# ABC Studio

Lokalny edytor partytur ABC w przeglądarce. Zapis nutowy renderuje i parsuje
[`abcjs`](https://abcjs.net/), a syntezator Web Audio działa bez zewnętrznych
plików dźwiękowych.

## Uruchomienie

Wymagane: Node.js 20 lub nowszy.

```sh
npm install
npm run dev
```

Otwórz adres pokazany przez Vite. Aplikację można zbudować do `dist/` poleceniem
`npm run build` i serwować statycznie.

## Publikowanie na GitHub Pages

Workflow z gałęzi `main` buduje aplikację i publikuje ją na GitHub Pages.
W ustawieniach repozytorium otwórz **Settings → Pages** i ustaw źródło
publikacji na **GitHub Actions**. Lokalny podgląd Pages można zbudować
poleceniem `npm run build:pages`.

## Edycja

- Otwieraj pliki `.abc`, edytuj tekst (z zawijaniem długich wierszy) i
  eksportuj wynik do nowego pliku. Zaznaczenia nut są synchronizowane między
  zapisem graficznym i edytorem ABC. Końce wierszy są normalizowane do LF,
  aby indeksy nut były zgodne między parserem i edytorem.
- Wybierz narzędzie nuty lub pauzy i kliknij zapis, aby dodać element. Ustaw
	wartość rytmiczną, oktawę i znak chromatyczny na pasku narzędzi.
- W trybie zaznaczania kliknij nutę, aby odsłuchać jej dźwięk; przy kliknięciu
	nuty należącej do wielokrotnego zaznaczenia odtworzy się ono jako akord.
	Przycisk „Odtwórz” rozpoczyna odtwarzanie od pierwszej zaznaczonej nuty
	albo od początku utworu, jeśli nic nie zaznaczono.
	Przeciągnij nutę w pionie, aby zmienić jej wysokość. Zaznaczone nuty można
	przesuwać strzałkami w górę i w dół, a klawiszem Delete albo przyciskiem
	„Usuń zaznaczenie” usuwać zaznaczenie.
- Przeciągnij ramkę po pustym miejscu partytury, aby zaznaczyć wiele nut.
	Zaznaczone nuty można usuwać razem, przesuwać w pionie lub przenosić poziomo
	w obrębie jednego głosu; poziome przesunięcie zachowuje wartości rytmiczne.
- Cofaj i ponawiaj przyciskami albo skrótami Ctrl+Z i Ctrl+Shift+Z.
- Nagłówki i pozostały tekst ABC pozostają zachowane; graficzne edycje
	podmieniają wyłącznie odpowiedni fragment źródła.

Importowany ABC jest zachowywany w całości jako tekst, ale edytor wizualny
odtwarza i edytuje pierwszy utwór z pliku. Dźwięk używa syntezatora
oscylatorowego przeglądarki.