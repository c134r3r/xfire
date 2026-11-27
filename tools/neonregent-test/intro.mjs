// Vorspann-Test: läuft ~15 s, überspringbar, danach startet M00. node tools/neonregent-test/intro.mjs
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await (await b.newContext({ viewport: { width: 1304, height: 744 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
const open = async () => { await p.goto('file://' + process.cwd() + '/neonregent.html'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 }); };
await open(); await p.click('#startBtn'); await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/neonregent-test/out/intro_1.png' });
ok('Vorspann läuft, Spiel noch nicht gestartet', await p.evaluate(() => Intro.on && G.state === 'menu'));
await p.waitForTimeout(6500); await p.screenshot({ path: 'tools/neonregent-test/out/intro_3.png' });
await p.waitForTimeout(8500); ok('endet nach ~15 s von selbst, Spiel startet', await p.evaluate(() => !Intro.on && G.state === 'play'));
await open(); await p.click('#startBtn'); await p.waitForTimeout(1200); await p.keyboard.press('Space'); await p.waitForTimeout(300);
ok('Leertaste überspringt', await p.evaluate(() => !Intro.on && G.state === 'play'));
await p.waitForTimeout(3500); ok('danach startet M00', await p.evaluate(() => NR_TEST.mis.state().run && NR_TEST.mis.state().run.id === 'M00'));
ok('keine Fehler', !errs.length, errs.join('|')); await b.close(); process.exit(bad ? 1 : 0); })();
