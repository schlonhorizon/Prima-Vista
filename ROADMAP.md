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
| 1    | Musiktheorie-Kern                  | fertig        |
| 2    | Intervalle                         | fertig        |
| 3    | Akkorde                            | fertig        |
| 4    | Tonart erkennen                    | geplant       |
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

## Teil 4: Tonart erkennen

Abhängig von: 1.
- Vorzeichnung im Notensystem; Antwort: Dur- und parallele Moll-Tonart per Button.
- Quintenzirkel als ausblendbare Hilfe, hebt nach der Antwort die richtige Tonart hervor.
- Statistik pro Vorzeichnung.

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

## Teil 6: Adaptive Logik (geplant)

Abhängig von: einheitliche Statistik (vorhanden). Wirkt auf alle Modi.
- Gewicht = Lagen-Gewicht × adaptiver Faktor. Der Faktor ist ein `WeightModifier` pro
  Übungselement, berechnet aus den letzten Versuchen:
  - Fehlerquote (exponentiell gewichtet, neuere Versuche zählen mehr),
  - Langsamkeit (Reaktionszeit relativ zum Median aller Elemente des Modus),
  - Zeit seit „zuletzt geübt“ (wächst langsam bis zu einer Obergrenze),
  - Unbekannt-Bonus für nie geübte Elemente.
- Parameter in den Einstellungen: Einfluss Fehler, Einfluss Langsamkeit, Erholungsrate
  (Halbwertszeit in Versuchen), Einfluss der Pause, minimaler/maximaler Faktor.
- Anzeige des aktuellen Faktors in der Statistik-Tabelle zur Feinjustierung.

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

## Teil 8: Vorauslesen und beide Hände (geplant)

Abhängig von: 7; 5 für die wandernde Variante.
- Vorauslesen: gespielte Noten werden ausgeblendet oder ein Lesefenster wandert mit; Renderer
  bekommt Mehrtakt-Layout und Sichtbarkeitsmaske pro Note.
- Beide Hände: zuerst gleichzeitige Töne in beiden Systemen, dann Melodie rechts + Begleitung links
  (Passagen-Generator mit zwei Stimmen).
- Steps bekommen dafür eine explizite Hand-/System-Zuordnung pro Ton; die automatische
  Zuordnung (C4-Grenze, Akkorde zusammenhalten) bleibt der Standard für einhändige Aufgaben.

## Teil 9: Leadsheets und Voicings (geplant)

Abhängig von: 1, 3, 7.
- Leadsheet: Melodie notiert, Akkordsymbole darüber. Melodie exakt geprüft, linke Hand nach
  Tonklassen (Matcher-Variante „pitch classes“, Lage egal).
- Voicings: Shell (1-3-7, 1-7-3), Rootless (A/B-Form, 3-5-7-9 / 7-9-3-5) über ii–V–I in allen
  Tonarten; Voicing-Katalog im Theorie-Kern.

## Teil 10: Tonleitern (geplant)

Abhängig von: 1 (Katalog vorhanden).
- A: notierte Tonleiter auf-/abwärts spielen. B: nur Name, auswendig spielen, danach notiert zeigen.
- Freischaltung: Dur/Moll → Pentatonik/Blues → Kirchentonarten → Jazz-Tonleitern; freigeschaltet
  bei Trefferquote ≥ x % über n Versuche (einstellbar).

## Teil 11: Gehörbildung (geplant)

Abhängig von: 5 (Audio-Engine), Inhalte aus 2, 3, 7.
- App spielt Intervall/Akkord/Phrase, ich spiele nach; danach notiert gezeigt. Gleicher Matcher
  wie in 2/3/7, Task ohne sichtbare Noten bis zur Antwort.

## Teil 12: Gemischter Modus (geplant)

Abhängig von: allen fertigen Modi; 6 empfohlen.
- Modi mit Gewichten; jede Aufgabe zieht erst den Modus, dann das Element.
- „Tonart-Session“: eine Runde (n Aufgaben) in derselben Tonart über alle Modi.

## Teil 13: Prima-Vista-Modus (Fernziel)

Abhängig von: 5, 7, 8 (Passagen-Generator, beide Hände, Timing).
- Generierte kurze Stücke für beide Hände, einmal im Tempo ohne Anhalten, Auswertung am Ende
  (Tonhöhe, Timing, ausgelassene Noten).
- Später: MusicXML-Import in dasselbe Passagen-Modell; gemeinfreie Literatur (z. B. Bach-Choräle)
  als mitgelieferte Dateien.
