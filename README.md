# Prima Vista

Webapp zum Trainieren des Notenlesens am Klavier. Eine zufällige Note erscheint im
Violinschlüssel, Bassschlüssel oder Klaviersystem, du spielst sie, die App zeigt richtig/falsch
und misst die Reaktionszeit.

- **Klaviersystem:** Noten ab C4 im Violin-, darunter im Bassschlüssel. Bis zu 4 Hilfslinien
  werden normal notiert, weiter außen mit 8va/8vb (am oberen Rand des Klaviers 15ma).
- **Tonumfang:** Preset „Nord Stage 4 (88 Tasten, A0–C8)“ oder manuell, je Notensystem getrennt
  gespeichert und unabhängig vom angeschlossenen MIDI-Gerät.
- **Lagen-Gewichtung:** Töne in der Kernzone (Standard C2–C6) kommen gleich oft dran, außerhalb
  halbiert sich die Häufigkeit pro Oktave Abstand. Zone und Faktor sind einstellbar.

Eingabe über MIDI-Keyboard (Web MIDI, z. B. Nord Stage 4 per USB), die Bildschirmtastatur
oder die Computertastatur (A–K weiße Tasten, W E T Z U O P schwarze Tasten, Y/X Oktave).
Fortschritt und Einstellungen liegen im `localStorage` des Browsers. Daten aus der Zeit, als
die App noch „Notenleser“ hieß, werden beim ersten Start automatisch übernommen.

Gestaltung: Flügelschwarz mit Lackglanz, Marineblau und Messing, Elfenbein für Text; die Noten
stehen schwarz auf einem elfenbeinfarbenen Notenblatt. Schriften (Cormorant Garamond, Source
Sans 3) sind per Fontsource eingebunden, die App lädt nichts von externen Servern.

## Lokal starten

Voraussetzung: Node.js 20.19+ (empfohlen 22).

```bash
npm install
npm run dev
```

Dann <http://localhost:5173/prima-vista/> öffnen. Für MIDI Chrome oder Edge verwenden;
Web MIDI funktioniert nur über `localhost` oder HTTPS. Firefox fragt beim ersten Zugriff nach
einer Erlaubnis, Safari unterstützt kein Web MIDI (Maus und Tastatur gehen trotzdem).

Weitere Befehle:

| Befehl                 | Zweck                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `npm test`             | Unit-Tests (Vitest)                                          |
| `npm run build`        | Build für GitHub Pages nach `dist/` (Base-Pfad `/prima-vista/`) |
| `npm run build:static` | Build mit relativen Pfaden, für beliebigen Webspace-Ordner   |
| `npm run preview`      | gebauten Stand lokal ansehen                                 |

## Deployment

- **GitHub Pages:** `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf
  `main`. Einmalig in den Repo-Einstellungen unter *Pages → Source* „GitHub Actions“ wählen.
  Die App liegt dann unter <https://schlonhorizon.github.io/prima-vista/>.
- **Webspace:** `npm run build:static` und den Inhalt von `dist/` hochladen.

## Struktur

```
src/
  core/        Tonhöhen (Pitch, MIDI, deutsche Namen), Schlüssel, Notensatz (Staff-Zuordnung,
               Hilfslinien, Oktavierung), Tonumfang, Presets, Lagen-Gewichtung, Storage
  input/       InputHub + Quellen: Web MIDI, Computertastatur
  exercises/   Aufgabenmodell (Task/Step), Generator „Einzelnoten“, Matcher, Auswahl
  stats/       Statistik pro Item (Treffer, Fehler, Zeiten, Verwechslungen)
  render/      Notenzeile bzw. Klaviersystem mit VexFlow
  trainer/     Übungsschleife: Aufgabe → Eingabe prüfen → speichern → nächste
  ui/          App-Verdrahtung, Bildschirmtastatur, Statistik nach Oktaven
```

Vorbereitet für spätere Schritte:

- **Intervalle, Akkorde, Phrasen:** Eine `Task` besteht aus `steps`, jeder Step aus mehreren
  Tönen. Der `StepMatcher` prüft bereits gleichzeitig gehaltene Töne, der Trainer arbeitet
  Steps der Reihe nach ab, der Renderer verteilt die Töne eines Steps auf beide Systeme.
  Neue Übungen implementieren nur `Exercise.nextTask()`.
- **Adaptive Gewichtung:** Der `WeightedSelector` zieht proportional zu
  `Grundgewicht × Modifikatoren`. Ein adaptiver Faktor wird als `WeightModifier` ergänzt, der
  aus `StatsStore.getItem()` (Trefferquote, Ø-Zeit, letzte 50 Versuche, zuletzt gesehen) einen
  Multiplikator berechnet.
