'use strict';
// 03-sprites.js - Sprite-Cache, FX-Sprites (aus Ironclad), prozedurale Fallback-Art (PLAN R11), Pack-Loader-Haken.
// Exportiert: mkCanvas, sprite, tinted, rgba, shade, glowSprite, lightSprite, smokeSprite, shadowSprite, scorchSprite, pedSprite, drawImg
// Das gebackene Sprite-Bundle (window.NEONREGENT_ASSETS, MS3) ist optional - ohne es läuft alles mit der Fallback-Art.

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
const SPR = new Map();
// Cache-Sprite: fn zeichnet um den Mittelpunkt
function sprite(key, w, h, fn) {
  let c = SPR.get(key); if (c) return c;
  c = mkCanvas(w, h); const g = c.getContext('2d'); g.translate(w / 2, h / 2); fn(g); SPR.set(key, c); return c;
}
// Gleiche Silhouette, einfarbig (Treffer-Blitz, verkohlte Hülle)
function tinted(src, key, color) {
  let c = SPR.get(key); if (c) return c;
  c = mkCanvas(src.width, src.height); const g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height); SPR.set(key, c); return c;
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16), f = pct / 100;
  const ch = c => Math.round(clamp(f >= 0 ? c + (255 - c) * f : c * (1 + f), 0, 255));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
// Sprites werden einmal erzeugt und sind unabhängig vom Spiel-Zufall -> ein eigener fester Seed, sonst hängt das Aussehen von der Aufrufreihenfolge ab
function withSeed(seed, fn) { const old = R.fn; R.fn = rng(seed); try { return fn(); } finally { R.fn = old; } }

// weicher additiver Lichtfleck: weißer Kern, der in die Farbe ausläuft
function glowSprite(color) {
  return sprite('glow|' + color, 128, 128, g => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, rgba(color, 0.95)); gr.addColorStop(0.45, rgba(color, 0.35)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  });
}
// reine Farbpfütze ohne weißen Kern (Lightmap, Umgebungslicht)
function lightSprite(color) {
  return sprite('light|' + color, 128, 128, g => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 64);
    gr.addColorStop(0, rgba(color, 0.9)); gr.addColorStop(0.5, rgba(color, 0.3)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(-64, -64, 128, 128);
  });
}
// Scheinwerferkegel: Spitze links-mittig (4, 80), öffnet nach +x
function coneSprite(color) {
  return sprite('cone|' + color, 256, 160, g => {
    g.translate(-128, 0);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 256);
    gr.addColorStop(0, rgba(color, 0.95)); gr.addColorStop(0.6, rgba(color, 0.35)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.filter = 'blur(6px)';
    g.beginPath(); g.moveTo(4, -6); g.lineTo(250, -70); g.lineTo(250, 70); g.lineTo(4, 6); g.closePath(); g.fill(); g.filter = 'none';
  });
}
function smokeSprite(v) {
  return sprite('smoke|' + v, 96, 96, g => withSeed(v === 'dark' ? 11 : 12, () => {
    for (let i = 0; i < 7; i++) {
      const a = rand(0, TAU), d = rand(4, 16), r = rand(18, 30), x = Math.cos(a) * d, y = Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r), c = v === 'dark' ? '30,24,28' : v === 'dust' ? '120,120,130' : '84,86,98';
      gr.addColorStop(0, `rgba(${c},0.42)`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }));
}
function shadowSprite(rx, ry) {
  const k = Math.round(rx) + 'x' + Math.round(ry);
  return sprite('shadow|' + k, rx * 2 + 24, ry * 2 + 24, g => {
    g.filter = 'blur(5px)'; g.fillStyle = 'rgba(0,0,6,0.6)'; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); g.filter = 'none';
  });
}
function scorchSprite(v) {
  return sprite('scorch|' + v, 256, 256, g => withSeed(21 + v, () => {
    for (let k = 0; k < 9; k++) {
      const a = rand(0, TAU), d = rand(0, 26), r = rand(50, 80), x = Math.cos(a) * d, y = Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(6,6,10,0.2)'); gr.addColorStop(0.6, 'rgba(8,8,12,0.1)'); gr.addColorStop(1, 'rgba(8,8,12,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (let k = 0; k < 7; k++) {
      const a = rand(0, TAU), r0 = rand(24, 34), r1 = rand(60, 92);
      const gr = g.createLinearGradient(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
      gr.addColorStop(0, 'rgba(4,4,8,0.26)'); gr.addColorStop(1, 'rgba(4,4,8,0)');
      g.strokeStyle = gr; g.lineWidth = rand(4, 9); g.lineCap = 'round';
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
    const gr = g.createRadialGradient(-3, -3, 0, 0, 0, 26);
    gr.addColorStop(0, 'rgba(2,2,5,0.6)'); gr.addColorStop(1, 'rgba(2,2,5,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
  }));
}

// ---- Fallback-Art: Person von oben (blickt nach +x), 4 Laufphasen. Wird in MS3 durch das gebackene Rig ersetzt. ----
function pedSprite(coat, phase) {
  return sprite('ped|' + coat + '|' + phase, 36, 36, g => {
    const sw = Math.sin(phase * Math.PI / 2) * 3.2;                 // Beinschwung
    g.fillStyle = '#10131c'; g.beginPath(); g.ellipse(-1, sw, 4.2, 2.6, 0, 0, TAU); g.ellipse(-1, -sw, 4.2, 2.6, 0, 0, TAU); g.fill();   // Füße/Beine
    g.fillStyle = shade(coat, -18); g.beginPath(); g.ellipse(-1.5, 0, 5.4, 8.6, 0, 0, TAU); g.fill();                                      // Schultern/Mantel
    g.fillStyle = coat; g.beginPath(); g.ellipse(-1.5, 0, 4.4, 7.4, 0, 0, TAU); g.fill();
    g.fillStyle = shade(coat, -28); g.beginPath(); g.ellipse(2.5, 6.8, 3, 1.9, 0.3, 0, TAU); g.ellipse(2.5, -6.8, 3, 1.9, -0.3, 0, TAU); g.fill(); // Arme
    g.fillStyle = '#e6c3a0'; g.beginPath(); g.arc(1.2, 0, 3.7, 0, TAU); g.fill();                                                        // Kopf
    g.fillStyle = '#151824'; g.beginPath(); g.arc(0.4, 0, 3.4, Math.PI * 0.55, Math.PI * 1.45); g.fill();                                  // Haar
    g.strokeStyle = '#3fe8ff'; g.lineWidth = 1; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(-6, -4.5); g.lineTo(-6, 4.5); g.stroke(); g.globalAlpha = 1;   // Neon-Kante am Rücken
  });
}

function drawImg(img, x, y, ang, alpha = 1, scale = 1) {
  ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang); if (scale !== 1) ctx.scale(scale, scale);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
}
