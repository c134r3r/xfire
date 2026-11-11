// ============================================
// Survivors buildings (see buildings.js for the parts)
// signature: (s, ft, pal, frame, team); frame 1 = lights / motion
// ============================================
import { tint, withAlpha } from './kit.js';
import { Fr } from './parts.js';
import { pad, hazard, block, windows, door, acUnit, vent, sandbags, mast, silo, stack, pipe, flagpole, barrels, lamp,
    CONC, CONC_D, TAR, STEEL, DARK, GLASS, SAND, RUST, HAZ_Y, HAZ_K, crate, drum, jerry } from './buildings.js';

export const SURV_BUILDINGS = {
    // Outpost: two-storey command bunker, ops room on top, comms mast
    hq(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1, wall = pal.hull;
        pad(F, a, team, { seed: 1 });
        hazard(F, -a * 0.1, a * 0.5, a - 1.2);
        block(F, -2, -4, 0, 70, 58, 15, wall, { batter: 1.2, band: team });
        windows(F, 's', -34, 6, 24.2, 6.5, 10.5, lit);
        windows(F, 'e', -28, 20, 32.4, 6.5, 10.5, lit);
        // entrance bay with canopy and blast door
        F.box(20, 26.5, 0, 16, 5, 11, tint(wall, -6), { bevel: 0.4 });
        door(F, 's', 20, 28.6, 8, 7.5, { color: '#3a3e33' });
        F.box(20, 31, 9.4, 13, 5, 0.7, CONC_D, { bevel: 0.2 });
        lamp(F, 20, 30.8, 8.2, '#ffe2a0', lit, 0.6);
        // ops room: glazed upper storey with a walkway
        block(F, -10, -8, 15.2, 38, 32, 10, tint(wall, 6), { plinth: false, batter: 0.6, band: team });
        windows(F, 's', -27, 7, 7.5, 19, 22.6, lit, { n: 6 });
        windows(F, 'e', -21, 5, 8.5, 19, 22.6, lit, { n: 5 });
        // roof plant
        acUnit(F, 20, -18, 16.7); acUnit(F, 20, -6, 16.7, 0.8);
        vent(F, 26, 8, 16.7, 3); vent(F, 14, 12, 16.7, 2.2, 0.8);
        F.box(-22, 18, 16.7, 6, 5, 3, '#5d6156', { bevel: 0.3 });               // stairwell head
        F.box(-22, 20.6, 17, 2.6, 0.2, 2.4, DARK, { bevel: false, cast: false });
        // radar dish on the ops roof + lattice mast with microwave drums
        F.cyl(-14, -12, 26.7, 2.2, 1.2, STEEL, { seg: 12, finish: 'metal' });
        s.dish(...F.p(-14, -12), 33.5, 5.4, '#b9bcb4');
        mast(F, -31, -27, 15.2, 36, { w: 3.4, tip: 7 });
        for (const [z, ang] of [[40, 0.4], [34, 2.2]]) F.rod(-31 + Math.cos(ang) * 1.6, -27 + Math.sin(ang) * 1.6, z, -31 + Math.cos(ang) * 3.4, -27 + Math.sin(ang) * 3.4, z, 1.5, 1.5, '#c8c9c2', { finish: 'paint', seg: 12 });
        lamp(F, -31, -27, 57.6, lit ? '#ff4433' : '#7a1c12', lit, 1.1);
        flagpole(F, 4, -22, 26.7, team, 1.1);
        // yard: checkpoint sandbags, generator, stores
        sandbags(F, [[30, 40], [42, 40], [42, 30]], 2);
        sandbags(F, [[2, 40], [10, 40]], 2);
        F.box(-34, 36, 0.6, 9, 6, 5, '#59603f', { bevel: 0.4 });                // generator
        F.box(-34, 39.1, 2, 6, 0.2, 2.4, DARK, { bevel: false, cast: false });
        F.rod(-37, 36, 5.6, -37, 36, 8.6, 0.5, 0.5, RUST);
        barrels(F, 40, -10, 4);
        crate(F, -18, 38, 0.6, 5.5, 5, 4, '#7c6238'); crate(F, -12.5, 39, 0.6, 4.4, 4, 3, '#6a5330', 0.2);
        crate(F, -17.4, 38.2, 4.6, 4, 3.6, 2.6, '#84683c', -0.15);
    },

    // Power station: generator hall, fuel tanks, stack, transformer yard
    powerStation(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1, wall = pal.hull;
        pad(F, a, team, { seed: 2 });
        block(F, -14, 6, 0, 42, 46, 13, wall, { batter: 1, band: team });
        windows(F, 'e', -10, 22, 7.4, 6, 9.6, lit, { n: 4 });
        door(F, 's', -18, 29.4, 9, 8, { roller: true, color: '#4a4f40' });
        hazard(F, -24, -11, 33.2, 0.74, 1.6);
        // turbine exhaust housings on the roof
        for (const y of [-6, 8]) {
            F.prism([[-6, 0], [6, 0], [6, 2.6], [3, 4.6], [-3, 4.6], [-6, 2.6]], 9, '#666a5c', { u: -18, v: y, z: 14.7, bevel: 0.4 });
            for (let i = 0; i < 4; i++) F.box(-18, y - 3 + i * 2, 19.3, 5, 0.6, 0.3, DARK, { bevel: false, cast: false });
        }
        vent(F, -2, 22, 14.7, 3.4, 1.1); acUnit(F, -3, -10, 14.7, 0.8);
        stack(F, -32, -32, 40, 3.2, lit);
        // fuel farm
        silo(F, 27, -28, 8, 20, '#8f928a', team);
        silo(F, 8, -34, 6.4, 15, '#858980', null);
        pipe(F, [[19, -28, 4], [14, -28, 4], [14, -6, 4], [7, -6, 4]], 0.9);
        pipe(F, [[8, -27.6, 3], [8, -22, 3], [-2, -22, 3], [-2, -17, 3]], 0.75, '#7a5236');
        F.box(14, -18, 0.6, 3, 3, 4.6, '#6b3a26', { bevel: 0.3 });               // pump
        // transformer yard behind a low kerb
        F.box(28, 22, 0.6, 30, 34, 0.5, '#5a584f', { bevel: 0.2, finish: 'ground' });
        for (const y of [10, 22, 34]) {
            F.box(28, y, 1.1, 9, 7, 6.5, '#5f665a', { bevel: 0.5 });
            for (let i = -2; i <= 2; i++) F.box(28 + 4.7, y + i * 1.3, 2, 0.5, 0.7, 4.6, '#4b5147', { bevel: false });   // cooling fins
            for (const dx of [-2.6, 0, 2.6]) {
                F.rod(28 + dx, y, 7.6, 28 + dx, y, 11, 0.55, 0.3, '#9c5a34', { seg: 8, finish: 'paint' });
                for (const z of [8.4, 9.4, 10.2]) F.cyl(28 + dx, y, z, 0.8, 0.25, '#b4b0a2', { seg: 8 });
            }
        }
        for (const dx of [-2.6, 0, 2.6]) F.rod(28 + dx, 10, 11, 28 + dx, 34, 11, 0.12, 0.12, '#1c1c1a', { seg: 4 });
        lamp(F, 41, 38, 0.6, lit ? '#ffd24a' : '#806214', lit, 0.7);
        barrels(F, -38, 36, 3);
    },

    // Oil derrick: lattice tower over the well, nodding pumpjack
    derrick(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1;
        pad(F, a, team, { seed: 3 });
        F.disc(8, 10, 0.75, 9, 'rgba(10,8,6,0.5)', { stretchX: 1.3 });           // spilled crude
        // tower
        mast(F, -8, -8, 0.6, 46, { w: 9, tip: 3, color: '#4f524b' });
        F.box(-8, -8, 46.6, 5, 5, 1.6, '#5a5d55', { bevel: 0.3 });               // crown block
        lamp(F, -8, -8, 50.5, lit ? '#ff5533' : '#8a1e12', lit, 1);
        F.box(-8, -8, 0.6, 15, 15, 1.6, '#55584f', { bevel: 0.3, finish: 'metal' });  // drill floor
        F.rod(-8, -8, 2, -8, -8, 46, 0.5, 0.5, '#2f302b', { seg: 6 });           // drill string
        F.box(-8, -8, 12, 3, 3, 3, HAZ_Y, { bevel: 0.3 });                       // travelling block
        // pumpjack: samson post, walking beam, horsehead, counterweight
        const tilt = frame === 0 ? 3.2 : -2.6;
        const P = F.at(13, 13, 0.6, -Math.PI / 4);
        P.prism([[-3, 0], [3, 0], [0.7, 11], [-0.7, 11]], 3, '#565a50', { bevel: 0.3 });
        P.rod(-9, 0, 11.6 - tilt, 9, 0, 11.6 + tilt, 0.9, 0.9, team, { finish: 'paint', seg: 8 });
        P.prism([[8, 8 + tilt], [11.4, 9 + tilt], [12, 13 + tilt], [9, 14.6 + tilt]], 1.8, team, { bevel: 0.3 });
        P.rod(11.2, 0, 9 + tilt, 11.2, 0, 1, 0.3, 0.3, '#1e1e1b', { seg: 5 });
        P.cyl(11.2, 0, 0, 1.4, 2.4, '#3c3d37', { seg: 12, finish: 'metal' });    // wellhead
        P.rod(-9, 0, 11.6 - tilt, -8, 0, 4.4 - tilt * 0.4, 0.4, 0.4, '#2c2d28', { seg: 6 });
        P.rbox(-7.6, 0, 1.6 - tilt * 0.4, 4.4, 3.4, 4, '#3f423a', { radius: 1.2 });     // counterweight
        P.box(-4, 0, 0, 5, 3.6, 3.4, '#6b3a26', { bevel: 0.4 });                 // motor
        // storage tank + flow line + shed
        silo(F, 19, -18, 5.4, 11, '#8a8d84', team);
        pipe(F, [[19, 10, 1.6], [19, -6, 1.6], [19, -12.6, 1.6]], 0.7, '#7a5236');
        block(F, -19, 20, 0, 10, 9, 7, pal.hull, { parapet: 0.6 });
        door(F, 'e', 20, -14.2, 3.4, 5);
        barrels(F, -6, 24, 3);
    },

    // Barracks: corrugated Quonset hut, sandbagged entrance
    barracks(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1;
        pad(F, a, team, { seed: 4 });
        const R = 11.5, L = 46, cy = -5;
        // concrete footing + half-barrel shell with corrugation ribs
        F.box(0, cy, 0.6, L + 1.4, R * 2 + 1.4, 1.2, CONC_D, { bevel: 0.3, finish: 'ground' });
        const arc = (r, n = 14) => Array.from({ length: n + 1 }, (_, i) => [Math.cos(Math.PI * i / n) * r, Math.sin(Math.PI * i / n) * r]);
        const H = F.at(0, cy, 1.8, Math.PI / 2);
        H.prism(arc(R), L, pal.roof, { bevel: 0.3 });
        for (let x = -L / 2 + 2.2; x < L / 2; x += 3.1) H.prism(arc(R + 0.22), 0.7, tint(pal.roof, x % 2 > 1 ? -9 : 7), { v: -x, bevel: 0.1 });
        H.prism(arc(R + 0.3), 3, team, { v: -L / 2 + 6, bevel: 0.1 });
        // east end wall: door, windows, lamp
        H.prism(arc(R - 0.5), 0.6, tint(pal.hull, 4), { v: -L / 2 - 0.1, bevel: 0.1 });
        door(F, 'e', cy, L / 2 + 0.1, 5, 7.4, { color: '#3c4034' });
        for (const dy of [-6.4, 6.4]) { F.box(L / 2 + 0.5, cy + dy, 4.2, 0.4, 3, 2.6, lit ? '#ffd98a' : GLASS, { bevel: false, finish: 'glass', cast: false }); }
        lamp(F, L / 2 + 1, cy, 9.6, '#ffe2a0', lit, 0.55);
        // south side: dormer windows, stove pipe
        for (const x of [-14, -2, 10]) {
            F.box(x, cy + R * 0.86, 5.2, 5, 2.4, 3.4, tint(pal.roof, -6), { bevel: 0.2 });
            F.box(x, cy + R * 0.86 + 1.25, 5.8, 3.6, 0.2, 2.2, lit && x !== -2 ? '#ffd98a' : GLASS, { bevel: false, finish: 'glass', cast: false });
        }
        F.rod(-16, cy - 2, R + 1, -16, cy - 2, R + 6.4, 0.6, 0.6, RUST);
        F.cyl(-16, cy - 2, R + 6.4, 1, 0.5, DARK, { seg: 8, rTop: 0.3 });
        // parade ground kit
        sandbags(F, [[28, 6], [28, 14], [20, 14]], 2);
        sandbags(F, [[-24, 14], [-10, 14]], 2);
        flagpole(F, -26, -26, 0.6, team, 1.05);
        crate(F, 24, -24, 0.6, 5.5, 5, 4); crate(F, 18.6, -25, 0.6, 4.2, 4, 3, '#6a5330', 0.2);
        for (const x of [0, 5, 10]) F.prism([[-2, 0], [2, 0], [0, 3]], 4.4, '#6f684a', { u: x, v: 22, z: 0.6, bevel: 0.15, rot: 0 });   // pup tents
        barrels(F, -27, 22, 2);
    },

    // Factory: assembly hall, sawtooth north-lights, vehicle gate
    factory(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1, wall = pal.hull;
        pad(F, a, team, { seed: 5 });
        hazard(F, 0, 30, a - 1.2);
        block(F, -2, -4, 0, 74, 60, 15, wall, { batter: 1, roof: false });
        F.box(-2, 26.2, 11.4, 72.4, 0.5, 2.2, team, { bevel: false });           // team frieze
        F.box(35.2, -4, 11.4, 0.5, 58.4, 2.2, team, { bevel: false });
        // sawtooth roof: four bays, north-light glazing on the steep side
        for (let i = 0; i < 4; i++) {
            const x0 = -38.6 + i * 18.1;
            F.prism([[0, 0], [18, 0], [15.2, 7.6]], 57.6, pal.roof, { u: x0, v: -4, z: 15, bevel: 0.25 });
            F.box(x0 + 16.7, -4, 16, 0.35, 54, 5, lit ? '#b8d8e0' : '#5f8794', { bevel: false, finish: 'glass', cast: false, rot: 0 });
            for (let k = -3; k <= 3; k++) F.box(x0 + 16.8, -4 + k * 7.8, 15.6, 0.5, 0.5, 6, '#3d4037', { bevel: false, cast: false });
        }
        // vehicle gate with gantry beam and warning lamp
        F.box(16, 26.3, 0.6, 28, 1.6, 13, tint(wall, -8), { bevel: 0.3 });
        door(F, 's', 16, 26.9, 22, 10.5, { roller: true, color: frame === 1 ? '#565b49' : '#4a4f40' });
        for (let i = 0; i < 9; i++) F.poly([[4.4 + i * 2.6, 27.9, 11.4], [5.7 + i * 2.6, 27.9, 11.4], [7 + i * 2.6, 27.9, 12.9], [5.7 + i * 2.6, 27.9, 12.9]], i % 2 ? HAZ_K : HAZ_Y);
        lamp(F, 30.5, 27.6, 13.2, lit ? '#ffaa33' : '#8a5210', lit, 0.8);
        windows(F, 'e', -28, 22, 35.4, 6, 10, lit, { n: 7 });
        windows(F, 's', -36, -2, 26.4, 6, 10, lit, { n: 5 });
        stack(F, -38, -36, 38, 2.8, lit);
        // annex + overhead crane rail out front
        block(F, 40, -26, 0, 10, 14, 9, tint(wall, -4), { parapet: 0.8 });
        pipe(F, [[40, -19, 6], [40, -10, 6], [36, -10, 6]], 0.8);
        // yard stores: hull plates, track sections, drums
        for (let i = 0; i < 3; i++) F.box(-30 + i * 0.6, 38 - i * 0.3, 0.6 + i * 0.7, 12, 7, 0.6, i % 2 ? '#55594c' : '#4a4d43', { bevel: 0.15, finish: 'metal', rot: 0.08 * i });
        for (let i = 0; i < 4; i++) F.rod(-14, 34 + i * 1.7, 1.4, -6, 34 + i * 1.7, 1.4, 0.8, 0.8, '#2b2a27', { finish: 'rubber', seg: 8 });
        barrels(F, 40, 6, 4); crate(F, 40, 20, 0.6, 6, 6, 4.4);
    },

    // Research lab: observatory dome, instrument mast, clean annex
    researchLab(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1, wall = pal.hull;
        pad(F, a, team, { seed: 6 });
        block(F, -1, -1, 0, 44, 38, 10, wall, { batter: 0.8, band: team });
        windows(F, 's', -20, 4, 17.4, 4, 7.2, lit, { n: 4 });
        windows(F, 'e', -16, 14, 20.4, 4, 7.2, lit, { n: 5 });
        door(F, 's', 12, 17.6, 5, 6.6);
        // dome on a drum, shutter slit and telescope
        F.cyl(-7, -5, 11.7, 11.6, 3, '#9a9c94', { seg: 28 });
        F.cyl(-7, -5, 13.2, 11.75, 0.8, team, { seg: 28, noTop: true });
        F.blob(-7, -5, 14.7, 11.4, 10.6, '#c2c5bd', { finish: 'paint' });
        for (const ang of [0.3, 1.35, 2.4]) s.rib(...F.p(-7, -5), 14.7, 11.45, 10.65, ang, '#a2a59d');
        const D = F.at(-7, -5, 14.7, Math.PI / 4);
        D.prism([[2, 9.2], [10.6, 2.2], [11.6, 3.4], [3.4, 10.9], [-1, 11.4], [-1.4, 10.2]], 3.4, '#15171a', { bevel: 0.2 });
        D.rod(1, 0, 6.5, 8.6, 0, 11.8, 1.2, 1.4, '#3d4046');
        s.glow(...F.p(-7 + 4.6, -5 + 4.6), 14.7 + 10, frame ? 1.1 : 0.7, frame ? '#9fe8ff' : '#4a9ab8');
        // roof instruments
        mast(F, 15, 12, 11.7, 16, { w: 1.8, tip: 5, color: '#55584f' });
        s.dish(...F.p(15, 12), 24, 3.4, '#b9bcb4');
        acUnit(F, 14, -10, 11.7, 0.8);
        for (const [x, y] of [[8, 13], [11.5, 13]]) F.box(x, y, 11.7, 2.6, 3.6, 0.5, '#1c2c44', { bevel: false, finish: 'glass', rot: 0 });   // solar panels
        // yard: gas bottles, sample crates
        for (let i = 0; i < 3; i++) { F.rod(26, -20 + i * 2.4, 0.6, 26, -20 + i * 2.4, 6.2, 0.95, 0.95, i === 1 ? '#3a5a78' : '#9aa0a0', { seg: 10, finish: 'paint' }); F.sphere(26, -20 + i * 2.4, 6.2, 0.95, '#555', { finish: 'metal' }); }
        crate(F, -24, 26, 0.6, 5, 5, 3.6, '#84683c'); barrels(F, 22, 24, 2);
    },

    // Repair bay: gantry crane over a service pit
    repairBay(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1;
        pad(F, a, team, { seed: 7 });
        // inspection pit with hazard border
        F.box(0, 2, 0.62, 30, 18, 0.2, '#20201d', { bevel: false, finish: 'ground', cast: false });
        F.box(0, 2, 0.7, 24, 4.4, 0.2, '#0c0c0b', { bevel: false, cast: false });
        hazard(F, -15, 15, 12.4, 0.86, 1.4); hazard(F, -15, 15, -7, 0.86, 1.4);
        // crane: two braced portal frames, runway beams, travelling hoist
        for (const sx of [-1, 1]) {
            for (const y of [-20, 22]) {
                F.box(sx * 22, y, 0.6, 3.4, 3.4, 1.4, CONC_D, { bevel: 0.3, finish: 'ground' });
                F.box(sx * 22, y, 2, 2, 2, 19, '#59603f', { bevel: 0.3 });
            }
            F.box(sx * 22, 1, 20.5, 2.6, 46, 2.2, team, { bevel: 0.3 });          // runway beam
            F.rod(sx * 22, -20, 4, sx * 22, 1, 20, 0.5, 0.5, '#4b5137', { seg: 6 });
            F.rod(sx * 22, 22, 4, sx * 22, 1, 20, 0.5, 0.5, '#4b5137', { seg: 6 });
        }
        const by = frame === 0 ? 4 : -4;
        F.box(0, by, 22.7, 47, 4.2, 2.6, HAZ_Y, { bevel: 0.3 });                 // bridge
        for (let i = -4; i <= 4; i++) F.box(i * 5, by + 2.15, 23, 1.6, 0.12, 2, HAZ_K, { bevel: false, cast: false });
        F.box(3, by, 21.4, 5, 5, 1.6, '#3a3c38', { bevel: 0.3, finish: 'metal' });   // trolley
        F.rod(3, by, 21.4, 3, by, 11, 0.22, 0.22, '#1e1e1b', { seg: 5 });
        F.box(3, by, 9.6, 1.8, 1.8, 1.6, HAZ_Y, { bevel: 0.3 });
        s.ring(...F.p(3, by), 8.4, 1.1, 0.3, '#2a2826', { tiltX: Math.PI / 2, arc: Math.PI * 1.5 });
        lamp(F, 22, 22, 22.7, lit ? '#ffcc33' : '#7a5c10', lit, 0.8);
        // workshop kit: tool cabinet, welding set, tyre stack, engine on a stand
        F.box(-22, -27, 0.6, 9, 4, 7, '#7a2f22', { bevel: 0.3 });
        for (const z of [2.4, 4.4]) F.box(-22, -24.95, z, 8, 0.12, 0.3, DARK, { bevel: false, cast: false });
        for (const dx of [0, 2.3]) { F.rod(26 + dx, -26, 0.6, 26 + dx, -26, 6.6, 0.95, 0.95, dx ? '#3a5a78' : '#a33a2a', { seg: 10, finish: 'paint' }); }
        for (let i = 0; i < 3; i++) F.cyl(-25, 26, 0.6 + i * 1.5, 2.6, 1.4, '#22201d', { finish: 'rubber', seg: 16 });
        F.box(22, 28, 0.6, 5, 4, 3.6, '#3d4037', { bevel: 0.6, finish: 'metal' });
        crate(F, 4, 27, 0.6, 5, 4.4, 3.4); jerry(F, 9, 27, 0.6, '#59603f'); jerry(F, 11, 27.4, 0.6, '#7a2f22');
        barrels(F, -8, -28, 2);
    },

    // Guard tower: concrete shaft, sandbagged gun platform (mount z 22)
    tower(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1;
        F.box(0, 0, -1, a * 1.86, a * 1.86, 1.6, '#7c7a6e', { bevel: 0.4, finish: 'ground' });
        F.slab([[-7.4, -7.4], [7.4, -7.4], [7.4, 7.4], [-7.4, 7.4]], 0.6, 17, pal.hull, { inset: 1.4, bevel: 0.5 });
        F.box(0, 0, 0.6, 16, 16, 1.8, CONC_D, { bevel: 0.4, finish: 'ground' });
        F.box(0, 6.6, 9.5, 5, 0.5, 1.2, '#0e0f0d', { bevel: false, cast: false });   // firing slits
        F.box(6.6, 0, 9.5, 0.5, 5, 1.2, '#0e0f0d', { bevel: false, cast: false });
        F.box(0, 6.25, 12.6, 12.4, 0.4, 1.6, team, { bevel: false });
        F.box(6.25, 0, 12.6, 0.4, 12.4, 1.6, team, { bevel: false });
        door(F, 's', -2.5, 7.3, 3, 5.4);
        // corbelled platform and sandbag parapet
        F.slab([[-6, -6], [6, -6], [6, 6], [-6, 6]], 17, 19.2, tint(pal.hull, 4), { top: [[-9.6, -9.6], [9.6, -9.6], [9.6, 9.6], [-9.6, 9.6]], bevel: false });
        F.box(0, 0, 19.2, 19.2, 19.2, 1.2, CONC, { bevel: 0.3, finish: 'ground' });
        sandbags(F, [[-8.4, -8.4], [8.4, -8.4], [8.4, 8.4], [-8.4, 8.4], [-8.4, -8.4]], 1, 20.2);
        // ladder + lamp
        for (const dx of [-0.8, 0.8]) F.rod(7.6, 3.4 + dx, 0.6, 9.9, 3.4 + dx, 19.4, 0.16, 0.16, DARK, { seg: 4 });
        for (let k = 1; k < 10; k++) F.rod(7.6 + k * 0.23, 2.6, 0.6 + k * 1.88, 7.6 + k * 0.23, 4.2, 0.6 + k * 1.88, 0.12, 0.12, DARK, { seg: 4 });
        lamp(F, -8.6, 8.6, 21.4, lit ? '#ffe2a0' : '#7a6a40', lit, 0.6);
        sandbags(F, [[-13, 12.5], [-4, 13.5]], 2); sandbags(F, [[13, -4], [13, 6]], 2);
    },

    // Cannon tower: thick-walled octagonal casemate (mount z 21)
    towerHeavy(s, ft, pal, frame, team) {
        const F = new Fr(s), a = ft * 16, lit = frame === 1;
        F.box(0, 0, -1, a * 1.86, a * 1.86, 1.6, '#7c7a6e', { bevel: 0.4, finish: 'ground' });
        const oct = (r) => Array.from({ length: 8 }, (_, i) => [Math.cos((i + 0.5) * Math.PI / 4) * r, Math.sin((i + 0.5) * Math.PI / 4) * r]);
        F.slab(oct(14.6), 0.6, 3, CONC_D, { inset: 0.6, bevel: 0.4, finish: 'ground' });
        F.slab(oct(13.6), 3, 15.5, pal.hull, { inset: 2.4, bevel: 0.6 });
        F.slab(oct(11.6), 11.2, 13, team, { inset: 0.35, bevel: false });
        // embrasures and steel door
        for (const [x, y, w, d] of [[0, 11.2, 5, 0.6], [11.2, 0, 0.6, 5]]) F.box(x, y, 7, w, d, 1.5, '#0e0f0d', { bevel: false, cast: false });
        F.box(7.6, 7.6, 3, 3.2, 0.6, 5.4, '#3a3e33', { bevel: false, rot: -Math.PI / 4 });
        // barbette ring
        F.cyl(0, 0, 15.5, 8.6, 3.6, tint(pal.hull, 5), { seg: 24 });
        F.cyl(0, 0, 19.1, 7.2, 1.2, '#4d5147', { seg: 24, finish: 'metal' });
        for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; F.cyl(Math.cos(an) * 7.9, Math.sin(an) * 7.9, 19.1, 0.4, 0.4, '#2c2d28', { seg: 6 }); }
        lamp(F, 9.6, -9.6, 15.2, lit ? '#ff4433' : '#7a1c12', lit, 0.6);
        sandbags(F, [[-13.5, 11], [-6, 14]], 2);
        for (const [x, y] of [[13.5, 9], [-13, -13]]) F.prism([[-1.6, 0], [1.6, 0], [0, 3.2]], 3.6, CONC, { u: x, v: y, z: 0.6, bevel: 0.2, finish: 'ground' });   // dragon's teeth
    },

    // Neutral tech bunker: frame 0 = sealed, 1 = looted
    bunker(s, ft, pal, frame) {
        const F = new Fr(s), a = ft * 16, con = '#8c877a';
        F.box(0, 0, -1, a * 1.9, a * 1.9, 1.7, '#77736a', { bevel: 0.5, finish: 'ground' });
        F.blob(0, -2, 0.6, a * 0.62, 16, tint(con, -4), { finish: 'ground' });
        for (const ang of [0.5, 1.6, 2.6]) s.rib(...F.p(0, -2), 0.6, a * 0.625, 16.1, ang, tint(con, -16));
        // blast door portal
        F.box(a * 0.15, a * 0.46, 0.6, a * 0.78, 8, 10.5, tint(con, -8), { bevel: 0.5, finish: 'ground', inset: 0.6 });
        F.box(a * 0.15, a * 0.46 + 4, 0.8, 13, 0.5, 7.6, frame === 0 ? '#3a3d38' : '#0c0b09', { bevel: false, cast: false, finish: 'metal' });
        if (frame === 0) {
            F.box(a * 0.15, a * 0.46 + 4.3, 0.8, 0.4, 0.2, 7.6, '#1d1e1b', { bevel: false, cast: false });
            F.cyl(a * 0.15 - 3, a * 0.46 + 4.2, 4, 1.2, 0.01, '#55584f', { seg: 10 });
            for (let i = 0; i < 5; i++) F.poly([[a * 0.15 - 6.5 + i * 2.6, a * 0.46 + 4.35, 8.6], [a * 0.15 - 5.2 + i * 2.6, a * 0.46 + 4.35, 8.6], [a * 0.15 - 3.9 + i * 2.6, a * 0.46 + 4.35, 10], [a * 0.15 - 5.2 + i * 2.6, a * 0.46 + 4.35, 10]], i % 2 ? HAZ_K : '#d8b03c');
            F.rod(-6, -8, 13, -6, -8, 30, 0.4, 0.25, '#4a4740', { seg: 6 });
            s.glow(...F.p(-6, -8), 31, 1.8, '#66e0ff');
            s.glow(...F.p(a * 0.15, a * 0.46 + 4.6), 4.6, 1.2, '#66e0ff');
        } else {
            F.box(a * 0.15 + 9, a * 0.46 + 7, 0.6, 12, 0.6, 7, '#3a3d38', { bevel: false, finish: 'metal', rot: 0.9 });   // door torn off
            F.rod(-6, -8, 13, -1, -4, 19, 0.4, 0.3, '#4a4740', { seg: 6 });
        }
        vent(F, -a * 0.3, -a * 0.2, 13.4, 3, 1.2);
        sandbags(F, [[-a * 0.8, a * 0.5], [-a * 0.45, a * 0.8]], 2);
        sandbags(F, [[a * 0.85, -a * 0.2], [a * 0.8, a * 0.3]], 1);
    }
};
