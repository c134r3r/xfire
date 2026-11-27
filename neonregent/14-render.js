'use strict';
// 14-render.js - Canvas, Kamera, Render-Reihenfolge (PLAN §5.1), Boden-Chunks. MS0: Testfeld statt Stadt, Gebäude als flache Dächer
// (kippende Fassaden, Fassadentexturen, Regen folgen in MS1). Exportiert: canvas, ctx, fitCanvas, updateCamera, onScreen, render, Ground

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

// ---- Kamera: cam = Weltpunkt in der Bildmitte; Zoom zu Fuß C.ZOOM_FOOT, drinnen C.ZOOM_INSIDE (später nach Tempo, MS2) ----
function updateCamera(snap) {
  const p = G.player; if (!p) return;
  const ap = aimPoint();
  const lx = clamp((ap.x - p.x) * 0.2, -170, 170), ly = clamp((ap.y - p.y) * 0.2, -120, 120);     // Zielabstand-Vorausschau wie Ironclad
  const tz = G.inside ? C.ZOOM_INSIDE : C.ZOOM_FOOT;
  G.zoomBase = snap ? tz : lerp(G.zoomBase || tz, tz, 0.06);
  const hw = VIEW_W / 2 / G.zoomBase, hh = VIEW_H / 2 / G.zoomBase, A = G.arena;
  const tx = clamp(p.x + lx, hw - 80, A.w - hw + 80), ty = clamp(p.y + ly, hh - 80, A.h - hh + 80), k = snap ? 1 : 0.11;
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
}
function onScreen(x, y, m = 0) {
  const z = G.zoom || 1, hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z;
  return x > G.cam.x - hw - m && x < G.cam.x + hw + m && y > G.cam.y - hh - m && y < G.cam.y + hh + m;
}

// ---- Boden: 512-px-Chunks, einmal prozedural gemalt (helle Albedo - die Lightmap macht die Nacht) ----
const Ground = {
  CH: 512, cache: new Map(),
  chunk(cx, cy) {
    const key = cx + ',' + cy; let c = this.cache.get(key); if (c) return c;
    c = mkCanvas(this.CH, this.CH); const g = c.getContext('2d'), A = G.arena, T = C.TILE, per = this.CH / T;
    withSeed(cx * 131 + cy * 17 + 5, () => {
      for (let ty = 0; ty < per; ty++) for (let tx = 0; tx < per; tx++) {
        const gx = cx * per + tx, gy = cy * per + ty, kind = A.tileAt(gx, gy), x = tx * T, y = ty * T;
        if (kind < 0) { g.fillStyle = '#040508'; g.fillRect(x, y, T, T); continue; }
        const base = kind === 0 ? [118, 122, 134] : kind === 1 ? [150, 154, 166] : [96, 100, 112], j = rand(-5, 5);
        g.fillStyle = `rgb(${base[0] + j},${base[1] + j},${base[2] + j})`; g.fillRect(x, y, T, T);
        for (let i = 0; i < (kind === 0 ? 46 : 22); i++) {                       // Körnung
          const v = rand(-14, 14); g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 10},${Math.abs(v) / 90})`;
          g.fillRect(x + rand(0, T), y + rand(0, T), rand(1, 3), rand(1, 3));
        }
        if (kind === 1) { g.strokeStyle = 'rgba(20,24,34,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1); }                      // Gehwegplatten
        if (kind === 0 && rand(0, 1) < 0.12) { g.fillStyle = 'rgba(20,24,34,0.22)'; g.beginPath(); g.ellipse(x + rand(10, 54), y + rand(10, 54), rand(8, 20), rand(5, 12), rand(0, 3), 0, TAU); g.fill(); }   // Flicken/Pfütze
        if (kind === 0 && A.laneH(gx, gy) && (gx % 2 === 0)) { g.fillStyle = 'rgba(255,214,120,0.75)'; g.fillRect(x + 4, y + T / 2 - 2, 24, 4); }                 // Mittellinie gestrichelt
        if (kind === 0 && A.laneV(gx, gy) && (gy % 2 === 0)) { g.fillStyle = 'rgba(255,214,120,0.75)'; g.fillRect(x + T / 2 - 2, y + 4, 4, 24); }
      }
    });
    this.cache.set(key, c);
    if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value);   // LRU grob (Qualitätsstufen: 24-48 Chunks)
    return c;
  }
};

let viewState = { cx: 0, cy: 0, z: 1 };
function render() {
  const sh = G.trauma * G.trauma;
  const shx = (R.fn() * 2 - 1) * 22 * sh + G.kickX, shy = (R.fn() * 2 - 1) * 22 * sh + G.kickY;
  G.zoom = (G.zoomBase || C.ZOOM_FOOT) + G.zoomPunch;
  const z = G.zoom, cx = G.cam.x - shx, cy = G.cam.y - shy;
  viewState = { cx, cy, z };
  const A = G.arena;
  const world = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(VIEW_W / 2, VIEW_H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy); };
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#040508'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  world();

  // 1. Boden
  const hw = VIEW_W / 2 / z, hh = VIEW_H / 2 / z, CH = Ground.CH;
  for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
    for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
      if (gx < 0 || gy < 0 || gx * CH >= A.w || gy * CH >= A.h) continue;
      ctx.drawImage(Ground.chunk(gx, gy), gx * CH, gy * CH);
    }
  // Brandflecken
  for (const d of G.decals) { if (!onScreen(d.x, d.y, 110)) continue; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(d.s, d.s * 0.9); ctx.globalAlpha = 0.9; ctx.drawImage(scorchSprite(d.v), -128, -128); ctx.restore(); }
  ctx.globalAlpha = 1;

  // 2. Gebäude (MS0: flache Dächer mit Kontaktschatten; echte kippende Fassaden in MS1)
  for (const b of G.solids) {
    if (!onScreen((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.max(b.x1 - b.x0, b.y1 - b.y0))) continue;
    ctx.fillStyle = 'rgba(0,0,6,0.5)'; ctx.fillRect(b.x0 - 6, b.y0 - 4, b.x1 - b.x0 + 14, b.y1 - b.y0 + 14);
    ctx.fillStyle = b.col; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeStyle = 'rgba(200,210,230,0.28)'; ctx.lineWidth = 2; ctx.strokeRect(b.x0 + 1, b.y0 + 1, b.x1 - b.x0 - 2, b.y1 - b.y0 - 2);
  }
  // Laternenmasten (Köpfe leuchten später im additiven Pass)
  ctx.fillStyle = '#1a1d28';
  for (const l of G.lamps) if (l.pole && onScreen(l.x, l.y, 12)) { ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, TAU); ctx.fill(); }

  // 3. Entitäten: Spieler
  const p = G.player;
  if (p && G.state !== 'menu') drawPlayer(p);
  // Trümmer (normal geblendet)
  for (const q of G.parts) {
    if (q.kind !== 'debris' || !onScreen(q.x, q.y, 30)) continue;
    const a = Math.min(1, q.life / 20);
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(q.x - q.size / 2 + q.z * 0.3, q.y - q.size / 4 + q.z * 0.4, q.size, q.size / 2);
    ctx.globalAlpha = a; ctx.save(); ctx.translate(q.x, q.y - q.z); ctx.rotate(q.rot); ctx.fillStyle = q.color; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4. Lightmap (Nacht + Farbe), EIN Pass
  if (!Q.get('nolightmap') && !location.hash.includes('nolightmap')) { Lights.collect(); Lightmap.draw(ctx, viewState); world(); }

  // 5. Additiver FX-Pass: Lampenköpfe, Glows, Funken, Ringe, Glut
  ctx.globalCompositeOperation = 'lighter';
  for (const l of G.lamps) if (onScreen(l.x, l.y, 30)) { const T = LIGHT_TYPES[l.type]; ctx.globalAlpha = 0.9; ctx.drawImage(glowSprite(T.color), l.x - 9, l.y - 9, 18, 18); }
  drawFx();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 6. Rauch (normal geblendet)
  for (const q of G.parts) {
    if (q.kind !== 'smoke') continue;
    const s = q.size + q.grow * (q.max - q.life); if (!onScreen(q.x, q.y, s)) continue;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life / q.max * 1.6) * 0.62;
    ctx.drawImage(smokeSprite(q.variant), -s, -s, s * 2, s * 2); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 7. Texte
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.life / 20); ctx.font = `900 ${t.size}px "Arial Black", "Arial Bold", Verdana, "DejaVu Sans", sans-serif`; ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
  ctx.globalAlpha = 1;

  // 8. Bildschirmraum
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (G.hurtFlash > 0.02) { ctx.fillStyle = `rgba(255,30,40,${G.hurtFlash * 0.4})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (G.sceneLabel) {
    ctx.font = '12px "DejaVu Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,236,245,0.6)';
    ctx.fillText(G.sceneLabel, VIEW_W / 2, VIEW_H - 14);
  }
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
