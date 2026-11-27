// Steuerung: W/S laufen entlang der Blickrichtung (Maus), A/D seitwärts. node tools/neonregent-test/controls.mjs
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto('file://' + process.cwd() + '/neonregent.html?scene=neon_crossing&gates=open#nosim'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
await p.evaluate(() => { G.vehicles.length = 0; G.peds.length = 0; });
const box = async () => (await p.locator('#gameCanvas').boundingBox());
const test = async (name, mouse, key, exp) => {
  await p.evaluate(() => { const pl = G.player; pl.x = 161.5 * 64; pl.y = 15.5 * 64; pl.vx = pl.vy = 0; G.freeze = 0; });
  const bb = await box(); await p.mouse.move(bb.x + bb.width * mouse[0], bb.y + bb.height * mouse[1]); await p.waitForTimeout(150);
  const a = await p.evaluate(() => ({ x: G.player.x, y: G.player.y }));
  await p.keyboard.down(key[0]); if (key[1]) await p.keyboard.down(key[1]); await p.waitForTimeout(400); await p.keyboard.up(key[0]); if (key[1]) await p.keyboard.up(key[1]);
  const c = await p.evaluate(() => ({ x: G.player.x, y: G.player.y })), dx = c.x - a.x, dy = c.y - a.y, m = Math.hypot(dx, dy);
  ok(name, m > 10 && Math.abs(dx / m - exp[0]) < 0.35 && Math.abs(dy / m - exp[1]) < 0.35, `dir=${(dx / m).toFixed(2)},${(dy / m).toFixed(2)} erwartet ${exp}`);
};
await test('Blick Ost, W -> Ost', [0.9, 0.5], ['KeyW'], [1, 0]);
await test('Blick Ost, S -> West', [0.9, 0.5], ['KeyS'], [-1, 0]);
await test('Blick Ost, D -> Süd (rechts vom Blick)', [0.9, 0.5], ['KeyD'], [0, 1]);
await test('Blick Ost, A -> Nord', [0.9, 0.5], ['KeyA'], [0, -1]);
await test('Blick Nord, W -> Nord', [0.5, 0.05], ['KeyW'], [0, -1]);
await test('Blick Nord, W+D -> Nordost (Diagonale)', [0.5, 0.05], ['KeyW', 'KeyD'], [0.71, -0.71]);
await test('Blick Süd, W -> Süd', [0.5, 0.95], ['KeyW'], [0, 1]);
await b.close(); process.exit(bad ? 1 : 0); })();
