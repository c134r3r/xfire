'use strict';
// 06b-interiors.js - Begehbare Gebäude (PLAN §5.9, §7.11, WORLD.md §14): Auswahl (10 % + Dienste + Story-Orte), Eingangstür mit Licht,
// lazy Grundriss (BSP, genau eine Tür je Teilung), Raumtypen mit Möbeln, Wände/Möbel als Collider, Bewohner, Behälter mit Fundstücken,
// Dach-weg-Übergang (b.cut), Innenlichter. Nur Erdgeschoss. Exportiert: Interiors

const SERVICE_KIND = { 1: 'kapselhotel', 2: 'chipwaesche', 3: 'waffenhaendler', 4: 'od_wache', 5: 'klinik', 6: 'werkstatt', 7: 'kopfgeld' };
const LM_KIND = { u: 'untergrundklinik', n: 'klinik_null', k: 'klinik', g: 'spielhalle' };
const KIND_ROOMS = {                                            // erster Raum = Eingangsraum, Rest nach Größe
  nudelbar: ['bar', 'kueche', 'lager', 'wc', 'hinterzimmer'], bar: ['bar', 'kueche', 'lager', 'wc', 'hinterzimmer'], imbiss: ['imbiss', 'kueche', 'lager', 'wc'],
  spielhalle: ['spiel', 'lager', 'wc', 'hinterzimmer'], pfandhaus: ['pfand', 'lager', 'hinterzimmer'],
  wohnung: ['wohnzimmer', 'schlaf', 'kueche', 'bad', 'schlaf'], halle: ['halle', 'buero', 'lager'], werkstatt: ['halle', 'buero', 'lager'], huette: ['huette'],
  villa: ['salon', 'schlaf', 'arbeit', 'bad', 'salon', 'lager'],
  kapselhotel: ['empfang', 'kapseln', 'kapseln', 'wc'], chipwaesche: ['empfang', 'waesche', 'lager'], waffenhaendler: ['waffenladen', 'lager'], od_wache: ['wache', 'zellen', 'buero'],
  klinik: ['empfang', 'behandlung', 'betten', 'lager'], kopfgeld: ['terminalraum', 'lager'], untergrundklinik: ['behandlung', 'lager', 'betten'], klinik_null: ['labor', 'betten', 'zellen']
};
const KIND_NAMES = {
  nudelbar: ['Nudelbar „Suzu“', 'Nudelhaus „Zum letzten Schirm“', 'Oma Nguyens Suppenküche', 'Nudelbar „Chip ab“'],
  bar: ['Bar „Glühwürmchen“', 'Bar „Der durstige Regent“', 'Bar 24', 'Bar „Zur schiefen Laterne“'], imbiss: ['Imbiss „Heiße Nacht“', 'Imbiss „Regenbogenwurst“', 'Imbiss „Ohne Gewähr“'],
  spielhalle: ['Spielhalle „Hochspannung“', 'Spielhalle „Letzter Kredit“', 'Spielhalle „Highscore des Regenten“'], pfandhaus: ['Pfandhaus „Zweite Chance“', 'Pfandhaus „Fast Neu“', 'Pfandhaus „Herz & Niere“'],
  wohnung: ['Wohnung 4B', 'Wohnung 12A', 'Wohnung 7C (Untermiete)', 'Wohnung 3D', 'Wohnung 9F'], halle: ['Lagerhalle 7', 'Lagerhalle „Kein Zutritt“', 'Halle 12'], werkstatt: ['Werkstatt „Schrauber Ede“', 'Werkstatt „Funken & Söhne“'],
  huette: ['Hütte', 'Blechhütte', 'Hütte mit Aussicht (auf Hütten)'], villa: ['Villa „Stillleben“', 'Villa „Ruhig & Gelassen“', 'Villa Perlmutt'],
  untergrundklinik: ['Untergrundklinik'], klinik_null: ['Klinik Null']
};
const ROOM_LABEL = { bar: 'Gastraum', imbiss: 'Imbiss', kueche: 'Küche', lager: 'Lager', wc: 'WC', hinterzimmer: 'Hinterzimmer', spiel: 'Spielhalle', pfand: 'Pfandhaus', wohnzimmer: 'Wohnzimmer', schlaf: 'Schlafzimmer', bad: 'Bad',
  halle: 'Halle', buero: 'Büro', huette: 'Hütte', salon: 'Salon', arbeit: 'Arbeitszimmer', empfang: 'Empfang', kapseln: 'Kapselgang', waesche: 'Waschkabine', waffenladen: 'Verkaufsraum', wache: 'Wache', zellen: 'Zellentrakt',
  behandlung: 'Behandlungsraum', betten: 'Bettenraum', terminalraum: 'Terminalraum', labor: 'Labor' };
const ROOM_SOUND = { bar: 'bar', imbiss: 'bar', spiel: 'bar', behandlung: 'klinik', betten: 'klinik', labor: 'klinik', empfang: 'hum', halle: 'halle' };   // Raum -> Atmosphäre (Standard: hum)

const Interiors = {
  list: [], gen: new Map(), floors: new Map(), floorPx: 0, cur: null, talkCd: 0,
  // ---- Auswahl und Eingang ----
  init() {
    const T = C.TILE, cand = []; this.list.length = 0; this.gen.clear(); this.floors.clear();
    const kindOf = b => {
      if (b.service) return SERVICE_KIND[b.service];
      if (b.landmark) return LM_KIND[b.landmark];
      const r = hash3(b.id, b.seed, 5) % 100, z = b.zone;
      if (z === 'R') return 'wohnung'; if (z === 'V') return 'villa'; if (z === 'S') return 'huette'; if (z === 'I') return r < 60 ? 'halle' : 'werkstatt';
      if (z === 'C') return r < 30 ? 'nudelbar' : r < 55 ? 'bar' : r < 75 ? 'imbiss' : r < 90 ? 'spielhalle' : 'pfandhaus';
      return null;
    };
    for (const b of G.buildings) {
      if (b.style === 'container' || b.unit || b.style === 'ruin' || b.gate) continue;
      const w = b.x1 - b.x0, h = b.y1 - b.y0, kind = kindOf(b); if (!kind) continue;
      const forced = b.service || (b.landmark && LM_KIND[b.landmark]);
      if (!forced && Math.min(w, h) < (b.zone === 'S' ? 92 : 128)) continue;
      const door = this.findDoor(b); if (!door) continue;
      b._kind = kind; b._door = door;
      if (forced || hash3(b.id, b.seed, 77) % 100 < 10) this.enable(b); else cand.push(b);
    }
    // Pro Distrikt mindestens 6 begehbare Gebäude (gleichmäßige Verteilung)
    for (const d of DISTRICTS) {
      let n = this.list.filter(b => districtAt(b.x0 / T).id === d.id).length;
      for (const b of cand.filter(b => districtAt(b.x0 / T).id === d.id).sort((a, c) => hash3(a.id, 3, 9) - hash3(c.id, 3, 9))) { if (n >= 6) break; this.enable(b); n++; }
    }
  },
  enable(b) {
    if (b.enterable) return; b.enterable = true; b.cut = 1;
    const names = KIND_NAMES[b._kind]; if (!b.name || !b.service) b.iname = b.name || (names ? names[hash3(b.id, 8, 1) % names.length] : 'Innenraum');
    if (b.service) b.iname = b.name;
    const d = b._door, col = b.neon || (b._kind === 'klinik' || b._kind === 'klinik_null' ? '#3fe8ff' : b._kind === 'bar' || b._kind === 'nudelbar' ? '#ff3fa4' : '#ffb070');
    b._lamp = { x: d.x + d.nx * 16, y: d.y + d.ny * 16, type: 'door', color: col, ph: (b.id % 7) };
    G.lamps.push(b._lamp); this.list.push(b);
  },
  // Eingangsseite: die Seite, vor der ein Gehweg liegt (Straßen liegen im Norden/Westen der Zelle, deshalb zuerst N, W)
  findDoor(b) {
    const T = C.TILE, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, t = 0.3 + (hash3(b.id, 4, 4) % 40) / 100;
    for (const s of ['N', 'W', 'S', 'E']) {
      const x = s === 'N' || s === 'S' ? b.x0 + (b.x1 - b.x0) * t : (s === 'W' ? b.x0 : b.x1), y = s === 'W' || s === 'E' ? b.y0 + (b.y1 - b.y0) * t : (s === 'N' ? b.y0 : b.y1);
      const nx = s === 'W' ? -1 : s === 'E' ? 1 : 0, ny = s === 'N' ? -1 : s === 'S' ? 1 : 0;
      for (const dd of [20, 44, 70, 100]) { const k = World.tile(x + nx * dd, y + ny * dd); if (k === TK.WATER || k === TK.ROAD || k === TK.JUNCTION) break; if ((k === TK.SIDEWALK || k === TK.QUAY || k === TK.PARK) && !World.blocked(x + nx * 24, y + ny * 24, 6)) return { side: s, x, y, nx, ny }; }
    }
    return null;
  },

  // ---- Grundriss (lazy, deterministisch aus b.seed) ----
  ensure(b) {
    let I = this.gen.get(b.id); if (I) return I;
    const rnd = rng(b.seed ^ 0x51ed), W = b.x1 - b.x0, H = b.y1 - b.y0, kind = b._kind, MIN = C.ROOM_MIN, leaves = [], doors = [], splits = [];
    I = { b, kind, leaves, doors, walls: [], rects: [], loot: [], lights: [], npcs: [], name: b.iname };
    const maxDepth = kind === 'huette' ? 0 : kind === 'halle' || kind === 'werkstatt' || kind === 'pfandhaus' ? 1 : 3;
    const split = (r, depth) => {
      const w = r.x1 - r.x0, h = r.y1 - r.y0, canV = w >= MIN * 2, canH = h >= MIN * 2;
      if (depth >= maxDepth || (!canV && !canH) || (depth >= 2 && rnd() < 0.3)) { leaves.push(r); return [r]; }
      const vert = canV && (!canH || w > h * 1.15 || (w * 1.15 >= h && rnd() < 0.5));
      const sp = Math.round(vert ? r.x0 + w * (0.4 + rnd() * 0.2) : r.y0 + h * (0.4 + rnd() * 0.2));
      const A = vert ? { x0: r.x0, y0: r.y0, x1: sp, y1: r.y1 } : { x0: r.x0, y0: r.y0, x1: r.x1, y1: sp }, B = vert ? { x0: sp, y0: r.y0, x1: r.x1, y1: r.y1 } : { x0: r.x0, y0: sp, x1: r.x1, y1: r.y1 };
      const la = split(A, depth + 1), lb = split(B, depth + 1); splits.push({ vert, at: sp, from: vert ? r.y0 : r.x0, to: vert ? r.y1 : r.x1 });
      let best = null;                                                    // genau eine Tür je Teilung: Mitte des längsten gemeinsamen Wandstücks (trifft nie eine Querwand)
      for (const a of la) for (const c of lb) {
        const touch = vert ? a.x1 === sp && c.x0 === sp : a.y1 === sp && c.y0 === sp; if (!touch) continue;
        const lo = vert ? Math.max(a.y0, c.y0) : Math.max(a.x0, c.x0), hi = vert ? Math.min(a.y1, c.y1) : Math.min(a.x1, c.x1);
        if (hi - lo >= 44 && (!best || hi - lo > best.hi - best.lo)) best = { lo, hi };
      }
      if (best) { const mid = (best.lo + best.hi) / 2; doors.push({ vert, at: sp, from: mid - 14, to: mid + 14 }); }
      return la.concat(lb);
    };
    split({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, 0);
    // Eingangstür: im Raum, der die Eingangsseite berührt und die Türposition am besten überdeckt; nie auf einer Querwand
    const d = b._door, vertSide = d.side === 'W' || d.side === 'E', at = vertSide ? (d.side === 'W' ? b.x0 : b.x1) : (d.side === 'N' ? b.y0 : b.y1);
    const touching = leaves.filter(r => vertSide ? (d.side === 'W' ? r.x0 === b.x0 : r.x1 === b.x1) : (d.side === 'N' ? r.y0 === b.y0 : r.y1 === b.y1));
    const along = r => vertSide ? [r.y0, r.y1] : [r.x0, r.x1], pos = vertSide ? d.y : d.x;
    let front = touching.find(r => pos > along(r)[0] + 24 && pos < along(r)[1] - 24) || touching.sort((p, q) => (along(q)[1] - along(q)[0]) - (along(p)[1] - along(p)[0]))[0];
    const [lo, hi] = along(front), dc = clamp(pos, lo + 24, hi - 24);
    doors.push({ vert: vertSide, at, from: dc - 16, to: dc + 16, entrance: true });
    d.x = vertSide ? at : dc; d.y = vertSide ? dc : at; b._lamp.x = d.x + d.nx * 16; b._lamp.y = d.y + d.ny * 16; I.entrance = { x: d.x, y: d.y, nx: d.nx, ny: d.ny };
    // Wände = alle Raumkanten minus Türen (dünne AABBs, zugleich Collider)
    for (const r of leaves) for (const sg of [{ vert: false, at: r.y0, from: r.x0, to: r.x1 }, { vert: false, at: r.y1, from: r.x0, to: r.x1 }, { vert: true, at: r.x0, from: r.y0, to: r.y1 }, { vert: true, at: r.x1, from: r.y0, to: r.y1 }]) {
      let parts = [[sg.from, sg.to]];
      for (const dd of doors) if (dd.vert === sg.vert && Math.abs(dd.at - sg.at) < 1) parts = parts.flatMap(([a, c]) => (dd.to <= a || dd.from >= c) ? [[a, c]] : [[a, dd.from], [dd.to, c]].filter(([u, v]) => v - u > 2));
      for (const [a, c] of parts) { const w = sg.vert ? { x0: sg.at - 3, y0: a - 3, x1: sg.at + 3, y1: c + 3 } : { x0: a - 3, y0: sg.at - 3, x1: c + 3, y1: sg.at + 3 }; w.wall = true; w.bid = b.id; I.walls.push(w); }
    }
    // Raumtypen: Eingangsraum zuerst, der Rest nach Größe
    const order = KIND_ROOMS[kind] || ['wohnzimmer'], rest = leaves.filter(r => r !== front).sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) - (p.x1 - p.x0) * (p.y1 - p.y0));
    front.type = order[0]; rest.forEach((r, i) => { r.type = order[Math.min(i + 1, order.length - 1)]; });
    I.walls.forEach(w => I.rects.push(w));
    this.gen.set(b.id, I);
    const floor = this.paint(I, true);                                  // Boden + Möbel malen UND Collider/Beute/Lichter/Bewohner sammeln
    this.floors.set(b.id, floor); this.floorPx += floor.width * floor.height;
    // Türfreiheit: Möbel/Beute in der Türzone (26 px beidseits) werden nicht solid bzw. entfernt - jede Tür bleibt passierbar
    const zones = doors.map(dd => dd.vert ? { x0: dd.at - 26, x1: dd.at + 26, y0: dd.from - 6, y1: dd.to + 6 } : { x0: dd.from - 6, x1: dd.to + 6, y0: dd.at - 26, y1: dd.at + 26 });
    const hit = r => zones.some(z => r.x0 < z.x1 && r.x1 > z.x0 && r.y0 < z.y1 && r.y1 > z.y0);
    I.loot = I.loot.filter(l => !hit({ x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h }));
    I.rects = I.rects.filter(r => r.wall || !hit(r) || I.loot.some(l => l.x === r.x0 && l.y === r.y0));
    this.validate(I);                                                     // unerreichbare Räume entrümpeln, unerreichbare Beute entfernen (Flutfüllung, Spielerradius 5)
    for (const r of I.rects) { r.bid = b.id; if (!r.wall) r.furn = true; }
    World.addRects(I.rects); b.hollow = true;
    I.npcs.forEach(n => { const p = makePed(n.x, n.y, { design: pickDesign(rnd) }); G.peds.pop(); Object.assign(p, { state: 'stand', npc: true, inside: b.id, role: n.role, a: n.a, home: { x: n.x, y: n.y }, barkT: 200 + Math.floor(rnd() * 400), seated: n.seated }); I.people = I.people || []; I.people.push(p); });
    return I;
  },

  // Erreichbarkeit sichern: Flutfüllung ab der Eingangstür auf dem 8-px-Raster gegen die eigenen Rechtecke
  validate(I) {
    const b = I.b, GS = 8, cols = Math.ceil((b.x1 - b.x0) / GS), rows = Math.ceil((b.y1 - b.y0) / GS), e = I.entrance;
    const hits = (x, y) => { for (const r of I.rects) { const qx = x < r.x0 ? r.x0 : x > r.x1 ? r.x1 : x, qy = y < r.y0 ? r.y0 : y > r.y1 ? r.y1 : y; if ((x - qx) * (x - qx) + (y - qy) * (y - qy) < 25) return true; } return false; };
    const flood = () => {
      const seen = new Uint8Array(cols * rows), free = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && !hits(b.x0 + cx * GS + GS / 2, b.y0 + cy * GS + GS / 2);
      const sx = Math.floor((e.x - e.nx * 12 - b.x0) / GS), sy = Math.floor((e.y - e.ny * 12 - b.y0) / GS), q = [sx, sy]; if (free(sx, sy)) seen[sy * cols + sx] = 1;
      for (let k = 0; k < q.length; k += 2) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = q[k] + dx, ny = q[k + 1] + dy; if (free(nx, ny) && !seen[ny * cols + nx]) { seen[ny * cols + nx] = 1; q.push(nx, ny); } }
      return (x0, y0, x1, y1) => { for (let y = Math.floor((y0 - b.y0) / GS); y <= Math.floor((y1 - b.y0) / GS); y++) for (let x = Math.floor((x0 - b.x0) / GS); x <= Math.floor((x1 - b.x0) / GS); x++) if (x >= 0 && y >= 0 && x < cols && y < rows && seen[y * cols + x]) return true; return false; };
    };
    let reach = flood();
    for (const r of I.leaves) if (!reach(r.x0, r.y0, r.x1, r.y1)) { I.rects = I.rects.filter(q => q.wall || !((q.x0 + q.x1) / 2 > r.x0 && (q.x0 + q.x1) / 2 < r.x1 && (q.y0 + q.y1) / 2 > r.y0 && (q.y0 + q.y1) / 2 < r.y1)); I.loot = I.loot.filter(l => !((l.x + l.w / 2) > r.x0 && (l.x + l.w / 2) < r.x1 && (l.y + l.h / 2) > r.y0 && (l.y + l.h / 2) < r.y1)); I.cleared = (I.cleared || 0) + 1; }
    if (I.cleared) reach = flood();
    if (I.leaves.some(r => !reach(r.x0, r.y0, r.x1, r.y1))) { I.rects = I.rects.filter(q => q.wall || I.loot.some(l => l.x === q.x0 && l.y === q.y0)); I.cleared = 99; reach = flood(); }   // Notfall: Möbel nicht solid, nur Wände und Behälter bleiben
    const keep = []; for (const l of I.loot) { if (reach(l.x - 16, l.y - 16, l.x + l.w + 16, l.y + l.h + 16)) keep.push(l); else I.rects = I.rects.filter(q => !(q.x0 === l.x && q.y0 === l.y)); }
    I.loot = keep; I.loot.forEach((l, i) => { l.id = i; });
  },
  // Boden + Möbel malen (2x). collect: Collider/Beute/Lichter/Bewohner erfassen (nur beim ersten Durchlauf; spätere Repaints sind rein optisch)
  paint(I, collect) {
    const b = I.b, S2 = 2, W = b.x1 - b.x0, H = b.y1 - b.y0, c = mkCanvas(W * S2, H * S2), g = c.getContext('2d'), rnd = rng(b.seed ^ 0x77a1);
    g.scale(S2, S2); g.translate(-b.x0, -b.y0);
    const K = {
      g, I, rnd, R: (a, c2) => a + (c2 - a) * rnd(), pick: a => a[(rnd() * a.length) | 0],
      rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); },
      box(x, y, w, h, top, edge, solid = true) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + 3, w, h); g.fillStyle = top; g.fillRect(x, y, w, h); if (edge) { g.strokeStyle = edge; g.lineWidth = 1.4; g.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4); } if (collect && solid && w * h > 140) I.rects.push({ x0: x, y0: y, x1: x + w, y1: y + h }); },
      disc(x, y, r, col, edge, solid = false) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 2, y + 3, r, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 1.2; g.stroke(); } if (collect && solid) I.rects.push({ x0: x - r * 0.8, y0: y - r * 0.8, x1: x + r * 0.8, y1: y + r * 0.8 }); },
      checker(r, c1, c2, n = 16) { for (let y = r.y0; y < r.y1; y += n) for (let x = r.x0; x < r.x1; x += n) { g.fillStyle = ((x - r.x0) / n + (y - r.y0) / n) % 2 ? c1 : c2; g.fillRect(x, y, n, n); } },
      noise(r, a = 0.06) { for (let i = 0; i < (r.x1 - r.x0) * (r.y1 - r.y0) / 500; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${a})`; g.fillRect(K.R(r.x0, r.x1), K.R(r.y0, r.y1), 2, 2); } },
      loot(type, x, y, w = 16, h = 14) { if (collect) { I.loot.push({ type, x, y, w, h, opened: false, id: I.loot.length }); I.rects.push({ x0: x, y0: y, x1: x + w, y1: y + h }); } },
      light(x, y, r, col, k = 0.8) { if (collect) I.lights.push([x, y, r, col, k]); },
      npc(role, x, y, a = 0, seated = false) { if (collect) I.npcs.push({ role, x, y, a, seated }); }
    };
    for (const r of I.leaves) { r.w = r.x1 - r.x0; r.h = r.y1 - r.y0; r.cx = (r.x0 + r.x1) / 2; r.cy = (r.y0 + r.y1) / 2; (ROOM_PAINT[r.type] || ROOM_PAINT.lager)(K, r); }
    return c;
  },
  floor(I) {                                       // Boden-Textur aus dem LRU holen, sonst neu malen (deterministisch)
    let c = this.floors.get(I.b.id);
    if (c) { this.floors.delete(I.b.id); this.floors.set(I.b.id, c); return c; }
    c = this.paint(I, false); this.floors.set(I.b.id, c); this.floorPx += c.width * c.height;
    while (this.floorPx > 5e6 && this.floors.size > 1) { const k = this.floors.keys().next().value, o = this.floors.get(k); this.floors.delete(k); this.floorPx -= o.width * o.height; }
    return c;
  },

  // ---- Zustand pro Tick ----
  update() {
    const p = G.player; if (!p) return;
    let made = 0, inside = null;
    for (const b of this.list) {
      const near = Math.abs(p.x - (b.x0 + b.x1) / 2) < 900 && Math.abs(p.y - (b.y0 + b.y1) / 2) < 900;
      if (near && !this.gen.has(b.id) && made < 2) { this.ensure(b); made++; }
      const I = this.gen.get(b.id); if (!I) continue;
      if (!p.veh && p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1) inside = I;
    }
    const prev = this.cur; this.cur = inside; G.inside = inside ? inside.b.id : null;
    if (inside !== prev) {
      Aud.setInside(!!inside); Aud.play('tuer_schieb', { gain: 0.8, cat: 'sfx' });
      if (inside && inside.people && !inside._greeted) inside._greeted = true;
    }
    for (const I of this.gen.values()) {
      const b = I.b, target = G.inside === b.id ? 0 : 1; b.cut += (target - b.cut) * 0.08; if (Math.abs(b.cut - target) < 0.004) b.cut = target;
      if (G.inside === b.id) this.updatePeople(I);
    }
    if (this.talkCd > 0) this.talkCd--;
    if (inside && G.in.interactP && this.talkCd <= 0) this.interact(inside);
    G.near = inside ? this.nearest(inside) : null;
  },
  // Bewohner: stehen/sitzen, drehen sich zum Spieler, sagen Sprüche
  updatePeople(I) {
    const p = G.player;
    for (const n of I.people || []) {
      if (n.state === 'flee') continue;
      const d = Math.hypot(p.x - n.x, p.y - n.y);
      if (d < 140) n.a = angleLerp(n.a, Math.atan2(p.y - n.y, p.x - n.x), 0.08);
      if (--n.barkT <= 0) { n.barkT = 360 + Math.floor(R.fn() * 500); if (d < 220) bark(n, barkPick(STR.barks[I.kind === 'wohnung' || I.kind === 'villa' || I.kind === 'huette' ? 'home' : ROOM_SOUND[I.leaves[0].type] === 'bar' ? 'guest' : 'shop']), 220); }
    }
  },
  nearest(I) {
    const p = G.player; let best = null, bd = 34;
    for (const l of I.loot) { if (l.opened) continue; const d = Math.hypot(Math.max(l.x - p.x, 0, p.x - (l.x + l.w)), Math.max(l.y - p.y, 0, p.y - (l.y + l.h))); if (d < bd) { bd = d; best = { k: 'loot', o: l, x: l.x + l.w / 2, y: l.y, label: LOOT[l.type].n }; } }
    for (const n of I.people || []) { const d = Math.hypot(n.x - p.x, n.y - p.y) - 8; if (d < bd) { bd = d; best = { k: 'npc', o: n, x: n.x, y: n.y - 10, label: n.role === 'wirt' || n.role === 'haendler' ? 'ANSPRECHEN · ' + n.role.toUpperCase() : 'ANSPRECHEN' }; } }
    return best;
  },
  interact(I) {
    const t = this.nearest(I); if (!t) return; this.talkCd = 24;
    if (t.k === 'npc') {
      const n = t.o; let line;
      if (n.role === 'wirt') {                                                  // Nudelsuppe: 8 CR, +25 Vital
        if ((G.credits || 0) >= 8) { G.credits -= 8; G.player.hp = Math.min(G.player.maxHp, G.player.hp + 25); line = 'Nudelsuppe? Acht Credits. Schmeckt nach Salz, wirkt wie Medizin.'; Aud.play('kasse', { gain: 0.7, cat: 'ui', bus: 'ui' }); floatText(G.player.x, G.player.y - 18, '+25 VITAL · −8 CR', '#7dffd8', 12); }
        else line = 'Ohne Credits keine Suppe. Das ist keine Willkür. Das ist Ordnung.';
      } else line = barkPick(STR.barks[I.kind === 'wohnung' || I.kind === 'villa' || I.kind === 'huette' ? 'home' : ROOM_SOUND[I.leaves[0].type] === 'bar' ? 'guest' : 'shop']);
      n.barkT = 400; for (const b of G.barks) if (b.p === n) b.t = 0; bark(n, line, 260); return;
    }
    const l = t.o, L = LOOT[l.type]; l.opened = true; Aud.play('kiste_auf', { gain: 0.9, cat: 'sfx' });
    const cr = L.cr[0] + Math.floor(R.fn() * (L.cr[1] - L.cr[0] + 1)); let find = null;
    if (R.fn() < L.f) { const fresh = FUNDE.filter(f => !G.finds[f.id]); find = (fresh.length && R.fn() < 0.75 ? fresh : FUNDE)[Math.floor(R.fn() * (fresh.length && R.fn() < 0.75 ? fresh.length : FUNDE.length))]; if (!fresh.includes(find) && fresh.length) find = fresh[Math.floor(R.fn() * fresh.length)]; }
    const gain = cr + (find ? find.v : 0); G.credits = (G.credits || 0) + gain; G.stats.cr += gain;
    if (L.food) { G.player.hp = Math.min(G.player.maxHp, G.player.hp + 12); floatText(l.x + l.w / 2, l.y - 6, '+12 VITAL · Fertignudeln', '#7dffd8', 12); }
    if (find) { G.finds[find.id] = (G.finds[find.id] || 0) + 1; G.stats.finds++; Aud.play('fund', { gain: 0.9, cat: 'ui', bus: 'ui' }); HUD.say('FUND · ' + L.n.toUpperCase(), `${find.n} (+${find.v} CR). ${find.t}`, '#ffd84a'); }
    else HUD.say(L.n.toUpperCase(), cr > 0 ? `${STR.loot.cr(cr)}. Mehr nicht.` : STR.loot.empty, '#8a93a6');
    if (cr > 0) { Aud.play('kasse', { gain: 0.6, cat: 'ui', bus: 'ui' }); floatText(l.x + l.w / 2, l.y - 10, STR.loot.cr(gain), '#ffd84a', 13); }
    if (L.noisy || l.type === 'kasse') for (const n of I.people || []) if (Math.hypot(n.x - l.x, n.y - l.y) < 260) { bark(n, l.type === 'safe' ? 'Hey! Das ist mein Safe! Also … der vom Regenten.' : 'Finger weg von der Kasse!', 200); break; }
  },

  // ---- Rendering ----
  open() { const out = []; for (const I of this.gen.values()) if (I.b.cut < 0.999 && onScreen((I.b.x0 + I.b.x1) / 2, (I.b.y0 + I.b.y1) / 2, 400)) out.push(I); return out; },
  drawFloors(list) { for (const I of list) { const b = I.b; ctx.drawImage(this.floor(I), b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); } },
  drawEntities(list) {
    for (const I of list) {
      for (const l of I.loot) {                                              // Behälter: dynamisch (geöffnet/ungeöffnet), ungeöffnete funkeln
        if (!onScreen(l.x, l.y, 30)) continue; lootSprite(ctx, l);
      }
      for (const n of I.people || []) { if (!onScreen(n.x, n.y, 30)) continue; ctx.globalAlpha = 0.6; ctx.drawImage(shadowSprite(7, 5), n.x - 19 + 2, n.y - 17 + 4); ctx.globalAlpha = 1; drawPerson(n.x, n.y, n.a, n.d, 0, { scale: n.seated ? 0.92 : 1 }); }
    }
  },
  drawWalls(list, V) {                                                       // alle Wände eines Hauses mit demselben D: erst Seiten (dunkel), dann Oberkanten (hell) - PLAN §5.9
    for (const I of list) {
      const b = I.b, D = lean((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, C.WALL_H, V.cx, V.cy), a = 1 - b.cut; ctx.globalAlpha = a;
      ctx.fillStyle = '#3e434e'; ctx.beginPath();
      for (const w of I.walls) { if (!onScreen((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, 200)) continue;
        for (const [ax, ay, bx, by] of [[w.x0, w.y0, w.x1, w.y0], [w.x0, w.y1, w.x1, w.y1], [w.x0, w.y0, w.x0, w.y1], [w.x1, w.y0, w.x1, w.y1]]) { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + D.x, by + D.y); ctx.lineTo(ax + D.x, ay + D.y); ctx.closePath(); } }
      ctx.fill(); ctx.fillStyle = '#aab2c0'; ctx.beginPath();
      for (const w of I.walls) if (onScreen((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, 200)) ctx.rect(w.x0 + D.x, w.y0 + D.y, w.x1 - w.x0, w.y1 - w.y0);
      ctx.fill(); ctx.globalAlpha = 1;
    }
  },
  lights() {                                                                  // Innenlichter x (1 - cut)
    for (const I of this.gen.values()) { const a = 1 - I.b.cut; if (a < 0.02 || !onScreen((I.b.x0 + I.b.x1) / 2, (I.b.y0 + I.b.y1) / 2, 500)) continue; for (const [x, y, r, col, k] of I.lights) Lights.add(x, y, r, col, k * a); }
  }
};

// Behälter-Sprites (dynamisch): ungeöffnet mit pulsierender Kante, geöffnet dunkel
function lootSprite(g, l) {
  const cols = { spind: ['#5a6472', '#9aa6b8'], schublade: ['#6a4a34', '#c09070'], kuehlschrank: ['#dfe3ea', '#ffffff'], safe: ['#2e3138', '#c9a227'], kiste: ['#9a7a4a', '#5a4020'], truhe: ['#5a3a24', '#d8a84a'], kasse: ['#3a3f4a', '#7dffd8'] }[l.type];
  g.save(); g.translate(l.x, l.y);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(2, 3, l.w, l.h);
  g.fillStyle = l.opened ? shade(cols[0], -45) : cols[0]; g.fillRect(0, 0, l.w, l.h);
  g.strokeStyle = l.opened ? 'rgba(0,0,0,0.5)' : cols[1]; g.lineWidth = 1.4; g.strokeRect(0.7, 0.7, l.w - 1.4, l.h - 1.4);
  if (l.type === 'spind') { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(l.w / 2 - 0.5, 1, 1, l.h - 2); g.fillStyle = cols[1]; g.fillRect(l.w / 2 - 3, l.h / 2 - 1, 1.5, 2); g.fillRect(l.w / 2 + 1.5, l.h / 2 - 1, 1.5, 2); }
  else if (l.type === 'schublade') { g.fillStyle = cols[1]; g.fillRect(2, 3, l.w - 4, 1.4); g.fillRect(2, l.h - 5, l.w - 4, 1.4); }
  else if (l.type === 'kuehlschrank') { g.fillStyle = '#8a9098'; g.fillRect(l.w - 5, 2, 1.6, l.h - 4); }
  else if (l.type === 'safe') { g.fillStyle = cols[1]; g.beginPath(); g.arc(l.w / 2, l.h / 2, 3.2, 0, TAU); g.fill(); g.fillStyle = '#2e3138'; g.fillRect(l.w / 2 - 0.6, l.h / 2 - 2.4, 1.2, 2.4); }
  else if (l.type === 'kiste') { g.strokeStyle = cols[1]; g.beginPath(); g.moveTo(1, 1); g.lineTo(l.w - 1, l.h - 1); g.moveTo(l.w - 1, 1); g.lineTo(1, l.h - 1); g.stroke(); }
  else if (l.type === 'truhe') { g.fillStyle = cols[1]; g.fillRect(0, l.h / 2 - 1, l.w, 2); g.fillRect(l.w / 2 - 2, l.h / 2 - 2.5, 4, 5); }
  else { g.fillStyle = '#05070c'; g.fillRect(2, 2, l.w - 4, 4); g.fillStyle = cols[1]; g.fillRect(3, 3, l.w - 6, 2); }
  if (!l.opened) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.2 * Math.sin(G.time * 0.1 + l.id * 1.3); g.fillStyle = '#ffe48a'; g.fillRect(-1, -1, l.w + 2, l.h + 2); g.globalCompositeOperation = 'source-over'; }
  g.restore();
}
