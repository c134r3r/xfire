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
        try { list.push(await this.render(d, 1000 + v * 77 + id.length * 13, v)); log.n++; }
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
    d.fn(new Mix(oc, seed), variant);
    const buf = await oc.startRendering();
    let pk = 0, nan = false;
    for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a !== a) nan = true; if (a > pk) pk = a; } }
    const k = pk > 0 && !nan ? 0.89 / pk : 1, fade = Math.floor(0.03 * SR);
    for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = nan ? 0 : x[i] * k * Math.min(1, (x.length - i) / fade); }
    buf.rawPeak = pk; buf.hadNaN = nan; return buf;
  },

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
    if (!this.ac || this.muted || this.ac.state !== 'running' || !USE_REC) return -1;
    let pool = recPool(cat, voice); if (o.speaker) { const s = pool.filter(it => it.speaker === o.speaker); if (s.length) pool = s; }
    if (!pool.length) return -1;
    const pl = this.place(o.x, o.y), vol = pl.v * (o.gain === undefined ? 1 : o.gain);
    if (!this._admit('schrei', vol)) return -1;
    const it = pickRec(Math.random, pool), rate = (0.95 + Math.random() * 0.1) * (o.rate || 1), len = it.buf.duration / rate;
    const cut = o.cut || 0, fade = o.fade || 0.015, ac = this.ac, t = ac.currentTime, end = cut ? Math.min(cut, len) : len;
    const rec = this._start(it.buf, vol, pl.pan, pl.lp, 'stimmen', rate, 'schrei', end + fade);
    const gp = rec.g.gain; gp.cancelScheduledValues(t); gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(vol, t + 0.004);
    if (cut) { gp.setValueAtTime(vol, t + end); gp.linearRampToValueAtTime(0.0001, t + end + fade); rec.src.stop(t + end + fade + 0.03); }
    else { gp.setValueAtTime(vol, t + Math.max(0.01, end - 0.02)); gp.linearRampToValueAtTime(0.0001, t + end); }
    return t + end;
  },
  // Komfort: Explosion nach Größe (Ironclad: 0.5 Granate .. 4 Boss), mit Ducking ab 1.6
  explosion(size, x, y) {
    const id = size < 1 ? 'explosion_s' : size < 2.2 ? 'explosion_m' : 'explosion_l';
    this.play(id, { x, y, gain: clamp(0.55 + size * 0.28, 0.5, 1.3) });
    if (size >= 1.6) this.duck();
  },
  scream(voice = 'mann', x, y) { this.play('scream_' + voice, { x, y, cat: 'schrei', bus: 'stimmen' }); }
};
