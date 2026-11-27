'use strict';
// 03b-vehicle-art.js - Prozedurale Fahrzeug-Grafik (PLAN R11): hart cyberpunkig, retro-futuristisch (Wedge-Karosserien, Chrom-Verlauf,
// Neon-Kanten, Sonnenuntergangs-Streifen, Leuchtleisten). Jedes Fahrzeug = zwei Sprites mit Blick nach +x:
//   body  - Lack/Metall/Glas, wird VOR der Lightmap gezeichnet (nachts vom Licht der Stadt getroffen)
//   glow  - Neon, Scheinwerfer, Rücklichter, Unterboden: additiv NACH der Lightmap, leuchtet im Dunkeln
// Wird in MS3 durch die gebackenen 3D-Modelle ersetzt (Lackmaske), Fallback bleibt (R11). Exportiert: vehicleArt, riderSprite

const VA = 2;                                                   // Sprite-Auflösung (Pixel je Welt-px), für den Zoom 1.35
function vP(g, pts, fill, stroke, lw = 1.2) {
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
const vSym = half => half.concat(half.slice().reverse().map(([x, y]) => [x, -y]));      // obere Hälfte (y<0) spiegeln -> Umriss
function vMetal(g, w, base) {                                   // Querverlauf: Kanten dunkel, Mitte hell (drehinvariant)
  const gr = g.createLinearGradient(0, -w, 0, w);
  gr.addColorStop(0, shade(base, -45)); gr.addColorStop(0.3, shade(base, 5)); gr.addColorStop(0.5, shade(base, 28)); gr.addColorStop(0.7, shade(base, 5)); gr.addColorStop(1, shade(base, -45));
  return gr;
}
function vGlass(g, pts) {                                       // dunkle Scheibe mit Cyan-Reflexen
  vP(g, pts, '#06080f', 'rgba(120,200,255,0.35)', 0.8);
  g.save(); g.clip(); g.fillStyle = 'rgba(80,190,255,0.22)';
  const xs = pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x0 + (x1 - x0) * (0.2 + k * 0.35), -40); g.lineTo(x0 + (x1 - x0) * (0.3 + k * 0.35), -40); g.lineTo(x0 + (x1 - x0) * (0.1 + k * 0.35), 40); g.lineTo(x0 + (x1 - x0) * (0.0 + k * 0.35), 40); g.fill(); }
  g.restore();
}
function vNeon(e, pts, color, lw = 1.1, close = false) {        // Leuchtlinie: weicher Hof + heller Kern
  for (const [a, k] of [[0.28, 3.2], [1, 1]]) {
    e.globalAlpha = a; e.strokeStyle = a < 1 ? color : '#ffffff'; e.lineWidth = lw * k; e.lineCap = 'round'; e.lineJoin = 'round';
    e.beginPath(); pts.forEach(([x, y], i) => i ? e.lineTo(x, y) : e.moveTo(x, y)); if (close) e.closePath(); e.stroke();
    if (a === 1) { e.globalAlpha = 0.85; e.strokeStyle = color; e.lineWidth = lw; e.beginPath(); pts.forEach(([x, y], i) => i ? e.lineTo(x, y) : e.moveTo(x, y)); if (close) e.closePath(); e.stroke(); }
  }
  e.globalAlpha = 1;
}
function vBlob(e, x, y, rx, ry, color, a = 1) { e.globalAlpha = a; e.fillStyle = color; e.beginPath(); e.ellipse(x, y, rx, ry, 0, 0, TAU); e.fill(); e.globalAlpha = 1; }
function vLights(e, h, w, o = {}) {                             // Scheinwerferschlitze vorn, Rückleuchtenband hinten (Emitter laut WORLD.md §5)
  const hy = w * (o.hy || 0.62);
  for (const s of [-1, 1]) { vNeon(e, [[h * 0.9, s * hy], [h * 0.99, s * hy * 0.8]], o.head || '#dff6ff', 1.6); vBlob(e, h * 0.95, s * hy * 0.9, 2.4, 1.6, '#ffffff', 0.9); }
  vNeon(e, [[-h * 0.97, -w * (o.ty || 0.7)], [-h * 0.97, w * (o.ty || 0.7)]], o.tail || '#ff2a3a', 1.8);
}

const VEHICLE_ART = {
  // Limousine: Keil mit Chrom-Mittelrippe, rosa Neon-Schweller
  limo(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.74], [-h * 0.92, -w], [h * 0.42, -w], [h * 0.8, -w * 0.72], [h, -w * 0.3]]), vMetal(g, w, paint), '#0a0c12', 1.4);
    vP(g, vSym([[-h * 0.55, -w * 0.62], [h * 0.12, -w * 0.62], [h * 0.4, -w * 0.4], [h * 0.4, -w * 0.4]]), '#0b0e16');                    // Dachfläche
    vGlass(g, vSym([[h * 0.12, -w * 0.58], [h * 0.42, -w * 0.4]]).slice(0, 4));                                                            // Frontscheibe
    vGlass(g, vSym([[-h * 0.72, -w * 0.5], [-h * 0.55, -w * 0.58]]).slice(0, 4));                                                          // Heckscheibe
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(h * 0.45, -1, h * 0.4, 2);                                                           // Chrom-Rippe
    vNeon(e, [[-h * 0.8, -w * 0.99], [h * 0.4, -w * 0.99]], D.glow, 1.2); vNeon(e, [[-h * 0.8, w * 0.99], [h * 0.4, w * 0.99]], D.glow, 1.2);   // Schweller-Neon
    vLights(e, h, w);
  },
  taxi(g, e, h, w, paint, D) {
    VEHICLE_ART.limo(g, e, h, w, paint, D);
    g.fillStyle = '#0c0d10'; for (let i = -3; i < 4; i++) { g.fillRect(-h * 0.5 + i * 7, -w * 0.97, 3.5, 2.2); g.fillRect(-h * 0.5 + i * 7, w * 0.97 - 2.2, 3.5, 2.2); }   // Schachbrett-Streifen
    vP(g, [[-h * 0.22, -w * 0.3], [h * 0.02, -w * 0.3], [h * 0.02, w * 0.3], [-h * 0.22, w * 0.3]], '#1b1d24', '#000', 1);               // Dachschild-Sockel
    vNeon(e, [[-h * 0.2, -w * 0.28], [0, -w * 0.28], [0, w * 0.28], [-h * 0.2, w * 0.28]], '#ffd84a', 1.4, true);
    vBlob(e, -h * 0.1, 0, h * 0.1, w * 0.22, '#ffd84a', 0.5);
  },
  // Kapsel: Pille mit Glaskuppel, Leuchtring
  kapsel(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.5], [-h * 0.8, -w * 0.92], [h * 0.3, -w], [h * 0.85, -w * 0.7], [h, -w * 0.3]]), vMetal(g, w, paint), '#0a0c12', 1.4);
    g.fillStyle = '#05070c'; g.beginPath(); g.ellipse(h * 0.05, 0, h * 0.55, w * 0.7, 0, 0, TAU); g.fill();                                // Kuppel
    g.fillStyle = 'rgba(70,190,255,0.28)'; g.beginPath(); g.ellipse(h * 0.18, -w * 0.2, h * 0.25, w * 0.18, -0.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(190,220,255,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(h * 0.05, 0, h * 0.55, w * 0.7, 0, 0, TAU); g.stroke();
    vNeon(e, [[h * 0.05 + h * 0.55, 0]], D.glow, 1); e.strokeStyle = D.glow; e.globalAlpha = 0.9; e.lineWidth = 1.3; e.beginPath(); e.ellipse(h * 0.05, 0, h * 0.58, w * 0.74, 0, 0, TAU); e.stroke(); e.globalAlpha = 1;
    vLights(e, h, w, { hy: 0.5, ty: 0.55 });
  },
  // Pfeil: flacher Keil, Heckflügel, Sonnenuntergangsstreifen
  pfeil(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.86], [-h * 0.6, -w], [h * 0.2, -w * 0.72], [h, -w * 0.1]]), vMetal(g, w, paint), '#0a0c12', 1.4);
    vP(g, [[-h, -w * 1.08], [-h * 0.78, -w * 1.08], [-h * 0.78, w * 1.08], [-h, w * 1.08]], '#12141c', '#000', 1);                             // Heckflügel
    g.fillStyle = '#0a0c12'; g.fillRect(-h * 0.96, -w * 1.02, 2.5, 4); g.fillRect(-h * 0.96, w * 1.02 - 4, 2.5, 4);
    vGlass(g, vSym([[-h * 0.2, -w * 0.4], [h * 0.12, -w * 0.4], [h * 0.38, -w * 0.12]]));                                                     // Kanzel
    g.fillStyle = '#14161e'; for (let i = 0; i < 3; i++) { g.fillRect(-h * 0.62 + i * 4, -w * 0.9, 2, w * 0.28); g.fillRect(-h * 0.62 + i * 4, w * 0.62, 2, w * 0.28); }   // Lufteinlässe
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(${255},${63 + i * 40},${164 - i * 30},0.7)`; g.fillRect(h * 0.25 + i * 4, -w * 0.12, 2.2, w * 0.24); }   // Sunset-Streifen
    vNeon(e, [[-h * 0.75, -w], [h * 0.15, -w * 0.72]], D.glow, 1.2); vNeon(e, [[-h * 0.75, w], [h * 0.15, w * 0.72]], D.glow, 1.2);
    vNeon(e, [[-h * 0.99, -w * 1.06], [-h * 0.99, w * 1.06]], '#ff2a3a', 2);
    vBlob(e, -h * 0.9, -w * 0.5, 3.2, 2, '#ff9a3a', 0.8); vBlob(e, -h * 0.9, w * 0.5, 3.2, 2, '#ff9a3a', 0.8);                                // Turbinenglut
    vLights(e, h, w, { hy: 0.35, ty: 0.01 });
  },
  // Gleiter: flacher Schwebewagen mit Seitengondeln und Unterbodenring
  gleiter(g, e, h, w, paint, D) {
    for (const s of [-1, 1]) vP(g, [[-h * 0.85, s * w * 0.62], [h * 0.3, s * w * 0.7], [h * 0.55, s * w * 0.92], [h * 0.3, s * w], [-h * 0.8, s * w]].map(([x, y]) => [x, y]), vMetal(g, w, shade(paint, -15)), '#0a0c12', 1.2);   // Gondeln
    vP(g, vSym([[-h, -w * 0.4], [-h * 0.6, -w * 0.62], [h * 0.4, -w * 0.5], [h, -w * 0.12]]), vMetal(g, w, paint), '#0a0c12', 1.4);
    vGlass(g, vSym([[-h * 0.1, -w * 0.3], [h * 0.3, -w * 0.28], [h * 0.52, -w * 0.08]]));
    g.fillStyle = '#10131b'; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.fillRect(-h * 0.7 + i * 5, s * w * 0.8 - 1.5, 3, 3);
    e.strokeStyle = D.glow; e.lineWidth = 3; e.globalAlpha = 0.28; e.beginPath(); e.ellipse(0, 0, h * 0.92, w * 1.05, 0, 0, TAU); e.stroke();   // Unterboden-Ring
    e.globalAlpha = 0.85; e.lineWidth = 1.1; e.beginPath(); e.ellipse(0, 0, h * 0.92, w * 1.05, 0, 0, TAU); e.stroke(); e.globalAlpha = 1;
    for (const s of [-1, 1]) { vNeon(e, [[-h * 0.82, s * w * 0.84], [h * 0.4, s * w * 0.92]], '#ffffff', 0.8); vBlob(e, -h * 0.9, s * w * 0.8, 4, 3, D.glow, 0.9); }
    vLights(e, h, w, { hy: 0.3, ty: 0.4 });
  },
  // Pritsche: Kabine vorn, offene Ladefläche mit Kisten
  pritsche(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.92], [-h * 0.94, -w], [h * 0.9, -w], [h, -w * 0.5]]), vMetal(g, w, shade(paint, -10)), '#0a0c12', 1.4);
    vP(g, vSym([[h * 0.05, -w * 0.9], [h * 0.52, -w * 0.84], [h * 0.82, -w * 0.62]]), vMetal(g, w, paint), '#0a0c12', 1);                         // Kabine
    vGlass(g, vSym([[h * 0.3, -w * 0.62], [h * 0.52, -w * 0.58], [h * 0.64, -w * 0.4]]));
    vP(g, [[-h * 0.92, -w * 0.82], [-h * 0.04, -w * 0.82], [-h * 0.04, w * 0.82], [-h * 0.92, w * 0.82]], '#0d0f15', '#2a2e3a', 1.2);              // Ladefläche
    for (const [x, y, a, b2] of [[-0.8, -0.5, 0.3, 0.45], [-0.45, 0.1, 0.28, 0.5], [-0.75, 0.25, 0.22, 0.4]]) { g.fillStyle = '#2b2f3a'; g.fillRect(h * x, w * y, h * a, w * b2); g.strokeStyle = 'rgba(255,154,58,0.6)'; g.strokeRect(h * x, w * y, h * a, w * b2); }
    vNeon(e, [[-h * 0.92, -w * 0.84], [-h * 0.04, -w * 0.84]], D.glow, 1); vNeon(e, [[-h * 0.92, w * 0.84], [-h * 0.04, w * 0.84]], D.glow, 1);
    vLights(e, h, w);
  },
  // Kastenwagen: Quader mit Dach-Aggregaten und Leuchtband
  kasten(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.9], [-h * 0.95, -w], [h * 0.55, -w], [h * 0.92, -w * 0.62], [h, -w * 0.3]]), vMetal(g, w, paint), '#0a0c12', 1.4);
    vGlass(g, vSym([[h * 0.58, -w * 0.62], [h * 0.76, -w * 0.5], [h * 0.84, -w * 0.3]]));
    for (let i = 0; i < 3; i++) { g.fillStyle = '#1b1e27'; g.fillRect(-h * 0.8 + i * h * 0.34, -w * 0.5, h * 0.2, w * 0.35); g.fillStyle = '#0a0b10'; g.beginPath(); g.arc(-h * 0.7 + i * h * 0.34, -w * 0.32, 3.2, 0, TAU); g.fill(); }  // Dachaggregate
    g.fillStyle = shade(paint, -55); g.fillRect(-h * 0.85, w * 0.1, h * 1.35, w * 0.32);                                                         // Dachband
    vNeon(e, [[-h * 0.85, w * 0.26], [h * 0.5, w * 0.26]], D.glow, 1.4);
    vNeon(e, [[-h * 0.95, -w * 0.99], [h * 0.5, -w * 0.99]], '#3fe8ff', 0.9);
    vLights(e, h, w);
  },
  // Laster: Zugmaschine + Container (Rippen, Neon-Logo-Balken), Gelenk
  laster(g, e, h, w, paint, D) {
    vP(g, vSym([[h * 0.42, -w * 0.9], [h * 0.82, -w * 0.84], [h, -w * 0.55]]), vMetal(g, w, '#3a3f4c'), '#0a0c12', 1.4);                         // Kabine
    vGlass(g, vSym([[h * 0.66, -w * 0.62], [h * 0.82, -w * 0.52], [h * 0.9, -w * 0.34]]));
    vP(g, [[-h, -w * 0.98], [h * 0.36, -w * 0.98], [h * 0.36, w * 0.98], [-h, w * 0.98]], shade(paint === '#d8d2c4' ? '#3a6ea5' : paint, -25), '#0a0c12', 1.4);   // Container
    g.fillStyle = 'rgba(0,0,0,0.38)'; for (let x = -h + 4; x < h * 0.34; x += 6) g.fillRect(x, -w * 0.96, 2, w * 1.92);                           // Rippen
    g.fillStyle = '#0c0d12'; g.fillRect(h * 0.36, -w * 0.3, h * 0.08, w * 0.6);                                                                  // Sattelplatte/Gelenk
    vNeon(e, [[-h * 0.9, -w * 0.5], [-h * 0.3, -w * 0.5]], D.glow, 2.2); vNeon(e, [[-h * 0.9, w * 0.5], [-h * 0.5, w * 0.5]], '#3fe8ff', 2.2);       // Logo-Balken
    vNeon(e, [[-h * 0.99, -w * 0.9], [-h * 0.99, w * 0.9]], '#ff2a3a', 2);
    for (let i = 0; i < 6; i++) vBlob(e, -h * 0.9 + i * h * 0.26, -w * 0.99, 1.4, 1, '#ff9a3a', 0.9);                                              // Positionslichter
    vLights(e, h, w, { hy: 0.5, ty: 0.8 });
  },
  // Kurier-Bike: Lichtrad mit Neon-Felgen und geduckter Silhouette (Fahrer eingebaut)
  bike(g, e, h, w, paint, D) {
    for (const x of [-h * 0.6, h * 0.62]) { g.fillStyle = '#05060a'; g.beginPath(); g.ellipse(x, 0, h * 0.36, w * 0.62, 0, 0, TAU); g.fill(); e.strokeStyle = D.glow; e.lineWidth = 1.8; e.globalAlpha = 0.95; e.beginPath(); e.ellipse(x, 0, h * 0.34, w * 0.58, 0, 0, TAU); e.stroke(); e.globalAlpha = 0.25; e.lineWidth = 5; e.stroke(); e.globalAlpha = 1; }
    vP(g, vSym([[-h * 0.5, -w * 0.26], [h * 0.3, -w * 0.3], [h * 0.52, -w * 0.12]]), vMetal(g, w, paint), '#0a0c12', 1.2);                           // Rumpf
    g.fillStyle = '#141824'; g.beginPath(); g.ellipse(-h * 0.1, 0, h * 0.3, w * 0.52, 0, 0, TAU); g.fill();                                      // Fahrer
    g.fillStyle = '#d6dbe6'; g.beginPath(); g.arc(h * 0.12, 0, w * 0.3, 0, TAU); g.fill(); g.fillStyle = '#06080f'; g.fillRect(h * 0.14, -w * 0.22, w * 0.22, w * 0.44);   // Helm + Visier
    vNeon(e, [[h * 0.2, -w * 0.18], [h * 0.2, w * 0.18]], '#3fe8ff', 1.2);
    vLights(e, h * 1.02, w, { hy: 0.1, ty: 0.12 });
  },
  // Hoverboard: Deck mit Neon-Kante, Schubdüsen hinten, Unterboden-Glow (Fahrer wird dynamisch gezeichnet)
  board(g, e, h, w, paint, D) {
    vP(g, vSym([[-h, -w * 0.5], [-h * 0.8, -w * 0.9], [h * 0.7, -w * 0.9], [h, -w * 0.4]]), vMetal(g, w, '#1c202b'), '#05060a', 1.4);
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let x = -h * 0.6; x < h * 0.6; x += 4) g.fillRect(x, -w * 0.5, 1, w);                           // Griffband
    for (const s of [-1, 1]) { g.fillStyle = '#0a0c12'; g.fillRect(-h * 1.0, s * w * 0.55 - 2.5, 6, 5); vBlob(e, -h * 1.04, s * w * 0.55, 4.5, 3, '#9fe8ff', 0.95); }
    vNeon(e, [[-h * 0.8, -w * 0.9], [h * 0.7, -w * 0.9], [h, -w * 0.4], [h, w * 0.4], [h * 0.7, w * 0.9], [-h * 0.8, w * 0.9], [-h, w * 0.5], [-h, -w * 0.5]], D.glow, 1.4, true);
    e.globalAlpha = 0.3; e.fillStyle = D.glow; e.beginPath(); e.ellipse(0, 0, h * 1.2, w * 1.25, 0, 0, TAU); e.fill(); e.globalAlpha = 1;
  }
};

// OD-Fahrzeuge: Grundkörper der Zivilklasse (art), weißer Lack mit blauem Streifen, Dach-Lichtbalken (Blaulicht blinkt im Glow-Pass)
function odDecor(g, e, h, w, D) {
  g.fillStyle = '#2a6bff'; g.fillRect(-h * 0.9, -w * 0.12, h * 1.7, w * 0.24);                                    // blauer Streifen längs
  g.fillStyle = '#10141c'; g.fillRect(-h * 0.2, -w * 0.62, 7, w * 1.24); g.fillStyle = '#2a6bff'; g.fillRect(-h * 0.2 + 1, -w * 0.58, 5, w * 0.54); g.fillStyle = '#ff2a3a'; g.fillRect(-h * 0.2 + 1, w * 0.04, 5, w * 0.54);   // Lichtbalken
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '900 5px sans-serif'; g.fillText('OD', h * 0.3, w * 0.45);
}
for (const k of ['od_streife', 'od_abfang', 'od_sturm']) VEHICLE_ART[k] = (g, e, h, w, paint, D) => { VEHICLE_ART[D.art](g, e, h, w, '#d8dde6', D); odDecor(g, e, h, w, D); };
const VART = new Map();
// { body, glow } für Klasse + Lack. paint: Hex
function vehicleArt(cls, paint) {
  const key = cls + '|' + paint; let a = VART.get(key); if (a) return a;
  const D = VEHICLES[cls], pad = 14, W = (D.L + pad * 2) * VA, H = (D.B + pad * 2) * VA;
  const body = mkCanvas(W, H), glow = mkCanvas(W, H), g = body.getContext('2d'), e = glow.getContext('2d');
  for (const c of [g, e]) { c.translate(W / 2, H / 2); c.scale(VA, VA); }
  withSeed(hash3(cls.length, paint.length, 5), () => VEHICLE_ART[cls](g, e, D.L / 2, D.B / 2, paint, D));
  a = { body, glow, w: W / VA, h: H / VA }; VART.set(key, a); return a;
}
// Fahrer auf Bike/Board: geduckte Person von oben (Hoverboard: steht quer, Arme seitlich)
function riderSprite(board) {
  return sprite('rider|' + board, 36, 36, g => {
    g.fillStyle = '#10131c'; g.beginPath(); g.ellipse(0, 0, 4.2, 8.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#1d4458'; g.beginPath(); g.ellipse(-0.5, 0, 3.6, 7.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#0c0f16'; g.beginPath(); g.ellipse(2.5, 7.8, 2.8, 1.8, 0.4, 0, TAU); g.ellipse(2.5, -7.8, 2.8, 1.8, -0.4, 0, TAU); g.fill();
    g.fillStyle = '#d9dde8'; g.beginPath(); g.arc(1.2, 0, 3.3, 0, TAU); g.fill(); g.fillStyle = '#ff3fa4'; g.fillRect(2.2, -2.4, 1.8, 4.8);   // Helm, Visier
  });
}
