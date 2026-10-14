#!/usr/bin/env node
// ============================================
// XFire asset baker - renders the 3D models to sprite sheets.
//
//   node tools/asset-baker/bake.mjs                 # full pack
//   node tools/asset-baker/bake.mjs --only tank     # roles containing "tank"
//   node tools/asset-baker/bake.mjs --faction evolved
//   node tools/asset-baker/bake.mjs --test out.png  # quick contact sheet
//
// Writes assets/sprites/<faction>/<kind>-<role>.png (+ .mask.png),
// assets/sprites/manifest.json and per-faction bundles
// assets/sprites/<faction>.bundle.js (data URIs, so the game also
// works from file:// without tainting canvases).
// Requires: npm install (three) and Playwright with Chromium.
// ============================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUTDIR = path.join(ROOT, 'assets/sprites');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

const FACTIONS = ['survivors', 'evolved', 'series9'];
const UNIT_ROLES = ['trooper', 'flamer', 'rocketeer', 'bike', 'buggy', 'tank', 'heavy', 'artillery'];
const INFANTRY = new Set(['trooper', 'flamer', 'rocketeer']);
const BUILDINGS = ['hq', 'powerStation', 'derrick', 'barracks', 'factory', 'researchLab', 'repairBay', 'tower', 'towerHeavy'];

function frameCount(role, faction) {
    if (INFANTRY.has(role)) return 5;
    if (faction === 'evolved') return 4;
    return 1;
}

function jobs() {
    const list = [];
    for (const faction of FACTIONS) {
        for (const role of UNIT_ROLES) list.push({ kind: 'unit', role, faction, dirs: 16, frames: frameCount(role, faction) });
        for (const role of ['tank', 'heavy', 'tower', 'towerHeavy']) list.push({ kind: 'turret', role, faction, dirs: 16, frames: 1 });
        for (const role of BUILDINGS) list.push({ kind: 'building', role, faction, dirs: 1, frames: 2 });
    }
    list.push({ kind: 'building', role: 'bunker', faction: 'survivors', dirs: 1, frames: 2 });
    const only = opt('--only'), fac = opt('--faction');
    return list.filter(j => (!only || j.role.toLowerCase().includes(only.toLowerCase())) && (!fac || j.faction === fac));
}

function serve() {
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' };
    const server = http.createServer((req, res) => {
        const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
        fs.createReadStream(p).pipe(res);
    });
    return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const dataToBuf = (d) => Buffer.from(d.split(',')[1], 'base64');

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/tools/asset-baker/bake.html${process.env.NOSHADOW ? "#noshadow" : ""}`);
await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 30000 });

const test = opt('--test');
if (test) {
    // quick look: a handful of cells on one sheet
    const out = await page.evaluate(async () => {
        const picks = [
            ['unit', 'tank', 'survivors', 2, 0], ['unit', 'trooper', 'survivors', 2, 1], ['unit', 'buggy', 'survivors', 2, 0],
            ['unit', 'heavy', 'series9', 2, 0], ['unit', 'tank', 'evolved', 2, 0], ['unit', 'artillery', 'survivors', 2, 0]
        ];
        const sheets = [];
        for (const [kind, role, faction, d, f] of picks) {
            const r = await window.bake({ kind, role, faction, dirs: 1, frames: 1 });
            sheets.push(r);
        }
        const b = await window.bake({ kind: 'building', role: 'hq', faction: 'survivors', dirs: 1, frames: 1 });
        sheets.push(b);
        // contact sheet on sand, team-tinted blue
        const imgs = await Promise.all(sheets.map(s => Promise.all([s.color, s.mask].map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })))));
        const Z = 3;
        const W = imgs.reduce((a, [c]) => a + c.width * Z / 2 + 10, 10), H = Math.max(...imgs.map(([c]) => c.height)) * Z / 2 + 20;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const x = cv.getContext('2d');
        x.fillStyle = '#9c8058'; x.fillRect(0, 0, W, H);
        let ox = 10;
        for (const [c, m] of imgs) {
            const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
            const tc = t.getContext('2d');
            tc.drawImage(c, 0, 0);
            const tm = document.createElement('canvas'); tm.width = c.width; tm.height = c.height;
            const tmc = tm.getContext('2d');
            tmc.drawImage(m, 0, 0); tmc.globalCompositeOperation = 'source-in'; tmc.fillStyle = '#3fa9ff'; tmc.fillRect(0, 0, c.width, c.height);
            tc.globalCompositeOperation = 'multiply'; tc.drawImage(tm, 0, 0);
            tc.globalCompositeOperation = 'destination-in'; tc.drawImage(c, 0, 0);
            x.drawImage(t, ox, 10, c.width * Z / 2, c.height * Z / 2); ox += c.width * Z / 2 + 10;
        }
        return cv.toDataURL();
    });
    fs.writeFileSync(test, dataToBuf(out));
    console.log('wrote', test);
} else {
    const list = jobs();
    const manifestPath = path.join(OUTDIR, 'manifest.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { version: 1, out: 2, sprites: {} };
    let n = 0;
    for (const job of list) {
        const t0 = Date.now();
        const r = await page.evaluate((j) => window.bake(j), job);
        const dir = path.join(OUTDIR, job.faction);
        fs.mkdirSync(dir, { recursive: true });
        const base = `${job.kind}-${job.role}`;
        fs.writeFileSync(path.join(dir, base + '.png'), dataToBuf(r.color));
        fs.writeFileSync(path.join(dir, base + '.mask.png'), dataToBuf(r.mask));
        manifest.sprites[`${job.kind}|${job.role}|${job.faction}`] = {
            file: `${job.faction}/${base}`, w: r.spec.w, h: r.spec.h, ax: r.spec.ax, ay: r.spec.ay,
            dirs: job.dirs, frames: job.frames
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
        console.log(`[${++n}/${list.length}] ${job.faction} ${job.kind} ${job.role}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
}
await browser.close();
server.close();
