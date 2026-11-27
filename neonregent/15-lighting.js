'use strict';
// 15-lighting.js - Lichtregister + Lightmap (PLAN §5.3): Umgebungsfarbe + Vignette (vorgerendert) per 'copy', alle Lichter additiv in
// halber Auflösung, danach EIN Vollbild-'multiply'. Regen, Dampf, Glitch, Post folgen (MS1/MS3).
// Exportiert: Lights, Lightmap

const Lights = {
  list: [],
  begin() { this.list.length = 0; },
  // Welt-Licht eintragen. Außerhalb des Bildes oder über dem Budget: verworfen.
  add(x, y, r, color, k, angle) {
    if (this.list.length >= C.LIGHTS_MAX) return;
    if (!onScreen(x, y, r)) return;
    this.list.push({ x, y, r, color, k, angle });
  },
  // Alle Lichtquellen dieses Frames sammeln: statische Lampen, Partikel, Spieler
  collect() {
    this.begin();
    const t = G.time;
    for (const l of G.lamps) {
      const T = LIGHT_TYPES[l.type];
      const fl = T.flicker ? 1 - T.flicker * (0.5 + 0.5 * Math.sin(t * (0.21 + (l.ph % 7) * 0.03) + l.ph) * Math.sin(t * 0.9 + l.ph * 3)) : 1;
      this.add(l.x, l.y, T.r, T.color, T.k * fl);
    }
    for (const q of G.parts) {
      if (q.kind === 'light') this.add(q.x, q.y, q.size * 1.25, q.color, Math.min(1, q.life / q.max * 1.1));
      else if (q.kind === 'glow' && q.size > 18) this.add(q.x, q.y, q.size * 2.6, q.color, 0.4 * Math.min(1, q.life / q.max));
      else if (q.kind === 'debris' && q.burning && q.life > 20) this.add(q.x, q.y - q.z, 38, '#ff8a2a', 0.5);
    }
    const p = G.player;
    if (p && G.state !== 'menu') { const T = LIGHT_TYPES.player; this.add(p.x, p.y, T.r * 1.6, T.color, T.k); }
  }
};

const Lightmap = {
  w: 0, h: 0, lm: null, lg: null, base: null, ambient: '', scale: 0,
  // (Neu)aufbau bei Qualitätswechsel oder anderer Umgebungsfarbe (Distrikt, Morgengrauen)
  build(ambient, scale) {
    this.ambient = ambient; this.scale = scale;
    this.w = Math.ceil(VIEW_W * scale); this.h = Math.ceil(VIEW_H * scale);
    this.lm = mkCanvas(this.w, this.h); this.lg = this.lm.getContext('2d');
    this.base = mkCanvas(this.w, this.h);
    const g = this.base.getContext('2d');
    g.fillStyle = ambient; g.fillRect(0, 0, this.w, this.h);
    const gr = g.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.38, this.w / 2, this.h / 2, this.w * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,6,0.62)');                // Vignette einbacken (1.6 ms -> 0.44 ms, PLAN §10)
    g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h);
  },
  // Lichter in die Lightmap malen und mit 'multiply' über das Bild legen. (sx, sy, z): Welt -> Bildschirm wie in render()
  draw(ctx2, V) {
    const scale = G.quality < 0.5 ? 0.33 : C.LIGHTMAP_SCALE;
    if (!this.lm || this.scale !== scale || this.ambient !== G.ambient) this.build(G.ambient, scale);
    const lg = this.lg, s = this.scale, z = V.z;
    lg.globalCompositeOperation = 'copy'; lg.globalAlpha = 1; lg.drawImage(this.base, 0, 0);
    lg.globalCompositeOperation = 'lighter';
    for (const L of Lights.list) {
      const r = L.r * z * s, x = ((L.x - V.cx) * z + VIEW_W / 2) * s, y = ((L.y - V.cy) * z + VIEW_H / 2) * s;
      lg.globalAlpha = L.k;
      lg.drawImage(lightSprite(L.color), x - r, y - r, r * 2, r * 2);
    }
    lg.globalAlpha = 1;
    ctx2.setTransform(1, 0, 0, 1, 0, 0);
    ctx2.globalCompositeOperation = 'multiply';
    ctx2.drawImage(this.lm, 0, 0, VIEW_W, VIEW_H);
    ctx2.globalCompositeOperation = 'source-over';
  }
};
