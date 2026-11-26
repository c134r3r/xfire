# NEON REGENT – Welt, Daten und Tuning

Alle Zahlen hier sind **Startwerte**. Sie gehören in `C.*` (`neonregent/00-core.js`) bzw. die Datentabellen in
`neonregent/04-data.js`. Geschwindigkeiten in px/Tick (60 Ticks/s), Zeiten in Sekunden (beim Laden in Ticks umrechnen).

---

## 1. Maßstab und Konstanten

| Konstante | Wert | Bedeutung |
|---|---|---|
| `TILE` | 64 | px pro Kachel (Fahrspur = 1 Kachel, Gehweg = 1 Kachel) |
| `CELL` | 8 | Kacheln pro Zonen-Zelle (8×8 = 512 px) |
| `MAP_COLS`, `MAP_ROWS` | 38, 12 | Zonen-Raster (§2) |
| `MAP_TW`, `MAP_TH` | 306, 96 | Kacheln (38 × 8 + 2 für die Abschlussstraße im Osten) → 19 584 × 6 144 px |
| `FLOOR_H` | 22 | px pro Stockwerk |
| `LEAN_K`, `LEAN_MAX` | 1/1000, 0.65 | Gebäudeneigung (PLAN §5.2) |
| `ZOOM_FOOT` | 1.35 | Kamera-Zoom zu Fuß |
| `ZOOM_CAR_SLOW`, `ZOOM_CAR_FAST` | 1.15, 0.80 | Zoom im Auto, nach Tempo interpoliert |
| `CAM_LEAD_CAR` | 22 | Vorausschau = v × 22 px, max. 260 |
| `PED_R` | 7 | Radius Person |
| `PLAYER_WALK`, `PLAYER_SPRINT` | 2.0, 2.9 | Spieler zu Fuß |
| `STAMINA` | 100 (−0.8 / +0.4 pro Tick) | Sprint-Ausdauer |
| `DODGE` | 0.35 s, Cooldown 1 s | Ausweichrolle mit i-Frames |
| `PED_WALK`, `PED_FLEE` | 0.6, 1.7 | Passanten |
| `PANIC_R` | Schuss 400 · Explosion 600 · Unfall 200 · Leiche 150 · Ansteckung 120 | Panik-Auslöser |
| `SPAWN_RING` | 1.15–1.7 × halbe Bilddiagonale (Welt-px beim aktuellen Zoom) | Spawn außerhalb des Bildes |
| `DESPAWN` | 2.2 × halbe Bilddiagonale | |
| `PEDS_MAX` | Docks 32 · Neonmeile 48 · Krone 26 | ambient |
| `TRAFFIC_MAX` | Docks 14 · Neonmeile 22 · Krone 16 | ambient |
| `OD_MAX` | 12 | Ordnungsdienst gleichzeitig |
| `ENTER_R`, `INTERACT_R` | 40, 36 | Einsteigen, Interagieren |
| `OD_SIGHT`, `DRONE_SIGHT`, `GUNSHIP_SIGHT` | 520, 700, 800 | Sichtweite (mit Kachel-Sichtlinie) |
| `LIGHTMAP_SCALE` | 0.5 (Qualität niedrig: 0.33) | Lightmap-Auflösung |
| `LIGHTS_MAX` | 140 | Lichter pro Frame |
| `PARTICLES_MAX` | 1600 | wie Ironclad |
| `TEX_BUDGET` | 24 Mpx | LRU für Fassaden/Dächer |
| `CHUNK`, `CHUNKS_MAX` | 512 px, 24–48 | Boden-Chunks |
| `RAIN_DROPS` | 420 (Qualität 1) | Bildschirmraum-Regen |
| `INTERIOR_SHARE` | 0.10 | Anteil begehbarer normaler Gebäude (plus Dienste und Story-Orte) |
| `ZOOM_INSIDE` | 1.65 | Kamera-Zoom drinnen |
| `ROOF_FADE` | 0.08 pro Frame (≈ 0.4 s) | Übergang Dach weg / Dach zurück |
| `WALL_H`, `WALL_T` | 24, 6 | Innenwände: Höhe für die Neigung, Dicke |
| `DOOR_W` | 28 innen, 32 Eingang | Türbreite (nur Personen passen durch) |
| `ROOM_MIN` | 96 | BSP-Mindestraumgröße |
| `INDOOR_NAV` | 16 | Navigationsraster drinnen |
| `XRAY_ALPHA` | 0.3 | Nachbardächer über dem offenen Gebäude |
| `VOICES_MAX` | Schreie 4 · Schüsse 8 · Explosionen 4 · Motoren 3 · Sirenen 2 · gesamt 32 | Stimmen-Verwaltung |
| `REVERB` | Straße 1.6 s · Raum 0.4 s · Mausoleum 2.8 s | Hallzeiten |
| `DUCK` | Musik −6 dB / 1 s bei tödlichem Treffer, großer Explosion, MANDAT | Ducking |

---

## 2. Stadtplan

### 2.1 Zonen-Raster (38 × 12 Zellen, 1 Zeichen = 1 Zelle = 8 × 8 Kacheln)

```
           Spalte  0         1         2         3
                   01234567890123456789012345678901234567
           Zeile 0 ~DDDIIISSRRC~RRCCCRRCCRRR~VVPPVVVVVPPV
           Zeile 1 ~DaaIIISSRRC~R1CggCCCsCRR~VqqPVVCCVmmV
           Zeile 2 ~DaaII.3SRCRWCCCggCrCCCCR~VqqVVCCCVVVV
           Zeile 3 ~DDDIIffSt1R~RCPPCCCCuC3R~PPVVPpppVVPV
           Zeile 4 ~DDIIISS.RCR~RCPPC2CCCCCRWPPVVzpppPVVV
           Zeile 5 ~eDII2SkkRCR~CCCCCCbbC4CC~VVV.PpppVVVV
           Zeile 6 ~eDIISSkk5RC~RRC5CCCCCCRR~VCC2VPPPVVPP
           Zeile 7 ~DDDIIS.SR4R~RCCCCPPCCCCR~VCCVVVVVVnnV
           Zeile 8 ~DhhIISSSRRCWCC3CCPPCC6RR~VVVV7VVVVVVV
           Zeile 9 ~DDDIIIS7RCR~RRCCCCC7CCRRWVV1VVVVV3VVV
          Zeile 10 ~DDDDDISSR6R~RRRCCCCCRRRR~VVVVVVVVVV5V
          Zeile 11 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                   |-- DOCKS --||--- NEONMEILE --||--- KRONE ---|
                   Spalten 0–11 · Kanal 12 · 13–24 · Kanal 25 · 26–37
```

Im Norden und Osten liegt **Der Wall** (Stadtmauer, nur Deko am Kartenrand; dahinter die Ödnis aus IRONCLAD).
Westen und Süden sind Wasser (Meer bzw. Fluss).

### 2.2 Legende

| Zeichen | Bedeutung | Bebauung im Lot |
|---|---|---|
| `~` | Wasser | keine Straßen |
| `W` | Wasser mit **Brücke** auf der Nordkante | Brücken sind Tore (§2.4) |
| `D` | Hafen/Docks | Container-Stapel (Höhe 1–3 × 16 px, Lackmaske-Farben), Kran (Höhen-Prop 30 Stockwerke) je 2–3 D-Zellen, Poller am Kai, selten Bürohütte (2 Stockwerke) |
| `I` | Industrie | 1 Halle (2–4 Stockwerke, Wellblech), Schornsteine (Höhen-Prop 10–14 Stockwerke, Rauch), Hof mit Containern, Zaun |
| `S` | Slum | 4–8 Hütten (1–3 Stockwerke, 1×1–2×2 Kacheln), 1-Kachel-Gassen, Feuertonnen (Licht) |
| `R` | Wohnen | 1–2 Türme, 8–18 Stockwerke, Balkone/Wäscheleinen, selten Glas |
| `C` | Kommerz/Neon | 2–4 Gebäude, 4–12 Stockwerke, Neon-Schilder, Ladenbänder, 40 % Holo-Plakat auf dem Dach |
| `V` | Villen (Krone) | 1 Villa 2–5 Stockwerke, Garten, niedrige Mauer mit Tor |
| `P` | Platz/Park | keine Gebäude; Pflaster, tote Bäume/Holo-Bäume, Bänke, Brunnen/Holo-Säule |
| `.` | Parkplatz | Markierungen, 4–8 geparkte Autos, 2 Lichtmasten |
| `1`–`7` | Dienste (§4) | C-Gebäude mit eigenem Schild + Eingangsmarker auf dem Gehweg |
| `a`–`z` | **Landmarken** (§3) | eigenes Template; gleiche Buchstaben nebeneinander = **ein** zusammengelegtes Grundstück |

**Begehbar** (PLAN §5.9): 10 % der Gebäude in `R`, `C`, `I`, `S`, `V` (deterministisch per Seed), alle Dienste und die
Story-Orte `u`, `n`, `p` (optional `g`, `q`). Nie begehbar: `D`, `P`, `.`, Wasser. Innenraum-Typen: §14.

### 2.3 Generatorregeln

- Zelle `(c, r)` umfasst die Kacheln `x ∈ [8c, 8c+7]`, `y ∈ [8r, 8r+7]`.
- **Straßen**: Jede Land-Zelle hat eine 2 Kacheln breite Straße an der **Nordkante** (`y = 8r, 8r+1`) und an der
  **Westkante** (`x = 8c, 8c+1`). Ausnahme: Ist die Nachbarzelle oben bzw. links **derselbe Landmarken-Buchstabe**, entfällt die
  Straße dort (zusammengelegtes Grundstück). `W`-Zellen haben nur die Nordstraße (als BRIDGE), `~`-Zellen keine.
  Zusätzlich eine Abschlussstraße im Osten (`x = 304, 305`) neben allen Land-Zellen der Spalte 37.
- **Kreuzungen**: 2×2-Kacheln, wo Nord- und Weststraße einer Zelle zusammentreffen (bzw. die Abschlussstraße kreuzt) → JUNCTION.
  Fehlt ein Arm (Wasser, Landmarke), entsteht T- oder L-Kreuzung bzw. Sackgasse (für den Verkehr markieren, PLAN §4.5).
- **Spurrichtung** (Rechtsverkehr): horizontale Straße – obere Kachelreihe nach **Westen**, untere nach **Osten**;
  vertikale Straße – linke Kachelspalte nach **Süden**, rechte nach **Norden** (wie concept.html).
- **Zebrastreifen**: das Kachelpaar direkt vor jeder Kreuzung in jedem Arm (bleibt befahrbar).
- **Gehweg**: jede Nicht-Straßen-Landkachel, die (8er-Nachbarschaft) an eine Straße/Kreuzung grenzt (wie concept.html).
  Nicht auf Brücken über Wasser.
- **Kai**: Landkacheln an Wasser, die weder Straße noch Gehweg sind → QUAY (Kaimauer, Poller).
- **Lot**: Rest der Zelle; Standard-Lot = 4 × 4 Kacheln. Gebäude nach Zonen-Code (§2.2), Höhen in Stockwerken × 22 px.
- Gebäude bekommen `seed = hash(c, r, i)` → Texturen und Lichter sind deterministisch.
- Laternen: auf Gehwegkacheln an der Bordsteinkante, alle 3 Kacheln (wie concept.html); in `S` seltener, in `C` häufiger.
- Gullydeckel: zufällig auf Fahrbahnkacheln (ca. 1 pro Straßenkreuzungsarm), 40 % mit Dampf.
- Seed der Stadt: `?seed=` (Default 7741). Plan + Seed bestimmen die Stadt vollständig.

### 2.4 Tore

| Tor | Brücken-Zellen | Verbindet | Öffnet |
|---|---|---|---|
| `tor1` | (12, 2), (12, 8) | Docks ↔ Neonmeile | nach M04 |
| `tor2` | (25, 4), (25, 9) | Neonmeile ↔ Krone | bei Beginn von Akt III (Vela hackt sie) |

Geschlossen: OD-Kontrollpunkt auf der Brücke (Schranke `schranke`, Häuschen, 2 Beamte, Schild „PASSIERSCHEIN ERFORDERLICH").
Durchbrechen mit dem Auto ist unmöglich (solide); in Akt I–II führt Gewalt am Kontrollpunkt zu Fahndungsstufe 2.

---

## 3. Landmarken

Koordinaten = Zellen (Spalte, Zeile). Missionspositionen `{ lm, dx, dy }` beziehen sich auf das Zentrum des Lots.

| ID | Name | Zellen | Inhalt (Template) | Missionen |
|---|---|---|---|---|
| `a` | Containerterminal Dock 3 | (2–3, 1–2) | Container-Stapel, 2 Kräne, Tor mit Wachhäuschen, Laster-Spawn an der Südseite | M01 |
| `t` | Terminalplatz | (9, 3) | Platz, MANDAT-Terminal (magenta), Holo-Säule mit Regentenbild | M00 |
| `f` | Fischmarkt | (6–7, 3) | 3 Marktstände (`stand1–3`) unter Planen, Kühlkisten, Dampf, Lampenkette, Händler-Spawns, Kastenwagen-Platz | M02 |
| `k` | Chipklinik Docks | (7–8, 5–6) | weißes Gebäude, 6 Stockwerke, Cyan-Kreuz-Schild, **kleines Schlüssel-Emblem**; Ladehof im Westen (Ziel M01); Parkplatz mit dem „Zuteilungs"-Wagen | M00, M01 |
| `h` | Schmugglerhof der Möwen | (2–3, 8) | Lagerhalle (2 Stockwerke), Hof mit 3 Treibstofftanks, Kisten, Möwen-Graffiti, Zaun + Tor | M04 |
| `e` | Altes Fährterminal / Archiv | (1, 5–6) | Ruine am Wasser (teils überdacht), Anleger; ab M09 **sichere Zone** (keine Fahndung im Radius 300 px), Velas Projektor, Safehouse | M09, Akt III |
| `g` | Casino „Goldene Krone" | (16–17, 1–2) | Hochhaus 12 Stockwerke, Kronen-Hologramm, Vorplatz mit Brunnen, Tiefgaragen-Rampe, Parkplatz | M05, M10 |
| `s` | Sendeturm Neonmeile | (21, 1) | schlanker Turm (Höhen-Prop 30 Stockwerke, rote Blinklichter), Sockelbau, Hof für den Sendewagen | M08 |
| `r` | Rennplatz | (19, 2) | Startaufstellung (Gittermarkierung), niedrige Tribüne, Holo-Werbung „NACHTRENNEN" | M06 |
| `u` | Untergrundklinik | (21, 3) | unscheinbarer Bau in der Gasse, 4 Generatoren im Hof; **begehbar** (Template: Behandlungsraum mit Feldbetten, Lager, Hinterausgang) | M07 |
| `b` | Bibliotheksruine | (19–20, 5) | Ruine ohne Dach (Ruinen-Typ), Regalreste, Innenhof, Projektor; nur zu Fuß (Poller) | M09 |
| `q` | OD-Hauptquartier | (27–28, 1–2) | Festung 8 Stockwerke, Fahrzeughof mit Streifen + 2 geparkten Tribunal-Panzern, Funkmast, Mauer mit Toren; OD-Spawn der Krone | M11 |
| `m` | MANDAT-Turm | (35–36, 1) | 40 Stockwerke (höchstes Gebäude), MANDAT-Auge als Dach-Hologramm, 4 Uplink-Schüsseln auf Lot/Nachbarflächen | M13 |
| `p` | Regentenpalast / Mausoleum | (31–33, 3–5) | Palast 14 Stockwerke mit Kuppel + Holo-Krone, Garten, Mauern, 4 Schildgeneratoren, Haupttor im Westen. **Mausoleum** = Innenraum-Template des Palasts (Thronsaal, 2 Serverhallen, Gänge, Kernraum); wird beim Kuppelsturz geöffnet und bleibt offen | M14 |
| `z` | Ewige Flamme | (30, 4) | Monument mit Flamme (Feuerlicht), Platz; Sammelpunkt im Finale | M14 |
| `n` | Klinik Null | (35–36, 7) | weißer Komplex 7 Stockwerke, **begehbar** (Template: Labor, Flur, Zellentrakt mit 3 Zellentoren), Garage mit Panzer-Ambulanz | M12 |

---

## 4. Dienste, Datenchips, Respawn

### 4.1 Dienste

| Code | Dienst | Docks | Neonmeile | Krone |
|---|---|---|---|---|
| `1` | Kapselhotel (speichern) | (10, 3) „Möwe" | (14, 1) „Lichtwabe" | (28, 9) „Stille" |
| `2` | Chip-Wäsche (reparieren, lackieren, Fahndung löschen) | (5, 5) | (18, 4) | (29, 6) |
| `3` | Waffenhändler | (7, 2) „Rostfeder" | (23, 3) „Kaliber" · (15, 8) „Funkenflug" | (34, 9) |
| `4` | OD-Wache (Respawn nach Verhaftung) | (10, 7) | (22, 5) | `q` |
| `5` | Klinik (Respawn nach Tod) | (9, 6) | (16, 6) „Lichtblick" | (36, 10) |
| `6` | Exportgarage | (10, 10) | (22, 8) | – |
| `7` | Kopfgeld-/Kurier-Terminal | (8, 9) | (20, 9) | (30, 8) |

Ab M09 zusätzlich: `e` (Archiv) = Safehouse + sichere Zone. **Alle Dienste sind begehbare Innenräume** (§14).

### 4.2 Datenchips (12)

| # | Zelle | Versteck |
|---|---|---|
| 1 | (1, 9) | Pier-Ende zwischen Containern |
| 2 | (5, 1) | Industriehof hinter dem Zaun |
| 3 | (8, 8) | Slumgasse unter einer Wellblechplane |
| 4 | (11, 0) | Hinterhof eines Wohnblocks am Wall |
| 5 | (16, 2) | Casino-Parkplatz, Südostecke |
| 6 | (13, 5) | Uferpromenade am Kanal |
| 7 | (21, 3) | Hinterausgang der Untergrundklinik |
| 8 | (24, 10) | Gasse am Südkanal |
| 9 | (29, 1) | Park hinter dem OD-Hauptquartier |
| 10 | (36, 1) | Vorplatz des MANDAT-Turms, Ostseite |
| 11 | (34, 4) | Palastmauer Ost, außen |
| 12 | Mausoleum | automatisch im Finale (M14) |

Platzierung: die Lot-/Kai-/Gassen-Kachel der Zelle, die am weitesten von der Straße entfernt ist. Text: STORY.md §6.5.

### 4.3 Respawn und Strafen

| Ereignis | Ort | Strafe |
|---|---|---|
| Verhaftet | nächste `4` (Krone: `q`) | −10 % Credits (min. 100), alle Waffen außer Pistole weg, Fahndung 0 |
| Ausgelöscht (Tod) | nächste `5` | −10 % Credits (min. 100), Panzerung weg, Fahndung 0 |
| In Mission | Startmarker der Mission | Checkpoint-Zustand (PLAN §7.7) |

---

## 5. Fahrzeuge

| id | Name | L × B (px) | Masse | top | accel | grip | steer | HP | Expl. | Hinweis |
|---|---|---|---|---|---|---|---|---|---|---|
| `kapsel` | Kapsel (Kleinstwagen) | 52 × 26 | 0.7 | 7.0 | 0.16 | 0.30 | 0.060 | 60 | 1.3 | Docks häufig |
| `limo` | Limo | 70 × 30 | 1.0 | 8.2 | 0.15 | 0.26 | 0.052 | 90 | 1.6 | Standard |
| `taxi` | Taxi | 70 × 30 | 1.0 | 8.2 | 0.15 | 0.26 | 0.052 | 100 | 1.6 | leuchtendes Dachschild |
| `pfeil` | Pfeil (Sportwagen) | 68 × 30 | 0.9 | 10.5 | 0.22 | 0.30 | 0.058 | 75 | 1.6 | M06 |
| `gleiter` | Gleiter (Schwebewagen) | 66 × 32 | 0.9 | 9.5 | 0.18 | 0.12 | 0.050 | 70 | 1.7 | Unterboden-Neon, schwebt, keine Bremsspuren |
| `pritsche` | Pritsche (Pickup) | 74 × 32 | 1.3 | 7.6 | 0.13 | 0.24 | 0.048 | 120 | 1.7 | |
| `kasten` | Kastenwagen | 78 × 34 | 1.6 | 6.6 | 0.11 | 0.22 | 0.042 | 140 | 1.8 | M02 |
| `laster` | Laster mit Container | 124 × 38 | 3.2 | 5.6 | 0.07 | 0.20 | 0.032 | 260 | 2.2 | M01 |
| `bike` | Kurier-Bike | 40 × 14 | 0.4 | 11.0 | 0.25 | 0.34 | 0.075 | 40 | 1.0 | 30 % der Treffer gehen an den Fahrer |
| `od_streife` | OD-Streife | 72 × 30 | 1.1 | 9.4 | 0.18 | 0.28 | 0.055 | 130 | 1.7 | Blaulicht, 2 Beamte |
| `od_abfang` | OD-Abfangjäger | 70 × 30 | 1.0 | 11.0 | 0.22 | 0.30 | 0.058 | 110 | 1.6 | ab Stufe 3 |
| `od_sturm` | OD-Sturmwagen | 90 × 38 | 2.4 | 6.8 | 0.10 | 0.22 | 0.040 | 320 | 2.0 | bringt 4 Sturmtruppler, ab Stufe 4 |
| `tribunal` | Tribunal-Panzer | 80 × 44 | 6.0 | 4.3 | 0.16 | – | – | 600 | 3.0 | Ironclad-Panzer-Fahrmodell, Kanone, zerquetscht Autos |
| `erbe_limo` | Erben-Limousine (gepanzert) | 84 × 34 | 2.0 | 8.6 | 0.15 | 0.26 | 0.046 | 400 | 2.0 | Konvois |
| `sendewagen` | Sendewagen | 80 × 34 | 1.8 | 6.2 | 0.10 | 0.22 | 0.040 | 300 | 2.0 | M08, Antennenmast |
| `ambulanz` | Panzer-Ambulanz | 84 × 36 | 2.2 | 8.0 | 0.13 | 0.24 | 0.044 | 450 | 2.2 | M12, wirft Chipminen |
| `tresor` | Tresorwagen | 92 × 38 | 3.0 | 6.4 | 0.09 | 0.22 | 0.038 | 520 | 2.4 | M10, verliert Geld |
| `gunship` | OD-Gunship (Luft) | – | – | 2.6 | – | – | – | 160 | 1.8 | Ironclad `heli`, nicht fahrbar |

**Verkehrsmix** (Gewichte): Docks – kapsel 25, pritsche 25, kasten 20, laster 15, limo 10, bike 5 ·
Neonmeile – limo 30, taxi 20, pfeil 15, gleiter 15, bike 10, kapsel 10 · Krone – limo 35, gleiter 25, pfeil 20, erbe_limo 10, taxi 10.

**Lackfarben** (zivil, zufällig): `#3a6ea5 #b0305e #d8d2c4 #2a2a30 #3f9a8a #7a3fb0 #8a8f99 #a04a2a` · Taxi `#c9a227` ·
OD `#d8dde6` mit blauem Streifen `#2a6bff` · Erben `#1a1a1f` mit Gold `#c9a227`.

**Emitter** (Anteile der halben Länge L/2 bzw. halben Breite B/2, +x = vorne): Scheinwerfer `(0.95, ±0.62)`,
Rücklichter `(−0.97, ±0.62)`, OD-Blaulicht `(0, ±0.5)` rot/blau, Taxischild `(−0.1, 0)` gelb, Gleiter-Unterboden `(0, 0)`
Radius 50 in Neonfarbe, Sendewagen-Mastspitze rot blinkend. Kaputte Scheinwerfer (HP < 30 %) flackern, Wrack = aus.

---

## 6. Waffen

| id | Name | Schaden | Rate (Ticks) | Tempo | Streuung | Reichw. | Muni max | Preis | Herkunft |
|---|---|---|---|---|---|---|---|---|---|
| `fist` | Faust | 8 | 20 | – | – | 18 | ∞ | – | Start |
| `pistol` | Pistole „Bürgerwaffe" | 12 | 16 | 15 | 0.03 | 600 | 240 | – | M02 (von MANDAT) |
| `smg` | MP „Hornisse" | 7 | 5 | 16 | 0.09 | 520 | 400 | 1500 (+300 je 200) | M03 / Händler |
| `shotgun` | Schrotflinte | 6 × 7 | 42 | 13 | 0.32 | 300 | 60 | 2500 (+300 je 30) | Händler (Neonmeile) |
| `flamer` | Flammenwerfer | 1.4/Tick | Strahl | – | – | 140 | 400 | 4000 (+400) | M07 / Händler |
| `rocket` | Raketenwerfer | 70 + Splash r 80 | 70 | 9 (beschl.) | 0 | 900 | 10 | 8000 (+1000 je 5) | Händler ab Akt II |
| `emp` | EMP-Granate | 15 an Drohnen; lähmt 4 s, r 110 | 40 | Bogen 300 px | – | 300 | 10 | 300/Stück | M08 / Händler |
| `rail` | Schienengewehr | 45, durchschlägt | 60 | Strahl (Ironclad `rail`) | 0 | 900 | 30 | – | Vela nach M09 |
| `tankgun` | Panzerkanone | 40 + Splash r 60 | 30 | 17 | 0.02 | 800 | ∞ | – | nur Tribunal |

Drive-by: nur `pistol`/`smg`, Streuung × 1.5. Flammenwerfer: Autos brennen nach 1 s Beschuss (Brand-Timer 4 s → Explosion),
Personen brennen (2 Schaden/Tick, 2 s, fliehen). Raketen: Ironclad-Rakete mit Rauchspur, Explosion Größe 1.4.

## 7. Power-ups (Ironclad-Kisten „?")

| id | Name | Dauer | Wirkung | Ironclad-Vorlage |
|---|---|---|---|---|
| `rapid` | Feuerrate | 10 s | Feuerrate × 2 | `rapid` |
| `shield` | Panzerfeld | 8 s | unverwundbar | `shield` |
| `slowmo` | Reflexbooster | 7 s | Gegner und Verkehr × 0.35 | `slowmo` |
| `drones` | Kampfdrohnen | 15 s | 2 Drohnen schießen mit | `drones` |
| `repair` | Medikit | sofort | +40 Vital (im Auto: +40 % Fahrzeug-HP) | `repair` |
| `empwave` | EMP-Welle | sofort | alle Fahrzeuge/Drohnen im Bild 4 s lahm, Drohnen −30 | `nuke` (umgedeutet) |
| `bribe` | Bestechungschip | sofort | Fahndung −1 Stufe | neu |
| `vest` | Panzerweste | sofort | Panzerung 100 | neu |

Ca. 6 feste Kisten-Orte pro Distrikt (Gassen, Hinterhöfe, Parkplätze), Respawn nach 3 min; Bosse droppen 2 Kisten.

---

## 8. Einheiten und Props

### 8.1 Personen und Drohnen

| id | Rolle | HP | Waffe | Tempo | KI (Ironclad-Basis) | Fraktion |
|---|---|---|---|---|---|---|
| `civ` | Passant (Looks `civ_mantel`, `civ_hoodie`, `arbeiter`) | 20 | – | 0.6 / Flucht 1.7 | wander / flee | civ |
| `punk` | Punk | 35 | Faust | 0.7 / 2.0 | wander, wehrt sich (`charge`) | civ |
| `haendler` | Händler (M02) | 30 | – | 0.6 | stand / flee | civ |
| `od` | OD-Beamter | 40 | Pistole | 1.8 | `arrest` (Stufe 1) / `shoot` | od |
| `od_sturm` | OD-Sturmtruppler | 70 + 50 Panzerung | MP | 1.7 | `shoot` | od |
| `od_drohne` | OD-Drohne (Luft) | 25 | MG, 4 Schaden | 2.6 | `heli` vereinfacht, Suchscheinwerfer | od |
| `od_ziel` | Zielerfasser-Drohne (Luft) | 30 | Laser, 16 Schaden | 1.6 | `snipe` (Laser-Telegraph 62 Ticks) | od |
| `kroll` | Einsatzleiter Kroll (M03) | 120 | MP | 1.8 | ally | od |
| `erbe` | Erben-Schläger | 45 | Pistole oder Schlagstock | 1.9 | `shoot` / `charge` | erbe |
| `erbe_garde` | Erben-Garde | 90 | Schrotflinte | 1.7 | `shoot` (ideal 160 px) | erbe |
| `moewe` | Möwen-Schmuggler | 40 | Pistole | 1.8 | `shoot` | moewe |
| `aufruehrer` | Aufrührer (M03) | 35 | Pistole oder Rohr | 1.8 | `shoot` / `charge` | aufruehrer |
| `klinikwache` | Klinikwache (M07) | 40 | Pistole | 1.7 | `shoot` | klinik |
| `stoerer` | Störer-Drohne (M08, Luft) | 25 | MG, 3 Schaden | 2.8 | `heli`, zielt auf den Sendewagen | stoerer |
| `archivist` | Archivist (Velas Leute) | 60 | MP | 1.8 | ally | ally |
| `vela` | Vela | 100 (unverwundbar in Zwischensequenzen) | – | 1.9 | follow | ally |

### 8.2 Bosse

| id | Wer | HP | Angriffe | Basis |
|---|---|---|---|---|
| `buchhalterin` | Die Buchhalterin (zu Fuß + 4 Leibwächter) | 400 | MP-Salven; „Geldbomben" aus dem Koffer (Bodenring-Telegraph wie Ironclad-Mörser) | `shoot` + Mörser-Muster |
| `vollstrecker` | Der Vollstrecker im Kommandopanzer | 2200 | Ironclad-Warlord: Fächersalve, Mörserregen, Raketenring, Ansturm; Enrage 50 % | **`updateBoss`** |
| `chirurg` | Der Chirurg (zu Fuß) | 350 | 6 Skalpell-Drohnen (umkreisen, stoßen zu), wirft Chipminen (Ironclad-Minen) | Drohnen-Logik umgedreht |
| `stimme` | Die Stimme im Gunship | 900 | MG-Schwenk, Raketenpaare, fliegt über Dächer | `heli` als Boss |
| `notar` | Der Notar im Erbschaftsmech | 3000 | MG-Schwenk (`circle`-Bursts), Mörserregen (4 Ringe), Chip-Puls (expandierender Ring, ausweichen/rollen), ruft 2 Garde; Enrage 40 %: schneller + Raketenring | **`updateBoss`** (4 Muster) |
| `kern` | MANDAT-Kern (stationär) | 800 | spawnt alle 8 s 2 Drohnen; erst verwundbar, wenn der Notar tot ist | – |

### 8.3 Props

| type | Name | HP | Kollision | Explodiert | Verwendung |
|---|---|---|---|---|---|
| `stand` | Marktstand | 60 | 48 × 32 | nein (Trümmer) | M02 |
| `barrikade` | Barrikade | 80 | 64 × 20 | nein | M03 |
| `treibstoff` | Treibstofftank | 50 | r 20 | ja, 2.0, Kettenreaktion | M04 |
| `generator` | Generator | 60 | 32 × 32 | ja, 1.4 | M07 |
| `funkmast` | OD-Funkmast | 300 | r 20 | ja, 2.2 | M11 |
| `zellentor` | Zellentor | 120 | 48 × 12 | nein | M12 |
| `uplink` | Uplink-Schüssel | 250 | r 26 | ja, 2.0 | M13 |
| `schildgen` | Schildgenerator | 300 | r 28 | ja, 2.4 | M14 |
| `pylon` | Server-Pylon | 200 | r 18 | ja, 1.6 | M14 |
| `kern` | MANDAT-Kern | 800 | r 40 | ja, 4.0 | M14 |
| `fass` | rotes Fass (Ironclad) | 20 | r 13 | ja, 1.2, Kette | überall |
| `kiste` | Power-up-Kiste (Ironclad) | 30 | 34 × 34 | → Power-up | überall |
| `terminal` | MANDAT-Terminal | ∞ | 20 × 14 | – | Interaktion |
| `schranke` | Tor-Schranke | ∞ | 128 × 12 | – | Tore |
| `geschuetz` | Stationäres Geschütz (Ironclad-Turm) | 150 | r 16 | ja, 1.4 | M13, M14 |

---

## 9. Fahndung

### 9.1 Delikte (Punkte)

| Delikt | Punkte |
|---|---|
| Passant angefahren (überlebt) | +3 |
| **Passant getötet** (überfahren, erschossen, verbrannt) | **+8** → sofort Stufe 1 |
| Schuss/Salve in Sicht eines OD (max. 1 × pro s) | +2 |
| Auto vor OD-Augen gestohlen / aufgebrochen | +4 |
| OD-Fahrzeug gekapert | +15 (Untergrenze Stufe 1, solange du drin sitzt) |
| OD-Beamter verletzt / getötet | +10 / +25 |
| OD-Fahrzeug zerstört / Drohne zerstört | +20 / +10 |
| Explosion mit Passanten im Radius | +6 |
| Gewalt am Tor-Kontrollpunkt (Akt I–II) | sofort Stufe 2 |

Alle Delikte zählen **überall** („Mandatsaugen" = totale Überwachung). Ausnahme: Ziele mit Missionsimmunität.

### 9.2 Stufen

| Stufe | ab Punkten | Einheiten (gleichzeitig) | Verhalten | Abklingen (unbeobachtet) |
|---|---|---|---|---|
| 1 | 6 | 2 Fußstreifen + 1 Streife | wollen **verhaften**, schießen nur zurück | 8 s |
| 2 | 25 | 3 Streifen + 2 Fuß | rammen, steigen aus, Pistolen | 12 s |
| 3 | 60 | 4 Streifen + 1 Abfangjäger + Straßensperren + 1 Drohne | aggressiv, Sperren voraus, Drohne hält Sicht | 16 s |
| 4 | 110 | + 1 Sturmwagen (4 Truppler) + 1 Gunship | MPs, Gunship (Ironclad `heli`) | 22 s |
| 5 | 180 | + 1–2 Tribunal-Panzer + 2 Zielerfasser-Drohnen | alles | 30 s |

Max. 240 Punkte. Nach Ablauf der Abklingzeit ohne Sichtkontakt fällt die Stufe um 1 (Punkte = Schwelle der neuen Stufe),
der Timer startet neu. HUD: Schlüssel blinken, solange dich ein OD sieht; „◈ VERBORGEN", wenn nicht (Ironclad `hidden`).

### 9.3 Verhaften, Chip-Wäsche, Bestechung

- **Verhaften** nur bei Stufe ≤ 2: zu Fuß ein Beamter < 20 px für 1.2 s, während du langsamer als 1.2 bist; im Auto Tempo
  < 0.5 für 2 s und ein Beamter an der Fahrertür. Strafe §4.3.
- **Chip-Wäsche** `2`: nur im Auto hineinfahren → Reparatur 100 %, neue Lackfarbe, Fahndung 0. Kosten 300 + 400 × Stufe.
- **Bestechungschips** (Kisten-Power-up `bribe`): −1 Stufe.
- Akt III: in der Krone Untergrenze Stufe 1, OD schießt ab Stufe 1. Nach M11 Maximum Stufe 3. Nach M13 Abklingzeit halbiert.

---

## 10. Wirtschaft

| Posten | Betrag |
|---|---|
| Missionsbelohnungen | siehe STORY.md (gesamt ca. 45 000 CR + Beute) |
| Passant / OD / Erbe droppt | 5–30 / 20–60 / 50–150 CR |
| Kurier · Kopfgeld · Export | 500–1500 · 1000–2500 · 800–3000 CR |
| Waffen und Munition | §6 |
| Panzerweste beim Händler | 500 CR |
| Chip-Wäsche | 300 + 400 × Fahndungsstufe |
| Speichern im Kapselhotel | kostenlos |
| Strafe Verhaftung / Tod | −10 % (min. 100) |

## 11. Lichttypen (Lightmap, PLAN §5.3)

| Typ | Farbe | Radius (Welt-px) | Intensität | Animation |
|---|---|---|---|---|
| Laterne Natrium | `#ffb35c` | 128 | 0.95 | 5 % flackern |
| Laterne LED | `#cfe6ff` | 120 | 0.9 | – |
| Neon-Spill an Fassaden | `#ff3fa4` `#3fe8ff` `#9dff4a` `#a66bff` `#ffb35c` | 124 | 1.0 | seltenes Flackern |
| Scheinwerferkegel | `#fff2c8` | Kegel 260 × 160 | 0.9 | aus bei Wrack |
| Rücklicht / Bremslicht | `#ff2a3a` | 26 / 40 | 0.8 / 1.0 | – |
| OD-Blaulicht | `#ff2a3a` ↔ `#2a6bff` | 240 | 1.0 | Wechsel 4 Hz |
| Drohnen-Suchscheinwerfer | `#e8f4ff` | 90 (Bodenkreis) | 0.9 | folgt dem Spieler |
| Feuer, Brand, Feuertonne | `#ff8a30` | 90–200 | 0.8 | flackern |
| Explosion (`light`-Partikel) | `#ff8a30` | 150 × √Größe | kurz | – |
| Mündungsfeuer | `#ffb050` | 60 | 4 Frames | – |
| Spieler-Eigenlicht | `#bfe8ff` | 60 | 0.6 | immer (Lesbarkeit) |
| Missionsmarker | `#3fe8ff` | 92 | 1.0 | pulsiert |
| Treuechip-Punkt (Glow, kein Lightmap-Licht) | `#ff2030` | 8 | 0.85 | pulsiert; nach dem Ende aus |

## 12. Farben

| Rolle | Wert |
|---|---|
| UI Akzent / hell | `#3fe8ff` / `#a8f6ff` |
| MANDAT (Pager, Auge) | `#ff3fa4` |
| Gefahr | `#ff3b4a` · Gold (Timer, Schlüssel) `#ffd84a` |
| Text / gedämpft | `#e6ecf5` / `#8a93a6` · Panel `rgba(8,10,18,0.80)` |
| Spieler | `#5fd4e6` (wie Ironclad) |
| Vela | `#e8fbff` + Cyan |
| Lightmap-Umgebung | Docks `#22303a` (dunkel, grünlich) · Neonmeile `#33305a` (heller, violett) · Krone `#26304e` (kühl) · Konzept `#2a3150` |
| Morgengrauen (Ende) | Umgebung `#ffc9a0`, danach Ironclads Wüstenpalette (`#9c7a54` … Akzent `#ff7a2e`) |

## 13. Audio

| Klang | Rezept / Quelle |
|---|---|
| Pistole, MP, Schrot | Ironclad `SFX.enemyGun` / `cannon`, Tonhöhe/Länge variiert |
| Flammenwerfer | XFire `sfx.js` (Flamer-Rezept) |
| Rakete, Explosion, Schiene | Ironclad `rocket`, `explode` (mit Budget), `rail` |
| EMP | Sägezahn-Abwärtssweep + knisterndes Bandpass-Rauschen |
| Motor (Loop) | 2 Oszillatoren (Saw + Square), Tiefpass nach Drehzahl; max. 3 gleichzeitig |
| Reifenquietschen | Bandpass-Rauschen, Lautstärke nach Querschlupf |
| Hupe | 2 Rechtecktöne 350/440 Hz |
| Crash / Glas | Ironclad `crush` + Metall-Ping (XFire) / Hochpass-Rauschbursts |
| Sirene | 2-Ton 650/900 Hz (Rechteck → Tiefpass), 0.5 s Wechsel; Lautstärke/Tonhöhe nach Abstand |
| Gunship-Rotor | amplitudenmoduliertes Rauschen 18 Hz |
| Schritte | kurze Rausch-Ticks, Filter je Untergrund (Asphalt, Pfütze, Metall) |
| Regen, Stadt, Neon | gefiltertes Rauschen (Regen-Loop), Tiefpass-Brummen + ferne Hupen, 120-Hz-Summen nahe Neon |
| **Schreie** (Angst, Schmerz, Todesschrei, Panik, Brand) | `klangprobe.html` → `scream()`; Stimmtypen und Regeln: PLAN §4.10 |
| **Überfahren** (tödlich / verletzt) | `klangprobe.html` → `runOver()`: Motor, Angstschrei (reißt ab), Masse 62→30 Hz, Punch 190→85 Hz, Körper 750 Hz, Knacken, Achsen-Doppelschlag, Splat, Bremse, Umstehende |
| Stöhnen am Boden | `klangprobe.html` → `groan()` |
| Panik der Menge | `klangprobe.html` → `panic()`: 7 Stimmen, Laufschritte, Straßenhall |
| Verdeckung / Innen-Außen | Tiefpass 1.2 kHz −6 dB (Gebäude dazwischen) / Tiefpass 900 Hz −8 dB (Spieler drinnen) |
| Innenraum-Atmosphären | WORLD.md §14, je Raumtyp |
| Schiebetür | Bandpass-Rauschen 1.2 → 3 kHz, 0.25 s, + Klick |
| Treuechip | Sinus 1.6 kHz; Vollstreckung: `klangprobe.html` → `execution()` (Summen, 3 Pieptöne 1.2/1.4/1.6 kHz, Entladung 2.6 kHz → 55 Hz, erstickter Laut, Sturz, Tinnitus 3.8 kHz) |
| MANDAT | `klangprobe.html` → `mandatCall()`: Jingle E5–B4–E4 (Rechteck + Hall), Maschinenstimme (XFire-Vocoder, ~100 Hz); Pager-Klicks |
| Vela / OD-Funk | XFire `radioVoice` |
| Glitch | gestuftes Rauschen (Bitcrush-artig), 80–200 ms |
| Musik | Ironclad-Sequencer als Synthwave (Arp, Pad, Bass); Layer nach Fahndung/Kampf; Finale-Thema; Morgengrauen (Dur) |
| Radio (M11) | NEON FM (Synthwave) · KRACH 9 (Industrial) · STIMME DES REGENTEN (Jingle, Vocoder-Geplapper, Ticker als Untertitel) |

## 14. Innenräume (begehbare Gebäude)

| Gebäude (Zone/Code) | Innenraum-Arten (Gewicht) | Räume | Möbel / Props | Licht | Bewohner | Beute | Klang |
|---|---|---|---|---|---|---|---|
| `C` Kommerz | Nudelbar 3 · Bar 3 · Spielhalle 2 · Pfandhaus 1 · Imbiss 2 | Gastraum (Eingang), Küche, Lager, WC, Hinterzimmer | Theke, Hocker, Tische, Automaten, Regale | warm + Neon (pink/cyan) | Wirt, 2–4 Gäste, Koch | Credits, Medikit | Bar-Musik (draußen dumpfer Bass), Gläser, leises Formant-Gemurmel |
| `R` Wohnen | Wohnungen (Flur + 2–3 Zimmer) 5 · Waschküche 1 | Flur, Wohnzimmer, Schlafzimmer, Küche, Bad | Sofa, Bett, Tisch, Fernseher (flackerndes Blau), Kühlschrank | warm, TV-Blau | 1–3 Bewohner | Credits, Munition | TV-Geplapper, Kühlschrank-Brummen |
| `I` Industrie | Lagerhalle 3 · Werkstatt 2 · Schlachterei 1 | eine große Halle + Büro | Kisten, Regale, Maschinen, Gabelstapler (steht), rote Fässer | kalte Röhren, flackernd | 1–2 Arbeiter | Munition, Fässer | Maschinen-Brummen, Tropfen |
| `S` Slum | Hütte 4 · Hinterhof-Werkstatt 1 | 1–2 Räume | Matratzen, Feuertonne, Kisten | Feuer | 1–3 | wenig | Feuerknistern, Regen auf Blech (laut) |
| `V` Villa (Krone) | Villa 1 | Flur + 4–6 Räume | Teppiche, Sofas, Flügel, Statuen | warm, Kronleuchter | Diener; Akt III: Erben (feindlich) | viel Credits | leise synthetische Klassik, Uhrticken |
| `1` Kapselhotel | fest | Empfang + Kapselgang | Schlafkapseln (64 × 32 px), Automaten | kaltes Cyan | Empfang | – | Lüftung, Schnarchen |
| `3` Waffenhändler | fest | Laden + Lager | Theke, Wandregale mit Waffen | warm | Händler | – | Metallklicken |
| `5` Klinik | fest | Empfang, Behandlung, Betten | Betten, Geräte | kaltes Weiß | Personal, Patienten | Medikits | Piepen, Lüftung |
| `4` OD-Wache | fest | Wache, Zellentrakt | Zellen, Schreibtische, Spinde | kalt | OD | – | Funk, Gittertüren |
| `7` Kopfgeld-Büro | fest | ein Raum | Terminal-Wand, Stühle | magenta (MANDAT) | Schreiber | – | Terminal-Piepen |
| `u` Untergrundklinik (M07) | Template | Behandlungsraum, Lager, Hinterausgang | Feldbetten, Generator-Kabel | warm, flackernd | Dr. Marten, Patienten | Datenchip 7 am Hinterausgang | Generatorbrummen |
| `n` Klinik Null (M12) | Template | Labor, Flur, Zellentrakt (3 Zellen) | OP-Tisch, Chip-Regale, Zellentore | kaltes Weiß | Wachen, Gefangene | Chip-Schlüssel | Piepen, Rufe der Gefangenen |
| `p` Mausoleum (M14) | Template | Thronsaal, 2 Serverhallen, Gänge, Kernraum | Thron mit Skelett, Server-Pylone, MANDAT-Kern | Kern-Cyan, rotes Notlicht | Erben-Garde, Notar | Datenchip 12 | Server-Lüfter, Kern-Puls, großer Hall (2.8 s) |

Namen der Innenräume (HUD-Karte „INNENRAUM · …"): STORY.md §6.2.
