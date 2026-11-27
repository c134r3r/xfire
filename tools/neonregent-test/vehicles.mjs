// Fahrzeug-Test NEON REGENT (MS2): geparkte Fahrzeuge gültig platziert, Fahrphysik (Höchsttempo je Klasse, Drift, Crash-Schaden, Brand ->
// Explosion -> Wrack), Ein-/Aussteigen/Aufbrechen, Hoverboard, Touch-Steuerung per echten Touch-Ereignissen (CDP). node tools/neonregent-test/vehicles.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd();
let bad = 0; const ok = (name, cond, extra = '') => { console.log((cond ? 'ok     ' : 'FEHLER ') + name + (extra ? '  ' + extra : '')); if (!cond) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1304, height: 744 }, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=docks_street&debug=1#nosim');
  await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  await p.evaluate(() => { Settings.d.drive = 'classic'; });
  const N = await p.evaluate(() => ({ n: G.vehicles.length, bad: G.vehicles.filter(v => vehBlock(v, v.x, v.y, v.a).n).length, boards: G.vehicles.filter(v => v.cls === 'board').length, cls: [...new Set(G.vehicles.map(v => v.cls))] }));
  ok('geparkte Fahrzeuge', N.n > 80 && N.bad === 0, `${N.n} Stück, ${N.bad} in Wänden, ${N.boards} Hoverboards, Klassen ${N.cls.join(',')}`);
  // Höchsttempo je Klasse (Soll laut WORLD.md §5) auf freier Fläche: Fahrstrecke Kreuzung -> geradeaus
  const speeds = await p.evaluate(() => { const out = {}; for (const cls of Object.keys(VEHICLES)) { G.vehicles.length = 0; const T = 64; G.player.veh = null; const v = spawnVehicle(cls, 161 * T, 17.5 * T, 0, {}); enterVehicle(G.player, v); Input.forced = { throttle: 1, steer: 0 }; for (let i = 0; i < 500; i++) { step(); if (v.x > 176 * T) { v.x = 161 * T; } } out[cls] = +Math.hypot(v.vx, v.vy).toFixed(2); exitVehicle(G.player, true); Input.forced = null; } return out; });
  const want = await p.evaluate(() => Object.fromEntries(Object.entries(VEHICLES).map(([k, d]) => [k, d.top])));
  for (const k in want) ok('Höchsttempo ' + k, speeds[k] > want[k] * 0.9 && speeds[k] <= want[k] * 1.02, `${speeds[k]} (Soll ${want[k]})`);
  // Drift: Handbremse + Lenken erzeugt Querschlupf; Schweber ohne Bremsspur
  const drift = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, v = spawnVehicle('limo', 161 * T, 17.5 * T, 0, {}); enterVehicle(G.player, v); Input.forced = { throttle: 1, steer: 0 }; for (let i = 0; i < 90; i++) step(); Input.forced = { throttle: 1, steer: 1, handbrake: true }; let mx = 0; for (let i = 0; i < 40; i++) { step(); mx = Math.max(mx, v.slip); } Input.forced = null; exitVehicle(G.player, true); return mx; });
  ok('Handbremsen-Drift', drift > 1.4, 'Querschlupf ' + drift.toFixed(2));
  // Crash: gegen Gebäude -> Schaden; HP 0 -> Brennen -> Explosion -> Wrack, Fahrer wird ausgeworfen
  const crash = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, b = G.buildings.find(b => b.h > 100 && b.x0 > 9000 && b.y0 > 1300), v = spawnVehicle('kapsel', 0, 0, 0, {}), f = (() => { for (let d = 200; d > 50; d -= 10) for (let dy = -60; dy <= 60; dy += 20) { const x = b.x0 - d, y = (b.y0 + b.y1) / 2 + dy; if (!vehBlock(v, x, y, 0).n) return { x, y }; } return { x: 0, y: 0 }; })(); v.x = f.x; v.y = f.y; v.vx = 6.9; enterVehicle(G.player, v); Input.forced = { throttle: 1, steer: 0 }; let hp0 = v.hp, minHp = v.hp; for (let i = 0; i < 400 && !v.burn; i++) { step(); minHp = Math.min(minHp, v.hp); if (v.hp <= 0) break; if (i % 50 === 49 && v.hp > 0 && Math.hypot(v.vx, v.vy) < 0.5) { v.x = f.x; v.y = f.y; v.a = 0; v.vx = 6.9; } }
    Input.forced = null; const burning = v.burn > 0; for (let i = 0; i < 400 && !v.dead; i++) step(); return { hp0, minHp, burning, dead: v.dead, out: !G.player.veh, pHp: G.player.hp }; });
  ok('Crash -> Brand -> Explosion -> Wrack', crash.minHp < crash.hp0 && crash.burning && crash.dead && crash.out, JSON.stringify(crash));
  // Kettenreaktion: Explosion beschädigt Nachbarfahrzeug
  const chain = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, a = spawnVehicle('limo', 161 * T, 17.5 * T, 0, {}), c = spawnVehicle('limo', 161 * T + 70, 17.5 * T + 10, 0, {}); a.hp = 0; a.burn = 3; for (let i = 0; i < 12; i++) step(); return { aDead: a.dead, cHp: c.hp, cMax: c.maxHp }; });
  ok('Explosion beschädigt Nachbarn', chain.aDead && chain.cHp < chain.cMax, JSON.stringify(chain));
  // Einsteigen: verschlossenes Fahrzeug braucht 1 s Aufbrechen; entsperrtes sofort; Aussteigen stellt Spieler frei
  const enter = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, pl = G.player; pl.veh = null; const x = 161 * T, y = 17.5 * T; pl.x = x - 50; pl.y = y;
    const v = spawnVehicle('limo', x, y, 0, { locked: true }); Input.forced = { enterP: true }; step(); Input.forced = null; const early = !!pl.veh, breaking = v.breaking;
    for (let i = 0; i < 70; i++) step(); const late = !!pl.veh;
    Input.forced = { enterP: true }; step(); Input.forced = null; step(); const out = !pl.veh && !World.blocked(pl.x, pl.y, C.PED_R);
    return { early, breaking, late, out }; });
  ok('Aufbrechen + Einsteigen + Aussteigen', !enter.early && enter.breaking > 0 && enter.late && enter.out, JSON.stringify(enter));
  // Hoverboard: schnell, driftet, Fahrer nimmt 30 % des Schadens
  const hb = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, v = spawnVehicle('board', 161 * T, 17.5 * T, 0, {}); G.player.hp = 100; enterVehicle(G.player, v); damageVeh(v, 20, 'test'); return { hp: G.player.hp, vh: v.hp }; });
  ok('Hoverboard: Fahrer nimmt Schaden', hb.hp < 100 && hb.vh < 35, JSON.stringify(hb));
  await p.evaluate(() => { exitVehicle(G.player, true); });
  // Touch: echte Touch-Ereignisse über CDP: linker Daumen zieht nach rechts -> Fahrzeug folgt (Direktmodus), rechter Stick zielt
  const cdp = await ctx.newCDPSession(p);
  await p.evaluate(() => { G.vehicles.length = 0; const T = 64, v = spawnVehicle('limo', 161 * T, 17.5 * T, 0, {}); G.player.veh = null; enterVehicle(G.player, v); Input.forced = null; });
  const box = await p.evaluate(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const pt = (fx, fy, id) => ({ x: box.x + fx * box.w, y: box.y + fy * box.h, id });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(0.15, 0.75, 1)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(0.15 + 0.1, 0.75, 1)] });
  await p.waitForTimeout(1500);
  const tv = await p.evaluate(() => ({ t: Input.touch.on, v: NR_TEST.veh(), mx: G.in.mx }));
  ok('Touch: Linker Stick fährt', tv.t && tv.v && Math.hypot(tv.v.vx, tv.v.vy) > 3 && tv.mx > 0.5, JSON.stringify({ speed: tv.v && Math.hypot(tv.v.vx, tv.v.vy).toFixed(1), mx: tv.mx.toFixed(2) }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(200);
  const btn = await p.evaluate(() => { const r = document.getElementById('tbEnter').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: getComputedStyle(document.getElementById('tbEnter')).display }; });
  await p.evaluate(() => { const v = G.player.veh; if (v) { v.vx = v.vy = 0; } });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 5 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(400);
  if (false) console.log('debug', JSON.stringify(await p.evaluate(() => ({ btn: Input.touch.btn, edge: Input.edge.KeyF, veh: !!G.player.veh, st: G.state, sp: G.player.veh && Math.hypot(G.player.veh.vx, G.player.veh.vy) }))), btn);
  ok('Touch: Knopf EIN/AUS steigt aus', btn.vis !== 'none' && !(await p.evaluate(() => !!G.player.veh)), 'Knopf ' + btn.vis);
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
