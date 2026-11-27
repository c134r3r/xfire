'use strict';
// 06-world.js - Kachel-Abfragen, Collider-Raster (128 px), Tore, Kreis-Bewegung mit Kollision, Untergrund (Schritte), Minikarte.
// Straßengraph/A*, Flow-Field, Spawn-Ring und Decal-Chunks folgen mit MS2/MS4. Exportiert: World

const World = {
  W: 0, H: 0, tiles: null, grid: new Map(), CELLPX: 128, mini: null,
  init(city) {
    G.city = city; this.lane = city.lane; this.W = city.W; this.H = city.H; this.tiles = city.tiles; this.grid.clear();
    G.buildings = city.buildings; G.lamps = city.lamps; G.gates = city.gates; G.flags = G.flags || { tor1: false, tor2: false };
    const put = (b) => {
      for (let cy = Math.floor(b.y0 / this.CELLPX); cy <= Math.floor(b.y1 / this.CELLPX); cy++)
        for (let cx = Math.floor(b.x0 / this.CELLPX); cx <= Math.floor(b.x1 / this.CELLPX); cx++) { const k = cx + cy * 4096; let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(b); }
    };
    for (const b of city.buildings) put(b);
    for (const g in city.gates) for (const r of city.gates[g]) put(r);
    this.buildMini();
  },
  // Gebäude/Tore, deren Rechteck das Rechteck berührt (einmalig)
  near(x0, y0, x1, y1) {
    const out = new Set();
    for (let cy = Math.floor(y0 / this.CELLPX); cy <= Math.floor(y1 / this.CELLPX); cy++) for (let cx = Math.floor(x0 / this.CELLPX); cx <= Math.floor(x1 / this.CELLPX); cx++) { const l = this.grid.get(cx + cy * 4096); if (l) for (const b of l) if (b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1) out.add(b); }
    return out;
  },
  tile(x, y) { const tx = Math.floor(x / C.TILE), ty = Math.floor(y / C.TILE); return (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) ? TK.WATER : this.tiles[ty * this.W + tx]; },
  override: null,
  gateOpen(g) { if (this.override !== null) return this.override; return !!(G.flags[g] || Q.get('gates') === 'open' || DEBUG); },
  // Kreis gegen Kachel-Wasser und Gebäude/Tore. Liefert true, wenn (x,y,r) blockiert ist.
  blocked(x, y, r) {
    if (this.tile(x - r, y - r) === TK.WATER || this.tile(x + r, y - r) === TK.WATER || this.tile(x - r, y + r) === TK.WATER || this.tile(x + r, y + r) === TK.WATER) return true;
    const cx0 = Math.floor((x - r) / this.CELLPX), cx1 = Math.floor((x + r) / this.CELLPX), cy0 = Math.floor((y - r) / this.CELLPX), cy1 = Math.floor((y + r) / this.CELLPX);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const l = this.grid.get(cx + cy * 4096); if (!l) continue;
      for (const b of l) {
        if (b.gate && this.gateOpen(b.gate)) continue;
        const qx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x, qy = y < b.y0 ? b.y0 : y > b.y1 ? b.y1 : y;
        if ((x - qx) * (x - qx) + (y - qy) * (y - qy) < r * r) return true;
      }
    }
    return false;
  },
  // Nächste freie Stelle (Spirale), z. B. für Szenen-Starts und Teleport
  freeSpot(x, y, r = C.PED_R) {
    if (!this.blocked(x, y, r)) return { x, y };
    for (let rad = 8; rad < 600; rad += 8) for (let a = 0; a < 6.28; a += 0.5) { const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (!this.blocked(px, py, r)) return { x: px, y: py }; }
    return { x, y };
  },
  // Achsenweise bewegen (gleitet an Wänden entlang). p: { x, y, r }
  move(p, dx, dy) {
    if (dx && !this.blocked(p.x + dx, p.y, p.r)) p.x += dx; else if (dx) p.vx = 0;
    if (dy && !this.blocked(p.x, p.y + dy, p.r)) p.y += dy; else if (dy) p.vy = 0;
  },
  // Untergrund für Schritte: asphalt | platte | beton | metall | pfuetze
  surface(x, y) {
    const k = this.tile(x, y);
    if (k === TK.BRIDGE) return 'metall';
    if (k === TK.ROAD || k === TK.JUNCTION || k === TK.CROSSWALK) return hash3(Math.floor(x / 64), Math.floor(y / 64), 5) % 6 === 0 ? 'pfuetze' : 'asphalt';
    if (k === TK.SIDEWALK) return 'platte';
    return 'beton';
  },
  // Nächstes Neon-Licht (für das Summen): { d, x, y } oder null. Lampen sind nicht sortiert -> linear, aber nur alle 10 Ticks gerufen.
  nearestNeon(x, y, max = 260) {
    let best = null, bd = max * max;
    for (const l of G.lamps) { if (l.type !== 'neon') continue; const d = (l.x - x) * (l.x - x) + (l.y - y) * (l.y - y); if (d < bd) { bd = d; best = l; } }
    return best ? { d: Math.sqrt(bd), x: best.x, y: best.y } : null;
  },
  // Minikarte: 1 px je Kachel (Radar + Vollkarte)
  buildMini() {
    const c = mkCanvas(this.W, this.H), g = c.getContext('2d'), im = g.createImageData(this.W, this.H), d = im.data;
    const col = { [TK.WATER]: [10, 24, 40], [TK.ROAD]: [92, 98, 118], [TK.JUNCTION]: [92, 98, 118], [TK.CROSSWALK]: [120, 126, 146], [TK.SIDEWALK]: [64, 70, 86], [TK.LOT]: [34, 38, 50],
      [TK.BRIDGE]: [130, 120, 100], [TK.PARK]: [28, 64, 48], [TK.QUAY]: [50, 58, 72] };
    for (let i = 0; i < this.tiles.length; i++) { const k = col[this.tiles[i]] || col[0]; d[i * 4] = k[0]; d[i * 4 + 1] = k[1]; d[i * 4 + 2] = k[2]; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    g.fillStyle = 'rgba(70,80,110,0.9)';
    for (const b of G.buildings) g.fillRect(b.x0 / C.TILE, b.y0 / C.TILE, Math.max(1, (b.x1 - b.x0) / C.TILE), Math.max(1, (b.y1 - b.y0) / C.TILE));
    this.mini = c;
  }
};
