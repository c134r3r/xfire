# NEON REGENT – Aufnahmen: Schreie, Stöhnen, Rufe

**Entscheidung (Nutzer, 2026-11-26):** Die synthetischen Schreie der Klangprobe klingen künstlich. Deshalb sind **alle
menschlichen Laute Aufnahmen**. Alles andere bleibt synthetisch: Motoren, Aufprall, Achsen-Doppelschlag, Waffen,
Sirenen, Regen – und MANDATs Maschinenstimme, die künstlich klingen *soll*. Die synthetische Stimme bleibt nur als
Rückfall, solange das Bundle leer ist.

Kette: `assets/sound/raw/` → `tools/sound-packer/pack.py` → `assets/sound/neonregent.sound.js` → Spiel und Klangprobe.

## 0. Stand: 55 CC0-Takes im Bundle (2026-11-26)

Auf Anweisung des Nutzers („im Notfall nimm die Schreie") aus Freesound geladen (Weg B). Jede Lizenz wurde auf der Seite des
einzelnen Sounds als CC0 geprüft, jede Beschreibung gelesen. Herkunft und Ausschnitt je Datei stehen in `assets/sound/QUELLEN.md`.

| Kategorie | Takes | davon Frauen | Sprecher |
|---|---|---|---|
| `angst` | 17 | 6 | m1–m6, m8, f1–f6 |
| `treffer` | 14 | 4 | m2–m4, m14–m19, f10–f12 |
| `stoehnen` | 12 | 7 | m2, m20, m21, f13, f14 |
| `schmerz` | 7 | 1 | m3, m9–m13, f9 |
| `brennen` | 5 | 2 | m1, m7, f7, f8 |
| `ruf`, `keuchen`, `spieler` | 0 | – | **Lücke** – Rückfall `angst` bzw. Synthese |

- **Ausgeschlossen:** alles mit Hinweis auf Kinder oder unklarem Alter, Kampf-/Karate-Schreie (Aggression statt Angst), Comic-
  und Cartoon-Stimmen, bearbeitete Aufnahmen, Übersteuerung über 1 %, Rauschabstand unter ~21 dB, englische Wörter („Ouch").
- **Anhören:** `klangprobe.html` (lädt das Bundle automatisch) – oder alle Takes nacheinander als eine Datei (siehe §6).
- **Einen Take loswerden:** Datei in `raw/` löschen, Zeile in `QUELLEN.md` löschen, neu packen. Nummern dürfen Lücken haben.
- **Ergänzen:** eigene Sprecher bekommen die nächsten freien Nummern (`m22`, `f15`, `a1` …), die Spielfigur `p1`.
  Am meisten fehlen: deutsche Rufe (`ruf`), Frauen-`schmerz`, `keuchen` und die Stimme der Spielfigur.
- **Qualität:** Quelle ist die HQ-Vorschau (MP3 128 kbit/s). Wer ein Freesound-Konto hat, lädt das Original und ersetzt die Datei
  unter demselben Namen (den Ausschnitt aus der Spalte „Quelle" übernehmen).

---

## 1. Was gebraucht wird (Takeliste)

**Sprecher:** mindestens 3, besser 5: `m1`, `m2` (Männer), `f1`, `f2` (Frauen), `a1` (älter, raue Stimme). Optional `j1`
(junge Erwachsene, hohe Stimme). **Keine Kinder.** Jede Person im Spiel bekommt einen festen Sprecher – mehr Sprecher heißt
weniger hörbare Wiederholung.

Je Sprecher:

| Kategorie | Dateiname | Takes | Länge | So klingt es | Wofür im Spiel |
|---|---|---|---|---|---|
| `angst` | `angst_m1_01.wav` … `_04` | 4 | 0.8–1.5 s | langes, panisches „Aaah!" aus vollem Atem | Auto rast heran; beim tödlichen Treffer reißt der Take im Aufprall ab |
| `treffer` | `treffer_m1_01` … `_03` | 3 | 0.2–0.4 s | kurzes „Ah!" / „Uff!" wie getroffen | Schuss-, Schlag-, Rempeltreffer |
| `schmerz` | `schmerz_m1_01`, `_02` | 2 | 0.5–1.0 s | gequältes, fallendes „Aaah…" | angefahren und überlebt |
| `stoehnen` | `stoehnen_m1_01` … `_03` | 3 | 1–2 s | gepresstes, behauchtes Stöhnen | liegt verletzt am Boden |
| `ruf` | `ruf_m1_hilfe`, `ruf_m1_weg`, `ruf_m1_passauf`, `ruf_m1_nein` | 4 | 0.4–1 s | „Hilfe!", „Weg hier!", „Pass auf!", „Nein!" – laut, gehetzt | Panik, Ausweichen |
| `brennen` | `brennen_m1_01` | 1 | 2–3 s | langer, verzweifelter Schrei | Person brennt |
| `keuchen` | `keuchen_m1_01` | 1 | 2–3 s | schneller Laufatem | Fliehende in der Nähe |

≈ 18 Takes je Sprecher, bei 5 Sprechern ≈ 90 Takes. Gepackt ≈ 1.1 MB (gemessen: ~12 KB je Take bei 96 kbit/s).

**Spielfigur** (eine Stimme, die du der Figur geben willst – das legt sie ein Stück fest; behauchte Laute verraten am wenigsten):
`spieler_p1_01` … `_06`: kurze Treffer-Laute, Keuchen, ein Sterbelaut.

**Minimum, wenn wenig Zeit ist:** 3 Sprecher × (Angst 3, Treffer 2, Schmerz 2, Stöhnen 2, Rufe 4) = 39 Takes.

## 2. Weg A: selbst aufnehmen (empfohlen)

Warum empfohlen: einzigartige Stimmen, rechtlich sauber, deutsche Rufe („Hilfe!"), die man in freien Bibliotheken kaum
findet, und Takes, die zueinander passen. Aufwand: 15–20 Minuten pro Person.

- **Gerät:** Handy-Sprachmemo in bester Qualität (iPhone: Einstellungen → Sprachmemos → Audioqualität „Verlustfrei";
  Android: eine Rekorder-App mit WAV) oder USB-Mikrofon am Rechner (Audacity).
- **Raum:** klein und weich – begehbarer Kleiderschrank, Auto mit geschlossenen Türen, Zimmer mit Vorhängen und Sofa.
  Kein Hall, keine Straße, Lüftung aus. Den Hall rechnet das Spiel selbst dazu.
- **Abstand:** 40–60 cm, Mikrofon leicht seitlich vom Mund. Schreie sind extrem laut: **erst einen Probeschrei aufnehmen
  und anhören** – nichts darf verzerren. Lieber zu leise als übersteuert, das Skript gleicht die Lautstärke an.
- **Pro Take** eine Sekunde Stille davor und danach. Eine lange Datei geht auch, dann später in Audacity in Takes schneiden.
- **Stimme schonen:** kurz einsingen, Wasser trinken, aus dem Bauch statt aus dem Hals, nach 3–4 Schreien Pause,
  aufhören, wenn es kratzt. Nachbarn vorwarnen.
- **Spielen statt vorlesen:** sich die Situation vorstellen (ein Auto rast auf dich zu). Ein guter Take schlägt drei mittelmäßige.
- **Einverständnis:** Jede Person stimmt zu (eine Chat-Nachricht reicht), dass ihre Stimme im öffentlichen Spiel verwendet wird.
  In `QUELLEN.md` steht dann „eigene Aufnahme" und ein Kürzel – Namen nur, wenn die Person das will (auch für den Abspann).

## 3. Weg B: freie Aufnahmen (CC0)

- **Quellen:** freesound.org (Suchfilter „Creative Commons 0"), opengameart.org (Lizenzfilter CC0), Wikimedia Commons
  (Public Domain / CC0).
- **Nur CC0 oder Public Domain.** CC-BY nur nach Rücksprache (Namensnennung im Abspann und in `QUELLEN.md` Pflicht).
  Niemals „NC" (nicht kommerziell), niemals unklare Lizenzen.
- Die Lizenz auf der **Seite des einzelnen Sounds** prüfen, nicht nur dem Suchfilter trauen. Link, Urheber und Datum in
  `QUELLEN.md` eintragen.
- **Qualität:** keine Musik, kein Hall, kein Hintergrundlärm, keine Comic-Schreie; möglichst verschiedene Stimmen;
  das Original laden (bei Freesound mit kostenlosem Konto) statt der Vorschau.
- **Nachteil:** deutsche Rufe gibt es kaum, und Stimmen aus verschiedenen Quellen passen oft nicht zueinander.
- **Cloud-Session:** `freesound.org` und `cdn.freesound.org` sind in der Umgebung „2026" freigegeben. Ein automatischer Download
  braucht aber eine **ausdrückliche Anweisung** des Nutzers – ohne sie stoppt die Sicherheitsprüfung den Abruf. (So ist das
  jetzige Set entstanden, §0.)
- **Achtung bei Tags:** „girl" steht auf Freesound oft bei erwachsenen Frauen („28 years old girl"), „young man" bei Erwachsenen.
  Entscheidend ist die Beschreibung auf der Sound-Seite – im Zweifel weglassen.

## 4. Weg C: gemischt

Eigene Aufnahmen für die Hauptstimmen, CC0-Aufnahmen für Umstehende im Hintergrund – mehr Vielfalt bei wenig Aufwand.

## 5. Was nicht geht

- **Kommerzielle Bibliotheken** (auch „royalty free"): Ihre Lizenzen verbieten fast immer, die Rohdateien weiterzugeben –
  genau das täte das öffentliche Repo.
- **Schreie aus Filmen, Spielen, YouTube:** urheberrechtlich geschützt.
- **KI-generierte Stimmen:** Nutzungsbedingungen je Dienst prüfen; im Zweifel nicht.

## 6. Ablage, Packen, Testen

1. Dateien nach `assets/sound/raw/` mit Namen nach dem Schema `<kategorie>_<sprecher>_<nr>.wav` (auch `.flac`, `.mp3`, `.ogg`).
   Rohdateien als WAV oder FLAC committen (FLAC halbiert die Größe; 90 Takes ≈ 4–5 MB).
2. Je Datei eine Zeile in `assets/sound/QUELLEN.md`.
3. Packen:
   ```
   pip install numpy soundfile soxr lameenc
   python3 tools/sound-packer/pack.py
   ```
   Das Skript macht Mono, 44.1 kHz, schneidet Stille ab, gleicht die Lautheit je Kategorie an (Spitze höchstens −1 dBFS),
   blendet ein und aus und schreibt MP3 (96 kbit/s; MP3 statt OGG wegen Safari/iOS) als Base64-Bundle – läuft auch von file://.
   **Lizenzsperre:** fehlt eine Zeile in `QUELLEN.md` oder ist die Lizenz nicht erlaubt, wird nichts geschrieben. Zu kurze oder
   stumme Takes werden ebenfalls abgelehnt.
4. **Anhören im Zusammenhang:** `docs/neon-regent/klangprobe.html` öffnen – das Bundle wird automatisch geladen, alle Szenen
   (Überfahren, Panik, Vollstreckung) benutzen dann die Aufnahmen. Einzelne Dateien kann man auch direkt auf die Seite ziehen;
   ein Schalter vergleicht mit der synthetischen Stimme.
5. **Alle Takes nacheinander** (zum Aussortieren): `python3 tools/sound-packer/pack.py --preview vorschau.mp3` schreibt jeden Take
   so, wie das Spiel ihn hört (gleiche Verarbeitung und Lautheit), mit 0.45 s Pause, und gibt eine Zeitliste aus.

## 7. Wie das Spiel die Aufnahmen benutzt

- Jede Person hat einen Stimmtyp (`mann`, `frau`, `alt`, `jung`) und wird einem passenden Sprecher mit `angst`-Takes fest zugeordnet.
- Hat der Sprecher eine Kategorie nicht, kommt ein Take **gleichen Geschlechts** (erst die Kategorie, dann `angst`). `alt` ohne
  eigene Sprecher klingt wie ein Mann, `jung` wie eine Frau. **Nie das andere Geschlecht** – passt nichts, springt die Synthese ein.
- Pro Ereignis ein zufälliger Take unter den länger nicht gespielten, Tonhöhe ±5 % – keine hörbare Wiederholung.
- **Todesschrei** = ein `angst`-Take, der im Aufprall mit 15 ms Blende abreißt; darunter liegen die synthetischen Aufprall-Schichten.
- **Angefahren und überlebt:** Der Angstschrei bricht im Aufprall weich ab, dann ein `schmerz`-Take, dann zweimal `stoehnen`.
- Entfernung über Lautstärke, Tiefpass und Hall (PLAN §4.10); drinnen Raumhall, draußen gedämpft.
- Rückfall: Fehlt eine passende Aufnahme, nimmt das Spiel die synthetische Stimme aus `klangprobe.html` (läuft immer, klingt aber künstlich).
