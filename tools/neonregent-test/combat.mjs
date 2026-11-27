// Kampf-Test NEON REGENT: Fäuste (Jab, Jab, Haken, K.O. + Taschengeld), Pistole (Munition, Treffer, Panik), Waffenwechsel, Kauf beim Händler,
// Abrollen (Strecke, Unverwundbarkeit, Rendern), Drive-by, Touch-Feuerknopf. node tools/neonregent-test/combat.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1304, height: 744 }, hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=neon_crossing&debug=1#nosim'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  await p.evaluate(() => { Settings.d.drive = 'classic'; window.__s = []; const o = Aud.play.bind(Aud); Aud.play = (...a) => { __s.push(a[0]); return o(...a); }; });
  // 1. Boxen ohne Waffe: drei Schläge -> K.O., Taschengeld
  const box = await p.evaluate(() => {
    G.peds.length = 0; G.pickups.length = 0; G.vehicles.length = 0; const pl = G.player, T = 64; pl.x = 161.5 * T; pl.y = 15.5 * T; pl.veh = null; G.weapon = 'faust';
    const q = makePed(pl.x + 28, pl.y, {}); q.noDodge = true; q.wait = 9999; q.hasT = true; q.umb = null; q.hp = 20;
    const log = []; Input.forced = { fire: true, ax: 640 + 100, ay: 360 }; pl.a = 0;
    for (let t = 0; t < 200 && !q.ko; t++) { step(); q.x = pl.x + 28; q.y = pl.y; q.vx = q.vy = 0; if (q.state === 'flee') { q.state = 'walk'; q.frozen = 0; q.panic = 0; q.wait = 9999; } if (t % 5 === 0) log.push(Math.round(q.hp)); }
    Input.forced = null; return { ko: !!q.ko, state: q.state, hp: q.hp, wallet: G.pickups.length, ko_n: G.stats.ko, snd: [...new Set(__s)].filter(s => /schlag|faust/.test(s)), combo: pl.combo };
  });
  ok('Boxen: drei Schläge, K.O., Taschengeld', box.ko && box.state === 'down' && box.wallet >= 1 && box.snd.includes('schlag') && box.snd.includes('faustschlag'), JSON.stringify(box));
  // 2. Schlag ins Leere (kein Ziel): nur Luftzug
  const wh = await p.evaluate(() => { G.peds.length = 0; __s.length = 0; G.freeze = 0; G.player.cd = 0; Input.forced = { fire: true }; step(); Input.forced = null; return { snd: [...__s] }; });
  ok('Schlag ins Leere: Luftzug, kein Treffer', wh.snd.includes('schlag') && !wh.snd.includes('faustschlag'), JSON.stringify(wh));
  // 3. Pistole: ohne Munition Klick, mit Munition Treffer, Passanten in Panik
  const gun = await p.evaluate(() => {
    G.peds.length = 0; G.pickups.length = 0; __s.length = 0; const pl = G.player; G.own.pistole = true; G.ammo.pistole = 0; setWeapon('pistole'); pl.cd = 0; Input.forced = { fire: true, ax: 740, ay: 360 }; pl.a = 0; step(); const dry = __s.includes('klick');
    G.ammo.pistole = 5; const q = makePed(pl.x + 180, pl.y, {}); q.noDodge = true; q.wait = 9999; q.hasT = true; q.umb = null; q.speed = 0; const w2 = makePed(pl.x + 100, pl.y + 220, {}); w2.wait = 9999; w2.hasT = true;
    for (let t = 0; t < 120 && q.state !== 'dead'; t++) { pl.a = 0; step(); q.x = pl.x + 180; q.y = pl.y; } Input.forced = null; step();
    return { dry, dead: q.state === 'dead', ammo: G.ammo.pistole, bystander: w2.state, shot: __s.includes('pistole'), bullets: G.bullets.length };
  });
  ok('Pistole: Leerklick, Treffer tötet, Munition sinkt, Zeuge flieht', gun.dry && gun.dead && gun.ammo < 5 && gun.shot && gun.bystander === 'flee', JSON.stringify(gun));
  // 4. Waffenwechsel (Q, 1, 2)
  const sw = await p.evaluate(() => { G.weapon = 'pistole'; Input.forced = { swapP: true }; step(); Input.forced = null; const a = G.weapon; Input.forced = { weaponSlot: 2 }; step(); Input.forced = null; const bb = G.weapon; Input.forced = { weaponSlot: 1 }; step(); Input.forced = null; return [a, bb, G.weapon]; });
  ok('Waffenwechsel Q / 1 / 2', sw[0] === 'faust' && sw[1] === 'pistole' && sw[2] === 'faust', sw.join(','));
  // 5. Abrollen: Strecke, i-Frames, Rendern ohne Fehler, Rechts-/Linksrichtung
  const roll = await p.evaluate(() => { const pl = G.player; pl.x = 161.5 * 64; pl.y = 15.5 * 64; pl.dodgeCd = 0; pl.dodge = 0; const x0 = pl.x; Input.forced = { dodgeP: true, mx: 1, my: 0 }; step(); Input.forced = { mx: 0, my: 0 }; let mid = 0, frames = 0; for (let t = 0; t < 40; t++) { step(); if (pl.dodge > 0) { frames++; if (t === 8) { mid = pl.dodge; render(); } } } Input.forced = null; return { dist: Math.round(pl.x - x0), frames, mid, cd: pl.dodgeCd }; });
  ok('Abrollen: Strecke, Dauer, Abklingzeit', roll.dist > 50 && roll.frames >= 18 && roll.cd > 0, JSON.stringify(roll));
  // 6. Händler: Pistole kaufen (Interior Waffenhändler)
  const shop = await p.evaluate(() => { const b = Interiors.list.find(b => b._kind === 'waffenhaendler'); Interiors.ensure(b); const I = Interiors.gen.get(b.id), n = I.people.find(q => q.role === 'haendler'); G.own.pistole = false; G.ammo.pistole = 0; G.weapon = 'faust'; G.credits = 500;
    G.player.x = n.x; G.player.y = n.y + 22; step(); Interiors.cur = I; Input.forced = { interactP: true }; step(); Input.forced = null; return { own: G.own.pistole, ammo: G.ammo.pistole, cr: G.credits, w: G.weapon, hasNpc: !!n }; });
  ok('Waffenhändler: Pistole kaufen (120 CR)', shop.own && shop.ammo === 24 && shop.cr === 380 && shop.w === 'pistole', JSON.stringify(shop));
  // 7. Drive-by aus dem Auto
  const dby = await p.evaluate(() => { G.vehicles.length = 0; const T = 64, v = spawnVehicle('limo', 161 * T, 17.5 * T, 0, {}); enterVehicle(G.player, v); G.ammo.pistole = 10; setWeapon('pistole'); G.player.cd = 0; Input.forced = { fire: true, ax: 900, ay: 300 }; const a0 = G.ammo.pistole; step(); Input.forced = null; return { shots: a0 - G.ammo.pistole, bullets: G.bullets.length }; });
  ok('Drive-by aus dem Fahrzeug', dby.shots === 1 && dby.bullets === 1, JSON.stringify(dby));
  // 8. Touch-Feuerknopf (echte Touch-Ereignisse)
  await p.evaluate(() => { exitVehicle(G.player, true); G.weapon = 'faust'; G.player.cd = 0; G.player.x = 161.5 * 64; G.player.y = 15.5 * 64; });
  const cdp = await ctx.newCDPSession(p); const btn = await p.evaluate(() => { const r = document.getElementById('tbFire').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: getComputedStyle(document.getElementById('tbFire')).display }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x, y: btn.y, id: 3 }] }); await p.waitForTimeout(300);
  const tf = await p.evaluate(() => ({ btn: Input.touch.btn.fire, punched: G.player.lastPunch > 0 && G.time - G.player.lastPunch < 60, fire: G.in.fire })); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok('Touch: Feuerknopf schlägt', btn.d !== 'none' && tf.btn && tf.punched, JSON.stringify({ ...tf, display: btn.d }));
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
