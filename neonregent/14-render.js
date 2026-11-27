'use strict';
// 14-render.js - Canvas, Kamera, Boden-Chunks (LRU, Decals), kippende Gebäude (GTA-2-Perspektive, PLAN §5.2), Laternen, Regen und die
// Render-Reihenfolge (PLAN §5.1). Fassadentexturen: 14b-facades.js, Lightmap: 15-lighting.js.
// Exportiert: canvas, ctx, fitCanvas, updateCamera, onScreen, render, Ground, Rain, lean

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const hudEl = document.getElementById('hud');

function fitCanvas() {
  const pad = isTouch ? 0 : 24, scale = Math.min((innerWidth - pad) / VIEW_W, (innerHeight - pad) / VIEW_H);
  canvas.width = VIEW_W; canvas.height = VIEW_H;
  const w = Math.floor(VIEW_W * scale), h = Math.floor(VIEW_H * scale);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const r = canvas.getBoundingClientRect();
  hudEl.style.left = r.left + 'px'; hudEl.style.top = r.top + 'px'; hudEl.style.width = w + 'px'; hudEl.style.height = h + 'px';
}

// ---- Kamera: cam = Weltpunkt in der Bildmitte; Zoom zu Fuß C.ZOOM_FOOT, drinnen C.ZOOM_INSIDE (nach Tempo im Auto: MS2) ----
function updateCamera(snap) {
  const p = G.player; if (!p) return;
  const ap = aimPoint(); let lx = clamp((ap.x - p.x) * 0.2, -170, 170), ly = clamp((ap.y - p.y) * 0.2, -120, 120);     // Zielabstand-Vorausschau wie Ironclad
  let tz = G.inside ? C.ZOOM_INSIDE : C.ZOOM_FOOT;
  if (p.veh) {                                                                                      // im Fahrzeug: Zoom nach Tempo, Vorausschau = Geschwindigkeit x 22 (max. 260 px)
    const v = p.veh, spd = Math.hypot(v.vx, v.vy), top = VEHICLES[v.cls].top, k = clamp(spd / top, 0, 1);
    tz = lerp(C.ZOOM_CAR_SLOW, C.ZOOM_CAR_FAST, k); const m = Math.min(260, spd * C.CAM_LEAD_CAR), q = spd || 1; lx = v.vx / q * m; ly = v.vy / q * m;
  }
  G.zoomBase = snap ? tz : lerp(G.zoomBase || tz, tz, 0.06);
  const hw = VIEW_W / 2 / G.zoomBase, hh = VIEW_H / 2 / G.zoomBase, MW = World.W * C.TILE, MH = World.H * C.TILE;
  const tx = clamp(p.x + lx, hw - 60, MW - hw + 60), ty = clamp(p.y + ly, hh - 60, MH - hh + 60), k = snap ? 1 : 0.11;
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}
function onScreen(x, y, m = 0) {
  const z = G.zoom || 1, hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z;
  return x > G.cam.x - hw - m && x < G.cam.x + hw + m && y > G.cam.y - hh - m && y < G.cam.y + hh + m;
}

// ------------------------------------------------------------------
// Boden: 512-px-Chunks, einmal prozedural gemalt (helle Albedo - die Lightmap macht die Nacht). Decals werden eingestempelt UND pro
// Chunk gemerkt (max. 40), damit ein neu gemalter Chunk sie wieder bekommt (PLAN §4.5).
// ------------------------------------------------------------------
const Ground = {
  CH: C.CHUNK, cache: new Map(), decals: new Map(),
  key(cx, cy) { return cx + cy * 1024; },
  chunk(cx, cy) {
    const key = this.key(cx, cy); let c = this.cache.get(key);
    if (c) { this.cache.delete(key); this.cache.set(key, c); return c; }
    c = this.paint(cx, cy); this.cache.set(key, c);
    while (this.cache.size > C.CHUNKS_MAX) this.cache.delete(this.cache.keys().next().value);
    return c;
  },
  paint(cx, cy) {
    const c = mkCanvas(this.CH, this.CH), g = c.getContext('2d'), T = C.TILE, per = this.CH / T, W = World.W, H = World.H, tl = World.tiles;
    const kind = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TK.WATER : tl[y * W + x];
    const isRoad = k => k === TK.ROAD || k === TK.JUNCTION || k === TK.CROSSWALK;
    withSeed(cx * 7919 + cy * 104729 + 3, () => {
      for (let ty = 0; ty < per; ty++) for (let tx = 0; tx < per; tx++) {
        const gx = cx * per + tx, gy = cy * per + ty, k = kind(gx, gy), x = tx * T, y = ty * T, j = rand(-4, 4);
        const rgb = { [TK.WATER]: [14, 30, 50], [TK.ROAD]: [112, 116, 128], [TK.JUNCTION]: [112, 116, 128], [TK.CROSSWALK]: [112, 116, 128], [TK.SIDEWALK]: [150, 154, 168],
          [TK.LOT]: [88, 90, 100], [TK.BRIDGE]: [96, 100, 110], [TK.PARK]: [80, 98, 92], [TK.QUAY]: [118, 122, 134] }[k] || [0, 0, 0];
        g.fillStyle = `rgb(${rgb[0] + j},${rgb[1] + j},${rgb[2] + j})`; g.fillRect(x, y, T, T);
        if (k === TK.WATER) { g.fillStyle = 'rgba(70,120,180,0.10)'; for (let i = 0; i < 5; i++) g.fillRect(x + rand(0, T - 12), y + rand(0, T), rand(6, 14), 1.5); continue; }
        for (let i = 0; i < (isRoad(k) ? 16 : 9); i++) { const v = rand(-14, 14); g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 8},${Math.abs(v) / 90})`; g.fillRect(x + rand(0, T), y + rand(0, T), rand(1, 3), rand(1, 3)); }
        if (isRoad(k) && rand(0, 1) < 0.1) { g.fillStyle = 'rgba(20,24,40,0.2)'; g.beginPath(); g.ellipse(x + rand(12, 52), y + rand(12, 52), rand(8, 22), rand(5, 12), rand(0, 3), 0, TAU); g.fill(); }   // Flicken/Pfütze
        if (k === TK.SIDEWALK || k === TK.QUAY) {                                 // Gehwegplatten
          g.strokeStyle = 'rgba(16,20,30,0.32)'; g.lineWidth = 1; g.beginPath();
          for (let q = 0; q <= T; q += 16) { g.moveTo(x + q + 0.5, y); g.lineTo(x + q + 0.5, y + T); g.moveTo(x, y + q + 0.5); g.lineTo(x + T, y + q + 0.5); } g.stroke();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isRoad(kind(gx + dx, gy + dy))) {             // Bordstein
            g.fillStyle = 'rgba(210,216,232,0.65)'; if (dx) g.fillRect(dx > 0 ? x + T - 3 : x, y, 3, T); else g.fillRect(x, dy > 0 ? y + T - 3 : y, T, 3);
          }
          if (k === TK.QUAY) { g.fillStyle = 'rgba(8,10,16,0.5)'; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (kind(gx + dx, gy + dy) === TK.WATER) { if (dx) g.fillRect(dx > 0 ? x + T - 4 : x, y, 4, T); else g.fillRect(x, dy > 0 ? y + T - 4 : y, T, 4); } }
        }
        if (k === TK.BRIDGE) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, T - 2, T - 2); g.fillStyle = 'rgba(0,0,0,0.3)'; for (const [rx, ry] of [[6, 6], [T - 8, 6], [6, T - 8], [T - 8, T - 8]]) g.fillRect(x + rx, y + ry, 3, 3); }
        if (k === TK.PARK) { g.fillStyle = 'rgba(60,110,80,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(x + rand(0, T), y + rand(0, T), rand(3, 8), rand(2, 5)); }
        if (k === TK.ROAD || k === TK.BRIDGE) {                                   // Mittellinie: gestrichelt zwischen den beiden Spuren
          const li = (gy * W + gx) * 2, ldx = World.lane ? World.lane[li] : 0, ldy = World.lane ? World.lane[li + 1] : 0;
          g.fillStyle = 'rgba(255,220,140,0.75)';
          if (ldx === -1) { for (let q = 4; q < T; q += 32) g.fillRect(x + q, y + T - 2, 18, 3); }
          else if (ldy === 1 && ldx === 0) { for (let q = 4; q < T; q += 32) g.fillRect(x + T - 2, y + q, 3, 18); }
        }
        if (k === TK.CROSSWALK) {                                                 // Zebrastreifen: Balken parallel zur Fahrtrichtung
          const vert = kind(gx, gy - 1) === TK.JUNCTION || kind(gx, gy + 1) === TK.JUNCTION || kind(gx, gy - 1) === TK.CROSSWALK && kind(gx + 1, gy) !== TK.JUNCTION && kind(gx - 1, gy) !== TK.JUNCTION;
          g.fillStyle = 'rgba(235,240,250,0.7)'; if (vert) for (let q = 6; q < T - 6; q += 14) g.fillRect(x + q, y + 5, 7, T - 10); else for (let q = 6; q < T - 6; q += 14) g.fillRect(x + 5, y + q, T - 10, 7);
        }
      }
      // Kontaktschatten am Gebäudefuß (weich durch gestaffelte Rechtecke)
      const x0 = cx * this.CH, y0 = cy * this.CH;
      for (const b of World.near(x0 - 16, y0 - 16, x0 + this.CH + 16, y0 + this.CH + 16)) {
        if (b.gate) continue;
        for (let i = 3; i >= 1; i--) { g.fillStyle = `rgba(0,0,8,${0.16})`; g.fillRect(b.x0 - x0 - i * 3, b.y0 - y0 - i * 3, b.x1 - b.x0 + i * 6, b.y1 - b.y0 + i * 6); }
      }
    });
    for (const d of this.decals.get(this.key(cx, cy)) || []) this.drawDecal(g, d, cx * this.CH, cy * this.CH);
    return c;
  },
  drawDecal(g, d, ox, oy) { g.save(); g.translate(d.x - ox, d.y - oy); g.rotate(d.rot); g.scale(d.s, d.s * 0.9); g.globalAlpha = 0.9; g.drawImage(scorchSprite(d.v), -128, -128); g.restore(); },
  // Brandfleck/Splat dauerhaft in alle berührten Chunks stempeln
  decal(d) {
    const r = 128 * d.s * 1.1;
    for (let cy = Math.floor((d.y - r) / this.CH); cy <= Math.floor((d.y + r) / this.CH); cy++)
      for (let cx = Math.floor((d.x - r) / this.CH); cx <= Math.floor((d.x + r) / this.CH); cx++) {
        const k = this.key(cx, cy); let l = this.decals.get(k); if (!l) this.decals.set(k, l = []);
        if (l.length >= 40) l.shift(); l.push(d);
        const c = this.cache.get(k); if (c) this.drawDecal(c.getContext('2d'), d, cx * this.CH, cy * this.CH);
      }
  },
  // Bremsspur: kurzer dunkler Strich in die Chunks (nicht persistiert: ein neu gemalter Chunk ist wieder sauber)
  skid(x, y, ang) {
    const k = this.key(Math.floor(x / this.CH), Math.floor(y / this.CH)), c = this.cache.get(k); if (!c) return;
    const g = c.getContext('2d'); g.save(); g.translate(x - Math.floor(x / this.CH) * this.CH, y - Math.floor(y / this.CH) * this.CH); g.rotate(ang);
    g.fillStyle = 'rgba(4,4,10,0.3)'; g.fillRect(-4, -1.1, 8, 2.2); g.restore();
  },
  // Pro Frame höchstens einen fehlenden Chunk im erweiterten Sichtbereich vormalen (kein Ruckeln beim Laufen)
  prefetch(cx, cy, hw, hh) {
    const CH = this.CH;
    for (let gy = Math.floor((cy - hh - CH) / CH); gy <= Math.floor((cy + hh + CH) / CH); gy++) for (let gx = Math.floor((cx - hw - CH) / CH); gx <= Math.floor((cx + hw + CH) / CH); gx++) {
      if (gx < 0 || gy < 0 || gx * CH >= World.W * C.TILE || gy * CH >= World.H * C.TILE) continue;
      if (!this.cache.has(this.key(gx, gy))) { this.chunk(gx, gy); return; }
    }
  }
};

// ------------------------------------------------------------------
// Kippende Gebäude (PLAN §5.2): D = (B - C) * h * LEAN_K, geklemmt auf LEAN_MAX * h. Fassaden als Parallelogramme, Textur affin gemappt.
// ------------------------------------------------------------------
function lean(x, y, h, cx, cy) {
  let dx = (x - cx) * h * C.LEAN_K, dy = (y - cy) * h * C.LEAN_K; const m = Math.hypot(dx, dy), lim = C.LEAN_MAX * h;
  if (m > lim) { dx *= lim / m; dy *= lim / m; }
  return { x: dx, y: dy };
}
let vis = [];
function drawBuildings(V, base) {
  const { cx, cy, z } = V, hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z; vis.length = 0;
  for (const b of G.buildings) {
    const bx = (b.x0 + b.x1) / 2, by = (b.y0 + b.y1) / 2, D = lean(bx, by, b.h, cx, cy);
    if (b.x1 + Math.max(0, D.x) < cx - hw || b.x0 + Math.min(0, D.x) > cx + hw || b.y1 + Math.max(0, D.y) < cy - hh || b.y0 + Math.min(0, D.y) > cy + hh) continue;
    vis.push(b); b._D = D; b._d = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
  }
  vis.sort((a, b) => a.h - b.h || b._d - a._d);                   // niedrig zuerst, bei gleicher Höhe weiter entfernt zuerst
  for (const b of vis) {
    const D = b._D, m = base;
    const draw = (side, x0, y0, x1, y1) => {
      const img = Tex.face(b, side); let a = x1 - x0, bb = y1 - y0, px = x0, py = y0;
      if (a * D.y - bb * D.x < 0) { px = x1; py = y1; a = -a; bb = -bb; }
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.transform(a / img.width, bb / img.width, D.x / img.height, D.y / img.height, px, py);
      ctx.drawImage(img, 0, 0);
    };
    if (D.y > 0.5) draw('N', b.x0, b.y0, b.x1, b.y0);
    if (D.y < -0.5) draw('S', b.x0, b.y1, b.x1, b.y1);
    if (D.x > 0.5) draw('W', b.x0, b.y0, b.x0, b.y1);
    if (D.x < -0.5) draw('E', b.x1, b.y0, b.x1, b.y1);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(Tex.roof(b), b.x0 + D.x, b.y0 + D.y);
  }
  ctx.setTransform(base[0], base[1], base[2], base[3], base[4], base[5]);
}

// Laternen: Mast von Boden zu Boden + D, Kopf additiv (alle Masten, dann alle Köpfe in einem Batch)
const LAMP_H = 70;
function drawLamps(V) {
  const { cx, cy } = V; let n = 0; const heads = [];
  ctx.strokeStyle = '#161922'; ctx.lineWidth = 2.2; ctx.beginPath();
  for (const l of G.lamps) {
    if (!onScreen(l.x, l.y, 20)) continue;
    const D = l.pole ? lean(l.x, l.y, LAMP_H, cx, cy) : { x: 0, y: -4 };
    if (l.pole) { ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + D.x, l.y + D.y); }
    heads.push(l, D); if (++n > 600) break;
  }
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < heads.length; i += 2) {
    const l = heads[i], D = heads[i + 1], col = l.color || LIGHT_TYPES[l.type].color, s = l.type === 'neon' ? 7 : 9;
    ctx.globalAlpha = l.type === 'neon' ? 0.55 : 0.95; ctx.drawImage(glowSprite(col), l.x + D.x - s, l.y + D.y - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------
// Regen (Bildschirmraum, 3 Schichten) + Bodenspritzer. Alpha x 0.4 drinnen, x G.rain (Morgengrauen: 0)
// ------------------------------------------------------------------
const ABL = new Set(location.hash.slice(1).split(','));      // Ablation für Messungen: #norain,nobuild,nolamps,nolightmap (PLAN §10)
const Rain = {
  d: [], rip: [],
  init() { const r = rng(99); for (let i = 0; i < C.RAIN_DROPS * 1.4; i++) this.d.push({ x: r() * VIEW_W, y: r() * VIEW_H, l: 0.5 + r() * 0.5, v: 0.6 + r() * 0.5 }); },
  draw() {
    const a = (G.inside ? 0.4 : 1) * G.rain; if (a <= 0.01 || ABL.has('norain')) return;
    if (!this.d.length) this.init();
    const n = Math.floor(C.RAIN_DROPS * G.quality), W = VIEW_W, H = VIEW_H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineCap = 'round';
    for (let layer = 0; layer < 3; layer++) {
      ctx.strokeStyle = `rgba(${170 + layer * 25},${200 + layer * 15},255,${(0.16 + layer * 0.1) * a})`; ctx.lineWidth = 0.8 + layer * 0.5; ctx.beginPath();
      for (let i = layer; i < n; i += 3) {
        const p = this.d[i], len = 14 + 20 * p.l * (0.6 + layer * 0.4), sp = (16 + 14 * p.v) * (0.7 + layer * 0.3);
        p.y += sp; p.x -= sp * 0.2; if (p.y > H + 20) { p.y -= H + 40; p.x = Math.random() * (W + 80); } if (p.x < -20) p.x += W + 40;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + len * 0.2, p.y - len);
      }
      ctx.stroke();
    }
    if (G.quality > 0.5) {                                                           // Spritzer: kleine Ringe auf dem Boden
      if (this.rip.length < 40 && Math.random() < 0.8) this.rip.push({ x: Math.random() * W, y: Math.random() * H, t: 0 });
      ctx.strokeStyle = `rgba(190,215,255,${0.35 * a})`; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = this.rip.length - 1; i >= 0; i--) { const r = this.rip[i]; if (++r.t > 9) { this.rip.splice(i, 1); continue; } ctx.moveTo(r.x + r.t * 0.9, r.y); ctx.ellipse(r.x, r.y, r.t * 0.9, r.t * 0.4, 0, 0, TAU); }
      ctx.stroke();
    }
  }
};

let viewState = { cx: 0, cy: 0, z: 1 };
function render() {
  const sh = G.trauma * G.trauma;
  const shx = (R.fn() * 2 - 1) * 22 * sh + G.kickX, shy = (R.fn() * 2 - 1) * 22 * sh + G.kickY;
  G.zoom = (G.zoomBase || C.ZOOM_FOOT) + G.zoomPunch;
  const z = G.zoom, cx = G.cam.x - shx, cy = G.cam.y - shy;
  viewState = { cx, cy, z };
  const base = [z, 0, 0, z, VIEW_W / 2 - cx * z, VIEW_H / 2 - cy * z];               // Welt -> Bildschirm
  const world = () => ctx.setTransform(base[0], base[1], base[2], base[3], base[4], base[5]);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  world();

  // 1. Boden
  const hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z, CH = Ground.CH, MW = World.W * C.TILE, MH = World.H * C.TILE;
  for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
    for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
      if (gx < 0 || gy < 0 || gx * CH >= MW || gy * CH >= MH) continue;
      ctx.drawImage(Ground.chunk(gx, gy), gx * CH, gy * CH);
    }
  Ground.prefetch(cx, cy, hw, hh);

  // 3. Entitäten: Fahrzeuge (Lack), Spieler zu Fuß, Trümmer
  const p = G.player;
  drawVehicles('body');
  if (p && G.state !== 'menu' && !p.veh) drawPlayer(p);
  for (const q of G.parts) {
    if (q.kind !== 'debris' || !onScreen(q.x, q.y, 30)) continue;
    const a = Math.min(1, q.life / 20);
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(q.x - q.size / 2 + q.z * 0.3, q.y - q.size / 4 + q.z * 0.4, q.size, q.size / 2);
    ctx.globalAlpha = a; ctx.save(); ctx.translate(q.x, q.y - q.z); ctx.rotate(q.rot); ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4. Lightmap (Nacht + Farbe), EIN Pass
  if (!ABL.has('nolightmap')) { Lights.collect(); Lightmap.draw(ctx, viewState); world(); }

  // 5. Kleine additive Glows am Boden (Marker, Mündungsfeuer ...): nur Partikel-Glows, die unter den Dächern liegen
  // 6. Gebäude (nach der Lightmap, mit Nacht-Texturen) und Laternen
  if (!ABL.has('nobuild')) drawBuildings(viewState, base);
  if (!ABL.has('nolamps')) drawLamps(viewState);
  // Röntgen-Silhouette: Spieler unter einem Dachüberhang (cyan, 50 %)
  if (p && G.state !== 'menu') for (const b of vis) {
    const D = b._D;
    if (p.x > Math.min(b.x0, b.x0 + D.x) && p.x < Math.max(b.x1, b.x1 + D.x) && p.y > Math.min(b.y0, b.y0 + D.y) && p.y < Math.max(b.y1, b.y1 + D.y)) {
      ctx.globalAlpha = 0.5; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1.15, 1.15); ctx.drawImage(tinted(pedSprite('#3f93a8', Math.floor(p.walk / 7) & 3), 'xray|' + (Math.floor(p.walk / 7) & 3), '#3fe8ff'), -18, -18); ctx.restore(); ctx.globalAlpha = 1; break;
    }
  }

  // 7. Additiver FX-Pass: Glows, Funken, Ringe, Glut (über den Dächern: Explosionen sollen sichtbar bleiben)
  ctx.globalCompositeOperation = 'lighter'; drawVehicles('glow'); drawFx(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 8. Rauch (normal geblendet)
  for (const q of G.parts) {
    if (q.kind !== 'smoke') continue;
    const s = q.size + q.grow * (q.max - q.life); if (!onScreen(q.x, q.y, s)) continue;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6) * 0.62;
    ctx.drawImage(smokeSprite(q.variant), -s, -s, s * 2, s * 2); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 9. Regen, Texte
  Rain.draw(); world();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.life / 20); ctx.font = `900 ${t.size}px "Arial Black", "Arial Bold", Verdana, "DejaVu Sans", sans-serif`; ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
  const nv = G.nearVeh;
  if (nv && G.state === 'play') {                                              // Interaktionshinweis über dem Fahrzeug
    const D = VEHICLES[nv.cls], label = nv.breaking ? 'AUFBRECHEN …' : (isTouch ? 'EINSTEIGEN' : '[F] EINSTEIGEN') + (nv.locked && !nv.unlocked ? ' · VERSCHLOSSEN' : '');
    ctx.font = '900 11px "Arial Black", "Arial Bold", Verdana, "DejaVu Sans", sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; const tw = ctx.measureText(label).width + 12; ctx.fillRect(nv.x - tw / 2, nv.y - D.L / 2 - 30, tw, 17);
    ctx.fillStyle = nv.locked && !nv.unlocked ? '#ffb35c' : '#a8f6ff'; ctx.fillText(label, nv.x, nv.y - D.L / 2 - 21);
  }
  ctx.globalAlpha = 1;

  // 10. Bildschirmraum
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (Input.touch.on) {                                                         // Touch-Sticks: schwebende Basis, Knauf folgt dem Daumen
    for (const [s, dx, dy] of [[Input.touch.move, 170, 560], [Input.touch.aim, 1110, 560]]) {
      const act = s.id !== null, bx = act ? s.ox : dx, by = act ? s.oy : dy;
      ctx.globalAlpha = act ? 0.35 : 0.12; ctx.strokeStyle = '#3fe8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, Input.STICK_R, 0, TAU); ctx.stroke();
      if (act) { const v = Input.stickVec(s); ctx.globalAlpha = 0.55; ctx.fillStyle = '#a8f6ff'; ctx.beginPath(); ctx.arc(bx + v.x * Input.STICK_R, by + v.y * Input.STICK_R, 26, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  if (G.hurtFlash > 0.02) { ctx.fillStyle = `rgba(255,30,40,${G.hurtFlash * 0.4})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (G.sceneLabel) { ctx.font = '12px "DejaVu Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,236,245,0.6)'; ctx.fillText(G.sceneLabel, VIEW_W / 2, 66); }
}

// Additive Partikel (Ironclad drawLights)
function drawFx() {
  for (const q of G.parts) {
    const t = q.life / q.max;
    switch (q.kind) {
      case 'glow': { const s = q.size + q.grow * (q.max - q.life); if (!onScreen(q.x, q.y, s)) break; ctx.globalAlpha = Math.min(1, t * 1.4); ctx.drawImage(glowSprite(q.color), q.x - s, q.y - s, s * 2, s * 2); break; }
      case 'spark': if (!onScreen(q.x, q.y, 20)) break; ctx.globalAlpha = t; ctx.strokeStyle = q.color; ctx.lineWidth = q.size; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 1.8, q.y - q.vy * 1.8); ctx.stroke(); break;
      case 'ember': { if (!onScreen(q.x, q.y, 10)) break; ctx.globalAlpha = t * (0.6 + 0.4 * Math.sin(q.life * 0.6)); const s = q.size * 3; ctx.drawImage(glowSprite(q.color), q.x - s, q.y - s, s * 2, s * 2); break; }
      case 'ring': if (!onScreen(q.x, q.y, q.size)) break; ctx.globalAlpha = t; ctx.strokeStyle = q.color; ctx.lineWidth = 2 + 6 * t; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - t * t) + 6, 0, TAU); ctx.stroke(); break;
      case 'debris': if (q.burning && q.life > 20 && onScreen(q.x, q.y, 20)) { ctx.globalAlpha = 0.8; ctx.drawImage(glowSprite('#ff8a2a'), q.x - 7, q.y - q.z - 7, 14, 14); } break;
    }
  }
  ctx.globalAlpha = 1;
}

// Spieler zu Fuß (Fallback-Art, PLAN R11). Blickrichtung = Zielrichtung, Laufphase aus zurückgelegter Strecke.
function drawPlayer(p) {
  ctx.globalAlpha = 0.7; ctx.drawImage(shadowSprite(9, 6), p.x - 12 + 3, p.y - 9 + 5); ctx.globalAlpha = 1;
  const ph = Math.floor(p.walk / 7) & 3;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1.15, 1.15);
  if (p.dodge > 0) ctx.globalAlpha = 0.65;
  ctx.drawImage(pedSprite('#3f93a8', ph), -18, -18); ctx.restore(); ctx.globalAlpha = 1;
}
