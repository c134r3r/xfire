'use strict';
// 05-citygen.js - Zonenplan (WORLD.md §2) -> Kacheln, Straßen/Spuren, Zebrastreifen, Gehwege, Kai, Grundstücke, Gebäude, Lichter,
// Landmarken, Dienste, Tore. Seeded: Plan + Seed bestimmen die Stadt vollständig (?seed=, Default 7741).
// MS1-Näherung: ein Bau je Landmarke, Straßengraph/Sackgassen folgen mit MS2, begehbare Innenräume mit MS5.
// Exportiert: TK, genCity, districtAt

// Kachel-Typen (PLAN §4.5)
const TK = { WATER: 0, ROAD: 1, JUNCTION: 2, CROSSWALK: 3, SIDEWALK: 4, LOT: 5, BRIDGE: 6, PARK: 7, QUAY: 8 };

function districtAt(tx) {
  const c = Math.floor(tx / C.CELL);
  for (const d of DISTRICTS) if (c >= d.c0 && c <= d.c1) return d;
  return c < 13 ? DISTRICTS[0] : c < 26 ? DISTRICTS[1] : DISTRICTS[2];       // Kanalzellen 12 und 25 zählen zur näheren Seite
}
function hash3(a, b, c) { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; }

function genCity(seed) {
  const W = C.MAP_TW, H = C.MAP_TH, T = C.TILE, CELL = C.CELL, rnd = rng(seed), R = (a, b) => a + (b - a) * rnd(), RI = (a, b) => Math.floor(R(a, b + 1));
  const cols = ZONE_ROWS[0].length, rows = ZONE_ROWS.length - 1 + 1;
  if (cols * CELL + 2 !== W) throw new Error('Zonenplan passt nicht zu MAP_TW');
  const zone = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols) ? ZONE_ROWS[r][c] : '~';
  const isLM = ch => ch >= 'a' && ch <= 'z';
  const land = ch => ch !== '~' && ch !== 'W';
  const hasN = (c, r) => { const ch = zone(c, r); if (ch === '~') return false; if (ch === 'W') return true; return !(isLM(ch) && zone(c, r - 1) === ch); };
  const hasW = (c, r) => { const ch = zone(c, r); return land(ch) && !(isLM(ch) && zone(c - 1, r) === ch); };
  const tiles = new Uint8Array(W * H), lane = new Int8Array(W * H * 2);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TK.WATER : tiles[y * W + x];
  const isRoad = k => k === TK.ROAD || k === TK.JUNCTION || k === TK.CROSSWALK;

  // --- 1. Straßen, Brücken, Lots ---
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = zone(c, r); if (ch === '~') continue;
    const n = hasN(c, r), w = hasW(c, r);
    for (let ty = 0; ty < CELL; ty++) for (let tx = 0; tx < CELL; tx++) {
      const x = c * CELL + tx, y = r * CELL + ty;
      if (ch === 'W') { tiles[y * W + x] = ty < 2 ? TK.BRIDGE : TK.WATER; continue; }
      const nr = n && ty < 2, wr = w && tx < 2;
      tiles[y * W + x] = nr && wr ? TK.JUNCTION : (nr || wr) ? TK.ROAD : TK.LOT;
    }
  }
  for (let r = 0; r < rows; r++) if (land(zone(cols - 1, r)))                       // Abschlussstraße im Osten
    for (let ty = 0; ty < CELL; ty++) for (let tx = 0; tx < 2; tx++) { const x = cols * CELL + tx, y = r * CELL + ty; tiles[y * W + x] = ty < 2 && hasN(cols - 1, r) ? TK.JUNCTION : TK.ROAD; }
  // --- 2. Spuren (Rechtsverkehr): horizontal oben nach Westen / unten nach Osten, vertikal links nach Süden / rechts nach Norden ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = tiles[y * W + x]; if (k !== TK.ROAD && k !== TK.BRIDGE) continue;
    const c = Math.floor(x / CELL), r = Math.floor(y / CELL), tx = x % CELL, ty = y % CELL, i = (y * W + x) * 2;
    const east = c >= cols, horiz = !east && ty < 2 && (k === TK.BRIDGE || hasN(c, r)) && !(hasW(c, r) && tx < 2 && ty >= 2);
    if (horiz) { lane[i] = ty === 0 ? -1 : 1; lane[i + 1] = 0; }
    else { lane[i] = 0; lane[i + 1] = (east ? x - cols * CELL : tx) === 0 ? 1 : -1; }
  }
  // --- 3. Gehwege (8er-Nachbarschaft zur Straße), Kai (an Wasser), Park/Plätze ---
  const out = tiles.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y * W + x] !== TK.LOT) continue;
    let nearRoad = false, nearWater = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) { const k = at(x + dx, y + dy); if (isRoad(k)) nearRoad = true; if (k === TK.WATER && !dx !== !dy) nearWater = true; }
    out[y * W + x] = nearRoad ? TK.SIDEWALK : nearWater ? TK.QUAY : TK.LOT;
  }
  tiles.set(out);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = zone(c, r); if (!(ch === 'P' || ch === 't' || ch === 'r' || ch === 'z')) continue;
    for (let ty = 0; ty < CELL; ty++) for (let tx = 0; tx < CELL; tx++) { const i = (r * CELL + ty) * W + c * CELL + tx; if (tiles[i] === TK.LOT) tiles[i] = TK.PARK; }
  }
  // --- 4. Zebrastreifen: das Kachelpaar vor jeder Kreuzung in jedem Arm ---
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    if (!(tiles[y * W + x] === TK.JUNCTION && tiles[y * W + x + 1] === TK.JUNCTION && tiles[(y + 1) * W + x] === TK.JUNCTION)) continue;
    const mark = (px, py) => { if (at(px, py) === TK.ROAD) tiles[py * W + px] = TK.CROSSWALK; };
    for (let k = 0; k < 2; k++) { mark(x - 1, y + k); mark(x + 2, y + k); mark(x + k, y - 1); mark(x + k, y + 2); }
  }

  // --- 5. Gebäude ---
  const buildings = [], lamps = [], services = [], landmarks = {};
  const tileBox = (c0, r0, c1, r1, kinds) => {        // umschließendes Rechteck (Kacheln) aller Kacheln der Zellen mit Typ in kinds
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = r0 * CELL; y < (r1 + 1) * CELL; y++) for (let x = c0 * CELL; x < (c1 + 1) * CELL; x++) if (kinds.includes(tiles[y * W + x])) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  };
  const addB = (x0, y0, x1, y1, floors, style, o = {}) => {
    const unit = o.unit || C.FLOOR_H;
    const b = Object.assign({ id: buildings.length, x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1), h: floors * unit, floors, style, seed: hash3(Math.round(x0), Math.round(y0), 7), zone: o.zone }, o);
    if (b.x1 - b.x0 < 8 || b.y1 - b.y0 < 8) return null;
    buildings.push(b); return b;
  };
  const sub = (rc, inset) => ({ x0: (rc.x0 + inset) * T, y0: (rc.y0 + inset) * T, x1: (rc.x1 - inset) * T, y1: (rc.y1 - inset) * T });
  const neonFor = (b, color) => {                      // Neon-Spill an der Straßenseite (Nord- oder Westkante, dort liegen die Straßen)
    b.neon = color; const northSide = rnd() < 0.5, n = Math.max(1, Math.floor(((northSide ? b.x1 - b.x0 : b.y1 - b.y0)) / 180));
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; lamps.push(northSide ? { x: b.x0 + (b.x1 - b.x0) * f, y: b.y0 - 14, type: 'neon', color, ph: rnd() * 6 } : { x: b.x0 - 14, y: b.y0 + (b.y1 - b.y0) * f, type: 'neon', color, ph: rnd() * 6 }); }
  };
  const doneLM = {};
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = zone(c, r); if (!land(ch) || ch === 'P' || ch === '.') continue;
    const dist = districtAt(c * CELL).id, zc = { zone: ch, c, r };
    if (isLM(ch)) {                                   // Landmarke: alle Zellen desselben Buchstabens zusammenhängend
      if (doneLM[ch]) continue; doneLM[ch] = true;
      let c0 = c, r0 = r, c1 = c, r1 = r;
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) if (zone(cc, rr) === ch) { c0 = Math.min(c0, cc); r0 = Math.min(r0, rr); c1 = Math.max(c1, cc); r1 = Math.max(r1, rr); }
      const L = LANDMARKS[ch], box = tileBox(c0, r0, c1, r1, [TK.LOT, TK.PARK, TK.QUAY]); if (!L || !box) continue;
      landmarks[ch] = { id: ch, name: L.name, rect: { x0: box.x0 * T, y0: box.y0 * T, x1: box.x1 * T, y1: box.y1 * T }, center: { x: (box.x0 + box.x1) / 2 * T, y: (box.y0 + box.y1) / 2 * T } };
      if (L.kind === 'bld') {
        const q = sub(box, L.inset), b = addB(q.x0, q.y0, q.x1, q.y1, L.floors, L.style, Object.assign({ zone: ch, landmark: ch, name: L.name, regent: L.regent }, {}));
        if (b && L.neon) neonFor(b, L.neon);
        if (b && L.style === 'white') b.neon = '#3fe8ff', neonFor(b, '#3fe8ff');
      } else if (L.kind === 'stalls') {
        for (let i = 0; i < 3; i++) { const sx = (box.x0 + 1 + i * 2) * T, sy = (box.y0 + 2 + (i % 2)) * T; addB(sx, sy, sx + T * 1.4, sy + T, 1, 'shack', { zone: ch, landmark: ch }); lamps.push({ x: sx + T * 0.7, y: sy + T * 1.4, type: 'sodium', ph: rnd() * 6 }); }
      } else if (L.kind === 'containers') {
        for (let y = box.y0; y + 1 <= box.y1 - 1; y += 2) for (let x = box.x0; x + 2 <= box.x1; x += 3) if (rnd() < 0.7)
          addB(x * T + 4, y * T + 6, (x + 2) * T - 4, (y + 1) * T - 2, RI(1, 3), 'container', { zone: ch, landmark: ch, unit: 16, paint: pickColor(rnd) });
      } else if (L.fire) lamps.push({ x: landmarks[ch].center.x, y: landmarks[ch].center.y, type: 'fire', ph: 1 });
      continue;
    }
    const box = tileBox(c, r, c, r, [TK.LOT]); if (!box) continue;
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0, horiz = bw >= bh, len = horiz ? bw : bh;
    const px = (a, b2) => horiz ? [box.x0 + a, box.y0, box.x0 + b2, box.y1] : [box.x0, box.y0 + a, box.x1, box.y0 + b2];
    const strip = (a, b2, floors, style, o = {}) => { const [x0, y0, x1, y1] = px(a, b2); const q = { x0: x0 * T + 4, y0: y0 * T + 4, x1: x1 * T - 4, y1: y1 * T - 4 }; return addB(q.x0, q.y0, q.x1, q.y1, floors, style, Object.assign({ zone: ch }, o)); };
    if (ch === 'R') {
      const two = len >= 6 && rnd() < 0.55;
      for (const [a, b2] of two ? [[0, Math.floor(len / 2)], [Math.floor(len / 2) + 1, len]] : [[0, len]]) strip(a, b2, RI(8, 18), rnd() < 0.85 ? 'residential' : 'glass');
    } else if (ch === 'C') {
      let p = 0; while (p < len) { const s = Math.min(len - p, RI(2, 4)); const b = strip(p, p + s, RI(4, 12), pickW(rnd, { neon: 5, concrete: 3, glass: 2 })); if (b && b.style === 'neon') neonFor(b, NEON_COLORS[RI(0, 4)]); p += s; }
    } else if (ch === 'I') {
      const hall = Math.max(3, len - 3); strip(0, hall, RI(2, 4), 'industrial');
      for (let i = 0; i < 3; i++) { const x = box.x0 + (horiz ? hall + 0.2 : RI(0, Math.max(0, bw - 2))), y = box.y0 + (horiz ? RI(0, Math.max(0, bh - 1)) : hall + 0.2); addB(x * T + 4, y * T + 4, (x + 1.6) * T, (y + 0.9) * T, RI(1, 3), 'container', { zone: ch, unit: 16, paint: pickColor(rnd) }); }
    } else if (ch === 'S') {
      for (let y = box.y0; y < box.y1; y += 3) for (let x = box.x0; x < box.x1; x += 3) if (rnd() < 0.8) {
        const w2 = Math.min(RI(1, 2), box.x1 - x), h2 = Math.min(RI(1, 2), box.y1 - y); addB(x * T + 6, y * T + 6, (x + w2) * T - 2, (y + h2) * T - 2, RI(1, 3), 'shack', { zone: ch });
        if (rnd() < 0.3) lamps.push({ x: (x + 2.4) * T, y: (y + 0.5) * T, type: 'fire', ph: rnd() * 6 });
      }
    } else if (ch === 'V') {
      const q = sub(box, 1.2); addB(q.x0, q.y0, q.x1, q.y1, RI(2, 5), 'villa', { zone: ch });
    } else if (ch === 'D') {
      for (let y = box.y0; y < box.y1; y += 2) for (let x = box.x0; x + 2 <= box.x1; x += 3) if (rnd() < 0.55)
        addB(x * T + 4, y * T + 6, (x + 2) * T - 4, (y + 1) * T - 2, RI(1, 3), 'container', { zone: ch, unit: 16, paint: pickColor(rnd) });
    } else if (ch >= '1' && ch <= '7') {
      const q = sub(box, 0.6), b = addB(q.x0, q.y0, q.x1, q.y1, RI(6, 8), 'neon', { zone: ch, service: +ch });
      if (b) { const brand = SERVICE_BRAND[c + ',' + r] || ''; b.name = SERVICE_NAMES[ch] + (brand ? ' „' + brand + '“' : ''); neonFor(b, ch === '5' || ch === '2' ? '#3fe8ff' : ch === '3' ? '#ff3b4a' : '#ff3fa4');
        services.push({ code: +ch, name: b.name, c, r, building: b.id, district: dist }); }
    } else if (ch === 'C') { /* oben behandelt */ }
  }
  void RI;
  // --- 6. Laternen (Natrium/LED) an der Bordsteinkante der Gehwege, alle 3 Kacheln (C häufiger, S seltener) ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[y * W + x] !== TK.SIDEWALK) continue;
    const zc = zone(Math.floor(x / CELL), Math.floor(y / CELL)), step = zc === 'C' || (zc >= '1' && zc <= '7') ? 2 : zc === 'S' ? 6 : 3;
    if ((x + y * 2) % step) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isRoad(at(x + dx, y + dy))) {
      lamps.push({ x: x * T + T / 2 + dx * 22, y: y * T + T / 2 + dy * 22, type: hash3(x, y, 3) % 10 < 7 ? 'sodium' : 'led', pole: true, ph: (hash3(x, y, 9) % 600) / 100 }); break;
    }
  }
  // --- 7. Tore (geschlossene Brücken) ---
  const gates = {};
  for (const g in GATES) gates[g] = GATES[g].map(([c, r]) => ({ gate: g, x0: (c * CELL + 3.5) * T, x1: (c * CELL + 4.5) * T, y0: r * CELL * T, y1: (r * CELL + 2) * T }));
  return { W, H, tiles, lane, buildings, lamps, services, landmarks, gates, seed };
}
function pickColor(rnd) { return ['#c8452f', '#2f7bc8', '#d6a72a', '#3fa889', '#8a4fc8', '#c8c8d0'][Math.floor(rnd() * 6)]; }
function pickW(rnd, tbl) { let s = 0; for (const k in tbl) s += tbl[k]; let r = rnd() * s; for (const k in tbl) { r -= tbl[k]; if (r <= 0) return k; } return Object.keys(tbl)[0]; }
