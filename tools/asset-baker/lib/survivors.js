// ============================================
// Survivors: salvaged 20th-century hardware. Modelled on real armour
// layouts (running gear, glacis, engine deck, stowage) rather than
// boxes, at the same mounts and footprints as the game expects.
// ============================================
import { TEAM, tint } from './kit.js';
import { Fr, track, jerry, crate, tarp, drum, headlight, gun, antenna, hatch } from './parts.js';
import { soldier, seated } from './infantry.js';

const GUNMETAL = '#3a3d34', RUST = '#5a3d2a', TARP = '#6f684a', WOOD = '#7c6238';

export const SURV_UNITS = {
    // Anaconda: medium tank. Turret mount (-1.5, z 11).
    tank(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = pal.hull, dark = pal.hullDark;
        track(F, 9.3, 29, 5.4, 6.6);
        track(F, -9.3, 29, 5.4, 6.6);
        // lower hull tub between the tracks
        F.prism([[-13.6, 2.2], [11.4, 2.2], [14.6, 5.4], [13.6, 7.6], [-14.2, 7.6]], 13.4, tint(hull, -8));
        // fenders, with a team stripe along the outer edge
        for (const sd of [1, -1]) {
            F.box(-0.4, sd * 9.6, 6.75, 26.6, 5.6, 0.7, tint(hull, -3), { bevel: 0.2 });
            F.box(-0.4, sd * 11.75, 6.85, 22, 1.5, 0.72, team, { bevel: 0.2 });
            // mud flaps
            F.box(13.2, sd * 9.6, 5.6, 0.5, 5.4, 1.7, tint(hull, -14), { bevel: false });
            F.box(-14.0, sd * 9.6, 5.3, 0.5, 5.4, 2.0, tint(hull, -14), { bevel: false });
        }
        // superstructure: long sloped glacis, flat roof, sloped rear
        F.prism([[-13.2, 7.4], [13.4, 7.4], [6.8, 11], [-10.6, 11], [-13.2, 9.4]], 16.6, hull, { bevel: 0.5 });
        // driver's hatch + vision block on the glacis shoulder
        F.rbox(7.2, -3.6, 10.3, 3, 3.6, 1.1, tint(hull, 6), { radius: 0.8, bevel: 0.3 });
        F.box(8.9, -3.6, 10.0, 0.7, 2, 0.8, '#1d2622', { bevel: false });
        // spare track links bolted to the glacis
        for (const v of [1.6, 3.6, 5.6]) F.box(10.4, v, 8.75, 2.2, 1.5, 0.7, '#2f2d28', { bevel: false, finish: 'rubber' });
        // tow shackles, headlights with guards
        for (const sd of [1, -1]) {
            F.box(14.3, sd * 4.6, 5.6, 1.2, 1.0, 1.0, '#2a2a25', { bevel: false });
            headlight(F, 12.2, sd * 7.0, 8.6, 0.75);
        }
        // engine deck: louvred grille, filler caps
        F.box(-8.2, 0, 11, 4.8, 11.4, 0.5, dark, { bevel: 0.2 });
        for (let i = 0; i < 4; i++) F.box(-6.6 - i * 1.1, 0, 11.45, 0.5, 10.4, 0.3, '#22241d', { bevel: false, cast: false });
        F.cyl(-11.6, 4.5, 10.2, 0.8, 0.5, '#2c2d27'); F.cyl(-11.6, -4.5, 10.2, 0.8, 0.5, '#2c2d27');
        // exhausts with heat-rusted shrouds
        for (const sd of [1, -1]) {
            F.rod(-10.5, sd * 7.3, 8.4, -14.6, sd * 7.3, 8.4, 0.85, 0.85, RUST);
            F.rod(-14.6, sd * 7.3, 8.4, -15.3, sd * 7.3, 8.9, 0.6, 0.6, '#1c1815');
        }
        // external fuel drum across the rear plate, unditching log on the side
        drum(F.at(-14.7, 0, 0, Math.PI / 2), 0, 0, 7.7, 9.5, 1.45, tint(hull, -6));
        // fender stowage
        crate(F, -3.5, -9.6, 7.45, 6, 3.4, 2.2, tint(dark, 4));
        tarp(F, 2.5, 9.4, 7.45, 7, 1.2, TARP);
        jerry(F, -7.5, 9.6, 7.45, tint(hull, -10));
    },

    // Juggernaut: breakthrough tank. Turret mount (1, z 13).
    heavy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = pal.hull, dark = pal.hullDark;
        track(F, 11.4, 36, 7.6, 8, { wheels: 7 });
        track(F, -11.4, 36, 7.6, 8, { wheels: 7 });
        F.prism([[-17, 2.4], [14, 2.4], [18.4, 6.4], [17.4, 9.2], [-17.6, 9.2]], 15.4, tint(hull, -9));
        for (const sd of [1, -1]) {
            // fender and bolted skirt plates over the upper run
            F.box(-0.4, sd * 12, 8.1, 33.4, 7.6, 0.8, tint(hull, -3), { bevel: 0.25 });
            for (let i = 0; i < 5; i++) {
                const col = i === 1 || i === 3 ? team : tint(hull, i % 2 ? -7 : -1);
                F.box(-12.8 + i * 6.3, sd * 15.55, 4.7, 5.9, 0.6, 3.9, col, { bevel: 0.2 });
            }
            F.box(16.4, sd * 12, 6.6, 0.6, 7.4, 2.2, tint(hull, -14), { bevel: false });
            F.box(-17.2, sd * 12, 6.2, 0.6, 7.4, 2.6, tint(hull, -14), { bevel: false });
        }
        // casemate hull: steep glacis, thick roof, stepped engine house
        F.prism([[-16.4, 9], [17, 9], [10.5, 13], [-9, 13], [-10.5, 12.2], [-16.4, 12.2]], 20.6, hull, { bevel: 0.6 });
        // welded-on glacis applique plate with team marking
        F.box(13.6, 0, 10.2, 1.0, 9, 1.6, team, { bevel: 0.2 });
        // driver + bow gunner hatches, hull MG
        hatch(F, 9.2, -5.2, 12.6, 1.7, tint(hull, 6));
        hatch(F, 9.2, 5.2, 12.6, 1.7, tint(hull, 6));
        F.sphere(15.6, 4.2, 10.4, 1.1, dark, { finish: 'paint' });
        F.rod(15.8, 4.2, 10.4, 18.6, 4.2, 10.3, 0.35, 0.3, '#1e1e1b');
        for (const sd of [1, -1]) {
            headlight(F, 16.2, sd * 8.2, 10.3, 0.85);
            F.box(18.3, sd * 5.4, 6.2, 1.3, 1.2, 1.2, '#2a2a25', { bevel: false });
        }
        // engine deck: two fan housings, louvres, twin stacks
        F.box(-13.4, 0, 12.2, 5.6, 16, 0.5, dark, { bevel: 0.2 });
        for (const v of [4.2, -4.2]) { F.cyl(-13.4, v, 12.7, 2.6, 0.6, '#2b2d26', { seg: 16 }); F.disc(-13.4, v, 13.3, 2.0, '#15160f'); }
        for (let i = 0; i < 4; i++) F.box(-10.1, -6 + i * 4, 12.45, 0.5, 2.8, 0.3, '#22241d', { bevel: false, cast: false });
        for (const sd of [1, -1]) {
            F.rod(-14.5, sd * 9.2, 12.0, -14.5, sd * 9.2, 16.4, 0.95, 0.85, RUST);
            F.rod(-14.5, sd * 9.2, 16.4, -15.3, sd * 9.2, 17.2, 0.85, 0.7, '#1c1815');
        }
        // stowage: tool box, tarp, jerry cans, tow cable drum
        crate(F, 2, -12.2, 8.9, 7.5, 4.2, 2.4, tint(dark, 4));
        tarp(F, -6.5, -12.2, 8.9, 6.5, 1.35, TARP);
        crate(F, -4, 12.2, 8.9, 5, 3.6, 1.9, WOOD);
        jerry(F, 2.6, 12.6, 8.9, tint(hull, -10)); jerry(F, 4.6, 12.6, 8.9, tint(hull, -16));
        drum(F.at(-18.1, 0, 0, Math.PI / 2), -4.4, 0, 9.3, 7.4, 1.5, tint(hull, -6));
        drum(F.at(-18.1, 0, 0, Math.PI / 2), 4.4, 0, 9.3, 7.4, 1.5, tint(hull, -12));
    }
};

Object.assign(SURV_UNITS, {
    trooper(s, yaw, pal, team, frame) { soldier(s, yaw, pal, team, 'survivors', 'rifle', frame); },
    flamer(s, yaw, pal, team, frame) { soldier(s, yaw, pal, team, 'survivors', 'flame', frame); },
    rocketeer(s, yaw, pal, team, frame) { soldier(s, yaw, pal, team, 'survivors', 'rocket', frame); },

    // Dirt bike with a rider leaning over the bars
    bike(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        F.wheel(-6.2, 0, 3.4, 1.9);
        F.wheel(6.6, 0, 3.3, 1.6);
        // frame, engine, exhaust
        F.rbox(0.2, 0, 2.4, 4.6, 2.6, 3.2, '#3a3b36', { radius: 0.6, finish: 'metal' });
        F.rod(-5.8, 0, 3.6, 0, 0, 6, 0.5, 0.5, '#2c2d29');
        F.rod(-1, 1.5, 3.2, -7.4, 1.5, 5.2, 0.6, 0.75, RUST);
        // tank (team), seat, fenders
        F.rbox(2.0, 0, 5.6, 5, 2.8, 2.3, team, { radius: 0.9, round: true });
        F.rbox(-3.2, 0, 6.0, 5.4, 2.2, 1.2, '#26231e', { radius: 0.7, finish: 'rubber' });
        F.prism([[-9.2, 6.6], [-4.2, 7.2], [-4.2, 7.9], [-9.4, 7.3]], 2.2, tint(pal.hull, -4), { bevel: 0.15 });
        F.prism([[4.8, 7.4], [8.6, 6.6], [8.8, 7.2], [4.8, 8.1]], 1.9, tint(pal.hull, -4), { bevel: 0.15 });
        // fork, bars, lamp, number plate
        for (const sd of [1, -1]) F.rod(6.6, sd * 1.0, 3.3, 4.2, sd * 1.0, 10.2, 0.38, 0.38, '#6b6c66');
        F.rod(4.1, -3.3, 10.5, 4.1, 3.3, 10.5, 0.34, 0.34, '#232320');
        headlight(F, 5.4, 0, 9.2, 0.9);
        F.box(5.2, 0, 7.6, 0.4, 2.2, 1.4, team, { bevel: false });
        seated(F.at(-2.6, 0, 7.2), pal, team, { reach: [6.7, 3.2, 3.3], lean: 2.6, feet: [1.8, 2.3, -4.2], rifle: true });
    },

    // ATV: tube-frame scout car with a pintle-mounted machine gun
    buggy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = pal.hull;
        for (const [u, v] of [[7.2, 6.3], [7.2, -6.3], [-6.8, 6.5], [-6.8, -6.5]]) {
            F.wheel(u, v, 3.3, 2.7);
            F.rod(u, v * 0.45, 3.5, u, v * 0.86, 3.3, 0.5, 0.5, '#2a2a26');      // axle / wishbone
            F.rod(u - 1.6, v * 0.5, 4.6, u, v * 0.8, 3.4, 0.35, 0.35, '#2a2a26');
        }
        // tub with sloped nose and open cockpit
        F.prism([[-9.6, 2.6], [9.4, 2.6], [10.6, 4.2], [9.6, 5.6], [3.2, 6.6], [-9.6, 6.6]], 8.6, hull, { bevel: 0.4 });
        F.box(-1.4, 0, 6.5, 7.4, 6.8, 0.3, '#201f1b', { bevel: false });       // cockpit floor shadow
        F.box(6.2, 0, 6.2, 5.2, 7.2, 0.6, tint(hull, 5), { bevel: 0.25 });     // hood
        for (let i = 0; i < 3; i++) F.box(5 + i * 1.1, 0, 6.8, 0.45, 5, 0.25, '#22241d', { bevel: false, cast: false });
        for (const sd of [1, -1]) {
            F.box(-1, sd * 4.5, 5.2, 12, 0.6, 2.4, team, { bevel: 0.2 });         // door panels
            F.box(7.2, sd * 6.3, 7.0, 6, 3.2, 0.5, tint(hull, -6), { bevel: 0.2 });  // front fenders
            F.box(-6.8, sd * 6.5, 7.2, 6.2, 3.4, 0.5, tint(hull, -6), { bevel: 0.2 });
            headlight(F, 10.2, sd * 3.0, 5.6, 0.75);
        }
        // bull bar
        for (const z of [3.4, 5.2]) F.rod(11.2, -4.4, z, 11.2, 4.4, z, 0.35, 0.35, '#2a2a26');
        for (const v of [-3.4, 3.4]) F.rod(10.2, v, 3, 11.2, v, 5.6, 0.35, 0.35, '#2a2a26');
        // roll cage
        const cage = '#34352f';
        for (const sd of [1, -1]) {
            F.rod(3.2, sd * 3.9, 6.6, 1.6, sd * 3.7, 14.4, 0.42, 0.42, cage);
            F.rod(-5.6, sd * 3.9, 6.6, -4.6, sd * 3.7, 14.4, 0.42, 0.42, cage);
            F.rod(1.6, sd * 3.7, 14.4, -4.6, sd * 3.7, 14.4, 0.42, 0.42, cage);
            F.rod(-4.6, sd * 3.7, 14.4, -9.4, sd * 3.6, 6.8, 0.36, 0.36, cage);
        }
        F.rod(1.6, -3.7, 14.4, 1.6, 3.7, 14.4, 0.42, 0.42, cage);
        F.rod(-4.6, -3.7, 14.4, -4.6, 3.7, 14.4, 0.42, 0.42, cage);
        // driver, steering wheel
        seated(F.at(-0.6, -1.7, 7.0), pal, team, { reach: [3.6, 1.2, 2.6], lean: 0.6, feet: [3.4, 1.0, -3.2] });
        F.ring(2.6, -1.7, 10.2, 1.1, 0.22, '#1d1d1a', { tiltX: 1.2, rotZ: yaw + Math.PI / 2 });
        // pintle MG on the roll bar with ammo can
        F.rod(-4.6, 1.2, 14.4, -4.6, 1.2, 16.2, 0.35, 0.35, '#232320');
        F.rbox(-4.2, 1.2, 15.9, 3.6, 1.2, 1.4, '#2b2c27', { radius: 0.3, finish: 'metal' });
        F.rod(-2.6, 1.2, 16.6, 5.6, 1.2, 16.9, 0.36, 0.3, '#1c1c19');
        F.rod(-0.2, 1.2, 16.7, 3.2, 1.2, 16.82, 0.52, 0.52, '#2a2b26', { seg: 8 });
        F.box(-4.4, 2.5, 15.6, 2, 1.2, 1.6, '#4a4f36', { bevel: 0.15 });
        // spare wheel, jerry cans, bedroll
        F.cyl(-8.8, 0, 6.7, 3.0, 1.5, '#22201d', { finish: 'rubber', seg: 18 });
        F.cyl(-8.8, 0, 8.2, 1.5, 0.3, '#77786f', { finish: 'metal', seg: 12 });
        jerry(F, -7.2, 3.2, 6.7, tint(hull, -12)); jerry(F, -7.2, -3.2, 6.7, '#7a2f22');
        antenna(F, -9.2, -3.4, 7, 13);
    },

    // Barrage Craft: 6x6 self-propelled howitzer
    artillery(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = pal.hull, dark = pal.hullDark;
        for (const u of [9.4, 0.4, -8.4]) for (const sd of [1, -1]) {
            F.wheel(u, sd * 7.3, 3.6, 3.0);
            F.rod(u, sd * 2, 3.7, u, sd * 6.4, 3.7, 0.55, 0.55, '#2a2a26');
        }
        // armoured chassis with wheel arches
        F.prism([[-13.4, 3.2], [13, 3.2], [14.4, 5.2], [13.6, 8.6], [-13.4, 8.6]], 10.6, tint(hull, -6), { bevel: 0.4 });
        for (const sd of [1, -1]) {
            F.box(0, sd * 7.3, 7.9, 27, 4.2, 0.7, tint(hull, -3), { bevel: 0.2 });
            F.box(-4, sd * 9.3, 8.0, 12, 0.5, 0.75, team, { bevel: false });
            headlight(F, 14.2, sd * 3.6, 6.6, 0.8);
        }
        // crew cab: sloped armoured glass, roof hatch
        F.prism([[4.6, 8.6], [14, 8.6], [12.2, 13.2], [6, 13.8], [4.6, 13.4]], 11.4, hull, { bevel: 0.5 });
        for (const v of [-2.9, 2.9]) F.prism([[12.5, 10.2], [13.4, 10.2], [12.5, 12.6], [11.6, 12.6]], 4.4, '#1e2a2c', { v, bevel: 0.1, finish: 'glass' });
        for (const sd of [1, -1]) {
            F.box(8.4, sd * 5.75, 10.6, 3.6, 0.3, 2, '#1e2a2c', { bevel: false, finish: 'glass' });
            F.box(8.4, sd * 5.8, 8.9, 6, 0.35, 1.4, team, { bevel: false });
        }
        hatch(F, 8.6, -2.4, 13.7, 1.6, tint(hull, 6));
        antenna(F, 6, 4.6, 13.6, 12);
        // gun deck: turntable, cradle, long barrel at high elevation
        F.box(-5.4, 0, 8.6, 15, 11, 0.6, dark, { bevel: 0.2 });
        F.cyl(-4.6, 0, 9.2, 4.6, 1.3, tint(hull, 4), { seg: 20 });
        for (const sd of [1, -1]) F.prism([[-7.6, 10.5], [-1.6, 10.5], [-2.6, 15.6], [-5.6, 15.6]], 1.0, tint(hull, -2), { v: sd * 2.5, bevel: 0.2 });
        F.rod(-4.6, -3.1, 14.2, -4.6, 3.1, 14.2, 0.7, 0.7, '#2a2a26');           // trunnion
        const el = 0.62, u0 = -8.2, z0 = 11.9;
        F.rod(u0, 0, z0, u0 + 5, 0, z0 + 5 * el, 1.9, 1.7, GUNMETAL);             // breech
        gun(F, u0 + 5, 0, z0 + 5 * el, 20.5, 1.0, { elev: el, evac: true, color: GUNMETAL });
        for (const sd of [1, -1]) F.rod(u0 + 4, sd * 1.5, z0 + 4 * el + 1.5, u0 + 12, sd * 1.5, z0 + 12 * el + 1.5, 0.5, 0.5, '#5c5f52'); // recuperators
        // gun shield (team)
        F.prism([[0.2, 11.6], [0.9, 11.6], [-0.6, 17], [-1.3, 17]], 3.4, team, { v: 3.6, bevel: 0.15 });
        F.prism([[0.2, 11.6], [0.9, 11.6], [-0.6, 17], [-1.3, 17]], 3.4, team, { v: -3.6, bevel: 0.15 });
        // recoil spades, ready ammunition
        for (const sd of [1, -1]) {
            F.rod(-12.6, sd * 4.2, 7.6, -17, sd * 5.2, 1.0, 0.6, 0.6, '#2c2d29');
            F.box(-17.2, sd * 5.2, 0, 1.2, 3.4, 1.6, '#34352f', { bevel: 0.15 });
        }
        crate(F, -11.4, 3.4, 9.2, 3.6, 3.4, 2.2, WOOD);
        for (const v of [-4.4, -3.2, -2.0]) F.rod(-12.4, v, 9.2, -12.4, v, 12.2, 0.55, 0.3, '#8c7a3a', { seg: 8, finish: 'metal' });
    }
});

// plan of a cast/welded turret: nose forward, bustle aft
const turretPlan = (L, W) => [[L * 0.5, -W * 0.26], [L * 0.5, W * 0.26], [L * 0.2, W * 0.5], [-L * 0.3, W * 0.5], [-L * 0.5, W * 0.3], [-L * 0.5, -W * 0.3], [-L * 0.3, -W * 0.5], [L * 0.2, -W * 0.5]];

export const SURV_TURRETS = {
    tank(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = tint(pal.hull, 5);
        F.cyl(0, 0, -0.3, 5.2, 0.7, pal.hullDark, { seg: 20 });           // turret ring
        F.slab(turretPlan(14.5, 11.6), 0.3, 5.2, hull, { inset: 1.5, shift: -0.5, bevel: 0.6 });
        // rear bustle bin with team color, lifting eyes
        F.rbox(-8.3, 0, 1.2, 2.6, 8, 2.8, team, { radius: 0.5, bevel: 0.3 });
        // mantlet and gun
        F.rbox(6.9, 0, 0.9, 2.6, 5.2, 3.6, pal.hullDark, { radius: 0.8, bevel: 0.4 });
        gun(F, 7.6, 0, 2.7, 12.6, 0.82, { evac: true, color: GUNMETAL });
        F.rod(7.9, 2.0, 2.9, 9.6, 2.0, 2.9, 0.3, 0.3, '#1b1b18');          // coax MG
        // commander's cupola with split hatch and AA machine gun
        F.cyl(-2.2, 2.6, 5.0, 2.2, 1.3, tint(hull, -4), { seg: 16 });
        hatch(F, -2.2, 2.6, 6.3, 1.7, tint(hull, 4));
        F.rod(-1.6, 2.6, 6.9, -1.6, 2.6, 8.0, 0.25, 0.25, '#1e1e1b');
        F.rod(-2.6, 2.6, 8.0, 2.4, 2.6, 8.2, 0.34, 0.26, '#1e1e1b');
        F.box(-2.2, 3.5, 7.5, 1.4, 0.9, 0.9, '#3d402f', { bevel: false });
        hatch(F, -1.6, -2.9, 5.0, 1.5, tint(hull, 2));                    // loader
        F.box(3.0, -3.4, 4.9, 1.6, 1.3, 0.9, '#1d2622', { bevel: false }); // gunner's sight
        // smoke dischargers
        for (const sd of [1, -1]) for (let i = 0; i < 3; i++) F.rod(3.2 - i * 1.3, sd * 5.6, 2.6, 4.4 - i * 1.3, sd * 6.5, 3.6, 0.42, 0.42, '#2a2c25', { seg: 8 });
        antenna(F, -5.4, -3.8, 4.8, 12);
    },

    heavy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = tint(pal.hull, 6);
        F.cyl(0, 0, -0.3, 6.6, 0.8, pal.hullDark, { seg: 22 });
        F.slab(turretPlan(18, 15), 0.4, 6.4, hull, { inset: 1.7, shift: -0.6, bevel: 0.7 });
        // applique cheek armour + team panels
        for (const sd of [1, -1]) F.box(1.0, sd * 7.2, 1.4, 6.4, 0.7, 3.3, team, { bevel: 0.25 });
        F.rbox(-10.2, 0, 1.4, 3, 10.5, 3.2, tint(pal.hullDark, 6), { radius: 0.6, bevel: 0.3 });
        // twin-gun mantlet
        F.rbox(8.6, 0, 1.0, 3, 9.4, 4.2, pal.hullDark, { radius: 0.9, bevel: 0.45 });
        for (const v of [2.7, -2.7]) gun(F, 9.4, v, 3.1, 14.2, 0.9, { evac: true, color: GUNMETAL });
        // cupola + AA gun, loader hatch, periscopes, ventilator
        F.cyl(-3, 3.6, 6.2, 2.5, 1.5, tint(hull, -4), { seg: 16 });
        hatch(F, -3, 3.6, 7.7, 1.9, tint(hull, 4));
        F.rod(-2.2, 3.6, 8.3, -2.2, 3.6, 9.5, 0.28, 0.28, '#1e1e1b');
        F.rod(-3.4, 3.6, 9.5, 3.2, 3.6, 9.8, 0.38, 0.28, '#1e1e1b');
        F.box(-3, 4.7, 9.0, 1.6, 1, 1, '#3d402f', { bevel: false });
        hatch(F, -2.4, -3.8, 6.2, 1.8, tint(hull, 2));
        F.cyl(-6.6, 0, 6.2, 1.3, 0.8, pal.hullDark, { seg: 12 });
        for (const v of [-2, 2]) F.box(3.6, v, 6.1, 1.5, 1.4, 0.9, '#1d2622', { bevel: false });
        for (const sd of [1, -1]) for (let i = 0; i < 3; i++) F.rod(5.0 - i * 1.4, sd * 6.6, 4.0, 6.3 - i * 1.4, sd * 7.5, 5.1, 0.45, 0.45, '#2a2c25', { seg: 8 });
        antenna(F, -7.4, -4.8, 6, 14);
        tarp(F.at(-10.2, 0, 0, Math.PI / 2), 0, 0, 4.6, 8, 1.1, TARP);
    }
};

Object.assign(SURV_TURRETS, {
    // twin heavy machine guns behind a splinter shield (mount: tower roof)
    tower(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        F.cyl(0, 0, -0.2, 4.2, 0.9, pal.hullDark, { seg: 18 });
        F.rbox(-0.6, 0, 0.7, 5, 4.6, 2.6, tint(pal.hull, 4), { radius: 0.9 });
        // angled shield plates with a gun slot
        for (const sd of [1, -1]) F.prism([[3.4, 0.6], [4.0, 0.6], [3.0, 6.2], [2.4, 6.2]], 3.6, sd > 0 ? team : tint(pal.hull, 6), { v: sd * 2.6, bevel: 0.15 });
        for (const v of [1.1, -1.1]) {
            F.rod(0.4, v, 3.7, 6.2, v, 3.8, 0.62, 0.62, '#2a2b26', { seg: 8 });     // cooling jacket
            F.rod(6.2, v, 3.8, 12.2, v, 3.95, 0.34, 0.3, '#1c1c19', { seg: 8 });
            F.rod(12.2, v, 3.95, 13, v, 3.97, 0.5, 0.5, '#151513', { seg: 8 });
        }
        F.box(-1.4, 3.2, 1.4, 2.6, 1.6, 2.2, '#4a4f36', { bevel: 0.15 });           // ammo cans
        F.box(-1.4, -3.2, 1.4, 2.6, 1.6, 2.2, '#4a4f36', { bevel: 0.15 });
        F.rod(-3.4, 0, 2, -5, 0, 4.6, 0.35, 0.35, '#2a2a26');                       // spade grips
    },

    // twin-gun armoured cupola (mount: casemate roof)
    towerHeavy(s, yaw, pal, team) {
        const F = new Fr(s, yaw);
        const hull = tint(pal.hull, 8);
        F.cyl(0, 0, -0.3, 6, 0.8, pal.hullDark, { seg: 20 });
        F.slab(turretPlan(14.5, 13), 0.4, 6, hull, { inset: 1.6, shift: -0.4, bevel: 0.6 });
        for (const sd of [1, -1]) F.box(0.6, sd * 6.3, 1.4, 5.2, 0.6, 2.8, team, { bevel: 0.2 });
        F.rbox(6.9, 0, 1.0, 2.6, 8.4, 3.8, pal.hullDark, { radius: 0.8, bevel: 0.4 });
        for (const v of [2.4, -2.4]) gun(F, 7.6, v, 3.0, 11.6, 0.9, { evac: false, color: GUNMETAL });
        hatch(F, -2.4, 0, 5.8, 2.0, tint(hull, 4));
        F.box(2.8, 0, 5.7, 1.5, 2.4, 0.9, '#1d2622', { bevel: false });
        F.cyl(-5.2, 3, 5.6, 1.1, 0.8, pal.hullDark, { seg: 12 });
        antenna(F, -5.4, -3.6, 5.6, 11);
    }
});
