'use strict';
// 02c-music.js - Dystopische 80er-Synthmusik: 5 Tracks à 32 Takte, live synthetisiert (Step-Sequencer mit Vorlauf, wie Ironclad-Music, nur
// größer). Jeder Track ist DATEN (Tempo, Tonart, Akkordfolge, Muster, Abschnitte) -> buildTrack() erzeugt daraus die Noten, deterministisch.
// Playlist: gemischt, nie derselbe Track direkt hintereinander; U = nächster Track. Offline-Render für Tests: Music.renderOffline().
// Klangbausteine: Bass (Saw+Square-Sub, Filterhüllkurve), Pad (3 verstimmte Saws, langsamer Einsatz), Arpeggio (Puls+Saw, Delay),
// Messing-Stab (verstimmte Saws mit Filter-Sweep, wie Vangelis/Carpenter), Lead (Vibrato), Drums (Kick, Gated-Reverb-Snare, Hats, Toms,
// Industrie-Klang), Vocoder-Stab (MANDAT-Track, Formantfilter).
// Exportiert: Music, MUS_TRACKS, buildTrack

const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10] };
// Abschnitte à 8 Takte: A Einstieg, B Aufbau, C Volllast, D Abbau. layers: pad bass kick snare hat tom arp stab lead clang voc
const SEC = (a) => a.split(' ').reduce((o, k) => (o[k] = 1, o), {});
const MUS_TRACKS = [
  { id: 'neonregen', name: 'NEONREGEN', bpm: 96, root: 45, mode: 'minor', seed: 11,
    prog: [1, 1, 6, 6, 3, 3, 7, 5], bass: 'x-xxx-xxx-xxx-xx', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 'xxxxxxxxxxxxxxxx', arpDir: 'updown',
    stab: '....x.......x...', lead: [0, 3, 6, 10, 12], wave: 'sawtooth',
    sections: [SEC('pad bass kick'), SEC('pad bass kick snare hat arp'), SEC('pad bass kick snare hat arp stab lead'), SEC('pad arp lead')] },
  { id: 'treuechip', name: 'TREUECHIP', bpm: 82, root: 38, mode: 'phrygian', seed: 23,
    prog: [1, 1, 2, 1, 1, 1, 2, 7], bass: 'x.......x.x.....', kick: 'x......x..x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', arp: 'x.x.x.x.x.x.x.x.', arpDir: 'up',
    stab: 'x...............', lead: [0, 4, 8], wave: 'square',
    sections: [SEC('pad bass'), SEC('pad bass kick hat arp'), SEC('pad bass kick snare hat arp stab lead clang'), SEC('pad bass lead')], clang: '................' },
  { id: 'halogen', name: 'HALOGEN', bpm: 108, root: 40, mode: 'minor', seed: 37,
    prog: [1, 6, 3, 7, 1, 6, 7, 5], bass: 'x.x.xx.xx.x.xx.x', kick: 'x..x..x...x.x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', arp: 'xxxxxxxxxxxxxxxx', arpDir: 'seq',
    stab: 'x.....x.........', lead: [0, 2, 4, 8, 11], wave: 'square',
    sections: [SEC('pad bass arp'), SEC('pad bass kick hat arp snare'), SEC('pad bass kick snare hat tom arp stab lead'), SEC('pad arp lead')] },
  { id: 'feuertag', name: 'FEUERTAG', bpm: 70, root: 37, mode: 'minor', seed: 53,
    prog: [1, 1, 1, 1, 6, 6, 5, 5], bass: 'x.......x.......', kick: 'x..x..x...x.x...', snare: '........x.......', hat: '................', arp: 'x...x...x...x...', arpDir: 'up',
    stab: 'x.......x.......', lead: [0, 6], wave: 'sawtooth',
    sections: [SEC('pad bass clang'), SEC('pad bass kick clang tom'), SEC('pad bass kick snare tom stab lead clang arp'), SEC('pad bass clang lead')], clang: 'x.......x...x...' },
  { id: 'mandat', name: 'MANDAT', bpm: 100, root: 42, mode: 'harm', seed: 71,
    prog: [1, 1, 4, 4, 5, 5, 1, 6], bass: 'xxx.xxx.xx.xxx.x', kick: 'x..x....x..x....', snare: '....x.......x...', hat: '..x...x...x...x.', arp: 'x.x.xx.xx.x.xx.x', arpDir: 'updown',
    stab: 'x..x..x.x...x...', lead: [0, 2, 3, 7, 10], wave: 'sawtooth',
    sections: [SEC('pad bass voc'), SEC('pad bass kick hat voc arp'), SEC('pad bass kick snare hat arp voc lead stab'), SEC('pad voc lead')] }
];

// ---- Noten erzeugen: 32 Takte à 16 Schritte. Ereignis { s: Schritt, k: Instrument, n: [Midi…], d: Dauer (Schritte), v: Lautstärke } ----
function buildTrack(def) {
  const rnd = rng(def.seed), sc = MODES[def.mode], ev = [], BARS = 32;
  const deg = (d, oct = 0) => def.root + sc[((d - 1) % 7 + 7) % 7] + 12 * (Math.floor((d - 1) / 7) + oct);
  const chordOf = cd => [deg(cd), deg(cd + 2), deg(cd + 4), deg(cd + 6)];
  const hit = (pat, i) => pat && pat[i] && pat[i] !== '.' && pat[i] !== '-';
  const phrase = [];                                                           // Lead-Phrasen: alle 8 Takte dieselben (wiederholbar, einprägsam)
  for (let b = 0; b < 8; b++) { const notes = []; for (let j = 0; j < def.lead.length; j++) { const prev = notes.length ? notes[notes.length - 1].d : 5 + Math.floor(rnd() * 3), d = clamp(prev + Math.floor(rnd() * 5) - 2, 1, 12); notes.push({ i: def.lead[j], d }); } phrase.push(notes); }
  for (let b = 0; b < BARS; b++) {
    const L = def.sections[Math.floor(b / 8)], cd = def.prog[b % 8], ch = chordOf(cd), s0 = b * 16, fill = b % 8 === 7;
    if (L.pad && b % 2 === 0) ev.push({ s: s0, k: 'pad', n: ch.map(n => n + 12), d: 32, v: 0.9 });
    for (let i = 0; i < 16; i++) {
      const s = s0 + i;
      if (L.bass && hit(def.bass, i)) ev.push({ s, k: 'bass', n: [deg(cd, -1) + (def.bass[i] === 'X' ? 12 : 0)], d: def.bass.includes('xx') ? 1.6 : 3, v: i % 4 === 0 ? 1 : 0.8 });
      if (L.kick && hit(def.kick, i)) ev.push({ s, k: 'kick', v: 1 });
      if (L.snare && hit(def.snare, i)) ev.push({ s, k: 'snare', v: 1 });
      if (L.hat && hit(def.hat, i)) ev.push({ s, k: 'hat', v: i % 4 === 2 ? 0.8 : 0.5, open: i % 8 === 6 });
      if (L.clang && hit(def.clang, i)) ev.push({ s, k: 'clang', v: 0.8 });
      if (L.arp && hit(def.arp, i)) {
        const idx = def.arpDir === 'up' ? i % 4 : def.arpDir === 'seq' ? [0, 1, 2, 1, 0, 2, 1, 3][i % 8] : [0, 1, 2, 3, 2, 1, 2, 1][i % 8];
        ev.push({ s, k: 'arp', n: [ch[idx] + 12 + (b % 4 === 3 ? 12 : 0)], d: 1, v: 0.55 });
      }
      if (L.stab && hit(def.stab, i)) ev.push({ s, k: 'stab', n: ch.slice(0, 3).map(n => n + 12), d: 3, v: 0.7 });
      if (L.voc && hit(def.stab, i) && b % 2 === 1) ev.push({ s, k: 'voc', n: ch.slice(0, 3).map(n => n + 12), d: 4, v: 0.55 });
    }
    if (L.tom && fill) for (let i = 0; i < 4; i++) ev.push({ s: s0 + 12 + i, k: 'tom', n: [[150, 120, 95, 75][i]], v: 0.9 });
    if (L.lead) for (const nt of phrase[b % 8]) ev.push({ s: s0 + nt.i, k: 'lead', n: [deg(nt.d, 1)], d: 5, v: 0.6 });
  }
  return { ev: ev.sort((a, b) => a.s - b.s), bars: BARS, steps: BARS * 16, def };
}

// ---- Klangerzeugung (BaseAudioContext: live oder offline) ----
function musicRig(ac, outNode) {
  let out = outNode;
  const mix = ac.createGain(); mix.gain.value = 0.4; mix.connect(outNode);        // Gesamtpegel: Tracks sind dicht gestaffelt, sonst übersteuert der Kompressor
  out = mix; const rig = { ac, out, dry: ac.createGain(), rev: ac.createGain(), del: ac.createGain() };
  rig.dry.connect(out);
  const cv = ac.createConvolver(), n = Math.floor(ac.sampleRate * 2.4), b = ac.createBuffer(2, n, ac.sampleRate), r = rng(5);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / ac.sampleRate, k = Math.min(0.9, 0.35 + t); lp = lp * k + (r() * 2 - 1) * (1 - k); d[i] = lp * Math.exp(-5.2 * t) * 1.8; } }
  cv.buffer = b; rig.rev.connect(cv); cv.connect(out);
  const dl = ac.createDelay(2), fb = ac.createGain(), lp = ac.createBiquadFilter(); dl.delayTime.value = 0.5; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 2600;   // Delay (Zeit pro Track gesetzt)
  rig.del.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(out); rig.delay = dl;
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; rig.noise = nb;
  rig.shaper = ac.createWaveShaper(); const cur = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cur[i] = Math.tanh(x * 2.4); } rig.shaper.curve = cur; rig.shaper.connect(rig.dry);
  return rig;
}
const MS = {
  mid: n => 440 * Math.pow(2, (n - 69) / 12),
  env(rig, g, t, a, d, sus, r, peak) { const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d); p.exponentialRampToValueAtTime(0.0001, t + a + d + r); },
  osc(rig, type, f, t, dur) { const o = rig.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur); return o; },
  noise(rig, t, dur) { const s = rig.ac.createBufferSource(); s.buffer = rig.noise; s.start(t, Math.random(), dur); s.stop(t + dur); return s; },
  send(rig, node, rev, del) { if (rev) { const g = rig.ac.createGain(); g.gain.value = rev; node.connect(g); g.connect(rig.rev); } if (del) { const g = rig.ac.createGain(); g.gain.value = del; node.connect(g); g.connect(rig.del); } },
  // Instrumente: t = Startzeit, sd = Dauer eines Schritts in s
  kick(rig, t, v) { const o = this.osc(rig, 'sine', 160, t, 0.4), g = rig.ac.createGain(); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); this.env(rig, g, t, 0.002, 0.3, 0.01, 0.05, 0.95 * v); o.connect(g); g.connect(rig.dry);
    const n = this.noise(rig, t, 0.02), h = rig.ac.createBiquadFilter(), gn = rig.ac.createGain(); h.type = 'highpass'; h.frequency.value = 2500; this.env(rig, gn, t, 0.001, 0.015, 0.01, 0.01, 0.22 * v); n.connect(h); h.connect(gn); gn.connect(rig.dry); },
  snare(rig, t, v) { const n = this.noise(rig, t, 0.5), bp = rig.ac.createBiquadFilter(), g = rig.ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7; this.env(rig, g, t, 0.001, 0.12, 0.05, 0.12, 0.7 * v); n.connect(bp); bp.connect(g); g.connect(rig.dry); this.send(rig, g, 0.9, 0);   // Gated-Reverb-Hall
    const o = this.osc(rig, 'triangle', 200, t, 0.2), go = rig.ac.createGain(); o.frequency.exponentialRampToValueAtTime(120, t + 0.12); this.env(rig, go, t, 0.001, 0.1, 0.02, 0.05, 0.5 * v); o.connect(go); go.connect(rig.dry); },
  hat(rig, t, v, open) { const n = this.noise(rig, t, 0.3), h = rig.ac.createBiquadFilter(), g = rig.ac.createGain(); h.type = 'highpass'; h.frequency.value = 7200; this.env(rig, g, t, 0.001, open ? 0.12 : 0.025, 0.02, open ? 0.08 : 0.02, 0.3 * v); n.connect(h); h.connect(g); g.connect(rig.dry); },
  tom(rig, t, v, f) { const o = this.osc(rig, 'sine', f * 1.6, t, 0.5), g = rig.ac.createGain(); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.25); this.env(rig, g, t, 0.003, 0.25, 0.02, 0.1, 0.8 * v); o.connect(g); g.connect(rig.dry); this.send(rig, g, 0.4, 0); },
  clang(rig, t, v) { const g = rig.ac.createGain(); this.env(rig, g, t, 0.001, 1.0, 0.02, 0.6, 0.35 * v); for (const f of [212, 349, 521, 887]) { const o = this.osc(rig, 'square', f * (1 + Math.random() * 0.01), t, 2); const bp = rig.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 5; o.connect(bp); bp.connect(g); }
    const n = this.noise(rig, t, 0.1), h = rig.ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 3000; n.connect(h); h.connect(g); g.connect(rig.dry); this.send(rig, g, 0.8, 0); },
  bass(rig, t, f, dur, v, wave) {
    const o = this.osc(rig, 'sawtooth', f, t, dur + 0.3), s = this.osc(rig, 'square', f / 2, t, dur + 0.3), lp = rig.ac.createBiquadFilter(), g = rig.ac.createGain(), gs = rig.ac.createGain();
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(160, t + dur * 0.9); gs.gain.value = 0.7; this.env(rig, g, t, 0.004, dur * 0.8, 0.4, 0.08, 0.5 * v);
    o.connect(lp); s.connect(gs); gs.connect(lp); lp.connect(g); g.connect(rig.shaper);
  },
  pad(rig, t, notes, dur, v) {
    const g = rig.ac.createGain(), lp = rig.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.6); lp.frequency.linearRampToValueAtTime(500, t + dur);
    this.env(rig, g, t, dur * 0.28, dur * 0.4, 0.8, dur * 0.35, 0.16 * v);
    for (const n of notes) for (const det of [-9, 0, 9]) { const o = this.osc(rig, 'sawtooth', this.mid(n), t, dur * 1.25); o.detune.value = det; o.connect(lp); }
    lp.connect(g); g.connect(rig.dry); this.send(rig, g, 0.45, 0);
  },
  arp(rig, t, n, sd, v, wave) {
    const o = this.osc(rig, wave === 'square' ? 'square' : 'sawtooth', this.mid(n), t, sd * 2), lp = rig.ac.createBiquadFilter(), g = rig.ac.createGain(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(500, t + sd * 1.6);
    this.env(rig, g, t, 0.002, sd * 1.2, 0.1, 0.03, 0.17 * v); o.connect(lp); lp.connect(g); g.connect(rig.dry); this.send(rig, g, 0.12, 0.35);
  },
  stab(rig, t, notes, dur, v) {                                                // Messing-Stab: verstimmte Saws, Filter öffnet und schließt
    const g = rig.ac.createGain(), lp = rig.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.06); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    this.env(rig, g, t, 0.01, dur * 0.5, 0.2, 0.15, 0.17 * v);
    for (const n of notes) for (const det of [-12, 12]) { const o = this.osc(rig, 'sawtooth', this.mid(n), t, dur + 0.3); o.detune.value = det; o.connect(lp); }
    lp.connect(g); g.connect(rig.dry); this.send(rig, g, 0.35, 0.2);
  },
  lead(rig, t, n, dur, v, wave) {
    const o = this.osc(rig, wave === 'square' ? 'square' : 'sawtooth', this.mid(n), t, dur + 0.5), lfo = this.osc(rig, 'sine', 5.4, t, dur + 0.5), lg = rig.ac.createGain(), lp = rig.ac.createBiquadFilter(), g = rig.ac.createGain();
    lg.gain.value = 7; lfo.connect(lg); lg.connect(o.detune); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 1.2;
    this.env(rig, g, t, 0.03, dur * 0.5, 0.5, 0.35, 0.13 * v); o.connect(lp); lp.connect(g); g.connect(rig.dry); this.send(rig, g, 0.3, 0.45);
  },
  voc(rig, t, notes, dur, v) {                                                 // Vocoder-Stab: Saw-Akkord durch wandernde Formantfilter ("MANDAT spricht")
    const g = rig.ac.createGain(); this.env(rig, g, t, 0.02, dur * 0.6, 0.3, 0.2, 0.2 * v);
    for (const [f0, f1, q] of [[700, 300, 8], [1200, 2300, 10], [2600, 3000, 12]]) { const bp = rig.ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + dur * 0.8); for (const n of notes) { const o = this.osc(rig, 'sawtooth', this.mid(n - 12), t, dur + 0.3); o.connect(bp); } bp.connect(g); }
    g.connect(rig.dry); this.send(rig, g, 0.4, 0.15);
  }
};
// Ein Ereignis spielen (Zeit t in s auf dem Kontext)
function musicPlay(rig, ev, t, sd, def) {
  const n = ev.n && ev.n[0], d = (ev.d || 1) * sd;
  switch (ev.k) {
    case 'kick': MS.kick(rig, t, ev.v); break; case 'snare': MS.snare(rig, t, ev.v); break; case 'hat': MS.hat(rig, t, ev.v, ev.open); break;
    case 'tom': MS.tom(rig, t, ev.v, ev.n[0]); break; case 'clang': MS.clang(rig, t, ev.v); break;
    case 'bass': MS.bass(rig, t, MS.mid(n), d, ev.v, def.wave); break; case 'pad': MS.pad(rig, t, ev.n, d, ev.v); break;
    case 'arp': MS.arp(rig, t, n, sd, ev.v, def.wave); break; case 'stab': MS.stab(rig, t, ev.n, d, ev.v); break;
    case 'lead': MS.lead(rig, t, n, d, ev.v, def.wave); break; case 'voc': MS.voc(rig, t, ev.n, d, ev.v); break;
  }
}

const Music = {
  on: false, rig: null, cache: [], cur: null, evi: 0, t0: 0, sd: 0, timer: null, last: -1, order: [], idx: -1, lastName: '',
  track(i) { return this.cache[i] || (this.cache[i] = buildTrack(MUS_TRACKS[i])); },
  // Live starten (nach Nutzer-Geste, wenn der Audio-Kontext läuft)
  start() {
    if (this.on || !Aud.ac || Aud.ac.state !== 'running' || !Aud.bus.musik) return;
    this.rig = musicRig(Aud.ac, Aud.bus.musik); this.on = true; this.next();
    this.timer = setInterval(() => this.tick(), 30);
  },
  // Nächster Track: gemischt, nie derselbe wie zuvor (auch nicht beim Mischen einer neuen Runde)
  next(force) {
    if (!this.order.length) { const o = MUS_TRACKS.map((_, i) => i); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } if (o[0] === this.last) o.push(o.shift()); this.order = o; }
    const i = this.order.shift(); this.last = i; this.cur = this.track(i); this.evi = 0;
    this.sd = 60 / this.cur.def.bpm / 4; this.t0 = Aud.ac.currentTime + (force ? 0.25 : 0.6);
    this.rig.delay.delayTime.setTargetAtTime(this.sd * 3, Aud.ac.currentTime, 0.05);              // punktierte Achtel
    this.lastName = this.cur.def.name; if (typeof HUD !== 'undefined') HUD.track(this.cur.def.name);
  },
  tick() {
    if (!this.on || !this.cur) return; const ac = Aud.ac; if (ac.state !== 'running') return;
    const now = ac.currentTime, T = this.cur;
    while (this.evi < T.ev.length) { const e = T.ev[this.evi], t = this.t0 + e.s * this.sd; if (t > now + 0.2) break; if (t >= now - 0.05) musicPlay(this.rig, e, Math.max(t, now), this.sd, T.def); this.evi++; }
    if (this.evi >= T.ev.length && now > this.t0 + T.steps * this.sd - 0.3) this.next();
  },
  skip() { if (this.on) this.next(true); },
  // Offline für Tests/WAV: Takte [bar0, bar0+bars) eines Tracks rendern
  async renderOffline(i, bar0 = 16, bars = 6) {
    const T = this.track(i), sd = 60 / T.def.bpm / 4, secs = bars * 16 * sd + 2.5, oc = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
    const out = oc.createGain(); out.gain.value = 0.9; out.connect(oc.destination); const rig = musicRig(oc, out); rig.delay.delayTime.value = sd * 3;
    for (const e of T.ev) { const rel = e.s - bar0 * 16; if (rel < -32 || rel >= bars * 16) continue; if (rel < 0 && !(e.k === 'pad' && rel + e.d > 0)) continue; musicPlay(rig, e, Math.max(0, rel * sd), sd, T.def); }
    const buf = await oc.startRendering(); let pk = 0, nan = false;
    for (let c = 0; c < 2; c++) { const x = buf.getChannelData(c); for (let k = 0; k < x.length; k++) { const a = Math.abs(x[k]); if (a !== a) nan = true; if (a > pk) pk = a; } }
    buf.rawPeak = pk; buf.hadNaN = nan; return buf;
  }
};
