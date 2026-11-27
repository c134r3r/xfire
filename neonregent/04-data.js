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
