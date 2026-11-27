'use strict';
// 13-story.js - Alle sichtbaren Texte (Deutsch, PLAN R6) und später MISSIONS (aus STORY.md), Ticker, Datenchips, Erben-Liste.
// Exportiert: STR (MS0: nur Oberfläche und Debug); MISSIONS folgt in MS8.

const STR = {
  title: 'NEON REGENT',
  chip: { on: '● TREUECHIP AKTIV', glitch: '◌ TREUECHIP GESTÖRT', off: '○ TREUECHIP STUMM' },
  district: { test: 'HALOGEN · TESTFELD' },
  status: { baking: 'Klangbank wird gebacken …', ready: n => `Klangbank bereit (${n} Klänge)`, recs: s => `Aufnahmen: ${s}`, norecs: 'Keine Aufnahmen im Bundle – synthetischer Rückfall' },
  hint: {
    play: 'WASD laufen · Maus zielen · Shift sprinten · P Pause · M Ton',
    debug: 'B Explosion · V Schrei · N Überfahren · Z Panik · X Vollstreckung · K MANDAT'
  },
  banner: { start: 'HALOGEN', startSub: 'Testfeld · Meilenstein 0', paused: 'PAUSE', scene: n => `SZENE ${n}` },
  voices: ['mann', 'frau', 'alt', 'jung']
};
