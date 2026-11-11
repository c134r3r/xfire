// ============================================
// IRONCLAD vehicles, rendered straight down for the top-down shooter.
// Authored with a hull half-length of 10 units, facing +x; the hull
// paint is the team material so the game tints each enemy type.
// Proportions follow the game's hit shapes (see VEHICLE_ART there).
// ============================================
import { TEAM, tint } from './kit.js';
import { Fr, track, jerry, crate, tarp, drum, headlight, gun, hatch } from './parts.js';

const P = TEAM;
const DARK = '#262722', STEEL = '#4c4e48', RUSTY = '#5e3f2b', GLASS = '#1b262b', BONE = '#d8ccb4', WOOD = '#7c6238', TARPC = '#6f684a';
const grille = (F, u, v, z, len, wid, n = 4) => { F.box(u, v, z, len, wid, 0.3, '#30312b', { bevel: false }); for (let i = 0; i < n; i++) F.box(u - len / 2 + (i + 0.5) * len / n, v, z + 0.3, len / n * 0.45, wid * 0.9, 0.25, '#14140f', { bevel: false, cast: false }); };
const rivets = (F, pts, z) => { for (const [u, v] of pts) F.cyl(u, v, z, 0.32, 0.25, '#3a3b34', { seg: 6 }); };
const crew = (F, u, v, z, col = '#3d4030') => { F.rbox(u - 0.4, v, z - 2, 2.4, 3.6, 2.2, '#4a4636', { radius: 0.8 }); F.sphere(u, v, z + 1, 1.25, col, { finish: 'paint' }); };

export const IRONCLAD = {
    tank(s) {
        const F = new Fr(s);
        track(F, 6.25, 20.8, 4.1, 4.4); track(F, -6.25, 20.8, 4.1, 4.4);
        F.prism([[-10.1, 1.8], [8.6, 1.8], [10.5, 3.4], [10, 4.7], [-10.3, 4.7]], 9.2, P);
        for (const sd of [1, -1]) {
            F.box(-0.3, sd * 6.3, 4.45, 18.6, 4.3, 0.5, P, { bevel: 0.2 });
            F.box(9.2, sd * 6.3, 3.6, 0.4, 4.1, 1.3, tint(DARK, 6), { bevel: false });
            headlight(F, 9.3, sd * 4.6, 5.4, 0.55);
        }
        F.prism([[-9.6, 4.6], [9.8, 4.6], [5.6, 6.6], [-8, 6.6], [-9.6, 5.6]], 11.6, P, { bevel: 0.45 });
        F.cyl(0, 0, 6.5, 3.8, 0.5, DARK, { seg: 20 });
        F.rbox(6.2, -2.6, 6.1, 2.2, 2.8, 0.8, P, { radius: 0.6, bevel: 0.25 });         // driver's hatch
        F.box(7.5, -2.6, 5.9, 0.5, 1.6, 0.6, GLASS, { bevel: false });
        for (const v of [1.4, 3.0]) F.box(7.9, v, 5.3, 1.6, 1.2, 0.5, '#2c2b27', { bevel: false, finish: 'rubber' });
        grille(F, -6.6, 0, 6.6, 3.6, 8.4, 4);
        for (const sd of [1, -1]) { F.rod(-7.4, sd * 5.2, 5.6, -10.4, sd * 5.2, 5.6, 0.6, 0.6, RUSTY); F.cyl(-8.6, sd * 3.2, 5.5, 0.55, 0.5, DARK, { seg: 8 }); }
        crate(F, -2.6, -6.6, 4.95, 4.4, 2.6, 1.6, '#4a4d3c'); tarp(F, 2.4, 6.5, 4.95, 5, 0.9, TARPC);
        drum(F.at(-10.6, 0, 0, Math.PI / 2), 0, 0, 5.0, 7, 1.05, '#55584a');
    },

    buggy(s) {
        const F = new Fr(s);
        for (const [u, v, r, w] of [[6.2, 6.3, 2.2, 2.6], [6.2, -6.3, 2.2, 2.6], [-6, 6.7, 2.6, 3.0], [-6, -6.7, 2.6, 3.0]]) {
            F.wheel(u, v, r, w); F.rod(u, v * 0.3, r, u, v * 0.8, r, 0.4, 0.4, DARK);
        }
        F.slab([[11, 0.9], [5, 4.4], [-9, 5], [-9, -5], [5, -4.4], [11, -0.9]], 1.6, 4.6, P, { inset: 0.8, bevel: 0.4 });
        F.box(-1.6, 0, 4.5, 6.4, 6.6, 0.25, '#17170f', { bevel: false });
        F.box(5.6, 0, 4.5, 4.4, 5.4, 0.4, P, { bevel: 0.2 });
        grille(F, 7.6, 0, 4.9, 1.6, 3, 3);
        for (const sd of [1, -1]) {
            headlight(F, 9.4, sd * 2.4, 4.2, 0.55);
            F.rod(1.6, sd * 3.6, 4.6, 0.6, sd * 3.4, 8.6, 0.34, 0.34, DARK);
            F.rod(-5, sd * 3.6, 4.6, -4.2, sd * 3.4, 8.6, 0.34, 0.34, DARK);
            F.rod(0.6, sd * 3.4, 8.6, -4.2, sd * 3.4, 8.6, 0.34, 0.34, DARK);
        }
        F.rod(0.6, -3.4, 8.6, 0.6, 3.4, 8.6, 0.34, 0.34, DARK); F.rod(-4.2, -3.4, 8.6, -4.2, 3.4, 8.6, 0.34, 0.34, DARK);
        crew(F, -0.6, -1.5, 5.6);
        F.rod(-3.8, 1.3, 9.2, 3.6, 1.3, 9.4, 0.32, 0.26, '#161614'); F.box(-3.8, 1.3, 8.7, 2.4, 1.1, 1, '#2b2c27', { bevel: 0.15 });
        F.rbox(-7.4, 0, 4.4, 3, 5.6, 1.8, '#33342e', { radius: 0.5, finish: 'metal' });
        for (const sd of [1, -1]) F.rod(-7.4, sd * 2, 5.6, -10, sd * 2.6, 5.2, 0.5, 0.5, RUSTY);
        jerry(F, -4.6, 4.2, 4.5, '#6b3024');
    },

    armoredCar(s) {
        const F = new Fr(s);
        for (const u of [-6.5, 0, 6.5]) for (const sd of [1, -1]) F.wheel(u, sd * 6.1, 2.1, 2.5);
        F.slab([[10, -2.8], [10, 2.8], [7, 5.2], [-9.5, 5.2], [-9.5, -5.2], [7, -5.2]], 1.8, 6.4, P, { inset: 1.3, bevel: 0.5 });
        for (const v of [-3, 0, 3]) F.spike(9.6, v, 3.4, 0, 3.6, 2.0, -0.6, '#b9b2a2');
        F.box(4.4, 0, 6.0, 1.3, 6, 0.7, GLASS, { bevel: 0.2, finish: 'glass' });
        hatch(F, 0.5, -1.8, 6.4, 1.5, P); hatch(F, 0.5, 1.8, 6.4, 1.5, P);
        grille(F, -6, 0, 6.4, 3.4, 5.2, 4);
        F.box(-2.6, 0, 6.4, 1.2, 6.8, 0.5, P, { bevel: 0.2 });
        for (const sd of [1, -1]) { F.rod(-4, sd * 4.6, 5.4, -9.6, sd * 4.6, 5.4, 0.5, 0.5, RUSTY); headlight(F, 8.3, sd * 3.9, 4.6, 0.5); }
        rivets(F, [[6, 3.4], [6, -3.4], [-8, 3.4], [-8, -3.4], [2.6, 3.6], [2.6, -3.6]], 6.4);
        tarp(F.at(-8.6, 0, 0, Math.PI / 2), 0, 0, 6.3, 5, 0.75, TARPC);
    },

    dozer(s) {
        const F = new Fr(s);
        track(F, 6.7, 20.4, 4.5, 4.8); track(F, -6.7, 20.4, 4.5, 4.8);
        F.box(-0.6, 0, 2, 18.2, 12.6, 4.2, P, { bevel: 0.5, inset: 0.4 });
        F.box(4.6, 0, 6.2, 7, 7.4, 1.8, P, { bevel: 0.5, inset: 0.5 });                 // engine hood
        grille(F, 4.6, 0, 8, 5, 5.4, 5);
        F.rod(6.4, 2.6, 8, 6.4, 2.6, 12.5, 0.6, 0.5, RUSTY); F.cyl(6.4, 2.6, 12.5, 0.8, 0.4, DARK, { seg: 8 });
        F.box(-3.6, 0, 6.2, 7.4, 8.4, 4, P, { bevel: 0.5, inset: 0.7 });                // armoured cab
        F.box(-0.3, 0, 7.4, 0.5, 5.6, 1.6, GLASS, { bevel: false, finish: 'glass' });
        for (const sd of [1, -1]) F.box(-3.6, sd * 3.9, 7.4, 4.6, 0.5, 1.6, GLASS, { bevel: false, finish: 'glass' });
        hatch(F, -3.8, 0, 10.2, 1.9, P);
        // blade: curved mouldboard, push arms, hydraulic rams
        for (let k = -5; k <= 5; k++) {
            const t = k / 5, u = 10 + 2.2 * (1 - t * t);
            F.box(u, t * 9.7, 0.6, 1.3, 2.3, 6.4, k % 2 ? '#8d8579' : '#847c70', { bevel: 0.2, finish: 'metal', rot: -t * 0.42 });
            F.box(u + 0.5, t * 9.7, 0.3, 1.0, 2.3, 0.9, '#b8b2a4', { bevel: false, finish: 'metal', rot: -t * 0.42 });
        }
        for (const sd of [1, -1]) {
            F.rod(2, sd * 9.3, 3, 10.4, sd * 8.6, 2.6, 0.7, 0.7, STEEL);
            F.rod(5, sd * 4.4, 7, 11, sd * 4.4, 5.4, 0.5, 0.36, '#b5b7b0');
        }
        crate(F, -8.2, 0, 6.2, 2.4, 6, 1.6, '#4a4d3c');
        rivets(F, [[-0.4, 5.6], [-0.4, -5.6], [-7, 5.6], [-7, -5.6]], 6.2);
    },

    mortar(s) {
        const F = new Fr(s);
        track(F, 6.05, 20.2, 3.9, 4.2); track(F, -6.05, 20.2, 3.9, 4.2);
        F.box(0, 0, 1.8, 19, 11, 3.8, P, { bevel: 0.5, inset: 0.4 });
        F.box(6.4, 0, 5.6, 5.6, 8.6, 1.6, P, { bevel: 0.5, inset: 0.6 });               // driver's cab
        F.box(8.9, 0, 6.0, 0.5, 5.4, 0.8, GLASS, { bevel: false });
        hatch(F, 6.2, -2, 7.2, 1.4, P);
        // open fighting compartment with the tube on a baseplate
        const wall = (u, v, l, w) => F.box(u, v, 5.6, l, w, 2.4, P, { bevel: 0.25 });
        wall(-2.6, 5, 11.4, 0.8); wall(-2.6, -5, 11.4, 0.8); wall(-8.2, 0, 0.8, 10.6);
        F.box(-2.4, 0, 5.6, 10.6, 9.4, 0.25, '#1d1d17', { bevel: false });
        F.cyl(-1.8, 0, 5.85, 3.9, 0.5, '#565a50', { seg: 20, finish: 'metal' });
        F.rod(-2.6, 0, 6.2, 1.2, 0, 11.6, 1.5, 1.35, '#34362f');
        F.rod(1.2, 0, 11.6, 1.3, 0, 11.75, 1.0, 1.0, '#090908', { seg: 10 });
        for (const sd of [1, -1]) F.rod(-1, sd * 0.4, 9, 2.6, sd * 2.6, 6.2, 0.3, 0.3, STEEL);
        for (let i = 0; i < 4; i++) F.rod(-6.6, -3 + i * 2, 5.9, -6.6, -3 + i * 2, 8, 0.6, 0.28, '#8c7a3a', { seg: 8 });
        crate(F, -4.6, 3.4, 5.85, 2.6, 2, 1.5, WOOD);
        for (const sd of [1, -1]) F.rod(-7, sd * 3.6, 4.6, -10.3, sd * 3.6, 4.6, 0.5, 0.5, RUSTY);
    },

    bike(s) {
        const F = new Fr(s);
        F.wheel(7.4, 0, 2.6, 2.3); F.wheel(-7.4, 0, 2.8, 2.7);
        F.slab([[11.5, -0.8], [11.5, 0.8], [2, 6], [-8.5, 3.4], [-8.5, -3.4], [2, -6]], 2, 5, P, { inset: 1.1, bevel: 0.5 });
        F.prism([[9.6, 3], [11.9, 3], [11.2, 6.6], [10.4, 6.6]], 6.4, '#8d8579', { bevel: 0.2, finish: 'metal' });   // ram plate
        for (const v of [-2.2, 0, 2.2]) F.spike(11.4, v, 4.2, 0, 2.6, 1.3, 0, '#b9b2a2');
        F.rbox(-1.6, 0, 4.8, 5.4, 3, 1.4, '#1b1814', { radius: 1, finish: 'rubber' });
        crew(F, -1, 0, 7.6, '#2d2a26');
        F.rod(3.4, -3.6, 7, 3.4, 3.6, 7, 0.32, 0.32, DARK);
        for (const sd of [1, -1]) {
            F.rod(-1, sd * 3.9, 4.6, -10.2, sd * 3.2, 4.8, 0.7, 0.9, RUSTY);
            F.rod(-0.4, sd * 1.4, 7.4, 3.4, sd * 3, 7, 0.45, 0.4, '#4a4636', { finish: 'paint' });
            headlight(F, 9.2, sd * 1.8, 5.2, 0.5);
        }
        F.rbox(3.6, 0, 4.9, 3, 3.4, 1.3, '#33342e', { radius: 0.8, finish: 'metal' });
    },

    truck(s) {
        const F = new Fr(s);
        for (const u of [-7, -3.5, 6.2]) for (const sd of [1, -1]) F.wheel(u, sd * 5.6, 2.0, 2.3);
        F.box(-0.5, 0, 2.2, 19.6, 6, 1.4, DARK, { bevel: 0.2, finish: 'metal' });       // chassis rails
        // cab: bonnet, windscreen, roof
        F.box(8.6, 0, 3, 3.2, 8, 3.2, P, { bevel: 0.5, inset: 0.4 });
        for (let i = -2; i <= 2; i++) F.box(10.25, i * 1.3, 3.5, 0.2, 0.7, 2, '#14140f', { bevel: false, cast: false });
        F.box(5.6, 0, 3, 3.6, 9.2, 5.6, P, { bevel: 0.6, inset: 0.5 });
        F.prism([[7, 6.2], [7.9, 6.2], [7.3, 8.4], [6.6, 8.4]], 7.4, GLASS, { bevel: 0.1, finish: 'glass' });
        for (const sd of [1, -1]) { F.box(5.6, sd * 4.5, 6.4, 2.2, 0.4, 1.7, GLASS, { bevel: false, finish: 'glass' }); headlight(F, 10.2, sd * 3.2, 4.4, 0.55); F.box(8.6, sd * 4.6, 2.4, 3.4, 1.6, 0.5, P, { bevel: 0.2 }); }
        F.rod(4, 4.2, 3.6, 4, 4.2, 10, 0.5, 0.45, RUSTY);
        // cargo bed under a canvas tilt with hoops
        F.box(-3.6, 0, 3.4, 13.4, 10.4, 1.2, '#4b4636', { bevel: 0.2 });
        const arc = Array.from({ length: 9 }, (_, i) => [Math.cos(Math.PI * i / 8) * 5.1, Math.sin(Math.PI * i / 8) * 3.6]);
        const B = F.at(-3.6, 0, 4.6, Math.PI / 2);
        B.prism([[5.1, -0.6], ...arc, [-5.1, -0.6]], 13, P, { bevel: 0.3 });
        for (const x of [-5.4, -1.8, 1.8, 5.4]) B.prism([[5.25, -0.6], ...arc.map(([a, b]) => [a * 1.03, b * 1.04]), [-5.25, -0.6]], 0.45, tint(TARPC, -14), { v: -x, bevel: 0.1 });
        F.cyl(2.8, 0, 2.6, 1.9, 1.3, '#22201d', { finish: 'rubber', seg: 14 });
    },

    apc(s) {
        const F = new Fr(s);
        for (const u of [-7.2, -2.5, 2.5, 7.2]) for (const sd of [1, -1]) F.wheel(u, sd * 5.9, 2.0, 2.4);
        F.slab([[10.5, -2], [10.5, 2], [7.5, 5.2], [-10, 5.2], [-10, -5.2], [7.5, -5.2]], 1.8, 6.8, P, { inset: 1.4, bevel: 0.5 });
        F.box(7.2, 0, 6.2, 1.1, 5.4, 0.7, GLASS, { bevel: 0.2 });
        for (const u of [-6, -1.5]) for (const sd of [1, -1]) { F.rbox(u, sd * 1.9, 6.75, 3.6, 3, 0.4, P, { radius: 0.5, bevel: 0.15 }); F.box(u, sd * 0.45, 7.0, 3, 0.3, 0.3, DARK, { bevel: false }); }
        F.cyl(4.2, 0, 6.8, 2.1, 1.3, P, { seg: 16 });
        F.rod(4.6, 0, 7.6, 9.4, 0, 7.7, 0.4, 0.32, '#161614'); hatch(F, 3.6, 0, 8.1, 1.2, P);
        for (const sd of [1, -1]) {
            F.rod(-3, sd * 4.5, 5.9, -9.4, sd * 4.5, 5.9, 0.5, 0.5, sd > 0 ? RUSTY : STEEL);
            headlight(F, 9.2, sd * 3.2, 4.8, 0.5);
            for (const u of [-6, -1.5, 3]) F.box(u, sd * 4.75, 5.2, 1.6, 0.3, 0.7, GLASS, { bevel: false });
        }
        tarp(F.at(-9.4, 0, 0, Math.PI / 2), 0, 0, 6.6, 6, 0.8, TARPC);
        rivets(F, [[6.4, 3.4], [6.4, -3.4], [-8.6, 3.6], [-8.6, -3.6], [1.2, 3.8], [1.2, -3.8]], 6.8);
    },

    heli(s) {
        const F = new Fr(s, 0, 0, 0, 3);
        // skids
        for (const sd of [1, -1]) { F.rod(-6, sd * 5.8, 0.4, 7, sd * 5.8, 0.4, 0.42, 0.42, DARK); for (const u of [-3, 4]) F.rod(u, sd * 5.8, 0.4, u, sd * 3, 3.4, 0.3, 0.3, DARK); }
        // tail boom, fin, tail rotor, stabiliser
        F.rod(-5, 0, 5.4, -15.6, 0, 6.2, 1.5, 0.75, P, { finish: 'paint' });
        F.prism([[-17.2, 5.6], [-14.6, 5.6], [-15.4, 10], [-17, 10]], 0.7, P, { bevel: 0.2 });
        F.box(-13.6, 0, 6.1, 1.8, 7, 0.4, P, { bevel: 0.15 });
        F.rod(-16.2, 0.9, 8.4, -16.2, 0.9, 8.5, 2.6, 2.6, 'rgba(30,30,28,0.35)', { seg: 16 });
        // fuselage, engine cowl, exhausts
        F.ellipsoid(0.5, 0, 5.2, 8.6, 4.3, 3.9, P, { finish: 'paint' });
        F.rbox(-2, 0, 7.6, 7.4, 4.4, 2.2, P, { radius: 1.4, round: true });
        for (const sd of [1, -1]) F.rod(-4.6, sd * 2.3, 8.4, -7, sd * 2.9, 8.2, 0.7, 0.8, RUSTY);
        grille(F, -1, 0, 9.8, 3.4, 2.6, 3);
        F.cyl(0.2, 0, 9.8, 1.0, 1.6, DARK, { seg: 10, finish: 'metal' });
        // canopy panes
        F.ellipsoid(5.6, 0, 5.9, 3.5, 2.9, 2.9, '#24424e', { finish: 'glass' });
        F.rod(5.6, 0, 8.7, 8.8, 0, 6.4, 0.22, 0.22, DARK, { seg: 5 });
        // stub wings with rocket pods and a chin gun
        F.box(-0.2, 0, 4.4, 3.2, 16.4, 0.6, P, { bevel: 0.2 });
        for (const sd of [1, -1]) {
            F.rod(-2.4, sd * 7.6, 3.8, 2.4, sd * 7.6, 3.8, 1.1, 1.1, '#3b3d36');
            F.rod(2.4, sd * 7.6, 3.8, 2.5, sd * 7.6, 3.8, 0.8, 0.8, '#0c0c0a', { seg: 8 });
            F.rod(-1.4, sd * 5, 3.9, 1.6, sd * 5, 3.9, 0.5, 0.3, '#8a2a20', { finish: 'paint', seg: 8 });
        }
        F.rod(7.6, 0, 3.4, 10.6, 0, 3.2, 0.36, 0.3, '#161614');
    },

    bomber(s) {
        const F = new Fr(s);
        for (const [u, v, r, w] of [[5.5, 6.1, 1.9, 2.3], [5.5, -6.1, 1.9, 2.3], [-5.5, 6.3, 2.1, 2.6], [-5.5, -6.3, 2.1, 2.6]]) F.wheel(u, v, r, w);
        F.slab([[10, -2], [10, 2], [6, 4.8], [-9, 4.8], [-9, -4.8], [6, -4.8]], 1.7, 4.8, P, { inset: 0.9, bevel: 0.45 });
        F.box(5.6, 0, 4.7, 3.6, 6.4, 2.2, P, { bevel: 0.5, inset: 0.6 });
        F.box(7.5, 0, 5.5, 0.4, 4.4, 0.9, GLASS, { bevel: false });
        // payload: two demolition drums strapped to the bed, wired up
        for (const v of [-2.25, 2.25]) {
            F.cyl(-3.5, v, 4.8, 2.3, 4.2, '#b02a1e', { seg: 16, finish: 'paint' });
            F.cyl(-3.5, v, 6.4, 2.38, 0.9, '#e3b92c', { seg: 16, noTop: true, finish: 'paint' });
            F.cyl(-3.5, v, 9.0, 1.2, 0.25, '#e3b92c', { seg: 10, finish: 'paint' });
            F.cyl(-3.5, v, 9.2, 0.5, 0.3, DARK, { seg: 8 });
        }
        F.rod(-3.5, -2.25, 9.5, -3.5, 2.25, 9.5, 0.16, 0.16, '#101010', { seg: 4 });
        F.rod(-3.5, 0, 9.5, 3.8, 0, 7, 0.16, 0.16, '#101010', { seg: 4 });
        F.box(-3.5, 0, 6, 0.5, 9.4, 0.4, '#3a3324', { bevel: false });
        for (const sd of [1, -1]) { headlight(F, 8.6, sd * 3, 3.8, 0.5); F.rod(-7, sd * 3.8, 4.4, -9.6, sd * 3.8, 4.4, 0.45, 0.45, RUSTY); }
        F.cyl(4.6, 0, 6.9, 0.6, 0.6, '#5a1410', { seg: 8 });                             // beacon
    },

    // Warlord's land battleship (baked at double resolution)
    boss(s) {
        const F = new Fr(s);
        track(F, 7.1, 20.6, 3.9, 4.6, { wheels: 8 }); track(F, -7.1, 20.6, 3.9, 4.6, { wheels: 8 });
        track(F, 9.9, 18.2, 2.1, 3.4, { wheels: 7 }); track(F, -9.9, 18.2, 2.1, 3.4, { wheels: 7 });
        F.slab([[10.5, -4], [10.5, 4], [7, 7.2], [-9.5, 7.2], [-10.5, 3.6], [-10.5, -3.6], [-9.5, -7.2], [7, -7.2]], 2, 5.6, P, { inset: 0.8, bevel: 0.4 });
        // glacis applique, second deck, bolted armour slabs
        F.prism([[6.6, 5.4], [10.2, 3.2], [10.5, 3.8], [7.2, 6.2]], 8.6, tint('#8d8579', -10), { bevel: 0.15, finish: 'metal' });
        F.slab([[6, -5.4], [6, 5.4], [-8.6, 5.4], [-8.6, -5.4]], 5.6, 7.4, P, { inset: 0.7, bevel: 0.4 });
        for (const sd of [1, -1]) {
            for (let i = 0; i < 4; i++) F.box(-6.6 + i * 4.3, sd * 7.5, 3.0, 3.9, 0.4, 2.3, i % 2 ? P : tint('#6c665a', -8), { bevel: 0.15 });
            // sponson gun houses with twin barrels
            F.rbox(3.6, sd * 8.1, 3.4, 4.6, 2.4, 2.6, P, { radius: 0.7, bevel: 0.3 });
            for (const dz of [0, 0.9]) F.rod(5, sd * 8.1, 4 + dz, 9.4, sd * 8.1, 4 + dz, 0.3, 0.26, '#161614', { seg: 8 });
            // exhaust stacks
            for (const u of [-8.6, -7.2]) { F.rod(u, sd * 5.9, 5.6, u, sd * 5.9, 9, 0.42, 0.36, RUSTY, { seg: 8 }); F.cyl(u, sd * 5.9, 9, 0.3, 0.05, '#0c0b0a', { seg: 8 }); }
            for (const v of [1.4, 2.8]) F.spike(10.2, sd * v, 3, 0, 2.2, 0.9, 0, '#b9b2a2');
            F.box(-2, sd * 6.25, 5.65, 9, 0.9, 0.5, DARK, { bevel: false, finish: 'rubber' });   // spare track run
        }
        F.cyl(1, 0, 7.3, 3.9, 0.5, DARK, { seg: 24 });                                   // turret ring
        grille(F, -6.6, 2.6, 7.4, 3, 3.6, 4); grille(F, -6.6, -2.6, 7.4, 3, 3.6, 4);
        // skull trophy plate on the engine deck
        F.cyl(-5.6, 0, 7.4, 1.5, 0.3, '#1a1512', { seg: 14 });
        F.ellipsoid(-5.5, 0, 7.9, 1.05, 0.95, 0.6, BONE, { finish: 'bone' });
        for (const v of [-0.4, 0.4]) F.cyl(-5.1, v, 8.3, 0.24, 0.12, '#160f0c', { seg: 6 });
        F.box(-6.4, 0, 7.75, 0.6, 0.9, 0.3, BONE, { bevel: false, finish: 'bone' });
        rivets(F, [[4.6, 4.2], [4.6, -4.2], [-3, 4.6], [-3, -4.6], [-8, 3.8], [-8, -3.8], [8.6, 5], [8.6, -5], [0.6, 6.4], [0.6, -6.4]], 7.4);
        drum(F.at(-10.6, 0, 0, Math.PI / 2), -2.4, 0, 5.2, 4, 0.7, '#55584a'); drum(F.at(-10.6, 0, 0, Math.PI / 2), 2.4, 0, 5.2, 4, 0.7, '#4c4f42');
    },

    // rotating rocket rack of the launcher truck
    rack(s) {
        const F = new Fr(s);
        F.cyl(0, 0, 0, 2.6, 0.8, DARK, { seg: 14 });
        F.box(0, 0, 0.8, 8, 7, 0.6, STEEL, { bevel: 0.2, finish: 'metal' });
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
            const v = -2.2 + i * 2.2, z = 2.1 + j * 1.5;
            F.rod(-3.8, v, z, 3.6, v, z + 0.5, 0.92, 0.92, P, { finish: 'paint', seg: 10 });
            F.rod(3.6, v, z + 0.5, 4.4, v, z + 0.56, 0.62, 0.2, '#a3301f', { finish: 'paint', seg: 8 });
        }
        for (const u of [-2.6, 2.4]) F.box(u, 0, 1.3, 0.5, 7.4, 3.4, DARK, { bevel: false });
    }
};

// Turrets: pivot at the origin, barrel length in hull half-lengths
export function ironcladTurret(s, barrel, boss) {
    const F = new Fr(s);
    F.cyl(0, 0, -0.2, 4.4, 0.6, DARK, { seg: 20 });
    F.slab([[6.2, -2.4], [6.2, 2.4], [3, 5.2], [-4.8, 4.6], [-6, 1.6], [-6, -1.6], [-4.8, -4.6], [3, -5.2]], 0.3, 3.8, P, { inset: 1.3, shift: -0.3, bevel: 0.5 });
    F.rbox(5.6, 0, 0.7, 2.2, 4.2, 2.8, tint(DARK, 10), { radius: 0.7, bevel: 0.3 });
    const tip = (0.3 + barrel) * 10;
    gun(F, 6, 0, 2.2, tip - 6 - 1.8, boss ? 1.05 : 0.8, { evac: barrel > 1.3, brake: 2.2, color: '#34362f' });
    if (boss) for (const sd of [1, -1]) F.rod(6, sd * 2.6, 2.6, 12.5, sd * 2.6, 2.6, 0.38, 0.32, '#161614', { seg: 8 });
    F.cyl(-1.6, 1.9, 3.6, 1.8, 0.9, P, { seg: 14 }); hatch(F, -1.6, 1.9, 4.5, 1.35, P);
    F.rod(-1.6, 1.9, 5.2, 2.4, 1.9, 5.4, 0.3, 0.24, '#161614');
    hatch(F, -1.2, -2.2, 3.6, 1.2, P);
    F.box(2.4, -2.4, 3.6, 1.2, 1, 0.7, GLASS, { bevel: false });
    F.rbox(-6.8, 0, 0.8, 2, 6, 2, '#4a4d3c', { radius: 0.4, bevel: 0.25 });
    for (const sd of [1, -1]) for (let i = 0; i < 2; i++) F.rod(2.4 - i * 1.2, sd * 4.5, 2, 3.4 - i * 1.2, sd * 5.3, 2.8, 0.36, 0.36, '#2a2c25', { seg: 8 });
    if (boss) { rivets(F, [[3, 3.2], [3, -3.2], [-3.6, 3], [-3.6, -3]], 3.8); for (const v of [-3.4, 3.4]) F.spike(-5.6, v, 3.2, Math.PI, 1.8, 0.9, 1.2, '#b9b2a2'); }
}

// Props
export const IRONCLAD_PROPS = {
    barrel(s) {
        const F = new Fr(s);
        F.cyl(0, 0, 0, 6.3, 9, '#b8281c', { seg: 24, finish: 'paint' });
        for (const z of [2.6, 6]) F.cyl(0, 0, z, 6.5, 0.7, '#8e1d14', { seg: 24, noTop: true, finish: 'paint' });
        F.ring(0, 0, 9, 5.9, 0.42, '#7a1810', { finish: 'paint' });
        F.cyl(0, 0, 8.6, 5.6, 0.1, '#a5241a', { seg: 24, finish: 'paint' });
        F.cyl(2.9, -2.9, 8.7, 1.0, 0.5, '#2a2622', { seg: 10 });
        F.poly([[0, -3, 8.75], [2.4, 0.4, 8.75], [1.2, 2.6, 8.75], [0, 1.2, 8.75], [-1.2, 2.6, 8.75], [-2.4, 0.4, 8.75]], '#f2c22e');
    },
    crate(s) {
        const F = new Fr(s);
        F.box(0, 0, 0, 16.4, 16.4, 9, '#86602f', { bevel: 0.4 });
        for (let i = 0; i < 4; i++) F.box(0, -6.1 + i * 4.1, 9, 15.6, 3.5, 0.5, i % 2 ? '#a57a44' : '#9a7040', { bevel: 0.2 });
        for (const sd of [1, -1]) { F.box(sd * 7.4, 0, 9.3, 1.7, 16.6, 0.6, '#5b3d1a', { bevel: 0.2 }); F.box(0, sd * 7.4, 9.3, 16.6, 1.7, 0.6, '#5b3d1a', { bevel: 0.2 }); }
        for (const [u, v] of [[7.4, 7.4], [-7.4, 7.4], [7.4, -7.4], [-7.4, -7.4]]) F.box(u, v, 9.6, 2.6, 2.6, 0.5, '#3a3c38', { bevel: 0.15, finish: 'metal' });
        F.cyl(0, 0, 9.5, 3.6, 0.35, '#f2cf3e', { seg: 20, finish: 'paint' });
    }
};
