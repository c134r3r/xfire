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
  player:  { color: '#bfe8ff', r: 60,  k: 0.6,  flicker: 0 },       // Spieler-Eigenlicht (Lesbarkeit)
  marker:  { color: '#3fe8ff', r: 92,  k: 1.0,  flicker: 0 }
};
