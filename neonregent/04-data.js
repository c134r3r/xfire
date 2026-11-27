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
  board:    { name: 'HOVERBOARD', sub: 'SCHWEBEBRETT', L: 34, B: 16, mass: 0.25, top: 9.5, accel: 0.26, grip: 0.10, steer: 0.075, hp: 35, expl: 0.7, glow: '#ff3fa4', snd: 'board', hover: true, board: true, exposed: true }
};
// Verkehrsmix je Distrikt (WORLD.md §5; erbe_limo folgt mit den Erben als limo)
const TRAFFIC_MIX = {
  docks: { kapsel: 25, pritsche: 25, kasten: 20, laster: 15, limo: 10, bike: 5 },
  neon:  { limo: 30, taxi: 20, pfeil: 15, gleiter: 15, bike: 10, kapsel: 10 },
  krone: { limo: 40, gleiter: 25, pfeil: 20, taxi: 10, bike: 5 }
};
const CAR_PAINTS = ['#3a6ea5', '#b0305e', '#d8d2c4', '#2a2a30', '#3f9a8a', '#7a3fb0', '#8a8f99', '#a04a2a'];
