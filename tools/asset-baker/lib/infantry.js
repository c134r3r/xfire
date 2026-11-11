// ============================================
// Infantry rig shared by the three factions: a jointed figure with
// real arms and legs that carries its weapon, in a 5-frame walk
// (frame 0 = standing, 1-4 = stride cycle).
// ============================================
import { tint } from './kit.js';
import { Fr } from './parts.js';

const SKIN = '#c9996d', BOOT = '#2b241c', GUN = '#2a2925';

const LOOKS = {
    survivors: (pal) => ({ limb: 1.05, legs: pal.cloth, arms: pal.cloth, torso: tint(pal.hull, -4), skin: SKIN, boot: BOOT, fin: 'paint' }),
    evolved: (pal) => ({ limb: 1.2, legs: tint(pal.cloth, -12), arms: pal.skin, torso: pal.skin, skin: pal.skin, boot: '#3a2a1c', fin: 'flesh' }),
    series9: (pal) => ({ limb: 0.72, legs: pal.metalDark, arms: pal.metalDark, torso: pal.hull, skin: pal.metal, boot: '#2a2e33', fin: 'metal' })
};

export function soldier(s, yaw, pal, team, faction, weapon, frame) {
    const F = new Fr(s, yaw);
    const L = LOOKS[faction](pal);
    const robot = faction === 'series9', mutant = faction === 'evolved';
    const walk = frame > 0, ph = (frame - 1) * Math.PI / 2;
    const stride = walk ? Math.sin(ph) * 3.0 : 0;
    const bob = walk ? Math.abs(Math.sin(ph)) * 0.5 : 0;
    const hipZ = 8.4 + bob, shZ = 14.0 + bob, headZ = 17.2 + bob;
    const r = L.limb, fin = { finish: L.fin };

    // legs: hip -> knee -> ankle, boot
    for (const [sd, st] of [[1, stride], [-1, -stride]]) {
        const lift = walk ? Math.max(0, st > 0 ? Math.cos(ph) : -Math.cos(ph)) * 1.4 : 0;
        const fu = st + (walk ? 0 : sd * 0.5), fz = 1.3 + lift;
        const ku = fu * 0.45 + 1.1 + lift * 0.5, kz = 4.9 + lift * 0.6;
        F.limb(0, sd * 1.5, hipZ, ku, sd * 1.65, kz, r, L.legs, fin);
        F.limb(ku, sd * 1.65, kz, fu, sd * 1.7, fz + 0.4, r * 0.86, L.legs, fin);
        F.rbox(fu + 0.5, sd * 1.7, fz - 1.3, 3.1, 1.9, 1.7, L.boot, { radius: 0.6, finish: robot ? 'metal' : 'rubber' });
        if (robot) F.sphere(ku, sd * 1.65, kz, r * 1.5, pal.metal, { finish: 'metal' });
    }

    // torso
    if (robot) {
        F.rbox(0, 0, hipZ - 0.4, 3.4, 4.4, 2.0, pal.metalDark, { radius: 0.8, finish: 'metal' });
        F.rod(0, 0, hipZ + 1.4, 0, 0, hipZ + 3, 0.9, 0.9, pal.metalDark);
        F.rbox(0.1, 0, hipZ + 2.6, 4.2, 6.2, 4.2, L.torso, { radius: 1.0 });
        F.box(1.9, 0, hipZ + 3.9, 0.7, 3.2, 1.6, team, { bevel: 0.15 });
        s.glow(...F.p(2.4, 0), hipZ + 5.9, 0.5, pal.glow);
    } else {
        F.rbox(0, 0, hipZ - 0.9, 3.2, 4.6, 2.4, L.legs, { radius: 1.1, finish: L.fin });                 // hips
        F.rbox(0.15, 0, hipZ + 1.2, 3.7, 5.6, 5.2, L.torso, { radius: 1.5, round: true, finish: L.fin }); // chest
        if (mutant) {
            // crossed bandoliers, hide loincloth, team war paint on the chest
            F.box(1.6, 0, hipZ + 3.0, 1.0, 3.4, 2.0, team, { bevel: 0.2 });
            F.rbox(0, 0, hipZ - 1.4, 3.6, 5.0, 1.9, '#5a3a24', { radius: 0.8, finish: 'flesh' });
            F.rod(1.5, -2.6, hipZ + 5.8, 1.5, 2.6, hipZ + 1.6, 0.42, 0.42, '#3a2616', { finish: 'paint' });
        } else {
            // load-bearing vest in team color, belt pouches, canteen
            F.rbox(0.3, 0, hipZ + 2.0, 4.0, 5.2, 3.6, team, { radius: 1.2 });
            F.box(0, 0, hipZ + 0.9, 3.9, 5.9, 0.8, '#3a3324', { bevel: 0.15 });
            for (const v of [-1.7, 1.7]) F.box(1.9, v, hipZ + 0.7, 0.9, 1.4, 1.5, '#4c4a33', { bevel: 0.15 });
            F.rbox(-1.6, -2.7, hipZ + 0.3, 1.3, 1.1, 1.9, '#4f5a3c', { radius: 0.4 });
        }
    }

    // backpack / fuel tanks
    if (weapon === 'flame') {
        for (const v of [1.25, -1.25]) {
            F.rod(-2.9, v, hipZ + 0.6, -2.9, v, hipZ + 6.4, 1.15, 1.15, robot ? pal.metal : '#8f4622', { finish: 'paint' });
            F.sphere(-2.9, v, hipZ + 6.4, 1.15, robot ? pal.metal : '#8f4622', { finish: 'paint' });
        }
        F.rod(-2.9, -1.3, hipZ + 3.6, -2.9, 1.3, hipZ + 3.6, 1.25, 1.25, team, { seg: 10, finish: 'paint' });
    } else if (!mutant) {
        F.rbox(-2.7, 0, hipZ + 1.4, 2.4, 4.2, 4.4, robot ? pal.metalDark : tint(pal.cloth, -14), { radius: 0.8 });
        if (!robot) F.rod(-2.7, -2.2, hipZ + 6.2, -2.7, 2.2, hipZ + 6.2, 0.85, 0.85, '#6f684a', { finish: 'paint', seg: 8 });  // bedroll
    }

    // weapon geometry + hand positions
    let rh, lh;   // [u, v, z]
    const gz = hipZ + 2.6;
    if (weapon === 'rocket') {
        const tz = shZ + 1.3;
        F.rod(-4.6, 2.5, tz - 0.2, 6.6, 2.5, tz + 0.3, 1.25, 1.25, robot ? pal.metal : mutant ? '#6e5a3a' : '#565b40', { finish: 'paint' });
        F.rod(-4.6, 2.5, tz - 0.2, -5.6, 2.5, tz - 0.25, 1.25, 1.6, '#262521');
        F.rod(6.6, 2.5, tz + 0.3, 8.6, 2.5, tz + 0.4, 1.0, 0.25, mutant ? pal.accent : '#9b3a24', { finish: 'paint' });
        F.box(1.6, 2.5, tz - 2.6, 0.8, 0.8, 1.8, GUN, { bevel: false });
        rh = [1.6, 2.5, tz - 2.4]; lh = [4.4, 2.2, tz - 1.2];
    } else if (weapon === 'flame') {
        F.rod(0.6, 1.9, gz, 8.4, 1.3, gz + 0.3, 0.6, 0.5, '#3a3632');
        F.rod(8.4, 1.3, gz + 0.3, 9.2, 1.25, gz + 0.35, 0.75, 0.75, '#1f1d1a');
        F.rod(-2.4, 1.6, hipZ + 2, 0.8, 1.9, gz - 0.6, 0.3, 0.3, '#1b1a17');       // hose
        s.glow(...F.p(9.6, 1.25), gz + 0.35, 0.9, robot ? pal.glow : '#ff8a2a');
        rh = [1.4, 1.9, gz]; lh = [5.0, 1.2, gz + 0.1];
    } else {
        F.rod(1.0, 1.8, gz, 5.4, 1.4, gz + 0.3, 0.55, 0.5, robot ? pal.metalDark : GUN);
        F.rod(5.4, 1.4, gz + 0.3, 9.2, 1.1, gz + 0.55, 0.32, 0.28, '#1c1b18');
        F.box(-0.6, 2.0, gz - 0.7, 3.2, 0.9, 1.3, robot ? pal.metalDark : mutant ? '#5a4024' : '#5b4630', { bevel: 0.15 });  // stock
        F.box(3.2, 1.6, gz - 1.9, 0.9, 0.7, 1.8, '#1f1e1b', { bevel: false });      // magazine
        if (robot) s.glow(...F.p(9.5, 1.1), gz + 0.55, 0.45, pal.glow);
        rh = [1.6, 1.9, gz - 0.2]; lh = [5.2, 1.0, gz];
    }

    // arms: shoulder -> elbow -> hand
    const arm = (sd, hand) => {
        const sh = [0.2, sd * 3.2, shZ - 0.4];
        const el = [(sh[0] + hand[0]) / 2 - 0.4, sd * 3.5 + (hand[1] - sd * 3.2) * 0.35, Math.min(sh[2], hand[2]) - 1.4 + (weapon === 'rocket' ? 1.2 : 0)];
        F.limb(...sh, ...el, r * 0.92, L.arms, fin);
        F.limb(...el, ...hand, r * 0.82, mutant || robot ? L.arms : L.skin === SKIN ? L.arms : L.arms, fin);
        F.sphere(...hand, r * 0.95, robot ? pal.metal : L.skin, { finish: L.fin === 'paint' ? 'flesh' : L.fin });
        if (mutant) F.spike(sh[0], sh[1], sh[2] + 0.6, sd * 1.5, 2.6, 1.8, 2.6, pal.accent);
        else if (robot) F.sphere(...sh, r * 1.9, pal.metal, { finish: 'metal' });
        else F.sphere(sh[0], sh[1], sh[2] + 0.1, 1.15, team, { finish: 'paint' });
    };
    arm(1, rh); arm(-1, lh);

    // head
    if (robot) {
        F.rod(0, 0, shZ + 0.4, 0, 0, headZ - 1.6, 0.6, 0.6, pal.metalDark);
        F.rbox(0.2, 0, headZ - 1.7, 3.4, 3.6, 3.2, pal.metal, { radius: 0.9, finish: 'metal' });
        F.box(1.8, 0, headZ - 0.6, 0.5, 2.6, 1.0, '#101418', { bevel: false });
        s.glow(...F.p(2.2, 0.5), headZ - 0.1, 0.5, pal.glow);
        F.rod(-0.8, -1.4, headZ + 1.4, -1.2, -1.6, headZ + 4, 0.14, 0.1, '#1c1c1a', { seg: 5 });
    } else {
        F.rod(0, 0, shZ + 0.2, 0, 0, headZ - 1.2, 0.8, 0.8, L.skin, { finish: 'flesh' });
        F.ellipsoid(0.2, 0, headZ - 0.2, 1.7, 1.6, 1.85, L.skin, { finish: 'flesh' });
        if (mutant) {
            for (let i = 0; i < 4; i++) F.spike(-1.6 + i * 1.0, 0, headZ + 1.6, Math.PI, 0.6, 1.3, 2.2 - Math.abs(i - 1.5) * 0.5, '#c8321e');
            F.box(1.7, 0, headZ - 0.2, 0.5, 2.6, 0.7, '#2a1a12', { bevel: false });   // goggles strap
        } else {
            // steel helmet with brim and a team band
            F.blob(0, 0, headZ - 0.1, 2.05, 2.1, pal.hullDark, { finish: 'paint' });
            F.cyl(0, 0, headZ - 0.3, 2.4, 0.28, pal.hullDark, { seg: 18 });
            F.cyl(0, 0, headZ, 2.1, 0.5, team, { seg: 18, noTop: true });
        }
    }
}

// Seated crew figure (bikes, buggies). F is placed at the seat.
// reach = hand target, feet = foot target (relative to the seat)
export function seated(F, pal, team, o = {}) {
    const lean = o.lean || 0, cloth = pal.cloth, r = 0.95;
    const sh = [lean, 0, 6.2];
    F.rbox(0, 0, -0.2, 3.2, 4.4, 2.2, cloth, { radius: 1.0 });
    // torso leaning toward the controls
    F.limb(0, 0, 1.2, sh[0] * 0.9, 0, 5.2, 2.05, tint(pal.hull, -4), { finish: 'paint' });
    F.rbox(lean * 0.55, 0, 2.2, 3.6, 4.8, 3.2, team, { radius: 1.2 });
    for (const sd of [1, -1]) {
        const hand = [o.reach[0], sd * o.reach[1], o.reach[2]];
        const s0 = [sh[0], sd * 2.8, sh[2] - 0.6];
        const el = [(s0[0] + hand[0]) / 2, sd * (o.reach[1] + 0.9), Math.min(s0[2], hand[2]) - 0.6];
        F.limb(...s0, ...el, r * 0.9, cloth, { finish: 'paint' });
        F.limb(...el, ...hand, r * 0.8, cloth, { finish: 'paint' });
        F.sphere(...hand, 0.85, SKIN, { finish: 'flesh' });
        const foot = [o.feet[0], sd * o.feet[1], o.feet[2]];
        const knee = [o.feet[0] * 0.75 + 0.6, sd * (o.feet[1] + 0.3), 1.0];
        F.limb(0.4, sd * 1.4, 0.6, ...knee, r, cloth, { finish: 'paint' });
        F.limb(...knee, ...foot, r * 0.85, cloth, { finish: 'paint' });
        F.rbox(foot[0] + 0.5, foot[1], foot[2] - 0.8, 2.6, 1.6, 1.4, BOOT, { radius: 0.5, finish: 'rubber' });
    }
    const hz = sh[2] + 2.6;
    F.ellipsoid(sh[0] + 0.4, 0, hz, 1.8, 1.7, 1.9, o.skin || SKIN, { finish: 'flesh' });
    if (o.mohawk) {
        for (let i = 0; i < 4; i++) F.spike(sh[0] - 1 + i * 0.9, 0, hz + 1.5, Math.PI, 0.6, 1.2, 2.1 - Math.abs(i - 1.5) * 0.5, '#c8321e');
    } else {
        F.blob(sh[0] + 0.3, 0, hz + 0.1, 2.15, 2.1, pal.hullDark, { finish: 'paint' });
        F.cyl(sh[0] + 0.3, 0, hz - 0.1, 2.5, 0.3, pal.hullDark, { seg: 16 });
        F.box(sh[0] + 1.9, 0, hz - 0.3, 0.5, 2.6, 0.9, '#1d2a30', { bevel: false, finish: 'glass' });  // goggles
    }
    if (o.rifle) F.rod(sh[0] - 2.2, 1.2, 1.5, sh[0] - 0.4, -1.6, 7.6, 0.4, 0.3, GUN);                // slung rifle
}
