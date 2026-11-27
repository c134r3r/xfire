'use strict';
// 08-vehicles.js - Fahrphysik (PLAN §4.7), Schaden -> Rauch -> Feuer -> Explosion -> Wrack, Ein-/Aussteigen/Kapern, geparkte Fahrzeuge,
// Fahrzeug-Rendering (Körper vor der Lightmap, Neon additiv danach) und Lichter. Verkehrs-KI folgt mit MS4.
// Exportiert: Veh (Funktionen), spawnVehicle, populateVehicles, updateVehicles, damageVeh, blast, drawVehicles, vehicleLights

let VEH_ID = 1;
function spawnVehicle(cls, x, y, a, o = {}) {
  const D = VEHICLES[cls];
  const v = { id: VEH_ID++, kind: 'veh', cls, x, y, vx: 0, vy: 0, a, w: 0, str: 0, hp: D.hp, maxHp: D.hp, paint: o.paint || (cls === 'taxi' ? '#c9a227' : cls === 'board' ? '#2a2e3a' : pick(CAR_PAINTS)),
    driver: null, boost: 100, burn: 0, dead: false, locked: !!o.locked, engine: false, thr: 0, slip: 0, braking: false, breaking: 0, alarm: 0, bob: rand(0, 6), sparkT: 0, smokeT: 0 };
  G.vehicles.push(v); return v;
}

// Kollisionskreise im Fahrzeugkoordinatensystem (lx, ly, r): Längsreihe, bei breiten Fahrzeugen zwei Spuren (liefert Drehmoment)
const VLAYOUT = {};
function vlayout(cls) {
  if (VLAYOUT[cls]) return VLAYOUT[cls];
  const D = VEHICLES[cls], hl = D.L / 2, hw = D.B / 2, r = Math.max(4, hw * 0.58), lat = hw - r, n = Math.max(2, Math.ceil((D.L - 2 * r) / (r * 1.6)) + 1), arr = [];
  for (let i = 0; i < n; i++) { const lx = -hl + r + i * (D.L - 2 * r) / (n - 1); if (D.B <= 18) arr.push([lx, 0, r]); else arr.push([lx, -lat, r], [lx, lat, r]); }
  return (VLAYOUT[cls] = arr);
}
// Anzahl blockierter Kreise (Gebäude/Wasser/Tore) bei Pose (x, y, a) und Drehmoment-Summe
function vehBlock(v, x, y, a) {
  const c = Math.cos(a), s = Math.sin(a); let n = 0, t = 0;
  for (const [lx, ly, r] of vlayout(v.cls)) if (World.blocked(x + c * lx - s * ly, y + s * lx + c * ly, r, true)) { n++; t += ly; }
  return { n, t };
}

// ---------------- Steuerung ----------------
// "Klassisch": W/S Gas/Bremse, A/D lenken (fahrzeugrelativ). "Direkt": Stick/WASD bildschirmrelativ (Standard bei Touch). PLAN D11.
function driveCtl(v) {
  const i = G.in, direct = Settings.d.drive === 'direct' || i.touchDrive;
  let thr = 0, steer = 0;
  if (!direct) { thr = i.throttle ? 1 : i.brake ? -1 : 0; steer = i.steer; }
  else {
    const m = Math.hypot(i.mx, i.my);
    if (m > 0.12) {
      const tgt = Math.atan2(i.my, i.mx); let err = angDiff(v.a, tgt), want = 1;
      const vf = v.vx * Math.cos(v.a) + v.vy * Math.sin(v.a);
      if (Math.abs(err) > 2.35 && vf < 1.5) { want = -1; err = angDiff(v.a + Math.PI, tgt); }
      steer = clamp(err * 2.4, -1, 1);                     // beim Rückwärtsfahren dreht sign(vf) die Lenkung schon um
      thr = want * Math.min(1, m * 1.15) * (1 - Math.min(0.55, Math.abs(err) * 0.22));
    }
  }
  return { thr, steer, hb: !!i.handbrake, boost: !!i.boost, horn: !!i.horn };
}

function stepVehicle(v, ctl) {
  const D = VEHICLES[v.cls]; let c = Math.cos(v.a), s = Math.sin(v.a);
  let vf = v.vx * c + v.vy * s, vr = -v.vx * s + v.vy * c;
  v.slip = Math.abs(vr);                                                       // Querschlupf: seitliche Geschwindigkeit vor dem Gripabbau
  const damaged = v.hp < v.maxHp * 0.3 ? 0.6 : 1, thr = ctl.thr;
  const boosting = ctl.boost && v.boost > 1 && thr > 0.2;
  if (boosting) { v.boost -= 1.4; if (!v.boosting) Bus.emit('boost', v); } else v.boost = Math.min(100, v.boost + 0.25); v.boosting = boosting;
  const acc = D.accel * (boosting ? 1.7 : 1) * damaged;
  if (thr > 0) vf += thr * acc;
  else if (thr < 0) { if (vf > 0.3) vf = Math.max(0, vf - 0.45 * -thr); else vf = Math.max(-D.top * 0.4, vf + thr * acc * 0.45); }
  v.braking = thr < 0 && vf > 0.3;
  const drag = D.accel / (D.top + D.accel);                                    // so ergibt sich im Beharrungszustand genau D.top
  vf *= 1 - drag * (boosting ? 0.7 : 1);
  if (thr === 0) vf *= 0.988;                                                  // ausrollen
  let grip = D.grip;
  if (ctl.hb) { grip *= 0.15; vf *= 0.985; }
  vr *= 1 - grip;
  v.str += (ctl.steer - v.str) * 0.22;
  v.w = v.str * D.steer * clamp(Math.abs(vf) / 3, 0, 1) * Math.sign(vf) * (ctl.hb ? 1.35 : 1) + (v.w2 || 0); v.w2 = (v.w2 || 0) * 0.85;
  v.vx = c * vf - s * vr; v.vy = s * vf + c * vr; v.vf = vf;                  // Weltgeschwindigkeit in der ALTEN Ausrichtung; die Drehung erzeugt im nächsten Tick Querschlupf (Drift)
  const na = v.a + v.w;
  if (!vehBlock(v, v.x, v.y, na).n) v.a = na; else { v.w = 0; v.str *= 0.5; }
}

function moveVehicle(v) {
  const spd = Math.hypot(v.vx, v.vy); if (spd < 0.01) { v.vx = v.vy = 0; return 0; }
  const n = Math.max(1, Math.ceil(spd / 5)); let dx = v.vx / n, dy = v.vy / n, impact = 0, torque = 0;
  for (let i = 0; i < n; i++) {
    if (dx) { const r = vehBlock(v, v.x + dx, v.y, v.a); if (r.n) { impact = Math.max(impact, Math.abs(v.vx)); torque += r.t; v.vx *= -0.3; dx = 0; } else v.x += dx; }
    if (dy) { const r = vehBlock(v, v.x, v.y + dy, v.a); if (r.n) { impact = Math.max(impact, Math.abs(v.vy)); torque += r.t; v.vy *= -0.3; dy = 0; } else v.y += dy; }
  }
  if (impact > 0.8) {
    const D = VEHICLES[v.cls], sgn = Math.sign(v.vf || 1);
    v.w2 = (v.w2 || 0) + clamp(torque * sgn * impact * 0.0009, -0.06, 0.06);          // Aufprall am Eck dreht das Auto
    if (impact > 2.2) { damageVeh(v, Math.pow(impact - 2.2, 2) * 1.1, 'wall'); Bus.emit('crash', v, impact); sparks(v.x + Math.cos(v.a) * D.L * 0.4, v.y + Math.sin(v.a) * D.L * 0.4, Math.round(impact), '#ffd27a', 4); }
  }
  return impact;
}

// Fahrzeug gegen Fahrzeug: Kreise gegen Kreise, Impuls nach Masse, Schaden beidseitig
function vehPairs(v) {
  const D1 = VEHICLES[v.cls], A = vlayout(v.cls), c1 = Math.cos(v.a), s1 = Math.sin(v.a);
  for (const o of G.vehicles) {
    if (o === v || (o.driver && o.driver === v.driver)) continue;
    if (v.ai && o.ai && (v.ai.ghost > 0 || o.ai.ghost > 0)) continue;
    const D2 = VEHICLES[o.cls], reach = (D1.L + D2.L) / 2 + 6;
    if (Math.abs(o.x - v.x) > reach || Math.abs(o.y - v.y) > reach) continue;
    const c2 = Math.cos(o.a), s2 = Math.sin(o.a); let hit = false, pen = 0;
    for (const [ax, ay, ar] of A) { const px = v.x + c1 * ax - s1 * ay, py = v.y + s1 * ax + c1 * ay;
      for (const [bx, by, br] of vlayout(o.cls)) { const qx = o.x + c2 * bx - s2 * by, qy = o.y + s2 * bx + c2 * by, d = Math.hypot(px - qx, py - qy); if (d < ar + br) { hit = true; pen = Math.max(pen, ar + br - d); } } }
    if (!hit) continue;
    const m1 = D1.mass * (v.dead ? 2.5 : 1), m2 = D2.mass * (o.dead ? 2.5 : 1);
    let nx = o.x - v.x, ny = o.y - v.y; const nd = Math.hypot(nx, ny) || 1; nx /= nd; ny /= nd;
    const k1 = m2 / (m1 + m2), k2 = m1 / (m1 + m2), push = Math.min(pen, 6);
    if (!vehBlock(v, v.x - nx * push * k1, v.y - ny * push * k1, v.a).n) { v.x -= nx * push * k1; v.y -= ny * push * k1; }
    if (!vehBlock(o, o.x + nx * push * k2, o.y + ny * push * k2, o.a).n) { o.x += nx * push * k2; o.y += ny * push * k2; }
    const vn = (v.vx - o.vx) * nx + (v.vy - o.vy) * ny;
    if (vn > 0.2) {
      const j = (1 + 0.35) * vn / (1 / m1 + 1 / m2);
      v.vx -= j / m1 * nx; v.vy -= j / m1 * ny; o.vx += j / m2 * nx; o.vy += j / m2 * ny;
      if (v.ai && o.driver === G.player) v.ai.shaken = 150; if (o.ai && v.driver === G.player) o.ai.shaken = 150;
      if (vn > 2) { damageVeh(v, Math.pow(vn - 2, 2) * 2 * k1 * 1.5, 'veh'); damageVeh(o, Math.pow(vn - 2, 2) * 2 * k2 * 1.5, 'veh'); Bus.emit('crash', v, vn); sparks((v.x + o.x) / 2, (v.y + o.y) / 2, Math.round(vn * 1.5), '#ffd27a', 5); }
    }
  }
}

// ---------------- Schaden ----------------
function damageVeh(v, dmg, src) {
  if (v.dead || dmg <= 0) return;
  const D = VEHICLES[v.cls], p = G.player;
  v.hp -= dmg;
  if (v.driver && v.driver === p) {
    G.hurtFlash = Math.max(G.hurtFlash, Math.min(0.6, dmg / 40));
    if (D.exposed) { p.hp -= dmg * 0.3; if (p.hp <= 0) { killPlayer(); return; } }
  }
  if (v.hp <= 0 && !v.burn) {
    v.burn = Math.round(2.4 * 60); v.hp = 0;
    if (v.driver) { const d = v.driver; exitVehicle(d, true); d.hp -= 30; if (d.hp <= 0) killPlayer(); }
  }
}
// Flächenschaden (Explosionen): Fahrzeuge und Spieler. Kettenreaktion: brennende Autos zünden Nachbarn.
function blast(x, y, radius, dmg) {
  for (const v of G.vehicles) {
    const d = Math.hypot(v.x - x, v.y - y), D = VEHICLES[v.cls];
    if (d < radius + D.L * 0.4) { const f = 1 - clamp(d / (radius + D.L * 0.4), 0, 1) * 0.7; damageVeh(v, dmg * f, 'blast'); const k = 6 * f / D.mass / Math.max(d, 20); v.vx += (v.x - x) * k; v.vy += (v.y - y) * k; }
  }
  const p = G.player;
  if (p && !p.veh) { const d = Math.hypot(p.x - x, p.y - y); if (d < radius * 0.8) { p.hp -= dmg * 0.5 * (1 - d / (radius * 0.8)); G.hurtFlash = 0.6; if (p.hp <= 0) killPlayer(); } }
}
function updateBurning(v) {
  const D = VEHICLES[v.cls];
  if (v.burn > 0) {
    v.burn--;
    if (G.time % 3 === 0) { glow(v.x + rand(-12, 12), v.y + rand(-8, 8), rand(10, 18), R.fn() < 0.5 ? '#ff8a2a' : '#ffd25a', 14, rand(-0.3, 0.3), rand(-0.6, -0.1), 0.3); }
    if (G.time % 4 === 0) smoke(v.x + rand(-8, 8), v.y + rand(-6, 6), 12, 'dark', 50, rand(-0.2, 0.2), -0.4, 0.4);
    if (v.burn === 0) { if (v.od) Bus.emit('crime', 'odVehicle'); v.dead = true; explosion(v.x, v.y, D.expl); v.vx *= 0.3; v.vy *= 0.3; }
  } else if (!v.dead) {
    const f = v.hp / v.maxHp;
    if (f < 0.3 && G.time % 6 === 0) smoke(v.x, v.y, 9, 'dark', 40, rand(-0.2, 0.2), -0.3, 0.35);
    else if (f < 0.6 && G.time % 14 === 0) smoke(v.x, v.y, 8, 'grey', 36, rand(-0.15, 0.15), -0.25, 0.3);
  }
}

// ---------------- Ein- und Aussteigen ----------------
function vehDist(v, x, y) {                      // Abstand zum Fahrzeugrechteck
  const D = VEHICLES[v.cls], c = Math.cos(v.a), s = Math.sin(v.a), lx = (x - v.x) * c + (y - v.y) * s, ly = -(x - v.x) * s + (y - v.y) * c;
  return Math.hypot(Math.max(Math.abs(lx) - D.L / 2, 0), Math.max(Math.abs(ly) - D.B / 2, 0));
}
function nearestVehicle(x, y, maxD = 30) {
  let best = null, bd = maxD;
  for (const v of G.vehicles) { if (v.dead || v.driver || Math.abs(v.x - x) > 90 || Math.abs(v.y - y) > 90) continue; const d = vehDist(v, x, y); if (d < bd) { bd = d; best = v; } }
  return best;
}
function enterVehicle(p, v) {
  const D = VEHICLES[v.cls];
  if (v.ai) {                                   // Carjacking: Fahrer fliegt raus, schreit, flucht
    const c = Math.cos(v.a), s = Math.sin(v.a), px = v.x + s * (D.B / 2 + 10), py = v.y - c * (D.B / 2 + 10), d = makePed(px, py, {});
    d.state = 'flee'; d.panic = 420; d.fx = v.x; d.fy = v.y; d.umb = null; bark(d, barkPick(STR.barks.carjack), 150); v.ai = null; v.locked = false; Bus.emit('crime', 'carjack');
    if (R.fn() < 0.6) d.screamT = 6;
  }
  if (v.locked && !v.unlocked) {                // Aufbrechen: 1 s, Alarm
    if (!v.breaking) { v.breaking = 60; v.alarm = 240; Bus.emit('alarm', v); } return;
  }
  if (v.od) {                                                                                       // OD-Fahrzeug gekapert: Besatzung steigt aus und ist feindlich
    Bus.emit('crime', 'odCarJack'); const c = Math.cos(v.a), s = Math.sin(v.a); for (let k = 0; k < (v.od.cargo || 1); k++) { const q = Police.spawnCop(v.x - s * (D.B / 2 + 10) * (k % 2 ? 1 : -1), v.y + c * (D.B / 2 + 10) * (k % 2 ? 1 : -1), false); q.provoked = true; q.state = 'chase'; }
    v.od = null; v.ai = null; v.locked = false;
  }
  v.driver = p; p.veh = v; p.x = v.x; p.y = v.y; v.engine = true; v.breaking = 0; p.vx = p.vy = 0; p.stride = 0; p.dodge = 0;
  Bus.emit('door', v, true);
  HUD.banner(D.name, D.sub, 1500);
}
function exitVehicle(p, forced) {
  const v = p.veh; if (!v) return;
  const D = VEHICLES[v.cls], c = Math.cos(v.a), s = Math.sin(v.a), spd = Math.hypot(v.vx, v.vy);
  let pos = null;
  for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = v.x + c * ox * (D.L / 2 + 12) - s * oy * (D.B / 2 + 12), y = v.y + s * ox * (D.L / 2 + 12) + c * oy * (D.B / 2 + 12);
    if (!World.blocked(x, y, C.PED_R)) { pos = { x, y }; break; }
  }
  if (!pos) pos = World.freeSpot(v.x, v.y);
  p.x = pos.x; p.y = pos.y; p.vx = v.vx * 0.5; p.vy = v.vy * 0.5; p.veh = null; v.driver = null; v.engine = false;
  if (spd > 6 && !forced) { p.hp -= (spd - 5) * 6; G.hurtFlash = 0.4; if (p.hp <= 0) killPlayer(); }    // Abrollen
  if (!forced) Bus.emit('door', v, false);
}

// ---------------- Schleife ----------------
function updateVehicles() {
  const p = G.player; let near = null, nd = 1e9;
  if (p && !p.veh && G.state === 'play') { near = nearestVehicle(p.x, p.y); if (near) nd = vehDist(near, p.x, p.y); }
  G.nearVeh = near;
  if (p && G.in.enterP) { if (p.veh) { if (Math.hypot(p.veh.vx, p.veh.vy) < 14) exitVehicle(p); } else if (near && Math.hypot(near.vx, near.vy) < (near.ai ? 4.5 : 2.5)) enterVehicle(p, near); }
  for (const v of G.vehicles) {
    if (v.alarm > 0) v.alarm--;
    if (v.flameT > 0) v.flameT -= 0.5;
    if (v.empT > 0) { v.empT--; v.vx *= 0.94; v.vy *= 0.94; if (!v.driver) { if (G.time % 20 === 0) sparks(v.x, v.y, 2, '#3fe8ff', 3); updateBurning(v); continue; } }
    if (v.breaking > 0) { if (!near || near !== v || nd > 40) v.breaking = 0; else if (--v.breaking === 0) { v.unlocked = true; Bus.emit('crime', 'breakin'); if (p && !p.veh) enterVehicle(p, v); } }
    const moving = v.vx * v.vx + v.vy * v.vy > 0.0025 || v.w2, active = v.driver || v.burn > 0 || moving || v.ai;
    if (!active) { updateBurning(v); continue; }
    if (v.dead) { v.vx *= 0.9; v.vy *= 0.9; moveVehicle(v); vehPairs(v); continue; }
    const ctl = v.driver === p ? driveCtl(v) : v.od ? odCarCtl(v) : v.ai ? trafficCtl(v) : { thr: 0, steer: 0, hb: false, boost: false };
    if (v.driver === p) v.engine = true;
    stepVehicle(v, ctl);
    if (v.driver !== p && !v.ai) { v.vx *= 0.97; v.vy *= 0.97; }
    moveVehicle(v); vehPairs(v); updateBurning(v);
    if (v.driver) { p.x = v.x; p.y = v.y; p.a = v.a; p.vx = v.vx; p.vy = v.vy; }
    const D = VEHICLES[v.cls];
    // Bremsspuren bei Querschlupf/Handbremse (nicht bei Schwebern), Spritzwasser in Pfützen
    if (!D.hover && v.slip > 1.4 && G.time % 2 === 0) { const c = Math.cos(v.a), s = Math.sin(v.a); for (const sd of [-1, 1]) Ground.skid(v.x - c * D.L * 0.3 - s * sd * D.B * 0.4, v.y - s * D.L * 0.3 + c * sd * D.B * 0.4, Math.atan2(v.vy, v.vx)); }
    if (!D.hover && Math.hypot(v.vx, v.vy) > 3 && G.time % 3 === 0 && World.surface(v.x, v.y) === 'pfuetze') { for (let k = 0; k < 3; k++) glow(v.x + rand(-8, 8), v.y + rand(-8, 8), rand(3, 6), '#9fd0ff', 10, rand(-1.2, 1.2), rand(-1.2, 1.2), 0.2); Bus.emit('splash', v); }
  }
}


// ---------------- Verkehr (PLAN §4.8, §7.5): Spur-Folger mit Kreuzungswahl, Vorausschau-Bremsen, Hupen, Spawn-Ring ----------------
const TRAFFIC_MAX = { docks: 14, neon: 22, krone: 16 };
// Spurversatz: Verkehr fährt 16 px von der Bordsteinseite weg (zur Straßenmitte), geparkte Autos stehen am Bordstein
function laneOff(dx, dy) { return dx ? [0, dx < 0 ? 16 : -16] : [dy > 0 ? 16 : -16, 0]; }
function tileLane(x, y) {
  const T = C.TILE, tx = Math.floor(x / T), ty = Math.floor(y / T); if (tx < 0 || ty < 0 || tx >= World.W || ty >= World.H) return null;
  const k = World.tiles[ty * World.W + tx];
  if (k === TK.JUNCTION) return { junction: true, tx, ty };
  if (k === TK.ROAD || k === TK.BRIDGE || k === TK.CROSSWALK) { const i = (ty * World.W + tx) * 2, dx = World.lane[i], dy = World.lane[i + 1]; if (dx || dy) return { dx, dy, tx, ty }; }
  return null;
}
// Ausfahrt an einer Kreuzung wählen: geradeaus 60 / rechts 25 / links 15 %; nur Ausfahrten mit passender Spur (keine Sackgassen)
function chooseExit(v, L) {
  const T = C.TILE, H = [[1, 0], [0, 1], [-1, 0], [0, -1]], a = Math.atan2(Math.sin(v.a), Math.cos(v.a)), hi = ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4, h = H[hi], cand = [];
  for (let jy = -1; jy <= 1; jy++) for (let jx = -1; jx <= 1; jx++) {
    const jt = tileLane((L.tx + jx + 0.5) * T, (L.ty + jy + 0.5) * T); if (!jt || !jt.junction) continue;
    for (let di = 0; di < 4; di++) {
      const d = H[di]; if (d[0] === -h[0] && d[1] === -h[1]) continue;
      let x = L.tx + jx, y = L.ty + jy, n = 0; while (n++ < 4) { x += d[0]; y += d[1]; const t = tileLane((x + 0.5) * T, (y + 0.5) * T); if (!t) break; if (t.junction) continue; if (t.dx === d[0] && t.dy === d[1]) { const cr = h[0] * d[1] - h[1] * d[0], o = laneOff(t.dx, t.dy); cand.push({ x: (x + 0.5) * T + o[0], y: (y + 0.5) * T + o[1], w: di === hi ? 60 : cr > 0 ? 25 : 15 }); } break; }
    }
  }
  if (!cand.length) return null;
  let s = 0; for (const c of cand) s += c.w; let r = R.fn() * s; for (const c of cand) { r -= c.w; if (r <= 0) return c; } return cand[0];
}
function trafficCtl(v) {
  const ai = v.ai, D = VEHICLES[v.cls], c = Math.cos(v.a), s = Math.sin(v.a), spd = Math.hypot(v.vx, v.vy), T = C.TILE;
  if (ai.shaken > 0) { ai.shaken--; if (ai.shaken % 50 === 20) honk(v); return { thr: -1, steer: 0, hb: true, boost: false }; }     // nach einem Rempler: stehen bleiben und hupen
  const look = 38 + spd * 5, L = tileLane(v.x + c * look, v.y + s * look); let tgt = null, scale = 1;
  if (L && L.junction) { if (ai.exit === undefined) ai.exit = chooseExit(v, L); tgt = ai.exit; scale = 0.55; }
  else if (L) { ai.exit = undefined; ai.lane = L; const o = laneOff(L.dx, L.dy); tgt = { x: (L.tx + 0.5) * T + L.dx * 46 + o[0], y: (L.ty + 0.5) * T + L.dy * 46 + o[1] }; }
  if (!tgt) tgt = ai.lane ? { x: (ai.lane.tx + 0.5) * T + ai.lane.dx * 90, y: (ai.lane.ty + 0.5) * T + ai.lane.dy * 90 } : { x: v.x + c * 100, y: v.y + s * 100 };
  const err = angDiff(v.a, Math.atan2(tgt.y - v.y, tgt.x - v.x));
  let want = D.top * 0.55 * scale * (1 - Math.min(0.5, Math.abs(err) * 0.5));
  // Vorausschau: Fahrzeuge und Menschen vor mir (Kasten 50 + 9 x Tempo lang)
  let gap = 1e9; const reach = 55 + spd * 9;
  const chk = (ox, oy, hw) => { const rx = ox - v.x, ry = oy - v.y, along = rx * c + ry * s, lat = -rx * s + ry * c; if (along > 0 && along < reach + hw && Math.abs(lat) < D.B / 2 + hw + 4) gap = Math.min(gap, along - D.L / 2 - hw); };
  for (const o of G.vehicles) if (o !== v && !(o.driver && o.driver === v.driver) && !(ai.ghost > 0 && o.ai)) chk(o.x, o.y, VEHICLES[o.cls].B * 0.5 + (o.ai || o.driver || o.dead ? 6 : 0));
  for (const q of G.peds) if (q.state !== 'dead' && Math.abs(q.x - v.x) < reach + 30 && Math.abs(q.y - v.y) < reach + 30) chk(q.x, q.y, 9);
  if (G.player && !G.player.veh) chk(G.player.x, G.player.y, 9);
  if (gap < 1e8) want = Math.min(want, Math.max(0, (gap - 16) * 0.09));
  // Kreuzung nur befahren, wenn sie nicht schon belegt ist (verhindert das Verkeilen); steckt der Verkehr trotzdem > 200 Ticks, fährt ein Wagen kurz "geisterhaft" durch die anderen
  if (L && L.junction && !(tileLane(v.x, v.y) || {}).junction) { let busy = 0; const jx = (L.tx + 0.5) * T, jy = (L.ty + 0.5) * T; for (const o of G.vehicles) if (o !== v && Math.abs(o.x - jx) < 110 && Math.abs(o.y - jy) < 110 && (tileLane(o.x, o.y) || {}).junction) busy++; if (busy >= 2 && !(ai.ghost > 0)) { gap = Math.min(gap, 30); want = 0; } }
  if (ai.ghost > 0) ai.ghost--;
  ai.stop = (spd < 0.3 && (gap < 60 || want === 0)) ? ai.stop + 1 : 0;
  if (ai.stop === 200 && !ai.ghost) ai.ghost = 100;
  if (ai.stop % 150 === 130) honk(v);
  if (ai.stop > 900 && !onScreen(v.x, v.y, 60)) v.despawn = true;
  return { thr: spd < want ? (gap < 40 ? -1 : 0.8) : spd > want + 0.6 ? -0.6 : 0, steer: clamp(err * 2.2, -1, 1), hb: false, boost: false };
}
function honk(v) { Aud.play('hupe', { x: v.x, y: v.y, gain: 0.8, cat: 'sfx' }); if (onScreen(v.x, v.y, 0) && R.fn() < 0.5) for (const p of G.peds) if (p.state === 'walk' && Math.hypot(p.x - v.x, p.y - v.y) < 220) { bark(p, 'Ja, ja! Ich geh ja schon!', 120); break; } }
function updateTraffic() {
  const cam = G.cam, z = G.zoom || 1, half = Math.hypot(VIEW_W, VIEW_H) / 2 / z, d = G.district ? G.district.id : 'neon';
  let n = 0;
  for (let i = G.vehicles.length - 1; i >= 0; i--) { const v = G.vehicles[i]; if (!v.ai) continue; n++;
    if (v.despawn || (!v.driver && Math.hypot(v.x - cam.x, v.y - cam.y) > half * 2.4)) { G.vehicles.splice(i, 1); n--; } }
  if (G.time % 20 !== 0 || n >= TRAFFIC_MAX[d]) return;
  const T = C.TILE;
  for (let t = 0; t < 8; t++) {
    const ang = R.fn() * TAU, r = half * rand(1.15, 1.8), x = cam.x + Math.cos(ang) * r, y = cam.y + Math.sin(ang) * r, L = tileLane(x, y);
    if (!L || L.junction || onScreen(x, y, 80)) continue;
    const px = (L.tx + 0.5) * T, py = (L.ty + 0.5) * T; let free = true;
    for (const o of G.vehicles) if (Math.abs(o.x - px) < 110 && Math.abs(o.y - py) < 110) { free = false; break; }
    if (!free) continue;
    const dist = districtAt(L.tx).id, tbl = TRAFFIC_MIX[dist]; let s = 0; for (const k in tbl) s += tbl[k]; let q = R.fn() * s, cls = 'limo'; for (const k in tbl) { q -= tbl[k]; if (q <= 0) { cls = k; break; } }
    const v = spawnVehicle(cls, px, py, Math.atan2(L.dy, L.dx), {}); if (vehBlock(v, v.x, v.y, v.a).n) { G.vehicles.pop(); continue; }
    v.ai = {}; v.engine = true; v.vx = Math.cos(v.a) * VEHICLES[cls].top * 0.4; v.vy = Math.sin(v.a) * VEHICLES[cls].top * 0.4; break;
  }
}

// ---------------- Geparkte Fahrzeuge (PLAN §7.2): am Bordstein, parallel zur Fahrspur; Hoverboards auf Gehwegen der Neonmeile/Krone ----------------
function populateVehicles(seed) {
  G.vehicles = []; VEH_ID = 1;
  const rnd = rng(seed + 11), W = World.W, H = World.H, T = C.TILE, tl = World.tiles, occ = new Map(), CAP = 300;
  const free = (x, y, d) => { for (let gy = Math.floor((y - d) / 128); gy <= Math.floor((y + d) / 128); gy++) for (let gx = Math.floor((x - d) / 128); gx <= Math.floor((x + d) / 128); gx++) { const l = occ.get(gx + gy * 4096); if (l) for (const o of l) if (Math.hypot(o[0] - x, o[1] - y) < d) return false; } return true; };
  const mark = (x, y) => { const k = Math.floor(x / 128) + Math.floor(y / 128) * 4096; let l = occ.get(k); if (!l) occ.set(k, l = []); l.push([x, y]); };
  const mixPick = (tbl) => { let s = 0; for (const k in tbl) s += tbl[k]; let r = rnd() * s; for (const k in tbl) { r -= tbl[k]; if (r <= 0) return k; } return 'limo'; };
  const nearCross = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = x + dx, ty = y + dy; if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue; const k = tl[ty * W + tx]; if (k === TK.JUNCTION || k === TK.CROSSWALK) return true; } return false; };
  const lane = World.lane;
  for (let y = 1; y < H - 1 && G.vehicles.length < CAP; y++) for (let x = 1; x < W - 1 && G.vehicles.length < CAP; x++) {
    if (tl[y * W + x] !== TK.ROAD || hash3(x, y, 17) % 100 >= 22) continue;
    const ldx = lane[(y * W + x) * 2], ldy = lane[(y * W + x) * 2 + 1]; if (!ldx && !ldy) continue;
    const curb = ldx ? tl[(y + (ldx < 0 ? -1 : 1)) * W + x] : tl[y * W + x + (ldy > 0 ? -1 : 1)];
    if (curb !== TK.SIDEWALK || nearCross(x, y)) continue;
    const cx = (x + 0.5) * T + (ldy ? (ldy > 0 ? -17 : 17) : 0), cy = (y + 0.5) * T + (ldx ? (ldx < 0 ? -17 : 17) : 0);      // dicht am Bordstein: die Fahrspur bleibt für den Verkehr frei
    if (!free(cx, cy, 110)) continue;
    const dist = districtAt(x).id, cls = mixPick(TRAFFIC_MIX[dist]), D = VEHICLES[cls];
    const v = spawnVehicle(cls, cx, cy, Math.atan2(ldy, ldx), { locked: rnd() < 0.7, paint: cls === 'taxi' ? '#c9a227' : CAR_PAINTS[Math.floor(rnd() * CAR_PAINTS.length)] });
    if (vehBlock(v, v.x, v.y, v.a).n) { G.vehicles.pop(); continue; }
    mark(cx, cy); void D;
  }
  // Parkplätze ('.'-Zellen): Raster aus Autos auf den Lot-Kacheln
  for (let r = 0; r < ZONE_ROWS.length; r++) for (let c = 0; c < ZONE_ROWS[0].length; c++) if (ZONE_ROWS[r][c] === '.') {
    for (let ty = 3; ty < 8; ty += 2) for (let tx = 3; tx < 8; tx += 2) if (rnd() < 0.55) { const x = (c * 8 + tx + 0.5) * T, y = (r * 8 + ty + 0.5) * T; if (tl[(r * 8 + ty) * W + c * 8 + tx] !== TK.LOT) continue;
      const cls = mixPick(TRAFFIC_MIX[districtAt(c * 8).id]), v = spawnVehicle(cls, x, y, rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2, { locked: rnd() < 0.5 }); if (vehBlock(v, v.x, v.y, v.a).n) G.vehicles.pop(); }
  }
  // Hoverboards: Gehwegkacheln in Neonmeile und Krone, immer entsperrt
  let nb = 0;
  for (let y = 1; y < H - 1 && nb < 26; y++) for (let x = 100; x < W - 1 && nb < 26; x++) if (tl[y * W + x] === TK.SIDEWALK && hash3(x, y, 41) % 520 === 0) {
    const b = spawnVehicle('board', (x + 0.5) * T, (y + 0.5) * T, rnd() * TAU, {}); if (vehBlock(b, b.x, b.y, b.a).n) G.vehicles.pop(); else nb++;
  }
}

// ---------------- Rendering ----------------
// layer 'body': vor der Lightmap (Lack, Schatten, Fahrer); 'glow': additiv danach (Neon, Scheinwerfer)
function drawVehicles(layer) {
  const cam = G.cam, z = G.zoom || 1, hw = VIEW_W / 2 / z + 90, hh = VIEW_H / 2 / z + 90;
  for (const v of G.vehicles) {
    if (v.x < cam.x - hw || v.x > cam.x + hw || v.y < cam.y - hh || v.y > cam.y + hh) continue;
    const D = VEHICLES[v.cls], art = vehicleArt(v.cls, v.paint), bob = D.hover ? Math.sin(G.time * 0.08 + v.bob) * 1.6 : 0, lift = D.hover ? 3 : 0;
    if (layer === 'body') {
      ctx.globalAlpha = D.hover ? 0.45 : 0.75; ctx.drawImage(shadowSprite(D.L * 0.52, D.B * 0.5), v.x - D.L * 0.52 - 12 + 3 + lift, v.y - D.B * 0.5 - 12 + 4 + lift); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(v.x, v.y + bob); ctx.rotate(v.a);
      if (v.dead) ctx.drawImage(tinted(art.body, 'wreck|' + v.cls + '|' + v.paint, '#0c0c10'), -art.w / 2, -art.h / 2, art.w, art.h);
      else ctx.drawImage(art.body, -art.w / 2, -art.h / 2, art.w, art.h);
      if (v.cls === 'bike' && v.driver) ctx.drawImage(riderSprite(false), -18, -18);
      ctx.restore();
      if (D.board && v.driver) drawPerson(v.x, v.y + bob - 2, v.a, PLAYER_DESIGN, 2, { scale: 0.95 });
    } else if (!v.dead) {
      let a = v.engine || v.driver ? 1 : 0.5;
      if (v.hp < v.maxHp * 0.3) a *= 0.4 + 0.6 * ((G.time + v.id * 7) % 9 < 5);          // kaputte Elektrik flackert
      if (v.alarm > 0) a = (G.time >> 3) & 1 ? 1 : 0.2;
      ctx.save(); ctx.translate(v.x, v.y + bob); ctx.rotate(v.a); ctx.globalAlpha = a; ctx.drawImage(art.glow, -art.w / 2, -art.h / 2, art.w, art.h);
      if (v.od && (v.od.siren || G.wanted.level > 0) && !v.od.leave) { const k = (G.time >> 3) & 1; ctx.globalAlpha = 1; ctx.drawImage(glowSprite(k ? '#ff2a3a' : '#2a6bff'), -h0(D) * 0.2 - 12, -D.B * 0.3 - 12, 24, 24); ctx.drawImage(glowSprite(k ? '#2a6bff' : '#ff2a3a'), -h0(D) * 0.2 - 12, D.B * 0.3 - 12, 24, 24); }
      if (v.braking) { ctx.globalAlpha = 0.9; ctx.drawImage(glowSprite('#ff2a3a'), -D.L / 2 - 8, -D.B * 0.7 - 8, 16, 16); ctx.drawImage(glowSprite('#ff2a3a'), -D.L / 2 - 8, D.B * 0.7 - 8, 16, 16); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}
// Lichter für die Lightmap: Scheinwerferkegel, Rücklichter, Unterboden-Glow der Schweber, Feuer
function h0(D) { return D.L / 2; }
function vehicleLights() {
  for (const v of G.vehicles) {
    if (!onScreen(v.x, v.y, 330)) continue;
    const D = VEHICLES[v.cls], c = Math.cos(v.a), s = Math.sin(v.a), fx = v.x + c * D.L * 0.45, fy = v.y + s * D.L * 0.45;
    if (v.burn > 0) { Lights.add(v.x, v.y, 120 + 30 * Math.sin(G.time * 0.4), '#ff8a30', 0.8); continue; }
    if (v.dead) continue;
    const flick = v.hp < v.maxHp * 0.3 && (G.time + v.id * 7) % 9 >= 5 ? 0.25 : 1;
    if (D.hover) Lights.add(v.x, v.y, D.board ? 52 : 72, D.glow, (v.engine ? 0.85 : 0.5) * flick);
    if (v.engine || v.driver) {
      if (!D.board) Lights.cone(fx, fy, 270, '#fff2c8', 0.9 * flick, v.a);
      else Lights.add(fx, fy, 40, '#bfe8ff', 0.5);
      Lights.add(v.x - c * D.L * 0.48, v.y - s * D.L * 0.48, v.braking ? 52 : 28, '#ff2a3a', (v.braking ? 1 : 0.7) * flick);
    }
    if (v.alarm > 0 && (G.time >> 3) & 1) Lights.add(v.x, v.y, 90, '#ffb35c', 0.9);
    if (v.od && (v.od.siren || G.wanted.level > 0) && !v.od.leave) Lights.add(v.x, v.y, 230, ((G.time >> 3) & 1) ? '#ff2a3a' : '#2a6bff', 1.0);
  }
}
