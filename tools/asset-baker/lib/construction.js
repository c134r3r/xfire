// ============================================
// Construction stages for buildings. A finished model is taken apart
// again into four states that read as real building work rather than a
// sprite sliding up out of the ground:
//   1 site      - foundations poured / pit dug, materials delivered
//   2 frame     - structural skeleton of every main volume
//   3 shell     - raw, unpainted volumes inside scaffolding
//   4 fit-out   - finished building, lights off, last scaffold standing
// It works on any model: the main volumes are found by size.
// ============================================
import * as THREE from 'three';
import { tint } from './kit.js';
import { Fr } from './parts.js';

const LOOK = {
    survivors: { slab: '#8a877c', frame: '#7a4634', raw: '#8f8b7f', pole: '#b9a25a', plank: '#7c6238', node: null },
    evolved: { slab: '#3a2718', frame: '#d8cfae', raw: '#b89274', pole: '#d8cfae', plank: '#6e4a2e', node: null },
    series9: { slab: '#3a4149', frame: '#3f4750', raw: '#4d545d', pole: '#566069', plank: '#2e343b', node: '#4dffa6' }
};

function survey(kit, ft) {
    const out = [];
    for (const m of [...kit.group.children]) {
        if (!m.isMesh) continue;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox;
        const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
        const mat = m.material, fin = mat.userData.finish;
        out.push({
            m, b, sx, sy, sz, fin, vol: sx * sy * Math.max(sz, 0.01),
            glow: !!mat.isMeshBasicMaterial, decal: !!mat.transparent, team: !!mat.userData.team,
            ground: !mat.transparent && !mat.userData.team && b.max.z < 2.4 && sx * sy > ft * ft * 32 * 32 * 0.45
        });
    }
    const solid = out.filter(i => !i.ground && !i.decal && !i.glow && !i.team);
    const maxVol = Math.max(1, ...solid.map(i => i.vol));
    for (const i of out) i.main = solid.includes(i) && i.sz >= 4.5 && i.vol >= maxVol * 0.045 && Math.min(i.sx, i.sy) >= 5;
    // always keep at least the biggest volume
    if (!out.some(i => i.main) && solid.length) solid.sort((a, b) => b.vol - a.vol)[0].main = true;
    return out;
}

function scaffold(F, b, L, sides, top) {
    const off = 1.7, step = 7, levels = [];
    for (let z = 6; z < top + 2; z += 6.5) levels.push(z);
    const run = (fixed, a0, a1, alongX) => {
        const n = Math.max(1, Math.round((a1 - a0) / step));
        const P = (a, d = 0) => alongX ? [a, fixed + d] : [fixed + d, a];
        for (let i = 0; i <= n; i++) {
            const a = a0 + (a1 - a0) * i / n;
            for (const d of [0, 1.5]) F.rod(...P(a, d), 0.4, ...P(a, d), top + 2.4, 0.26, 0.26, L.pole, { seg: 5, finish: L.node ? 'metal' : 'paint' });
            if (L.node && i % 2 === 0) F.s.glows.push({ x: F.p(...P(a, 1.5))[0], y: F.p(...P(a, 1.5))[1], z: top + 2.6, r: 0.45, color: L.node });
        }
        for (const z of levels) {
            F.rod(...P(a0, 1.5), z, ...P(a1, 1.5), z, 0.2, 0.2, L.pole, { seg: 5 });
            const mid = (a0 + a1) / 2, len = a1 - a0;
            if (alongX) F.box(mid, fixed + 0.75, z - 0.25, len, 1.7, 0.3, L.plank, { bevel: false });
            else F.box(fixed + 0.75, mid, z - 0.25, 1.7, len, 0.3, L.plank, { bevel: false });
        }
        // diagonal braces
        for (let i = 0; i < n; i += 2) {
            const a = a0 + (a1 - a0) * i / n, c = a0 + (a1 - a0) * (i + 1) / n;
            F.rod(...P(a, 1.5), 0.6, ...P(c, 1.5), Math.min(top + 2, 12), 0.16, 0.16, L.pole, { seg: 4 });
        }
    };
    if (sides.includes('s')) run(b.max.y + off, b.min.x, b.max.x, true);
    if (sides.includes('e')) run(b.max.x + off, b.min.y, b.max.y, false);
}

function clutter(F, faction, a, L, stage) {
    const x = -a * 0.62, y = a * 0.62;
    if (faction === 'evolved') {
        for (let i = 0; i < 3; i++) F.ellipsoid(x + i * 3.4, y - i * 1.2, 1.2 + (i === 1 ? 1.6 : 0), 3, 2.2, 1.2, i % 2 ? '#8e5a36' : '#7a4a2c', { finish: 'flesh' });   // hides
        for (let i = 0; i < 4; i++) F.rod(a * 0.5 + i * 1.3, a * 0.55, 0.6, a * 0.5 + i * 1.3 + 5, a * 0.5 - 2, 1.2 + i * 0.3, 0.5, 0.3, L.frame, { finish: 'bone', seg: 6 });
    } else if (faction === 'series9') {
        for (let i = 0; i < 4; i++) F.box(x, y, 0.6 + i * 0.7, 9, 6, 0.6, i % 2 ? '#566069' : '#4a525b', { bevel: 0.15, finish: 'metal' });       // plate stack
        F.cyl(a * 0.55, a * 0.5, 0.6, 2.2, 3, '#3a4149', { seg: 12, finish: 'metal' });
        F.s.glow(...F.p(a * 0.55, a * 0.5), 4.2, 0.9, L.node);
    } else {
        for (let i = 0; i < 3; i++) F.box(x, y, 0.6 + i * 0.75, 10, 4.4, 0.6, i % 2 ? '#84683c' : '#7c6238', { bevel: 0.15, rot: 0.06 * i });         // planks
        F.ellipsoid(a * 0.55, a * 0.55, 1.4, 5, 4, 2.4, '#a08660', { finish: 'ground' });                                                             // sand
        for (let i = 0; i < 3; i++) F.cyl(x + 9 + (i % 2) * 3.4, y - 6 + ((i / 2) | 0) * 3.2, 0.6, 1.5, 4, '#6f6c60', { seg: 12, finish: 'paint' });  // cement drums
        if (stage <= 2) { F.box(a * 0.2, a * 0.7, 0.6, 6, 4, 4.4, '#c9a227', { bevel: 0.5 }); F.cyl(a * 0.2 + 1.5, a * 0.7, 5, 1.6, 2.2, '#8d8579', { seg: 10, finish: 'metal' }); }   // mixer
    }
}

export function applyStage(kit, stage, faction, ft, pal) {
    const L = LOOK[faction], a = ft * 16, F = new Fr(kit);
    const info = survey(kit, ft);
    const mains = info.filter(i => i.main);
    const union = new THREE.Box3();
    for (const i of mains) union.union(i.b);
    kit.glows.length = 0;
    for (const i of info) if (i.glow) kit.group.remove(i.m);

    if (stage === 4) {
        // finished and dark: one scaffold bay still up on the east side
        scaffold(F, union, L, ['e'], Math.min(union.max.z, 16));
        return;
    }
    // stages 1-3 start from the bare site
    for (const i of info) if (!i.ground && !(stage === 3 && i.main)) kit.group.remove(i.m);
    if (stage === 3) {
        const raw = new Map();
        for (const i of mains) {
            const fin = i.m.material.userData.finish;
            if (!raw.has(fin)) raw.set(fin, kit.mat(L.raw, fin === 'glass' ? 'paint' : fin));
            i.m.material = raw.get(fin);
        }
        scaffold(F, union, L, ['s', 'e'], union.max.z);
        clutter(F, faction, a, L, stage);
        return;
    }
    // footings for every main volume
    for (const i of mains) {
        const cx = (i.b.min.x + i.b.max.x) / 2, cy = (i.b.min.y + i.b.max.y) / 2, z0 = Math.max(0.5, i.b.min.z > 3 ? 0.5 : i.b.min.z);
        if (i.b.min.z > 3) continue;   // upper storeys have no footing of their own
        if (faction === 'evolved') {
            F.disc(cx, cy, 0.3, Math.max(i.sx, i.sy) * 0.52, 'rgba(34,22,12,0.75)', { stretchX: i.sx / Math.max(i.sx, i.sy), stretchY: i.sy / Math.max(i.sx, i.sy) });
            const n = Math.max(6, Math.round((i.sx + i.sy) / 7));
            for (let k = 0; k < n; k++) { const an = k / n * Math.PI * 2; F.spike(cx + Math.cos(an) * i.sx * 0.5, cy + Math.sin(an) * i.sy * 0.5, 0, an + Math.PI, 1.2, 1.6, 5.5, L.frame); }
        } else {
            F.box(cx, cy, z0, i.sx + 1, i.sy + 1, 1.3, L.slab, { bevel: 0.3, finish: faction === 'series9' ? 'metal' : 'ground' });
            const n = Math.max(2, Math.round(i.sx / 7)), m = Math.max(2, Math.round(i.sy / 7));
            for (let k = 0; k <= n; k++) for (let j = 0; j <= m; j++) {
                if (k % n && j % m) continue;
                const x = i.b.min.x + i.sx * k / n, y = i.b.min.y + i.sy * j / m;
                if (L.node) kit.glows.push({ x, y, z: z0 + 1.8, r: 0.4, color: L.node });
                else F.rod(x, y, z0 + 1.2, x, y, z0 + 3.6, 0.2, 0.2, '#6b4630', { seg: 4 });   // rebar starters
            }
        }
    }
    if (stage === 2) {
        for (const i of mains) {
            const b = i.b, z0 = Math.max(b.min.z, 0.6), z1 = b.max.z;
            if (faction === 'evolved') {
                // rib cage of bone arches
                const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, r = Math.max(i.sx, i.sy) / 2;
                for (let k = 0; k < 5; k++) kit.rib(cx, cy, z0, r, z1 - z0, k * Math.PI / 5, L.frame);
                F.rod(cx, cy, z0, cx, cy, z1 + 2, 0.7, 0.4, L.frame, { finish: 'bone', seg: 8 });
                continue;
            }
            const n = Math.max(1, Math.round(i.sx / 13)), m = Math.max(1, Math.round(i.sy / 13)), r = faction === 'series9' ? 0.38 : 0.5;
            const fin = { finish: 'metal', seg: 6 };
            for (let k = 0; k <= n; k++) for (let j = 0; j <= m; j++) {
                const x = b.min.x + i.sx * k / n, y = b.min.y + i.sy * j / m;
                F.rod(x, y, z0, x, y, z1, r, r, L.frame, fin);
                if (L.node) kit.glows.push({ x, y, z: z1, r: 0.4, color: L.node });
            }
            const lv = z1 - z0 > 13 ? [(z0 + z1) / 2, z1] : [z1];
            for (const z of lv) {
                for (let k = 0; k <= n; k++) { const x = b.min.x + i.sx * k / n; F.rod(x, b.min.y, z, x, b.max.y, z, r * 0.85, r * 0.85, L.frame, fin); }
                for (let j = 0; j <= m; j++) { const y = b.min.y + i.sy * j / m; F.rod(b.min.x, y, z, b.max.x, y, z, r * 0.85, r * 0.85, L.frame, fin); }
            }
            // wind bracing on the two visible faces
            F.rod(b.min.x, b.max.y, z0, b.min.x + i.sx / n, b.max.y, z1, r * 0.5, r * 0.5, L.frame, fin);
            F.rod(b.max.x, b.min.y, z0, b.max.x, b.min.y + i.sy / m, z1, r * 0.5, r * 0.5, L.frame, fin);
        }
    }
    clutter(F, faction, a, L, stage);
    void tint; void pal;
}
