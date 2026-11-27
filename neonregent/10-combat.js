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
function giveWeapon(id, n) { const w = WEAPONS[id]; if (!w) return; G.own[id] = true; if (!w.melee) G.ammo[id] = Math.min(w.max, (G.ammo[id] || 0) + (n === undefined ? w.pack : n)); }
function setWeapon(id) {
  if (!G.own[id] || G.weapon === id) return; G.weapon = id; if (G.player) { G.player.cd = 8; }
  Aud.play('klick', { gain: 0.6, cat: 'ui', bus: 'ui' }); HUD.weaponFlash();
}
function cycleWeapon(dir) { const own = WEAPON_ORDER.filter(k => G.own[k]); if (own.length < 2) return; setWeapon(own[(own.indexOf(G.weapon) + dir + own.length) % own.length]); }
function updateCombat() {
  const p = G.player, i = G.in; if (!p || G.state !== 'play') return;
  if (p.cd > 0) p.cd--; if (p.punchT > 0) p.punchT--; if (p.recoil > 0) p.recoil--;
  if (i.weaponSlot) { const k = WEAPON_ORDER.find(k => WEAPONS[k].slot === i.weaponSlot); if (k) setWeapon(k); }
  if (i.swapP || i.weaponNextP) cycleWeapon(1); else if (i.weaponPrevP) cycleWeapon(-1);
  const W = WEAPONS[G.weapon];
  if (i.fire && p.cd <= 0 && !G.mapOpen && !G.respawn) { if (W.melee) punch(p); else if (p.veh && !W.drive) { p.cd = 20; floatText(p.x, p.y - 20, 'Nicht aus dem Auto.', '#8a93a6', 11); } else shoot(p); }
  updatePowerups(); updateBullets(); updateGrenades(); updateProps(); updateAllyDrones();
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
function fireSound(id, p, o = {}) { Aud.play('pistole', Object.assign({ x: p.x, y: p.y, gain: 1, cat: 'schuss' }, o)); }
function shoot(p) {
  const id = G.weapon, w = WEAPONS[id], pu = G.pu;
  if ((G.ammo[id] || 0) <= 0) { p.cd = 22; Aud.play('klick', { x: p.x, y: p.y, gain: 0.8, cat: 'sfx' }); floatText(p.x, p.y - 20, 'KEINE MUNITION', '#ff3b4a', 11); return; }
  G.ammo[id]--; p.cd = Math.max(1, Math.round(w.cd * (pu.rapid > 0 ? 0.5 : 1))); p.recoil = 5;
  const c = Math.cos(p.a), s = Math.sin(p.a), ox = p.x + c * 16 - s * 4, oy = p.y + s * 16 + c * 4, sp = w.spread * (p.veh ? 1.5 : 1);
  if (id === 'flamer') { flameTick(p, ox, oy); return; }
  if (id === 'emp') { G.grenades.push({ x: ox, y: oy, a: p.a, t: 0, T: 36, d: Math.min(w.range, Math.hypot((G.in.mx || 0) - 0, 0) || w.range) }); Aud.play('klick', { x: p.x, y: p.y, gain: 1, cat: 'sfx', rate: 0.7 }); return; }
  if (id === 'rocket') { G.bullets.push({ x: ox, y: oy, vx: c * w.speed, vy: s * w.speed, life: Math.round(w.range / w.speed), dmg: w.dmg, rocket: true });
    Aud.play('pistole', { x: p.x, y: p.y, gain: 1.1, cat: 'schuss', rate: 0.38 }); addTrauma(0.2); muzzleFlash(ox, oy, p.a, 1.6, '#ffb060'); smoke(p.x - c * 10, p.y - s * 10, 10, 'light', 30); Bus.emit('gunshot', p.x, p.y); return; }
  const n = w.pellets || 1;
  for (let k = 0; k < n; k++) { const a = p.a + (R.fn() - 0.5) * 2 * sp; G.bullets.push({ x: ox, y: oy, vx: Math.cos(a) * w.speed * (n > 1 ? 0.85 + R.fn() * 0.3 : 1), vy: Math.sin(a) * w.speed * (n > 1 ? 0.85 + R.fn() * 0.3 : 1), life: Math.round(w.range / w.speed), dmg: w.dmg }); }
  muzzleFlash(ox, oy, p.a, id === 'shotgun' ? 1.5 : 1); addTrauma(id === 'shotgun' ? 0.16 : 0.05);
  if (id !== 'smg' || G.time % 2 === 0) part({ kind: 'debris', x: p.x + c * 6 - s * 8, y: p.y + s * 6 + c * 8, z: 6, vx: -s * 1.6 + rand(-0.3, 0.3), vy: c * 1.6 + rand(-0.3, 0.3), vz: rand(2, 3.5), size: id === 'shotgun' ? 2 : 1.4, life: 40, rot: 0, vr: 0.4, color: id === 'shotgun' ? '#c0392b' : '#c9a227', burning: false, drag: 0.97 });
  fireSound(id, p, id === 'smg' ? { rate: 1.35, gain: 0.8 } : id === 'shotgun' ? { rate: 0.55, gain: 1.25 } : {}); Bus.emit('gunshot', p.x, p.y);
}
// Flammenwerfer: Kegel (140 px). Personen brennen (2 Schaden/Tick-Intervall, 2 s), Fahrzeuge fangen nach 1 s Beschuss Feuer.
function flameTick(p, ox, oy) {
  const w = WEAPONS.flamer, ang = p.a;
  for (let k = 0; k < 2; k++) { const a = ang + rand(-0.14, 0.14), sp = rand(4, 6.5); part({ kind: 'glow', x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(10, 16), color: pick(['#ff8a2a', '#ffd27a', '#ff5a1a']), life: 16, grow: 0.9, drag: 0.93 }); }
  if (G.time % 3 === 0) smoke(ox + Math.cos(ang) * 60, oy + Math.sin(ang) * 60, 8, 'dark', 26, 0, -0.3, 0.5);
  Lights.add(ox + Math.cos(ang) * 50, oy + Math.sin(ang) * 50, 120, '#ff8a2a', 0.8);
  if (G.time % 8 === 0) Aud.play('pistole', { x: p.x, y: p.y, gain: 0.45, cat: 'sfx', rate: 0.22 });
  const inCone = (x, y, r) => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy); return d < w.range + r && d > 0.1 && Math.abs(angDiff(ang, Math.atan2(dy, dx))) < 0.28 + r / Math.max(d, 20); };
  for (const q of G.peds) if (q.state !== 'dead' && inCone(q.x, q.y, 8)) { q.burnT = 120; if (!q.fireSrc) { q.fireSrc = true; Bus.emit('assault', q, 'fire'); } }
  for (const v of G.vehicles) if (!v.dead && v !== p.veh && inCone(v.x, v.y, 20)) { v.flameT = (v.flameT || 0) + 2; damageVeh(v, 0.4, 'fire'); if (v.flameT > 60 && !v.burn) { v.hp = 0; damageVeh(v, 1, 'fire'); } }
  for (const b of G.props) if (!b.dead && inCone(b.x, b.y, 10)) b.hp -= 3;
  for (const d of G.drones) if (inCone(d.x, d.y, 8)) d.hp -= 0.5;
}
// Brennende Personen: Schaden alle 10 Ticks, panisch
function burnPeds() {
  for (const q of G.peds) if (q.burnT > 0) {
    q.burnT--; if (q.state === 'dead') { q.burnT = 0; continue; }
    if (G.time % 8 === 0) { smoke(q.x, q.y - 6, 5, 'dark', 20, 0, -0.4, 0.3); glow(q.x + rand(-3, 3), q.y - rand(2, 8), 8, '#ff8a2a', 10); if (q.state !== 'down') { q.state = 'flee'; q.panic = 200; } hurtPedBurn(q); }
    if (q.burnT === 0) q.fireSrc = false;
  }
}
function hurtPedBurn(q) { q.hp -= 2; if (q.hp <= 0) killPed(q, null); }
function updatePowerups() {
  const pu = G.pu; for (const k in pu) if (pu[k] > 0) pu[k]--;
  burnPeds();
}
// ---- EMP-Granate: Bogenwurf, lähmt Drohnen/Fahrzeuge in 110 px für 4 s (15 Schaden an Drohnen) ----
function updateGrenades() {
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const g = G.grenades[i]; g.t++; const k = g.t / g.T, sp = WEAPONS.emp.range / g.T; g.x += Math.cos(g.a) * sp; g.y += Math.sin(g.a) * sp; g.z = Math.sin(k * Math.PI) * 26;
    if (g.t >= g.T) { G.grenades.splice(i, 1); empBurst(g.x, g.y, 110); }
  }
}
function empBurst(x, y, r) {
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; sparks(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, 2, '#3fe8ff', 3); }
  glow(x, y, r * 1.6, '#3fe8ff', 14, 0, 0, 1.2); Lights.add(x, y, r * 2, '#3fe8ff', 1); addTrauma(0.15); Aud.play('querschlaeger', { x, y, gain: 1, cat: 'sfx', rate: 0.6 });
  for (const d of G.drones) if (Math.hypot(d.x - x, d.y - y) < r) { d.hp -= 15; d.stun = 240; }
  for (const v of G.vehicles) if (!v.dead && Math.hypot(v.x - x, v.y - y) < r && v !== G.player.veh) { v.empT = 240; v.vx *= 0.4; v.vy *= 0.4; v.engine = false; floatText(v.x, v.y - 20, 'SYSTEM AUS', '#3fe8ff', 11); }
  for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead' && Math.hypot(q.x - x, q.y - y) < r) { q.frozen = 120; }
}
// ---- Rote Fässer (Kettenreaktion) ----
function initProps() {
  G.props.length = 0; const rng = mulberry(C.CITY_SEED ^ 0x5bd1);
  let n = 0, tries = 0; while (n < 60 && tries++ < 4000) {
    const tx = 4 + Math.floor(rng() * (World.W - 8)), ty = 4 + Math.floor(rng() * (World.H - 8)); if (World.tiles[ty * World.W + tx] !== TK.SIDEWALK) continue;
    const x = (tx + 0.5) * C.TILE + (rng() - 0.5) * 20, y = (ty + 0.5) * C.TILE + (rng() - 0.5) * 20; if (World.blocked(x, y, 8)) continue;
    G.props.push({ x, y, hp: 24, kind: 'barrel' }); n++; if (rng() < 0.45 && !World.blocked(x + 14, y + 6, 8)) G.props.push({ x: x + 14, y: y + 6, hp: 24, kind: 'barrel' });
  }
}
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function updateProps() {
  for (let i = G.props.length - 1; i >= 0; i--) { const b = G.props[i];
    if (b.hp < 24 && b.hp > 0 && G.time % 6 === 0) smoke(b.x, b.y - 6, 5, 'dark', 24, 0, -0.4, 0.3);
    if (b.hp <= 0 && b.kind !== 'barrel') { b.dead = true; G.props.splice(i, 1); for (let k = 0; k < 14; k++) part({ kind: 'debris', x: b.x, y: b.y, z: 4, vx: rand(-3, 3), vy: rand(-3, 3), vz: rand(2, 5), size: rand(2, 4), life: 60, rot: rand(0, TAU), vr: 0.3, color: pick(['#5a4a2a', '#c9a227', '#7a1620', '#3a3a46']), burning: false, drag: 0.97 }); smoke(b.x, b.y, 12, 'dark', 40); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.9, cat: 'sfx', rate: 0.5 }); addTrauma(0.15); continue; }
    if (b.hp <= 0) { b.dead = true; G.props.splice(i, 1); explosion(b.x, b.y, 1.1); blast(b.x, b.y, 90, 60); Bus.emit('boom', b.x, b.y, 1.1); propBlast(b.x, b.y, 90, 40); } }
}
function propBlast(x, y, r, dmg) {
  for (const q of G.peds) { const d = Math.hypot(q.x - x, q.y - y); if (q.state !== 'dead' && d < r) { hurtPed(q, null, dmg * (1 - d / r) + 6, (q.x - x) / (d + 1), (q.y - y) / (d + 1)); q.burnT = 60; } }
  for (const b of G.props) { const d = Math.hypot(b.x - x, b.y - y); if (d < r && d > 0) b.hp -= 14 + 20 * (1 - d / r); }
  for (const d of G.drones) if (Math.hypot(d.x - x, d.y - y) < r) d.hp -= dmg;
}
function drawProps() {
  for (const b of G.props) { if (!onScreen(b.x, b.y, 40)) continue;
    if (b.kind === 'stand') { ctx.globalAlpha = 0.5; ctx.drawImage(shadowSprite(10, 6), b.x - 22 + 3, b.y - 18 + 6); ctx.globalAlpha = 1; ctx.fillStyle = '#4a3a22'; ctx.fillRect(b.x - 24, b.y - 4, 48, 16); ctx.fillStyle = '#2a2014'; ctx.fillRect(b.x - 24, b.y - 4, 48, 3); for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c42a38' : '#e8d8b0'; ctx.fillRect(b.x - 24 + k * 12, b.y - 16, 12, 12); } ctx.fillStyle = '#3fe8ff'; ctx.fillRect(b.x - 18, b.y + 2, 10, 3); ctx.fillStyle = '#ffd84a'; ctx.fillRect(b.x + 4, b.y + 2, 14, 3); continue; }
    ctx.globalAlpha = 0.5; ctx.drawImage(shadowSprite(6, 4), b.x - 18 + 2, b.y - 16 + 5); ctx.globalAlpha = 1;
    ctx.fillStyle = '#7a1620'; ctx.fillRect(b.x - 6, b.y - 8, 12, 14); ctx.fillStyle = '#c42a38'; ctx.fillRect(b.x - 5, b.y - 9, 10, 4); ctx.fillStyle = '#2a0a10'; ctx.fillRect(b.x - 6, b.y - 3, 12, 1.4); ctx.fillRect(b.x - 6, b.y + 2, 12, 1.4);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(b.x - 2, b.y - 6.5, 4, 1.6); }
}
// ---- Verbündete Kampfdrohnen (Power-up) ----
function updateAllyDrones() {
  const p = G.player, A = G.allyDrones; if (!p) return;
  if (G.pu.drones > 0 && !A.length) for (let k = 0; k < 2; k++) A.push({ x: p.x, y: p.y, a: k * Math.PI, cd: 10 + k * 8 });
  if (G.pu.drones <= 0 && A.length) A.length = 0;
  for (const d of A) { d.a += 0.05; const tx = p.x + Math.cos(d.a) * 40, ty = p.y + Math.sin(d.a) * 40; d.x += (tx - d.x) * 0.15; d.y += (ty - d.y) * 0.15;
    if (--d.cd <= 0) { let best = null, bd = 300; for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead' && q.state !== 'down') { const dd = Math.hypot(q.x - d.x, q.y - d.y); if (dd < bd) { bd = dd; best = q; } } for (const e of G.drones) { const dd = Math.hypot(e.x - d.x, e.y - d.y); if (dd < bd) { bd = dd; best = e; } }
      if (best) { d.cd = 22; const a = Math.atan2(best.y - d.y, best.x - d.x); G.bullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, life: 30, dmg: 8 }); Aud.play('pistole', { x: d.x, y: d.y, gain: 0.4, cat: 'sfx', rate: 1.6 }); } else d.cd = 10; } }
}
function drawAllyDrones() { for (const d of G.allyDrones) { ctx.globalAlpha = 0.9; ctx.drawImage(glowSprite('#9dff4a'), d.x - 8, d.y - 12, 16, 16); ctx.globalAlpha = 1; ctx.fillStyle = '#101a10'; ctx.fillRect(d.x - 3, d.y - 8, 6, 3); } }
function drawGrenades() { for (const g of G.grenades) { ctx.globalAlpha = 0.9; ctx.drawImage(glowSprite('#3fe8ff'), g.x - 6, g.y - 6 - g.z, 12, 12); ctx.globalAlpha = 1; } }
// Power-up einsammeln
function takePowerup(type) {
  const P = POWERUPS[type], p = G.player; floatText(p.x, p.y - 20, P.name, P.color, 13);
  if (P.dur) G.pu[type] = P.dur * 60;
  else if (type === 'repair') p.hp = Math.min(p.maxHp, p.hp + 40);
  else if (type === 'vest') G.armor = 100;
  else if (type === 'bribe') { if (G.wanted.level > 0) { G.wanted.pts = Math.max(0, G.wanted.pts - 1); G.wanted.level = Math.max(0, G.wanted.level - 1); } }
  else if (type === 'empwave') empBurst(p.x, p.y, 220);
  Aud.play('kasse', { gain: 0.6, cat: 'ui', bus: 'ui', rate: 1.4 });
}
function initCrates() {
  const rng = mulberry(C.CITY_SEED ^ 0x77aa), types = Object.keys(POWERUPS); G.crates = [];
  for (const d of ['docks', 'neon', 'krone']) { let n = 0, tries = 0; while (n < 6 && tries++ < 2000) {
    const tx = 4 + Math.floor(rng() * (World.W - 8)), ty = 4 + Math.floor(rng() * (World.H - 8)); if (World.tiles[ty * World.W + tx] !== TK.SIDEWALK || districtAt(tx).id !== d) continue;
    const x = (tx + 0.5) * C.TILE, y = (ty + 0.5) * C.TILE; if (World.blocked(x, y, 10)) continue; G.crates.push({ x, y, type: types[Math.floor(rng() * types.length)], on: true, t: 0, bob: rng() * 6 }); n++; } }
}
function updateCrates() {
  const p = G.player; if (!p) return;
  for (const c of G.crates || []) { c.bob += 0.08; if (!c.on) { if (--c.t <= 0) c.on = true; continue; }
    if (Math.hypot(c.x - p.x, c.y - p.y) < (p.veh ? 30 : 18)) { c.on = false; c.t = 3 * 60 * 60; takePowerup(c.type); } }
}
function drawCrates(layer) {
  for (const c of G.crates || []) { if (!c.on || !onScreen(c.x, c.y, 24)) continue; const y = c.y + Math.sin(c.bob) * 1.5;
    if (layer === 'body') { ctx.globalAlpha = 0.5; ctx.drawImage(shadowSprite(7, 5), c.x - 19 + 2, y - 17 + 6); ctx.globalAlpha = 1; ctx.fillStyle = '#1a1230'; ctx.fillRect(c.x - 7, y - 7, 14, 14); ctx.strokeStyle = POWERUPS[c.type] ? '#ffd84a' : '#fff'; ctx.lineWidth = 1.4; ctx.strokeRect(c.x - 6.3, y - 6.3, 12.6, 12.6); ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('?', c.x, y + 4); }
    else { ctx.globalAlpha = 0.45 + 0.2 * Math.sin(c.bob * 1.5); ctx.drawImage(glowSprite('#ffd84a'), c.x - 16, y - 16, 32, 32); ctx.globalAlpha = 1; } }
}
function updateBullets() {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i]; let dead = --b.life <= 0;
    if (b.rocket && G.time % 2 === 0) { smoke(b.x, b.y, 6, 'light', 22, 0, 0, 0.4); glow(b.x, b.y, 10, '#ffb060', 6); }
    for (let k = 0; k < 2 && !dead; k++) {
      b.x += b.vx / 2; b.y += b.vy / 2;
      for (const pr of G.props) if (Math.abs(pr.x - b.x) < 9 && Math.abs(pr.y - b.y) < 10) { pr.hp -= b.dmg; sparks(b.x, b.y, 3, '#ffd27a', 3); dead = true; break; }
      if (dead) break;
      if (World.blocked(b.x, b.y, 1)) { sparks(b.x, b.y, 4, '#ffd27a', 3, Math.atan2(-b.vy, -b.vx), 0.9); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; }
      for (const q of G.peds) { if (q.state === 'dead' || Math.abs(q.x - b.x) > 11 || Math.abs(q.y - b.y) > 11) continue;
        if (Math.hypot(q.x - b.x, q.y - b.y) < (q.state === 'down' ? 6 : 9)) { const m = Math.hypot(b.vx, b.vy); damagePed(q, b.dmg, b.vx / m, b.vy / m, 'bullet'); dead = true; break; } }
      if (dead) break;
      for (const d of G.drones) if (Math.hypot(d.x - b.x, d.y - b.y) < 12) { d.hp -= b.dmg; sparks(b.x, b.y, 4, '#9fd0ff', 3); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; }
      if (dead) break;
      for (const v of G.vehicles) { if (Math.abs(v.x - b.x) > 90 || Math.abs(v.y - b.y) > 90 || (v.driver === G.player)) continue; if (vehDist(v, b.x, b.y) < 2) { damageVeh(v, b.dmg * 0.4, 'bullet'); sparks(b.x, b.y, 4, '#ffd27a', 3, Math.atan2(-b.vy, -b.vx), 0.9); Aud.play('querschlaeger', { x: b.x, y: b.y, gain: 0.5, cat: 'sfx' }); dead = true; break; } }
    }
    if (dead) { if (b.rocket) { explosion(b.x, b.y, 1.7); blast(b.x, b.y, 130, 90); propBlast(b.x, b.y, 120, 70); Bus.emit('boom', b.x, b.y, 1.7); } G.bullets.splice(i, 1); }
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
