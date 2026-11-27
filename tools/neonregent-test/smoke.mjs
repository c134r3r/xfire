// Smoke-Test NEON REGENT (PLAN §9): lädt jede Szene von file://, prüft Konsolenfehler, misst das mittlere rAF-Intervall über 120 Frames
// (Klangbank-Baking läuft im Hintergrund und ist nicht Teil der Messung) und speichert einen Screenshot nach tools/neonregent-test/out/. Aufruf aus dem Repo-Wurzelverzeichnis:  node tools/neonregent-test/smoke.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(), OUT = path.join(ROOT, 'tools/neonregent-test/out');
fs.mkdirSync(OUT, { recursive: true });
const SCENES = (process.argv[2] ? process.argv[2].split(',') : ['docks_street', 'neon_crossing', 'krone_palace', 'police_l3', 'police_l5', 'mandat_call', 'dawn', 'explosion', 'gate_tor1', 'menu']);
const LIMIT = +process.env.NR_MS_LIMIT || 20;
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); let bad = 0;
  for (const s of SCENES) {
    const p = await b.newPage({ viewport: { width: 1304, height: 744 }, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    const q = s === 'menu' ? 'gates=open' : 'gates=open&scene=' + s;
    await p.goto('file://' + ROOT + '/neonregent.html?' + q);
    await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 60000 }); await p.waitForTimeout(1200);
    if (s === 'explosion') await p.evaluate(() => { const q = G.player; NR_TEST.explosion(q.x + 150, q.y + 60, 1.8); NR_TEST.explosion(q.x - 120, q.y + 90, 1.0); });   // Last-Szene: zwei Explosionen live in die Messung   // Messung erst nach dem Klangbank-Baking (sonst stört der Hintergrund-Render)
    const ms = await p.evaluate(() => new Promise(r => { const t = []; const f = x => { t.push(x); t.length < 121 ? requestAnimationFrame(f) : r(t.slice(1).reduce((a, v, i) => a + v - t[i], 0) / 120); }; requestAnimationFrame(f); }));
    await p.screenshot({ path: path.join(OUT, s + '.png') });
    const st = await p.evaluate(() => NR_TEST.state());
    console.log(s.padEnd(15), ms.toFixed(1).padStart(5) + ' ms', 'Q' + st.quality.toFixed(2), 'Teile ' + st.parts, 'Licht ' + st.lights, errs.length ? 'ERR ' + errs.join(' | ') : 'ok');
    if (errs.length || ms > LIMIT) bad++;
    await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
