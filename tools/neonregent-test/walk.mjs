// Welt-Test NEON REGENT (MS1): (1) Erreichbarkeit per Flutfüllung, (2) Zufallslauf 6000 Ticks ohne je in Wand/Wasser zu stehen,
// (3) Tore: geschlossen -> nur Docks erreichbar, offen -> alle drei Distrikte. Aufruf: node tools/neonregent-test/walk.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd();
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); let bad = 0;
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?debug=1&scene=docks_street');
  await p.waitForFunction(() => NR_TEST.state().state === 'play');
  const city = await p.evaluate(() => NR_TEST.city());
  console.log('Stadt:', city.buildings, 'Gebäude,', city.lamps, 'Laternen,', city.services, 'Dienste, Landmarken', city.landmarks.join(''), '· Generator', city.ms.toFixed(0), 'ms');
  const closed = await p.evaluate(() => NR_TEST.reach(false)), open = await p.evaluate(() => NR_TEST.reach(true));
  console.log('Erreichbar (Tore zu): ', JSON.stringify(closed)); console.log('Erreichbar (Tore auf):', JSON.stringify(open));
  if (!(closed.docks > 500 && closed.neon === 0 && closed.krone === 0)) { console.log('FEHLER: Tore zu -> nur Docks'); bad++; }
  if (!(open.docks > 500 && open.neon > 500 && open.krone > 500)) { console.log('FEHLER: Tore auf -> alle drei Distrikte'); bad++; }
  // Vollkarte = ASCII-Plan: jede Zelle gegen die erzeugten Kacheln prüfen (Wasser, Brücke, Land mit Straße)
  const mism = await p.evaluate(() => { let bad = 0; const T = 64; for (let r = 0; r < 12; r++) for (let c = 0; c < 38; c++) {
    const ch = NR_TEST.zone(c, r), k = (tx, ty) => NR_TEST.tileAt((c * 8 + tx + 0.5) * T, (r * 8 + ty + 0.5) * T);
    if (ch === '~') { for (let i = 0; i < 8; i++) if (k(i, i) !== 0) bad++; }                         // Wasser: Diagonale komplett Wasser
    else if (ch === 'W') { if (k(4, 0) !== 6 || k(4, 1) !== 6 || k(4, 4) !== 0) bad++; }               // Brücke nur auf der Nordkante
    else if (k(4, 4) === 0 || k(4, 0) === 0) bad++;                                                    // Land: weder Mitte noch Nordstraße Wasser
  } return bad; });
  console.log('Zonenplan vs. Kacheln: Abweichungen', mism); if (mism) bad++;
  // Zufallslauf: wechselnde Richtungen, Sprint, Rollen; Position darf nie blockiert sein
  let stuck = 0, moved = 0;
  for (let leg = 0; leg < 60; leg++) {
    const a = Math.random() * Math.PI * 2;
    await p.evaluate(a => NR_TEST.setIntent({ mx: Math.cos(a), my: Math.sin(a), sprint: true, dodgeP: Math.random() < 0.2 }), a);
    for (let k = 0; k < 10; k++) {
      const r = await p.evaluate(() => { const before = NR_TEST.state().player; NR_TEST.frames(10); const s = NR_TEST.state().player; return { s, blocked: NR_TEST.blockedAt(s.x, s.y), d: Math.hypot(s.x - before.x, s.y - before.y) }; });
      if (r.blocked) stuck++; moved += r.d;
    }
  }
  console.log('Texturen im Cache:', JSON.stringify(await p.evaluate(() => { const c = NR_TEST.city(); return { tex: c.tex, Mpx: +c.texMpx.toFixed(2), chunks: c.chunks }; })));
  console.log('Zufallslauf 6000 Ticks: in Wand/Wasser gestanden:', stuck, '· zurückgelegt', moved.toFixed(0), 'px');
  if (stuck || moved < 2000) { bad++; console.log('FEHLER Zufallslauf'); }
  // Wasser-/Gebäudegrenze direkt prüfen
  const w = await p.evaluate(() => ({ water: NR_TEST.blockedAt(0, 0), road: NR_TEST.tileAt(161 * 64, 17 * 64) }));
  console.log('Wasser blockiert:', w.water, '· Kreuzungskachel Typ:', w.road, '(2 = JUNCTION)'); if (!w.water || w.road !== 2) bad++;
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
