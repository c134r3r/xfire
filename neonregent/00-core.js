'use strict';
// 00-core.js - Namespace, Konstanten (C), Mathe, seeded RNG, Event-Bus, Einstellungen, Spielzustand (G).
// Exportiert: C, G, Q, DEBUG, R, rand, randi, pick, clamp, lerp, TAU, angDiff, angleLerp, rng, Bus, Settings, VIEW_W, VIEW_H, TICK
// Alle Tuning-Zahlen stehen hier oder in 04-data.js (PLAN R5, Werte aus WORLD.md §1).

const VIEW_W = 1280, VIEW_H = 720, TICK = 1 / 60;
const TAU = Math.PI * 2;

const C = {
  TILE: 64, CELL: 8, MAP_TW: 306, MAP_TH: 96, FLOOR_H: 22, LEAN_K: 1 / 1000, LEAN_MAX: 0.65,
  ZOOM_FOOT: 1.35, ZOOM_CAR_SLOW: 1.15, ZOOM_CAR_FAST: 0.80, ZOOM_INSIDE: 1.65, CAM_LEAD_CAR: 22,
  PED_R: 7, PLAYER_WALK: 2.0, PLAYER_SPRINT: 2.9, STAMINA: 100, STAMINA_DRAIN: 0.8, STAMINA_REGEN: 0.4,
  DODGE_S: 0.35, DODGE_CD_S: 1,
  LIGHTMAP_SCALE: 0.5, LIGHTS_MAX: 140, PARTICLES_MAX: 1600, TEX_BUDGET: 24e6, CHUNK: 512, CHUNKS_MAX: 48, RAIN_DROPS: 420,
  AMBIENT: '#2a3150',                       // Konzept-Umgebung; Distrikte: WORLD.md §12
  VOICES_MAX: { schrei: 4, schuss: 8, explosion: 4, motor: 3, sirene: 2, gesamt: 32 },
  DUCK_DB: -6, DUCK_S: 1,
  ROOM_MIN: 96, WALL_H: 24, WALL_T: 6, DOOR_W: 28, XRAY_ALPHA: 0.3, INDOOR_NAV: 16, INTERIOR_SHARE: 0.10,
  CITY_SEED: 7741
};

// ----- Abfrage-Parameter -----
const Q = new URLSearchParams(location.search);
const DEBUG = Q.get('debug') === '1';

// ----- Zufall: Spiellogik ruft rand()/pick() ueber R.fn auf; Testszenen setzen R.fn auf einen festen Seed -----
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = { fn: Math.random, seed: 0, set(seed) { this.seed = seed; this.fn = rng(seed); } };
function rand(a, b) { return a + R.fn() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[(R.fn() * arr.length) | 0]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function angleLerp(a, b, t) { return a + angDiff(a, b) * t; }

// ----- Event-Bus (lose Kopplung: Kampf -> Audio/HUD) -----
const Bus = {
  h: {},
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); },
  emit(ev, a, b, c) { const l = this.h[ev]; if (l) for (let i = 0; i < l.length; i++) l[i](a, b, c); }
};

// ----- Einstellungen (localStorage, immer in try/catch - PLAN §4.11) -----
const Settings = {
  key: 'neonregent_settings',
  d: { vol: { sfx: 0.85, stimmen: 1, ambience: 0.7, musik: 0.5, ui: 0.8 }, shake: 1, quality: 1, muted: false, blood: true, drive: 'classic' },
  load() { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); if (s) { Object.assign(this.d, s); this.d.vol = Object.assign({ sfx: 0.85, stimmen: 1, ambience: 0.7, musik: 0.5, ui: 0.8 }, s.vol); } } catch (e) {} return this.d; },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) {} }
};
Settings.load();

// ----- Spielzustand (PLAN §4.2/§4.4) -----
// state: boot | menu | play | paused | (spaeter: intro cutscene dying executed busted wasted missionFail missionDone ending credits)
const G = {
  state: 'boot', time: 0, scene: null,
  cam: { x: 0, y: 0 }, zoom: C.ZOOM_FOOT, zoomPunch: 0,
  trauma: 0, kickX: 0, kickY: 0, hurtFlash: 0, freeze: 0, quality: 1,
  parts: [], texts: [], lamps: [], buildings: [], vehicles: [], bullets: [], ebullets: [], drones: [], wanted: { pts: 0, level: 0, seen: false, decayT: 0, seenT: 0, last: { x: 0, y: 0 }, spawnT: 0, block: null }, respawn: null, fadeA: 0, weapon: 'faust', own: { faust: true, pistole: false }, ammo: { pistole: 0 }, peds: [], pickups: [], barks: [], npcs: [], finds: {}, stats: { peds: 0, finds: 0, cr: 0 }, nearVeh: null, flags: null,
  ambient: C.AMBIENT, player: null, inside: null, city: null, rain: 1, district: null,
  in: {}                                  // Intent (01-input.js)
};
