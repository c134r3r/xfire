'use strict';
// 04-data.js - Datentabellen (PLAN R5): Lichttypen (WORLD.md §11); Fahrzeuge/Waffen/Einheiten folgen mit ihren Meilensteinen.
// Exportiert: LIGHT_TYPES

// Radius in Welt-px, k = Intensität, flicker = Anteil Schwankung
const LIGHT_TYPES = {
  sodium:  { color: '#ffb35c', r: 128, k: 0.95, flicker: 0.05 },   // Laterne Natrium
  led:     { color: '#cfe6ff', r: 120, k: 0.90, flicker: 0 },       // Laterne LED
  neonPink:{ color: '#ff3fa4', r: 124, k: 1.0,  flicker: 0.08 },
  neonCyan:{ color: '#3fe8ff', r: 124, k: 1.0,  flicker: 0.08 },
  neonGreen:{ color: '#9dff4a', r: 124, k: 1.0, flicker: 0.08 },
  fire:    { color: '#ff8a30', r: 140, k: 0.8,  flicker: 0.25 },
  neon:    { color: '#ff3fa4', r: 124, k: 1.0,  flicker: 0.08 },   // Farbe je Lampe (l.color)
  door:    { color: '#ffb070', r: 84, k: 0.9, flicker: 0.04 },       // beleuchtete Eingangstür begehbarer Gebäude
  drone:   { color: '#e8f4ff', r: 96, k: 0.9, flicker: 0 },        // Drohnen-Suchscheinwerfer (Bodenkreis)
  player:  { color: '#bfe8ff', r: 60,  k: 0.6,  flicker: 0 },       // Spieler-Eigenlicht (Lesbarkeit)
  marker:  { color: '#3fe8ff', r: 92,  k: 1.0,  flicker: 0 }
};

// ---- Zonenplan (WORLD.md §2.1): 38 x 12 Zellen, 1 Zeichen = 8 x 8 Kacheln ----
const ZONE_ROWS = [
  '~DDDIIISSRRC~RRCCCRRCCRRR~VVPPVVVVVPPV',
  '~DaaIIISSRRC~R1CggCCCsCRR~VqqPVVCCVmmV',
  '~DaaII.3SRCRWCCCggCrCCCCR~VqqVVCCCVVVV',
  '~DDDIIffSt1R~RCPPCCCCuC3R~PPVVPpppVVPV',
  '~DDIIISS.RCR~RCPPC2CCCCCRWPPVVzpppPVVV',
  '~eDII2SkkRCR~CCCCCCbbC4CC~VVV.PpppVVVV',
  '~eDIISSkk5RC~RRC5CCCCCCRR~VCC2VPPPVVPP',
  '~DDDIIS.SR4R~RCCCCPPCCCCR~VCCVVVVVVnnV',
  '~DhhIISSSRRCWCC3CCPPCC6RR~VVVV7VVVVVVV',
  '~DDDIIIS7RCR~RRCCCCC7CCRRWVV1VVVVV3VVV',
  '~DDDDDISSR6R~RRRCCCCCRRRR~VVVVVVVVVV5V',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
];
const DISTRICTS = [
  { id: 'docks', name: 'DOCKS', c0: 0, c1: 12, ambient: '#22303a' },
  { id: 'neon', name: 'NEONMEILE', c0: 13, c1: 24, ambient: '#33305a' },
  { id: 'krone', name: 'KRONE', c0: 26, c1: 37, ambient: '#26304e' }
];
// Dienste (WORLD.md §4.1): Zelle "c,r" -> Name
const SERVICE_NAMES = { 1: 'KAPSELHOTEL', 2: 'CHIP-WÄSCHE', 3: 'WAFFENHÄNDLER', 4: 'OD-WACHE', 5: 'KLINIK', 6: 'EXPORTGARAGE', 7: 'KOPFGELD-TERMINAL' };
const SERVICE_BRAND = { '10,3': 'MÖWE', '14,1': 'LICHTWABE', '28,9': 'STILLE', '7,2': 'ROSTFEDER', '23,3': 'KALIBER', '15,8': 'FUNKENFLUG', '16,6': 'LICHTBLICK' };
// Landmarken (WORLD.md §3), MS1-Näherung: ein Bau je Landmarke. floors = Stockwerke, inset = Kacheln Abstand zum Grundstücksrand
const LANDMARKS = {
  a: { name: 'Containerterminal Dock 3', kind: 'containers' },
  t: { name: 'Terminalplatz', kind: 'plaza' },
  f: { name: 'Fischmarkt', kind: 'stalls' },
  k: { name: 'Chipklinik Docks', kind: 'bld', floors: 6, style: 'white', inset: 1 },
  h: { name: 'Schmugglerhof der Möwen', kind: 'bld', floors: 2, style: 'industrial', inset: 1 },
  e: { name: 'Altes Fährterminal', kind: 'bld', floors: 3, style: 'ruin', inset: 1 },
  g: { name: 'Casino Goldene Krone', kind: 'bld', floors: 12, style: 'neon', inset: 1.5, neon: '#ffd84a' },
  s: { name: 'Sendeturm Neonmeile', kind: 'bld', floors: 30, style: 'glass', inset: 3 },
  r: { name: 'Rennplatz', kind: 'plaza' },
  u: { name: 'Untergrundklinik', kind: 'bld', floors: 3, style: 'concrete', inset: 1.5 },
  b: { name: 'Bibliotheksruine', kind: 'bld', floors: 3, style: 'ruin', inset: 1 },
  q: { name: 'OD-Hauptquartier', kind: 'bld', floors: 8, style: 'concrete', inset: 1.5 },
  m: { name: 'MANDAT-Turm', kind: 'bld', floors: 40, style: 'glass', inset: 2.5, neon: '#ff3fa4' },
  p: { name: 'Regentenpalast', kind: 'bld', floors: 14, style: 'villa', inset: 1.2, regent: true },
  z: { name: 'Ewige Flamme', kind: 'plaza', fire: true },
  n: { name: 'Klinik Null', kind: 'bld', floors: 7, style: 'white', inset: 1 }
};
// Tore (WORLD.md §2.4): Brücken-Zellen
const GATES = { tor1: [[12, 2], [12, 8]], tor2: [[25, 4], [25, 9]] };
// Fassadenstile: Grundfarbe, Fensterdichte, Neonband
const FACADE_STYLES = {
  concrete:    { base: '#1e2129', win: 0.27, band: true },
  glass:       { base: '#141b29', win: 0.34, band: false, mullion: true },
  neon:        { base: '#1d1824', win: 0.27, band: true, sign: true },
  residential: { base: '#20222b', win: 0.30, band: false, balcony: true },
  industrial:  { base: '#23262c', win: 0.08, band: false, corrugated: true },
  villa:       { base: '#26212a', win: 0.40, band: false, warm: true },
  shack:       { base: '#2a2620', win: 0.05, band: false, corrugated: true },
  container:   { base: '#262a30', win: 0, band: false, corrugated: true },
  white:       { base: '#3a4350', win: 0.22, band: true, cyan: true },
  ruin:        { base: '#1c1d22', win: 0.04, band: false }
};
const NEON_COLORS = ['#ff3fa4', '#3fe8ff', '#9dff4a', '#a66bff', '#ffb35c'];

// ---- Fahrzeuge (WORLD.md §5). L x B in px, mass, top (px/Tick), accel, grip, steer (rad/Tick), hp, expl (Ironclad-Explosionsgröße) ----
// hover: schwebt (keine Bremsspuren, Unterboden-Glow). board: Hoverboard, Fahrer steht frei und nimmt Treffer (exposed).
const VEHICLES = {
  kapsel:   { name: 'KAPSEL',   sub: 'KLEINSTWAGEN',  L: 52,  B: 26, mass: 0.7, top: 7.0,  accel: 0.16, grip: 0.30, steer: 0.060, hp: 60,  expl: 1.3, glow: '#3fe8ff', snd: 'whine' },
  limo:     { name: 'LIMO',     sub: 'LIMOUSINE',     L: 70,  B: 30, mass: 1.0, top: 8.2,  accel: 0.15, grip: 0.26, steer: 0.052, hp: 90,  expl: 1.6, glow: '#ff3fa4', snd: 'hybrid' },
  taxi:     { name: 'TAXI',     sub: 'LEUCHTSCHILD',  L: 70,  B: 30, mass: 1.0, top: 8.2,  accel: 0.15, grip: 0.26, steer: 0.052, hp: 100, expl: 1.6, glow: '#ffd84a', snd: 'hybrid' },
  pfeil:    { name: 'PFEIL',    sub: 'SPORTWAGEN',    L: 68,  B: 30, mass: 0.9, top: 10.5, accel: 0.22, grip: 0.30, steer: 0.058, hp: 75,  expl: 1.6, glow: '#ff3fa4', snd: 'turbine' },
  gleiter:  { name: 'GLEITER',  sub: 'SCHWEBEWAGEN',  L: 66,  B: 32, mass: 0.9, top: 9.5,  accel: 0.18, grip: 0.12, steer: 0.050, hp: 70,  expl: 1.7, glow: '#9dff4a', snd: 'hover', hover: true },
  pritsche: { name: 'PRITSCHE', sub: 'PICKUP',        L: 74,  B: 32, mass: 1.3, top: 7.6,  accel: 0.13, grip: 0.24, steer: 0.048, hp: 120, expl: 1.7, glow: '#ff9a3a', snd: 'diesel' },
  kasten:   { name: 'KASTEN',   sub: 'KASTENWAGEN',   L: 78,  B: 34, mass: 1.6, top: 6.6,  accel: 0.11, grip: 0.22, steer: 0.042, hp: 140, expl: 1.8, glow: '#a66bff', snd: 'diesel' },
  laster:   { name: 'LASTER',   sub: 'CONTAINERZUG',  L: 124, B: 38, mass: 3.2, top: 5.6,  accel: 0.07, grip: 0.20, steer: 0.032, hp: 260, expl: 2.2, glow: '#ff3b4a', snd: 'heavy' },
  bike:     { name: 'KURIER-BIKE', sub: 'LICHTRAD',   L: 40,  B: 14, mass: 0.4, top: 11.0, accel: 0.25, grip: 0.34, steer: 0.075, hp: 40,  expl: 1.0, glow: '#3fe8ff', snd: 'bike', exposed: true },
  od_streife: { name: 'OD-STREIFE', sub: 'ORDNUNGSDIENST', L: 72, B: 30, mass: 1.1, top: 9.4, accel: 0.18, grip: 0.28, steer: 0.055, hp: 130, expl: 1.7, glow: '#2a6bff', snd: 'hybrid', od: true, art: 'limo' },
  od_abfang:  { name: 'OD-ABFANGJÄGER', sub: 'ORDNUNGSDIENST', L: 70, B: 30, mass: 1.0, top: 11.0, accel: 0.22, grip: 0.30, steer: 0.058, hp: 110, expl: 1.6, glow: '#2a6bff', snd: 'turbine', od: true, art: 'pfeil' },
  od_sturm:   { name: 'OD-STURMWAGEN', sub: 'ORDNUNGSDIENST', L: 90, B: 38, mass: 2.4, top: 6.8, accel: 0.10, grip: 0.22, steer: 0.040, hp: 320, expl: 2.0, glow: '#2a6bff', snd: 'heavy', od: true, art: 'kasten' },
  board:    { name: 'HOVERBOARD', sub: 'SCHWEBEBRETT', L: 34, B: 16, mass: 0.25, top: 9.5, accel: 0.26, grip: 0.10, steer: 0.075, hp: 35, expl: 0.7, glow: '#ff3fa4', snd: 'board', hover: true, board: true, exposed: true }
};
// Verkehrsmix je Distrikt (WORLD.md §5; erbe_limo folgt mit den Erben als limo)
const TRAFFIC_MIX = {
  docks: { kapsel: 25, pritsche: 25, kasten: 20, laster: 15, limo: 10, bike: 5 },
  neon:  { limo: 30, taxi: 20, pfeil: 15, gleiter: 15, bike: 10, kapsel: 10 },
  krone: { limo: 40, gleiter: 25, pfeil: 20, taxi: 10, bike: 5 }
};
const CAR_PAINTS = ['#3a6ea5', '#b0305e', '#d8d2c4', '#2a2a30', '#3f9a8a', '#7a3fb0', '#8a8f99', '#a04a2a'];

// ---- Fundstücke (Sammlung) und Behälter (PLAN §7.11 Beute). Namen und Texte sind Teil des Humors der Spielwelt. ----
const FUNDE = [
  { id: 'socke', n: 'Einzelne Socke', v: 2, t: 'Die andere ist beim Regenten. Wie alles.' },
  { id: 'nudelbon', n: 'Nudelgutschein (abgelaufen)', v: 3, t: 'Gültig bis: vor dem Feuertag.' },
  { id: 'chipentferner', n: '„Chip-Entferner“ aus Plastik', v: 25, t: 'Kleingedrucktes: Entfernt keine Chips. Entfernt Hoffnung.' },
  { id: 'orden', n: 'Regenten-Orden (Pappe)', v: 15, t: 'Für 41 Jahre stilles Dasein.' },
  { id: 'schirm', n: 'Ersatzschirm, einmal benutzt', v: 12, t: 'Mit Abo. Der Regen auch.' },
  { id: 'mandatbrief', n: 'Ungeöffneter Mandatsbrief', v: 20, t: '„Sie haben gewonnen: Ihr Leben. Bitte verlängern.“' },
  { id: 'goldzahn', n: 'Goldzahn (echt?)', v: 60, t: 'Ist er nicht. Der Pfandleiher zahlt trotzdem.' },
  { id: 'whisky', n: 'Synth-Whisky „Feuertag 41“', v: 18, t: 'Schmeckt nach Wunsch und Rost.' },
  { id: 'kassette', n: 'Kassette „Hits der Stille“', v: 9, t: 'Seite A: Nichts. Seite B: Mehr davon.' },
  { id: 'kaktus', n: 'Plastikkaktus mit Treuechip', v: 14, t: 'Selbst der hat einen. Er wirkt zufrieden.' },
  { id: 'ente', n: 'Quietscheente (Alarm-Edition)', v: 11, t: 'Quietscht ab Fahndungsstufe 3. Angeblich.' },
  { id: 'pfand', n: 'Pfandflasche (0,05 CR)', v: 1, t: 'Der Aufwand rechnet sich nie. Du tust es trotzdem.' },
  { id: 'brille', n: 'Brille mit Neon-Rahmen', v: 22, t: 'Macht jeden interessant. Fast jeden.' },
  { id: 'haarteil', n: 'Haarteil (Regentenfrisur)', v: 16, t: 'Die Frisur gibt es seit 41 Jahren. Den Regenten nicht.' },
  { id: 'haustier', n: 'Digitales Haustier, verhungert', v: 7, t: 'RIP Biscuit. Er wurde drei Tage alt.' },
  { id: 'handtuch', n: 'Notfallhandtuch (42 × 42)', v: 4, t: 'Wer sein Handtuch kennt, kennt auch die Stadt.' },
  { id: 'umarmung', n: 'Gutschein: eine Umarmung', v: 5, t: 'Bisher von niemandem eingelöst.' },
  { id: 'zahnrad', n: 'Zahnrad, Herkunft unbekannt', v: 30, t: 'Passt in nichts. Klingt wertvoll.' },
  { id: 'postkarte', n: 'Postkarte aus der Ödnis', v: 10, t: '„Wetter schön. Wünschte, du wärst nicht hier.“ Rückseite verbrannt.' },
  { id: 'hoverpad', n: 'Gebrauchtes Schwebebrett-Pad', v: 35, t: 'Riecht nach Ozon und schlechten Entscheidungen.' },
  { id: 'aschenbecher', n: 'Aschenbecher mit Regentengesicht', v: 8, t: 'Er sieht auch mit Asche streng aus.' },
  { id: 'stempel', n: 'Stempel „GENEHMIGT“', v: 28, t: 'Alles, was du damit abstempelst, wird kurz wahr.' },
  { id: 'notizbuch', n: 'Notizbuch: „Dinge, die ich nicht sagen darf“', v: 13, t: 'Alle Seiten leer. Sehr vorsichtig.' },
  { id: 'pokal', n: 'Pokal „Bürger des Monats (Okt. ’89)“', v: 40, t: 'Der Monat wurde nie bestätigt.' },
  { id: 'schluessel', n: 'Schlüssel ohne Schloss', v: 17, t: 'Das Schloss hat gekündigt.' },
  { id: 'bonbon', n: 'Hustenbonbon (Geschmack: Chip)', v: 3, t: 'Schmeckt nach Metall und Pflicht.' },
  { id: 'wecker', n: 'Wecker, der rückwärts läuft', v: 21, t: 'Er geht richtig. Die Welt nicht.' },
  { id: 'radio', n: 'Taschenradio: nur Rauschen', v: 19, t: 'Es sendet gerade die Stimme des Regenten. Klingt trotzdem wie Rauschen.' },
  { id: 'minipanzer', n: 'Miniatur-Tribunal 1:87', v: 26, t: 'Völlig harmlos. Nur hier drin.' }
];
// Behälter: n Name, cr Credits (min, max), f Chance auf ein Fundstück, food = Essen (heilt), noisy = laut (Safe)
const LOOT = {
  spind:        { n: 'Spind', cr: [5, 30], f: 0.5 },
  schublade:    { n: 'Schublade', cr: [3, 20], f: 0.6 },
  kuehlschrank: { n: 'Kühlschrank', cr: [0, 6], f: 0.3, food: true },
  safe:         { n: 'Safe', cr: [60, 150], f: 0.35, noisy: true },
  kiste:        { n: 'Kiste', cr: [8, 40], f: 0.45 },
  truhe:        { n: 'Truhe', cr: [30, 90], f: 0.5 },
  kasse:        { n: 'Kasse', cr: [15, 60], f: 0.15 }
};

// ---- Waffen (WORLD.md §6): Fäuste immer; Pistole/MP/Schrot/Flammenwerfer/Rakete/EMP per Händler oder Mission ----
// cd = Ticks zwischen Aktionen, dmg = Schaden (Schrot: je Kugel), speed = Geschossgeschwindigkeit (px/Tick), spread = Streuung (rad), range = Reichweite (px),
// max = Munitionsgrenze, price/ammoPrice/pack = Händlerpreis, Preis je Munitionspaket, Paketgröße; act = ab diesem Akt im Angebot
const WEAPONS = {
  faust:   { name: 'FAUST', melee: true, cd: 15, dmg: 7, range: 40, arc: 1.0, slot: 1 },
  pistole: { name: 'PISTOLE', cd: 16, dmg: 12, speed: 15, range: 600, spread: 0.03, max: 240, maxAmmo: 240, price: 120, ammoPrice: 40, pack: 24, slot: 2, drive: true, snd: 'pistole' },
  smg:     { name: 'MP „HORNISSE“', cd: 5, dmg: 7, speed: 16, range: 520, spread: 0.09, max: 400, maxAmmo: 400, price: 1500, ammoPrice: 300, pack: 200, slot: 3, drive: true, snd: 'smg' },
  shotgun: { name: 'SCHROTFLINTE', cd: 42, dmg: 6, pellets: 7, speed: 13, range: 300, spread: 0.32, max: 60, maxAmmo: 60, price: 2500, ammoPrice: 300, pack: 30, slot: 4, snd: 'schrot' },
  flamer:  { name: 'FLAMMENWERFER', beam: true, cd: 2, dmg: 1.4, range: 140, max: 400, maxAmmo: 400, price: 4000, ammoPrice: 400, pack: 200, slot: 5 },
  rocket:  { name: 'RAKETENWERFER', cd: 70, dmg: 70, speed: 9, range: 900, max: 10, maxAmmo: 10, price: 8000, ammoPrice: 1000, pack: 5, slot: 6, act: 2 },
  emp:     { name: 'EMP-GRANATE', cd: 40, range: 300, max: 10, maxAmmo: 10, price: 300, ammoPrice: 300, pack: 1, slot: 7 }
};
const WEAPON_ORDER = ['faust', 'pistole', 'smg', 'shotgun', 'flamer', 'rocket', 'emp'];
// Power-ups (WORLD.md §7): Dauer in Sekunden (0 = sofort), Kurzname fürs HUD
const POWERUPS = {
  rapid: { name: 'FEUERRATE', dur: 10, color: '#ffd84a' }, shield: { name: 'PANZERFELD', dur: 8, color: '#3fe8ff' }, slowmo: { name: 'REFLEX', dur: 7, color: '#a66bff' },
  drones: { name: 'KAMPFDROHNEN', dur: 15, color: '#9dff4a' }, repair: { name: 'MEDIKIT', dur: 0, color: '#7dffd8' }, empwave: { name: 'EMP-WELLE', dur: 0, color: '#3fe8ff' },
  bribe: { name: 'BESTECHUNGSCHIP', dur: 0, color: '#ffd84a' }, vest: { name: 'PANZERWESTE', dur: 0, color: '#9fb4d8' }
};
const COMIC = ['PAFF!', 'WUMM!', 'KLATSCH!', 'ZACK!', 'BAMM!', 'PENG!'];

// ---- Fahndung (WORLD.md §9): Schwellen, Soll-Einheiten je Stufe, Abklingzeit (Sekunden unbeobachtet) ----
const HEAT_LEVELS = [
  { pts: 0,   foot: 0, car: 0, abfang: 0, sturm: 0, drone: 0, block: 0, decay: 0 },
  { pts: 6,   foot: 2, car: 1, abfang: 0, sturm: 0, drone: 0, block: 0, decay: 8 },
  { pts: 25,  foot: 2, car: 3, abfang: 0, sturm: 0, drone: 0, block: 0, decay: 12 },
  { pts: 60,  foot: 2, car: 4, abfang: 1, sturm: 0, drone: 1, block: 1, decay: 16 },
  { pts: 110, foot: 2, car: 4, abfang: 1, sturm: 1, drone: 2, block: 1, decay: 22 },
  { pts: 180, foot: 3, car: 4, abfang: 2, sturm: 1, drone: 3, block: 1, decay: 30 }
];
const HEAT_MAX = 240;
// Delikte (Punkte, WORLD.md §9.1)
const CRIME = { pedHurt: 3, pedKilled: 8, shot: 2, carjack: 4, breakin: 4, odCarJack: 15, copHurt: 10, copKilled: 25, odVehicle: 20, drone: 10, explosionPeds: 6, assault: 2 };
