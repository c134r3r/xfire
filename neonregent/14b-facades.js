'use strict';
// 14b-facades.js - Fassaden- und Dachtexturen (PLAN §5.5): pro Gebäude 4 Fassaden + 1 Dach, LAZY und deterministisch aus b.seed,
// LRU nach Pixelbudget (C.TEX_BUDGET). Nacht-Albedo, Seitenschattierung und statisches Emissive sind in EINE Textur eingebacken.
// Kein echter Text auf Fassaden (Orientierung wechselt je Seite): Pseudo-Glyphen; lesbarer Text nur auf Dächern.
// Portiert aus docs/neon-regent/concept.html (makeFacade/makeRoof). Exportiert: Tex

const Tex = {
  cache: new Map(), px: 0,
  SIDE_SHADE: { N: 0.30, S: 0.12, W: 0.22, E: 0.16 },
  _get(key, w, h, make) {
    let e = this.cache.get(key);
    if (e) { this.cache.delete(key); this.cache.set(key, e); return e.c; }       // LRU: zuletzt benutzt nach hinten
    const c = make(); this.px += w * h; this.cache.set(key, { c, n: w * h });
    while (this.px > C.TEX_BUDGET && this.cache.size > 1) { const k = this.cache.keys().next().value, o = this.cache.get(k); this.cache.delete(k); this.px -= o.n; }
    return c;
  },
  clear() { this.cache.clear(); this.px = 0; },                                  // z. B. beim Aktwechsel (Graffiti/Plakate, STORY.md §6)
  face(b, side) {
    const L = side === 'N' || side === 'S' ? b.x1 - b.x0 : b.y1 - b.y0, W = Math.max(8, Math.round(L)), H = Math.max(8, Math.round(b.h));
    return this._get(b.id + side, W, H, () => withSeed(hash3(b.seed, side.charCodeAt(0), 1), () => this.makeFacade(b, W, H, this.SIDE_SHADE[side])));
  },
  roof(b) {
    const w = Math.round(b.x1 - b.x0), h = Math.round(b.y1 - b.y0);
    return this._get(b.id + 'R', w, h, () => withSeed(hash3(b.seed, 82, 2), () => this.makeRoof(b, w, h)));
  },
  makeFacade(b, W, H, shadeK) {
    const S = FACADE_STYLES[b.style] || FACADE_STYLES.concrete, d = mkCanvas(W, H), e = mkCanvas(W, H), dg = d.getContext('2d'), eg = e.getContext('2d');
    if (b.style === 'container') {                                                 // Container: Lackfarbe, Rippen, Türgriffe
      dg.fillStyle = shade(b.paint || '#888', -55); dg.fillRect(0, 0, W, H);
      dg.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 3; x < W; x += 6) dg.fillRect(x, 0, 2, H);
      for (let f = 1; f * 16 < H; f++) { dg.fillStyle = 'rgba(0,0,0,0.5)'; dg.fillRect(0, f * 16 - 1, W, 2); }
    } else {
      dg.fillStyle = S.base; dg.fillRect(0, 0, W, H);
      const gr = dg.createLinearGradient(0, 0, 0, Math.min(H, 110)); gr.addColorStop(0, 'rgba(255,170,90,0.22)'); gr.addColorStop(1, 'rgba(255,170,90,0)');   // Straßenlicht färbt unten warm
      dg.fillStyle = gr; dg.fillRect(0, 0, W, Math.min(H, 110));
      const CW = S.mullion ? 10 : 14;
      for (let f = 1; f * C.FLOOR_H < H - 4; f++) {
        const y = f * C.FLOOR_H;
        dg.fillStyle = 'rgba(0,0,0,0.4)'; dg.fillRect(0, y - 1, W, 2);
        if (S.balcony) { dg.fillStyle = 'rgba(70,74,88,0.9)'; for (let x = 6; x + 22 < W; x += 46) { dg.fillRect(x, y + 16, 22, 2); if (rand(0, 1) < 0.3) { eg.fillStyle = 'rgba(255,255,255,0.18)'; eg.fillRect(x, y + 12, 22, 1); } } }
        for (let x = 4; x + CW - 4 < W; x += CW) {
          dg.fillStyle = '#0a0d15'; dg.fillRect(x, y + 5, CW - 5, 11);
          if (rand(0, 1) < S.win) {
            const col = S.cyan ? '#bfe8ff' : S.warm ? '#ffd9a0' : rand(0, 1) < 0.62 ? '#ffc982' : rand(0, 1) < 0.6 ? '#9fdcff' : '#ff8fd0';
            eg.fillStyle = rgba(col, rand(0.45, 0.95)); eg.fillRect(x, y + 5, CW - 5, 11);
          }
        }
      }
      if (S.mullion) { dg.fillStyle = 'rgba(120,170,230,0.08)'; for (let x = 0; x < W; x += 30) dg.fillRect(x, 0, 2, H); }
      if (S.corrugated) { dg.fillStyle = 'rgba(0,0,0,0.28)'; for (let x = 2; x < W; x += 5) dg.fillRect(x, 0, 2, H); }
      if (S.band) { eg.fillStyle = rgba(b.neon || NEON_COLORS[randi(0, 4)], 0.8); eg.fillRect(3, 7, W - 6, 3); }                      // Laden-Neonband
      if (S.sign && W > 50 && H > 110) {                                                                                         // senkrechtes Schild, Pseudo-Glyphen
        const sx = rand(8, W - 26), c = b.neon || NEON_COLORS[randi(0, 4)], y0 = rand(26, 50), len = Math.min(H - y0 - 10, rand(70, 150));
        dg.fillStyle = '#0d0b12'; dg.fillRect(sx, y0, 18, len); eg.strokeStyle = rgba(c, 0.95); eg.lineWidth = 2; eg.strokeRect(sx + 1, y0 + 1, 16, len - 2); eg.fillStyle = rgba(c, 0.9);
        for (let yy = y0 + 8; yy < y0 + len - 12; yy += 14) { const k = randi(0, 3);
          if (k === 0) eg.fillRect(sx + 5, yy, 8, 2); else if (k === 1) { eg.fillRect(sx + 5, yy, 2, 9); eg.fillRect(sx + 5, yy + 7, 8, 2); }
          else if (k === 2) { eg.fillRect(sx + 4, yy + 3, 10, 2); eg.fillRect(sx + 8, yy, 2, 9); } else eg.strokeRect(sx + 5, yy, 8, 8); }
      }
      for (let i = 0; i < W / 9; i++) { dg.fillStyle = 'rgba(0,0,0,0.14)'; dg.fillRect(rand(0, W), rand(0, H * 0.6), 1.5, rand(20, 90)); }   // Regenschlieren
    }
    const sg = dg.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, `rgba(4,6,12,${shadeK * 0.6})`); sg.addColorStop(1, `rgba(4,6,12,${Math.min(0.8, shadeK + 0.25)})`);
    dg.fillStyle = sg; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = 'lighter'; dg.globalAlpha = 0.9; dg.drawImage(e, 0, 0); dg.globalAlpha = 1; dg.globalCompositeOperation = 'source-over';
    return d;
  },
  makeRoof(b, w, h) {
    const d = mkCanvas(w, h), e = mkCanvas(w, h), dg = d.getContext('2d'), eg = e.getContext('2d'), S = FACADE_STYLES[b.style] || FACADE_STYLES.concrete;
    dg.fillStyle = b.style === 'container' ? shade(b.paint || '#888', -45) : b.style === 'glass' ? '#161c28' : b.style === 'white' ? '#2b3240' : '#1b1e26'; dg.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 40; i++) { dg.fillStyle = `rgba(${rand(0, 1) < 0.5 ? '0,0,0' : '255,255,255'},${rand(0.03, 0.07)})`; dg.fillRect(rand(0, w), rand(0, h), 2, 2); }
    if (b.style === 'container') { dg.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 3; x < w; x += 7) dg.fillRect(x, 0, 2, h); return d; }
    dg.strokeStyle = 'rgba(110,120,145,0.55)'; dg.lineWidth = 4; dg.strokeRect(2, 2, w - 4, h - 4); dg.strokeStyle = 'rgba(0,0,0,0.5)'; dg.lineWidth = 2; dg.strokeRect(6, 6, w - 12, h - 12);
    if (b.style === 'shack') { dg.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 3; y < h; y += 5) dg.fillRect(0, y, w, 2); }
    else if (w > 50 && h > 50) {
      const box = (x, y, bw, bh, col) => { dg.fillStyle = 'rgba(0,0,0,0.45)'; dg.fillRect(x + 3, y + 4, bw, bh); dg.fillStyle = col; dg.fillRect(x, y, bw, bh); dg.fillStyle = 'rgba(255,255,255,0.12)'; dg.fillRect(x, y, bw, 2); };
      const n = 1 + Math.floor(Math.min(w * h, 160000) / 9000);
      for (let i = 0; i < n; i++) {                                                // Klimageräte mit Lüfter
        const x = rand(10, w - 34), y = rand(10, h - 30); box(x, y, 22, 16, '#2c313c');
        dg.fillStyle = '#14171d'; dg.beginPath(); dg.arc(x + 11, y + 8, 6, 0, TAU); dg.fill(); dg.strokeStyle = '#4c5363'; dg.lineWidth = 1; dg.beginPath(); dg.moveTo(x + 5, y + 8); dg.lineTo(x + 17, y + 8); dg.moveTo(x + 11, y + 2); dg.lineTo(x + 11, y + 14); dg.stroke();
      }
      if (w > 90 && rand(0, 1) < 0.6) { const x = rand(18, w - 40), y = rand(18, h - 40); dg.fillStyle = 'rgba(0,0,0,0.45)'; dg.beginPath(); dg.arc(x + 4, y + 5, 15, 0, TAU); dg.fill(); dg.fillStyle = '#262b35'; dg.beginPath(); dg.arc(x, y, 15, 0, TAU); dg.fill(); dg.strokeStyle = '#424a59'; dg.lineWidth = 2; dg.stroke(); }   // Wassertank
      const ax = rand(12, w - 12), ay = rand(12, h - 12);                          // Antenne mit Blinklicht
      dg.strokeStyle = '#59606e'; dg.lineWidth = 2; dg.beginPath(); dg.moveTo(ax, ay); dg.lineTo(ax + 14, ay - 10); dg.stroke(); eg.fillStyle = 'rgba(255,40,50,0.95)'; eg.beginPath(); eg.arc(ax + 14, ay - 10, 2.2, 0, TAU); eg.fill();
    }
    if (b.regent && w > 100 && h > 100) {                                          // Regenten-Hologramm auf dem Palast (Animation folgt MS3)
      const cx = w / 2, cy = h / 2, c = '#5ff0ff'; eg.strokeStyle = rgba(c, 0.85); eg.lineWidth = 2; eg.beginPath(); eg.ellipse(cx, cy, 30, 38, 0, 0, TAU); eg.stroke();
      eg.beginPath(); eg.moveTo(cx - 30, cy - 34); eg.lineTo(cx - 20, cy - 54); eg.lineTo(cx - 8, cy - 40); eg.lineTo(cx, cy - 58); eg.lineTo(cx + 8, cy - 40); eg.lineTo(cx + 20, cy - 54); eg.lineTo(cx + 30, cy - 34); eg.stroke();
      eg.fillStyle = rgba(c, 0.9); eg.fillRect(cx - 16, cy - 8, 10, 4); eg.fillRect(cx + 6, cy - 8, 10, 4); eg.fillRect(cx - 8, cy + 16, 16, 3);
    } else if ((b.style === 'neon' || b.style === 'white') && w > 90 && h > 40) {  // Dachschild, von oben lesbar
      const txt = (b.name || ['KAPSELN', 'BAR 24', 'NUDELN', 'KREDIT', 'CHIPS', 'HOTEL'][randi(0, 5)]).replace(/ „.*$/, '').slice(0, 15), c = b.neon || NEON_COLORS[randi(0, 4)];
      eg.font = '900 13px "Arial Black", "Arial Bold", Verdana, "DejaVu Sans", sans-serif'; eg.textAlign = 'center';
      const tw = Math.min(w - 16, eg.measureText(txt).width + 18); dg.fillStyle = '#0c0a10'; dg.fillRect(w / 2 - tw / 2, h - 34, tw, 22);
      eg.fillStyle = rgba(c, 0.95); eg.fillText(txt, w / 2, h - 18); eg.strokeStyle = rgba(c, 0.7); eg.lineWidth = 1.5; eg.strokeRect(w / 2 - tw / 2, h - 34, tw, 22);
    }
    void S; dg.globalCompositeOperation = 'lighter'; dg.drawImage(e, 0, 0); dg.globalCompositeOperation = 'source-over';
    return d;
  }
};
