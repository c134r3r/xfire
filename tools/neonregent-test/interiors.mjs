// Innenraum-Test NEON REGENT (MS5, PLAN §9): jedes begehbare Gebäude -> Grundriss erzeugen -> Flutfüllung auf dem 8-px-Raster (Spieler-Radius 5) ab der Eingangstür:
// alle Räume erreichbar, keine Tür blockiert, Wände innerhalb des Grundrisses, Beute erreichbar. Danach Rein-/Rausgehen, Dach-weg-Übergang, Plündern.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = process.cwd(); let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'ok     ' : 'FEHLER ') + n + (x ? '  ' + x : '')); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage({ viewport: { width: 1304, height: 744 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + ROOT + '/neonregent.html?scene=docks_street&debug=1'); await p.waitForFunction(() => NR_TEST.state().bake.done, null, { timeout: 90000 });
  const info = await p.evaluate(() => NR_TEST.interiorInfo()); const byD = {}; for (const i of info) byD[i.d] = (byD[i.d] || 0) + 1;
  ok('begehbare Gebäude in jedem Distrikt', info.length >= 18 && ['docks', 'neon', 'krone'].every(d => byD[d] >= 6), JSON.stringify(byD) + ' gesamt ' + info.length);
  const res = await p.evaluate(() => {
    const out = { n: 0, rooms: 0, unreachable: 0, doorBlocked: 0, wallOutside: 0, lootUnreach: 0, noLoot: 0, kinds: {} };
    for (let i = 0; i < NR_TEST.interiors(); i++) {
      const I = NR_TEST.genInterior(i), b = I.b; out.n++; out.rooms += I.leaves.length; out.kinds[I.kind] = (out.kinds[I.kind] || 0) + 1;
      for (const w of I.walls) if (w.x0 < b.x0 - 4 || w.y0 < b.y0 - 4 || w.x1 > b.x1 + 4 || w.y1 > b.y1 + 4) out.wallOutside++;
      const GS = 8, cols = Math.ceil((b.x1 - b.x0) / GS), rows = Math.ceil((b.y1 - b.y0) / GS), seen = new Uint8Array(cols * rows);
      const free = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && !World.blocked(b.x0 + cx * GS + GS / 2, b.y0 + cy * GS + GS / 2, 5);
      const e = I.entrance, sx = Math.floor((e.x - e.nx * 12 - b.x0) / GS), sy = Math.floor((e.y - e.ny * 12 - b.y0) / GS);
      if (World.blocked(e.x + e.nx * 8, e.y + e.ny * 8, 5) || World.blocked(e.x, e.y, 5)) out.doorBlocked++;
      const q = [sx, sy]; if (free(sx, sy)) seen[sy * cols + sx] = 1;
      for (let k = 0; k < q.length; k += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = q[k] + dx, ny = q[k + 1] + dy; if (free(nx, ny) && !seen[ny * cols + nx]) { seen[ny * cols + nx] = 1; q.push(nx, ny); } }
      for (const r of I.leaves) { const cx = Math.floor(((r.x0 + r.x1) / 2 - b.x0) / GS), cy = Math.floor(((r.y0 + r.y1) / 2 - b.y0) / GS); let any = false; for (let y = cy - 2; y <= cy + 2 && !any; y++) for (let x = cx - 2; x <= cx + 2; x++) if (x >= 0 && y >= 0 && x < cols && y < rows && seen[y * cols + x]) { any = true; break; } if (!any) out.unreachable++; }
      if (!I.loot.length) out.noLoot++;
      for (const l of I.loot) { let any = false; for (let y = Math.floor((l.y - 20 - b.y0) / GS); y <= Math.floor((l.y + l.h + 20 - b.y0) / GS) && !any; y++) for (let x = Math.floor((l.x - 20 - b.x0) / GS); x <= Math.floor((l.x + l.w + 20 - b.x0) / GS); x++) if (x >= 0 && y >= 0 && x < cols && y < rows && seen[y * cols + x]) { any = true; break; } if (!any) out.lootUnreach++; }
    }
    return out;
  });
  ok('alle Räume von der Eingangstür erreichbar', res.unreachable === 0, `${res.n} Gebäude, ${res.rooms} Räume, unerreichbar ${res.unreachable}`);
  ok('Eingangstüren frei, Wände im Grundriss', res.doorBlocked === 0 && res.wallOutside === 0, `Tür blockiert ${res.doorBlocked}, Wand außerhalb ${res.wallOutside}`);
  ok('Beute erreichbar', res.lootUnreach === 0, `nicht erreichbar ${res.lootUnreach}, Gebäude ohne Beute ${res.noLoot}; Arten ${JSON.stringify(res.kinds)}`);
  // Hineingehen: vor eine Nudelbar teleportieren und durch die Tür laufen
  const walk = await p.evaluate(async () => {
    Settings.d.drive = 'classic'; const b = interiorNear('nudelbar') || interiorNear(); Interiors.ensure(b); const d = b._door, I = Interiors.gen.get(b.id);
    G.player.x = d.x + d.nx * 50; G.player.y = d.y + d.ny * 50; Input.forced = { mx: -d.nx, my: -d.ny, ax: 640 - d.nx * 100, ay: 360 - d.ny * 100 };
    let enteredAt = -1; for (let t = 0; t < 200; t++) { step(); if (G.inside === b.id && enteredAt < 0) enteredAt = t; }
    Input.forced = null; for (let t = 0; t < 40; t++) step();
    return { inside: G.inside === b.id, enteredAt, cut: +b.cut.toFixed(3), name: I.name, loot: I.loot.length, people: (I.people || []).length, px: G.player.x - b.x0 > 0 && G.player.x < b.x1, audio: Aud.inside };
  });
  ok('Hineingehen durch die Tür, Dach weg', walk.inside && walk.cut < 0.05 && walk.audio, JSON.stringify(walk));
  // Plündern: zum ersten Behälter laufen (teleport daneben) und E drücken
  const loot = await p.evaluate(() => {
    const I = Interiors.cur, l = I.loot[0], c0 = G.credits || 0; G.player.x = l.x + l.w / 2; G.player.y = l.y + l.h + 12; step(); Input.forced = { interactP: true }; step(); Input.forced = null; step();
    return { opened: l.opened, gain: (G.credits || 0) - c0, finds: Object.keys(G.finds).length, type: l.type };
  });
  ok('Behälter durchsuchen (E)', loot.opened && loot.gain >= 0, JSON.stringify(loot));
  const out = await p.evaluate(() => { const b = Interiors.cur.b, d = b._door; G.player.x = d.x - d.nx * 40; G.player.y = d.y - d.ny * 40; Input.forced = { mx: d.nx, my: d.ny }; for (let t = 0; t < 200; t++) step(); Input.forced = null; for (let t = 0; t < 60; t++) step(); return { inside: G.inside, cut: +b.cut.toFixed(3), audio: Aud.inside }; });
  ok('Rausgehen: Dach zurück, Ton draußen', out.inside === null && out.cut > 0.95 && !out.audio, JSON.stringify(out));
  if (errs.length) { console.log('Konsolenfehler:', errs.join(' | ')); bad++; }
  await b.close(); process.exit(bad ? 1 : 0);
})();
