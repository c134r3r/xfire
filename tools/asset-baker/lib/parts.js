// ============================================
// Shared model parts: a local frame (forward/side coordinates on a
// yawed model) and the assemblies vehicles are built from.
// ============================================
import { TEAM, tint, fwd } from './kit.js';

// Local frame: u = forward, v = right side, z = up
export class Fr {
    constructor(s, yaw = 0, ox = 0, oy = 0, oz = 0) { this.s = s; this.yaw = yaw; this.ox = ox; this.oy = oy; this.oz = oz; }
    p(u, v = 0) { const f = fwd(this.yaw, u, v); return [this.ox + f.x, this.oy + f.y]; }
    at(u, v = 0, z = 0, dyaw = 0) { const [x, y] = this.p(u, v); return new Fr(this.s, this.yaw + dyaw, x, y, this.oz + z); }
    box(u, v, z, len, wid, h, color, opts) { const [x, y] = this.p(u, v); this.s.box(x, y, z + this.oz, len, wid, h, this.yaw + ((opts && opts.rot) || 0), color, opts); }
    rbox(u, v, z, len, wid, h, color, opts) { const [x, y] = this.p(u, v); this.s.rbox(x, y, z + this.oz, len, wid, h, this.yaw + ((opts && opts.rot) || 0), color, opts); }
    cyl(u, v, z, r, h, color, opts) { const [x, y] = this.p(u, v); this.s.cyl(x, y, z + this.oz, r, h, color, opts); }
    disc(u, v, z, r, color, opts) { const [x, y] = this.p(u, v); this.s.disc(x, y, z + this.oz, r, color, opts); }
    sphere(u, v, z, r, color, opts) { const [x, y] = this.p(u, v); this.s.sphere(x, y, z + this.oz, r / 0.78, color, opts); }
    ellipsoid(u, v, z, rx, ry, rz, color, opts) { const [x, y] = this.p(u, v); this.s.ellipsoid(x, y, z + this.oz, rx, ry, rz, this.yaw, color, opts); }
    blob(u, v, z, r, h, color, opts) { const [x, y] = this.p(u, v); this.s.blob(x, y, z + this.oz, r, h, color, opts); }
    rod(u1, v1, z1, u2, v2, z2, r1, r2, color, opts) {
        const a = this.p(u1, v1), b = this.p(u2, v2);
        this.s.rod(a[0], a[1], z1 + this.oz, b[0], b[1], z2 + this.oz, r1, r2 === undefined || r2 === null ? r1 : r2, color, opts);
    }
    // rod with rounded joints (limbs, pipes)
    limb(u1, v1, z1, u2, v2, z2, r, color, opts = {}) {
        this.rod(u1, v1, z1, u2, v2, z2, r, r, color, opts);
        const fin = opts.finish || 'metal';
        this.sphere(u1, v1, z1, r, color, { finish: fin }); this.sphere(u2, v2, z2, r, color, { finish: fin });
    }
    prism(profile, width, color, opts = {}) { const [x, y] = this.p(opts.u || 0, opts.v || 0); this.s.prism(x, y, profile, width, this.yaw + (opts.rot || 0), color, { ...opts, z: (opts.z || 0) + this.oz }); }
    // plan polygon [[u, v], ...] from z0 to z1; top optionally inset / shifted
    slab(plan, z0, z1, color, opts = {}) {
        const ins = opts.inset || 0, sh = opts.shift || 0;
        let cu = 0, cv = 0;
        for (const q of plan) { cu += q[0]; cv += q[1]; }
        cu /= plan.length; cv /= plan.length;
        const top = (opts.top || plan.map(([u, v]) => {
            const du = u - cu, dv = v - cv, l = Math.hypot(du, dv) || 1;
            return [u - du / l * ins + sh, v - dv / l * ins];
        }));
        const B = plan.map(([u, v]) => [...this.p(u, v), z0 + this.oz]);
        const T = top.map(([u, v]) => [...this.p(u, v), z1 + this.oz]);
        this.s.solid(B, T, color, opts);
    }
    poly(pts, color) { this.s.poly(pts.map(([u, v, z]) => [...this.p(u, v), z + this.oz]), color); }
    glow(u, v, z, r, color) { const [x, y] = this.p(u, v); this.s.glow(x, y, z + this.oz, r, color); }
    wheel(u, v, r, width, tire, hub) { const [x, y] = this.p(u, v); this.s.wheel(x, y, this.oz, r, width, this.yaw, tire, hub); }
    ring(u, v, z, r, thick, color, opts) { const [x, y] = this.p(u, v); this.s.ring(x, y, z + this.oz, r, thick, color, opts); }
    spike(u, v, z, dyaw, len, baseW, rise, color) { const [x, y] = this.p(u, v); this.s.spike(x, y, z + this.oz, this.yaw + dyaw, len, baseW, rise, color); }
}

const STEEL = '#2d2b27', WHEEL = '#4b4e40';

// Tracked running gear: an open track loop with road wheels, drive
// sprocket and idler visible inside it, grousers on the upper run.
// v = lateral offset of the track centre.
export function track(F, v, len, width, h, o = {}) {
    const L = len / 2, col = o.color || STEEL, wheelCol = o.wheel || WHEEL;
    const rise = h * 0.5, t = 0.75;
    const outer = [[-L + 2, 0], [L - 2.6, 0], [L, rise], [L - 0.9, h], [-L + 0.9, h], [-L, rise + 0.2]];
    const inner = [[-L + 2.3, t], [L - 2.9, t], [L - t - 0.1, rise], [L - 1.4, h - t], [-L + 1.4, h - t], [-L + t + 0.1, rise + 0.2]];
    F.prism(outer, width, col, { v, hole: inner, finish: 'rubber', bevel: 0.12 });
    // dark hull side behind the wheels
    const out = Math.sign(v) || 1;
    F.box(0, v - out * width * 0.3, t, len - 3.2, width * 0.3, h - t * 2, '#191815', { bevel: false, finish: 'rubber' });
    // road wheels
    const n = o.wheels || Math.max(4, Math.round(len / 5.4));
    const rw = Math.min((len - 7) / n * 0.5, h * 0.36);
    for (let i = 0; i < n; i++) {
        const u = -L + 3.6 + rw * 0.2 + (i + 0.5) * (len - 7.4) / n;
        F.rod(u, v - out * width * 0.15, rw + t * 0.9, u, v + out * width * 0.47, rw + t * 0.9, rw, rw, wheelCol, { finish: 'paint', seg: 16 });
        F.rod(u, v + out * width * 0.47, rw + t * 0.9, u, v + out * width * 0.56, rw + t * 0.9, rw * 0.42, rw * 0.36, tint(wheelCol, -22), { seg: 10 });
    }
    // drive sprocket (front) and idler (rear), raised
    for (const [u, r] of [[L - 1.9, h * 0.27], [-L + 1.9, h * 0.25]]) {
        F.rod(u, v - out * width * 0.15, rise + 0.3, u, v + out * width * 0.47, rise + 0.3, r, r, tint(wheelCol, -10), { finish: 'metal', seg: 12 });
        F.rod(u, v + out * width * 0.47, rise + 0.3, u, v + out * width * 0.57, rise + 0.3, r * 0.45, r * 0.4, '#23221f', { seg: 8 });
    }
    // grousers on the upper run and down the front/rear slopes
    const pitch = 1.55;
    for (let u = -L + 1.4; u <= L - 1.4; u += pitch) F.box(u, v, h - 0.05, 0.62, width * 0.98, 0.34, tint(col, 9), { bevel: false, finish: 'rubber', cast: false });
    for (const sgn of [1, -1]) for (let k = 0.2; k < 1; k += 0.3) {
        const u = sgn * (L - 0.9 + 0.9 * (1 - k) * 0.99), z = rise + (h - rise) * k;
        F.box(u, v, z, 0.45, width * 0.98, 0.5, tint(col, 9), { bevel: false, finish: 'rubber', cast: false });
    }
}

// Small kit: jerry can, ammo box, rolled tarp, fuel drum (lying)
export function jerry(F, u, v, z, color = '#4d5338') { F.rbox(u, v, z, 1.5, 2.6, 3.2, color, { radius: 0.4, bevel: 0.25 }); F.box(u, v, z + 3.2, 0.7, 1.2, 0.5, '#2a2a26', { bevel: false }); }
export function crate(F, u, v, z, len, wid, h, color = '#7c6238', rot = 0) {
    F.box(u, v, z, len, wid, h, color, { rot, bevel: 0.2 });
    F.box(u, v, z + h * 0.42, len + 0.25, wid + 0.25, h * 0.14, tint(color, -22), { rot, bevel: false });
}
export function tarp(F, u, v, z, len, r, color = '#6b6548') { F.rod(u - len / 2, v, z + r, u + len / 2, v, z + r, r, r, color, { finish: 'paint', seg: 10 }); for (const k of [-0.3, 0.3]) F.rod(u + k * len - 0.2, v, z + r, u + k * len + 0.2, v, z + r, r * 1.08, r * 1.08, '#2c2a24', { seg: 10 }); }
export function drum(F, u, v, z, len, r, color = '#59603f') {
    F.rod(u - len / 2, v, z + r, u + len / 2, v, z + r, r, r, color, { finish: 'paint', seg: 14 });
    for (const k of [-0.28, 0.28]) F.rod(u + k * len - 0.15, v, z + r, u + k * len + 0.15, v, z + r, r * 1.07, r * 1.07, tint(color, -16), { finish: 'paint', seg: 14 });
}
export function headlight(F, u, v, z, r = 0.7, lit = '#ffe9a8') {
    F.rod(u - 0.9, v, z, u, v, z, r, r, '#34352d', { seg: 10 });
    F.glow(u + 0.25, v, z, r * 0.8, lit);
}
// gun barrel with reinforce, optional bore evacuator and muzzle brake
export function gun(F, u0, v, z0, len, r, o = {}) {
    const col = o.color || '#3a3d34', el = o.elev || 0;
    const zAt = (d) => z0 + d * el;
    F.rod(u0, v, z0, u0 + len * 0.3, v, zAt(len * 0.3), r * 1.35, r * 1.2, col);
    F.rod(u0 + len * 0.3, v, zAt(len * 0.3), u0 + len, v, zAt(len), r * 1.05, r * 0.92, col);
    if (o.evac) F.rod(u0 + len * 0.52, v, zAt(len * 0.52), u0 + len * 0.66, v, zAt(len * 0.66), r * 1.5, r * 1.5, tint(col, -8));
    if (o.brake !== false) {
        const b = o.brake || r * 2.2;
        F.rod(u0 + len, v, zAt(len), u0 + len + b, v, zAt(len + b), r * 1.6, r * 1.6, tint(col, -22));
        F.rod(u0 + len + b * 0.35, v - r * 1.75, zAt(len + b * 0.4), u0 + len + b * 0.35, v + r * 1.75, zAt(len + b * 0.4), r * 0.55, r * 0.55, '#12110f', { seg: 6 });
        F.rod(u0 + len + b, v, zAt(len + b), u0 + len + b + 0.15, v, zAt(len + b + 0.15), r * 0.8, r * 0.8, '#0c0b0a', { seg: 8 });
    }
}
export function antenna(F, u, v, z, h) { F.rod(u, v, z, u, v, z + 1.2, 0.35, 0.3, '#2a2a26', { seg: 6 }); F.rod(u, v, z + 1.2, u + 0.6, v, z + h, 0.14, 0.1, '#1c1c1a', { seg: 5 }); }
export function hatch(F, u, v, z, r, color) { F.cyl(u, v, z, r, 0.55, color, { seg: 14 }); F.box(u - r * 0.8, v, z + 0.2, 0.6, r * 0.9, 0.5, tint(color, -20), { bevel: false }); }
export { TEAM };
