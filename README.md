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

- Otwieraj pliki `.abc`, edytuj tekst i eksportuj wynik do nowego pliku.
- Wybierz narzędzie nuty lub pauzy i kliknij zapis, aby dodać element. Ustaw
	wartość rytmiczną, oktawę i znak chromatyczny na pasku narzędzi.
- W trybie zaznaczania przeciągnij pojedynczą nutę w pionie, aby zmienić jej
	wysokość. Zaznaczony element można usunąć klawiszem Backspace.
- Cofaj i ponawiaj przyciskami albo skrótami Ctrl+Z i Ctrl+Shift+Z.
- Nagłówki i pozostały tekst ABC pozostają zachowane; graficzne edycje
	podmieniają wyłącznie odpowiedni fragment źródła.

Importowany ABC jest zachowywany w całości jako tekst, ale edytor wizualny
odtwarza i edytuje pierwszy utwór z pliku. Dźwięk używa syntezatora
oscylatorowego przeglądarki.