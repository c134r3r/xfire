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
  blast(x, y, 110 * Math.sqrt(s), 70 * s); Bus.emit('boom', x, y, s);
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

// ------------------------------------------------------------------
// Kampf (MS7-Einstieg): Fäuste (immer), Pistole (kaufbar), Geschosse, Drive-by, Waffenwechsel. Feuern = Maus links, J, Touch-Knopf/rechter Stick.
// Ohne Waffe boxt der Held: Jab, Jab, Haken (dritter Schlag kräftiger). Passanten gehen k.o. statt zu sterben; Kugeln töten.
// Exportiert: updateCombat, setWeapon, drawBullets, punch, shoot
// ------------------------------------------------------------------
function setWeapon(id) {
  if (!G.own[id] || G.weapon === id) return; G.weapon = id; if (G.player) { G.player.cd = 8; }
  Aud.play('klick', { gain: 0.6, cat: 'ui', bus: 'ui' }); HUD.weaponFlash();
}
function updateCombat() {
  const p = G.player, i = G.in; if (!p || G.state !== 'play') return;
  if (p.cd > 0) p.cd--; if (p.punchT > 0) p.punchT--; if (p.recoil > 0) p.recoil--;
  if (i.weaponSlot === 1) setWeapon('faust'); else if (i.weaponSlot === 2) setWeapon('pistole');
  if (i.swapP || i.weaponNextP || i.weaponPrevP) setWeapon(G.weapon === 'faust' ? 'pistole' : 'faust');
  if (i.fire && p.cd <= 0 && !G.mapOpen) { if (WEAPONS[G.weapon].melee) punch(p); else shoot(p); }
  updateBullets();
}
// Faustschlag: Kegel vor dem Helden. Treffer: Rückstoß, Treffer-Laut aus den Aufnahmen, Comic-Wort. Dritter Schlag (Haken) = mehr Schaden.
function punch(p) {
  const w = WEAPONS.faust;
  if (p.veh) { p.cd = 30; floatText(p.x, p.y - 20, 'Fahr lieber.', '#8a93a6', 11); return; }
  p.cd = w.cd; p.combo = G.time - (p.lastPunch || -99) < 28 ? ((p.combo || 0) + 1) % 3 : 0; p.lastPunch = G.time; p.punchSide = p.combo % 2 ? -1 : 1; p.punchT = 9; p.punchHook = p.combo === 2;
  const dx = Math.cos(p.a), dy = Math.sin(p.a); p.vx += dx * 1.4; p.vy += dy * 1.4;                           // kleiner Ausfallschritt
  Aud.play('schlag', { x: p.x, y: p.y, gain: 0.7, cat: 'sfx' });
  let hits = 0;
  for (const q of G.peds) {
    if (q.state === 'dead' || q.npc && false) continue; const rx = q.x - p.x, ry = q.y - p.y, d = Math.hypot(rx, ry);
    if (d > w.range + q.r || d < 0.01 || Math.abs(angDiff(p.a, Math.atan2(ry, rx))) > w.arc / 2 + (d < 16 ? 1 : 0)) continue;
    damagePed(q, p.combo === 2 ? 12 : w.dmg, rx / d, ry / d, 'fist'); hits++; if (hits >= 2) break;
  }
  if (!hits) for (const I of Interiors.cur ? [Interiors.cur] : []) for (const n of I.people || []) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < w.range + 8 && Math.abs(angDiff(p.a, Math.atan2(n.y - p.y, n.x - p.x))) < 0.7) { Aud.play('faustschlag', { x: n.x, y: n.y, gain: 0.9, cat: 'sfx' }); bark(n, 'Hey! Hier drin wird nicht geboxt! Nur gegessen.', 180); G.shake = 1; hits++; break; } }
  if (hits) { G.freeze = Math.max(G.freeze, p.combo === 2 ? 4 : 2); addTrauma(p.combo === 2 ? 0.2 : 0.1); const fx = p.x + dx * 26, fy = p.y + dy * 26; glow(fx, fy, 14, '#fff1c0', 5); sparks(fx, fy, 4, '#ffd27a', 4, p.a, 0.8); floatText(fx, fy - 12, p.combo === 2 ? 'WUMM!' : COMIC[Math.floor(R.fn() * COMIC.length)], '#ffe48a', 12); }
}
function shoot(p) {
  const w = WEAPONS.pistole;
  if (G.ammo.pistole <= 0) { p.cd = 22; Aud.play('klick', { x: p.x, y: p.y, gain: 0.8, cat: 'sfx' }); floatText(p.x, p.y - 20, 'KEINE MUNITION', '#ff3b4a', 11); return; }
  G.ammo.pistole--; p.cd = w.cd; p.recoil = 5;
  const sp = w.spread * (p.veh ? 1.6 : 1), a = p.a + (R.fn() - 0.5) * 2 * sp, c = Math.cos(p.a), s = Math.sin(p.a), ox = p.x + c * 16 - s * 4, oy = p.y + s * 16 + c * 4;
  G.bullets.push({ x: ox, y: oy, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: Math.round(w.range / w.speed), dmg: w.dmg });
  muzzleFlash(ox, oy, p.a, 1); addTrauma(0.05);
  part({ kind: 'debris', x: p.x + c * 6 - s * 8, y: p.y + s * 6 + c * 8, z: 6, vx: -s * 1.6 + rand(-0.3, 0.3), vy: c * 1.6 + rand(-0.3, 0.3), vz: rand(2, 3.5), size: 1.4, life: 40, rot: 0, vr: 0.4, color: '#c9a227', burning: false, drag: 0.97 });   // Hülse
  Aud.play('pistole', { x: p.x, y: p.y, gain: 1, cat: 'schuss' }); Bus.emit('gunshot', p.x, p.y);
}
function updateBullets() {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i]; let dead = --b.life <= 0;
    for (let k = 0; k < 2 && !dead; k++) {
      b.x += b.vx / 2; b.y += b.vy / 2;
      if (World.blocked(b.x, b.y, 1)) { sparks(b.x, b.y, 4, '#ffd27a', 3, Math.atan2(-b.vy, -b.vx), 0.9); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; }
      for (const q of G.peds) { if (q.state === 'dead' || Math.abs(q.x - b.x) > 11 || Math.abs(q.y - b.y) > 11) continue;
        if (Math.hypot(q.x - b.x, q.y - b.y) < (q.state === 'down' ? 6 : 9)) { const m = Math.hypot(b.vx, b.vy); damagePed(q, b.dmg, b.vx / m, b.vy / m, 'bullet'); dead = true; break; } }
      if (dead) break;
      for (const d of G.drones) if (Math.hypot(d.x - b.x, d.y - b.y) < 12) { d.hp -= b.dmg; sparks(b.x, b.y, 4, '#9fd0ff', 3); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; }
      if (dead) break;
      for (const v of G.vehicles) { if (Math.abs(v.x - b.x) > 90 || Math.abs(v.y - b.y) > 90 || (v.driver === G.player)) continue; if (vehDist(v, b.x, b.y) < 2) { damageVeh(v, b.dmg * 0.4, 'bullet'); sparks(b.x, b.y, 4, '#ffd27a', 3, Math.atan2(-b.vy, -b.vx), 0.9); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; } }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}
function drawBullets() {                                                       // Leuchtspur (additiv)
  ctx.lineCap = 'round';
  for (const b of G.bullets) {
    if (!onScreen(b.x, b.y, 40)) continue; ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ffe8a0'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 1.8, b.y - b.vy * 1.8); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.drawImage(glowSprite('#ffd27a'), b.x - 5, b.y - 5, 10, 10);
  }
  ctx.globalAlpha = 1;
}
