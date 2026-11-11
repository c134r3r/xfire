// ============================================
// Survivors base architecture: cast concrete, painted steel, tar roofs.
// Buildings never rotate: x = east, y = south, the camera sees the
// south and east walls and the roof. a = half the footprint.
// ============================================
import { TEAM, tint, withAlpha } from './kit.js';
import { Fr, crate, drum, jerry } from './parts.js';

const CONC = '#8b8778', CONC_D = '#6f6c60', TAR = '#3b3b36', STEEL = '#565a55', DARK = '#23241f', GLASS = '#1d2e36', LIT = '#ffd98a';
const SAND = '#9a8a62', RUST = '#6b4630', HAZ_Y = '#c9a227', HAZ_K = '#1c1a16';

// ---- ground ----
export function pad(F, a, team, o = {}) {
    const col = o.color || '#7c7a6e';
    F.box(0, 0, -1, a * 2 - 2, a * 2 - 2, 1.7, col, { bevel: 0.5, finish: 'ground' });
    // expansion joints
    const n = Math.round(a / 12);
    for (let i = -n + 1; i < n; i++) {
        F.box(i * a / n, 0, 0.66, 0.45, a * 2 - 3.4, 0.08, tint(col, -30), { bevel: false, finish: 'ground', cast: false });
        F.box(0, i * a / n, 0.66, a * 2 - 3.4, 0.45, 0.08, tint(col, -30), { bevel: false, finish: 'ground', cast: false });
    }
    // oil stains and tyre marks
    let seed = Math.round(a * 131 + (o.seed || 0) * 977);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 7; i++) F.disc((rnd() - 0.5) * a * 1.5, (rnd() - 0.5) * a * 1.5, 0.72, 1.5 + rnd() * 4.5, `rgba(18,14,9,${0.1 + rnd() * 0.16})`, { stretchX: 0.7 + rnd() * 0.8 });
    // team corner markings
    const m = a - 3.2;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1]]) {
        F.poly([[sx * m, sy * m, 0.74], [sx * (m - 6), sy * m, 0.74], [sx * (m - 6), sy * (m - 1.4), 0.74], [sx * (m - 1.4), sy * (m - 1.4), 0.74], [sx * (m - 1.4), sy * (m - 6), 0.74], [sx * m, sy * (m - 6), 0.74]], withAlpha(team, 0.9));
    }
}
export function hazard(F, x0, x1, y, z = 0.74, w = 2) {
    const n = Math.round((x1 - x0) / 3.2);
    for (let i = 0; i < n; i++) {
        const x = x0 + i * 3.2;
        F.poly([[x, y, z], [x + 1.6, y, z], [x + 3.2, y - w, z], [x + 1.6, y - w, z]], i % 2 ? HAZ_K : HAZ_Y);
    }
}

// ---- walls ----
// Concrete block with plinth, formwork joints, tar roof and parapet
export function block(F, x, y, z, w, d, h, color, o = {}) {
    F.box(x, y, z, w, d, h, color, { inset: o.batter || 0, bevel: 0.5 });
    if (o.plinth !== false && z < 1) F.box(x, y, z, w + 0.9, d + 0.9, 1.6, tint(CONC_D, -6), { bevel: 0.3, finish: 'ground' });
    // formwork joints on the two visible walls
    const jc = tint(color, -22), b = o.batter || 0;
    for (let i = 1; i < Math.round(w / 9); i++) { const jx = x - w / 2 + i * w / Math.round(w / 9); F.box(jx, y + d / 2 - b * 0.5 + 0.02, z + 1.6, 0.3, 0.2, h - 2.4, jc, { bevel: false, cast: false }); }
    for (let i = 1; i < Math.round(d / 9); i++) { const jy = y - d / 2 + i * d / Math.round(d / 9); F.box(x + w / 2 - b * 0.5 + 0.02, jy, z + 1.6, 0.2, 0.3, h - 2.4, jc, { bevel: false, cast: false }); }
    if (o.roof !== false) {
        const rw = w - b * 2, rd = d - b * 2, top = z + h;
        F.box(x, y, top, rw - 1.6, rd - 1.6, 0.25, o.roofColor || TAR, { bevel: false, finish: 'ground' });
        const p = o.parapet === undefined ? 1.5 : o.parapet;
        if (p > 0) {
            const pc = o.band || tint(color, 6);
            F.box(x, y + rd / 2 - 0.5, top, rw, 1, p, pc, { bevel: 0.25 });
            F.box(x, y - rd / 2 + 0.5, top, rw, 1, p, tint(color, 6), { bevel: 0.25 });
            F.box(x + rw / 2 - 0.5, y, top, 1, rd - 2, p, pc, { bevel: 0.25 });
            F.box(x - rw / 2 + 0.5, y, top, 1, rd - 2, p, tint(color, 6), { bevel: 0.25 });
        }
    }
}
// window rows: face 's' (south wall at y) or 'e' (east wall at x)
export function windows(F, face, a0, a1, at, z0, z1, lit, o = {}) {
    const n = o.n || Math.max(1, Math.round((a1 - a0) / 5.5));
    const fc = o.frame || '#4a4d42';
    for (let i = 0; i < n; i++) {
        const c = a0 + (i + 0.5) * (a1 - a0) / n, w = (a1 - a0) / n * 0.62;
        const on = lit && (i * 7 + Math.round(at)) % 3 !== 0;
        const g = on ? LIT : GLASS;
        if (face === 's') {
            F.box(c, at + 0.12, z0 - 0.35, w + 0.8, 0.5, z1 - z0 + 0.7, fc, { bevel: false, cast: false });
            F.box(c, at + 0.3, z0, w, 0.4, z1 - z0, g, { bevel: false, cast: false, finish: 'glass' });
            F.box(c, at + 0.45, z0 - 0.6, w + 1.2, 0.8, 0.35, tint(fc, 25), { bevel: false });
        } else {
            F.box(at + 0.12, c, z0 - 0.35, 0.5, w + 0.8, z1 - z0 + 0.7, fc, { bevel: false, cast: false });
            F.box(at + 0.3, c, z0, 0.4, w, z1 - z0, g, { bevel: false, cast: false, finish: 'glass' });
            F.box(at + 0.45, c, z0 - 0.6, 0.8, w + 1.2, 0.35, tint(fc, 25), { bevel: false });
        }
        if (on) F.s.glows.push({ x: F.p(face === 's' ? c : at + 0.5, face === 's' ? at + 0.5 : c)[0], y: F.p(face === 's' ? c : at + 0.5, face === 's' ? at + 0.5 : c)[1], z: (z0 + z1) / 2, r: 0.7, color: '#ffc866' });
    }
}
export function door(F, face, c, at, w, h, o = {}) {
    const col = o.color || '#3c4034';
    if (face === 's') {
        F.box(c, at + 0.15, 0.6, w + 1.4, 0.6, h + 0.9, '#55584c', { bevel: false });
        F.box(c, at + 0.35, 0.6, w, 0.5, h, col, { bevel: false, cast: false });
        if (o.roller) for (let z = 1.4; z < h; z += 1.3) F.box(c, at + 0.62, z, w, 0.12, 0.35, tint(col, -22), { bevel: false, cast: false });
        else F.box(c, at + 0.62, 0.8, 0.25, 0.12, h - 0.4, tint(col, -25), { bevel: false, cast: false });
        F.box(c, at + 1.6, 0.6, w + 2, 2.6, 0.5, CONC_D, { bevel: 0.2, finish: 'ground' });
    } else {
        F.box(at + 0.15, c, 0.6, 0.6, w + 1.4, h + 0.9, '#55584c', { bevel: false });
        F.box(at + 0.35, c, 0.6, 0.5, w, h, col, { bevel: false, cast: false });
        if (o.roller) for (let z = 1.4; z < h; z += 1.3) F.box(at + 0.62, c, z, 0.12, w, 0.35, tint(col, -22), { bevel: false, cast: false });
        else F.box(at + 0.62, c, 0.8, 0.12, 0.25, h - 0.4, tint(col, -25), { bevel: false, cast: false });
        F.box(at + 1.6, c, 0.6, 2.6, w + 2, 0.5, CONC_D, { bevel: 0.2, finish: 'ground' });
    }
}

// ---- kit ----
export function acUnit(F, x, y, z, s = 1) {
    F.box(x, y, z, 5 * s, 4 * s, 2.6 * s, '#7d8078', { bevel: 0.3, finish: 'metal' });
    F.cyl(x, y, z + 2.6 * s, 1.5 * s, 0.4, '#3a3c38', { seg: 14 });
    F.disc(x, y, z + 3.05 * s, 1.15 * s, '#161714');
    F.box(x, y + 2 * s + 0.05, z + 0.5, 4 * s, 0.15, 1.6 * s, '#2c2e2a', { bevel: false, cast: false });
}
export function vent(F, x, y, z, h = 3, r = 1) {
    F.cyl(x, y, z, r, h, STEEL, { finish: 'metal', seg: 12 });
    F.cyl(x, y, z + h + 0.5, r * 1.6, 0.5, '#44463f', { finish: 'metal', seg: 12, rTop: r * 0.5 });
    F.rod(x, y, z + h, x, y, z + h + 0.5, 0.3, 0.3, DARK, { seg: 6 });
}
export function sandbags(F, pts, layers = 2, z = 0) {
    for (let l = 0; l < layers; l++) for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 4.2));
        const G = new Fr(F.s, Math.atan2(y1 - y0, x1 - x0), F.ox, F.oy, F.oz);
        for (let k = 0; k < n; k++) {
            const t = (k + 0.5 + (l % 2) * 0.5) / n;
            if (t > 1) continue;
            G.s.ellipsoid(F.ox + x0 + (x1 - x0) * t, F.oy + y0 + (y1 - y0) * t, F.oz + z + 1.1 + l * 1.7, 2.3, 1.5, 1.15, G.yaw, (k + l) % 3 ? SAND : tint(SAND, -9), { finish: 'ground' });
        }
    }
}
export function mast(F, x, y, z, h, o = {}) {
    const w = o.w || 3.2, col = o.color || '#4b4e49';
    const leg = (sx, sy, zz) => { const k = 1 - (zz / h) * 0.72; return [x + sx * w * k, y + sy * w * k, z + zz]; };
    const C = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (const [sx, sy] of C) F.rod(...leg(sx, sy, 0), ...leg(sx, sy, h), 0.42, 0.3, col, { seg: 6 });
    const bays = Math.round(h / 7);
    for (let b = 0; b < bays; b++) {
        const z0 = b * h / bays, z1 = (b + 1) * h / bays;
        for (let i = 0; i < 4; i++) {
            const A = C[i], B = C[(i + 1) % 4];
            F.rod(...leg(A[0], A[1], z1), ...leg(B[0], B[1], z1), 0.24, 0.24, col, { seg: 5 });
            F.rod(...leg(A[0], A[1], z0), ...leg(B[0], B[1], z1), 0.2, 0.2, col, { seg: 5 });
            F.rod(...leg(B[0], B[1], z0), ...leg(A[0], A[1], z1), 0.2, 0.2, col, { seg: 5 });
        }
    }
    F.rod(x, y, z + h, x, y, z + h + (o.tip || 6), 0.25, 0.12, DARK, { seg: 5 });
}
export function silo(F, x, y, r, h, color, team, o = {}) {
    F.cyl(x, y, 0, r + 0.6, 1, CONC_D, { finish: 'ground', seg: 22 });
    F.cyl(x, y, 1, r, h, color, { finish: 'paint', seg: 26 });
    for (let z = 4; z < h; z += 5) F.cyl(x, y, z, r + 0.14, 0.4, tint(color, -14), { noTop: true, seg: 26 });
    if (team) F.cyl(x, y, 1 + h * 0.62, r + 0.16, h * 0.14, team, { noTop: true, seg: 26 });
    F.cyl(x, y, 1 + h, r, r * 0.35, tint(color, 6), { rTop: r * 0.25, seg: 26, finish: 'paint' });
    F.cyl(x, y, 1 + h + r * 0.35, r * 0.25, 0.7, STEEL, { finish: 'metal', seg: 10 });
    // ladder on the camera side
    const lx = x + r * 0.72, ly = y + r * 0.72;
    for (const d of [-0.6, 0.6]) F.rod(lx + d * 0.7 + 0.25, ly - d * 0.7 + 0.25, 0.6, lx + d * 0.7 + 0.25, ly - d * 0.7 + 0.25, h + 1.6, 0.16, 0.16, DARK, { seg: 4 });
    for (let z = 2; z < h + 1; z += 1.6) F.rod(lx - 0.42 + 0.25, ly + 0.42 + 0.25, z, lx + 0.42 + 0.25, ly - 0.42 + 0.25, z, 0.12, 0.12, DARK, { seg: 4 });
    void o;
}
export function stack(F, x, y, h, r = 2.6, lit) {
    F.cyl(x, y, 0, r + 1.2, 2.4, CONC_D, { finish: 'ground', seg: 16 });
    F.cyl(x, y, 2.4, r, h - 2.4, '#8a8478', { rTop: r * 0.72, finish: 'ground', seg: 20 });
    for (const k of [0.62, 0.8]) { const rr = r * (1 - 0.28 * k) + 0.12; F.cyl(x, y, 2.4 + (h - 2.4) * k, rr, (h - 2.4) * 0.09, '#9a3324', { rTop: rr - 0.03 * r, noTop: true, seg: 20, finish: 'paint' }); }
    F.cyl(x, y, h, r * 0.82, 0.9, '#3b3a35', { seg: 18, finish: 'metal' });
    F.disc(x, y, h + 0.95, r * 0.6, '#0e0d0b');
    F.s.glow(...F.p(x, y), h + 1.6, lit ? 1.5 : 1.0, lit ? '#ff9944' : '#b8501e');
}
export function pipe(F, pts, r = 0.8, color = '#6a6d66') {
    for (let i = 0; i < pts.length - 1; i++) {
        F.rod(...pts[i], ...pts[i + 1], r, r, color, { seg: 10 });
        F.sphere(...pts[i + 1], r * 1.02, color, { finish: 'metal' });
    }
}
export function flagpole(F, x, y, z, team, size = 1) { F.cyl(x, y, z, 0.9, 0.6, CONC_D, { seg: 10 }); F.s.flag(...F.p(x, y), z + 0.6, team, size); }
export function barrels(F, x, y, n = 3, z = 0) {
    const cols = ['#7a3a20', '#4f5a3c', '#5b5f62', '#2f4a5a'];
    for (let i = 0; i < n; i++) {
        const bx = x + (i % 2) * 3.5 + ((i / 2) | 0) * 0.6, by = y + ((i / 2) | 0) * 3.3;
        F.cyl(bx, by, z, 1.55, 4.3, cols[i % 4], { seg: 14, finish: 'paint' });
        for (const k of [1.3, 2.9]) F.cyl(bx, by, z + k, 1.66, 0.3, tint(cols[i % 4], -20), { noTop: true, seg: 14 });
    }
}
export function lamp(F, x, y, z, color, lit, r = 0.9) { F.cyl(x, y, z, 0.5, 0.8, DARK, { seg: 8 }); F.s.glow(...F.p(x, y), z + 1.2, lit ? r * 1.4 : r, color); }
export { CONC, CONC_D, TAR, STEEL, DARK, GLASS, LIT, SAND, RUST, HAZ_Y, HAZ_K, crate, drum, jerry, TEAM };
