// Missions-Test NEON REGENT (MS8): M00 komplett, M01 mit Plünderern, M02 mit Standzerstörung und Verfolgung, Fehlschlag/Vollstreckung, Tod im Mandat,
// Frist-Warnungen, Marker/Route, Immunität. node tools/neonregent-test/missions.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1304, height: 744 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=neon_crossing&gates=open'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  const st = () => p.evaluate(() => NR_TEST.mis.state());
  const run = (n) => p.evaluate(n => { for (let i = 0; i < n; i++) step(); }, n);
  const tp = (x, y) => p.evaluate(([x, y]) => { const pl = G.player; if (pl.veh) exitVehicle(pl, true); const f = World.freeSpot(x, y); pl.x = f.x; pl.y = f.y; pl.vx = pl.vy = 0; G.freeze = 0; }, [x, y]);
  // 0. Ausgangslage: Szene ohne Auto-Start
  let s = await st(); ok('Szene startet ohne Mandat', !s.run && !s.offer && s.flags.length === 0, JSON.stringify(s));
  // 1. M00
  await p.evaluate(() => { G.peds.length = 0; NR_TEST.mis.accept('M00'); }); s = await st(); ok('M00 angenommen: Cutscene', s.run && s.run.id === 'M00' && s.run.t === 'cutscene', JSON.stringify(s.run));
  await run(6 * 60 + 5); s = await st(); ok('M00: nach 6 s Schritt goto', s.run.t === 'goto' && s.run.i === 1, JSON.stringify(s.run));
  const k = await p.evaluate(() => NR_TEST.mis.target()); await tp(k.x, k.y); await run(3); s = await st(); ok('M00: goto -> enter (Kapsel gespawnt)', s.run.t === 'enter' && s.tags.includes('zuteilung'), JSON.stringify(s));
  await p.evaluate(() => { const v = G.tags['zuteilung']; enterVehicle(G.player, v); }); await run(3); s = await st(); ok('M00: eingestiegen -> Fahrt zum Terminal', s.run.t === 'goto' && s.run.i === 3 && s.tags.includes('opfer'), JSON.stringify(s.run));
  const t0 = await p.evaluate(() => NR_TEST.mis.target()); ok('Navi-Route berechnet', (await p.evaluate(() => { Missions.navi(); return Missions.route.length; })) > 5);
  await p.evaluate(([x, y]) => { const v = G.player.veh; v.x = x - 300; v.y = y; v.a = 0; v.vx = v.vy = 0; G.player.x = v.x; G.player.y = v.y; }, [t0.x, t0.y]); await run(10);
  const opfer0 = await p.evaluate(() => NR_TEST.mis.tag('opfer')); await run(150); const opfer1 = await p.evaluate(() => NR_TEST.mis.tag('opfer'));
  ok('Ambient-Vollstreckung: Bürger fällt, keine Fahndung', opfer1.state === 'dead' && (await p.evaluate(() => G.wanted.level)) === 0, JSON.stringify({ opfer0: opfer0.state, opfer1: opfer1.state }));
  await p.evaluate(([x, y]) => { const v = G.player.veh; v.x = x; v.y = y; v.vx = v.vy = 0; G.player.x = x; G.player.y = y; }, [t0.x, t0.y]); await run(3); s = await st();
  ok('M00: am Terminal -> Halten (zu Fuß)', s.run.t === 'hold', JSON.stringify(s.run));
  await p.evaluate(() => { exitVehicle(G.player, true); }); await run(100); s = await st(); ok('M00: Halten 1,5 s -> Einweisung', s.run.t === 'cutscene' && s.run.i === 5, JSON.stringify(s.run));
  await run(9 * 60 + 5); s = await st(); ok('M00 abgeschlossen: 200 CR, Flag, nächstes Mandat vorgemerkt', !s.run && s.flags.includes('M00') && s.cr >= 200 && s.pushId === 'M01' && s.pushT > 0, JSON.stringify(s));
  // 2. M01
  await p.evaluate(() => { Missions.pushT = 1; }); await run(3); s = await st(); ok('Push: MANDAT-Anruf bietet M01 an', s.offer === 'M01', JSON.stringify(s));
  const o1 = await p.evaluate(() => { const P = Missions.startPos(Missions.offerDef); return P; }); await tp(o1.x, o1.y); await p.evaluate(() => { Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); s = await st();
  ok('M01 per [E] am Markierungsauge angenommen', s.run && s.run.id === 'M01' && s.run.t === 'enter' && s.tags.includes('laster'), JSON.stringify(s.run));
  await p.evaluate(() => { enterVehicle(G.player, G.tags['laster']); }); await run(3); s = await st(); ok('M01: Laster -> deliver, Frist 3:00', s.run.t === 'deliver' && s.run.left > 170 * 60, JSON.stringify(s.run));
  const d1 = await p.evaluate(() => NR_TEST.mis.target()); await p.evaluate(([x, y]) => { const v = G.player.veh; v.x = x + 600; v.y = y; v.vx = v.vy = 0; G.player.x = v.x; G.player.y = v.y; }, [d1.x, d1.y]); await run(30);
  s = await st(); const raiders = await p.evaluate(() => G.vehicles.filter(v => v.mis && v.mis.mode === 'ram').length); ok('M01: Plünderer erscheinen bei 45 %', raiders === 2, 'n=' + raiders + ' prog=' + (s.run && s.run.prog));
  const hit = await p.evaluate(() => { const r = G.vehicles.filter(v => v.mis && v.mis.mode === 'ram'); const l = G.tags.laster; return r.map(v => Math.round(Math.hypot(v.x - l.x, v.y - l.y))); });
  await run(300); const hit2 = await p.evaluate(() => { const r = G.vehicles.filter(v => v.mis && v.mis.mode === 'ram'); const l = G.tags.laster; return r.map(v => Math.round(Math.hypot(v.x - l.x, v.y - l.y))); });
  ok('Plünderer fahren auf den Laster zu', hit2.length === 2 && hit2.every((d, i) => d < hit[i]), JSON.stringify({ hit, hit2 }));
  await p.evaluate(([x, y]) => { const v = G.player.veh; v.x = x; v.y = y; v.vx = v.vy = 0; G.player.x = x; G.player.y = y; for (const r of G.vehicles.filter(v => v.mis && v.mis.mode === 'ram')) { r.x -= 900; } }, [d1.x, d1.y]); await run(3); s = await st();
  ok('M01: Lieferung -> Cutscene', s.run && s.run.t === 'cutscene', JSON.stringify(s.run)); await run(6 * 60 + 5); s = await st();
  ok('M01 abgeschlossen: +1000 CR, Flag', !s.run && s.flags.includes('M01') && s.cr >= 1200, JSON.stringify(s));
  // 3. Fehlschlag M02: Frist -> Vollstreckung -> Start, neu annehmen
  await p.evaluate(() => { G.credits = 5000; NR_TEST.mis.offer('M02'); }); const o2 = await p.evaluate(() => Missions.startPos(Missions.offerDef)); await tp(o2.x, o2.y); await p.evaluate(() => { Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); s = await st();
  ok('M02 angenommen, Pistole zugeteilt', s.run && s.run.id === 'M02' && s.run.t === 'talk' && (await p.evaluate(() => G.own.pistole && G.ammo.pistole === 120)) && ['h1', 'h2', 'h3', 'stand3', 'van3', 'zuschauer'].every(t => s.tags.includes(t)), JSON.stringify(s.tags));
  await p.evaluate(() => { Missions.run.left = 62; }); await run(5); const beforeExec = await p.evaluate(() => ({ q: HUD.pager.q.length + (HUD.pager.cur ? 1 : 0) })); await run(120); // 60 s Warnung wurde ausgelöst (Anruf in Pager)
  await p.evaluate(() => { Missions.run.left = 3; }); await run(10); s = await st(); ok('Frist abgelaufen -> Vollstreckung läuft', !!s.exec && s.run, JSON.stringify(s.exec));
  const lock = await p.evaluate(() => { const x0 = G.player.x; Input.forced = { mx: 1, my: 0, fire: true }; for (let i = 0; i < 30; i++) step(); Input.forced = null; return Math.abs(G.player.x - x0) < 1; }); ok('Eingaben während der Vollstreckung gesperrt', lock);
  await run(60 * 6 + 30); s = await st();
  const after = await p.evaluate(() => ({ cr: G.credits, pis: G.own.pistole, hp: G.player.hp, pos: [G.player.x | 0, G.player.y | 0], offer: Missions.offerDef && Missions.offerDef.id, black: document.getElementById('execBlack').style.opacity }));
  ok('Nach Vollstreckung: zurück am Start, Mandat neu anzubieten, Snapshot (keine Pistole, 5000 CR)', !s.exec && !s.run && s.offer === 'M02' && !after.pis && after.cr === 5000, JSON.stringify(after));
  const near = await p.evaluate(() => { const P = Missions.startPos(Missions.offerDef); return Math.hypot(P.x - G.player.x, P.y - G.player.y); }); ok('Spieler steht am Startauge', near < 120, 'd=' + Math.round(near));
  ok('Spielwelt aufgeräumt (keine Mandats-Entitäten)', (await p.evaluate(() => G.peds.filter(q => q.mis).length + G.vehicles.filter(v => v.mis).length + G.props.filter(q => q.mis).length)) === 0);
  // 4. M02 komplett durchspielen
  await p.evaluate(() => { Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); s = await st(); ok('M02 neu angenommen', s.run && s.run.id === 'M02' && s.run.i === 0); await run(25);
  for (const t of ['h1', 'h2', 'h3']) { const e = await p.evaluate(t => NR_TEST.mis.tag(t), t); await tp(e.x - 30, e.y); await p.evaluate(() => { G.player.veh = null; Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); await run(25); }
  s = await st(); ok('M02: 3 Händler angesprochen, Kassieren +450', s.run.t === 'destroy' && s.cr >= 5000 + 450, JSON.stringify(s.run));
  const wantedBefore = await p.evaluate(() => G.wanted.level);
  const stand = await p.evaluate(() => NR_TEST.mis.tag('stand3')); await tp(stand.x - 120, stand.y + 60);
  await p.evaluate(() => { const e = G.tags.stand3; const pl = G.player; setWeapon('pistole'); pl.a = Math.atan2(e.y - pl.y, e.x - pl.x); Input.forced = { fire: true, ax: 640 + Math.cos(pl.a) * 100, ay: 360 + Math.sin(pl.a) * 100 }; });
  for (let i = 0; i < 400 && (await st()).run.t === 'destroy'; i += 20) { await p.evaluate(() => { const e = G.tags.stand3; if (e) { const pl = G.player; pl.a = Math.atan2(e.y - pl.y, e.x - pl.x); } G.freeze = 0; G.player.cd = Math.min(G.player.cd, 3); G.ammo.pistole = 120; for (let k = 0; k < 20; k++) step(); }); }
  await p.evaluate(() => { Input.forced = null; }); s = await st(); ok('M02: Stand zerstört -> Verfolgung', s.run && s.run.t === 'chase', JSON.stringify(s.run));
  ok('Immunität: kein Fahndungspunkt durch Schüsse/Zerstörung', (await p.evaluate(() => G.wanted.level)) === wantedBefore && (await p.evaluate(() => G.wanted.pts)) === 0, 'pts=' + (await p.evaluate(() => G.wanted.pts)));
  await run(60 * 8); const van = await p.evaluate(() => { const v = G.tags.van3; return { moved: Math.hypot(v.vx, v.vy), flee: !!(v.mis && v.mis.mode === 'flee'), h3: G.peds.some(q => q.mis && q.role === 'haendler' && q.state !== 'dead' && G.tags.h3 === q) }; });
  ok('Händler steigt in den Van, Van flieht', van.flee && van.moved > 1 && !van.h3, JSON.stringify(van));
  await p.evaluate(() => { G.tags.van3.hp = 5; }); await run(5); s = await st(); ok('Van schwer beschädigt -> Händler gestellt, Cutscene', s.run && s.run.t === 'cutscene', JSON.stringify(s.run));
  await run(6 * 60 + 5); s = await st(); ok('M02 abgeschlossen: +90 +1500 CR, Flag', !s.run && s.flags.includes('M02') && s.cr >= 5000 + 450 + 90 + 1500, JSON.stringify(s));
  ok('Alle drei Mandate erfüllt: kein weiteres, Terminal bietet nichts', (await p.evaluate(() => Missions.nextDef())) === null);
  // 5. Tod im Mandat
  await p.evaluate(() => { G.flags.M01 = true; delete G.flags.M02; NR_TEST.mis.offer('M02'); }); const o3 = await p.evaluate(() => Missions.startPos(Missions.offerDef)); await tp(o3.x, o3.y); await p.evaluate(() => { Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); await run(3);
  await p.evaluate(() => { playerDown('wasted'); }); await run(200); s = await st(); ok('Tod im Mandat: AUSGELÖSCHT, danach Mandat wieder angeboten (keine Vollstreckung)', !s.run && s.offer === 'M02' && !s.exec, JSON.stringify(s));
  // 6. Screenshots
  await p.evaluate(() => { Input.forced = null; G.respawn = null; G.fadeA = 0; }); await tp(o3.x, o3.y); await p.evaluate(() => { G.freeze = 0; }); await run(30); await p.screenshot({ path: 'tools/neonregent-test/out/ms8_offer.png' });
  await p.evaluate(() => { Input.forced = { interactP: true }; }); await run(2); await p.evaluate(() => { Input.forced = null; }); await run(60); await p.screenshot({ path: 'tools/neonregent-test/out/ms8_m02.png' });
  await p.evaluate(() => { Missions.fail('test'); }); await run(60 * 2.4); await p.screenshot({ path: 'tools/neonregent-test/out/ms8_exec.png' });
  ok('keine Laufzeitfehler', errs.length === 0, errs.slice(0, 4).join(' | '));
  await b.close(); console.log(bad ? bad + ' FEHLER' : 'ALLE OK'); process.exit(bad ? 1 : 0);
})();
