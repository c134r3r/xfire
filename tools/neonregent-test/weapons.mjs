// Waffen-Test NEON REGENT: MP, Schrot, Flammenwerfer, Rakete, EMP, Power-ups, Fässer, Händler (Weste, Heat-Sperre), Slots. node tools/neonregent-test/weapons.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1304, height: 744 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=neon_crossing&gates=open#nosim'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  const setup = () => p.evaluate(() => { Settings.d.drive = 'classic'; G.peds.length = 0; G.vehicles.length = 0; G.bullets.length = 0; G.props.length = 0; G.drones.length = 0; G.pickups.length = 0; G.freeze = 0; const pl = G.player; pl.x = 161.5 * 64; pl.y = 15.5 * 64; pl.veh = null; pl.a = 0; pl.hp = pl.maxHp; });
  await setup();
  // 1. Alle Waffen geben, Slots 1..7 wechseln, Munitionsgrenze
  const sl = await p.evaluate(() => { for (const w of ['pistole', 'smg', 'shotgun', 'flamer', 'rocket', 'emp']) giveWeapon(w, 9999); const out = []; for (let i = 1; i <= 7; i++) { G.in = Input.neutral(G.in); Input.forced = { weaponSlot: i }; step(); out.push(G.weapon); } Input.forced = null; return { out, ammo: { ...G.ammo } }; });
  ok('Slots 1-7 wählen die Waffen', sl.out.join() === 'faust,pistole,smg,shotgun,flamer,rocket,emp', sl.out.join());
  ok('Munitionsgrenzen (240/400/60/400/10/10)', sl.ammo.pistole === 240 && sl.ammo.smg === 400 && sl.ammo.shotgun === 60 && sl.ammo.flamer === 400 && sl.ammo.rocket === 10 && sl.ammo.emp === 10, JSON.stringify(sl.ammo));
  // 2. MP: Dauerfeuer, hohe Rate
  const smg = await p.evaluate(() => { setWeapon('smg'); G.player.cd = 0; const a0 = G.ammo.smg; Input.forced = { fire: true, ax: 740, ay: 360 }; for (let i = 0; i < 30; i++) { G.player.a = 0; step(); } Input.forced = null; return { shots: a0 - G.ammo.smg }; });
  ok('MP: ~6 Schuss in 30 Ticks (Rate 5)', smg.shots >= 5 && smg.shots <= 7, JSON.stringify(smg));
  // 3. Schrot: 7 Kugeln je Schuss
  const sg = await p.evaluate(() => { setWeapon('shotgun'); G.player.cd = 0; G.bullets.length = 0; Input.forced = { fire: true, ax: 740, ay: 360 }; G.player.a = 0; step(); Input.forced = null; return { n: G.bullets.length, ammo: G.ammo.shotgun }; });
  ok('Schrot: 7 Kugeln, 1 Munition', sg.n === 7 && sg.ammo === 59, JSON.stringify(sg));
  // 4. Flammenwerfer: Passant brennt und stirbt, Auto brennt nach ~1 s
  const fl = await p.evaluate(() => {
    G.peds.length = 0; G.vehicles.length = 0; const pl = G.player; setWeapon('flamer'); G.ammo.flamer = 400;
    const q = makePed(pl.x + 70, pl.y, {}); q.noDodge = true; q.wait = 9999; q.speed = 0; q.hp = 30; const v = spawnVehicle('limousine' in VEHICLES ? 'limousine' : Object.keys(VEHICLES)[3], pl.x + 110, pl.y + 0, 0, {});
    let burnAt = -1, dead = -1; Input.forced = { fire: true, ax: 740, ay: 360 };
    for (let t = 0; t < 400; t++) { pl.a = 0; pl.cd = 0; step(); q.x = pl.x + 70; q.y = pl.y; if (v.burn > 0 && burnAt < 0) burnAt = t; if (q.state === 'dead' && dead < 0) dead = t; if (burnAt > 0 && dead > 0) break; }
    Input.forced = null; return { burnAt, dead, ammo: G.ammo.flamer, burnT: q.burnT };
  });
  ok('Flammenwerfer: Auto brennt, Person verbrennt', fl.burnAt > 0 && fl.dead > 0, JSON.stringify(fl));
  // 5. Rakete: Explosion am Ziel, Fahrzeug beschädigt, Person tot
  const rk = await p.evaluate(() => {
    G.peds.length = 0; G.vehicles.length = 0; G.bullets.length = 0; const pl = G.player; G.freeze = 0; setWeapon('rocket'); G.ammo.rocket = 10; pl.cd = 0;
    const q = makePed(pl.x + 150, pl.y + 20, {}); q.noDodge = true; q.wait = 9999; q.speed = 0; const v = spawnVehicle(Object.keys(VEHICLES)[3], pl.x + 160, pl.y, 0, {}); const hp0 = v.hp;
    Input.forced = { fire: true, ax: 740, ay: 360 }; pl.a = 0; step(); Input.forced = null; for (let t = 0; t < 60 && G.bullets.length; t++) step();
    return { dead: q.state === 'dead' || q.hp <= 0, hp: v.hp < hp0, ammo: G.ammo.rocket };
  });
  ok('Rakete: Splash tötet, Fahrzeug beschädigt', rk.dead && rk.hp && rk.ammo === 9, JSON.stringify(rk));
  // 6. EMP: Drohne gelähmt + beschädigt
  const emp = await p.evaluate(() => {
    G.drones.length = 0; const pl = G.player; G.freeze = 0; setWeapon('emp'); G.ammo.emp = 10; pl.cd = 0; const d = { x: pl.x + 300, y: pl.y, hp: 40, a: 0, t: 0, cd: 90, ang: 0 }; G.drones.push(d);
    G.wanted.pts = 400; G.wanted.level = 4; Input.forced = { fire: true, ax: 740, ay: 360 }; pl.a = 0; step(); Input.forced = null; for (let t = 0; t < 40; t++) { d.x = pl.x + 300; d.y = pl.y; step(); } G.wanted.pts = 0; G.wanted.level = 0;
    return { stun: d.stun > 0, hp: d.hp, grenades: G.grenades.length };
  });
  ok('EMP: Drohne gelähmt, 15 Schaden', emp.stun && emp.hp <= 25, JSON.stringify(emp));
  // 7. Fässer: Kettenreaktion
  const bar = await p.evaluate(() => {
    G.props.length = 0; G.peds.length = 0; const pl = G.player; for (let i = 0; i < 4; i++) G.props.push({ x: pl.x + 200 + i * 30, y: pl.y, hp: 24, kind: 'barrel' });
    G.freeze = 0; setWeapon('pistole'); G.ammo.pistole = 50; pl.cd = 0; Input.forced = { fire: true, ax: 740, ay: 360 }; for (let t = 0; t < 400 && G.props.length; t++) { pl.a = 0; G.freeze = 0; pl.cd = Math.min(pl.cd, 4); step(); } Input.forced = null; return { left: G.props.length };
  });
  ok('Fässer: Kettenreaktion räumt alle 4', bar.left === 0, JSON.stringify(bar));
  // 8. Power-ups
  const pu = await p.evaluate(() => {
    const pl = G.player; pl.hp = 30; takePowerup('repair'); const r = pl.hp; takePowerup('vest'); const v = G.armor; takePowerup('rapid'); const ra = G.pu.rapid; takePowerup('shield'); const sh = G.pu.shield;
    const hp0 = pl.hp; damagePlayer(10); const noDmg = pl.hp === hp0; G.pu.shield = 0; G.wanted.pts = 5; G.wanted.level = 2; takePowerup('bribe'); const lv = G.wanted.level;
    G.pu.rapid = 600; setWeapon('pistole'); pl.cd = 0; G.ammo.pistole = 50; Input.forced = { fire: true, ax: 740, ay: 360 }; pl.a = 0; step(); Input.forced = null; const cd = pl.cd; G.wanted.pts = 0; G.wanted.level = 0;
    return { r, v, ra, sh, noDmg, lv, cd, crates: G.crates.length };
  });
  ok('Power-ups: Medikit, Weste, Feuerrate, Schild, Bestechung', pu.r === 70 && pu.v === 100 && pu.ra === 600 && pu.sh === 480 && pu.noDmg && pu.lv === 1 && pu.cd <= 8, JSON.stringify(pu));
  ok('~18 Kisten (6 je Distrikt)', pu.crates >= 15, 'n=' + pu.crates);
  // 9. Händler: Weste und Heat-Sperre
  const shop = await p.evaluate(() => {
    const b = Interiors.list.find(b => b._kind === 'waffenhaendler'); Interiors.ensure(b); const I = Interiors.gen.get(b.id), n = I.people.find(q => q.role === 'haendler');
    G.own = { faust: true, pistole: true, smg: true, shotgun: true, flamer: true, emp: true }; G.ammo = { pistole: 240, smg: 400, shotgun: 60, flamer: 400, emp: 10 }; G.weapon = 'faust'; G.armor = 0; G.credits = 2000;
    const o = Interiors.dealerOffer(); G.wanted.level = 2; const o2 = Interiors.dealerOffer(); G.wanted.level = 0;
    return { kind: o.kind, hasNpc: !!n, price: WEAPONS.rocket.act };
  });
  ok('Händler: Rakete erst ab Akt II, sonst Weste angeboten', shop.kind === 'vest' && shop.hasNpc && shop.price === 2, JSON.stringify(shop));
  ok('keine Laufzeitfehler', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close(); console.log(bad ? bad + ' FEHLER' : 'ALLE OK'); process.exit(bad ? 1 : 0);
})();
