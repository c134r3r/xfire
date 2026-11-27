'use strict';
// 10-combat.js - Partikel und Explosionen (1:1 aus Ironclad: der Ironclad-Look), Mündungsfeuer, schwebende Texte, Brandflecken.
// Waffen, Projektile, Pickups folgen in MS7. Exportiert: part, glow, light, smoke, sparks, addTrauma, explosion, muzzleFlash, floatText, updateParticles, THIN

const THIN = { spark: 1, ember: 1, smoke: 1 };
function part(o) {
  if (G.quality < 1 && THIN[o.kind] && R.fn() > G.quality) return;
  if (G.parts.length >= C.PARTICLES_MAX) {
    if (o.kind === 'spark' || o.kind === 'ember') return;
    G.parts.splice(0, 40);
  }
  o.life = o.max = o.life || 30;
  G.parts.push(o);
  return o;
}
function glow(x, y, size, color, life, vx = 0, vy = 0, grow = 0, drag = 0.92) { return part({ kind: 'glow', x, y, vx, vy, size, color, life, grow, drag }); }
function light(x, y, size, color, life) { return part({ kind: 'light', x, y, vx: 0, vy: 0, size, color, life, grow: 0, drag: 1 }); }
function smoke(x, y, size, variant, life, vx = 0, vy = 0, grow = 0.6) { return part({ kind: 'smoke', x, y, vx, vy, size, variant, life, grow, drag: 0.96, rot: rand(0, TAU), vr: rand(-0.02, 0.02) }); }
function sparks(x, y, n, color, speed = 8, ang = null, spreadA = Math.PI) {
  for (let i = 0; i < n; i++) {
    const a = ang === null ? rand(0, TAU) : ang + rand(-spreadA, spreadA), s = speed * rand(0.35, 1);
    part({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rand(1, 2.2), color, life: randi(10, 22), drag: 0.88 });
  }
}
function addTrauma(t) { G.trauma = Math.min(1, G.trauma + t * Settings.d.shake); }
function screenFalloff(x, y) { const p = G.player; return p ? clamp(1.2 - Math.hypot(x - p.x, y - p.y) / 900, 0.15, 1) : 1; }

// Die große: geschichtete Explosion. size ~0.5 (Granate) .. 4 (Boss)
function explosion(x, y, size, opts = {}) {
  const s = size, hot = opts.color || '#ff8a2a';
  glow(x, y, 52 * s, '#fff1c0', 6);                                                   // Blitz
  light(x, y, 150 * Math.sqrt(s), '#ff8a30', 14 + 4 * s);                              // Lichtpfütze (Lightmap)
  const nf = Math.round(4 + 4 * s);                                                    // Feuerball: wogende additive Blasen
  for (let i = 0; i < nf; i++) {
    const a = rand(0, TAU), v = rand(0.4, 2.6) * Math.sqrt(s);
    glow(x + rand(-8, 8) * s, y + rand(-8, 8) * s, rand(16, 28) * Math.sqrt(s), i % 3 ? hot : '#ffd25a', randi(14, 24) + 3 * s, Math.cos(a) * v, Math.sin(a) * v, 0.35 * Math.sqrt(s), 0.9);
  }
  part({ kind: 'ring', x, y, vx: 0, vy: 0, size: 26 * s + 30, color: 'rgba(255,230,180,1)', life: 16 + 2 * s, drag: 1 });   // Druckwelle
  sparks(x, y, Math.round(10 + 14 * s), '#ffd27a', 9 + 3 * s);
  const nd = Math.round(3 + 4 * s);                                                    // brennende Trümmer
  for (let i = 0; i < nd; i++) {
    const a = rand(0, TAU), v = rand(2, 6) * Math.sqrt(s);
    part({ kind: 'debris', x, y, z: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(3, 7) * Math.sqrt(s), size: rand(2, 5) * Math.min(1.6, s), life: randi(50, 90),
      rot: rand(0, TAU), vr: rand(-0.3, 0.3), color: pick(['#2a2a33', '#3a3a46', '#16161c']), burning: R.fn() < 0.6, drag: 0.985 });
  }
  const ns = Math.round(3 + 3 * s);                                                    // Rauchsäule
  for (let i = 0; i < ns; i++) {
    const a = rand(0, TAU), v = rand(0.2, 1.2) * Math.sqrt(s);
    smoke(x + rand(-10, 10) * s, y + rand(-10, 10) * s, rand(16, 28) * Math.sqrt(s), i % 3 ? 'dark' : 'grey', randi(50, 85) + 8 * s, Math.cos(a) * v, Math.sin(a) * v - 0.25, 0.28 + 0.08 * s);
  }
  for (let i = 0; i < 4 + 4 * s; i++) part({ kind: 'ember', x: x + rand(-14, 14) * s, y: y + rand(-14, 14) * s, vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.3), size: rand(1.5, 3), color: '#ffb040', life: randi(40, 90), drag: 0.98 });
  if (opts.scorch !== false) stampScorch(x, y, 0.22 + 0.16 * s);
  addTrauma(Math.min(0.85, 0.1 + 0.12 * s) * (opts.shake === undefined ? 1 : opts.shake) * screenFalloff(x, y));
  if (s >= 1.6) G.zoomPunch = Math.max(G.zoomPunch, 0.012 * s);
  Aud.explosion(s, x, y);
}
// Brandflecken werden in die Boden-Chunks gestempelt (PLAN §4.5).
function stampScorch(x, y, scale) {
  Ground.decal({ x, y, rot: rand(0, TAU), s: scale, v: randi(0, 2) });
}
function muzzleFlash(x, y, ang, s = 1, color = '#ffd27a') {
  glow(x, y, 22 * s, color, 4); glow(x + Math.cos(ang) * 10 * s, y + Math.sin(ang) * 10 * s, 14 * s, color, 3);
  light(x, y, 60 * s, '#ffb050', 4); sparks(x, y, 3, color, 6, ang, 0.35);
}
function floatText(x, y, text, color, size = 14) {
  if (G.texts.length > 50) G.texts.shift();
  G.texts.push({ x, y, text, color, size, life: 60, max: 60 });
}

function updateParticles() {
  const ps = G.parts; let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (--p.life <= 0) continue;
    p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy *= p.drag;
    if (p.kind === 'debris') {
      p.vz -= 0.32; p.z += p.vz; p.rot += p.vr;
      if (p.z <= 0) {
        p.z = 0;
        if (Math.abs(p.vz) > 1.2) { p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; p.vr *= 0.8; }
      }
      if (p.burning && p.z > 2 && p.life % 5 === 0) smoke(p.x, p.y - p.z, 6, 'dark', 30, 0, -0.2, 0.3);
    } else if (p.kind === 'smoke') p.rot += p.vr;
    ps[w++] = p;
  }
  ps.length = w;
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.y -= 0.7; if (--t.life <= 0) G.texts.splice(i, 1); }
}
