// Passanten-/Verkehrs-Test NEON REGENT (MS4): Bevölkerung, Wandern ohne Wandberührung, Überfahren (tödlich/verletzt) mit Schrei-Ereignissen,
// Brieftasche + Splat, Zeugen/Panik, Explosions-Panik, Verkehr ohne Dauerstau, Carjacking. node tools/neonregent-test/peds.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1304, height: 744 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=neon_crossing&debug=1'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  // 1+2: Bevölkerung und Bewegung
  const pop = await p.evaluate(() => { Settings.d.drive = 'classic'; NR_TEST.frames(400); const a = G.peds.filter(q => q.state === 'walk').map(q => [q.id, q.x, q.y]); NR_TEST.frames(120);
    let moved = 0, inWall = 0; for (const [id, x, y] of a) { const q = G.peds.find(r => r.id === id); if (q && Math.hypot(q.x - x, q.y - y) > 20) moved++; } for (const q of G.peds) if (q.state === 'walk' && World.blocked(q.x, q.y, 3)) inWall++;
    return { n: G.peds.length, walking: a.length, moved, inWall, traffic: G.vehicles.filter(v => v.ai).length, uniq: new Set(G.peds.map(q => q.d.id)).size }; });
  ok('Passanten spawnen und wandern', pop.n >= 20 && pop.moved >= pop.walking * 0.7 && pop.inWall === 0, JSON.stringify(pop));
  // 3: Überfahren (tödlich): Schrei beim Heranrasen, Aufprall, Splat, Brieftasche, Zeugen
  const kill = await p.evaluate(() => {
    G.vehicles.length = 0; G.peds.length = 0; G.pickups.length = 0; window.__rec = []; if (!Aud._w) { Aud._w = true; const o = Aud.playRec.bind(Aud), o2 = Aud.play.bind(Aud); Aud.playRec = (...a) => { __rec.push('rec:' + a[0]); return o(...a); }; Aud.play = (...a) => { __rec.push('play:' + a[0]); return o2(...a); }; }
    const T = 64, x = 161 * T, y = 17.5 * T, v = spawnVehicle('limo', x, y, 0, {}); v.vx = 8.2; enterVehicle(G.player, v); Settings.d.drive = 'classic'; Input.forced = { throttle: 1, steer: 0 };
    const victim = makePed(x + 260, y, {}); victim.state = 'walk'; victim.umb = null; victim.hasT = true; victim.tx = victim.x; victim.ty = victim.y; victim.speed = 0; victim.wait = 999; victim.noDodge = true;
    const wit = []; for (let i = 0; i < 4; i++) { const q = makePed(x + 330 + i * 30, y + 120 + i * 20, {}); q.wait = 999; wit.push(q.id); }
    const c0 = G.stats.peds; let t = 0; for (; t < 120 && victim.state !== 'dead'; t++) step(); for (let k = 0; k < 60; k++) step();
    return { dead: victim.state === 'dead', t, rec: __rec.filter(s => s.startsWith('rec:angst')).length, body: __rec.includes('play:koerper_toedlich'), pick: G.pickups.length, cr: G.credits || 0, stats: G.stats.peds - c0, fled: wit.filter(id => G.peds.find(q => q.id === id)?.state === 'flee').length, speed: Math.hypot(v.vx, v.vy) };
  });
  ok('Überfahren: Schrei vorab, tödlicher Aufprall, Brieftasche', kill.dead && kill.rec >= 1 && kill.body && (kill.pick === 1 || kill.cr > 0) && kill.stats === 1, JSON.stringify(kill));
  ok('Zeugen fliehen', kill.fled >= 3, 'geflohen ' + kill.fled + '/4');
  // Brieftasche einsammeln
  const pk = await p.evaluate(() => { exitVehicle(G.player, true); G.pickups.push({ x: G.player.x + 200, y: G.player.y, type: 'cr', v: 17, life: 900, bob: 0 }); const k = G.pickups[0]; G.player.x = k.x; G.player.y = k.y; const c0 = G.credits || 0; for (let i = 0; i < 4; i++) step(); return { gain: (G.credits || 0) - c0, left: G.pickups.length }; });
  ok('Brieftasche einsammeln (+CR)', pk.gain > 0 && pk.left === 0, JSON.stringify(pk));
  // 4: langsam angefahren: überlebt, liegt, stöhnt, steht wieder auf
  const hurt = await p.evaluate(() => { G.vehicles.length = 0; G.peds.length = 0; window.__rec.length = 0; const T = 64, x = 161 * T, y = 17.5 * T, v = spawnVehicle('kapsel', x, y, 0, {}); v.vx = 3.6; enterVehicle(G.player, v); Input.forced = { throttle: 0.2 };
    const q = makePed(x + 60, y, {}); q.hasT = true; q.tx = q.x; q.ty = q.y; q.speed = 0; q.wait = 999; q.umb = null; q.noDodge = true; let downAt = -1;
    for (let t = 0; t < 700; t++) { if (q.state === 'walk') { v.vx = 3.2; v.vy = 0; } step(); if (q.state === 'down' && downAt < 0) downAt = t; if (t === downAt + 5) Input.forced = { brake: 1 }; if (q.state === 'flee' && downAt >= 0) return { downAt, getUp: t, hp: q.hp, pain: __rec.filter(s => s === 'rec:schmerz').length, groan: __rec.filter(s => s === 'rec:stoehnen').length, hurtSnd: __rec.includes('play:koerper_verletzt') }; }
    return { downAt, state: q.state }; });
  ok('Angefahren: liegt, Schmerzschrei, steht wieder auf', hurt.downAt >= 0 && hurt.getUp > hurt.downAt && hurt.pain >= 1 && hurt.hurtSnd, JSON.stringify(hurt));
  // 5: Explosions-Panik
  const boom = await p.evaluate(() => { G.vehicles.length = 0; G.peds.length = 0; const T = 64, x = 161 * T, y = 17.5 * T, ids = []; for (let i = 0; i < 10; i++) ids.push(makePed(x + (i - 5) * 40, y + 200, {}).id); explosion(x, y + 200, 1.6); step(); return ids.filter(id => G.peds.find(q => q.id === id).state === 'flee').length; });
  ok('Explosion: Menge gerät in Panik', boom >= 9, boom + '/10');
  // 6: Verkehr fließt (kein Dauerstau): 3000 Ticks Beobachtung
  const flow = await p.evaluate(() => { G.vehicles = G.vehicles.filter(v => !v.ai); G.peds.length = 0; G.player.veh = null; const T = 64; let sp = null; for (let r = 1; r < 9 && !sp; r++) for (let dy = -r; dy <= r && !sp; dy++) for (let dx = -r; dx <= r; dx++) if (World.tile((161 + dx + 0.5) * T, (17 + dy + 0.5) * T) === TK.SIDEWALK) { sp = [(161 + dx + 0.5) * T, (17 + dy + 0.5) * T]; break; } NR_TEST.teleport(sp[0], sp[1]); G.cam.x = G.player.x; G.cam.y = G.player.y;
    let samples = 0, moving = 0, maxAi = 0, maxStopped = 0, crashes = 0; Bus.on('crash', () => crashes++);
    for (let t = 0; t < 3000; t++) { step(); if (t % 60 === 0 && t > 300) { const ai = G.vehicles.filter(v => v.ai); maxAi = Math.max(maxAi, ai.length); for (const v of ai) { samples++; if (Math.hypot(v.vx, v.vy) > 0.8) moving++; maxStopped = Math.max(maxStopped, v.ai.stop || 0); } } }
    return { maxAi, share: +(moving / Math.max(1, samples)).toFixed(2), maxStopped, crashes }; });
  ok('Verkehr fließt ohne Dauerstau', flow.maxAi >= 5 && flow.share > 0.5 && flow.maxStopped < 600, JSON.stringify(flow));
  // 7: Carjacking: Fahrer fliegt raus und flieht
  const jack = await p.evaluate(() => { const ai = G.vehicles.find(v => v.ai); if (!ai) return null; G.player.veh = null; ai.vx = ai.vy = 0; ai.ai.shaken = 200; G.player.x = ai.x - Math.cos(ai.a) * 30; G.player.y = ai.y - Math.sin(ai.a) * 30; const n0 = G.peds.length; G.in = {}; Input.forced = { enterP: true }; step(); Input.forced = null;
    return { inCar: G.player.veh === ai, ai: !!ai.ai, newPeds: G.peds.length - n0, fleeing: G.peds.filter(q => q.state === 'flee').length }; });
  ok('Carjacking', jack && jack.inCar && !jack.ai && jack.fleeing >= 1, JSON.stringify(jack));
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
