'use strict';
// 09-peds.js - Spieler zu Fuß (PLAN §4.7) und Passanten (PLAN §4.8, §4.10, §7.4): Spawn-Ring, Gehweg-Wandern, Zebrastreifen, Panik und
// Ansteckung, Ausweichen, Überfahren (tödlich/verletzt) mit Schrei-System (Aufnahmen, ein fester Sprecher je Person), Zeugen, Leichen,
// Splats, Brieftaschen, Sprüche (Humor). Exportiert: newPlayer, updatePlayer, killPlayer, makePed, updatePeds, drawPeds, drawPedGlow,
// drawPickups, panicAt, bark, updatePickups, drawBarks

let PED_ID = 1;
function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, a: 0, r: C.PED_R, hp: 100, maxHp: 100, walk: 0, stride: 0, stamina: C.STAMINA, dodge: 0, dodgeCd: 0, veh: null, cd: 0, punchT: 0, recoil: 0, surface: 'beton', design: PLAYER_DESIGN };
}

function updatePlayer() {
  const p = G.player, i = G.in;
  if (p.veh) { p.a = p.veh.a; return; }                // im Fahrzeug: Position/Blick setzt updateVehicles()
  const ap = aimPoint(); p.a = Math.atan2(ap.y - p.y, ap.x - p.x);
  const moving = !!(i.mx || i.my), sprint = i.sprint && p.stamina > 1 && moving;
  const sp = sprint ? C.PLAYER_SPRINT : C.PLAYER_WALK;
  p.stamina = clamp(p.stamina + (sprint ? -C.STAMINA_DRAIN : C.STAMINA_REGEN), 0, C.STAMINA);
  if (p.dodgeCd > 0) p.dodgeCd--;
  const N = Math.round(C.DODGE_S * 60);
  if (i.dodgeP && p.dodgeCd <= 0 && p.dodge <= 0) {                                    // Abrollen: Richtung = Bewegung (sonst Blick), Tempo fällt über die Rolle ab
    let rx = i.mx, ry = i.my; const m = Math.hypot(rx, ry); if (m < 0.1) { rx = Math.cos(p.a); ry = Math.sin(p.a); } else { rx /= m; ry /= m; }
    p.dodge = N; p.dodgeCd = Math.round(C.DODGE_CD_S * 60); p.rdx = rx; p.rdy = ry; p.trail = []; p.recover = 0; Bus.emit('dodge', p);
    for (let k = 0; k < 4; k++) glow(p.x + rand(-4, 4), p.y + rand(-4, 4), rand(3, 6), '#9fd0ff', 12, -rx * rand(0.4, 1.2), -ry * rand(0.4, 1.2), 0.3);   // Wasserspritzer beim Abdruck
  }
  if (p.dodge > 0) {
    const t = p.dodge / N, sp = 5.6 * (0.42 + 0.58 * t); p.vx = p.rdx * sp; p.vy = p.rdy * sp; p.dodge--;
    if (p.dodge % 3 === 0) { p.trail.push({ x: p.x, y: p.y, k: t }); if (p.trail.length > 4) p.trail.shift(); }
    if (p.dodge === 0) { p.recover = 8; for (let k = 0; k < 5; k++) glow(p.x + rand(-5, 5), p.y + rand(-5, 5), rand(3, 7), '#9fd0ff', 14, p.rdx * rand(0.3, 1.5), p.rdy * rand(0.3, 1.5), 0.3); if (World.surface(p.x, p.y) === 'pfuetze') Aud.play('spritzer', { x: p.x, y: p.y, gain: 0.6, cat: 'sfx' }); else Aud.play('schritt_' + (G.inside ? 'platte' : World.surface(p.x, p.y)), { gain: 1.3, rate: 0.8, cat: 'schritt' }); }
  }
  else { if (p.recover > 0) { p.recover--; p.vx *= 0.6; p.vy *= 0.6; } p.vx += (i.mx * sp * (p.recover > 0 ? 0.4 : 1) - p.vx) * 0.2; p.vy += (i.my * sp * (p.recover > 0 ? 0.4 : 1) - p.vy) * 0.2; }
  const x0 = p.x, y0 = p.y;
  World.move(p, p.vx, p.vy);
  const v = Math.hypot(p.x - x0, p.y - y0);
  p.walk += v * (sprint ? 1.15 : 1);
  // Schritte: eine Schrittlänge je Untergrund-Klang (Sprint kürzer getaktet); drinnen klingen sie nach Platte
  p.stride += v;
  if (p.stride > (sprint ? 15 : 19) && v > 0.5 && p.dodge <= 0) { p.stride = 0; p.surface = G.inside ? 'platte' : World.surface(p.x, p.y); Aud.step(p.surface, sprint); }
}

// ------------------------------------------------------------------
// Passanten
// ------------------------------------------------------------------
const PED_OK = k => k === TK.SIDEWALK || k === TK.CROSSWALK || k === TK.PARK || k === TK.QUAY;
const PED_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const PED_MAX = { docks: 32, neon: 48, krone: 26 };

function makePed(x, y, o = {}) {
  const d = o.design || pickDesign(R.fn), p = { id: PED_ID++, kind: 'ped', type: o.type || 'civ', x, y, vx: 0, vy: 0, a: rand(0, TAU), r: C.PED_R, hp: 20, maxHp: 20, state: 'walk', d,
    walk: rand(0, 40), speed: rand(0.75, 1.15), dir: randi(0, 3), tx: x, ty: y, hasT: false, panic: 0, downT: 0, groanT: 0, painT: 0, dodge: 0, wait: 0, stuck: 0, hitCool: 0,
    speaker: Aud.speakerFor(d.voice), umb: d.umb && R.fn() < 0.9 ? d.umb : null, umbRot: rand(0, TAU), barkT: randi(240, 900), cr: randi(5, 30), scream: null, screamT: 0, fx: x, fy: y, born: G.time };
  G.peds.push(p); return p;
}
function pedFacing(p) { return p.state === 'down' || p.state === 'dead'; }

// Nächstes Wanderziel: Nachbarkachel auf Gehwegen (geradeaus bevorzugt), mit Versatz innerhalb der Kachel
function pedNextTarget(p) {
  const T = C.TILE, tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), w = [], idx = [];
  for (let k = 0; k < 4; k++) {
    const nx = tx + PED_DIRS[k][0], ny = ty + PED_DIRS[k][1], kind = World.tile((nx + 0.5) * T, (ny + 0.5) * T);
    if (!PED_OK(kind) || World.blocked((nx + 0.5) * T, (ny + 0.5) * T, p.r)) continue;
    const rel = (k - p.dir + 4) % 4; w.push(rel === 0 ? 6 : rel === 2 ? 0.3 : 2); idx.push(k);
  }
  if (!idx.length) { p.hasT = false; p.dir = (p.dir + 2) % 4; return; }
  let s = 0; for (const x of w) s += x; let r = R.fn() * s, k = idx[0]; for (let i = 0; i < idx.length; i++) { r -= w[i]; if (r <= 0) { k = idx[i]; break; } }
  const nx = tx + PED_DIRS[k][0], ny = ty + PED_DIRS[k][1], nk = World.tile((nx + 0.5) * T, (ny + 0.5) * T), ck = World.tile(p.x, p.y);
  if (nk === TK.CROSSWALK && ck !== TK.CROSSWALK && trafficNear((nx + 0.5) * T, (ny + 0.5) * T, 220)) { p.wait = 18; return; }       // an der Straße warten, wenn ein Auto kommt
  p.dir = k; p.tx = (nx + 0.5) * T + rand(-18, 18); p.ty = (ny + 0.5) * T + rand(-18, 18); p.hasT = true;
}
function trafficNear(x, y, r) { for (const v of G.vehicles) if (!v.dead && !v.parkedOnly && (v.vx * v.vx + v.vy * v.vy) > 2.2 && Math.abs(v.x - x) < r && Math.abs(v.y - y) < r) return true; return false; }

// ---- Sprüche ----
function bark(p, text, ticks = 170) {
  if (!text || G.barks.length >= 4) return; for (const b of G.barks) if (b.p === p) return;
  G.barks.push({ p, text, t: ticks, max: ticks });
}
const barkPick = list => list[Math.floor(R.fn() * list.length)];

// ---- Panik ----
function panicAt(x, y, radius, ticks) {
  for (const p of G.peds) {
    if (p.state === 'dead' || p.state === 'down' || p.team === 'od') continue;
    const d = Math.hypot(p.x - x, p.y - y); if (d > radius) continue;
    if (p.state !== 'flee') { if (p.umb && R.fn() < 0.3) bark(p, STR.barks.panic[5], 120); else if (R.fn() < 0.25) bark(p, barkPick(STR.barks.panic), 100); }
    p.state = 'flee'; p.panic = ticks * rand(0.8, 1.2); p.fx = x; p.fy = y; p.umb = null; p.hasT = false;
    if (d < radius * 0.5 && !p.scream && R.fn() < 0.6) p.screamT = randi(10, 60);
  }
}
function witness(x, y) {                         // Umstehende (< 300 px): 30-60 % schreien zeitversetzt, alle fliehen
  let n = 0;
  for (const p of G.peds) {
    if (p.state === 'dead' || p.state === 'down' || p.team === 'od') continue; const d = Math.hypot(p.x - x, p.y - y); if (d > 300) continue;
    p.state = 'flee'; p.panic = rand(360, 600); p.fx = x; p.fy = y; p.umb = null; p.hasT = false;
    if (n < 3 && R.fn() < 0.5) { p.screamT = randi(24, 96); p.farScream = true; n++; }
    if (R.fn() < 0.2) bark(p, barkPick(STR.barks.witness), 160);
  }
}

// ---- Schaden ----
function pedStopScream(p, fade) { if (p.scream) { p.scream.stop(fade); p.scream = null; } }
function killPed(p, v) {
  if (p.state === 'dead') return;
  pedStopScream(p, 0.015); p.state = 'dead'; p.hp = 0; p.deadT = G.time;
  Aud.play('koerper_toedlich', { x: p.x, y: p.y, gain: 1, cat: 'sfx' });
  Ground.decal({ t: 'splat', x: p.x, y: p.y, rot: rand(0, TAU), s: rand(0.8, 1.25), v: randi(0, 2) });
  G.pickups.push({ x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), type: 'cr', v: p.cr, life: 1800, bob: rand(0, 6) });
  G.stats.peds++; addTrauma(0.22 * screenFalloff(p.x, p.y)); G.freeze = Math.max(G.freeze, 2);
  witness(p.x, p.y); Bus.emit('pedKilled', p, v);
}
function hurtPed(p, v, dmg, dirx, diry) {
  p.hp -= dmg; p.vx = dirx * Math.min(5, dmg * 0.14); p.vy = diry * Math.min(5, dmg * 0.14); p.hitCool = 30;
  if (p.hp <= 0) { killPed(p, v); return; }
  Bus.emit('pedHurt', p, v);
  pedStopScream(p, 0.09); p.state = 'down'; p.downT = randi(130, 270); p.painT = 40; p.groanT = 150; p.hasT = false;
  Aud.play('koerper_verletzt', { x: p.x, y: p.y, gain: 0.9, cat: 'sfx' });
  addTrauma(0.1 * screenFalloff(p.x, p.y)); witness(p.x, p.y);
}
function pedVehicleContacts() {
  const mov = []; for (const v of G.vehicles) if (!v.dead && (v.vx * v.vx + v.vy * v.vy) > 0.7) mov.push(v);
  if (!mov.length) return;
  for (const p of G.peds) {
    if (p.state === 'dead') continue;
    for (const v of mov) {
      if (Math.abs(v.x - p.x) > 120 || Math.abs(v.y - p.y) > 120) continue;
      const spd = Math.hypot(v.vx, v.vy), ux = v.vx / spd, uy = v.vy / spd, rx = p.x - v.x, ry = p.y - v.y, along = rx * ux + ry * uy, lat = rx * uy - ry * ux;
      // Auto rast heran: Angstschrei + Hechtsprung zur Seite
      if (spd > 5 && along > 0 && along < 150 && Math.abs(lat) < 34 && along / spd < 36 && p.state !== 'down' && p.state !== 'dodge' && p.dodge <= 0 && !p.scream) {
        p.scream = Aud.playRec('angst', p.d.voice, { x: p.x, y: p.y, speaker: p.speaker });
        if (R.fn() < 0.4) bark(p, barkPick(STR.barks.panic), 80);
        if (!p.noDodge && R.fn() > 0.3) { const sd = lat >= 0 ? 1 : -1; p.dvx = -uy * sd * 3.4; p.dvy = ux * sd * 3.4; p.dodge = 16; p.state = 'flee'; p.panic = 300; p.fx = v.x; p.fy = v.y; p.umb = null; }
        else p.frozen = 40;                                                              // starr vor Schreck: kein Hechtsprung
      }
      if (p.hitCool > 0) continue;
      if (vehDist(v, p.x, p.y) < p.r + 1.5 && spd > 0.8) {
        if (spd < 2.5) { p.state = 'down'; p.downT = 40; p.vx = v.vx * 0.6; p.vy = v.vy * 0.6; p.hitCool = 30; pedStopScream(p, 0.05); if (R.fn() < 0.6) bark(p, barkPick(STR.barks.getup), 110); }
        else { hurtPed(p, v, (spd - 2) * 12 * (v.boosting ? 1.3 : 1), ux, uy); v.vx *= 0.97; v.vy *= 0.97; if (v.driver === G.player) G.hurtFlash = Math.max(G.hurtFlash, 0.12); }
      }
    }
  }
}

// ---- Aufnahmen-Ereignisse und Schleife ----
Bus.on('boom', (x, y, s) => panicAt(x, y, 600, 480));
Bus.on('gunshot', (x, y) => panicAt(x, y, 400, 420));
// Allgemeiner Schaden an Personen. src: 'fist' (k.o. statt Tod, Rückstoß), 'bullet' (tötet)
const KO_BARKS = ['Aua! Ich bin Pazifist!', 'Dafür gibt es Punktabzug!', 'Mein Schirm! Mein Gesicht! In dieser Reihenfolge!', 'Ich habe ein Abo auf Unversehrtheit!', 'Das sage ich dem Regenten!'];
function damagePed(q, dmg, dx, dy, src) {
  if (q.state === 'dead') return;
  if (q.team === 'od') {                                                                   // OD-Beamte: Schläge/Kugeln verletzen, k.o. bzw. tot; sie schlagen zurück (provoziert)
    q.hp -= dmg; q.provoked = true; q.vx = dx * 2.4; q.vy = dy * 2.4; q.hitCool = 10; Aud.play(src === 'fist' ? 'faustschlag' : 'querschlaeger', { x: q.x, y: q.y, gain: 0.9, cat: 'sfx' });
    Bus.emit('pedHurt', q, null);
    if (q.hp <= 0) { if (src === 'fist') { q.state = 'down'; q.downT = randi(300, 480); q.hp = 6; q.ko = true; Bus.emit('crime', 'copHurt'); } else killPed(q, null); }
    return;
  }
  pedStopScream(q, 0.03); q.hasT = false; q.umb = null; q.fx = q.x - dx * 40; q.fy = q.y - dy * 40;
  if (src === 'fist') {
    q.hp -= dmg; q.vx = dx * 3.4; q.vy = dy * 3.4; q.hitCool = 10; Aud.play('faustschlag', { x: q.x, y: q.y, gain: 1, cat: 'sfx' });
    Aud.playRec('treffer', q.d.voice, { x: q.x, y: q.y, speaker: q.speaker, gain: 0.9 });
    if (q.hp <= 0) {                                                                         // K.O.: bewusstlos, Taschengeld, Sternchen
      q.state = 'down'; q.downT = randi(420, 700); q.ko = true; q.hp = 4; q.painT = 0; q.groanT = 0; G.stats.ko = (G.stats.ko || 0) + 1;
      if (!q.robbed) { q.robbed = true; G.pickups.push({ x: q.x + rand(-6, 6), y: q.y + rand(-6, 6), type: 'cr', v: Math.max(2, Math.floor(q.cr * 0.5)), life: 1500, bob: 0 }); }
      witness(q.x, q.y); if (R.fn() < 0.5) bark(q, barkPick(KO_BARKS), 150);
    } else { q.state = 'flee'; q.panic = 360; q.frozen = 12; q.fx = q.x - dx * 40; q.fy = q.y - dy * 40; if (R.fn() < 0.6) bark(q, barkPick(KO_BARKS), 120); witness(q.x, q.y); }
    Bus.emit('assault', q, 'fist'); return;
  }
  if (src === 'bullet') { if (q.state === 'down' && q.ko) q.ko = false; hurtPed(q, null, dmg, dx, dy); Bus.emit('assault', q, 'bullet'); }
}
Bus.on('crash', (v, k) => { if (k > 5) panicAt(v.x, v.y, 200, 300); });

function updatePeds() {
  const cam = G.cam, z = G.zoom || 1, half = Math.hypot(VIEW_W, VIEW_H) / 2 / z, d = G.district ? G.district.id : 'neon', max = PED_MAX[d];
  const pl = G.player; let alive = 0;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i];
    if (p.state !== 'dead') alive++;
    if (p.hitCool > 0) p.hitCool--;
    if (p.state === 'dead') { if (G.time - p.deadT > 3600 || Math.hypot(p.x - cam.x, p.y - cam.y) > half * 2.6) G.peds.splice(i, 1); continue; }
    // Stimme: verzögerte Schreie der Zeugen
    if (p.screamT > 0 && --p.screamT === 0 && p.state !== 'down') { const far = p.farScream; p.farScream = false; Aud.playRec('angst', p.d.voice, { x: p.x, y: p.y, speaker: p.speaker, gain: far ? 0.35 : 1 }); }
    if (p.state === 'down') {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.86; p.vy *= 0.86; if (World.blocked(p.x, p.y, 4)) { p.x -= p.vx; p.y -= p.vy; p.vx = p.vy = 0; }
      if (p.painT > 0 && --p.painT === 0) Aud.playRec('schmerz', p.d.voice, { x: p.x, y: p.y, speaker: p.speaker, gain: 0.85 });
      if (p.groanT > 0 && --p.groanT === 0 && p.hp < p.maxHp) { Aud.playRec('stoehnen', p.d.voice, { x: p.x, y: p.y, speaker: p.speaker, gain: 0.8 }); p.groanT = randi(120, 240); }
      if (--p.downT <= 0 && p.team === 'od') { p.state = 'chase'; p.hp = Math.max(p.hp, 10); p.hasT = false; continue; }
      if (--p.downT <= 0) { p.ko = false; p.state = 'flee'; p.panic = 300; p.hp = Math.max(p.hp, 6); p.hasT = false; p.fx = p.x - Math.cos(p.a) * 40; p.fy = p.y - Math.sin(p.a) * 40; if (R.fn() < 0.5) bark(p, barkPick(STR.barks.getup), 140); }
      continue;
    }
    if (p.frozen > 0) { p.frozen--; continue; }
    if (p.team === 'od') {
      if (p.leave && !onScreen(p.x, p.y, 60)) { G.peds.splice(i, 1); continue; }
      if (G.wanted.level > 0 && p.state !== 'chase') { p.state = 'chase'; p.hasT = false; } else if (G.wanted.level === 0 && p.state === 'chase') { p.state = 'walk'; p.hasT = false; }
      if (p.state === 'chase') { if (updateCop(p)) continue; }
    }
    if (p.dodge > 0) { p.dodge--; World.move(p, p.dvx, p.dvy); p.walk += 3; continue; }
    if (p.state === 'flee') {
      let ax = p.x - p.fx, ay = p.y - p.fy; const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
      const wig = Math.sin(G.time * 0.09 + p.id * 1.7) * 0.5; const dx = ax - ay * wig, dy = ay + ax * wig, mm = Math.hypot(dx, dy) || 1, sp = 2.0 + (p.id % 5) * 0.06;
      p.vx = dx / mm * sp; p.vy = dy / mm * sp; const x0 = p.x, y0 = p.y; World.move(p, p.vx, p.vy);
      if (Math.hypot(p.x - x0, p.y - y0) < 0.5) { p.fx += rand(-80, 80); p.fy += rand(-80, 80); }          // festgehangen: Fluchtquelle versetzen
      p.a = Math.atan2(p.vy, p.vx); p.walk += sp * 1.5;
      if (--p.panic <= 0) { p.state = 'walk'; p.hasT = false; }
    } else {
      if (p.wait > 0) { p.wait--; continue; }
      if (!p.hasT) { pedNextTarget(p); if (!p.hasT) continue; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
      if (dist < 9) { p.hasT = false; if (R.fn() < 0.08) p.wait = randi(30, 120); continue; }
      p.a = angleLerp(p.a, Math.atan2(dy, dx), 0.25); const x0 = p.x, y0 = p.y;
      World.move(p, dx / dist * p.speed, dy / dist * p.speed); const mv = Math.hypot(p.x - x0, p.y - y0); p.walk += mv * 1.1;
      if (mv < 0.2 && ++p.stuck > 40) { p.stuck = 0; p.hasT = false; p.dir = (p.dir + 2) % 4; } else if (mv >= 0.2) p.stuck = 0;
    }
    // Despawn weit außerhalb des Bildes
    if (Math.hypot(p.x - cam.x, p.y - cam.y) > half * 2.2) { G.peds.splice(i, 1); alive--; }
  }
  // Ansteckende Panik (alle 10 Ticks): fliehende Nachbarn < 120 px, Leichen < 150 px
  if (G.time % 10 === 0) for (const p of G.peds) {
    if (p.state !== 'walk' || p.team === 'od') continue;
    for (const q of G.peds) {
      if (q === p) continue;
      if (q.state === 'flee' && Math.abs(q.x - p.x) < 120 && Math.abs(q.y - p.y) < 120 && Math.hypot(q.x - p.x, q.y - p.y) < 120) { p.state = 'flee'; p.panic = q.panic * 0.8; p.fx = q.fx; p.fy = q.fy; p.umb = null; p.hasT = false; break; }
      if (q.state === 'dead' && Math.hypot(q.x - p.x, q.y - p.y) < 150) { p.state = 'flee'; p.panic = 360; p.fx = q.x; p.fy = q.y; p.umb = null; p.hasT = false; if (R.fn() < 0.3) bark(p, barkPick(STR.barks.witness), 150); break; }
    }
  }
  pedVehicleContacts();
  // Spawn-Ring: 1.15-1.7 x halbe Bilddiagonale außerhalb des Bildes, nur auf Gehwegen
  if (G.time % 6 === 0 && alive < max) for (let t = 0; t < 6; t++) {
    const ang = R.fn() * TAU, r = half * rand(1.15, 1.7), x = cam.x + Math.cos(ang) * r, y = cam.y + Math.sin(ang) * r;
    if (!PED_OK(World.tile(x, y)) || World.blocked(x, y, C.PED_R) || onScreen(x, y, 30)) continue;
    makePed(x, y); break;
  }
  // Sprüche: ab und zu ein Passant im Bild
  if (pl && G.time % 90 === 0 && G.barks.length < 2) {
    const c = G.peds.filter(p => p.state === 'walk' && onScreen(p.x, p.y, -40) && !p.barked);
    if (c.length && R.fn() < 0.5) { const p = c[Math.floor(R.fn() * c.length)]; p.barked = true; bark(p, barkPick(STR.barks.idle), 210); }
  }
  for (let i = G.barks.length - 1; i >= 0; i--) { const b = G.barks[i]; if (--b.t <= 0 || (!b.p.npc && !G.peds.includes(b.p))) G.barks.splice(i, 1); }
}

// ---- Brieftaschen ----
function updatePickups() {
  const p = G.player; if (!p) return;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i]; k.bob += 0.1; if (--k.life <= 0) { G.pickups.splice(i, 1); continue; }
    if (Math.hypot(k.x - p.x, k.y - p.y) < (p.veh ? 30 : 20)) {
      G.pickups.splice(i, 1);
      if (k.type === 'gun') { giveWeapon('pistole', k.v); floatText(k.x, k.y - 8, 'DIENSTWAFFE +' + k.v, '#ffd84a', 12); Aud.play('klick', { gain: 0.8, cat: 'ui', bus: 'ui' }); if (G.weapon === 'faust') setWeapon('pistole'); }
      else if (k.type === 'cr') { G.credits = (G.credits || 0) + k.v; floatText(k.x, k.y - 8, STR.loot.cr(k.v), '#ffd84a', 13); Aud.play('kasse', { gain: 0.7, cat: 'ui', bus: 'ui' }); }
    }
  }
}
function drawPickups(layer) {
  for (const k of G.pickups) {
    if (!onScreen(k.x, k.y, 20)) continue;
    const y = k.y + Math.sin(k.bob) * 1.6;
    if (layer === 'body') { ctx.globalAlpha = 0.5; ctx.drawImage(shadowSprite(6, 4), k.x - 18 + 2, y - 16 + 6); ctx.globalAlpha = 1;
      if (k.life < 200 && (k.life >> 3) & 1) continue;
      if (k.type === 'gun') { ctx.save(); ctx.translate(k.x, y); ctx.rotate(0.4); ctx.fillStyle = '#12141a'; ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-1, 1, 4, 5); ctx.fillStyle = '#3fe8ff'; ctx.fillRect(4, -1.4, 2, 1.2); ctx.restore(); continue; }
      ctx.save(); ctx.translate(k.x, y); ctx.rotate(0.3 + Math.sin(k.bob * 0.5) * 0.2); ctx.fillStyle = '#3a2a14'; ctx.fillRect(-5, -3.5, 10, 7); ctx.fillStyle = '#c9a227'; ctx.fillRect(-4.3, -2.8, 8.6, 5.6); ctx.fillStyle = '#ffe48a'; ctx.fillRect(-2, -1.2, 4, 2.4); ctx.restore(); }
    else { ctx.globalAlpha = 0.5 + 0.2 * Math.sin(k.bob * 1.5); ctx.drawImage(glowSprite('#ffd84a'), k.x - 10, y - 10, 20, 20); ctx.globalAlpha = 1; }
  }
}

// ---- Rendering ----
function drawPeds() {
  for (const p of G.peds) {
    if (!onScreen(p.x, p.y, 40)) continue;
    const f = Math.floor(p.walk / 7.5) & 7;
    if (p.state === 'dead' || p.state === 'down') {
      const wob = p.state === 'down' ? Math.sin(G.time * 0.3 + p.id) * 0.06 : 0;
      drawPerson(p.x, p.y, p.a + wob, p.d, 0, { dead: true, alpha: p.state === 'dead' ? 0.97 : 1 });
      if (p.state === 'down' && p.downT > 20) {                                                  // Sternchen kreisen über dem Kopf (Humor)
        ctx.fillStyle = '#ffe48a'; for (let s = 0; s < 3; s++) { const a = G.time * 0.15 + s * 2.1; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 7, p.y - 9 + Math.sin(a) * 2.4, 1.5, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
      continue;
    }
    ctx.globalAlpha = 0.65; ctx.drawImage(shadowSprite(7, 5), p.x - 19 + 2, p.y - 17 + 4); ctx.globalAlpha = 1;
    drawPerson(p.x, p.y, p.a, p.d, f, { scale: 1.2 });
    if (p.umb) { ctx.save(); ctx.translate(p.x + Math.cos(p.a) * 1.5, p.y + Math.sin(p.a) * 1.5); ctx.rotate(p.umbRot + Math.sin(G.time * 0.02 + p.id) * 0.05); ctx.drawImage(umbrellaSprite(p.umb), -20, -20, 40, 40); ctx.restore(); }
  }
}
// Treuechip-Punkt im Nacken (additiv, pulsierend): jeder Bürger hat einen (PLAN §5.1 Schritt 6)
function drawPedGlow() {
  if (G.quality < 0.45) return;
  for (const p of G.peds) {
    if (p.state === 'dead' || !onScreen(p.x, p.y, 20) || p.umb) continue;
    ctx.globalAlpha = (0.45 + 0.3 * Math.sin(G.time * 0.12 + p.id)) * (p.state === 'down' ? 0.5 : 1);
    ctx.drawImage(glowSprite('#ff2030'), p.x - Math.cos(p.a) * 3 - 4, p.y - Math.sin(p.a) * 3 - 4, 8, 8);
  }
  ctx.globalAlpha = 1;
}
function drawBarks() {
  ctx.font = '700 11px "Segoe UI", "DejaVu Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of G.barks) {
    const p = b.p; if (!onScreen(p.x, p.y, 20)) continue;
    const a = Math.min(1, b.t / 25, (b.max - b.t) / 8 + 0.2), tw = ctx.measureText(b.text).width + 12, x = p.x, y = p.y - 24 - (b.max - b.t) * 0.02;
    ctx.globalAlpha = a * 0.85; ctx.fillStyle = 'rgba(8,10,18,0.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, y - 8, tw, 16, 5) : ctx.rect(x - tw / 2, y - 8, tw, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(63,232,255,0.5)'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = a; ctx.fillStyle = '#e6ecf5'; ctx.fillText(b.text, x, y + 0.5);
  }
  ctx.globalAlpha = 1;
}
