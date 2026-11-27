'use strict';
// 02-audio.js - Audio-Engine (PLAN §4.10): Busse, Mix/Ducking, Positionierung, Innen/Außen, Stimmen-Verwaltung, Klangbank,
// Aufnahmen-Pool (Bundle assets/sound/neonregent.sound.js).
// Signalfluss: Quelle -> Kategorie-Bus -> [Innen/Außen-Tiefpass] -> Master -> Kompressor -> Ausgang.
//   Busse: sfx · stimmen · ambience (durch den Innen/Außen-Filter) · musik · ui (direkt)
// Exportiert: Aud, REC, REC_FALLBACK, VOICE_CHAIN, recPool, pickRec, loadBundle, recSummary, SR

const SR = 44100;

// ---- Aufnahmen: REC[kategorie] = [{ buf, speaker, name }] (PLAN D13) ----
const REC = { angst: [], treffer: [], schmerz: [], stoehnen: [], brennen: [], ruf: [], keuchen: [], spieler: [] };
const REC_FALLBACK = { treffer: 'angst', schmerz: 'angst', brennen: 'angst', ruf: 'angst' };
// Stimmtyp schlägt Kategorie: nie das andere Geschlecht; passt nichts -> [] (= synthetischer Rückfall)
const VOICE_CHAIN = { mann: ['m'], frau: ['f'], alt: ['a', 'm'], jung: ['j', 'f'] };
let USE_REC = true, REC_CLOCK = 0;
function recPool(cat, voice) {
  const cats = [cat, REC_FALLBACK[cat]].filter(c => c && REC[c] && REC[c].length);
  for (const p of VOICE_CHAIN[voice] || ['m', 'f'])
    for (const c of cats) { const same = REC[c].filter(it => it.speaker[0] === p); if (same.length) return same; }
  return [];
}
// Nie dieselbe Aufnahme kurz hintereinander: Zufall nur unter der länger nicht gespielten Hälfte des Pools
function pickRec(rnd, pool) {
  const byAge = pool.slice().sort((a, b) => (a.used || 0) - (b.used || 0));
  const it = byAge[(rnd() * Math.max(1, Math.ceil(byAge.length / 2))) | 0]; it.used = ++REC_CLOCK; return it;
}
async function addRecording(arrayBuffer, name) {
  const buf = await new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  const mm = /^([a-z]+)_([a-z0-9]+)_/.exec(name.toLowerCase());
  const cat = mm && REC[mm[1]] ? mm[1] : 'angst', speaker = mm ? mm[2] : 'x' + (REC[cat].length + 1);
  REC[cat].push({ buf, speaker, name });
}
async function loadBundle() {
  const B = window.NEONREGENT_SOUNDS; if (!B || !B.items) return 0;
  let n = 0;
  for (const it of B.items) {
    try {
      const bin = atob(it.data.split(',')[1]), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      await addRecording(u8.buffer, it.file); n++;
    } catch (e) { console.warn('Aufnahme nicht dekodierbar:', it.file, e.message); }
  }
  return n;
}
function recSummary() { return Object.keys(REC).filter(c => REC[c].length).map(c => `${c} ${REC[c].length}`).join(' · '); }

// ---- Engine ----
const Aud = {
  ac: null, master: null, comp: null, inF: null, bus: {}, bank: {}, rr: {}, active: [],
  muted: Settings.d.muted, inside: false, ready: false, bakeLog: { n: 0, ms: 0, firstMs: 0, done: false, fail: [] },
  BUSES: { sfx: 'in', stimmen: 'in', ambience: 'in', musik: 'direct', ui: 'direct' },

  // Erst nach einer Nutzer-Geste möglich (Autoplay-Regeln)
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return this.ac; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR }); } catch (e) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e2) { return null; } }
    const ac = this.ac;
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 12; this.comp.ratio.value = 5; this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
    this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.comp).connect(ac.destination);
    this.inF = ac.createBiquadFilter(); this.inF.type = 'lowpass'; this.inF.frequency.value = 22000; this.inF.Q.value = 0.5;
    this.inG = ac.createGain(); this.inG.gain.value = 1; this.inF.connect(this.inG).connect(this.master);
    for (const b in this.BUSES) {
      const g = ac.createGain(); g.gain.value = Settings.d.vol[b] === undefined ? 0.8 : Settings.d.vol[b];
      g.connect(this.BUSES[b] === 'in' ? this.inF : this.master); this.bus[b] = g;
    }
    this.setInside(this.inside, true);
    return ac;
  },
  toggleMute() {
    this.muted = !this.muted; Settings.d.muted = this.muted; Settings.save();
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ac.currentTime, 0.02);
    return this.muted;
  },
  setVol(bus, v) {
    Settings.d.vol[bus] = v; Settings.save();
    if (this.bus[bus]) this.bus[bus].gain.setTargetAtTime(v, this.ac.currentTime, 0.03);
  },
  // Drinnen: sfx/stimmen/ambience von draußen durch Tiefpass 900 Hz und -8 dB (PLAN §4.10)
  setInside(inside, force) {
    if (inside === this.inside && !force) return;
    this.inside = inside; if (!this.ac) return;
    const t = this.ac.currentTime;
    this.inF.frequency.setTargetAtTime(inside ? 900 : 22000, t, 0.08);
    this.inG.gain.setTargetAtTime(inside ? Math.pow(10, -8 / 20) : 1, t, 0.08);
  },
  // Ducking: Musik -6 dB für 1 s (tödlicher Treffer, Explosion >= 1.6, MANDAT)
  beep(f, dur = 0.1, g = 0.3) { if (!this.ac || !this.bus.ui) return; const ac = this.ac, o = ac.createOscillator(), e = ac.createGain(), t = ac.currentTime; o.type = 'square'; o.frequency.value = f; e.gain.setValueAtTime(g * 0.4, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(e); e.connect(this.bus.ui); o.start(t); o.stop(t + dur + 0.02); },
  duck(db = C.DUCK_DB, secs = C.DUCK_S) {
    if (!this.ac || !this.bus.musik) return;
    const g = this.bus.musik.gain, t = this.ac.currentTime, base = Settings.d.vol.musik;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(base * Math.pow(10, db / 20), t + 0.05);
    g.setValueAtTime(base * Math.pow(10, db / 20), t + 0.05 + secs * 0.5); g.linearRampToValueAtTime(base, t + 0.05 + secs * 1.5);
  },

  // ---- Klangbank: Alle Klänge werden beim Laden einmal offline gerendert (Varianten parallel zur Eingabe) ----
  async bake(defs, onFirst) {
    const t0 = performance.now(), log = this.bakeLog; log.n = 0;
    for (const id of Object.keys(defs)) {
      const d = defs[id], list = [];
      for (let v = 0; v < d.variants; v++) {
        try { list.push(await this.render(d, 1000 + v * 77 + id.length * 13, v)); log.n++; await new Promise(r => setTimeout(r, 0)); }   // zwischen den Renderings Frames durchlassen
        catch (e) { log.fail.push(id + ':' + e.message); }
      }
      this.bank[id] = list;
      if (d.first && !log.firstMs && Object.keys(defs).filter(k => defs[k].first).every(k => this.bank[k])) { log.firstMs = performance.now() - t0; if (onFirst) onFirst(); }
    }
    log.ms = performance.now() - t0; log.done = true; this.ready = true;
  },
  // Eine Variante rendern und auf Spitze 0.89 normalisieren; rawPeak für die Pegelprüfung (PLAN §9, R15)
  async render(d, seed, variant) {
    const oc = new OfflineAudioContext(2, Math.ceil(SR * d.len), SR);
    d.fn(new Mix(oc, seed, d.noiseLen || 8), variant);
    let buf = await oc.startRendering();
    if (d.loop) buf = this.makeLoop(buf, 1.0);
    let pk = 0, nan = false;
    for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a !== a) nan = true; if (a > pk) pk = a; } }
    const k = pk > 0 && !nan ? (d.peak || (d.loop ? 0.6 : 0.89)) / pk : 1, fade = d.loop ? 1 : Math.floor(0.03 * SR);
    for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = nan ? 0 : x[i] * k * Math.min(1, (x.length - i) / fade); }
    buf.rawPeak = pk; buf.hadNaN = nan; return buf;
  },

  // Nahtloser Loop: das Ende wird über den Anfang geblendet, die Überblendzeit fällt aus der Länge heraus
  makeLoop(buf, xfSec) {
    const xf = Math.floor(xfSec * SR), n = buf.length - xf, out = new OfflineAudioContext(2, 1, SR).createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) { const s = buf.getChannelData(c), o = out.getChannelData(c); for (let i = 0; i < n; i++) o[i] = i < xf ? s[i] * (i / xf) + s[n + i] * (1 - i / xf) : s[i]; }
    return out;
  },
  // Gemeinsamer Rausch-Puffer für Live-Synthese (2 s)
  noiseBuf() {
    if (!this._nb) { const n = SR * 2, b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this._nb = b; }
    return this._nb;
  },
  // Schleife auf einem Bus starten (Regen, Brummen). Gibt { setLevel(v, pan) } zurück.
  loop(id, bus = 'ambience', opt = {}) {
    const buf = this.bank[id] && this.bank[id][0]; if (!buf || !this.ac) return null;
    const ac = this.ac, src = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const lp = opt.lp ? ac.createBiquadFilter() : null; if (lp) { lp.type = 'lowpass'; lp.frequency.value = opt.lp; }
    src.buffer = buf; src.loop = true; g.gain.value = 0; src.connect(g); let head = g; if (lp) { g.connect(lp); head = lp; }
    if (p) { head.connect(p); p.connect(this.bus[bus]); } else head.connect(this.bus[bus]);
    src.start(0, Math.random() * buf.duration);
    return { setLevel: (v, pan = 0, cut) => { g.gain.setTargetAtTime(v, ac.currentTime, 0.25); if (p) p.pan.setTargetAtTime(pan, ac.currentTime, 0.25); if (lp && cut) lp.frequency.setTargetAtTime(cut, ac.currentTime, 0.2); } };
  },
  // Schritt je Untergrund (Bank: schritt_<untergrund>)
  step(surface, sprint) { this.play('schritt_' + surface, { gain: sprint ? 1.25 : 1, rate: sprint ? 1.08 : 1, cat: 'schritt' }); },

  // ---- Wiedergabe ----
  // Weltposition -> Lautstärke, Panorama, Tiefpass (Entfernung zum Kamerazentrum; rausgezoomt = weiter weg)
  place(x, y) {
    if (x === undefined) return { v: 1, pan: 0, lp: 0, d: 0 };
    const z = G.zoom || 1, dx = (x - G.cam.x) * z, dy = (y - G.cam.y) * z, d = Math.hypot(dx, dy);
    return { v: clamp(1.15 - d / 1300, 0.12, 1), pan: clamp(dx / 800, -0.85, 0.85), lp: d > 350 ? clamp(16000 - d * 9, 1800, 16000) : 0, d };
  },
  // Stimme verwalten: Limits je Kategorie und gesamt; bei Überlauf die leiseste beenden
  _admit(cat, vol) {
    const now = this.ac.currentTime; this.active = this.active.filter(a => a.end > now);
    const lim = C.VOICES_MAX[cat] || 99, same = this.active.filter(a => a.cat === cat);
    const worst = list => list.reduce((w, a) => (!w || a.vol < w.vol ? a : w), null);
    if (same.length >= lim) { const w = worst(same); if (w.vol >= vol) return false; this._kill(w); }
    if (this.active.length >= C.VOICES_MAX.gesamt) { const w = worst(this.active); if (w.vol >= vol) return false; this._kill(w); }
    return true;
  },
  _kill(a) { try { a.g.gain.setTargetAtTime(0, this.ac.currentTime, 0.02); a.src.stop(this.ac.currentTime + 0.1); } catch (e) {} a.end = 0; },
  // Bank-Klang abspielen. o: { x, y, gain, rate, cat, bus, pan, variant }
  play(id, o = {}) {
    if (!this.ac || this.muted || this.ac.state !== 'running') return null;
    const list = this.bank[id]; if (!list || !list.length) return null;
    const def = SOUND_DEFS[id] || {}, cat = o.cat || def.cat || 'sfx', bus = o.bus || def.bus || 'sfx';
    const pl = this.place(o.x, o.y), vol = pl.v * (o.gain === undefined ? 1 : o.gain) * (def.gain || 1);
    if (!this._admit(cat, vol)) return null;
    // Round-Robin ohne direkte Wiederholung
    const r = (this.rr[id] = ((this.rr[id] === undefined ? Math.floor(Math.random() * list.length) : this.rr[id]) + 1 + (list.length > 2 ? Math.floor(Math.random() * (list.length - 1)) : 0)) % list.length);
    const buf = o.variant !== undefined ? list[o.variant % list.length] : list[r];
    return this._start(buf, vol, o.pan === undefined ? pl.pan : o.pan, pl.lp, bus, (o.rate || 1) * (1 + (Math.random() - 0.5) * 0.08), cat);
  },
  _start(buf, vol, pan, lp, bus, rate, cat, dur) {
    const ac = this.ac, src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = vol; let head = g; src.connect(g);
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; head.connect(f); head = f; }
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; head.connect(p); head = p; }
    head.connect(this.bus[bus] || this.bus.sfx);
    const end = ac.currentTime + (dur || buf.duration / rate) + 0.05, rec = { src, g, vol, cat, end };
    this.active.push(rec); src.start(); return rec;
  },
  // Aufnahme live abspielen (Schrei einer bestimmten Person, PLAN §4.10). o: { x, y, gain, cut, fade, rate, send, speaker }
  // cut = nach so vielen Sekunden abreißen (Todesschrei), fade = Blende dabei (15 ms = abrupt; 90 ms = Luft weg)
  playRec(cat, voice, o = {}) {
    if (!this.ac || this.muted || this.ac.state !== 'running' || !USE_REC) return null;
    let pool = recPool(cat, voice); if (o.speaker) { const s = pool.filter(it => it.speaker === o.speaker); if (s.length) pool = s; }
    if (!pool.length) return null;
    const pl = this.place(o.x, o.y), vol = pl.v * (o.gain === undefined ? 1 : o.gain);
    if (!this._admit('schrei', vol)) return null;
    const it = pickRec(Math.random, pool), rate = (0.95 + Math.random() * 0.1) * (o.rate || 1), len = it.buf.duration / rate;
    const cut = o.cut || 0, fade = o.fade || 0.015, ac = this.ac, t = ac.currentTime, end = cut ? Math.min(cut, len) : len;
    const rec = this._start(it.buf, vol, pl.pan, pl.lp, 'stimmen', rate, 'schrei', end + fade);
    const gp = rec.g.gain; gp.cancelScheduledValues(t); gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(vol, t + 0.004);
    if (cut) { gp.setValueAtTime(vol, t + end); gp.linearRampToValueAtTime(0.0001, t + end + fade); rec.src.stop(t + end + fade + 0.03); }
    else { gp.setValueAtTime(vol, t + Math.max(0.01, end - 0.02)); gp.linearRampToValueAtTime(0.0001, t + end); }
    // stop(fade): Schrei abreißen (tödlicher Aufprall: 15 ms, Angefahren: 90 ms - ihr bleibt die Luft weg)
    rec.stop = (f = 0.015) => { const n = ac.currentTime; if (rec.end < n) return; try { gp.cancelScheduledValues(n); gp.setValueAtTime(gp.value, n); gp.linearRampToValueAtTime(0.0001, n + f); rec.src.stop(n + f + 0.03); rec.end = n; } catch (e) {} };
    return rec;
  },
  // Stimme einer Person: ein fester Sprecher aus dem Bundle passend zum Stimmtyp (PLAN §4.10), bleibt für die Person gleich
  speakerFor(voice, cat = 'angst') { const pool = recPool(cat, voice); return pool.length ? pool[Math.floor(Math.random() * pool.length)].speaker : null; },
  // Komfort: Explosion nach Größe (Ironclad: 0.5 Granate .. 4 Boss), mit Ducking ab 1.6
  explosion(size, x, y) {
    const id = size < 1 ? 'explosion_s' : size < 2.2 ? 'explosion_m' : 'explosion_l';
    this.play(id, { x, y, gain: clamp(0.55 + size * 0.28, 0.5, 1.3) });
    if (size >= 1.6) this.duck();
  },
  scream(voice = 'mann', x, y) { this.play('scream_' + voice, { x, y, cat: 'schrei', bus: 'stimmen' }); }
};

// ------------------------------------------------------------------
// Ambiente (PLAN §4.10): Regen, Stadt-Brummen je Distrikt (weich übergeblendet), Neon-Summen nahe Schildern, ferne Hupen
// ------------------------------------------------------------------
const Amb = {
  L: null, nextHorn: 600,
  start() {
    if (this.L || !Aud.ac || Aud.ac.state !== 'running' || !Aud.bank.rain_loop || !Aud.bank.neon_buzz || !Aud.bank.hum_krone) return;
    this.L = { rain: Aud.loop('rain_loop'), docks: Aud.loop('hum_docks'), neon: Aud.loop('hum_neon'), krone: Aud.loop('hum_krone'), buzz: Aud.loop('neon_buzz') };
  },
  // Raumatmosphäre: drinnen je Raumtyp (Bar-Bass, Klinik-Piepen, Maschinen, Brummen); draußen nur der dumpfe Bar-Bass an der Tür (PLAN §4.10)
  rooms(x, y) {
    if (!this.R) { if (!(Aud.bank.raum_bar && Aud.bank.raum_hum && Aud.bank.raum_klinik && Aud.bank.raum_halle)) return; this.R = { hum: Aud.loop('raum_hum', 'ambience'), bar: Aud.loop('raum_bar', 'ambience', { lp: 500 }), klinik: Aud.loop('raum_klinik', 'ambience'), halle: Aud.loop('raum_halle', 'ambience') }; }
    const L = { hum: 0, bar: 0, klinik: 0, halle: 0 }, cut = { bar: 500 }, I = Interiors.cur; let pan = 0;
    if (I) { const r = I.leaves.find(q => x > q.x0 && x < q.x1 && y > q.y0 && y < q.y1), k = (r && ROOM_SOUND[r.type]) || 'hum'; L[k] = 0.55; L.hum = Math.max(L.hum, 0.12); cut.bar = 6500; }
    else { let bd = 300; for (const b of Interiors.list) { const k = ROOM_SOUND[b._kind === 'nudelbar' || b._kind === 'bar' ? 'bar' : b._kind === 'spielhalle' ? 'spiel' : ''] ; if (k !== 'bar') continue; const d = Math.hypot(b._door.x - x, b._door.y - y); if (d < bd) { bd = d; pan = clamp((b._door.x - x) / 200, -0.8, 0.8); } } if (bd < 300) L.bar = 0.4 * Math.pow(1 - bd / 300, 1.5); }
    for (const k in L) this.R[k].setLevel(L[k], pan, cut[k]);
  },
  // Aufruf alle 6 Ticks mit Hörerposition (Weltpixel)
  update(x, y) {
    this.start(); const L = this.L; if (!L || Aud.muted) return;
    const tx = x / C.TILE, sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const krone = sm(194, 214, tx), docks = (1 - sm(90, 110, tx)) * (1 - krone), neon = Math.max(0, 1 - docks - krone);
    L.rain.setLevel(0.55 * G.rain * (G.inside ? 0.35 : 1)); L.docks.setLevel(0.5 * docks); L.neon.setLevel(0.5 * neon); L.krone.setLevel(0.5 * krone);
    const n = G.city ? World.nearestNeon(x, y, 220) : null;                       // Neon-Summen: lauter und seitlich nahe am Schild
    if (n) L.buzz.setLevel(0.5 * (1 - n.d / 220) * (1 - n.d / 220), clamp((n.x - x) / 160, -0.8, 0.8)); else L.buzz.setLevel(0);
    this.rooms(x, y);
    if (--this.nextHorn <= 0) { this.nextHorn = 480 + Math.floor(Math.random() * 900); const a = Math.random() * TAU, d = 700 + Math.random() * 500; Aud.play('horn_far', { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, gain: 0.8 }); }
  }
};

// ------------------------------------------------------------------
// Fahrzeug-Klang (PLAN §4.10, WORLD.md §13): Motor je Klasse (Drehzahl), Reifenquietschen, Feuer, Hupe, Crash/Türen/Boost über den Bus
// ------------------------------------------------------------------
const ENG = {          // f Grundton, wave/w2 Oszillatoren, k2 Verhältnis des 2., lp Filterbereich, gears Schaltstufen (0 = stufenlos/elektrisch), am Pulsfrequenz (Diesel)
  whine:   { f: 90,  wave: 'triangle', w2: 'sine',     k2: 2,    lp: [900, 3500], vol: 0.32, gears: 0, spread: 2.2 },
  hybrid:  { f: 62,  wave: 'sawtooth', w2: 'triangle', k2: 0.5,  lp: [380, 1800], vol: 0.32, gears: 0, spread: 1.8 },
  turbine: { f: 120, wave: 'sawtooth', w2: 'square',   k2: 1.5,  lp: [800, 5000], vol: 0.28, gears: 0, spread: 3.2, noise: 0.25 },
  hover:   { f: 70,  wave: 'sine',     w2: 'triangle', k2: 2.01, lp: [500, 2200], vol: 0.34, gears: 0, spread: 1.8, noise: 0.4 },
  diesel:  { f: 38,  wave: 'sawtooth', w2: 'square',   k2: 0.5,  lp: [250, 900],  vol: 0.38, gears: 4, spread: 2.0, am: 14 },
  heavy:   { f: 30,  wave: 'sawtooth', w2: 'square',   k2: 0.5,  lp: [200, 700],  vol: 0.42, gears: 5, spread: 2.2, am: 10 },
  bike:    { f: 140, wave: 'sawtooth', w2: 'sine',     k2: 2,    lp: [1000, 4500], vol: 0.28, gears: 0, spread: 2.4 },
  board:   { f: 90,  wave: 'sine',     w2: 'triangle', k2: 3,    lp: [600, 3000], vol: 0.22, gears: 0, spread: 2.0, noise: 0.55 }
};
const Eng = {
  voices: new Map(), horn: null, L: null, inited: false,
  init() {
    if (this.inited) return; this.inited = true;
    const P = (id, v, k = 1) => Aud.play(id, { x: v.x, y: v.y, gain: k });
    Bus.on('crash', (v, k) => { P(k < 4 ? 'crash_s' : k < 8 ? 'crash_m' : 'crash_l', v, clamp(0.5 + k / 10, 0.5, 1.3)); if (k > 7.5) P('glas', v, 0.8); if (k > 10) Aud.duck(); });
    Bus.on('door', (v, open) => P(open ? 'tuer_auf' : 'tuer_zu', v, 0.8));
    Bus.on('boost', v => P('boost', v, 0.8));
    Bus.on('alarm', v => P('alarm', v, 0.7));
    let splT = 0; Bus.on('splash', v => { if (G.time - splT > 14) { splT = G.time; P('spritzer', v, 0.8); } });
  },
  make(v) {
    const ac = Aud.ac, D = ENG[VEHICLES[v.cls].snd], o = { D, nodes: [] };
    o.o1 = ac.createOscillator(); o.o1.type = D.wave; o.o2 = ac.createOscillator(); o.o2.type = D.w2;
    o.g2 = ac.createGain(); o.g2.gain.value = 0.5; o.lp = ac.createBiquadFilter(); o.lp.type = 'lowpass'; o.lp.Q.value = 1.2;
    o.g = ac.createGain(); o.g.gain.value = 0; o.pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    o.o1.connect(o.lp); o.o2.connect(o.g2); o.g2.connect(o.lp); o.lp.connect(o.g);
    if (D.am) { o.am = ac.createOscillator(); o.am.frequency.value = D.am; o.amg = ac.createGain(); o.amg.gain.value = 0; o.am.connect(o.amg); o.amg.connect(o.g.gain); o.am.start(); }
    if (D.noise) { o.n = ac.createBufferSource(); o.n.buffer = Aud.noiseBuf(); o.n.loop = true; o.nf = ac.createBiquadFilter(); o.nf.type = 'bandpass'; o.nf.Q.value = 0.8; o.ng = ac.createGain(); o.ng.gain.value = 0; o.n.connect(o.nf); o.nf.connect(o.ng); o.ng.connect(o.lp); o.n.start(); }
    if (o.pan) { o.g.connect(o.pan); o.pan.connect(Aud.bus.sfx); } else o.g.connect(Aud.bus.sfx);
    o.o1.start(); o.o2.start(); return o;
  },
  kill(o) { const t = Aud.ac.currentTime; o.g.gain.setTargetAtTime(0, t, 0.05); for (const n of [o.o1, o.o2, o.am, o.n]) if (n) try { n.stop(t + 0.4); } catch (e) {} },
  // alle 2 Ticks: bis zu 3 hörbare Motoren (Spieler zuerst, dann die nächsten bewegten/laufenden)
  update() {
    if (!Aud.ac || Aud.ac.state !== 'running' || Aud.muted) return;
    this.init(); const ac = Aud.ac, t = ac.currentTime, p = G.player;
    const cand = [];
    for (const v of G.vehicles) {
      if (v.dead || v.burn > 0 && !v.driver) continue;
      const sp = Math.hypot(v.vx, v.vy); if (!(v.driver || sp > 0.6) || !onScreen(v.x, v.y, 500)) continue;
      cand.push({ v, sp, d: v.driver ? -1 : Math.hypot(v.x - G.cam.x, v.y - G.cam.y) });
    }
    cand.sort((a, b) => a.d - b.d); const keep = new Set(cand.slice(0, C.VOICES_MAX.motor).map(c => c.v.id));
    for (const [id, o] of this.voices) if (!keep.has(id)) { this.kill(o); this.voices.delete(id); }
    for (const { v, sp } of cand.slice(0, C.VOICES_MAX.motor)) {
      let o = this.voices.get(v.id); if (!o) { o = this.make(v); this.voices.set(v.id, o); }
      const D = o.D, top = VEHICLES[v.cls].top, sf = clamp(sp / top, 0, 1.2), thr = v.driver === p ? Math.abs(G.in.throttle - G.in.brake || Math.hypot(G.in.mx, G.in.my)) : 0;
      let rpm; if (D.gears) { const gi = Math.min(D.gears - 1, Math.floor(sf * D.gears)), fr = sf * D.gears - gi; rpm = 0.22 + 0.7 * clamp(fr, 0, 1); } else rpm = 0.2 + 0.8 * sf;
      rpm = clamp(rpm + 0.12 * thr, 0.15, 1.1);
      const f1 = D.f * (1 + rpm * D.spread), pl = Aud.place(v.x, v.y);
      o.o1.frequency.setTargetAtTime(f1, t, 0.06); o.o2.frequency.setTargetAtTime(f1 * D.k2, t, 0.06);
      const cut = D.lp[0] + (D.lp[1] - D.lp[0]) * rpm; o.lp.frequency.setTargetAtTime(pl.lp ? Math.min(cut, pl.lp) : cut, t, 0.08);
      const vol = D.vol * (0.35 + 0.65 * Math.max(sf, thr)) * pl.v; o.g.gain.setTargetAtTime(D.am ? vol * 0.75 : vol, t, 0.08);
      if (o.amg) { o.am.frequency.setTargetAtTime(D.am * (0.5 + rpm), t, 0.1); o.amg.gain.setTargetAtTime(vol * 0.3, t, 0.1); }
      if (o.ng) { o.nf.frequency.setTargetAtTime(500 + rpm * 2600, t, 0.08); o.ng.gain.setTargetAtTime(D.noise * vol * rpm * 1.2, t, 0.08); }
      if (o.pan) o.pan.pan.setTargetAtTime(pl.pan, t, 0.08);
    }
    // Reifenquietschen (Spielerfahrzeug), Feuer (nächstes brennendes Fahrzeug)
    if (!this.L && Aud.bank.skid_loop && Aud.bank.feuer_loop) this.L = { skid: Aud.loop('skid_loop', 'sfx'), fire: Aud.loop('feuer_loop', 'ambience') };
    if (this.L) {
      const pv = p && p.veh, slip = pv && !VEHICLES[pv.cls].hover && Math.hypot(pv.vx, pv.vy) > 1 ? pv.slip : 0;
      this.L.skid.setLevel(clamp((slip - 1.2) / 4, 0, 1) * 0.7);
      let bd = 1e9, bv = null; for (const v of G.vehicles) if (v.burn > 0) { const d = Math.hypot(v.x - G.cam.x, v.y - G.cam.y); if (d < bd) { bd = d; bv = v; } }
      if (bv && bd < 600) { const pl = Aud.place(bv.x, bv.y); this.L.fire.setLevel(0.7 * Math.pow(1 - bd / 600, 1.5), pl.pan); } else this.L.fire.setLevel(0);
    }
    // Sirenen (max. 2): Zweiton 650/900 Hz, Lautstärke nach Abstand, Doppler nach Annäherungsgeschwindigkeit
    this.sir = this.sir || new Map(); const sc = []; for (const v of G.vehicles) if (v.od && !v.dead && (v.od.siren || G.wanted.level > 0) && !v.od.leave && onScreen(v.x, v.y, 900)) sc.push(v);
    sc.sort((a, b) => Math.hypot(a.x - G.cam.x, a.y - G.cam.y) - Math.hypot(b.x - G.cam.x, b.y - G.cam.y)); const keepS = new Set(sc.slice(0, C.VOICES_MAX.sirene).map(v => v.id));
    for (const [id, o] of this.sir) if (!keepS.has(id)) { const n = ac.currentTime; o.g.gain.setTargetAtTime(0, n, 0.05); try { o.o.stop(n + 0.3); } catch (e) {} this.sir.delete(id); }
    for (const v of sc.slice(0, C.VOICES_MAX.sirene)) {
      let o = this.sir.get(v.id); if (!o) { o = { o: ac.createOscillator(), lp: ac.createBiquadFilter(), g: ac.createGain(), pan: ac.createStereoPanner ? ac.createStereoPanner() : null }; o.o.type = 'square'; o.lp.type = 'lowpass'; o.lp.frequency.value = 1800; o.g.gain.value = 0; o.o.connect(o.lp); o.lp.connect(o.g); if (o.pan) { o.g.connect(o.pan); o.pan.connect(Aud.bus.sfx); } else o.g.connect(Aud.bus.sfx); o.o.start(); this.sir.set(v.id, o); }
      const pl = Aud.place(v.x, v.y), rx = v.x - G.cam.x, ry = v.y - G.cam.y, dd = Math.hypot(rx, ry) || 1, vr = ((v.vx) * rx + (v.vy) * ry) / dd, dop = 1 / (1 + 0.5 * vr / 22), f = (((G.time / 33) | 0) % 2 ? 900 : 650) * clamp(dop, 0.8, 1.25);
      o.o.frequency.setTargetAtTime(f, t, 0.02); o.g.gain.setTargetAtTime(0.1 * pl.v * pl.v, t, 0.1); if (o.pan) o.pan.pan.setTargetAtTime(pl.pan, t, 0.1);
    }
    // Hupe (H): zwei Rechtecktöne 350/440 Hz, solange gedrückt
    const hornOn = !!(p && p.veh && G.in.horn);
    if (hornOn && !this.horn) {
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = o2.type = 'square'; o1.frequency.value = 350; o2.frequency.value = 440; lp.type = 'lowpass'; lp.frequency.value = 1500; g.gain.value = 0.0001; g.gain.setTargetAtTime(0.22, t, 0.01);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(Aud.bus.sfx); o1.start(); o2.start(); this.horn = { o1, o2, g };
    } else if (!hornOn && this.horn) { const h = this.horn; h.g.gain.setTargetAtTime(0, t, 0.02); h.o1.stop(t + 0.15); h.o2.stop(t + 0.15); this.horn = null; }
  }
};
