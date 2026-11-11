// ============================================
// Series 9: agricultural machines rebuilt for war. Hover chassis with
// lift skirts, drive nacelles, sensor clusters and coil weapons.
// ============================================
import { tint, withAlpha } from './kit.js';
import { Fr } from './parts.js';

const wedge = (L, W, nose = 0.3) => [[L / 2, -W * nose], [L / 2, W * nose], [L * 0.22, W / 2], [-L / 2, W / 2], [-L / 2, -W / 2], [L * 0.22, -W / 2]];
const shrink = (plan, k, du = 0) => plan.map(([u, v]) => [u * k + du, v * k]);

// Hover chassis: lift skirt, armoured tub, raised deck, nacelles
function chassis(F, pal, team, L, W, H, o = {}) {
    const s = F.s, glow = pal.glow, plan = wedge(L, W, o.nose || 0.28);
    // glow pool and lift emitters under the skirt
    F.disc(0, 0, 0.1, W * 0.62, withAlpha(glow, 0.2), { stretchX: L / W });
    for (const [u, v] of [[L * 0.3, W * 0.3], [L * 0.3, -W * 0.3], [-L * 0.34, W * 0.34], [-L * 0.34, -W * 0.34]]) {
        F.cyl(u, v, 0.9, 1.5, 0.8, '#1d2126', { seg: 10, finish: 'metal' });
        s.glows.push({ x: F.p(u, v)[0], y: F.p(u, v)[1], z: 1.2, r: 1.4, color: glow });
    }
    F.slab(shrink(plan, 1.04), 1.4, 3.2, pal.hullDark, { top: shrink(plan, 0.98), bevel: 0.3, finish: 'metal' });   // skirt
    F.slab(shrink(plan, 0.96), 3.0, H * 0.72, pal.hull, { inset: 1.1, bevel: 0.5 });
    F.slab(shrink(plan, 0.8), 3.2, H * 0.5, team, { top: shrink(plan, 0.99), bevel: false });                        // waist band
    F.slab(shrink(plan, 0.66, -L * 0.06), H * 0.7, H, tint(pal.hull, 8), { inset: 0.9, bevel: 0.45 });               // deck
    // drive nacelles with intakes and glowing nozzles
    const nl = L * (o.nacelle || 0.62), nr = Math.max(1.3, W * 0.1);
    for (const sd of [1, -1]) {
        const v = sd * (W / 2 + nr * 0.4);
        F.rod(-L / 2 + 0.6, v, H * 0.45, -L / 2 + 0.6 + nl, v, H * 0.45, nr, nr * 0.82, pal.metal, { finish: 'metal', seg: 12 });
        F.rod(-L / 2 + nl + 0.6, v, H * 0.45, -L / 2 + nl + 1.2, v, H * 0.45, nr * 0.6, nr * 0.6, '#0e1114', { seg: 10 });
        F.rod(-L / 2 + 0.6, v, H * 0.45, -L / 2 - 0.2, v, H * 0.45, nr * 0.9, nr * 0.7, pal.metalDark, { seg: 12 });
        s.glow(...F.p(-L / 2 - 0.7, v), H * 0.45, nr * 0.75, glow);
        F.box(-L * 0.1, sd * W * 0.36, H * 0.72, L * 0.3, 0.8, 0.5, '#15181c', { bevel: false });        // cooling slot
    }
    // sensor bar on the nose, dorsal fin, panel studs
    F.box(L * 0.36, 0, H * 0.72, 1.0, W * 0.36, 0.7, '#0e1216', { bevel: 0.15 });
    s.glow(...F.p(L * 0.39, 0), H * 0.72 + 0.4, 0.55, glow);
    F.prism([[-L * 0.42, H], [-L * 0.22, H], [-L * 0.34, H + 2.6], [-L * 0.44, H + 2.6]], 0.7, pal.hullDark, { bevel: 0.2 });
}
// coil gun: twin rails around a glowing bore, capacitor rings
function coilGun(F, pal, u0, v, z, len, r) {
    F.rod(u0, v, z, u0 + len * 0.3, v, z, r * 1.5, r * 1.3, pal.metalDark);
    for (const dz of [r * 0.9, -r * 0.9]) F.box(u0 + len * 0.6, v, z + dz - r * 0.3, len * 0.8, r * 1.5, r * 0.6, pal.metal, { bevel: 0.15, finish: 'metal' });
    F.rod(u0 + len * 0.3, v, z, u0 + len, v, z, r * 0.42, r * 0.42, pal.glow, { finish: 'glass', seg: 8 });
    for (let i = 0; i < 3; i++) { const u = u0 + len * (0.38 + i * 0.2); F.rod(u, v, z, u + 0.5, v, z, r * 1.75, r * 1.75, pal.metalDark, { seg: 12 }); F.s.glows.push({ x: F.p(u, v)[0], y: F.p(u, v)[1], z: z + r, r: 0.45, color: pal.glow }); }
    F.s.glow(...F.p(u0 + len + 0.3, v), z, r * 1.05, pal.glow);
}

export const S9_UNITS = {
    bike(s, yaw, pal, team) {          // Probe
        const F = new Fr(s, yaw);
        chassis(F, pal, team, 18, 6.4, 6.2, { nose: 0.12, nacelle: 0.5 });
        F.ellipsoid(2, 0, 6.6, 3, 1.9, 1.5, '#16222a', { finish: 'glass' });
        s.glow(...F.p(4.6, 0), 7, 0.9, pal.glow);
        F.rod(-5, 1.2, 6.2, -6.4, 1.2, 11, 0.14, 0.1, '#15181c', { seg: 5 });
    },
    buggy(s, yaw, pal, team) {         // Enforcer
        const F = new Fr(s, yaw);
        chassis(F, pal, team, 22, 11.6, 8, {});
        F.rbox(-2, 0, 8, 7, 6.4, 2.6, tint(pal.hull, 12), { radius: 1.2 });
        for (const sd of [1, -1]) coilGun(F, pal, 1.5, sd * 3.3, 10.6, 10.5, 0.62);
        F.box(-2, 0, 10.6, 3, 2.4, 0.4, team, { bevel: 0.15 });
    },
    tank(s, yaw, pal, team) {          // Sentinel hull (turret mount -1, z 9.5)
        const F = new Fr(s, yaw);
        chassis(F, pal, team, 28, 16.6, 9.5, {});
        F.cyl(-1, 0, 9.3, 5.4, 0.5, pal.hullDark, { seg: 20, finish: 'metal' });
        for (const sd of [1, -1]) { F.box(7.4, sd * 4.2, 6.9, 3.4, 2.6, 0.5, '#15181c', { bevel: 0.15 }); F.box(-10, sd * 3.6, 9.5, 3.6, 3, 0.5, pal.hullDark, { bevel: 0.15 }); }
    },
    heavy(s, yaw, pal, team) {         // Annihilator hull (turret mount -1, z 11)
        const F = new Fr(s, yaw);
        chassis(F, pal, team, 34, 21.6, 11, { nacelle: 0.7 });
        F.cyl(-1, 0, 10.8, 7, 0.5, pal.hullDark, { seg: 22, finish: 'metal' });
        for (const sd of [1, -1]) {
            F.slab([[10, sd * 4], [10, sd * 9.4], [-13, sd * 9.4], [-13, sd * 4]], 3.2, 8.6, pal.hullDark, { inset: 0.8, bevel: 0.4 });
            F.box(-2, sd * 9.6, 5, 16, 0.5, 2.2, team, { bevel: 0.15 });
            F.box(8.6, sd * 5, 8, 4, 3, 0.5, '#15181c', { bevel: 0.15 });
            F.rod(-13.6, sd * 6.6, 9, -13.6, sd * 6.6, 13.6, 0.7, 0.5, pal.metal, { seg: 8 });
            s.glow(...F.p(-13.6, sd * 6.6), 14, 0.6, pal.glow);
        }
    },
    artillery(s, yaw, pal, team) {     // Tremor: hover mortar
        const F = new Fr(s, yaw);
        chassis(F, pal, team, 25, 16, 8.4, {});
        F.cyl(-1, 0, 8.4, 5.6, 1.6, tint(pal.hull, 8), { seg: 20 });
        for (const sd of [1, -1]) F.prism([[-4, 10], [2.4, 10], [1, 15], [-2.6, 15]], 1.0, pal.hullDark, { v: sd * 3, bevel: 0.2 });
        // heavy plasma mortar at high elevation
        const el = 0.9, u0 = -4, z0 = 11.6;
        F.rod(u0, 0, z0, u0 + 3.4, 0, z0 + 3.4 * el, 2.5, 2.3, pal.metalDark);
        F.rod(u0 + 3.4, 0, z0 + 3.4 * el, u0 + 12.6, 0, z0 + 12.6 * el, 2.0, 1.8, pal.metal, { finish: 'metal' });
        for (const k of [5.4, 8, 10.6]) { F.rod(u0 + k, 0, z0 + k * el, u0 + k + 0.5, 0, z0 + (k + 0.5) * el, 2.5, 2.5, pal.hullDark, { seg: 14 }); s.glows.push({ x: F.p(u0 + k, 0)[0], y: F.p(u0 + k, 0)[1], z: z0 + k * el + 2, r: 0.5, color: pal.glow }); }
        s.glow(...F.p(u0 + 13.2, 0), z0 + 13.2 * el, 1.6, pal.glow);
        F.box(-9.6, 0, 8.4, 5, 10, 3.4, pal.hullDark, { bevel: 0.4, inset: 0.5 });
        F.box(-9.6, 0, 11.8, 3, 6, 0.4, team, { bevel: 0.15 });
        for (const v of [-3, 0, 3]) s.glows.push({ x: F.p(-12.2, v)[0], y: F.p(-12.2, v)[1], z: 10, r: 0.5, color: pal.glow });
    }
};

function head(F, pal, team, L, W, H) {
    F.cyl(0, 0, -0.3, W * 0.42, 0.7, pal.hullDark, { seg: 20, finish: 'metal' });
    F.slab(wedge(L, W, 0.22), 0.3, H, tint(pal.hull, 10), { inset: 1.2, shift: -0.4, bevel: 0.5 });
    F.slab(shrink(wedge(L, W, 0.22), 0.5, -L * 0.1), H, H + 0.5, team, { bevel: false });
    F.box(L * 0.3, 0, H * 0.55, 0.9, W * 0.4, 0.8, '#0e1216', { bevel: 0.15 });
    F.rod(-L * 0.36, W * 0.3, H, -L * 0.46, W * 0.3, H + 5, 0.14, 0.1, '#15181c', { seg: 5 });
    F.cyl(-L * 0.2, -W * 0.22, H, 1.1, 0.7, pal.metalDark, { seg: 10 });
}
export const S9_TURRETS = {
    tank(s, yaw, pal, team) { const F = new Fr(s, yaw); head(F, pal, team, 13, 10.4, 4.4); coilGun(F, pal, 4.6, 0, 2.6, 13.4, 0.85); },
    heavy(s, yaw, pal, team) { const F = new Fr(s, yaw); head(F, pal, team, 15.6, 14, 5); for (const sd of [1, -1]) coilGun(F, pal, 5.4, sd * 3.5, 2.9, 18, 0.9); s.glow(...F.p(-1, 0), 6, 1.3, pal.glow); },
    tower(s, yaw, pal, team) { const F = new Fr(s, yaw); head(F, pal, team, 9, 8, 3.8); coilGun(F, pal, 3, 0, 2.2, 9.4, 0.6); },
    towerHeavy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        F.cyl(0, 0, 0, 5.6, 4.6, tint(pal.hull, 8), { seg: 22, rTop: 4.8 });
        F.cyl(0, 0, 1.6, 5.75, 1.0, team, { seg: 22, noTop: true });
        F.blob(0, 0, 4.6, 4.8, 2.2, pal.hullDark, { finish: 'metal' });
        coilGun(F, pal, 3.4, 0, 3, 14, 1.05);
        s.glow(...F.p(0, 0), 7.2, 1.1, pal.glow);
    }
};
