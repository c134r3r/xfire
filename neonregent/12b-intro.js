"use strict";
// 12b-intro.js - Vorspann (~15 s) vor dem Spielstart: Setting und Geschichte in fünf Bildern, überspringbar (Leertaste, Enter, Esc, Klick, Tippen).
// Enthüllt nichts von der Wendung. Texte: STR.intro (13-story.js). Exportiert: Intro
const Intro = {
  on: false, t: 0, cb: null, raf: 0, last: 0, cv: null, g: null, sky: null, rain: [],
  play(cb) {
    if (this.on) return; this.on = true; this.cb = cb; this.t = 0; this.last = performance.now();
    const el = document.getElementById('intro'), cv = document.getElementById('introCanvas'); el.classList.add('on'); this.cv = cv; this.g = cv.getContext('2d');
    cv.width = 640; cv.height = 360; this.rain = []; for (let i = 0; i < 140; i++) this.rain.push({ x: Math.random() * 640, y: Math.random() * 360, v: 5 + Math.random() * 5 });
    const rng = mulberry(7741); this.sky = []; for (let i = 0; i < 26; i++) { const w = 18 + rng() * 34, h = 60 + rng() * 170; this.sky.push({ x: i * 26 - 10, w, h, win: Array.from({ length: 28 }, () => rng()) }); }
    try { Aud.init(); } catch (e) {}
    this.key = e => { if (['Space', 'Enter', 'Escape', 'KeyE'].includes(e.code)) { e.preventDefault(); this.end(); } };
    this.click = () => this.end(); addEventListener('keydown', this.key, true); el.addEventListener('pointerdown', this.click);
    this.score(); this.loop();
  },
  end() { if (!this.on) return; this.on = false; this.scoreStop(); cancelAnimationFrame(this.raf); removeEventListener('keydown', this.key, true); const el = document.getElementById('intro'); el.removeEventListener('pointerdown', this.click); el.classList.remove('on'); const cb = this.cb; this.cb = null; if (cb) cb(); },
  // Partitur ohne Schlagwerk (15,5 s): Feuer-Rauschen und Drohne in A, Moll-Pad, dissonante Sekunde (B) beim Auge, schneller werdendes Tremolo mit steigendem Glissando,
  // am Ende leere Quinte A-E-A als breite Fläche, die ausklingt. Läuft über den Musikkanal; die Spielmusik ist währenddessen stumm.
  score() {
    const ac = Aud.ac; if (!ac || !Aud.bus.musik) return; const t0 = ac.currentTime + 0.05, T = 15.5, nodes = [], mus = Aud.bus.musik;
    mus.gain.cancelScheduledValues(t0); mus.gain.setValueAtTime(0, t0);
    const out = ac.createGain(); out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(1, t0 + 1.2); out.gain.setValueAtTime(1, t0 + T - 1.6); out.gain.exponentialRampToValueAtTime(0.0001, t0 + T + 0.4);
    const dl = ac.createDelay(1); dl.delayTime.value = 0.43; const fb = ac.createGain(); fb.gain.value = 0.45; const wet = ac.createGain(); wet.gain.value = 0.4; const lpd = ac.createBiquadFilter(); lpd.type = 'lowpass'; lpd.frequency.value = 1800;
    out.connect(dl); dl.connect(lpd); lpd.connect(fb); fb.connect(dl); lpd.connect(wet); const master = ac.createGain(); master.gain.value = 0.85 * (Settings.d.vol.musik === undefined ? 0.7 : Settings.d.vol.musik); out.connect(master); wet.connect(master); master.connect(ac.destination);
    nodes.push(out, master);
    const env = (g, pts) => { g.gain.setValueAtTime(0.0001, t0); for (const [t, v] of pts) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t0 + t); };
    const osc = (type, f, a, b, pts, lp, q = 1, detune = 0) => {                  // Oszillator mit Filter und Hüllkurve; f kann (von,bis) sein
      const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter(); o.type = type; o.detune.value = detune; fl.type = 'lowpass'; fl.Q.value = q;
      if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t0 + a); o.frequency.exponentialRampToValueAtTime(f[1], t0 + b); } else o.frequency.value = f;
      if (Array.isArray(lp)) { fl.frequency.setValueAtTime(lp[0], t0 + a); fl.frequency.exponentialRampToValueAtTime(lp[1], t0 + b); } else fl.frequency.value = lp;
      env(g, pts); o.connect(fl); fl.connect(g); g.connect(out); o.start(t0 + a); o.stop(t0 + b + 0.1); nodes.push(o); return g;
    };
    // 1 Feuertag (0-3.1): Rumpeln aus Rauschen + tiefe Drohne
    { const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let y = 0; for (let i = 0; i < len; i++) { y = y * 0.985 + (Math.random() * 2 - 1) * 0.06; d[i] = y; }
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t0); fl.frequency.exponentialRampToValueAtTime(120, t0 + 3.4); const g = ac.createGain(); env(g, [[0.05, 2.2], [3.2, 0.4], [6, 0.12], [T - 2, 0.1], [T, 0.0001]]); s.connect(fl); fl.connect(g); g.connect(out); s.start(t0); s.stop(t0 + T); nodes.push(s); }
    osc('sawtooth', 55, 0, T, [[0.3, 0.12], [3, 0.16], [10, 0.22], [T - 1.4, 0.28], [T, 0.0001]], [140, 1500], 2);
    osc('sawtooth', 55, 0, T, [[0.3, 0.1], [T - 1.4, 0.2], [T, 0.0001]], [140, 1200], 2, 9);
    osc('sine', 27.5, 0, T, [[0.5, 0.35], [T - 1, 0.4], [T, 0.0001]], 200);
    // 2 41 Jahre später (3.1-6.2): Moll-Pad A-C-E
    for (const [f, v] of [[110, 0.07], [130.8, 0.06], [164.8, 0.06], [220, 0.04]]) osc('triangle', f, 3.1, T, [[3.1, 0.0001], [5.5, v], [T - 1.4, v * 1.3], [T, 0.0001]], [300, 2600], 1, (f % 7) - 3);
    // 3 Auge (6.2-9.3): dissonante kleine Sekunde A-B♭, hohes Glissando
    osc('sawtooth', 116.5, 6.2, T, [[6.2, 0.0001], [8.2, 0.07], [T - 1.4, 0.1], [T, 0.0001]], [400, 3000], 3);
    osc('sine', [880, 1760], 6.4, 11, [[6.4, 0.0001], [8.5, 0.05], [11, 0.0001]], 6000);
    osc('sine', [932, 1865], 6.9, 11.5, [[6.9, 0.0001], [9, 0.04], [11.5, 0.0001]], 6000);
    // 4 Treuechip (9.3-12.4): Tremolo wird schneller (Streicher-Ostinato ohne Anschlag), Riser
    { const g = osc('sawtooth', [110, 330], 9.3, 13.2, [[9.3, 0.0001], [10.5, 0.07], [13, 0.1], [13.2, 0.0001]], [500, 5200], 4), lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.setValueAtTime(3, t0 + 9.3); lfo.frequency.exponentialRampToValueAtTime(18, t0 + 13.2); lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start(t0 + 9.3); lfo.stop(t0 + 13.3); nodes.push(lfo); }
    osc('sawtooth', [220, 1760], 10, 14.4, [[10, 0.0001], [13, 0.05], [14.4, 0.0001]], [800, 7000], 5);
    // 5 Nummer 7741 (12.4-15.5): offene Quinte A-E-A, breite Fläche
    for (const [f, v] of [[110, 0.12], [164.8, 0.1], [220, 0.1], [329.6, 0.06]]) { osc('sawtooth', f, 13.4, T + 0.3, [[13.4, 0.0001], [14.3, v], [T - 1.1, v], [T + 0.3, 0.0001]], [900, 2400], 1, -6); osc('sawtooth', f, 13.4, T + 0.3, [[13.4, 0.0001], [14.3, v], [T - 1.1, v], [T + 0.3, 0.0001]], [900, 2400], 1, 6); }
    this._sc = { nodes, out, t0 };
  },
  scoreStop() {
    const S = this._sc; this._sc = null; if (!S || !Aud.ac) { if (Aud.ac && Aud.bus.musik) Aud.setVol('musik', Settings.d.vol.musik); return; }
    const t = Aud.ac.currentTime; try { S.out.gain.cancelScheduledValues(t); S.out.gain.setValueAtTime(Math.max(0.0001, S.out.gain.value), t); S.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); } catch (e) {}
    setTimeout(() => { for (const n of S.nodes) { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} } }, 600);
    if (Aud.bus.musik) { Aud.bus.musik.gain.cancelScheduledValues(t); Aud.bus.musik.gain.setValueAtTime(0, t); Aud.bus.musik.gain.setTargetAtTime(Settings.d.vol.musik, t + 0.5, 1.2); }   // Spielmusik blendet danach langsam ein
  },
  loop() {
    if (!this.on) return; const n = performance.now(); this.t += Math.min(0.1, (n - this.last) / 1000); this.last = n; this.draw();
    if (this.t >= 15.5) { this.end(); return; } this.raf = requestAnimationFrame(() => this.loop());
  },
  draw() {
    const g = this.g, t = this.t, B = STR.intro.beats, bi = Math.min(B.length - 1, Math.floor(t / 3.1)), bt = t - bi * 3.1, W = 640, H = 360;
    const tint = [['#2a0c04', '#ff7a2a'], ['#05070f', '#3fe8ff'], ['#0a0410', '#ff3fa4'], ['#04070e', '#3fe8ff'], ['#05070f', '#ffd84a']][bi];
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, tint[0]); gr.addColorStop(1, '#010206'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (bi === 0) { const f = Math.max(0, 1 - bt / 0.9); g.fillStyle = `rgba(255,220,160,${f})`; g.fillRect(0, 0, W, H); const r = 20 + bt * 90; const rg = g.createRadialGradient(W / 2, H * 0.68, 0, W / 2, H * 0.68, r); rg.addColorStop(0, 'rgba(255,200,120,0.55)'); rg.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
    // Skyline mit Fenstern (aus dem Feuer wird Stadt)
    const rise = bi === 0 ? Math.min(1, bt / 3.1) * 0.35 : bi === 1 ? 0.35 + bt / 3.1 * 0.65 : 1;
    for (const b of this.sky) { const h = b.h * rise, y = H - h - 30; g.fillStyle = '#06080f'; g.fillRect(b.x, y, b.w, h + 30);
      if (rise > 0.5) for (let k = 0; k < b.win.length; k++) { const wx = b.x + 4 + (k % 4) * (b.w - 8) / 4, wy = y + 6 + Math.floor(k / 4) * 18; if (wy < H - 40 && b.win[k] > 0.6) { g.fillStyle = b.win[k] > 0.9 ? '#ff3fa4' : b.win[k] > 0.8 ? '#3fe8ff' : '#ffd27a'; g.globalAlpha = 0.35 + 0.4 * Math.sin(t * 2 + k); g.fillRect(wx, wy, 3, 5); g.globalAlpha = 1; } } }
    g.fillStyle = 'rgba(10,14,24,0.9)'; g.fillRect(0, H - 30, W, 30);
    // Bildmotive je Beat
    if (bi === 2) { const a = Math.min(1, bt / 0.8); g.save(); g.translate(W / 2, 120); g.globalAlpha = a; g.strokeStyle = '#ff3fa4'; g.lineWidth = 3; g.fillStyle = '#12020c'; g.beginPath(); g.moveTo(-70, 0); g.quadraticCurveTo(0, -60, 70, 0); g.quadraticCurveTo(0, 60, -70, 0); g.fill(); g.stroke(); g.fillStyle = '#ff3fa4'; g.beginPath(); g.arc(Math.sin(t * 1.3) * 12, 0, 22, 0, 6.3); g.fill(); g.fillStyle = '#12020c'; g.beginPath(); g.arc(Math.sin(t * 1.3) * 12, 0, 8, 0, 6.3); g.fill(); g.restore(); }
    if (bi === 3) { g.strokeStyle = '#3fe8ff'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < W; x += 4) { const p = (x / 640 * 6 - t * 2) % 1, y = 150 + (p > 0.1 && p < 0.16 ? -50 : p > 0.16 && p < 0.22 ? 40 : 0) + Math.sin(x * 0.05) * 2; if (!x) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); if (bt > 1.8) { g.fillStyle = `rgba(255,59,74,${0.3 + 0.3 * Math.sin(t * 14)})`; g.fillRect(0, 0, W, H); } }
    if (bi === 4) { g.fillStyle = '#ffd84a'; g.globalAlpha = Math.min(1, bt / 0.6); g.font = 'bold 66px Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText('7741', W / 2, 140); g.globalAlpha = 1; }
    // Regen
    g.strokeStyle = 'rgba(160,200,255,0.35)'; g.lineWidth = 1; for (const d of this.rain) { d.y += d.v; d.x -= 1.2; if (d.y > H) { d.y = -10; d.x = Math.random() * W + 40; } g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + 1.5, d.y - 9); g.stroke(); }
    // Text
    const line = B[bi], k = Math.min(1, bt / 0.5) * (bt > 2.8 ? Math.max(0, (3.1 - bt) / 0.3) : 1);
    g.globalAlpha = k; g.textAlign = 'center'; g.fillStyle = tint[1]; g.font = 'bold 20px Arial Black, sans-serif'; g.fillText(line[0], W / 2, 262);
    g.fillStyle = '#e8eefc'; g.font = '15px Segoe UI, sans-serif'; line.slice(1).forEach((s, i) => g.fillText(s, W / 2, 292 + i * 20)); g.globalAlpha = 1;
    const sk = document.getElementById('introSkip'); if (sk) sk.style.opacity = t > 0.8 ? 1 : 0;
    // Aus-/Einblenden
    const fade = t < 0.4 ? 1 - t / 0.4 : t > 15 ? (t - 15) / 0.5 : 0; if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  }
};
