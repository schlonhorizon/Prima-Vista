# Prima Vista – Roadmap und Architektur

Ziel: Blattspiel am Klavier trainieren. Theorie ist nie Selbstzweck, sondern immer an das Spielen
gebunden: **sehen → verstehen → spielen**.

Grundprinzip: Alles ergibt harmonisch Sinn. Jede Übung außer „Einzelnoten“ findet in einer Tonart
statt (gewählt oder zufällig gezogen), mit korrekter Vorzeichnung und enharmonisch korrekter
Schreibweise (Cis-Dur hat Eis und His, nicht F und C).

Für alle Modi gelten: das gemeinsame Aufgabenmodell, die Mehrton-Prüfung, das Design,
Klaviersystem/Violin-/Bassschlüssel, Tonumfang-Presets und Lagen-Gewichtung.

## Status

| Teil | Thema                              | Status        |
| ---- | ---------------------------------- | ------------- |
| –    | Einzelnoten, Klaviersystem, Design | fertig        |
| –    | Wissensebene (Tipps, Erklärungen, Lektionen) | fertig |
| 1    | Musiktheorie-Kern                  | fertig        |
| 2    | Intervalle                         | fertig        |
| 3    | Akkorde                            | fertig        |
| 4    | Tonart erkennen                    | fertig        |
| 5    | Rhythmus (Timing-, Audio-Engine)   | geplant       |
| 6    | Adaptive Logik                     | geplant       |
| 7    | Abfolgen (Progressionen, Phrasen)  | geplant       |
| 8    | Vorauslesen, beide Hände           | geplant       |
| 9    | Leadsheets, Voicings               | geplant       |
| 10   | Tonleitern                         | geplant       |
| 11   | Gehörbildung                       | geplant       |
| 12   | Gemischter Modus                   | geplant       |
| 13   | Prima-Vista-Modus                  | Fernziel      |

## Abhängigkeiten

```
            ┌──────────────── 1 Theorie-Kern ────────────────┐
            │            │             │            │         │
        2 Intervalle  3 Akkorde   4 Tonart     10 Tonleitern  │
            │            │                          │         │
            │            └──── 7 Abfolgen ──────────┤         │
            │                    │   │              │         │
 5 Rhythmus (Timing + Audio) ────┘   │              │         │
            │                        │              │         │
            ├──── 8 Vorauslesen/beide Hände ────────┤         │
            │                        │              │         │
            │                  9 Leadsheets/Voicings│         │
            │                                       │         │
 11 Gehörbildung (Audio aus 5, Inhalte aus 2/3/7) ──┘         │
 6 Adaptive Logik (Statistik; wirkt auf alle Modi) ───────────┘
 12 Gemischter Modus (alle fertigen Modi, 6 empfohlen)
 13 Prima-Vista (5, 7, 8, Passagen-Generator; MusicXML-Import)
```

- **1** ist Grundlage für alles mit Tonart.
- **5** liefert Timing- und Audio-Engine; **7, 8, 11, 13** setzen sie (optional bzw. zwingend) voraus.
- **6** braucht nur die einheitliche Statistik und kann jederzeit nach 4 kommen; sinnvoll vor 12.
- **7** liefert den Passagen-Generator (Phrasen), den **8, 9, 11, 13** erweitern.

## Architektur

```
src/
  core/        Tonhöhe (gespelte Pitch inkl. Doppelvorzeichen), Schlüssel, Notensatz-Regeln
               (Staff-Zuordnung, Hilfslinien, 8va/8vb), Tonumfang, Presets, Lagen-Gewichtung,
               Storage, Migrationen
  theory/      Musiktheorie-Kern: Intervalle, Tonarten, Tonleiter-Katalog, Akkorde, Benennungen
  exercises/   Aufgabenmodell (Task/Step), Matcher, Auswahl (WeightedSelector), Übungsgeneratoren
  trainer/     Übungsschleife: Aufgabe → Eingabe prüfen → Statistik → nächste Aufgabe
  input/       InputHub + Quellen (Web MIDI, Computertastatur); Bildschirmtastatur in ui/
  render/      VexFlow-Renderer (Vorzeichnung, Vorzeichen-Logik, Klaviersystem)
  stats/       Einheitliche Statistik pro Übungselement
  knowledge/   Wissensebene: Tipps, Erklärungen, Lektionen (ein Provider pro Modus), Markdown
  content/     Alle Texte der Wissensebene als Markdown – getrennt vom Code
  modes.ts     Modus-Register (Name, Status, Übung, Einstellungen, Statistik-Ansicht)
  ui/          App-Shell, Modus-Navigation, Tastatur, Antwort-Panels, Statistik-Tabelle
  timing/      (Teil 5) Timing-Engine mit Metronom
  audio/       (Teil 5) Audio-Engine per Web Audio
  passages/    (Teil 7+) Generator für Notenpassagen
```

### Designentscheidungen (übergreifend)

**Gespelte Tonhöhen statt MIDI.** Jede Note ist `Stufe + Alteration (−2…+2) + Oktave`. Notation,
Namen und Theorie arbeiten nur damit; MIDI-Nummern dienen ausschließlich dem Vergleich mit dem
Gespielten (enharmonisch gleich = richtig gespielt).

**Theorie aus Intervallarithmetik.** Transponieren heißt „Buchstaben um n Stufen weiter, dann
Alteration so wählen, dass die Halbtonzahl stimmt“. Daraus folgen Tonleitern, Akkorde und
Vorzeichnung automatisch enharmonisch korrekt; es gibt keine Nachschlagetabellen pro Tonart.

**Tonarten.** Eine Tonart ist `Grundton (gespelt) + Dur/Moll`, ihre Vorzeichnung eine Zahl im
Quintenzirkel (−7…+7). 15 Dur- und 15 Moll-Tonarten inklusive der enharmonischen Paare.
Moll-Konvention: Basis natürliches Moll; V und vii° (bzw. V7, vii°7) aus harmonischem Moll, weil
Dominante und Leitton harmonisch die Regel sind. „Leitereigen“ in Moll = natürliches Moll plus
erhöhte 7. Stufe.

**Aufgabenmodell.** Eine `Task` hat ein Notensystem (Violin/Bass/Klaviersystem), optional eine
Tonart (→ Vorzeichnung), eine Folge von `Steps` (jeder Step = gleichzeitig zu spielende Töne)
und eine Antwortart: `play` (Klavier) oder `choice` (Auswahl per Klick/Tastatur, z. B. Tonart
erkennen). Teil 5 ergänzt pro Step Einsatzzeit und Dauer; der Matcher wird dann zeitgesteuert.

**Mehrton-Prüfung.** Ein Step ist gelöst, wenn alle Töne gleichzeitig gehalten werden. Ein falscher
Ton ist sofort ein Fehler. Optional ein Zeitfenster: alle Töne müssen innerhalb von n ms nach dem
ersten angeschlagen sein. Das Ergebnis nennt fehlende und überzählige Töne.

**Auswahl und Gewichtung.** Jede Übung erzeugt Kandidaten `(Übungselement, konkrete Realisierung,
Grundgewicht)`. Das Grundgewicht ist die Lagen-Gewichtung der Realisierung. Der
`WeightedSelector` zieht proportional zu `Grundgewicht × Modifikatoren`; die adaptive Logik
(Teil 6) ist ein Modifikator pro Übungselement. So gilt beides einheitlich für alle Modi.

**Einheitliche Statistik.** Schlüssel pro Übungselement, z. B. `note|treble|C4`,
`interval|M3|up|mel`, `chord|E♭-major|ii|7|1`, `keysig|-3`. Gespeichert: Treffer, Fehler,
Reaktionszeiten, letzte 50 Versuche, Verwechslungen, zuletzt geübt. Jeder Modus liefert seine
eigene Gruppierung für die Statistik-Tabelle.

**Einstellungen.** Ein Objekt mit gemeinsamen Teilen (Notensystem, Tonumfang, Gewichtung, Tonart,
Anzeige, Eingabe) und je einem Abschnitt pro Modus; jeder Abschnitt wird beim Laden validiert, alte
Formate werden migriert.

**Eingabe ohne MIDI.** Computertastatur: gleichzeitig gedrückte Tasten = Akkord. Bildschirmtastatur:
Auswahlmodus für mehrstimmige Aufgaben (Tasten an-/abwählen, mit Button oder Leertaste
bestätigen; die Klick-Reihenfolge gilt bei melodischen Aufgaben). Modi ohne Klaviereingabe werden
mit Buttons beantwortet, die per Tab/Enter auch über die Tastatur bedienbar sind.

**Modus-Auswahl.** Ein Register beschreibt alle Modi mit Status; fertige sind wählbar, geplante
erscheinen dezent ausgegraut.

**Wissensebene (fester Bestandteil jedes Modus).** Musiktheorie wird vermittelt, ohne den
Übungsfluss zu stören – alles ist ausgeblendet, bis man es anfordert:
- **Tipp** (N): Hinweis während der Aufgabe, der die Lösung nicht verrät.
  Der Versuch zählt als „mit Hilfe“: eigene Zähler (`assistedHits/assistedMisses`), Markierung
  `help` in den letzten Versuchen, eigene Spalte in der Statistik; Quote und Ø-Zeit zählen nur
  Antworten ohne Hilfe.
- **Mehr erfahren** (M): Erklärung zu genau dieser Aufgabe nach der Antwort. Während sie offen ist,
  hält der Trainer an (weiter mit Enter, Button oder beliebiger Klaviertaste). Wird sie erst
  während der nächsten Aufgabe geöffnet, verfällt deren Reaktionszeit. Optional automatisch.
- **Lektion** (B): Einführung pro Modus – was man lernt, warum es fürs
  Blattspiel zählt, eine praktische Methode, Notenbeispiele (VexFlow) und ein Übungstipp.
- **Inhalte** liegen als Markdown unter `src/content/`: `lessons/<modus>.md` und
  `knowledge/<modus>.md` mit `## id`-Abschnitten und `{platzhaltern}`, die ein Provider in
  `src/knowledge/` aus `Task.info` (den Theorie-Daten jeder Aufgabe) füllt. Notenbeispiele als
  ```` ```noten ````-Block. Tests prüfen, dass jeder Abschnitt existiert, jeder Platzhalter gefüllt
  wird, Tipps die Lösung nicht nennen und alle Notenbeispiele gültig sind.
- **Überspringen** (→): zeigt die Lösung (mit „Mehr erfahren“) und geht weiter. Zählt weder als
  Treffer noch als Fehler, sondern als eigene Kategorie (`skipped`, Markierung in den letzten
  Versuchen, eigene Spalte in der Statistik) – die adaptive Logik kann es gesondert werten.
- **Tastenkürzel** liegen nie auf Klaviertasten der Computertastatur (A–Ä, W–P, Y/X): Wissen auf
  B N M (rechte untere Reihe), Ablauf auf → / Enter / Esc, Leertaste für Bestätigen bzw. Tippen,
  Übersicht mit ?. Ein Test prüft die Konfliktfreiheit; neue Kürzel kommen ins zentrale Register
  `ui/shortcuts.ts`.
- **Pflicht für jeden neuen Teil:** Tipps, Erklärungen nach der Antwort und eine Lektion als
  Inhaltsdateien plus Provider; ohne sie gilt ein Teil nicht als fertig.

---

## Teil 1: Musiktheorie-Kern ✔

- Intervalle (Nummer + Qualität), Berechnung zwischen zwei Tönen, Transposition, deutsche Namen.
- Tonarten: alle 15 Dur und 15 Moll, Vorzeichnung, parallele Tonart, deutsche Namen
  (Cis-Dur, cis-Moll, Es-Dur, es-Moll, Ces-Dur …).
- Tonleiter-Katalog (erweiterbar, mit Beschreibung): Dur; natürliches, harmonisches, melodisches
  Moll; Dur- und Moll-Pentatonik; Blues; Ionisch bis Lokrisch; Bebop-Dominante; Alteriert.
  Jede Tonleiter ist als gespelte Intervallfolge definiert (jede Stufe ein eigener Buchstabe,
  Pentatonik/Blues ausgenommen).
- Akkorde: Dreiklänge und Septakkorde als Stufenakkorde, Umkehrungen, Akkordsymbole im Jazz-Stil
  (Cmaj7, Dm7, G7, Bm7♭5, B°7), Stufen (I, ii, V7, viiø7) und Funktionen (T, Sp, Dp, S, D, Tp, Dv
  bzw. t, s, D, tP, sP in Moll).
- Unit-Tests für alle Tonarten (sieben verschiedene Buchstaben, Übereinstimmung mit der
  Vorzeichnung, Eis/His in Cis-Dur, Fes/Ces in Ces-Dur, Doppelkreuze in dis- und ais-Moll).

## Teil 2: Intervalle ✔

Abhängig von: 1.
- Melodisch (nacheinander), harmonisch (übereinander) oder gemischt.
- In einer Tonart (nur leitereigene Töne) oder chromatisch (ohne Vorzeichnung, keine
  Doppelvorzeichen).
- Auswahl der Intervalle (kleine Sekunde bis Oktave, Tritonus als übermäßige Quarte bzw.
  verminderte Quinte) und der Richtung.
- Nach der Antwort der Intervallname („große Terz aufwärts“).
- Übungselement: Intervall × Richtung × Darstellung; die konkrete Lage wird über die
  Lagen-Gewichtung gezogen.

## Teil 3: Akkorde ✔

Abhängig von: 1, Mehrton-Prüfung.
- Stufenakkorde der Tonart, Dreiklänge und/oder Septakkorde, Grundstellung und Umkehrungen einzeln
  wählbar; enge Lage.
- Genau die notierten Töne in der notierten Lage; Zeitfenster für das Anschlagen einstellbar;
  zusätzliche Töne sind Fehler; Reaktionszeit bis zum vollständigen Akkord.
- Nach der Antwort: Symbol, Stufe, Funktion, Lage („Am, vi, Tp, 1. Umkehrung“); bei Fehlern
  fehlende und überzählige Töne, richtige Tasten markiert.
- Im Klaviersystem bleibt ein Akkord, der über C4 reicht, in einem System (dem mit weniger
  Hilfslinien), solange er dort ohne Oktavierung passt – eine Hand liest ihn zusammen.

## Teil 4: Tonart erkennen ✔

Abhängig von: 1.
- Vorzeichnung im Notensystem; Antwort: Dur- und parallele Moll-Tonart per Button.
- Quintenzirkel als ausblendbare Hilfe, hebt nach der Antwort die richtige Tonart hervor.
- Statistik pro Vorzeichnung.
- Die Antwort-Buttons sind nach Buchstaben sortiert (C, Cis, Ces, D …), nicht im Quintenzirkel,
  damit die Antwort nicht durch Abzählen entsteht; die Antwort zählt nur, wenn Dur und Moll stimmen.

## Teil 5: Rhythmus (geplant)

Abhängig von: Aufgabenmodell; liefert **Timing-Engine** und **Audio-Engine**.
- 1–4 Takte, gespielt auf beliebiger Taste zum Metronom; Genauigkeit pro Note (Abweichung in ms
  und als Anteil eines Schlags), Gesamtwertung.
- Stufen: Viertel/Halbe → Achtel/Pausen → Punktierungen/Synkopen → Triolen/Sechzehntel.
- Tempo einstellbar, Einzähltakt.

Designentscheidungen:
- **Audio-Engine:** Web Audio, rein synthetisch (Metronom-Klick als kurzer gefilterter Impuls,
  Klavierton als additive Synthese mit Hüllkurve). Keine Samples von fremden Servern; falls später
  Samples, dann im Repo gebündelt.
- **Timing-Engine:** Master-Uhr ist `AudioContext.currentTime`; Look-ahead-Scheduler (z. B. 100 ms
  voraus, Tick alle 25 ms). MIDI-Zeitstempel (performance.now) werden über
  `getOutputTimestamp()` auf die Audio-Uhr umgerechnet. Latenz-Kalibrierung in den Einstellungen
  (Tippen zum Klick).
- Task-Steps erhalten `onset` und `duration` in Schlägen; Notation mit Takten, Balken, Pausen.
- Statistik: Übungselement = Rhythmusmuster (z. B. `rhythm|dotted-quarter-eighth`), zusätzlich
  mittlere Abweichung.
- Wissen: Lektion zu Notenwerten, Takt und Zählen („1 und 2 und“), Tipp = Zählhilfe für das
  Muster, Erklärung = Silben/Zählweise des gespielten Rhythmus mit Abweichungen.

## Teil 6: Adaptive Logik (geplant)

Abhängig von: einheitliche Statistik (vorhanden). Wirkt auf alle Modi.
- Gewicht = Lagen-Gewicht × adaptiver Faktor. Der Faktor ist ein `WeightModifier` pro
  Übungselement, berechnet aus den letzten Versuchen:
  - Fehlerquote (exponentiell gewichtet, neuere Versuche zählen mehr),
  - Langsamkeit (Reaktionszeit relativ zum Median aller Elemente des Modus),
  - Zeit seit „zuletzt geübt“ (wächst langsam bis zu einer Obergrenze),
  - Unbekannt-Bonus für nie geübte Elemente.
  - Übersprungene Aufgaben zählen gesondert (z. B. wie ein halber Fehler, einstellbar).
  - Versuche „mit Hilfe“ (Tipp) zählen gesondert: ein Treffer mit Tipp senkt den Faktor weniger
    als ein Treffer ohne Hilfe (eigener, einstellbarer Anteil).
- Parameter in den Einstellungen: Einfluss Fehler, Einfluss Langsamkeit, Erholungsrate
  (Halbwertszeit in Versuchen), Einfluss der Pause, minimaler/maximaler Faktor.
- Anzeige des aktuellen Faktors in der Statistik-Tabelle zur Feinjustierung.
- Wissen: Erklärtext in den Einstellungen, wie die Parameter wirken (keine Lektion nötig).

## Teil 7: Abfolgen (geplant)

Abhängig von: 1, 3; optional 5.
- Progressionen: I–IV–V–I, I–vi–IV–V, ii–V–I, I–vi–ii–V, Moll-Kadenz, 12-Takt-Blues.
- Stimmführung: Für jeden Akkord werden alle Umkehrungen in Reichweite erzeugt und der Weg mit
  minimaler Gesamtbewegung (Summe der Halbtonabstände, gemeinsame Töne liegen bleiben) per
  dynamischer Programmierung gewählt.
- Melodische Phrasen (4–8 Töne): Regelbasierter Generator – überwiegend Sekundschritte, Sprünge
  nur auf Akkordtöne, nach großem Sprung Gegenbewegung, Schluss auf Grundton/Terz,
  Ambitus-Grenze. Seeded RNG für reproduzierbare Aufgaben.
- **Passagen-Generator** (neues Modul `passages/`): Pipeline Harmonieplan → Melodie → Rhythmus →
  Hände → Notation. Wird in 8, 9, 11, 13 erweitert.
- Ohne Tempo: Steps nacheinander; mit Tempo: Timing-Engine.
- Wissen: Lektion zu Kadenzen, Stimmführung und Phrasenbau; Tipp = nächste Funktion bzw.
  Richtung der Linie; Erklärung = Funktionsfolge (T–S–D–T), gemeinsame Töne, Leittonschritte.

## Teil 8: Vorauslesen und beide Hände (geplant)

Abhängig von: 7; 5 für die wandernde Variante.
- Vorauslesen: gespielte Noten werden ausgeblendet oder ein Lesefenster wandert mit; Renderer
  bekommt Mehrtakt-Layout und Sichtbarkeitsmaske pro Note.
- Beide Hände: zuerst gleichzeitige Töne in beiden Systemen, dann Melodie rechts + Begleitung links
  (Passagen-Generator mit zwei Stimmen).
- Steps bekommen dafür eine explizite Hand-/System-Zuordnung pro Ton; die automatische
  Zuordnung (C4-Grenze, Akkorde zusammenhalten) bleibt der Standard für einhändige Aufgaben.
- Wissen: Lektion zu Blickführung und Vorausschauen, Koordination beider Hände; Tipp = worauf als
  Nächstes achten; Erklärung = Lesefehler-Muster.

## Teil 9: Leadsheets und Voicings (geplant)

Abhängig von: 1, 3, 7.
- Leadsheet: Melodie notiert, Akkordsymbole darüber. Melodie exakt geprüft, linke Hand nach
  Tonklassen (Matcher-Variante „pitch classes“, Lage egal).
- Voicings: Shell (1-3-7, 1-7-3), Rootless (A/B-Form, 3-5-7-9 / 7-9-3-5) über ii–V–I in allen
  Tonarten; Voicing-Katalog im Theorie-Kern.
- Wissen: Lektion zu Akkordsymbolen und Voicing-Typen; Tipp = Guide Tones (Terz/Septime);
  Erklärung = Aufbau des Voicings und Stimmführung im ii–V–I.

## Teil 10: Tonleitern (geplant)

Abhängig von: 1 (Katalog vorhanden).
- A: notierte Tonleiter auf-/abwärts spielen. B: nur Name, auswendig spielen, danach notiert zeigen.
- Freischaltung: Dur/Moll → Pentatonik/Blues → Kirchentonarten → Jazz-Tonleitern; freigeschaltet
  bei Trefferquote ≥ x % über n Versuche (einstellbar).
- Wissen: Die Lektion erklärt **jede Tonleiter** des Katalogs – was sie auszeichnet (Intervall-
  folge, charakteristischer Ton, z. B. die große Sexte in Dorisch), wie sie klingt und wofür man
  sie verwendet (Stil, Akkord, über den man sie spielt) – mit Notenbeispiel. Tipp = Fingersatz-
  bzw. Struktur-Hinweis (Ganz-/Halbtonfolge); Erklärung = Aufbau der konkreten Tonleiter.

## Teil 11: Gehörbildung (geplant)

Abhängig von: 5 (Audio-Engine), Inhalte aus 2, 3, 7.
- App spielt Intervall/Akkord/Phrase, ich spiele nach; danach notiert gezeigt. Gleicher Matcher
  wie in 2/3/7, Task ohne sichtbare Noten bis zur Antwort.
- Wissen: Lektion zu Hörstrategien (Bezugslieder, Funktion hören); Tipp = Bezugslied bzw.
  Klangcharakter; Erklärung wie in Teil 2/3/7.

## Teil 12: Gemischter Modus (geplant)

Abhängig von: allen fertigen Modi; 6 empfohlen.
- Modi mit Gewichten; jede Aufgabe zieht erst den Modus, dann das Element.
- „Tonart-Session“: eine Runde (n Aufgaben) in derselben Tonart über alle Modi.
- Wissen: nutzt Tipps, Erklärungen und Lektionen der beteiligten Modi.

## Teil 13: Prima-Vista-Modus (Fernziel)

Abhängig von: 5, 7, 8 (Passagen-Generator, beide Hände, Timing).
- Generierte kurze Stücke für beide Hände, einmal im Tempo ohne Anhalten, Auswertung am Ende
  (Tonhöhe, Timing, ausgelassene Noten).
- Später: MusicXML-Import in dasselbe Passagen-Modell; gemeinfreie Literatur (z. B. Bach-Choräle)
  als mitgelieferte Dateien.
- Wissen: Lektion zur Vorbereitung eines Blattspiels (Tonart, Takt, Muster, schwierige Stellen
  vorab erkennen); Erklärung = Auswertung mit den häufigsten Fehlerquellen.
