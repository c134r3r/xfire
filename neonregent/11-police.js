'use strict';
// 11-police.js - Fahndung und Ordnungsdienst (PLAN §7.6, WORLD.md §9): Punkte/Stufen/Abklingen (nur unbeobachtet), Sicht per Sichtlinie,
// Disponent (Fußstreifen, Streifenwagen, Abfangjäger, Sturmwagen mit Trupplern, Drohnen, Straßensperren), OD-KI (verhaften / schießen /
// Flow-Field-Verfolgung / ins Haus folgen), Verhaftet / Ausgelöscht mit Respawn, Strafen, Chip-Wäsche. Tribunal-Panzer, Gunship und
// Zielerfasser-Drohnen folgen mit den Bossen (MS7/MS10). Exportiert: Police, Flow, crime, damagePlayer, playerDown, updateCop, odCarCtl, drawDrones

const OD_DESIGN = { id: 'od', voice: 'mann', coat: '#243656', pants: '#141c2c', skin: '#e0b894', hair: '#1a1c24', shoe: '#0c0e14', hat: 'cap', pack: false, umb: null, glow: null, trim: '#3f7bff', scale: 1.06, wide: 1.1 };
const OD_ARMED = Object.assign({}, OD_DESIGN, { id: 'od_g', gun: true });
const TROOPER_DESIGN = { id: 'od_t', voice: 'mann', coat: '#1a1c22', pants: '#0e1016', skin: '#d0a888', hair: '#101218', shoe: '#08090c', hat: 'visor', pack: true, umb: null, glow: null, trim: '#ff8a30', scale: 1.1, wide: 1.2, gun: true };

// ---- Flow-Field (Ironclad-Prinzip): Abstände zum Spieler in einem 80 x 80 Kachelfenster, alle 15 Ticks neu ----
const Flow = {
  W: 80, ox: 0, oy: 0, foot: new Int16Array(6400), car: new Int16Array(6400), t: -99,
  walkFoot(k, solid) { return k !== TK.WATER && !solid; },
  walkCar(k, solid) { return k !== TK.WATER && !solid; },
  build(px, py) {
    const T = C.TILE, W = this.W; if (G.inside && Interiors.cur) { const d = Interiors.cur.b._door; px = d.x + d.nx * 40; py = d.y + d.ny * 40; }     // Spieler im Haus: Verfolger laufen zur Tür
    const tx = Math.floor(px / T), ty = Math.floor(py / T); this.ox = tx - W / 2; this.oy = ty - W / 2;
    for (const [arr, car] of [[this.foot, false], [this.car, true]]) {
      arr.fill(-1); const q = [W / 2 + W / 2 * W]; arr[q[0]] = 0;
      for (let h = 0; h < q.length; h++) {
        const i = q[h], x = i % W, y = (i / W) | 0, d = arr[i]; if (d > 60) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W || arr[ny * W + nx] >= 0) continue;
          const gx = this.ox + nx, gy = this.oy + ny; if (gx < 0 || gy < 0 || gx >= World.W || gy >= World.H) continue;
          const k = World.tiles[gy * World.W + gx]; if (car ? !this.walkCar(k, World.solid[gy * World.W + gx]) : !this.walkFoot(k, World.solid[gy * World.W + gx])) continue;
          arr[ny * W + nx] = d + 1; q.push(ny * W + nx);
        }
      }
    }
    this.t = G.time;
  },
  // Wegpunkt (Weltpunkt) zum Nachbarn mit kleinstem Abstand; null, wenn außerhalb des Fensters
  next(x, y, car) {
    const T = C.TILE, W = this.W, tx = Math.floor(x / T) - this.ox, ty = Math.floor(y / T) - this.oy, arr = car ? this.car : this.foot;
    if (tx < 0 || ty < 0 || tx >= W || ty >= W) return null; let best = arr[ty * W + tx] < 0 ? 1e9 : arr[ty * W + tx], bx = -1, by = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue; const d = arr[ny * W + nx]; if (d >= 0 && d < best) { best = d; bx = nx; by = ny; } }
    return bx < 0 ? null : { x: (this.ox + bx + 0.5) * T, y: (this.oy + by + 0.5) * T };
  }
};

// ---- Delikte ----
function crime(kind, n = 1) {
  const W = G.wanted; if (!W || G.respawn) return; const pts = (CRIME[kind] || 0) * n; if (!pts) return;
  const before = W.level; W.pts = Math.min(HEAT_MAX, W.pts + pts); let lv = 0; for (let i = HEAT_LEVELS.length - 1; i >= 0; i--) if (W.pts >= HEAT_LEVELS[i].pts) { lv = i; break; }
  if (lv > W.level) { W.level = lv; Police.levelUp(before); }
  W.decayT = HEAT_LEVELS[W.level].decay * 60; W.seenT = G.time;
  if (G.player) { W.last.x = G.player.x; W.last.y = G.player.y; }
}
Bus.on('crime', (k, n) => crime(k, n));
Bus.on('pedKilled', (p, v) => { const mine = v === null || v === undefined || (G.player && v === G.player.veh); if (p.team === 'od') { G.pickups.push({ x: p.x, y: p.y, type: 'gun', v: 12, life: 1800, bob: 0 }); if (mine) crime('copKilled'); return; } if (mine) crime('pedKilled'); });
Bus.on('pedHurt', (p, v) => { const mine = v === null || v === undefined || (G.player && v === G.player.veh); if (p.team === 'od') { if (mine) { crime('copHurt'); p.provoked = true; } return; } if (mine) crime('pedHurt'); });
Bus.on('assault', (p, src) => { if (p.team === 'od') { p.provoked = true; if (src === 'fist') crime('copHurt'); return; } if (src === 'fist') crime('assault'); });
let lastShotCrime = -99; Bus.on('gunshot', () => { if (G.time - lastShotCrime > 60) { lastShotCrime = G.time; crime('shot'); } });
Bus.on('boom', (x, y, s) => { let n = 0; for (const p of G.peds) if (p.team !== 'od' && p.state !== 'dead' && Math.hypot(p.x - x, p.y - y) < 120 * Math.sqrt(s)) n++; if (n) crime('explosionPeds'); });

// ---- Spieler: Schaden, Regeneration, Verhaftet / Ausgelöscht ----
function damagePlayer(dmg, src) {
  const p = G.player; if (!p || G.respawn) return; p.hp -= dmg; p.lastHit = G.time; G.hurtFlash = Math.max(G.hurtFlash, Math.min(0.7, dmg / 20)); addTrauma(0.08);
  Aud.playRec('treffer', 'mann', { gain: 0.7, speaker: Aud.speakerFor('mann', 'treffer') });
  if (p.hp <= 0) playerDown('wasted');
}
function playerDown(kind) {
  const p = G.player; if (!p || G.respawn) return;
  if (p.veh) exitVehicle(p, true);
  G.respawn = { kind, t: 0 }; Aud.play(kind === 'busted' ? 'sting_busted' : 'sting_wasted', { gain: 1, cat: 'ui', bus: 'ui' }); Aud.duck(-10, 2);
  HUD.banner(kind === 'busted' ? 'VERHAFTET' : 'AUSGELÖSCHT', kind === 'busted' ? 'Ordnung wiederhergestellt · Waffen eingezogen' : 'Der Chip war nicht gedeckt', 2600);
}
function killPlayer() { playerDown('wasted'); }                                // Kompatibilität (Fahrzeugexplosionen u. Ä.)
function respawnTarget(kind) {                                                  // nächste OD-Wache (Verhaftet) bzw. Klinik (Ausgelöscht); sonst Terminalplatz
  const code = kind === 'busted' ? 4 : 5, p = G.player; let best = null, bd = 1e12;
  for (const s of G.city.services) if (s.code === code) { const b = G.buildings[s.building], d = Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.y0 + b.y1) / 2 - p.y); if (d < bd && b._door) { bd = d; best = b; } }
  if (best) { const d = best._door; return World.freeSpot(d.x + d.nx * 34, d.y + d.ny * 34); }
  const c = G.city.landmarks.t.center; return World.freeSpot(c.x, c.y);
}
function updateRespawn() {
  const R_ = G.respawn, p = G.player; R_.t++;
  G.fadeA = R_.t < 80 ? 0 : R_.t < 110 ? (R_.t - 80) / 30 : R_.t < 150 ? 1 - (R_.t - 110) / 40 : 0;
  if (R_.t === 110) {                                                             // unter Schwarz: umsetzen, Strafe, Fahndung 0
    const loss = Math.min(G.credits || 0, Math.max(100, Math.floor((G.credits || 0) * 0.1))); G.credits = (G.credits || 0) - loss;
    if (R_.kind === 'busted') { G.own.pistole = false; G.ammo.pistole = 0; G.weapon = 'faust'; }
    const f = respawnTarget(R_.kind); p.x = f.x; p.y = f.y; p.vx = p.vy = 0; p.hp = p.maxHp; p.dodge = 0; G.cam.x = p.x; G.cam.y = p.y;
    Police.standDown(true); G.wanted.pts = 0; G.wanted.level = 0; G.hurtFlash = 0;
    HUD.say(R_.kind === 'busted' ? 'OD · WACHE' : 'KLINIK', R_.kind === 'busted' ? `Kaution ${loss} CR einbehalten. Waffen konfisziert (Fäuste dürfen Sie behalten). Bitte keine Wiederholung.` : `Behandlung abgeschlossen. Gebühr ${loss} CR. Der Regent wünscht gute Besserung.`, '#4a8cff');
  }
  if (R_.t >= 150) G.respawn = null;
}

// ---- Disponent und Zustand ----
const Police = {
  init() { G.wanted = { pts: 0, level: 0, seen: false, decayT: 0, seenT: 0, last: { x: 0, y: 0 }, spawnT: 0, block: null }; G.ebullets = []; G.drones = []; G.respawn = null; G.fadeA = 0; Flow.t = -99; },
  levelUp(before) {
    const L = G.wanted.level; Aud.play('sting_heat', { gain: 0.9, cat: 'ui', bus: 'ui' }); Aud.play('funk', { gain: 0.8, cat: 'ui', bus: 'ui' });
    HUD.say('OD-FUNK', barkPick(STR.police.radio[Math.min(L, 5) - 1] || STR.police.radio[0]), '#4a8cff'); if (L >= 1 && before === 0) Aud.play('megafon', { gain: 0.9, cat: 'ui', bus: 'ui' });
    HUD.banner('FAHNDUNG ' + '♦'.repeat(L), STR.police.levels[L - 1], 1800);
  },
  standDown(force) {                                                               // Fahndung vorbei: Einheiten patrouillieren / verschwinden außerhalb des Bildes
    for (const p of G.peds) if (p.team === 'od' && p.state !== 'dead') { p.provoked = false; p.state = p.state === 'down' ? 'down' : 'walk'; p.hasT = false; if (force) p.leave = true; }
    for (const v of G.vehicles) if (v.od && !v.dead) { v.ai = {}; v.odAI = null; v.od.leave = true; }
    G.drones.length = 0; G.ebullets.length = 0; G.wanted.block = null;
  },
  count() { let foot = 0, car = 0, abfang = 0, sturm = 0, drone = G.drones.length; for (const p of G.peds) if (p.team === 'od' && p.state !== 'dead' && !p.leave && !p.crew) foot++; for (const v of G.vehicles) if (v.od && !v.dead && !v.od.leave) { if (v.cls === 'od_streife') car++; else if (v.cls === 'od_abfang') abfang++; else sturm++; } return { foot, car, abfang, sturm, drone }; },
  update() {
    const W = G.wanted, p = G.player; if (!W || !p) return;
    if (G.respawn) { updateRespawn(); }
    if (W.level > 0 && G.time - Flow.t >= 15) Flow.build(p.x, p.y);
    if (W.level > 0 && G.time % 8 === 0) this.checkSeen();
    if (W.level > 0 && !W.seen && !G.respawn) { if (--W.decayT <= 0) { W.level--; W.pts = HEAT_LEVELS[W.level].pts; W.decayT = HEAT_LEVELS[W.level].decay * 60; if (W.level === 0) { this.standDown(); Aud.play('sting_clear', { gain: 0.7, cat: 'ui', bus: 'ui' }); HUD.banner('FAHNDUNG VORBEI', 'Niemand hat dich gesehen. Gut so.', 1800); } } }
    if (W.level > 0 && G.time % 30 === 0 && !G.respawn) this.dispatch();
    this.updateDrones(); this.updateEBullets(); this.arrest();
    if (p.hp < 40 && p.hp > 0 && G.time - (p.lastHit || -999) > 300) p.hp = Math.min(40, p.hp + 0.05);     // Regeneration bis 40 % nach 5 s ohne Treffer
  },
  // Sichtkontakt: irgendein OD-Wesen mit Sichtlinie in Reichweite (Fuß/Wagen 520, Drohne 700)
  checkSeen() {
    const W = G.wanted, p = G.player; let seen = false;
    const test = (x, y, r) => { if (!seen && Math.abs(x - p.x) < r && Math.abs(y - p.y) < r && Math.hypot(x - p.x, y - p.y) < r && World.los(x, y, p.x, p.y)) seen = true; };
    for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead' && !q.leave) { test(q.x, q.y, 520); }
    for (const v of G.vehicles) if (v.od && !v.dead && !v.od.leave) test(v.x, v.y, 520);
    for (const d of G.drones) if (!G.inside) test(d.x, d.y, 700);
    W.seen = seen; if (seen) { W.seenT = G.time; W.last.x = p.x; W.last.y = p.y; W.decayT = HEAT_LEVELS[W.level].decay * 60; }
  },
  // Soll-Einheiten halten: neue im Spawn-Ring (nahe der letzten bekannten Position), überzählige außerhalb des Bildes entfernen
  dispatch() {
    const W = G.wanted, want = HEAT_LEVELS[W.level], have = this.count(), p = G.player, z = G.zoom || 1, half = Math.hypot(VIEW_W, VIEW_H) / 2 / z;
    const ring = (road) => {                                                       // Position im Ring, außerhalb des Bildes, nahe der letzten bekannten Spielerposition
      let best = null, bd = 1e12;
      for (let t = 0; t < 14; t++) {
        const a = R.fn() * TAU, r = half * rand(1.15, 1.7), x = G.cam.x + Math.cos(a) * r, y = G.cam.y + Math.sin(a) * r; if (onScreen(x, y, 40)) continue;
        if (road) { const L = tileLane(x, y); if (!L || L.junction) continue; } else if (!PED_OK(World.tile(x, y)) || World.blocked(x, y, C.PED_R)) continue;
        const d = Math.hypot(x - W.last.x, y - W.last.y); if (d < bd) { bd = d; best = { x, y }; }
      }
      return best;
    };
    const car = (cls, cargo) => { const s = ring(true); if (!s) return; const L = tileLane(s.x, s.y), v = spawnVehicle(cls, (L.tx + 0.5) * C.TILE, (L.ty + 0.5) * C.TILE, Math.atan2(L.dy, L.dx), { paint: '#d8dde6' });
      if (vehBlock(v, v.x, v.y, v.a).n) { G.vehicles.pop(); return; } v.od = { cargo, stuck: 0, rev: 0, siren: true }; v.engine = true; v.vx = Math.cos(v.a) * 4; v.vy = Math.sin(v.a) * 4; };
    const total = have.foot + have.car + have.abfang + have.sturm;                   // OD_MAX 12 gleichzeitig (WORLD.md §1)
    if (have.drone < want.drone) { const s = ring(false); if (s) G.drones.push({ x: s.x, y: s.y, hp: 25, a: rand(0, TAU), t: rand(0, 60), cd: 90, ang: rand(0, TAU) }); }   // Luft zählt nicht zum Bodenlimit
    if (total >= 12) { /* Limit erreicht */ }
    else if (have.foot < want.foot) { const s = ring(false); if (s) this.spawnCop(s.x, s.y, false); }
    else if (have.car < want.car) car('od_streife', 2); else if (have.abfang < want.abfang) car('od_abfang', 1); else if (have.sturm < want.sturm) car('od_sturm', 4);
    if (want.block && !W.block && p.veh && Math.hypot(p.veh.vx, p.veh.vy) > 4 && W.level >= 3) this.barricade();
    // überzählig: nur außerhalb des Bildes entfernen
    const far = u => Math.hypot(u.x - G.cam.x, u.y - G.cam.y) > half * 1.3 && !onScreen(u.x, u.y, 80);
    if (have.foot > want.foot) for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead' && far(q)) { G.peds.splice(G.peds.indexOf(q), 1); break; }
    if (have.car > want.car) for (const v of G.vehicles) if (v.od && v.cls === 'od_streife' && !v.dead && !v.driver && far(v)) { G.vehicles.splice(G.vehicles.indexOf(v), 1); break; }
    if (have.drone > want.drone) G.drones.pop();
  },
  spawnCop(x, y, trooper) {
    const q = makePed(x, y, { design: trooper ? TROOPER_DESIGN : OD_ARMED }); q.team = 'od'; q.type = 'od'; q.hp = q.maxHp = trooper ? 70 : 40; q.speed = 1.8; q.umb = null; q.barkT = 9999; q.fireT = randi(30, 90); q.cr = randi(20, 40); q.trooper = trooper; q.provoked = false; q.arrestT = 0; q.followT = 0; q.state = 'walk';
    if (G.wanted.level > 0) { q.state = 'chase'; q.panic = 0; } return q;
  },
  // Straßensperre: 2 Wagen quer auf der Straße 600-900 px in Fahrtrichtung + 2 Beamte
  barricade() {
    const v = G.player.veh, sp = Math.hypot(v.vx, v.vy), ux = v.vx / sp, uy = v.vy / sp;
    for (let d = 700; d <= 950; d += 50) { const x = v.x + ux * d, y = v.y + uy * d, L = tileLane(x, y); if (!L || L.junction) continue;
      const cx = (L.tx + 0.5) * C.TILE, cy = (L.ty + 0.5) * C.TILE, hor = !!L.dx, ang = hor ? Math.PI / 2 : 0, units = [];
      for (const k of [-1, 1]) { const vv = spawnVehicle('od_streife', cx + (hor ? 0 : k * 34), cy + (hor ? k * 34 : 0), ang, { paint: '#d8dde6' }); if (vehBlock(vv, vv.x, vv.y, vv.a).n) { G.vehicles.splice(G.vehicles.indexOf(vv), 1); continue; } vv.od = { cargo: 0, siren: true, block: true }; vv.engine = true; units.push(vv); }
      if (units.length) { G.wanted.block = { x: cx, y: cy, units, t: 0 }; for (const k of [-1, 1]) { const c = this.spawnCop(cx + (hor ? k * 60 : 24), cy + (hor ? 24 : k * 60), false); c.state = 'chase'; } return; } }
  },
  // Verhaften (nur Stufe <= 2): zu Fuß ein Beamter < 22 px für 1.2 s bei Tempo < 1.2; im Auto Tempo < 0.5 für 2 s mit Beamtem an der Tür
  arrest() {
    const W = G.wanted, p = G.player; if (!W || W.level < 1 || W.level > 2 || G.respawn) return;
    let near = false; const spd = Math.hypot(p.vx, p.vy), R2 = p.veh ? 48 : 22;
    for (const q of G.peds) if (q.team === 'od' && q.state !== 'dead' && q.state !== 'down' && Math.hypot(q.x - p.x, q.y - p.y) < R2) { near = true; break; }
    if (near && (p.veh ? spd < 0.5 : spd < 1.2)) { W.arrestT = (W.arrestT || 0) + 1; if (W.arrestT > (p.veh ? 120 : 72)) { W.arrestT = 0; playerDown('busted'); } } else W.arrestT = 0;
  },
  // ---- Drohnen (Luft): umkreisen den Spieler, halten Sicht, schießen leicht ----
  updateDrones() {
    const p = G.player;
    for (let i = G.drones.length - 1; i >= 0; i--) {
      const d = G.drones[i]; d.t++; d.ang += 0.012; const tx = p.x + Math.cos(d.ang) * 150, ty = p.y + Math.sin(d.ang) * 110; d.x += clamp(tx - d.x, -3.2, 3.2) * 0.06 * 2; d.y += clamp(ty - d.y, -3.2, 3.2) * 0.06 * 2;
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (--d.cd <= 0 && dist < 420 && !G.inside && !G.respawn) { d.cd = 55; const a = Math.atan2(p.y - d.y, p.x - d.x) + rand(-0.12, 0.12); G.ebullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, life: 70, dmg: 4, air: true }); Aud.play('drohne_schuss', { x: d.x, y: d.y, gain: 0.5, cat: 'sfx' }); }
      if (d.hp <= 0) { explosion(d.x, d.y, 0.8); crime('drone'); G.drones.splice(i, 1); }
    }
  },
  updateEBullets() {
    const p = G.player;
    for (let i = G.ebullets.length - 1; i >= 0; i--) {
      const b = G.ebullets[i]; let dead = --b.life <= 0;
      for (let k = 0; k < 2 && !dead; k++) {
        b.x += b.vx / 2; b.y += b.vy / 2;
        if (!b.air && World.blocked(b.x, b.y, 1)) { sparks(b.x, b.y, 3, '#ff9a8a', 3, Math.atan2(-b.vy, -b.vx), 0.9); dead = true; break; }
        if (!p.veh && !G.respawn && Math.hypot(p.x - b.x, p.y - b.y) < 8 && !(p.dodge > 0)) { damagePlayer(b.dmg, 'od'); dead = true; break; }
        if (p.veh && vehDist(p.veh, b.x, b.y) < 2) { damageVeh(p.veh, b.dmg * 0.7, 'od'); damagePlayer(b.dmg * 0.25, 'od'); sparks(b.x, b.y, 3, '#ffd27a', 3); dead = true; break; }
      }
      if (dead) G.ebullets.splice(i, 1);
    }
  }
};

// ---- Fußstreife: Verfolgung über das Flow-Field; Stufe 1 verhaftet, ab Stufe 2 (oder nach Provokation) schießt sie ----
function copMove(p, tx, ty, sp) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1; const x0 = p.x, y0 = p.y;
  World.move(p, dx / d * sp, dy / d * sp); p.walk += Math.hypot(p.x - x0, p.y - y0) * 1.2;
  if (Math.hypot(p.x - x0, p.y - y0) < 0.2 * sp) p.stuck = (p.stuck || 0) + 1; else p.stuck = 0;
}
function updateCop(p) {
  const W = G.wanted, pl = G.player; if (!W || W.level === 0 || G.respawn) return false;
  const dx = pl.x - p.x, dy = pl.y - p.y, dist = Math.hypot(dx, dy); if (G.time % 8 === (p.id & 7)) p.los = World.los(p.x, p.y, pl.x, pl.y);
  const aim = Math.atan2(dy, dx); p.a = angleLerp(p.a, aim, 0.18);
  const prov = W.level >= 2 || p.provoked, sp = p.state === 'flee' ? 2 : 1.85;
  const toward = (tx, ty, s) => {                                                  // Flow-Field zum Spieler, im Nahbereich direkt; Notausweg bei Festhängen
    const useFlow = !(p.los && dist < 150 && !G.inside) && !(G.inside && p.followT > (180 + (p.id % 4) * 60) && dist < 420);
    let wp = useFlow ? Flow.next(p.x, p.y, false) : null; if (!wp) wp = { x: tx, y: ty };
    if (p.stuck > 25) { wp = { x: p.x + Math.cos(p.a + 1.6) * 40, y: p.y + Math.sin(p.a + 1.6) * 40 }; if (p.stuck > 50) p.stuck = 0; }
    copMove(p, wp.x, wp.y, s);
  };
  if (G.inside && !p.los && dist < 420) p.followT++; else if (!G.inside) p.followT = 0;
  if (!prov) {                                                                     // Stufe 1: verhaften (nicht ins Haus: Beamte warten an der Tür, bis du herauskommst)
    if (G.inside && Interiors.cur) { const d = Interiors.cur.b._door, ex = d.x + d.nx * 46, ey = d.y + d.ny * 46; if (Math.hypot(ex - p.x, ey - p.y) > 24) toward(ex, ey, sp); return true; }
    if (dist > 16) toward(pl.x, pl.y, sp);
    return true;
  }
  if (!p.los) { toward(pl.x, pl.y, sp); return true; }
  const ideal = p.trooper ? 200 : 250;
  if (dist > ideal + 30) toward(pl.x, pl.y, sp); else if (dist < ideal - 60) copMove(p, p.x - dx / dist * 40, p.y - dy / dist * 40, 1.4);
  else copMove(p, p.x + Math.cos(aim + 1.57) * Math.sin(G.time * 0.04 + p.id) * 40, p.y + Math.sin(aim + 1.57) * Math.sin(G.time * 0.04 + p.id) * 40, 1.1);
  if (--p.fireT <= 0 && dist < 430) {
    p.fireT = p.trooper ? randi(34, 60) : randi(40, 75);
    const a = aim + rand(-0.1, 0.1) * (dist > 250 ? 1.3 : 1); G.ebullets.push({ x: p.x + Math.cos(aim) * 14, y: p.y + Math.sin(aim) * 14, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 60, dmg: p.trooper ? 4 : 6 });
    muzzleFlash(p.x + Math.cos(aim) * 14, p.y + Math.sin(aim) * 14, aim, 0.8, '#ff9a8a'); Aud.play('pistole', { x: p.x, y: p.y, gain: 0.55, cat: 'schuss', rate: 1.1 });
  }
  return true;
}

// ---- Streifenwagen: Verfolgung (Flow-Field für Fahrzeuge), Rammen, Absteigen, Rückwärts bei Festhängen ----
function odCarCtl(v) {
  const od = v.od, W = G.wanted, pl = G.player, D = VEHICLES[v.cls], spd = Math.hypot(v.vx, v.vy);
  if (od.block || od.leave && spd < 0.2) return { thr: 0, steer: 0, hb: true, boost: false };
  if (od.leave || !W || W.level === 0) return trafficCtl(Object.assign(v, { ai: v.ai || {} }));
  const tgt = pl.veh ? { x: pl.x + pl.vx * 14, y: pl.y + pl.vy * 14 } : { x: pl.x, y: pl.y }, dist = Math.hypot(tgt.x - v.x, tgt.y - v.y);
  if (G.time % 8 === (v.id & 7)) od.los = World.los(v.x, v.y, pl.x, pl.y);
  // Aussteigen: Spieler zu Fuß in der Nähe, Wagen fast still -> Besatzung steigt aus
  if (od.cargo > 0 && !pl.veh && dist < 130 && spd < 4 && od.los && G.peds.filter(q => q.team === 'od' && q.state !== 'dead').length < 8) { const c = Math.cos(v.a), s = Math.sin(v.a); for (let k = 0; k < od.cargo; k++) { const side = k % 2 ? 1 : -1, q = Police.spawnCop(v.x - s * side * (D.B / 2 + 10) - c * 8 * k, v.y + c * side * (D.B / 2 + 10) - s * 8 * k, v.cls === 'od_sturm'); q.state = 'chase'; } od.cargo = 0; }
  if (od.cargo === 0 && !pl.veh && dist < 240) return { thr: -1, steer: 0, hb: true, boost: false };
  let wp = (dist > 260 || !od.los) ? Flow.next(v.x, v.y, true) : null; if (!wp) wp = tgt;
  if (od.rev > 0) { od.rev--; const e = angDiff(v.a, Math.atan2(wp.y - v.y, wp.x - v.x)); return { thr: -1, steer: e > 0 ? -1 : 1, hb: false, boost: false }; }
  const err = angDiff(v.a, Math.atan2(wp.y - v.y, wp.x - v.x)); od.stuck = spd < 0.5 ? od.stuck + 1 : 0; if (od.stuck > 70) { od.rev = 55; od.stuck = 0; }
  const want = D.top * 0.95 * (1 - Math.min(0.55, Math.abs(err) * 0.35));
  return { thr: spd < want ? 1 : spd > want + 1 ? -0.5 : 0.1, steer: clamp(err * 2.4, -1, 1), hb: false, boost: dist > 500 && Math.abs(err) < 0.3 };
}

// ---- Rendering: Drohnen (Luftschicht), Feindgeschosse ----
function drawDrones() {
  for (const d of G.drones) {
    if (!onScreen(d.x, d.y, 60)) continue; const bob = Math.sin(d.t * 0.07) * 2;
    ctx.globalAlpha = 0.35; ctx.drawImage(shadowSprite(10, 7), d.x - 22 + 8, d.y - 19 + 14); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(d.x, d.y + bob - 4); ctx.fillStyle = '#1a1e28'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#6a7488'; ctx.lineWidth = 1.2; ctx.stroke();
    for (const [ax, ay] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { ctx.strokeStyle = '#3a4050'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ax * 0.7, ay * 0.7); ctx.stroke(); ctx.fillStyle = 'rgba(180,200,230,0.28)'; ctx.beginPath(); ctx.ellipse(ax, ay, 7, 2.2, d.t * 0.9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill(); ctx.restore();
  }
}
function drawDroneGlow() {
  for (const d of G.drones) { if (!onScreen(d.x, d.y, 60)) continue; const k = (G.time >> 3) & 1; ctx.globalAlpha = 0.95; ctx.drawImage(glowSprite(k ? '#ff2a3a' : '#2a6bff'), d.x - 8, d.y - 12, 16, 16); ctx.drawImage(glowSprite(k ? '#2a6bff' : '#ff2a3a'), d.x - 8, d.y - 4, 16, 16); }
  ctx.globalAlpha = 1;
}
function drawEBullets() { ctx.lineCap = 'round'; for (const b of G.ebullets) { if (!onScreen(b.x, b.y, 40)) continue; ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ff7a6a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1; ctx.drawImage(glowSprite('#ff5a4a'), b.x - 5, b.y - 5, 10, 10); } ctx.globalAlpha = 1; }
// Blaulicht der Einheiten: Wagen blinken rot/blau (4 Hz), Beamte tragen einen Schulter-Blinker
function odLights() {
  for (const d of G.drones) if (onScreen(d.x, d.y, 160)) { const T = LIGHT_TYPES.drone; Lights.add(G.player.x, G.player.y, T.r, T.color, 0.55); Lights.add(d.x, d.y, 40, ((G.time >> 3) & 1) ? '#ff2a3a' : '#2a6bff', 0.7); }
}
