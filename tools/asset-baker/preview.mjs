#!/usr/bin/env node
// Contact sheet for looking at models while working on them:
//   node tools/asset-baker/preview.mjs out.png ironclad [tank boss ...] --dirs 1,6
//   node tools/asset-baker/preview.mjs out.png tank:survivors heavy:survivors b:hq:survivors [--zoom 3] [--dirs 1,5,9,13] [--frame 0]
// Units with a turret are composited at their mount; b:<role>:<faction>
// renders a building (towers get their turret). Team color is blue.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const zoom = Number(flag('--zoom', 3)), dirs = flag('--dirs', '1,5,9,13').split(',').map(Number), frame = Number(flag('--frame', 0));
const team = flag('--team', '#3fa9ff'), bg = flag('--bg', '#9c8058');
const [out, ...specs] = args;

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/tools/asset-baker/bake.html`);
await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 30000 });
let url;
if (specs[0] === 'ironclad') {
    const { IRONCLAD_JOBS } = await import('./ironclad-jobs.mjs');
    const want = specs.slice(1);
    const jobs = IRONCLAD_JOBS.filter(j => !want.length || want.includes(j.name));
    url = await page.evaluate((a) => window.previewTop(a), { jobs, zoom, dirs, team, bg });
} else url = await page.evaluate((a) => window.preview(a), { specs, zoom, dirs, frame, team, bg });
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote', out);
await browser.close();
server.close();
