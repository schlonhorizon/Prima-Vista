# Notenleser

Webapp zum Trainieren des Notenlesens am Klavier. Eine zufällige Note erscheint im
Violinschlüssel, du spielst sie, die App zeigt richtig/falsch und misst die Reaktionszeit.

Eingabe über MIDI-Keyboard (Web MIDI, z. B. Nord Stage 4 per USB), die Bildschirmtastatur
oder die Computertastatur (A–K weiße Tasten, W E T Z U O P schwarze Tasten, Y/X Oktave).
Fortschritt und Einstellungen liegen im `localStorage` des Browsers.

## Lokal starten

Voraussetzung: Node.js 20.19+ (empfohlen 22).

```bash
npm install
npm run dev
```

Dann <http://localhost:5173/notenleser/> öffnen. Für MIDI Chrome oder Edge verwenden;
Web MIDI funktioniert nur über `localhost` oder HTTPS. Firefox fragt beim ersten Zugriff nach
einer Erlaubnis, Safari unterstützt kein Web MIDI (Maus und Tastatur gehen trotzdem).

Weitere Befehle:

| Befehl                 | Zweck                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `npm test`             | Unit-Tests (Vitest)                                          |
| `npm run build`        | Build für GitHub Pages nach `dist/` (Base-Pfad `/notenleser/`) |
| `npm run build:static` | Build mit relativen Pfaden, für beliebigen Webspace-Ordner   |
| `npm run preview`      | gebauten Stand lokal ansehen                                 |

## Deployment

- **GitHub Pages:** `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf
  `main`. Einmalig in den Repo-Einstellungen unter *Pages → Source* „GitHub Actions“ wählen.
- **Webspace:** `npm run build:static` und den Inhalt von `dist/` hochladen.

## Struktur

```
src/
  core/        Tonhöhen (Pitch, MIDI, deutsche Namen), Schlüssel, Tonumfang, Storage
  input/       InputHub + Quellen: Web MIDI, Computertastatur
  exercises/   Aufgabenmodell (Task/Step), Generator „Einzelnoten“, Matcher, Auswahl
  stats/       Statistik pro Item (Treffer, Fehler, Zeiten, Verwechslungen)
  render/      Notenzeile mit VexFlow
  trainer/     Übungsschleife: Aufgabe → Eingabe prüfen → speichern → nächste
  ui/          App-Verdrahtung, Bildschirmtastatur
```

Vorbereitet für spätere Schritte:

- **Bassschlüssel:** `CLEFS.bass` ist konfiguriert, Renderer und Statistik-Keys tragen den Schlüssel.
- **Intervalle, Akkorde, Phrasen:** Eine `Task` besteht aus `steps`, jeder Step aus mehreren
  Tönen. Der `StepMatcher` prüft bereits gleichzeitig gehaltene Töne, der Trainer arbeitet
  Steps der Reihe nach ab. Neue Übungen implementieren nur `Exercise.nextTask()`.
- **Adaptive Gewichtung:** Übungen wählen über das Interface `ItemSelector`. Ein adaptiver
  Selector kann `StatsStore.getItem()` lesen (Trefferquote, Ø-Zeit, letzte 50 Versuche,
  zuletzt gesehen) und `UniformSelector` ersetzen.
