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
    this.loop();
  },
  end() { if (!this.on) return; this.on = false; cancelAnimationFrame(this.raf); removeEventListener('keydown', this.key, true); const el = document.getElementById('intro'); el.removeEventListener('pointerdown', this.click); el.classList.remove('on'); const cb = this.cb; this.cb = null; if (cb) cb(); },
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
