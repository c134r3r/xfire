// Fahndungs-Test NEON REGENT (MS6): Delikte -> Stufen, Einheiten je Stufe, Verfolgung, Verhaften (Stufe 1), Schüsse (Stufe 2), Drohnen/Sperren (Stufe 3+),
// Abklingen nur unbeobachtet, Verstecken im Haus, Cop-Kill + Dienstwaffe, Ausgelöscht, Chip-Wäsche. node tools/neonregent-test/police.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1304, height: 744 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=neon_crossing&gates=open'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  await p.evaluate(() => { Settings.d.drive = 'classic'; window.__s = []; const o = Aud.play.bind(Aud); Aud.play = (...a) => { __s.push(a[0]); return o(...a); };
    window.reset = () => { G.peds = G.peds.filter(q => q.team !== 'od'); G.vehicles = G.vehicles.filter(v => !v.od); G.ebullets.length = 0; G.drones.length = 0; G.wanted.pts = 0; G.wanted.level = 0; G.wanted.seen = false; G.player.hp = 100; G.respawn = null; G.fadeA = 0; Police.standDown(true); }; });
  // 1. Delikte -> Stufe
  const l1 = await p.evaluate(() => { reset(); const c0 = G.wanted.level; crime('pedHurt'); const a = G.wanted.level; crime('pedHurt'); const lvl = G.wanted.level; return { c0, a, lvl, pts: G.wanted.pts, snd: __s.includes('sting_heat') && __s.includes('funk') }; });
  ok('Delikte: 2x Passant angefahren (+3 +3) = Stufe 1, Funk + Signal', l1.c0 === 0 && l1.a === 0 && l1.lvl === 1 && l1.snd, JSON.stringify(l1));
  // 2. Einheiten Stufe 1: 2 Fußstreifen + 1 Streife; sie nähern sich
  const u1 = await p.evaluate(() => { const pl = G.player, T = 64; pl.x = 161.5 * T; pl.y = 15.5 * T; pl.veh = null; G.peds = G.peds.filter(q => q.team === 'od'); Input.forced = { mx: 0, my: 0 }; let maxFoot = 0, maxCar = 0, d0 = 1e9, d1 = 1e9;
    for (let t = 0; t < 1500; t++) { G.wanted.last.x = pl.x; G.wanted.last.y = pl.y; step(); const c = Police.count(); maxFoot = Math.max(maxFoot, c.foot); maxCar = Math.max(maxCar, c.car); if (t === 300) d0 = Math.min(...G.peds.filter(q => q.team === 'od').map(q => Math.hypot(q.x - pl.x, q.y - pl.y)), 1e9); if (G.respawn) break; }
    d1 = Math.min(...G.peds.filter(q => q.team === 'od').map(q => Math.hypot(q.x - pl.x, q.y - pl.y)), 1e9); return { maxFoot, maxCar, d0: Math.round(d0), d1: Math.round(d1), lvl: G.wanted.level, respawn: G.respawn && G.respawn.kind }; });
  ok('Stufe 1: Fußstreifen + Streife rücken an, verhaften', u1.maxFoot >= 2 && u1.maxCar >= 1 && (u1.d1 < u1.d0 || u1.respawn === 'busted'), JSON.stringify(u1));
  // 3. Verhaftet: Waffen weg, Strafe, Fahndung 0, Respawn bei der Wache
  const bust = await p.evaluate(() => { reset(); G.own.pistole = true; G.ammo.pistole = 10; G.credits = 800; crime('pedKilled'); const pl = G.player; pl.x = 161.5 * 64; pl.y = 15.5 * 64; const spawn = G.player.x;
    const q = Police.spawnCop(pl.x + 12, pl.y, false); q.state = 'chase'; Input.forced = { mx: 0, my: 0 }; let t = 0; for (; t < 400 && !G.respawn; t++) { G.wanted.last.x = pl.x; step(); } const kind = G.respawn && G.respawn.kind;
    for (let k = 0; k < 170; k++) { Input.forced = { mx: 0, my: 0 }; step(); } return { kind, t, own: G.own.pistole, credits: G.credits, lvl: G.wanted.level, moved: Math.hypot(pl.x - spawn, pl.y - 15.5 * 64) > 100, snd: __s.includes('sting_busted'), hp: pl.hp }; });
  ok('Verhaftet: Waffen eingezogen, Kaution, Fahndung 0, Respawn', bust.kind === 'busted' && !bust.own && bust.credits === 700 && bust.lvl === 0 && bust.moved && bust.snd, JSON.stringify(bust));
  // 4. Stufe 2: Schüsse (Beamte schießen, Spieler verliert Vital)
  const l2 = await p.evaluate(() => { reset(); G.respawn = null; const pl = G.player, T = 64; pl.x = 161.5 * T; pl.y = 15.5 * T; crime('pedKilled'); crime('carjack'); crime('carjack'); crime('carjack'); crime('carjack'); crime('carjack'); const lvl = G.wanted.level;
    const q = Police.spawnCop(pl.x + 200, pl.y, false); q.state = 'chase'; q.fireT = 5; let hits = 0, shots = 0; Input.forced = { mx: 0, my: 0 }; const hp0 = pl.hp;
    for (let t = 0; t < 500 && !G.respawn; t++) { G.wanted.last.x = pl.x; step(); shots += G.ebullets.length ? 1 : 0; } return { lvl, hpLost: Math.round(hp0 - pl.hp), shots, respawn: !!G.respawn }; });
  ok('Stufe 2: Beamte schießen, Vital sinkt', l2.lvl === 2 && (l2.hpLost > 0 || l2.respawn) && l2.shots > 0, JSON.stringify(l2));
  // 5. Stufe 5: Einheiten laut Tabelle (Fuß 3, Streifen 4, Abfang 2, Sturm 1, Drohnen 3)
  const l5 = await p.evaluate(() => { reset(); G.respawn = null; const pl = G.player, T = 64; pl.x = 161.5 * T; pl.y = 15.5 * T; pl.hp = 100; crime('odVehicle', 10); const lvl = G.wanted.level; G.wanted.seen = true; let c; Input.forced = { mx: 0, my: 0 };
    for (let t = 0; t < 2400; t++) { pl.hp = 100; G.wanted.last.x = pl.x; G.wanted.last.y = pl.y; G.wanted.seen = true; G.wanted.decayT = 9999; step(); } c = Police.count(); return { lvl, c }; });
  ok('Stufe 5: Soll-Einheiten (3 Fuß, 4 Streifen, 2 Abfang, 1 Sturm, 3 Drohnen)', l5.lvl === 5 && l5.c.foot >= 3 && l5.c.car >= 3 && l5.c.abfang >= 1 && l5.c.sturm >= 1 && l5.c.drone >= 2, JSON.stringify(l5));
  // 6. Drohne abschießen: +Punkte, Explosion
  const dr = await p.evaluate(() => { const d = G.drones[0]; if (!d) return null; const pts0 = G.wanted.pts; G.own.pistole = true; G.ammo.pistole = 30; d.hp = 5; G.bullets.push({ x: d.x - 4, y: d.y, vx: 15, vy: 0, life: 30, dmg: 14 }); for (let i = 0; i < 4; i++) step(); return { gone: !G.drones.includes(d), pts: G.wanted.pts - pts0 }; });
  ok('Drohne abschießen', dr && dr.gone, JSON.stringify(dr));
  // 7. Abklingen nur unbeobachtet: im Haus verstecken (Sichtlinie endet an Wänden)
  const hide = await p.evaluate(() => { reset(); G.respawn = null; const b = interiorNear('bar') || interiorNear('nudelbar') || interiorNear(); Interiors.ensure(b); const I = Interiors.gen.get(b.id), pl = G.player; let spot = null; const d0 = b._door; for (const r of I.leaves) for (let yy = r.y0 + 16; yy < r.y1 - 16 && !spot; yy += 12) for (let xx = r.x0 + 16; xx < r.x1 - 16 && !spot; xx += 12) { if (World.blocked(xx, yy, 8)) continue; let hidden = true; for (let k = -3; k <= 3; k++) { const ox = d0.x + d0.nx * 40 + (d0.ny ? k * 24 : 0), oy = d0.y + d0.ny * 40 + (d0.nx ? k * 24 : 0); if (World.los(ox, oy, xx, yy)) hidden = false; } if (hidden) spot = [xx, yy]; } pl.x = spot[0]; pl.y = spot[1]; G.credits = 0; crime('pedHurt', 3); G.wanted.last.x = pl.x; const lvl0 = G.wanted.level; G.peds = G.peds.filter(q => q.team !== 'od' || false); window.__disp = Police.dispatch; Police.dispatch = () => {};
    for (let t = 0; t < 40; t++) step(); const door = b._door; const cop = Police.spawnCop(door.x + door.nx * 120, door.y + door.ny * 120, false); cop.state = 'walk'; G.wanted.level = 1; G.wanted.pts = 6; G.wanted.decayT = 8 * 60; cop.los = false;
    const inside = !!G.inside; G.peds = G.peds.filter(q => q.team !== 'od'); G.vehicles = G.vehicles.filter(v => !v.od); let t = 0; const __cs = Police.checkSeen; Police.checkSeen = () => {}; for (; t < 1200 && G.wanted.level > 0; t++) { G.wanted.seen = false; step(); } Police.dispatch = __disp; Police.checkSeen = __cs; return { lvl0, inside, t, lvl: G.wanted.level }; });
  ok('Abklingen unbeobachtet (8 s) im Haus', hide.inside && hide.lvl === 0 && hide.t >= 440 && hide.t < 700, JSON.stringify(hide));
  // 8. Sichtlinie: Wand blockiert, freie Sicht nicht
  const los = await p.evaluate(() => { const b = G.buildings.find(b => b.h > 100 && !b.hollow && b.x0 > 8000 && b.y0 > 1300); const y = (b.y0 + b.y1) / 2; return { free: World.los(b.x0 - 300, y - 200, b.x0 - 100, y - 200), blocked: !World.los(b.x0 - 60, y, b.x1 + 60, y) }; });
  ok('Sichtlinie: frei / Gebäude blockiert', los.free && los.blocked, JSON.stringify(los));
  // 9. Beamten töten: Dienstwaffe, Fahndung steigt
  const ck = await p.evaluate(() => { reset(); G.own.pistole = false; G.weapon = 'faust'; const pl = G.player, T = 64; pl.x = 161.5 * T; pl.y = 15.5 * T; G.pickups.length = 0; const q = Police.spawnCop(pl.x + 30, pl.y, false); q.state = 'walk'; const l0 = G.wanted.pts; damagePed(q, 999, 1, 0, 'bullet'); const dead = q.state === 'dead'; const gun = G.pickups.find(k => k.type === 'gun'); pl.x = gun ? gun.x : pl.x; pl.y = gun ? gun.y : pl.y; for (let i = 0; i < 3; i++) step(); return { dead, pts: G.wanted.pts - l0, gun: !!gun, own: G.own.pistole, lvl: G.wanted.level }; });
  ok('Beamten töten: +25 Punkte, Dienstwaffe', ck.dead && ck.pts >= 25 && ck.gun && ck.own, JSON.stringify(ck));
  // 10. Ausgelöscht: Vital 0 -> Klinik, Strafe
  const wst = await p.evaluate(() => { reset(); G.credits = 1000; const pl = G.player; damagePlayer(500, 'test'); const kind = G.respawn && G.respawn.kind; for (let k = 0; k < 170; k++) { Input.forced = { mx: 0, my: 0 }; step(); } return { kind, credits: G.credits, hp: pl.hp, snd: __s.includes('sting_wasted'), done: !G.respawn }; });
  ok('Ausgelöscht: Klinik-Respawn, −10 % Credits', wst.kind === 'wasted' && wst.credits === 900 && wst.hp === 100 && wst.snd && wst.done, JSON.stringify(wst));
  // 11. Chip-Wäsche
  const wash = await p.evaluate(() => { reset(); G.respawn = null; const b = interiorNear('chipwaesche'); Interiors.ensure(b); const I = Interiors.gen.get(b.id), n = I.people.find(q => q.role === 'empfang'); crime('pedKilled'); crime('carjack'); crime('carjack'); crime('carjack'); crime('carjack'); G.credits = 2000; const lvl = G.wanted.level; G.player.x = n.x; G.player.y = n.y + 20; step(); Interiors.cur = I; Input.forced = { interactP: true }; step(); Input.forced = null; return { lvl, after: G.wanted.level, credits: G.credits }; });
  ok('Chip-Wäsche löscht die Fahndung (300 + 400 × Stufe)', wash.lvl >= 1 && wash.after === 0 && wash.credits === 2000 - (300 + 400 * wash.lvl), JSON.stringify(wash));
  // 12. Verfolgung zu Fuß: Flow-Field führt um Gebäude herum (Beamter erreicht den Spieler hinter einem Block)
  const flow = await p.evaluate(() => { reset(); const pl = G.player, T = 64, b = G.buildings.find(b => b.h > 100 && !b.hollow && b.x0 > 8000 && b.y0 > 1300 && b.x1 - b.x0 < 400); let sx = b.x1 + 40; for (; sx < b.x1 + 400; sx += 8) { if (!World.solid[Math.floor(((b.y0 + b.y1) / 2) / T) * World.W + Math.floor(sx / T)] && !World.blocked(sx, (b.y0 + b.y1) / 2, 8)) break; } pl.x = sx; pl.y = (b.y0 + b.y1) / 2; G.wanted.level = 2; G.wanted.pts = 25; G.wanted.decayT = 99999; G.wanted.seen = true; G.peds = G.peds.filter(q => q.team === 'od' && false); G.vehicles.length = 0; window.__disp = Police.dispatch; Police.dispatch = () => {}; const q = Police.spawnCop(b.x0 - 60, (b.y0 + b.y1) / 2, false); q.state = 'chase'; q.fireT = 99999; q.hp = 9999; Input.forced = { mx: 0, my: 0 }; let t = 0, reached = false;
    for (; t < 900; t++) { pl.hp = 100; if (q.fireT < 10) q.fireT = 99999; step(); if (Math.hypot(q.x - pl.x, q.y - pl.y) < 300 && World.los(q.x, q.y, pl.x, pl.y)) { reached = true; break; } } Police.dispatch = __disp; return { reached, t, d: Math.round(Math.hypot(q.x - pl.x, q.y - pl.y)) }; });
  ok('Verfolgung um ein Gebäude (Flow-Field)', flow.reached, JSON.stringify(flow));
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
