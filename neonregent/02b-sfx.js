'use strict';
// 02b-sfx.js - Klangrezepte (offline gerendert) + SOUND_DEFS für die Klangbank. Referenz: docs/neon-regent/klangprobe.html,
// Ironclad (explode), XFire. Menschliche Laute = Aufnahmen (REC aus 02-audio.js); die Synthese-Stimme ist nur Rückfall.
// Exportiert: Mix, scream, groan, runOver, panic, execution, mandatCall, explosionSnd, SOUND_DEFS

// ------------------------------------------------------------------
// Mini-Synthese-Bausteine auf einem OfflineAudioContext
// ------------------------------------------------------------------
class Mix {
  constructor(oc, seed, noiseLen = 8) {
    this.oc = oc; this.rnd = rng(seed); this.nl = noiseLen;
    this.master = oc.createGain(); this.master.connect(oc.destination);
    this._noise = this.noiseBuf(noiseLen);
  }
  get verbIn() {                                  // Straßenhall erst bei erster Nutzung bauen (kurze Klänge brauchen ihn nicht)
    if (!this._verbIn) { this._verbIn = this.oc.createGain(); const cv = this.oc.createConvolver(); cv.buffer = this.impulse(1.6); this._verbIn.connect(cv); cv.connect(this.master); }
    return this._verbIn;
  }
  r(a, b) { return a + (b - a) * this.rnd(); }
  pick(a) { return a[(this.rnd() * a.length) | 0]; }
  noiseBuf(dur) { const n = Math.ceil(dur * SR), b = this.oc.createBuffer(1, n, SR), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = this.rnd() * 2 - 1; return b; }
  // Straßenhall: frühe Reflexionen an Fassaden + gedämpfter Nachhall (stereo)
  impulse(T60) {
    const n = Math.ceil(T60 * SR), b = this.oc.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / SR, k = Math.min(0.93, 0.3 + t * 1.3); lp = lp * k + (this.rnd() * 2 - 1) * (1 - k); d[i] = lp * Math.exp(-6.9 * t / T60) * 2.2; }
      for (const [dt, a] of [[0.029, 0.5], [0.047, 0.36], [0.083, 0.28], [0.121, 0.2], [0.168, 0.14]]) { const i = Math.floor((dt + c * 0.0045) * SR); if (i < n) d[i] += a; }
    }
    return b;
  }
  // Zielbus: Lautstärke, optional Tiefpass (Entfernung), Panorama, Hall-Anteil
  bus(pan = 0, gain = 1, send = 0.2, lowpass = 0) {
    const g = this.gain(gain); let head = g;
    if (lowpass) { const f = this.filt('lowpass', lowpass); g.connect(f); head = f; }
    const p = this.oc.createStereoPanner(); p.pan.value = pan; head.connect(p); p.connect(this.master);
    if (send) { const s = this.gain(send); head.connect(s); s.connect(this.verbIn); }
    return g;
  }
  noise(t, dur) { const s = this.oc.createBufferSource(); s.buffer = this._noise; s.start(Math.max(0, t), this.r(0, Math.max(0, this.nl - dur - 0.1)), dur + 0.05); return s; }
  osc(type, t, dur) { const o = this.oc.createOscillator(); o.type = type; o.start(Math.max(0, t)); o.stop(t + dur + 0.05); return o; }
  filt(type, f, q = 0.7) { const b = this.oc.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v) { const g = this.oc.createGain(); g.gain.value = v; return g; }
  env(points) {                      // [[t, v], …] linear hoch, exponentiell runter
    const g = this.oc.createGain(), p = g.gain; p.setValueAtTime(0.00001, 0); let prev = 0;
    for (const [t, v0] of points) { const v = Math.max(0.00001, v0); if (v >= prev) p.linearRampToValueAtTime(v, t); else p.exponentialRampToValueAtTime(v, t); prev = v; }
    return g;
  }
  drive(amount) { const ws = this.oc.createWaveShaper(), n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); } ws.curve = c; ws.oversample = '2x'; return ws; }
  hit(t, dur, type, f, q, vol, dest, f1) {   // gefiltertes Rauschen
    const s = this.noise(t, dur), b = this.filt(type, f, q);
    if (f1) { b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(f1, t + dur); }
    const e = this.env([[t, 0], [t + 0.002, vol], [t + dur, 0.0001]]);
    s.connect(b); b.connect(e); e.connect(dest);
  }
  thump(t, f0, f1, dur, vol, dest) {        // tiefer Schlag
    const o = this.osc('sine', t, dur); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const e = this.env([[t, 0], [t + 0.004, vol], [t + dur, 0.0001]]); o.connect(e); e.connect(dest);
  }
  clicks(t0, t1, n, fLo, fHi, vol, dest) { for (let i = 0; i < n; i++) this.hit(this.r(t0, t1), this.r(0.006, 0.02), 'bandpass', this.r(fLo, fHi), this.r(3, 8), vol * this.r(0.3, 1), dest); }
}

// ------------------------------------------------------------------
// Aufnahme im Offline-Mix abspielen (Gegenstück zu Aud.playRec). Endzeit oder -1.
// ------------------------------------------------------------------
function playRecOff(m, t, cat, voice, o = {}) {
  if (!USE_REC) return -1;
  const pool = recPool(cat, voice); if (!pool.length) return -1;
  const it = pickRec(m.rnd, pool), rate = m.r(0.95, 1.05) * (o.rate || 1), len = it.buf.duration / rate;
  const cut = o.cut || o.recCut || 0, fade = o.fade || 0.015;
  const end = cut ? t + Math.min(cut, len) : t + len;
  const dest = o.dest || m.bus(o.pan || 0, o.gain === undefined ? 1 : o.gain, o.send === undefined ? 0.12 : o.send, o.lowpass || 0);
  const src = m.oc.createBufferSource(); src.buffer = it.buf; src.playbackRate.value = rate;
  const env = cut ? m.env([[t, 0], [t + 0.004, 1], [end, 1], [end + fade, 0.0001]]) : m.env([[t, 0], [t + 0.004, 1], [end - 0.02, 1], [end, 0.0001]]);
  src.connect(env); env.connect(dest); src.start(Math.max(0, t)); src.stop(end + fade + 0.03);
  return end;
}

// ------------------------------------------------------------------
// Stimmmodell für Schreie (nur Rückfall bei leerem Bundle)
// ------------------------------------------------------------------
const VOICES = {
  mann: { peak: [430, 520], rough: [0.25, 0.4], roughHz: [45, 70], sub: [0.15, 0.3], drive: [2.5, 3.5], breath: 0.12, vowel: 'a' },
  frau: { peak: [760, 960], rough: [0.15, 0.28], roughHz: [55, 85], sub: [0.05, 0.14], drive: [2, 3], breath: 0.10, vowel: 'ae' },
  alt:  { peak: [360, 430], rough: [0.4, 0.55], roughHz: [35, 55], sub: [0.25, 0.4], drive: [3, 4], breath: 0.18, vowel: 'o' },
  jung: { peak: [900, 1120], rough: [0.1, 0.2], roughHz: [60, 95], sub: [0, 0.08], drive: [1.8, 2.5], breath: 0.09, vowel: 'a' }
};
const VOWEL_F = { a: [[850, 6], [1350, 7], [2700, 9], [3700, 10]], ae: [[700, 6], [1750, 8], [2600, 9], [3600, 10]], o: [[600, 6], [1000, 7], [2550, 9], [3500, 10]] };
function formants(vowel, peak) {
  const T = VOWEL_F[vowel];
  const f1 = Math.max(T[0][0], Math.min(peak * 1.08, 1250));           // F1 folgt hoher Tonhöhe
  return [[f1, T[0][1], 1.0], [Math.max(T[1][0], f1 * 1.45), T[1][1], 0.75], [T[2][0], T[2][1], 0.42], [T[3][0], T[3][1], 0.28]];
}

// Schrei ab Zeit t. o: { dur, peak, cut (s nach Start: abrupt abreißen), pan, gain, send, lowpass, dest, cat }
function scream(m, t, voice, o = {}) {
  { const e = playRecOff(m, t, o.cat || 'angst', voice, o); if (e >= 0) return e; }        // Aufnahme, falls vorhanden
  const V = VOICES[voice], oc = m.oc;
  const peak = o.peak || m.r(V.peak[0], V.peak[1]), dur = o.dur || m.r(0.75, 1.25), rise = m.r(0.05, 0.1), crest = m.r(0.25, 0.4);
  const end = t + dur, cut = o.cut ? t + o.cut : 0, stop = cut || end, len = stop - t + 0.05;
  const dest = o.dest || m.bus(o.pan || 0, o.gain === undefined ? 1 : o.gain, o.send === undefined ? 0.12 : o.send, o.lowpass || 0);
  const pk = m.r(1.0, 1.08), mid = m.r(0.84, 0.92), fall = m.r(0.55, 0.7);
  const contour = (p, k) => { p.setValueAtTime(peak * 0.55 * k, t); p.exponentialRampToValueAtTime(peak * 0.97 * k, t + rise);
    p.linearRampToValueAtTime(peak * pk * k, t + dur * crest); p.linearRampToValueAtTime(peak * mid * k, t + dur * 0.78);
    p.exponentialRampToValueAtTime(peak * fall * k, end); };
  const src = m.osc('sawtooth', t, len); contour(src.frequency, 1);
  const sub = m.osc('sawtooth', t, len); contour(sub.frequency, 0.5);                  // Periodenverdopplung (Knurren)
  const mod = (node) => { node.connect(src.frequency); const h = m.gain(0.5); node.connect(h); h.connect(sub.frequency); };
  { const v = m.osc('sine', t, len); v.frequency.value = m.r(5, 7); const g = m.gain(peak * m.r(0.004, 0.012)); v.connect(g); mod(g); }  // schwaches Vibrato
  { const n = m.noise(t, len), f = m.filt('lowpass', 40), g = m.gain(peak * m.r(0.06, 0.1)); n.connect(f); f.connect(g); mod(g); }      // Jitter
  { const n = m.noise(t, len), f = m.filt('lowpass', 4), g = m.gain(peak * m.r(0.25, 0.4)); n.connect(f); f.connect(g); mod(g); }      // Drift
  const cracks = (m.rnd() * 3) | 0;                                                                                         // Stimmbrüche
  if (cracks) { const cs = oc.createConstantSource(); cs.offset.setValueAtTime(0, t);
    for (let i = 0; i < cracks; i++) { const tc = t + dur * m.r(0.35 + i * 0.25, 0.5 + i * 0.25), d = m.r(0.03, 0.06);
      if (tc + d < stop) { cs.offset.setValueAtTime(-peak * m.r(0.12, 0.2), tc); cs.offset.setValueAtTime(0, tc + d); } }
    cs.start(t); cs.stop(stop + 0.05); mod(cs); }
  const rough = m.r(V.rough[0], V.rough[1]), am = m.gain(1 - rough / 2);                                                 // unregelmäßige Rauheit
  const lfo = m.osc('sine', t, len); lfo.frequency.value = m.r(V.roughHz[0], V.roughHz[1]);
  { const n = m.noise(t, len), f = m.filt('lowpass', 8), g = m.gain(m.r(15, 30)); n.connect(f); f.connect(g); g.connect(lfo.frequency); }
  const lg = m.gain(rough / 2); lfo.connect(lg); lg.connect(am.gain);
  src.connect(am);
  const subLvl = m.r(V.sub[0], V.sub[1]), sg = m.gain(subLvl); sg.gain.setValueAtTime(subLvl, t); sg.gain.linearRampToValueAtTime(subLvl * 0.3, end);
  sub.connect(sg); sg.connect(am);
  const dr = m.drive(m.r(V.drive[0], V.drive[1])); am.connect(dr);
  const env = cut ? m.env([[t, 0], [t + 0.03, 1], [cut, 0.92], [cut + 0.012, 0.0001]])
                  : m.env([[t, 0], [t + 0.03, 1], [t + dur * 0.6, 0.85], [end, 0.0001]]);
  for (const [f, q, a] of formants(V.vowel, peak)) {
    const bp = m.filt('bandpass', f, q), g = m.gain(a); bp.frequency.setValueAtTime(f, t); bp.frequency.linearRampToValueAtTime(f * m.r(0.88, 0.95), end);  // Formant-Drift
    dr.connect(bp); bp.connect(g); g.connect(env);
  }
  const body = m.filt('lowpass', 3800), bg = m.gain(0.12); dr.connect(body); body.connect(bg); bg.connect(env);
  const br = m.noise(t, len), bbp = m.filt('bandpass', m.r(2600, 3600), 0.9), brg = m.gain(V.breath);                   // Atem, wird stärker
  brg.gain.setValueAtTime(V.breath, t); brg.gain.linearRampToValueAtTime(V.breath * 1.8, end); br.connect(bbp); bbp.connect(brg); brg.connect(env);
  env.connect(dest);
  m.hit(t - 0.03, 0.07, 'bandpass', 1900, 1.2, V.breath * 2.5, dest);                  // "h"-Anlaut
  return stop;
}
// Stöhnen am Boden: tief, behaucht, zwei Stöße
function groan(m, t, voice, pan) {
  { const e = playRecOff(m, t, 'stoehnen', voice, { pan, gain: 0.95, send: 0.25 });                    // Aufnahme: zwei Takes nacheinander
    if (e >= 0) { playRecOff(m, e + m.r(0.35, 0.7), 'stoehnen', voice, { pan, gain: 0.8, send: 0.25 }); return; } }
  const V = VOICES[voice], f0 = V.peak[0] * 0.38;
  for (const [dt, d] of [[0, 0.5], [0.75, 0.6]]) {
    const s = t + dt, src = m.osc('sawtooth', s, d);
    src.frequency.setValueAtTime(f0, s); src.frequency.exponentialRampToValueAtTime(f0 * 0.8, s + d);
    const env = m.env([[s, 0], [s + 0.12, 0.6], [s + d, 0.0001]]);
    for (const [f, q, a] of [[550, 6, 1], [950, 7, 0.6], [2450, 8, 0.2]]) { const bp = m.filt('bandpass', f, q), g = m.gain(a); src.connect(bp); bp.connect(g); g.connect(env); }
    const br = m.noise(s, d), bf = m.filt('bandpass', 1500, 0.8), bg = m.gain(0.35); br.connect(bf); bf.connect(bg); bg.connect(env);
    env.connect(m.bus(pan, 0.95, 0.25));
  }
}

// ------------------------------------------------------------------
// Szenen und Ereignisse
// ------------------------------------------------------------------
// Ironclad-Explosion (SFX.explode) als Offline-Rezept + Fassaden-Hall der Straße. size: 0.5 (Granate) .. 4 (Boss)
function explosionSnd(m, size) {
  const s = clamp(size, 0.4, 4), dest = m.bus(0, 1, 0.2 + 0.08 * s);
  m.thump(0, 95 / Math.sqrt(s) + 20, 28, 0.35 + s * 0.25, 0.95 * Math.min(1.4, s), dest);           // Wumms
  m.hit(0, 0.45 + s * 0.45, 'lowpass', 2400, 0.7, 0.85 * Math.min(1.3, s), dest, 160);              // Rauschen, fällt ab
  m.hit(0, 0.18, 'highpass', 2800, 0.7, 0.28, dest);                                                  // Knall-Spitze
  m.clicks(0.02, 0.2 + 0.1 * s, Math.round(4 + 3 * s), 1500, 6000, 0.22, dest);                      // Trümmerknistern
  if (s > 1.4) m.hit(0.08, 1.4, 'bandpass', 500, 0.8, 0.25, dest, 120);                               // langes Grollen
  if (s > 2.5) m.thump(0.05, 55, 22, 1.1, 0.55, dest);                                                // Boss/Tank: Nachbeben
}
function runOver(m, lethal, voice) {
  const t0 = 0.1, impact = t0 + 0.5, street = m.bus(0, 0.9, 0.22);
  // Auto nähert sich: Motor + Luft
  { const o = m.osc('sawtooth', t0 - 0.05, 0.7); o.frequency.setValueAtTime(48, t0 - 0.05); o.frequency.linearRampToValueAtTime(74, impact);
    const f = m.filt('lowpass', 320, 1.5), e = m.env([[t0 - 0.05, 0], [impact - 0.02, 0.35], [impact + 0.25, 0.0001]]); o.connect(f); f.connect(e); e.connect(m.bus(-0.3, 1, 0.1)); }
  { const n = m.noise(t0, 0.75), f = m.filt('bandpass', 400, 0.7); f.frequency.setValueAtTime(400, t0); f.frequency.exponentialRampToValueAtTime(1400, impact);
    const e = m.env([[t0, 0], [impact, 0.22], [impact + 0.3, 0.0001]]); n.connect(f); f.connect(e); e.connect(m.bus(-0.2, 1, 0.1)); }
  // Angstschrei – bei tödlichem Treffer reißt er im Aufprall ab (überlebt: bricht die Aufnahme weicher ab - ihr bleibt die Luft weg)
  scream(m, t0 + 0.05, voice, { dur: lethal ? 0.9 : 0.75, cut: lethal ? impact - t0 - 0.04 : 0, recCut: impact - t0 + 0.02, fade: lethal ? 0.015 : 0.09, pan: 0.1, send: 0.2 });
  // Aufprall: Masse, Körper, Kunststoff, Knacken
  m.thump(impact, 62, 30, 0.28, 1.0, street);                     // Masse (auf großen Lautsprechern)
  m.thump(impact, 190, 85, 0.07, 1.0, street);                     // Punch (auch auf Handy-Lautsprechern hörbar)
  m.hit(impact, 0.14, 'lowpass', 260, 0.8, 0.8, street);
  m.hit(impact, 0.09, 'bandpass', 750, 1.3, 1.4, street);          // Körper
  m.hit(impact, 0.03, 'highpass', 2600, 0.7, 0.6, street);         // Kunststoff/Blech
  m.clicks(impact, impact + 0.07, 18, 1800, 6500, 0.7, street);    // Knacken
  if (lethal) {
    for (const [dt, v] of [[0.17, 0.95], [0.31, 0.85]]) { m.thump(impact + dt, 50, 30, 0.13, v, street); m.hit(impact + dt, 0.08, 'lowpass', 200, 0.8, v * 0.7, street); }  // Vorder- und Hinterachse
    m.hit(impact + 0.04, 0.16, 'bandpass', 1500, 2.2, 0.55, street, 380); m.thump(impact + 0.04, 130, 70, 0.06, 0.4, street);                  // nasser Splat
    m.clicks(impact + 0.05, impact + 0.25, 8, 900, 2500, 0.15, street);
  } else {
    for (const [dt, v] of [[0.18, 0.55], [0.34, 0.4], [0.52, 0.25]]) { m.thump(impact + dt, 90, 45, 0.09, v, street); m.hit(impact + dt, 0.07, 'lowpass', 500, 0.8, v * 0.7, street); }  // Abrollen
    { const n = m.noise(impact + 0.55, 0.35), f = m.filt('bandpass', 900, 0.8), e = m.env([[impact + 0.55, 0], [impact + 0.6, 0.18], [impact + 0.9, 0.0001]]); n.connect(f); f.connect(e); e.connect(street); }
    scream(m, impact + 0.7, voice, { cat: 'schmerz', rate: 0.93, dur: 0.45, peak: VOICES[voice].peak[0] * 0.8, pan: 0.15, gain: 0.8, send: 0.25 });  // Schmerzschrei
    groan(m, impact + 1.6, voice, 0.15);
  }
  // Bremsenquietschen
  { const o = m.osc('sawtooth', impact + 0.08, 0.62); o.frequency.setValueAtTime(m.r(1900, 2300), impact + 0.08); o.frequency.linearRampToValueAtTime(m.r(1500, 1800), impact + 0.7);
    const f = m.filt('bandpass', 2200, 6), e = m.env([[impact + 0.08, 0], [impact + 0.15, 0.08], [impact + 0.6, 0.05], [impact + 0.7, 0.0001]]); o.connect(f); f.connect(e); e.connect(m.bus(-0.25, 1, 0.2)); }
  // Passanten schreien (entfernt, verhallt, links/rechts)
  for (let i = 0; i < (lethal ? 3 : 2); i++) scream(m, impact + 0.4 + i * m.r(0.35, 0.6), m.pick(['mann', 'frau', 'frau', 'alt', 'jung']),
    { pan: m.r(-0.8, 0.8), gain: m.r(0.18, 0.32), send: 0.5, lowpass: m.r(1800, 3000), dur: m.r(0.7, 1.2) });
  return impact + 3;
}
function panic(m) {
  ['mann', 'frau', 'alt', 'jung', 'frau', 'mann', 'frau'].forEach((v, i) => scream(m, 0.1 + i * m.r(0.25, 0.45), v,
    { pan: m.r(-0.9, 0.9), gain: m.r(0.35, 0.9), send: 0.4, lowpass: m.r(2800, 6000), dur: m.r(0.6, 1.1) }));
  for (let p = 0; p < 4; p++) {            // Laufschritte mehrerer Menschen
    const pan = m.r(-0.8, 0.8), rate = m.r(0.17, 0.23), g = m.r(0.2, 0.4), bus = m.bus(pan, 1, 0.2);
    for (let t = m.r(0.2, 0.6); t < 3.3; t += rate * m.r(0.9, 1.1)) { m.hit(t, 0.035, 'lowpass', m.r(700, 1100), 0.8, g, bus); m.hit(t, 0.01, 'highpass', 3000, 0.7, g * 0.4, bus); }
  }
  return 4.2;
}
function execution(m) {
  const dest = m.bus(0, 1, 0.15);
  { const a = m.osc('sawtooth', 0, 1.5), b = m.osc('sawtooth', 0, 1.5); a.frequency.value = 50; b.frequency.value = 100.7;       // anschwellendes Summen
    const f = m.filt('lowpass', 150, 2); f.frequency.setValueAtTime(150, 0); f.frequency.exponentialRampToValueAtTime(2400, 1.42);
    const e = m.env([[0, 0], [1.38, 0.22], [1.45, 0.0001]]); a.connect(f); b.connect(f); f.connect(e); e.connect(dest); }
  for (const [t, f] of [[0.15, 1200], [0.55, 1400], [0.95, 1600]]) {                                                    // drei Pieptöne
    const o = m.osc('sine', t, 0.1), sq = m.osc('square', t, 0.1), sg = m.gain(0.08); o.frequency.value = f; sq.frequency.value = f; sq.connect(sg);
    const e = m.env([[t, 0], [t + 0.004, 0.5], [t + 0.085, 0.4], [t + 0.1, 0.0001]]); o.connect(e); sg.connect(e); e.connect(dest);
  }
  const tz = 1.4;                                                                                                          // Entladung
  { const o = m.osc('sawtooth', tz, 0.4); o.frequency.setValueAtTime(2600, tz); o.frequency.exponentialRampToValueAtTime(55, tz + 0.38);
    const d = m.drive(6), e = m.env([[tz, 0], [tz + 0.005, 0.7], [tz + 0.38, 0.0001]]); o.connect(d); d.connect(e); e.connect(dest); }
  m.hit(tz, 0.3, 'highpass', 2500, 0.7, 0.5, dest);
  m.clicks(tz, tz + 0.35, 45, 2500, 9000, 0.4, dest);
  scream(m, tz + 0.02, 'mann', { cat: 'treffer', dur: 0.3, cut: 0.2, fade: 0.03, gain: 0.7, peak: 380 });              // erstickter Laut
  m.thump(1.98, 75, 35, 0.22, 0.9, dest); m.hit(1.98, 0.12, 'lowpass', 320, 0.8, 0.6, dest); m.hit(2.1, 0.08, 'lowpass', 500, 0.8, 0.3, dest);  // Sturz
  { const o = m.osc('sine', 1.45, 2.2); o.frequency.value = 3800; const e = m.env([[1.45, 0], [1.6, 0.05], [3.6, 0.0001]]); o.connect(e); e.connect(m.bus(0, 1, 0)); }  // Tinnitus
  return 3.8;
}
function mandatCall(m) {
  const dest = m.bus(0, 1, 0.35);
  for (const [t, f] of [[0.05, 659.25], [0.28, 493.88], [0.51, 329.63]]) for (const det of [1, 1.004]) {                 // Jingle E5–B4–E4
    const o = m.osc('square', t, 0.3), lp = m.filt('lowpass', 2600), e = m.env([[t, 0], [t + 0.01, 0.18], [t + 0.22, 0.12], [t + 0.3, 0.0001]]);
    o.frequency.value = f * det; o.connect(lp); lp.connect(e); e.connect(dest);
  }
  const radio = m.gain(1), hp = m.filt('highpass', 260), lp = m.filt('lowpass', 3400), sh = m.drive(4);                // Maschinenstimme (XFire Series 9, tiefer)
  radio.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(m.bus(0, 0.9, 0.3));
  const VOW = [[[730, 8, 1], [1090, 10, 0.6], [2440, 12, 0.25]], [[270, 8, 1], [2290, 12, 0.5], [3010, 14, 0.2]], [[300, 8, 1], [870, 10, 0.5], [2240, 12, 0.2]],
               [[530, 8, 1], [1840, 10, 0.55], [2480, 12, 0.2]], [[570, 8, 1], [840, 10, 0.6], [2410, 12, 0.2]]];
  let t = 0.95;
  for (let w = 0; w < 4; w++) {
    for (let i = 0, n = 2 + ((m.rnd() * 3) | 0); i < n; i++) {
      const d = m.r(0.07, 0.13), src = m.osc('square', t, d); src.frequency.value = m.r(96, 108);
      const e = m.env([[t, 0], [t + 0.006, 0.35], [t + d - 0.006, 0.3], [t + d, 0.0001]]);
      for (const [f, q, a] of m.pick(VOW)) { const bp = m.filt('bandpass', f, q * 1.4), g = m.gain(a); src.connect(bp); bp.connect(g); g.connect(e); }
      e.connect(radio); t += d + m.r(0.008, 0.03);
    }
    t += m.r(0.12, 0.2);
  }
  return t + 0.6;
}


// ---- Ambiente (MS1): Regen, Stadt-Brummen je Distrikt, Neon-Summen, ferne Hupen, Schritte je Untergrund ----
function rainLoop(m) {
  const L = 6.6, dest = m.bus(0, 1, 0, 0);
  { const n = m.noise(0, L), hp = m.filt('highpass', 900), lp = m.filt('lowpass', 9000), g = m.gain(0.5); n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest); }        // Rauschteppich
  { const n = m.noise(0, L), bp = m.filt('bandpass', 380, 0.6), g = m.gain(0.32); n.connect(bp); bp.connect(g); g.connect(dest); }                                                   // Dach-/Asphaltwummern
  m.clicks(0, L, 300, 2600, 7800, 0.1, dest);                                                                                                                                        // einzelne Tropfen
}
function humLoop(m, kind) {
  const L = 6.6, dest = m.bus(0, 1, 0, 0);
  const drone = (f, type, lp, vol) => { const o = m.osc(type, 0, L); o.frequency.value = f; const fl = m.filt('lowpass', lp, 1), g = m.gain(vol); o.connect(fl); fl.connect(g); g.connect(dest); };
  const wash = (f, q, vol) => { const n = m.noise(0, L), bp = m.filt('bandpass', f, q), g = m.gain(vol); n.connect(bp); bp.connect(g); g.connect(dest); };
  if (kind === 'docks') { drone(46, 'sawtooth', 120, 0.35); drone(69.3, 'sine', 120, 0.22); wash(160, 0.5, 0.35); wash(900, 0.4, 0.03); }               // Hafen: tiefes Grollen, Wasser, ferne Maschinen
  else if (kind === 'neon') { drone(55, 'sawtooth', 200, 0.22); drone(110.5, 'sawtooth', 260, 0.1); wash(500, 0.5, 0.22); wash(1800, 0.5, 0.05); }       // Neonmeile: Verkehr, Menschen, mehr Mitten
  else { drone(55, 'sine', 90, 0.14); wash(300, 0.5, 0.12); }                                                                                              // Krone: leise, gedämpft
}
function neonBuzz(m) {
  const L = 3.4, dest = m.bus(0, 1, 0, 0);
  for (const [f, v] of [[120, 0.3], [240.4, 0.14], [360.9, 0.05]]) { const o = m.osc('sawtooth', 0, L), lp = m.filt('lowpass', 900), g = m.gain(v); o.frequency.value = f; o.connect(lp); lp.connect(g); g.connect(dest); }
  m.clicks(0, L, 9, 1500, 5000, 0.06, dest);
}
function hornFar(m) {
  const dest = m.bus(0, 1, 0.5, 1500), f = m.pick([[350, 440], [392, 494]]);
  for (const hz of f) { const o = m.osc('square', 0.02, 0.6), lp = m.filt('lowpass', 1100), e = m.env([[0.02, 0], [0.06, 0.3], [0.5, 0.25], [0.62, 0.0001]]); o.frequency.value = hz * m.r(0.99, 1.01); o.connect(lp); lp.connect(e); e.connect(dest); }
}
// Schritt: Untergrund bestimmt Filter und Anteile (Asphalt dumpf, Platte hart, Metall klingend, Pfütze nass)
function stepSnd(m, surf) {
  const dest = m.bus(0, 1, 0.04), v = m.r(0.85, 1.1);
  if (surf === 'asphalt' || surf === 'pfuetze') { m.thump(0, 130 * v, 70, 0.06, 0.55, dest); m.hit(0, 0.05, 'lowpass', 900 * v, 0.8, 0.7, dest); m.hit(0, 0.015, 'highpass', 3200, 0.7, 0.14, dest); }
  else if (surf === 'platte') { m.thump(0, 170 * v, 90, 0.04, 0.4, dest); m.hit(0, 0.04, 'lowpass', 1500 * v, 0.9, 0.6, dest); m.hit(0, 0.012, 'bandpass', 2400, 2, 0.35, dest); }
  else if (surf === 'metall') { m.thump(0, 150, 80, 0.05, 0.4, dest); m.hit(0, 0.05, 'bandpass', 1800 * v, 3, 0.55, dest); const o = m.osc('sine', 0, 0.2), e = m.env([[0, 0], [0.003, 0.1], [0.2, 0.0001]]); o.frequency.value = 880 * v; o.connect(e); e.connect(dest); }
  else { m.thump(0, 120 * v, 65, 0.05, 0.45, dest); m.hit(0, 0.06, 'lowpass', 1100 * v, 0.8, 0.55, dest); }
  if (surf === 'pfuetze') { m.hit(0.01, 0.14, 'bandpass', 2500, 0.9, 0.45, dest, 1100); m.hit(0.03, 0.08, 'highpass', 4500, 0.7, 0.12, dest); }
}

// ---- Fahrzeuge (MS2): Crash nach Aufprallstärke, Glas, Türen, Boost, Spritzwasser, Feuer-Loop, Alarm, Reifenquietschen ----
function crashSnd(m, size) {
  const dest = m.bus(0, 1, 0.12 + 0.06 * size), s = size;
  m.thump(0, 120 / Math.sqrt(s + 0.3), 45, 0.12 + 0.1 * s, 0.9, dest);                                   // Wumms der Karosserie
  m.hit(0, 0.1 + 0.08 * s, 'bandpass', 800 + 200 * s, 1.1, 0.8, dest, 300);                              // Blech knautscht
  m.hit(0, 0.03, 'highpass', 3000, 0.7, 0.4, dest);
  m.clicks(0.01, 0.12 + 0.12 * s, Math.round(5 + 6 * s), 1200, 6500, 0.28, dest);                         // Splitter
  for (let i = 0; i < 2 + Math.round(s); i++) { const t = m.r(0.02, 0.08), f = m.r(500, 1400), o = m.osc('square', t, 0.25), lp = m.filt('bandpass', f * 2, 6), e = m.env([[t, 0], [t + 0.003, 0.12], [t + 0.22, 0.0001]]); o.frequency.value = f; o.connect(lp); lp.connect(e); e.connect(dest); }   // Metall klingt nach
  if (s > 1.2) { m.thump(0.04, 70, 30, 0.35, 0.7, dest); m.hit(0.05, 0.4, 'lowpass', 600, 0.8, 0.5, dest, 150); }
}
function glassSnd(m) { const dest = m.bus(0, 1, 0.25); m.hit(0, 0.05, 'highpass', 3500, 0.7, 0.5, dest); m.clicks(0, 0.45, 38, 2800, 9500, 0.3, dest); m.clicks(0.1, 0.6, 14, 1800, 4500, 0.15, dest); }
function doorSnd(m, open) { const dest = m.bus(0, 1, 0.08); m.thump(0, open ? 170 : 130, 80, 0.07, 0.6, dest); m.hit(0, 0.03, 'highpass', 2500, 0.7, 0.3, dest); m.hit(open ? 0.0 : 0.005, 0.07, 'bandpass', 900, 1, 0.5, dest); if (open) m.hit(0.09, 0.12, 'bandpass', 1800, 2, 0.12, dest, 3000); }
function boostSnd(m) {
  const dest = m.bus(0, 1, 0.15); m.hit(0, 0.9, 'bandpass', 500, 1.3, 0.9, dest, 3200);
  const o = m.osc('sawtooth', 0, 0.9), lp = m.filt('lowpass', 1500), e = m.env([[0, 0], [0.12, 0.28], [0.9, 0.0001]]); o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(520, 0.8); o.connect(lp); lp.connect(e); e.connect(dest);
  m.thump(0, 90, 40, 0.18, 0.5, dest);
}
function splashSnd(m) { const dest = m.bus(0, 1, 0.1); m.hit(0, 0.22, 'bandpass', 2300, 0.9, 0.6, dest, 900); m.hit(0.02, 0.12, 'highpass', 4500, 0.7, 0.2, dest); m.clicks(0, 0.2, 10, 3000, 8000, 0.1, dest); }
function fireLoop(m) {
  const L = 5.6, dest = m.bus(0, 1, 0, 0);
  { const n = m.noise(0, L), lp = m.filt('lowpass', 420), g = m.gain(0.55); n.connect(lp); lp.connect(g); g.connect(dest); }                        // Fauchen
  { const n = m.noise(0, L), bp = m.filt('bandpass', 1400, 0.7), g = m.gain(0.12); n.connect(bp); bp.connect(g); g.connect(dest); }
  m.clicks(0, L, 150, 800, 4200, 0.2, dest);                                                                                                     // Knistern
}
function alarmSnd(m) {
  const dest = m.bus(0, 1, 0.3);
  for (let i = 0; i < 8; i++) { const t = i * 0.28, f = i % 2 ? 1250 : 850, o = m.osc('square', t, 0.24), lp = m.filt('lowpass', 2200), e = m.env([[t, 0], [t + 0.01, 0.22], [t + 0.2, 0.2], [t + 0.24, 0.0001]]); o.frequency.value = f; o.connect(lp); lp.connect(e); e.connect(dest); }
}
function skidLoop(m) {
  const L = 3.8, dest = m.bus(0, 1, 0, 0);
  for (const [f, q, v] of [[1900, 4, 0.5], [2700, 6, 0.3], [1250, 3, 0.25]]) { const n = m.noise(0, L), bp = m.filt('bandpass', f, q), g = m.gain(v); n.connect(bp); bp.connect(g); g.connect(dest); }
  const o = m.osc('sawtooth', 0, L), bp = m.filt('bandpass', 1500, 8), g = m.gain(0.08); o.frequency.value = 520; o.connect(bp); bp.connect(g); g.connect(dest);
}

// ------------------------------------------------------------------
// Klangbank-Definitionen: id -> { len (s), variants, cat (Stimmen-Limit), bus, gain, first (zuerst backen), fn(m, variantIndex) }
// "first" = was das Spiel sofort braucht (Explosion + Schreie); der Rest wird im Hintergrund nachgebacken.
// ------------------------------------------------------------------
const SOUND_DEFS = {
  explosion_s: { len: 1.8, variants: 2, cat: 'explosion', bus: 'sfx', first: true, fn: (m, v) => explosionSnd(m, 0.6 + v * 0.2) },
  explosion_m: { len: 2.6, variants: 2, cat: 'explosion', bus: 'sfx', first: true, fn: (m, v) => explosionSnd(m, 1.4 + v * 0.3) },
  explosion_l: { len: 3.6, variants: 2, cat: 'explosion', bus: 'sfx', first: true, fn: (m, v) => explosionSnd(m, 2.8 + v * 0.6) },
  scream_mann: { len: 1.7, variants: 3, cat: 'schrei', bus: 'stimmen', first: true, fn: m => scream(m, 0.05, 'mann') },
  scream_frau: { len: 1.7, variants: 3, cat: 'schrei', bus: 'stimmen', first: true, fn: m => scream(m, 0.05, 'frau') },
  scream_alt:  { len: 1.7, variants: 2, cat: 'schrei', bus: 'stimmen', first: true, fn: m => scream(m, 0.05, 'alt') },
  scream_jung: { len: 1.7, variants: 2, cat: 'schrei', bus: 'stimmen', first: true, fn: m => scream(m, 0.05, 'jung') },
  rain_loop:  { len: 7.6, variants: 1, loop: true, bus: 'ambience', cat: 'ambience', noiseLen: 9, fn: rainLoop },
  hum_docks:  { len: 7.6, variants: 1, loop: true, peak: 0.5, bus: 'ambience', cat: 'ambience', noiseLen: 9, fn: m => humLoop(m, 'docks') },
  hum_neon:   { len: 7.6, variants: 1, loop: true, peak: 0.38, bus: 'ambience', cat: 'ambience', noiseLen: 9, fn: m => humLoop(m, 'neon') },
  hum_krone:  { len: 7.6, variants: 1, loop: true, peak: 0.16, bus: 'ambience', cat: 'ambience', noiseLen: 9, fn: m => humLoop(m, 'krone') },
  neon_buzz:  { len: 4.4, variants: 1, loop: true, peak: 0.5, bus: 'ambience', cat: 'ambience', noiseLen: 6, fn: neonBuzz },
  horn_far:   { len: 1.8, variants: 3, bus: 'ambience', cat: 'sfx', noiseLen: 3, fn: hornFar },
  crash_s: { len: 1.0, variants: 2, cat: 'crash', bus: 'sfx', noiseLen: 3, fn: m => crashSnd(m, 0.5) },
  crash_m: { len: 1.6, variants: 2, cat: 'crash', bus: 'sfx', noiseLen: 3, fn: m => crashSnd(m, 1.0) },
  crash_l: { len: 2.4, variants: 2, cat: 'crash', bus: 'sfx', noiseLen: 4, fn: m => crashSnd(m, 1.9) },
  glas:    { len: 1.1, variants: 2, cat: 'crash', bus: 'sfx', noiseLen: 3, fn: glassSnd },
  tuer_auf: { len: 0.5, variants: 2, cat: 'sfx', bus: 'sfx', noiseLen: 2, fn: m => doorSnd(m, true) },
  tuer_zu:  { len: 0.4, variants: 2, cat: 'sfx', bus: 'sfx', noiseLen: 2, fn: m => doorSnd(m, false) },
  boost:   { len: 1.4, variants: 2, cat: 'sfx', bus: 'sfx', noiseLen: 3, fn: boostSnd },
  spritzer: { len: 0.6, variants: 3, cat: 'sfx', bus: 'sfx', noiseLen: 2, gain: 0.7, fn: splashSnd },
  alarm:   { len: 2.4, variants: 1, cat: 'sfx', bus: 'ambience', noiseLen: 2, fn: alarmSnd },
  feuer_loop: { len: 6.6, variants: 1, loop: true, peak: 0.5, bus: 'ambience', cat: 'ambience', noiseLen: 8, fn: fireLoop },
  skid_loop:  { len: 4.8, variants: 1, loop: true, peak: 0.45, bus: 'sfx', cat: 'ambience', noiseLen: 6, fn: skidLoop },
  schritt_asphalt: { len: 0.3, variants: 3, bus: 'sfx', cat: 'schritt', noiseLen: 2, gain: 0.5, fn: m => stepSnd(m, 'asphalt') },
  schritt_platte:  { len: 0.3, variants: 3, bus: 'sfx', cat: 'schritt', noiseLen: 2, gain: 0.5, fn: m => stepSnd(m, 'platte') },
  schritt_beton:   { len: 0.3, variants: 3, bus: 'sfx', cat: 'schritt', noiseLen: 2, gain: 0.5, fn: m => stepSnd(m, 'beton') },
  schritt_metall:  { len: 0.45, variants: 3, bus: 'sfx', cat: 'schritt', noiseLen: 2, gain: 0.5, fn: m => stepSnd(m, 'metall') },
  schritt_pfuetze: { len: 0.4, variants: 3, bus: 'sfx', cat: 'schritt', noiseLen: 2, gain: 0.55, fn: m => stepSnd(m, 'pfuetze') },
  ueberfahren_toedlich: { len: 4.4, variants: 2, cat: 'schrei', bus: 'sfx', fn: (m, v) => runOver(m, true, v % 2 ? 'frau' : 'mann') },
  ueberfahren_verletzt: { len: 5.4, variants: 2, cat: 'schrei', bus: 'sfx', fn: (m, v) => runOver(m, false, v % 2 ? 'mann' : 'frau') },
  panik_menge:   { len: 4.8, variants: 1, cat: 'schrei', bus: 'stimmen', fn: panic },
  vollstreckung: { len: 4.0, variants: 1, cat: 'sfx', bus: 'sfx', fn: execution },
  mandat_anruf:  { len: 3.8, variants: 1, cat: 'sfx', bus: 'stimmen', fn: mandatCall }
};
