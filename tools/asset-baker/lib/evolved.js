// ============================================
// Evolved: war beasts. Segmented bodies with overlapping carapace
// plates, jointed legs that plant on the ground, hide and bone.
// ============================================
import { tint, withAlpha } from './kit.js';
import { Fr } from './parts.js';
import { seated } from './infantry.js';

// jointed walking legs: hip -> knee (high) -> ankle -> clawed foot
function legs(F, pal, n, o) {
    const ph = (o.frame || 0) * Math.PI / 2;
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
        for (const sd of [1, -1]) {
            const sw = Math.sin(ph + i * 1.9 + (sd > 0 ? 0 : Math.PI)) * (o.swing || 1.8);
            const lift = Math.max(0, Math.cos(ph + i * 1.9 + (sd > 0 ? 0 : Math.PI))) * 1.2;
            const hu = t * o.spread, fu = t * (o.spread + 2.5) + sw + (o.rake || 0) * t;
            const hip = [hu, sd * o.hip, o.z];
            const knee = [(hu + fu) / 2, sd * (o.hip + o.reach * 0.55), o.z + o.rise];
            const ank = [fu, sd * (o.hip + o.reach), 2 + lift];
            F.limb(...hip, ...knee, o.thick, o.color || pal.hullDark, { finish: 'flesh' });
            F.limb(...knee, ...ank, o.thick * 0.78, tint(o.color || pal.hullDark, -8), { finish: 'flesh' });
            F.rod(ank[0], ank[1], ank[2], fu + 0.4, sd * (o.hip + o.reach + 0.9), lift, o.thick * 0.6, o.thick * 0.2, pal.accent, { finish: 'bone', seg: 8 });
        }
    }
}
// armoured back: a row of overlapping plates over a soft body
function carapace(F, pal, L, W, H, z, n, o = {}) {
    F.ellipsoid(0, 0, z + H * 0.42, L * 0.5, W * 0.5, H * 0.52, tint(pal.hull, -10), { finish: 'flesh' });
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, u = L * 0.44 - t * L * 0.9, k = Math.sin(Math.PI * (0.12 + t * 0.8));
        F.ellipsoid(u, 0, z + H * 0.5 + k * H * 0.12, L * 0.62 / n + 1.4, W * 0.52 * (0.55 + 0.45 * k), H * 0.56 * (0.6 + 0.4 * k), i % 2 ? pal.hull : tint(pal.hull, 7), { finish: 'flesh' });
    }
    if (o.ridge !== false) for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, u = L * 0.44 - t * L * 0.9; F.spike(u, 0, z + H * 0.98, Math.PI, 1.6, 1.5, 1.8, pal.accent); }
}
const eyes = (F, pal, u, v, z, r = 0.6) => { for (const sd of [1, -1]) F.s.glow(...F.p(u, sd * v), z, r, pal.glow); };
const warpaint = (F, team, u, v, z, r) => { for (const sd of [1, -1]) F.ellipsoid(u, sd * v, z, r * 1.5, r * 0.6, 0.5, team, { finish: 'paint' }); };

export const EVO_UNITS = {
    bike(s, yaw, pal, team, frame) {       // Dire Wolf + rider
        const F = new Fr(s, yaw);
        legs(F, pal, 2, { frame, spread: 5.4, hip: 1.6, reach: 1.6, z: 6, rise: -0.6, thick: 1.05, swing: 2.4, color: pal.hull });
        F.ellipsoid(-2.6, 0, 6.6, 4.6, 2.5, 2.7, pal.hull, { finish: 'flesh' });           // haunches
        F.ellipsoid(3.4, 0, 7.2, 4.6, 2.9, 3.1, tint(pal.hull, 5), { finish: 'flesh' });   // chest
        F.limb(6, 0, 8.4, 9.4, 0, 9.4, 1.9, tint(pal.hull, 3), { finish: 'flesh' });       // neck
        F.ellipsoid(10.4, 0, 9.4, 2.6, 1.9, 1.8, tint(pal.hull, 8), { finish: 'flesh' });
        F.rod(11.6, 0, 9, 14, 0, 8.4, 1.25, 0.8, tint(pal.hull, -6), { finish: 'flesh' }); // muzzle
        for (const sd of [1, -1]) { F.spike(9.6, sd * 1.3, 10.6, Math.PI + sd * 0.4, 1.4, 1.5, 2.4, pal.hullDark); F.spike(13.2, sd * 0.7, 7.8, 0, 0.4, 0.5, -1.4, pal.accent); }
        for (let i = 0; i < 4; i++) F.spike(7 - i * 2.6, 0, 9.6 - i * 0.3, Math.PI, 1.4, 1.5, 1.7, pal.hullDark);   // hackles
        F.rod(-6.4, 0, 7.4, -11.4, 0, 9, 1.0, 0.3, pal.hullDark, { finish: 'flesh' });      // tail
        eyes(F, pal, 11.8, 1.1, 10, 0.45);
        F.rbox(-0.6, 0, 8.6, 5, 4.4, 1.0, team, { radius: 0.8 });                           // saddle blanket
        seated(F.at(-0.8, 0, 9.4), { ...pal, cloth: pal.cloth, hull: pal.skin, hullDark: '#5a3a24' }, team, { reach: [5.2, 1.4, 1.4], lean: 1.6, feet: [1.2, 2.9, -3.4], mohawk: true, skin: pal.skin });
    },
    buggy(s, yaw, pal, team, frame) {      // Giant Beetle
        const F = new Fr(s, yaw);
        legs(F, pal, 3, { frame, spread: 5.6, hip: 4.2, reach: 5, z: 5, rise: 3.2, thick: 1.0 });
        carapace(F, pal, 19, 15.6, 9.6, 3.6, 3, { ridge: false });
        F.rod(-8.6, 0, 12.4, 7, 0, 12.8, 0.4, 0.4, tint(pal.hullDark, -15), { seg: 6, finish: 'flesh' });   // wing-case seam
        warpaint(F, team, -1.6, 3.8, 12.4, 1.7);
        F.ellipsoid(10.4, 0, 6.2, 3.2, 3.6, 2.7, tint(pal.hull, -12), { finish: 'flesh' });
        for (const sd of [1, -1]) { F.rod(12.4, sd * 1.4, 5.4, 16, sd * 3, 5, 0.9, 0.5, pal.accent, { finish: 'bone', seg: 8 }); F.rod(16, sd * 3, 5, 17.6, sd * 1.2, 4.6, 0.5, 0.15, pal.accent, { finish: 'bone', seg: 8 }); }
        F.spike(12.4, 0, 8.2, 0, 5.6, 1.5, 2.6, pal.accent);                                 // horn
        eyes(F, pal, 12.4, 1.9, 7.4, 0.55);
        // spine thrower grown into the back
        F.ellipsoid(1, 0, 13.4, 3, 2.2, 1.6, pal.hullDark, { finish: 'flesh' });
        F.rod(1.4, 0, 14.2, 9.6, 0, 15, 1.0, 0.7, pal.accent, { finish: 'bone' });
        F.rod(9.6, 0, 15, 9.8, 0, 15, 0.5, 0.5, '#1a0e08', { seg: 8 });
    },
    tank(s, yaw, pal, team, frame) {       // Scorpion body (tail mount -6, z 12)
        const F = new Fr(s, yaw);
        legs(F, pal, 4, { frame, spread: 7.4, hip: 5.2, reach: 6, z: 6, rise: 4, thick: 1.15 });
        carapace(F, pal, 25, 17.6, 9.6, 4.6, 5);
        warpaint(F, team, 3, 4.6, 13.6, 1.8);
        F.ellipsoid(12.2, 0, 7.4, 3.4, 4.4, 2.6, tint(pal.hull, -10), { finish: 'flesh' });
        for (const sd of [1, -1]) {
            // pedipalps: upper arm, forearm, pincer of two bone blades
            F.limb(10, sd * 4.6, 7, 13.6, sd * 8.6, 6.6, 1.5, pal.hull, { finish: 'flesh' });
            F.limb(13.6, sd * 8.6, 6.6, 17.6, sd * 6.6, 5.6, 1.7, tint(pal.hull, 6), { finish: 'flesh' });
            F.ellipsoid(18.4, sd * 6.2, 5.6, 2.6, 1.9, 1.5, tint(pal.hull, 8), { finish: 'flesh' });
            F.spike(19.4, sd * 6.8, 5.6, -sd * 0.25, 4.6, 1.7, 0, pal.accent);
            F.spike(19.4, sd * 5.4, 5.6, sd * 0.3, 4, 1.3, 0, pal.accent);
        }
        eyes(F, pal, 14.2, 1.5, 9, 0.5); eyes(F, pal, 13.4, 3, 8.6, 0.35);
    },
    heavy(s, yaw, pal, team, frame) {      // War Mastodon (howdah mount -2, z 20)
        const F = new Fr(s, yaw);
        const ph = frame * Math.PI / 2, hide = pal.hull;
        for (const [u, sd, k] of [[8, 1, 0], [8, -1, 1], [-8.4, 1, 1], [-8.4, -1, 0]]) {
            const sw = Math.sin(ph + k * Math.PI) * 1.8, lift = Math.max(0, Math.cos(ph + k * Math.PI)) * 1.0;
            F.limb(u, sd * 6.2, 11, u + sw * 0.5 + 0.8, sd * 6.6, 6 + lift, 3.0, tint(hide, -6), { finish: 'flesh' });
            F.limb(u + sw * 0.5 + 0.8, sd * 6.6, 6 + lift, u + sw, sd * 6.6, 2.4 + lift, 2.5, tint(hide, -12), { finish: 'flesh' });
            F.cyl(F.p(u + sw, sd * 6.6)[0] - F.ox, F.p(u + sw, sd * 6.6)[1] - F.oy, lift, 2.9, 2, tint(hide, -18), { seg: 12, finish: 'flesh' });
            for (const a of [-0.6, 0, 0.6]) F.spike(u + sw + 2.4, sd * 6.6 + a * 2, lift + 0.3, 0, 1.2, 1.0, 0, pal.accent);
        }
        F.ellipsoid(-1, 0, 13.6, 15, 9.6, 7.4, hide, { finish: 'flesh' });                    // barrel body
        F.ellipsoid(-6, 0, 15, 9, 8.6, 6, tint(hide, -5), { finish: 'flesh' });
        F.ellipsoid(6.4, 0, 15.4, 7.6, 8, 6.6, tint(hide, 4), { finish: 'flesh' });           // shoulder hump
        for (let i = 0; i < 6; i++) F.spike(9 - i * 4, 0, 21.4 - Math.abs(i - 1.5) * 0.5, Math.PI, 1.6, 2, 2.2, pal.hullDark);
        // war harness: girth straps and a team caparison under the howdah
        F.rbox(-2, 0, 19.6, 13, 13.6, 1.0, team, { radius: 2 });
        for (const u of [-7, 3]) F.ring(u, 0, 13.6, 9.7, 0.45, '#3a2616', { tiltX: Math.PI / 2, rotZ: yaw + Math.PI / 2, finish: 'paint' });
        // head, ears, tusks, trunk
        F.ellipsoid(15, 0, 13.4, 5.4, 5, 5.6, tint(hide, 6), { finish: 'flesh' });
        for (const sd of [1, -1]) {
            F.ellipsoid(12.6, sd * 5.8, 14, 1.0, 3.4, 4.2, tint(hide, -8), { finish: 'flesh' });
            F.rod(17, sd * 2.6, 10.6, 22.4, sd * 4.4, 7.4, 1.25, 0.9, pal.accent, { finish: 'bone' });
            F.rod(22.4, sd * 4.4, 7.4, 26.4, sd * 3.8, 10.6, 0.9, 0.2, pal.accent, { finish: 'bone' });
        }
        F.limb(18.6, 0, 11.6, 21, 0, 7, 1.9, tint(hide, -4), { finish: 'flesh' });
        F.limb(21, 0, 7, 20.4, 0, 2.6, 1.4, tint(hide, -8), { finish: 'flesh' });
        F.rbox(18.8, 0, 15.4, 2.4, 5.6, 2.2, pal.accent, { radius: 0.8, finish: 'bone' });     // bone frontlet
        eyes(F, pal, 18.2, 3.5, 14.4, 0.6);
        F.rod(-15, 0, 13, -18.4, 0, 7, 0.7, 0.3, pal.hullDark, { finish: 'flesh' });
    },
    artillery(s, yaw, pal, team, frame) {  // Missile Crab
        const F = new Fr(s, yaw);
        legs(F, pal, 3, { frame, spread: 6.6, hip: 6.4, reach: 6, z: 6, rise: 4.6, thick: 1.25, rake: 1 });
        F.ellipsoid(0, 0, 8.6, 12.6, 9.6, 4.6, pal.hull, { finish: 'flesh' });                // broad flat shell
        F.ellipsoid(-1, 0, 10, 10, 7.4, 3.8, tint(pal.hull, 6), { finish: 'flesh' });
        for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; F.spike(Math.cos(a) * 11.6, Math.sin(a) * 9, 9, a, 2.4, 1.6, 0.6, pal.accent); }
        warpaint(F, team, 3, 3.6, 12.6, 1.7);
        for (const sd of [1, -1]) {
            F.limb(9, sd * 5.4, 7.4, 13.6, sd * 8.4, 6, 1.6, pal.hull, { finish: 'flesh' });
            F.ellipsoid(15.6, sd * 7.6, 5.6, 3.4, 2.4, 1.9, tint(pal.hull, 8), { finish: 'flesh' });
            F.spike(17.4, sd * 8.2, 5.6, -sd * 0.2, 4.4, 1.8, 0, pal.accent); F.spike(17.4, sd * 6.6, 5.6, sd * 0.3, 3.6, 1.3, 0, pal.accent);
            F.rod(10.6, sd * 1.6, 9.6, 12.2, sd * 1.9, 11.6, 0.3, 0.3, pal.hullDark, { seg: 6, finish: 'flesh' });   // eye stalks
            s.glow(...F.p(12.2, sd * 1.9), 12, 0.6, pal.glow);
        }
        // bone launch tubes grown from the shell, warheads glowing
        F.ellipsoid(-4, 0, 12.6, 5, 5.4, 2.4, pal.hullDark, { finish: 'flesh' });
        for (const v of [3.3, 0, -3.3]) {
            F.rod(-6.6, v, 12.6, 0.6, v, 21, 1.5, 1.25, pal.accent, { finish: 'bone' });
            F.rod(0.6, v, 21, 1.1, v, 21.6, 0.8, 0.5, '#7a2a1c', { finish: 'flesh', seg: 8 });
            s.glow(...F.p(1.4, v), 22, 0.7, '#ff6a3a');
        }
    }
};

export const EVO_TURRETS = {
    tank(s, yaw, pal, team) {              // scorpion tail arching forward
        const F = new Fr(s, yaw);
        let u = -9, z = -2;
        for (let i = 0; i < 6; i++) {
            const r = 2.9 - i * 0.26;
            F.ellipsoid(u, 0, z, r * 1.15, r, r, i % 2 ? pal.hull : tint(pal.hull, 9), { finish: 'flesh' });
            if (i === 2) F.ellipsoid(u, 0, z + r * 0.6, r, r * 1.04, 0.6, team, { finish: 'paint' });
            F.spike(u, 0, z + r * 0.8, Math.PI, 0.8, 1.2, 1.4, pal.accent);
            u += i < 3 ? 2.2 : 3.6; z += i < 3 ? 4.4 : i < 4 ? 2.4 : -0.4;
        }
        F.ellipsoid(u - 0.6, 0, z, 2.4, 1.9, 1.9, tint(pal.glow, -45), { finish: 'flesh' });   // venom bulb
        F.spike(u + 0.8, 0, z - 0.2, 0, 6.4, 2.0, -3.6, pal.accent);
        s.glow(...F.p(u + 5.6, 0), z - 3.4, 1.0, pal.glow);
    },
    heavy(s, yaw, pal, team) {             // howdah with a bone cannon
        const F = new Fr(s, yaw);
        F.box(0, 0, 0, 10.6, 10.6, 1.0, '#4a3020', { bevel: 0.3 });
        for (const [a, b, l, w] of [[0, 4.9, 10.2, 0.8], [0, -4.9, 10.2, 0.8], [-4.9, 0, 0.8, 9.4]]) F.box(a, b, 1, l, w, 3.4, '#5a3a24', { bevel: 0.25 });
        for (const sd of [1, -1]) F.box(0, sd * 5.4, 1.6, 6, 0.4, 2.2, team, { bevel: 0.15 });
        for (const [a, b] of [[4.8, 4.8], [4.8, -4.8], [-4.8, 4.8], [-4.8, -4.8]]) { F.rod(a, b, 1, a * 0.92, b * 0.92, 10.4, 0.5, 0.4, pal.accent, { finish: 'bone', seg: 8 }); F.sphere(a * 0.92, b * 0.92, 10.6, 0.7, pal.accent, { finish: 'bone' }); }
        F.prism([[-6, 10.2], [6, 10.2], [0, 12.6]], 12, pal.cloth, { bevel: 0.2, rot: Math.PI / 2 });   // hide awning
        F.rod(1, 0, 3.4, 6, 0, 3.8, 2.3, 2.0, tint(pal.accent, -12), { finish: 'bone' });
        F.rod(6, 0, 3.8, 17.4, 0, 4.7, 1.8, 1.5, pal.accent, { finish: 'bone' });
        for (const k of [8, 11.5, 15]) F.rod(k, 0, 3.96 + (k - 6) * 0.08, k + 0.6, 0, 4 + (k - 5.4) * 0.08, 2.1, 2.1, '#3a2616', { seg: 12, finish: 'paint' });
        s.glow(...F.p(17.9, 0), 4.7, 1.0, pal.glow);
        F.sphere(-2, 0, 5.6, 1.5, pal.skin, { finish: 'flesh' });                               // gunner
    },
    tower(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        F.ellipsoid(0, 0, 2, 4.4, 4.4, 3.4, pal.hullDark, { finish: 'flesh' });
        F.ellipsoid(-0.6, 0, 4.4, 2.6, 2.6, 1.2, team, { finish: 'paint' });
        for (const sd of [1, -1]) F.spike(-1, sd * 3.4, 3, sd * 2.2, 3.4, 1.6, 2, pal.accent);
        F.rod(2, 0, 3, 12.6, 0, 4, 1.25, 0.9, pal.accent, { finish: 'bone' });
        F.rod(12.6, 0, 4, 12.8, 0, 4, 0.55, 0.55, '#1a0e08', { seg: 8 });
        s.glow(...F.p(13.2, 0), 4, 0.9, pal.glow);
    },
    towerHeavy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        F.ellipsoid(-1, 0, 3.4, 5, 4.8, 4.6, tint(pal.glow, -42), { finish: 'flesh' });        // acid sac
        for (const a of [0.5, 1.6, 2.7]) s.rib(...F.p(-1, 0), 0, 5.1, 8.1, yaw + a, pal.hullDark);
        F.ellipsoid(-1, 0, 7.6, 2.2, 2.2, 0.8, team, { finish: 'paint' });
        F.rod(2, 0, 3.4, 9, 0, 6.6, 2.0, 1.6, pal.accent, { finish: 'bone' });
        F.rod(9, 0, 6.6, 14, 0, 9, 1.6, 1.9, pal.accent, { finish: 'bone' });
        F.rod(14, 0, 9, 14.3, 0, 9.14, 1.3, 1.3, '#162a10', { seg: 10 });
        s.glow(...F.p(14.6, 0), 9.3, 1.3, pal.glow);
    }
};
