// ============================================
// 3D model definitions (ported from the game's procedural sprite
// builders, same coordinates and mounts, extended for real geometry).
// signature: (s: Kit3D, yaw, palette, faction, team, frame)
// ============================================
import { TEAM, tint, withAlpha, fwd, rot } from './kit.js';

const shade = (c) => c;
// ============================================
// INFANTRY
// ============================================

function infantry(s, yaw, pal, faction, team, weapon, frame) {
    const walk = frame > 0;
    const ph = (frame - 1) * Math.PI / 2;
    const stride = walk ? Math.sin(ph) * 3.2 : 0;
    const lift = walk ? Math.max(0, Math.cos(ph)) * 1.2 : 0;
    const bob = walk ? Math.abs(Math.sin(ph)) * 0.6 : 0;
    s.shadow(0, 0, 5.5, 0.4);

    const robot = faction === 'series9', mutant = faction === 'evolved';
    const legCol = robot ? pal.metalDark : (mutant ? tint(pal.cloth, -10) : pal.cloth);
    const bootCol = robot ? '#2a2e33' : '#2b241c';
    // legs
    for (const [sideOff, st, lf] of [[1.4, stride, lift], [-1.4, -stride, walk ? Math.max(0, -Math.cos(ph)) * 1.2 : 0]]) {
        const hip = fwd(yaw, 0, sideOff);
        const foot = fwd(yaw, st, sideOff * 1.15);
        s.tube(hip.x, hip.y, 8 + bob, foot.x, foot.y, 1.2 + lf, robot ? 1.1 : 1.25, legCol);
        s.box(foot.x, foot.y, lf, 3, 2, 1.6, yaw, bootCol, { bevel: false, grime: false });
    }
    // backpack / tank
    const back = fwd(yaw, -2.4);
    if (weapon === 'flame') {
        s.cyl(back.x, back.y, 7.5 + bob, 1.7, 7, robot ? pal.metal : '#9a4a22', { band: [2, 3, team] });
    } else {
        s.box(back.x, back.y, 9 + bob, 2.4, 4.2, 4.5, yaw, robot ? pal.metalDark : tint(pal.cloth, -15), { inset: 0.4 });
    }
    // torso
    const torsoCol = robot ? pal.hull : (mutant ? pal.skin : pal.hull);
    s.box(0, 0, 7.5 + bob, 4.2, 6, 6.5, yaw, torsoCol, { inset: 0.6, band: [3.6, 5.2, team] });
    // shoulders
    for (const so of [3.4, -3.4]) {
        const sh = fwd(yaw, 0.2, so);
        if (mutant) s.spike(sh.x, sh.y, 13 + bob, yaw + Math.sign(so) * 1.4, 3, 2, 3, pal.accent);
        else s.sphere(sh.x, sh.y, 13 + bob, 1.8, so > 0 ? team : tint(team, -20));
    }
    // head
    const hz = 17 + bob;
    if (robot) {
        s.box(0, 0, hz - 2.5, 3.6, 3.6, 3.6, yaw, pal.metal, { inset: 0.3 });
        const eye = fwd(yaw, 1.9);
        s.glow(eye.x, eye.y, hz - 0.6, 0.9, pal.glow);
    } else {
        s.sphere(0, 0, hz, 2.6, mutant ? pal.skin : '#d6a67a');
        if (faction === 'survivors') {
            // helmet with team stripe
            s.blob(0, 0, hz + 0.2, 2.5, 2.6, pal.hullDark, { finish: 'paint' });
            s.ring(0, 0, hz + 0.35, 2.45, 0.32, team, { finish: 'paint' });
        } else {
            // mohawk crest
            const a = fwd(yaw, -2), b = fwd(yaw, 2);
            s.tube(a.x, a.y, hz + 2.2, b.x, b.y, hz + 2.6, 0.8, '#c8321e');
        }
    }
    // weapon, held at the hip, pointing forward
    const g0 = fwd(yaw, 0.5, 2.2), g1 = fwd(yaw, 9, 1.6);
    if (weapon === 'rifle') {
        s.tube(g0.x, g0.y, 10 + bob, g1.x, g1.y, 10.5 + bob, 0.85, robot ? pal.metalDark : '#2e2b26');
        const st = fwd(yaw, 3, 2.1);
        s.box(st.x, st.y, 9 + bob, 3, 1.4, 1.6, yaw, '#4a3a28', { bevel: false });
    } else if (weapon === 'flame') {
        s.tube(g0.x, g0.y, 10 + bob, g1.x, g1.y, 10 + bob, 1.05, '#3a3632');
        s.glow(g1.x, g1.y, 10 + bob, 1.1, robot ? pal.glow : '#ff8a2a');
    } else if (weapon === 'rocket') {
        const r0 = fwd(yaw, -4, 2.2), r1 = fwd(yaw, 7, 2.2);
        s.tube(r0.x, r0.y, 15 + bob, r1.x, r1.y, 15.5 + bob, 1.7, robot ? pal.metal : '#5b6044');
        s.tube(r1.x, r1.y, 15.5 + bob, fwd(yaw, 8, 2.2).x, fwd(yaw, 8, 2.2).y, 15.6 + bob, 1.9, '#2a2622');
        const warhead = fwd(yaw, 8.6, 2.2);
        s.sphere(warhead.x, warhead.y, 15.6 + bob, 1.2, mutant ? pal.accent : '#9b3a24');
    }
}

// ============================================
// UNIT BUILDERS
// signature: (s, yaw, pal, faction, team, frame)
// ============================================

function legsWalk(s, yaw, count, spread, reach, color, frame, z0 = 6, thick = 1.3) {
    const ph = frame * Math.PI / 2;
    for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2;
        for (const side of [-1, 1]) {
            const swing = Math.sin(ph + i * 1.9 + (side > 0 ? 0 : Math.PI)) * 1.8;
            const hip = fwd(yaw, t * spread, side * 3.5);
            const knee = fwd(yaw, t * spread + swing * 0.5, side * (reach * 0.7));
            const foot = fwd(yaw, t * (spread + 2) + swing, side * (reach + 1));
            s.tube(hip.x, hip.y, z0, knee.x, knee.y, z0 + 3, thick, color);
            s.tube(knee.x, knee.y, z0 + 3, foot.x, foot.y, 0.5, thick * 0.8, tint(color, -8));
        }
    }
}

// anti-grav emitters under hover hulls + a glow pool on the ground
function hoverGlow(s, r, glow, stretch = 1) {
    s.disc(0, 0, 0.1, r * 0.9 * stretch, withAlpha(glow, 0.22));
    for (const [x, y] of [[r * 0.5, r * 0.35], [r * 0.5, -r * 0.35], [-r * 0.5, r * 0.35], [-r * 0.5, -r * 0.35]]) {
        s.glows.push({ x: x * stretch, y, z: 1.5, r: 1.6, color: glow });
    }
}

function rider(s, x, y, z, pal, team, faction) {
    s.box(x, y, z, 3.2, 4.6, 5, 0, faction === 'evolved' ? pal.skin : pal.cloth, { inset: 0.5, band: [2, 3.4, team] });
    s.sphere(x, y, z + 7, 2.1, faction === 'evolved' ? pal.skin : '#d6a67a');
    if (faction === 'survivors') {
        s.blob(x, y, z + 7.3, 2.0, 2.2, TEAM, { finish: 'paint' });
    }
}

export const UNIT_BUILDERS = {
    trooper(s, yaw, pal, f, team, frame) { infantry(s, yaw, pal, f, team, 'rifle', frame); },
    flamer(s, yaw, pal, f, team, frame) { infantry(s, yaw, pal, f, team, 'flame', frame); },
    rocketeer(s, yaw, pal, f, team, frame) { infantry(s, yaw, pal, f, team, 'rocket', frame); },

    bike(s, yaw, pal, faction, team, frame) {
        s.shadow(0, 0, 9, 0.38, 1.1);
        if (faction === 'evolved') {
            // Dire Wolf: lean beast with a rider
            legsWalk(s, yaw, 2, 5.5, 4.5, pal.hullDark, frame, 6, 1.2);
            s.box(0, 0, 5, 14, 6, 5, yaw, pal.hull, { inset: 1.6, band: [2, 2.8, team] });
            const head = fwd(yaw, 8.5);
            s.box(head.x, head.y, 6.5, 6, 4.4, 4, yaw, tint(pal.hull, 8), { inset: 0.8, taper: 1.5 });
            const snout = fwd(yaw, 11.5);
            s.box(snout.x, snout.y, 6.5, 3.4, 2.8, 2.2, yaw, tint(pal.hull, -5), { inset: 0.5 });
            for (const so of [1.4, -1.4]) {
                const ear = fwd(yaw, 7.5, so);
                s.spike(ear.x, ear.y, 10, yaw + Math.PI + so * 0.5, 2.5, 1.6, 3, pal.hullDark);
            }
            const tail = fwd(yaw, -7);
            s.spike(tail.x, tail.y, 8, yaw + Math.PI, 6, 2, 2, pal.hullDark);
            const eye = fwd(yaw, 10, 1.2);
            s.glow(eye.x, eye.y, 9, 0.6, pal.glow);
            const r = fwd(yaw, -1.5);
            rider(s, r.x, r.y, 10, pal, team, faction);
        } else if (faction === 'series9') {
            // Probe: hover dart
            hoverGlow(s, 9, pal.glow);
            s.box(0, 0, 4, 18, 7, 4, yaw, pal.hull, { taper: 5, inset: 0.8, band: [1.2, 2.2, team] });
            const fin = fwd(yaw, -5);
            s.box(fin.x, fin.y, 8, 5, 1.4, 4, yaw, pal.hullDark, { taper: 3 });
            const eye = fwd(yaw, 5);
            s.glow(eye.x, eye.y, 8.5, 1.4, pal.glow);
            for (const so of [3, -3]) { const e = fwd(yaw, -8, so); s.glow(e.x, e.y, 5, 1, pal.glow); }
        } else {
            // Dirt Bike
            const f = fwd(yaw, 6.5), b = fwd(yaw, -6);
            s.wheel(b.x, b.y, 0, 3.4, 2.4, yaw);
            s.wheel(f.x, f.y, 0, 3.2, 2.2, yaw);
            s.box(0, 0, 4.5, 11, 3.6, 3.5, yaw, pal.hull, { inset: 0.6, band: [1, 2, team] });
            const tank = fwd(yaw, 2.2);
            s.box(tank.x, tank.y, 7.5, 4.5, 3.8, 2.2, yaw, team, { inset: 0.6 });
            const fork0 = fwd(yaw, 5), fork1 = fwd(yaw, 6.5);
            s.tube(fork1.x, fork1.y, 3.4, fork0.x, fork0.y, 11, 0.6, '#5a5a56');
            const bar0 = fwd(yaw, 5, 3), bar1 = fwd(yaw, 5, -3);
            s.tube(bar0.x, bar0.y, 11.5, bar1.x, bar1.y, 11.5, 0.5, '#2a2826');
            const r = fwd(yaw, -1.5);
            rider(s, r.x, r.y, 8, pal, team, faction);
            const lamp = fwd(yaw, 7.5);
            s.glow(lamp.x, lamp.y, 9, 0.6, '#ffe9a8');
        }
    },

    buggy(s, yaw, pal, faction, team, frame) {
        s.shadow(0, 0, 11, 0.4, 1.12);
        if (faction === 'evolved') {
            // Giant Beetle
            legsWalk(s, yaw, 3, 6.5, 8, pal.hullDark, frame, 5, 1.3);
            s.blob(0, 0, 4, 9.5, 10, pal.hull, { stretchX: 1.1 });
            // carapace seam + team markings
            const a = fwd(yaw, -9), b = fwd(yaw, 9);
            s.tube(a.x, a.y, 13.6, b.x, b.y, 12.5, 0.7, tint(pal.hullDark, -15));
            for (const so of [3.2, -3.2]) {
                const m = fwd(yaw, -2, so);
                s.disc(m.x, m.y, 13.2, 1.8, team);
            }
            const head = fwd(yaw, 10.5);
            s.sphere(head.x, head.y, 6, 3.6, tint(pal.hull, -10));
            for (const so of [0.5, -0.5]) s.spike(head.x, head.y, 5, yaw + so, 7, 2, 0.5, pal.accent);
            const eye = fwd(yaw, 12, 1.5);
            s.glow(eye.x, eye.y, 8, 0.8, pal.glow);
            // spine-gun on the back
            const g0 = fwd(yaw, 0), g1 = fwd(yaw, 9);
            s.tube(g0.x, g0.y, 15, g1.x, g1.y, 15.5, 1, pal.accent);
        } else if (faction === 'series9') {
            // Enforcer: hover skiff with twin emitters
            hoverGlow(s, 12, pal.glow, 1.1);
            s.box(0, 0, 4, 22, 12, 4.5, yaw, pal.hull, { taper: 4, inset: 1, band: [1.4, 2.6, team] });
            s.box(-1 * Math.cos(yaw), -1 * Math.sin(yaw), 8.5, 11, 8, 4, yaw, tint(pal.hull, 10), { taper: 2.5, inset: 0.8, topMark: [0.45, team] });
            for (const so of [3.2, -3.2]) {
                const m0 = fwd(yaw, 2, so), m1 = fwd(yaw, 12, so);
                s.tube(m0.x, m0.y, 11, m1.x, m1.y, 11, 1, pal.metalDark);
                s.glow(m1.x, m1.y, 11, 1, pal.glow);
            }
            const tail = fwd(yaw, -10);
            s.glow(tail.x, tail.y, 6, 1.4, pal.glow);
        } else {
            // ATV: open-frame buggy, roll cage and heavy MG
            for (const [lx, ly] of [[7, 6], [-7, 6], [7, -6], [-7, -6]]) {
                const w = fwd(yaw, lx, ly);
                if ((fwd(yaw, 0, Math.sign(ly)).x + fwd(yaw, 0, Math.sign(ly)).y) < 0) s.wheel(w.x, w.y, 0, 3.2, 2.8, yaw);
            }
            s.box(0, 0, 3.5, 18, 9, 5, yaw, pal.hull, { inset: 1, taper: 2.5, band: [1.5, 3, team] });
            const hood = fwd(yaw, 6);
            s.box(hood.x, hood.y, 8.5, 5, 7, 1.2, yaw, tint(pal.hull, 8), { inset: 0.6 });
            // roll cage
            const c = [fwd(yaw, 2, 4), fwd(yaw, 2, -4), fwd(yaw, -5, 4), fwd(yaw, -5, -4)];
            for (const p of c) s.tube(p.x, p.y, 8.5, p.x, p.y, 15, 0.55, '#3c3c38');
            s.tube(c[0].x, c[0].y, 15, c[1].x, c[1].y, 15, 0.55, '#3c3c38');
            s.tube(c[2].x, c[2].y, 15, c[3].x, c[3].y, 15, 0.55, '#3c3c38');
            s.tube(c[0].x, c[0].y, 15, c[2].x, c[2].y, 15, 0.55, '#3c3c38');
            s.tube(c[1].x, c[1].y, 15, c[3].x, c[3].y, 15, 0.55, '#3c3c38');
            const r = fwd(yaw, -1.5);
            rider(s, r.x, r.y, 7.5, pal, team, faction);
            // gun on a pintle
            const g0 = fwd(yaw, -2), g1 = fwd(yaw, 11);
            s.tube(g0.x, g0.y, 16.5, g1.x, g1.y, 16.8, 0.9, '#262420');
            s.box(g0.x, g0.y, 15.5, 4, 2.4, 2.4, yaw, pal.metalDark);
            for (const [lx, ly] of [[7, 6], [-7, 6], [7, -6], [-7, -6]]) {
                const w = fwd(yaw, lx, ly);
                if ((fwd(yaw, 0, Math.sign(ly)).x + fwd(yaw, 0, Math.sign(ly)).y) >= 0) s.wheel(w.x, w.y, 0, 3.2, 2.8, yaw);
            }
            for (const so of [3, -3]) { const l = fwd(yaw, 9.4, so); s.glow(l.x, l.y, 6, 0.5, '#ffe9a8'); }
        }
    },

    tank(s, yaw, pal, faction, team, frame) {
        s.shadow(0, 0, 13, 0.42, 1.12);
        if (faction === 'evolved') {
            // Scorpion: armored beast; the tail is the turret
            legsWalk(s, yaw, 4, 8, 9.5, pal.hullDark, frame, 6, 1.5);
            s.blob(0, 0, 5, 10.5, 10, pal.hull, { stretchX: 1.3 });
            for (let i = -1; i <= 1; i++) {
                const seg = fwd(yaw, i * 5);
                s.disc(seg.x, seg.y, 14.4 - Math.abs(i), 3.2, withAlpha(pal.hullDark, 0.55));
            }
            const mk = fwd(yaw, 2);
            s.disc(mk.x, mk.y, 14.8, 2.2, team);
            const claws = fwd(yaw, 12);
            for (const so of [4, -4]) {
                const arm = fwd(yaw, 12, so);
                s.tube(fwd(yaw, 7, so * 0.7).x, fwd(yaw, 7, so * 0.7).y, 7, arm.x, arm.y, 5, 1.5, pal.hull);
                s.spike(arm.x, arm.y, 4, yaw + Math.sign(so) * 0.4, 6, 3, 1, pal.accent);
                s.spike(arm.x, arm.y, 4, yaw - Math.sign(so) * 0.3, 5, 2.4, 0.5, pal.accent);
            }
            const eye = fwd(yaw, 12.5, 1.6);
            s.glow(eye.x, eye.y, 9, 0.8, pal.glow);
            void claws;
        } else if (faction === 'series9') {
            // Sentinel hull: hover chassis with skirts
            hoverGlow(s, 13, pal.glow, 1.15);
            s.box(0, 0, 3.5, 28, 17, 6, yaw, pal.hull, { taper: 5, inset: 1.5, band: [2, 3.4, team] });
            for (const so of [9.2, -9.2]) {
                const sk = fwd(yaw, 0, so);
                s.box(sk.x, sk.y, 2.5, 24, 2.6, 5, yaw, pal.hullDark, { taper: 4, inset: 0.4 });
            }
            const g = fwd(yaw, -12);
            s.glow(g.x, g.y, 6, 1.6, pal.glow);
        } else {
            // Anaconda hull: tracks, sloped glacis, engine deck
            s.track(9, 28, 6, 6.5, yaw, pal.tread);
            s.track(-9, 28, 6, 6.5, yaw, pal.tread);
            s.box(0, 0, 4, 26, 13, 7, yaw, pal.hull, { taper: 6, back: 2, inset: 0.8, band: [3.5, 5, team] });
            for (const so of [8.8, -8.8]) {
                const fender = fwd(yaw, 0, so);
                s.box(fender.x, fender.y, 6.5, 27, 4.8, 1.2, yaw, tint(pal.hull, -6), { bevel: true });
            }
            const deck = fwd(yaw, -9);
            s.box(deck.x, deck.y, 11, 6, 9, 1, yaw, tint(pal.hullDark, 5), { inset: 0.5 });
            for (const so of [3.5, -3.5]) { const l = fwd(yaw, 13, so); s.glow(l.x, l.y, 9, 0.5, '#ffe9a8'); }
        }
    },

    heavy(s, yaw, pal, faction, team, frame) {
        s.shadow(0, 0, 16, 0.45, 1.15);
        if (faction === 'evolved') {
            // War Mastodon (the howdah cannon is the turret)
            const ph = frame * Math.PI / 2;
            for (const [lx, ly, k] of [[8, 7, 0], [8, -7, 1], [-8, 7, 1], [-8, -7, 0]]) {
                const swing = Math.sin(ph + k * Math.PI) * 1.5;
                const top = fwd(yaw, lx, ly), foot = fwd(yaw, lx + swing, ly);
                s.tube(top.x, top.y, 10, foot.x, foot.y, 0.5, 2.8, pal.hullDark);
            }
            s.blob(0, 0, 7, 12.5, 14, pal.hull, { stretchX: 1.25 });
            // war paint in team color
            for (const so of [5, -5]) { const m = fwd(yaw, 2, so); s.disc(m.x, m.y, 18, 2.3, withAlpha(team, 0.9)); }
            const head = fwd(yaw, 14);
            s.blob(head.x, head.y, 8, 6, 8, tint(pal.hull, 6));
            for (const so of [0.35, -0.35]) s.spike(head.x, head.y, 9, yaw + so, 13, 3, 4, pal.accent);
            const trunk0 = fwd(yaw, 17), trunk1 = fwd(yaw, 19);
            s.tube(trunk0.x, trunk0.y, 10, trunk1.x, trunk1.y, 2, 1.6, tint(pal.hull, -6));
            const eye = fwd(yaw, 16, 2.4);
            s.glow(eye.x, eye.y, 14, 0.9, pal.glow);
        } else if (faction === 'series9') {
            // Annihilator hull: massive hover wedge
            hoverGlow(s, 16, pal.glow, 1.2);
            s.box(0, 0, 4, 34, 22, 7, yaw, pal.hull, { taper: 7, inset: 1.6, band: [2.5, 4, team] });
            for (const so of [11.5, -11.5]) {
                const pod = fwd(yaw, -2, so);
                s.box(pod.x, pod.y, 2, 22, 5, 7, yaw, pal.hullDark, { taper: 4, inset: 0.6 });
                const g = fwd(yaw, -12, so);
                s.glow(g.x, g.y, 6, 1.4, pal.glow);
            }
        } else {
            // Juggernaut hull: twin tracks per side, massive casemate
            s.track(11, 34, 8, 8, yaw, pal.tread);
            s.track(-11, 34, 8, 8, yaw, pal.tread);
            s.box(0, 0, 5, 32, 16, 8, yaw, pal.hull, { taper: 7, back: 2, inset: 1, band: [4, 6, team] });
            for (const so of [11, -11]) {
                const skirt = fwd(yaw, 0, so);
                s.box(skirt.x, skirt.y, 5, 30, 3, 4.5, yaw, tint(pal.hull, -5), { inset: 0.4 });
            }
            const deck = fwd(yaw, -11);
            s.box(deck.x, deck.y, 13, 7, 12, 1.2, yaw, pal.hullDark, { inset: 0.5 });
            for (const so of [5, -5]) { const ex = fwd(yaw, -15, so); s.cyl(ex.x, ex.y, 10, 1, 5, '#3a3632'); }
            for (const so of [4, -4]) { const l = fwd(yaw, 16, so); s.glow(l.x, l.y, 10, 0.55, '#ffe9a8'); }
        }
    },

    artillery(s, yaw, pal, faction, team, frame) {
        s.shadow(0, 0, 14, 0.42, 1.12);
        if (faction === 'evolved') {
            // Missile Crab
            legsWalk(s, yaw, 3, 7.5, 10, pal.hullDark, frame, 6, 1.5);
            s.blob(0, 0, 5, 10.5, 9, pal.hull, { stretchX: 1.35 });
            const mk = fwd(yaw, 0);
            s.disc(mk.x, mk.y, 14, 2.4, team);
            for (const so of [4.5, -4.5]) {
                const arm = fwd(yaw, 13, so);
                s.spike(arm.x, arm.y, 4, yaw + Math.sign(so) * 0.6, 8, 3.4, 1, pal.accent);
            }
            // back-mounted bone missile pods
            for (const so of [3.2, 0, -3.2]) {
                const r0 = fwd(yaw, -5, so), r1 = fwd(yaw, 1, so);
                s.tube(r0.x, r0.y, 13, r1.x, r1.y, 21, 1.4, pal.accent);
                s.glow(r1.x, r1.y, 21.5, 0.8, '#ff6a3a');
            }
            const eye = fwd(yaw, 11, 1.5);
            s.glow(eye.x, eye.y, 9, 0.7, pal.glow);
        } else if (faction === 'series9') {
            // Tremor: hover mortar platform
            hoverGlow(s, 13, pal.glow, 1.1);
            s.box(0, 0, 4, 24, 16, 5, yaw, pal.hull, { taper: 3, inset: 1.2, band: [1.6, 3, team] });
            s.cyl(0, 0, 9, 5.5, 4, tint(pal.hull, 10));
            const m = fwd(yaw, 10);
            s.tube(0, 0, 13, m.x, m.y, 25, 2.4, pal.metalDark);
            s.glow(m.x, m.y, 25, 1.6, pal.glow);
            const b = fwd(yaw, -10);
            s.box(b.x, b.y, 8, 6, 11, 4, yaw, pal.hullDark, { inset: 0.6, topMark: [0.5, team] });
        } else {
            // Barrage Craft: wheeled long-range gun
            for (const [lx, ly] of [[8, 7], [-8, 7], [8, -7], [-8, -7], [0, 7], [0, -7]]) {
                const w = fwd(yaw, lx, ly);
                if ((fwd(yaw, 0, Math.sign(ly)).x + fwd(yaw, 0, Math.sign(ly)).y) < 0) s.wheel(w.x, w.y, 0, 3.4, 3, yaw);
            }
            s.box(0, 0, 4, 22, 12, 5.5, yaw, pal.hull, { inset: 1, taper: 2, band: [2, 3.4, team] });
            const cab = fwd(yaw, 7);
            s.box(cab.x, cab.y, 9.5, 6, 10, 5, yaw, tint(pal.hull, 6), { taper: 2, inset: 0.6 });
            const piv = fwd(yaw, -5);
            s.cyl(piv.x, piv.y, 9.5, 4, 3, tint(pal.hull, 10));
            const m = fwd(yaw, 15);
            s.tube(piv.x, piv.y, 12, m.x, m.y, 26, 1.9, pal.metalDark);
            s.tube(m.x, m.y, 26, fwd(yaw, 16.5).x, fwd(yaw, 16.5).y, 28, 2.4, '#2c2a26');
            const sup = fwd(yaw, -12);
            s.tube(sup.x, sup.y, 6, fwd(yaw, -16).x, fwd(yaw, -16).y, 0, 1, pal.metalDark);
            for (const [lx, ly] of [[8, 7], [-8, 7], [8, -7], [-8, -7], [0, 7], [0, -7]]) {
                const w = fwd(yaw, lx, ly);
                if ((fwd(yaw, 0, Math.sign(ly)).x + fwd(yaw, 0, Math.sign(ly)).y) >= 0) s.wheel(w.x, w.y, 0, 3.4, 3, yaw);
            }
        }
    }
};

// ============================================
// ROTATING TURRETS (separate from hulls so they track
// targets independently). Pivot at (0,0,0) = the mount.
// ============================================

export const TURRET_MOUNT = {
    tank: {
        survivors: { ox: -1.5, z: 11 },
        evolved: { ox: -6, z: 12 },
        series9: { ox: -1, z: 9.5 }
    },
    heavy: {
        survivors: { ox: 1, z: 13 },
        evolved: { ox: -2, z: 20 },
        series9: { ox: -1, z: 11 }
    }
};

export const TOWER_TURRET_MOUNT = {
    tower: { survivors: 22, evolved: 25, series9: 23 },
    towerHeavy: { survivors: 21, evolved: 27, series9: 25 }
};

export const TURRET_BUILDERS = {
    tank(s, yaw, pal, faction, team) {
        if (faction === 'evolved') {
            // Scorpion tail: segments arching forward over the body
            let px = -9, pz = -2;
            for (let i = 0; i < 5; i++) {
                const seg = fwd(yaw, px);
                s.sphere(seg.x, seg.y, pz, 2.8 - i * 0.25, i % 2 ? pal.hull : tint(pal.hull, 10));
                px += 3.6; pz += i < 3 ? 4 : 1.5;
            }
            const tip = fwd(yaw, px - 1);
            s.spike(tip.x, tip.y, pz, yaw, 7, 2.6, -3, pal.accent);
            s.glow(fwd(yaw, px + 4).x, fwd(yaw, px + 4).y, pz - 2, 1.2, pal.glow);
        } else if (faction === 'series9') {
            s.box(0, 0, 0, 12, 10, 4.5, yaw, tint(pal.hull, 10), { taper: 3, inset: 1, topMark: [0.4, team] });
            const m0 = fwd(yaw, 4), m1 = fwd(yaw, 17);
            s.tube(m0.x, m0.y, 2.5, m1.x, m1.y, 2.8, 1.5, pal.metalDark);
            for (let i = 0; i < 3; i++) { const r = fwd(yaw, 8 + i * 3); s.glow(r.x, r.y, 2.7, 0.5, pal.glow); }
            s.glow(m1.x, m1.y, 2.8, 1.2, pal.glow);
        } else {
            // cast turret with mantlet, long gun with muzzle brake
            s.box(0, 0, 0, 13, 11, 5, yaw, tint(pal.hull, 6), { taper: 4, back: 1, inset: 1, band: [1.4, 2.6, team] });
            const mant = fwd(yaw, 6.5);
            s.box(mant.x, mant.y, 1, 2.5, 4, 3, yaw, pal.hullDark, { inset: 0.3 });
            const m0 = fwd(yaw, 7), m1 = fwd(yaw, 20);
            s.tube(m0.x, m0.y, 2.5, m1.x, m1.y, 2.7, 1.1, '#3b3d36');
            const mb = fwd(yaw, 21);
            s.tube(m1.x, m1.y, 2.7, mb.x, mb.y, 2.75, 1.6, '#2a2b26');
            const hatch = fwd(yaw, -2, 2);
            s.cyl(hatch.x, hatch.y, 5, 2, 1, pal.hullDark);
            const ant = fwd(yaw, -5, -3.5);
            s.tube(ant.x, ant.y, 5, ant.x, ant.y, 16, 0.25, '#222');
        }
    },

    heavy(s, yaw, pal, faction, team) {
        if (faction === 'evolved') {
            // Mastodon howdah with a bone cannon
            s.box(0, 0, 0, 10, 10, 5, yaw, '#5a3a24', { inset: 0.5, band: [1, 2.2, team] });
            for (const [lx, ly] of [[4, 4], [4, -4], [-4, 4], [-4, -4]]) {
                const p = fwd(yaw, lx, ly);
                s.tube(p.x, p.y, 5, p.x, p.y, 10, 0.5, pal.accent);
            }
            s.box(0, 0, 10, 11, 11, 1, yaw, pal.cloth, { bevel: false });
            const m0 = fwd(yaw, 3), m1 = fwd(yaw, 17);
            s.tube(m0.x, m0.y, 3.5, m1.x, m1.y, 4.5, 1.8, pal.accent);
            s.glow(m1.x, m1.y, 4.5, 1, pal.glow);
        } else if (faction === 'series9') {
            s.box(0, 0, 0, 14, 14, 5, yaw, tint(pal.hull, 12), { taper: 4, inset: 1.2, topMark: [0.4, team] });
            for (const so of [3.4, -3.4]) {
                const m0 = fwd(yaw, 5, so), m1 = fwd(yaw, 23, so);
                s.tube(m0.x, m0.y, 2.6, m1.x, m1.y, 3, 1.5, pal.metalDark);
                s.glow(m1.x, m1.y, 3, 1.2, pal.glow);
            }
            s.glow(0, 0, 6, 1.6, pal.glow);
        } else {
            s.box(0, 0, 0, 16, 14, 6, yaw, tint(pal.hull, 8), { taper: 5, back: 1, inset: 1.2, band: [1.8, 3.2, team] });
            for (const so of [2.6, -2.6]) {
                const m0 = fwd(yaw, 7, so), m1 = fwd(yaw, 23, so);
                s.tube(m0.x, m0.y, 3, m1.x, m1.y, 3.3, 1.2, '#3b3d36');
                const mb = fwd(yaw, 24.5, so);
                s.tube(m1.x, m1.y, 3.3, mb.x, mb.y, 3.35, 1.7, '#2a2b26');
            }
            const cup = fwd(yaw, -3, 3);
            s.cyl(cup.x, cup.y, 6, 2.4, 2, pal.hullDark);
            const mg0 = fwd(yaw, -3, 3), mg1 = fwd(yaw, 3, 3);
            s.tube(mg0.x, mg0.y, 8.5, mg1.x, mg1.y, 8.6, 0.5, '#222');
        }
    },

    tower(s, yaw, pal, faction, team) {
        if (faction === 'evolved') {
            s.sphere(0, 0, 2, 4, pal.hullDark);
            const m0 = fwd(yaw, 2), m1 = fwd(yaw, 13);
            s.tube(m0.x, m0.y, 3, m1.x, m1.y, 4, 1.4, pal.accent);
            s.glow(m1.x, m1.y, 4, 1, pal.glow);
        } else if (faction === 'series9') {
            s.box(0, 0, 0, 8, 8, 4, yaw, pal.hull, { taper: 2, inset: 0.8, topMark: [0.45, team] });
            const m0 = fwd(yaw, 3), m1 = fwd(yaw, 12);
            s.tube(m0.x, m0.y, 2, m1.x, m1.y, 2.2, 0.9, pal.metalDark);
            s.glow(m1.x, m1.y, 2.2, 1, pal.glow);
        } else {
            // sandbagged MG nest with a shield
            s.box(0, 0, 0, 9, 10, 4, yaw, tint(pal.hull, 6), { inset: 0.8, band: [1, 2, team] });
            const sh = fwd(yaw, 4.5);
            s.box(sh.x, sh.y, 2, 1.2, 8, 5, yaw, pal.hullDark, { inset: 0.2 });
            for (const so of [1.2, -1.2]) {
                const m0 = fwd(yaw, 2, so), m1 = fwd(yaw, 13, so);
                s.tube(m0.x, m0.y, 3.5, m1.x, m1.y, 3.7, 0.6, '#262420');
            }
        }
    },

    towerHeavy(s, yaw, pal, faction, team) {
        if (faction === 'evolved') {
            // acid hurler: bloated sac on a bone arm
            s.sphere(0, 0, 3, 4.5, tint(pal.glow, -40));
            const m0 = fwd(yaw, 2), m1 = fwd(yaw, 14);
            s.tube(m0.x, m0.y, 3, m1.x, m1.y, 9, 1.8, pal.accent);
            s.glow(m1.x, m1.y, 9, 1.4, pal.glow);
        } else if (faction === 'series9') {
            s.cyl(0, 0, 0, 5.5, 5, tint(pal.hull, 8), { band: [1.5, 2.5, team] });
            const m0 = fwd(yaw, 3), m1 = fwd(yaw, 17);
            s.tube(m0.x, m0.y, 2.8, m1.x, m1.y, 3, 1.6, pal.metalDark);
            s.glow(m1.x, m1.y, 3, 1.5, pal.glow);
        } else {
            s.box(0, 0, 0, 13, 12, 6, yaw, tint(pal.hull, 10), { taper: 4, inset: 1.2, band: [1.8, 3, team] });
            for (const so of [2.4, -2.4]) {
                const m0 = fwd(yaw, 6, so), m1 = fwd(yaw, 19, so);
                s.tube(m0.x, m0.y, 3, m1.x, m1.y, 3.2, 1.15, '#3b3d36');
                const mb = fwd(yaw, 20.4, so);
                s.tube(m1.x, m1.y, 3.2, mb.x, mb.y, 3.25, 1.6, '#2a2b26');
            }
        }
    }
};

// ============================================
// BUILDINGS
// a = half the footprint in local units (16 per tile)
// ============================================

function apron(s, ft, pal, faction, team) {
    const a = ft * 16 - 1;
    if (faction === 'evolved') {
        // trampled, fluid-stained earth with bone fence posts
        s.disc(0, 0, 0, a * 0.95, withAlpha('#7a5a3c', 0.3));
        s.disc(-a * 0.2, a * 0.1, 0.1, a * 0.6, withAlpha('#8a6644', 0.25));
        for (let i = 0; i < 7; i++) {
            const ang = i * 0.9 + 0.3;
            const r = a * (0.7 + (i % 3) * 0.08);
            s.spike(Math.cos(ang) * r, Math.sin(ang) * r, 0, ang + Math.PI, 2, 1.6, 6, pal.accent);
        }
        return;
    }
    // concrete / alloy pad with a bevelled edge
    const pad = faction === 'series9' ? pal.base : pal.base;
    s.box(0, 0, -1, a * 2, a * 2, 1.6, 0, pad, { inset: 0.8, bevel: true, grime: false });
    // slab seams (shallow grooves)
    for (let i = -1; i <= 1; i++) {
        s.box(i * a * 0.5, 0, 0.55, 0.5, a * 1.9, 0.12, 0, tint(pad, -22), { bevel: false });
        s.box(0, i * a * 0.5, 0.55, a * 1.9, 0.5, 0.12, 0, tint(pad, -22), { bevel: false });
    }
    // grime + oil stains
    let seed = ft * 977 + faction.length * 31;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 6; i++) {
        s.disc((rnd() - 0.5) * a * 1.4, (rnd() - 0.5) * a * 1.4, 0.7, 2 + rnd() * 5, `rgba(16,12,8,${0.08 + rnd() * 0.1})`);
    }
    // team-colored corner markings
    const m = a - 3;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1]]) {
        s.poly([[sx * m, sy * m, 0.7], [sx * (m - 5), sy * m, 0.7], [sx * (m - 5), sy * (m - 1.2), 0.7], [sx * (m - 1.2), sy * (m - 1.2), 0.7], [sx * (m - 1.2), sy * (m - 5), 0.7], [sx * m, sy * (m - 5), 0.7]], withAlpha(team, 0.85));
    }
    if (faction === 'survivors') {
        // hazard stripes along the front edge
        for (let i = 0; i < 6; i++) {
            const x0 = -a * 0.5 + i * 3.4;
            s.poly([[x0, a - 0.5, 0.7], [x0 + 1.7, a - 0.5, 0.7], [x0 + 3.2, a - 2.4, 0.7], [x0 + 1.5, a - 2.4, 0.7]], i % 2 ? '#1c1a16' : '#c8a23c');
        }
    } else {
        // glowing guide lights on the pad
        for (let i = 0; i < 4; i++) s.glow(-a * 0.6 + i * a * 0.4, a - 2, 0.8, 0.6, pal.glow);
    }
}

function barrels(s, x, y, pal, n = 3) {
    for (let i = 0; i < n; i++) {
        const bx = x + (i % 2) * 3.6 - 1.8, by = y + ((i / 2) | 0) * 3.4 - 1.2;
        s.cyl(bx, by, 0, 1.6, 4.2, i % 3 === 0 ? '#8a3f22' : pal.metal, { band: [1.2, 1.7, '#2a2622'] });
    }
}

function crates(s, x, y, pal) {
    s.box(x, y, 0, 5, 5, 4, 0.2, '#8a6a3e', { inset: 0.3 });
    s.box(x + 3.5, y + 4, 0, 4, 4, 3, -0.15, '#6e5432', { inset: 0.3 });
}

function windowStrip(s, x0, x1, y, z0, z1, color, lit) {
    // windows on the south (+y) face
    const n = Math.max(1, Math.round((x1 - x0) / 5));
    for (let i = 0; i < n; i++) {
        const wx = x0 + (i + 0.2) * (x1 - x0) / n, wx2 = x0 + (i + 0.8) * (x1 - x0) / n;
        s.poly([[wx, y, z0], [wx2, y, z0], [wx2, y, z1], [wx, y, z1]], lit && i % 2 ? '#ffd98a' : color);
    }
}
function windowStripE(s, y0, y1, x, z0, z1, color, lit) {
    const n = Math.max(1, Math.round((y1 - y0) / 5));
    for (let i = 0; i < n; i++) {
        const wy = y0 + (i + 0.2) * (y1 - y0) / n, wy2 = y0 + (i + 0.8) * (y1 - y0) / n;
        s.poly([[x, wy, z0], [x, wy2, z0], [x, wy2, z1], [x, wy, z1]], lit && i % 3 === 1 ? '#ffd98a' : color);
    }
}

function smokeStack(s, x, y, h, pal) {
    s.cyl(x, y, 0, 2.6, h, pal.metal, { band: [h - 4, h - 2.6, '#8a2e1e'] });
    s.cyl(x, y, h, 3, 1.4, pal.metalDark);
    s.disc(x, y, h + 1.45, 2, '#141210');
}

function dish(s, x, y, z, r, pal) {
    s.tube(x, y, z - 6, x, y, z, 0.6, pal.metalDark);
    s.dish(x, y, z, r, pal.metal);
}

export const BUILDING_BUILDERS = {

    hq(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        if (f === 'evolved') {
            // Clan Hall: great hide dome ringed with tusks
            s.blob(-2, -2, 0, a * 0.62, 34, pal.hull);
            s.blob(a * 0.32, -a * 0.38, 0, a * 0.28, 18, tint(pal.hull, -8));
            s.blob(-a * 0.45, a * 0.25, 0, a * 0.26, 16, tint(pal.hull, -12));
            // hide seams stretched over a bone frame
            for (let i = -2; i <= 2; i++) s.rib(-2, -2, 0, a * 0.63, 34.5, i * 0.45, pal.accent);
            s.disc(a * 0.35, a * 0.4, 0.5, 5, '#1a0e08', { stretchX: 0.8 });
            for (let i = 0; i < 8; i++) {
                const ang = (i / 8) * Math.PI * 2;
                s.spike(Math.cos(ang) * a * 0.42 - 2, Math.sin(ang) * a * 0.42 - 2, 24, ang, 9, 3, 10, pal.accent);
            }
            s.glow(-2, -2, 42, 2.5, pal.glow);
            s.flag(-a * 0.7, -a * 0.6, 0, team, 1.3);
            s.flag(a * 0.7, -a * 0.1, 0, team, 1.1);
        } else if (f === 'series9') {
            // Mainframe: stepped ziggurat with glowing seams and a spire
            s.box(0, 0, 0, a * 1.5, a * 1.5, 10, 0, pal.hull, { inset: 2, band: [6, 7.5, team] });
            s.box(0, 0, 10, a * 1.05, a * 1.05, 10, 0, tint(pal.hull, 6), { inset: 1.6, band: [6, 7.2, pal.glow] });
            s.box(0, 0, 20, a * 0.66, a * 0.66, 9, 0, tint(pal.hull, 12), { inset: 1.2, topMark: [0.5, team] });
            s.tube(0, 0, 29, 0, 0, 48, 0.9, pal.metalDark);
            for (const z of [34, 40]) s.cyl(0, 0, z, 2.6, 1, pal.metal);
            s.glow(0, 0, 49, 2.6, pal.glow);
            s.glow(a * 0.52, a * 0.52, 12, 1.2, pal.glow);
            s.flag(-a * 0.75, -a * 0.75, 0, team);
        } else {
            // Survivors Outpost: bunker complex with comm mast
            s.box(0, 0, 0, a * 1.5, a * 1.25, 16, 0, pal.hull, { inset: 1, band: [12, 14, team] });
            windowStrip(s, -a * 0.5, a * 0.6, a * 0.625 - 0.9 + 0.6, 7, 10, pal.window, frame === 1);
            windowStripE(s, -a * 0.45, a * 0.45, a * 0.75 - 0.5, 7, 10, pal.window, frame === 1);
            s.box(-a * 0.18, -a * 0.12, 16, a * 0.8, a * 0.7, 11, 0, tint(pal.hull, 8), { inset: 1, topMark: [0.3, pal.hullDark] });
            windowStrip(s, -a * 0.5, a * 0.15, a * 0.23, 20, 23, pal.window, frame === 1);
            // door
            s.poly([[a * 0.15, a * 0.625 + 0.1, 0], [a * 0.42, a * 0.625 + 0.1, 0], [a * 0.42, a * 0.625 + 0.1, 8], [a * 0.15, a * 0.625 + 0.1, 8]], '#22241e');
            // roof gear
            s.box(a * 0.4, a * 0.15, 16, 6, 5, 3.5, 0, pal.metalDark);
            s.cyl(a * 0.45, -a * 0.35, 16, 2.4, 3, pal.metal);
            // comm mast with dish
            s.tube(-a * 0.5, a * 0.32, 16, -a * 0.5, a * 0.32, 52, 0.9, pal.metalDark);
            for (const z of [26, 36, 46]) s.tube(-a * 0.5 - 2, a * 0.32, z, -a * 0.5 + 2, a * 0.32, z, 0.4, pal.metalDark);
            dish(s, -a * 0.2, -a * 0.25, 33, 5, pal);
            s.glow(-a * 0.5, a * 0.32, 53, 1.5, frame === 1 ? '#ff4433' : '#882211');
            s.flag(a * 0.55, -a * 0.6, 16, team);
            barrels(s, a * 0.78, a * 0.15, pal, 3);
            crates(s, -a * 0.1, a * 0.82, pal);
        }
    },

    powerStation(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        if (f === 'evolved') {
            // Bio Refinery: bubbling vats
            s.blob(-a * 0.3, -a * 0.25, 0, a * 0.42, 22, pal.hull);
            s.blob(a * 0.3, -a * 0.35, 0, a * 0.3, 16, tint(pal.hull, -6));
            s.disc(-a * 0.3, -a * 0.25, 22.5, 6, withAlpha(pal.glow, 0.9), { edge: tint(pal.hullDark, -20), edgeWidth: 1.5 });
            s.disc(a * 0.3, -a * 0.35, 16.5, 4, withAlpha(pal.glow, 0.8));
            s.glow(-a * 0.3, -a * 0.25, 24, frame ? 3 : 2.4, pal.glow);
            s.tube(-a * 0.05, 0, 10, a * 0.45, a * 0.45, 1, 1.8, pal.accent);
            s.flag(a * 0.6, a * 0.4, 0, team);
        } else if (f === 'series9') {
            // Fusion Plant: floating ring around a core
            s.box(-a * 0.1, -a * 0.1, 0, a * 1.1, a * 1.1, 8, 0, pal.hull, { inset: 1.5, band: [4, 5.6, team] });
            s.cyl(-a * 0.1, -a * 0.1, 8, a * 0.25, 14, tint(pal.hull, 8));
            s.ring(-a * 0.1, -a * 0.1, 24, a * 0.5, 1.7, pal.metal);
            s.ring(-a * 0.1, -a * 0.1, 24, a * 0.5, 0.75, pal.glow, { finish: 'glass' });
            for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; s.glows.push({ x: -a * 0.1 + Math.cos(ang) * a * 0.5, y: -a * 0.1 + Math.sin(ang) * a * 0.5, z: 24, r: 1.1, color: pal.glow }); }
            for (const ang of [0.4, 2.5, 4.6]) s.tube(-a * 0.1, -a * 0.1, 10, -a * 0.1 + Math.cos(ang) * a * 0.5, -a * 0.1 + Math.sin(ang) * a * 0.5, 23, 0.6, pal.metalDark);
            s.glow(-a * 0.1, -a * 0.1, 25, frame ? 4.2 : 3.6, pal.glow);
        } else {
            // refinery block, twin silos, smokestack
            s.box(-a * 0.25, a * 0.1, 0, a * 0.9, a * 0.9, 12, 0, pal.hull, { inset: 1, band: [8.5, 10, team] });
            windowStripE(s, -a * 0.2, a * 0.4, a * 0.2 - 0.5, 4, 7, pal.window, frame === 1);
            s.cyl(a * 0.42, -a * 0.38, 0, 6, 20, pal.metal, { band: [14, 16, team] });
            s.cyl(a * 0.05, -a * 0.6, 0, 5, 16, tint(pal.metal, -6));
            smokeStack(s, -a * 0.6, -a * 0.45, 30, pal);
            // pipework
            s.tube(-a * 0.1, a * 0.1, 8, a * 0.42, -a * 0.38, 8, 1.1, pal.metalDark);
            s.tube(a * 0.05, -a * 0.6, 6, a * 0.42, -a * 0.38, 6, 0.9, pal.metalDark);
            s.glow(-a * 0.6, -a * 0.45, 32, 1.2, frame ? '#ff9944' : '#cc5522');
            barrels(s, a * 0.6, a * 0.55, pal, 2);
        }
    },

    derrick(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        s.disc(a * 0.35, a * 0.35, 0.8, 6, '#0d0c0a', { edge: 'rgba(80,80,60,0.6)' });
        if (f === 'evolved') {
            const squash = frame === 0 ? 1 : 0.86;
            s.blob(-a * 0.15, -a * 0.15, 0, a * 0.48, 22 * squash, pal.hull);
            s.blob(-a * 0.15, -a * 0.15, 22 * squash - 4, a * 0.2, 7, tint(pal.hull, 10));
            s.tube(-a * 0.05, -a * 0.05, 10 * squash, a * 0.35, a * 0.35, 1, 2.2, pal.hullDark);
            s.glow(-a * 0.25, -a * 0.3, 16 * squash, 1.2, pal.glow);
            s.disc(-a * 0.15, -a * 0.15, 22 * squash + 2.5, 2.4, team);
        } else if (f === 'series9') {
            const lift = frame === 0 ? 0 : 5;
            s.box(-a * 0.15, -a * 0.15, 0, a * 0.9, a * 0.9, 6, 0, pal.hull, { inset: 1, band: [3, 4.4, team] });
            s.cyl(-a * 0.15, -a * 0.15, 6, 5, 12, pal.metal);
            s.cyl(-a * 0.15, -a * 0.15, 18, 3, 6 + lift, tint(pal.metal, 14));
            s.glow(-a * 0.15, -a * 0.15, 25 + lift, 1.8, pal.glow);
            s.tube(-a * 0.05, -a * 0.05, 8, a * 0.35, a * 0.35, 1, 1.4, pal.metalDark);
        } else {
            // lattice derrick with a nodding pumpjack
            const top = [-a * 0.2, -a * 0.2, 44];
            const legs = [[-a * 0.55, -a * 0.55], [a * 0.15, -a * 0.55], [a * 0.15, a * 0.15], [-a * 0.55, a * 0.15]];
            for (const [lx, ly] of legs) s.tube(lx, ly, 0, top[0], top[1], top[2], 0.7, pal.metalDark);
            for (const z of [10, 20, 30]) {
                const k = 1 - z / 44;
                const pts = legs.map(([lx, ly]) => [top[0] + (lx - top[0]) * k, top[1] + (ly - top[1]) * k]);
                for (let i = 0; i < 4; i++) {
                    const p = pts[i], q = pts[(i + 1) % 4];
                    s.tube(p[0], p[1], z, q[0], q[1], z, 0.4, pal.metalDark);
                }
            }
            s.glow(top[0], top[1], top[2] + 1.5, 1.1, frame ? '#ff5533' : '#aa2211');
            // pumpjack
            const tilt = frame === 0 ? 4 : -3;
            const piv = [a * 0.15, a * 0.15];
            s.box(piv[0], piv[1], 0, 3, 3, 9, 0, pal.metalDark, { inset: 0.4 });
            s.tube(piv[0] - 9, piv[1] - 9, 10 - tilt, a * 0.35 + 1, a * 0.35 + 1, 10 + tilt, 1.4, team);
            s.tube(a * 0.35 + 1, a * 0.35 + 1, 10 + tilt, a * 0.35, a * 0.35, 1, 0.5, '#2a2826');
            s.box(piv[0] - 9, piv[1] - 9, 4 - tilt * 0.5, 4, 4, 5, Math.PI / 4, pal.hullDark, { inset: 0.4 });
            s.box(a * 0.55, -a * 0.45, 0, 8, 7, 7, 0, pal.hull, { inset: 0.8, band: [4, 5.2, team] });
        }
    },

    barracks(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        if (f === 'evolved') {
            // hide tent with bone poles + skull totem
            s.blob(0, -2, 0, a * 0.62, 20, pal.roof);
            for (const [x, y] of [[-a * 0.45, -a * 0.45], [a * 0.45, -a * 0.45], [a * 0.3, a * 0.45]]) {
                s.tube(x, y, 0, 0, -2, 28, 0.9, pal.accent);
            }
            s.disc(a * 0.32, a * 0.38, 0.5, 4.5, '#1a0e08', { stretchX: 0.7 });
            s.tube(-a * 0.6, a * 0.4, 0, -a * 0.6, a * 0.4, 13, 0.7, pal.accent);
            s.sphere(-a * 0.6, a * 0.4, 15, 2.4, pal.accent);
            s.flag(a * 0.55, -a * 0.2, 0, team);
        } else if (f === 'series9') {
            // droid works: dome with an assembly hatch
            s.blob(0, -2, 0, a * 0.56, 20, pal.hull);
            s.box(a * 0.15, a * 0.42, 0, a * 0.7, 5, 11, 0, pal.hullDark, { inset: 0.5, band: [8, 9.5, team] });
            s.poly([[a * 0.15 - 6, a * 0.42 + 2.55, 1], [a * 0.15 + 6, a * 0.42 + 2.55, 1], [a * 0.15 + 6, a * 0.42 + 2.55, 7], [a * 0.15 - 6, a * 0.42 + 2.55, 7]], withAlpha(pal.glow, frame ? 0.95 : 0.75));
            for (let i = 0; i < 3; i++) s.glow(-a * 0.35 + i * 8, -a * 0.5, 12, 0.9, pal.glow);
        } else {
            // Quonset hut barracks with sandbags
            s.box(0, 0, 0, a * 1.4, a * 0.9, 9, 0, pal.hull, { inset: 0.6, band: [5.5, 7, team] });
            s.box(0, 0, 9, a * 1.4, a * 0.9, 6, 0, pal.roof, { sideInset: a * 0.42, inset: 0.2 });
            windowStrip(s, -a * 0.6, a * 0.1, a * 0.45 - 0.2, 4, 6.5, pal.window, frame === 1);
            s.poly([[a * 0.25, a * 0.45 + 0.05, 0], [a * 0.5, a * 0.45 + 0.05, 0], [a * 0.5, a * 0.45 + 0.05, 7], [a * 0.25, a * 0.45 + 0.05, 7]], '#22241e');
            for (let i = 0; i < 5; i++) s.box(-a * 0.55 + i * 5.2, a * 0.8, 0, 4.6, 2.6, 2.4, 0.1 * (i % 2), '#8a7a58', { inset: 0.6, bevel: false });
            s.flag(-a * 0.75, -a * 0.6, 0, team);
            crates(s, a * 0.62, -a * 0.65, pal);
        }
    },

    factory(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        if (f === 'evolved') {
            // beast enclosure: ribbed carapace with a glowing maw
            s.blob(0, -2, 0, a * 0.66, 30, pal.hull, { stretchX: 1.12 });
            for (let i = -2; i <= 2; i++) s.rib(0, -2, 0, a * 0.66 * 1.12, 30.5, i * 0.42, pal.hullDark);
            s.disc(a * 0.4, a * 0.42, 0.5, 7, '#1a0e08', { stretchX: 0.8, edge: withAlpha(pal.glow, 0.8), edgeWidth: 1.5 });
            s.spike(a * 0.28, a * 0.52, 3, 2.2, 7, 2.6, 6, pal.accent);
            s.spike(a * 0.52, a * 0.28, 3, 0.6, 7, 2.6, 6, pal.accent);
            s.flag(-a * 0.7, -a * 0.5, 0, team, 1.2);
        } else if (f === 'series9') {
            s.box(0, 0, 0, a * 1.45, a * 1.25, 14, 0, pal.hull, { inset: 1.2, band: [9, 11, team] });
            s.box(-a * 0.1, -a * 0.15, 14, a * 1.0, a * 0.8, 6, 0, tint(pal.hull, 10), { taper: 4, inset: 1, topMark: [0.4, pal.hullDark] });
            s.poly([[a * 0.05, a * 0.625 + 0.1, 0], [a * 0.55, a * 0.625 + 0.1, 0], [a * 0.55, a * 0.625 + 0.1, 10], [a * 0.05, a * 0.625 + 0.1, 10]], '#101418');
            s.poly([[a * 0.08, a * 0.625 + 0.15, 4], [a * 0.52, a * 0.625 + 0.15, 4], [a * 0.52, a * 0.625 + 0.15, 6], [a * 0.08, a * 0.625 + 0.15, 6]], withAlpha(pal.glow, frame ? 1 : 0.7));
            smokeStack(s, -a * 0.55, -a * 0.45, 26, pal);
            s.glow(-a * 0.55, -a * 0.45, 28, 1.4, pal.glow);
        } else {
            // industrial hall with sawtooth roof and big gate
            s.box(0, 0, 0, a * 1.5, a * 1.2, 14, 0, pal.hull, { inset: 0.8, band: [10, 12, team] });
            for (let i = -1; i <= 1; i++) {
                const x = i * a * 0.48;
                s.solid(
                    [[x - a * 0.24, -a * 0.58, 14], [x + a * 0.24, -a * 0.58, 14], [x + a * 0.24, a * 0.58, 14], [x - a * 0.24, a * 0.58, 14]],
                    [[x - a * 0.24, -a * 0.58, 14.1], [x - a * 0.1, -a * 0.58, 22], [x - a * 0.1, a * 0.58, 22], [x - a * 0.24, a * 0.58, 14.1]],
                    pal.roof, { grime: false });
                windowStripE(s, -a * 0.5, a * 0.5, x - a * 0.17, 16, 20, '#9fc8dc', false);
            }
            s.poly([[a * 0.05, a * 0.6 + 0.1, 0], [a * 0.6, a * 0.6 + 0.1, 0], [a * 0.6, a * 0.6 + 0.1, 10], [a * 0.05, a * 0.6 + 0.1, 10]], '#2a2c26');
            for (let i = 0; i < 4; i++) s.poly([[a * 0.05, a * 0.6 + 0.15, 1.5 + i * 2.2], [a * 0.6, a * 0.6 + 0.15, 1.5 + i * 2.2], [a * 0.6, a * 0.6 + 0.15, 2.1 + i * 2.2], [a * 0.05, a * 0.6 + 0.15, 2.1 + i * 2.2]], '#3a3c36');
            for (let i = 0; i < 6; i++) s.poly([[a * 0.05 + i * 3.2, a * 0.6 + 0.2, 10], [a * 0.05 + i * 3.2 + 1.6, a * 0.6 + 0.2, 10], [a * 0.05 + i * 3.2 + 3.2, a * 0.6 + 0.2, 11.4], [a * 0.05 + i * 3.2 + 1.6, a * 0.6 + 0.2, 11.4]], i % 2 ? '#1c1a16' : pal.accent);
            smokeStack(s, -a * 0.55, -a * 0.35, 30, pal);
            s.flag(a * 0.62, -a * 0.6, 14, team);
            s.glow(a * 0.66, a * 0.62, 10.5, 0.8, frame ? '#ffaa33' : '#aa5511');
        }
    },

    researchLab(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        if (f === 'evolved') {
            s.cyl(0, 0, 0, a * 0.4, 11, pal.hullDark, { band: [7, 8.6, team] });
            s.disc(0, 0, 11.2, a * 0.36, withAlpha(pal.glow, 0.92));
            s.glow(-2, -1, 13, frame ? 2.4 : 2, pal.glow);
            for (const [x, y] of [[-a * 0.55, -a * 0.5], [a * 0.55, -a * 0.5], [0, a * 0.65]]) s.tube(x, y, 0, 0, 0, 26, 0.8, pal.accent);
            s.sphere(0, 0, 26, 2, pal.accent);
        } else if (f === 'series9') {
            s.cyl(0, 0, 0, a * 0.42, 8, pal.hull, { band: [4, 5.4, team] });
            s.cyl(0, 0, 8, a * 0.28, 12, tint(pal.hull, 8), { rTop: a * 0.18 });
            s.cyl(0, 0, 20, a * 0.12, 8, tint(pal.hull, 16));
            for (const z of [10, 17, 24]) {
                const r = a * 0.5 - z * 0.25;
                s.ring(0, 0, z + (frame ? 1 : 0), r, 0.45, pal.glow, { finish: 'glass' });
            }
            s.glow(0, 0, 30, 2.2, pal.glow);
        } else {
            s.box(0, 0, 0, a * 1.3, a * 1.1, 10, 0, pal.hull, { inset: 0.8, band: [6.5, 8, team] });
            windowStripE(s, -a * 0.4, a * 0.35, a * 0.65 - 0.4, 3, 6, pal.window, frame === 1);
            // observatory dome
            s.blob(-a * 0.12, -a * 0.12, 10, a * 0.36, 12, '#b9bcb8');
            // telescope slit in the dome
            s.box(-a * 0.12 + a * 0.2, -a * 0.12 + a * 0.2, 13, 3, 3, 9, Math.PI / 4, '#1b1d1c', { bevel: false });
            s.tube(a * 0.45, a * 0.3, 10, a * 0.45, a * 0.3, 30, 0.6, pal.metalDark);
            dish(s, a * 0.45, a * 0.3, 27, 3.4, pal);
            s.glow(-a * 0.12, -a * 0.12, 23, 1, frame ? '#9fe8ff' : '#4a9ab8');
        }
    },

    repairBay(s, ft, pal, f, frame, team) {
        apron(s, ft, pal, f, team);
        const a = ft * 16;
        s.disc(0, 0, 0.9, a * 0.5, withAlpha('#000000', 0.25), { edge: withAlpha(f === 'survivors' ? '#ffcc33' : pal.glow, 0.85), edgeWidth: 1.4 });
        if (f === 'evolved') {
            s.disc(0, 0, 1, a * 0.42, withAlpha(pal.glow, 0.5), { edge: tint(pal.hullDark, -10), edgeWidth: 2 });
            for (let i = 0; i < 5; i++) {
                const ang = i / 5 * Math.PI * 2 + 0.4;
                s.spike(Math.cos(ang) * a * 0.6, Math.sin(ang) * a * 0.6, 0, ang, 3, 2.4, 11, pal.accent);
            }
            s.glow(0, 0, 2, frame ? 2.4 : 1.8, pal.glow);
            s.flag(-a * 0.75, -a * 0.75, 0, team);
        } else if (f === 'series9') {
            s.box(-a * 0.55, -a * 0.55, 0, 10, 10, 14, 0, pal.hull, { inset: 1, band: [9, 10.5, team] });
            s.tube(-a * 0.5, -a * 0.5, 14, -2, -2, 12, 1.1, pal.metalDark);
            s.tube(-2, -2, 12, 2, 2, 5, 0.9, pal.metal);
            s.glow(2, 2, 5, 1.2, pal.glow);
        } else {
            // gantry crane
            for (const sx of [-1, 1]) s.box(sx * a * 0.62, 0, 0, 4, a * 1.1, 18, 0, pal.hull, { inset: 0.5, band: [13, 15, team] });
            s.box(0, 0, 18, a * 1.45, 5, 3, 0, pal.accent, { inset: 0.4 });
            s.tube(2, 0, 18, 2, 0, 10, 0.35, '#2a2826');
            s.ring(2, 0, 8.4, 1.4, 0.35, '#2a2826', { tiltX: Math.PI / 2, arc: Math.PI * 1.4 });
            s.glow(a * 0.62, a * 0.5, 18.5, 0.7, frame ? '#ffcc33' : '#886611');
        }
    },

    tower(s, ft, pal, f, frame, team) {
        const a = ft * 16;
        if (f === 'evolved') {
            s.disc(0, 0, 0, a * 0.95, withAlpha('#7a5a3c', 0.28));
            s.blob(0, 0, 0, a * 0.62, 20, pal.hull);
            for (let i = 0; i < 4; i++) {
                const ang = i / 4 * Math.PI * 2 + 0.6;
                s.spike(Math.cos(ang) * 6, Math.sin(ang) * 6, 16, ang, 7, 2.6, 8, pal.accent);
            }
            s.disc(0, 0, 22, 3, team);
        } else if (f === 'series9') {
            s.box(0, 0, -1, a * 1.8, a * 1.8, 1.5, 0, pal.base, { inset: 0.6 });
            s.cyl(0, 0, 0, a * 0.5, 18, pal.hull, { rTop: a * 0.38, band: [12, 14, team] });
            s.cyl(0, 0, 18, a * 0.32, 4, pal.hullDark);
        } else {
            // sandbag-ringed watch post on a concrete plinth
            s.box(0, 0, -1, a * 1.8, a * 1.8, 1.5, 0, pal.base, { inset: 0.6 });
            s.box(0, 0, 0, a * 1.15, a * 1.15, 17, Math.PI / 4, pal.hull, { inset: 1.6, band: [12, 14, team] });
            s.box(0, 0, 17, a * 1.3, a * 1.3, 4, Math.PI / 4, tint(pal.hull, 8), { inset: 0.6 });
            for (let i = 0; i < 8; i++) {
                const ang = i / 8 * Math.PI * 2;
                s.box(Math.cos(ang) * a * 0.82, Math.sin(ang) * a * 0.82, 0, 4, 2.6, 2.4, ang + Math.PI / 2, '#8a7a58', { inset: 0.6, bevel: false });
            }
        }
    },

    towerHeavy(s, ft, pal, f, frame, team) {
        const a = ft * 16;
        if (f === 'evolved') {
            s.disc(0, 0, 0, a * 0.95, withAlpha('#7a5a3c', 0.28));
            s.blob(0, 0, 0, a * 0.66, 18, pal.hull);
            s.blob(0, 0, 14, a * 0.36, 10, tint(pal.glow, -35));
            s.glow(-2, -2, 22, frame ? 2.2 : 1.8, pal.glow);
            s.disc(a * 0.3, a * 0.3, 8, 2.4, team);
        } else if (f === 'series9') {
            s.box(0, 0, -1, a * 1.8, a * 1.8, 1.5, 0, pal.base, { inset: 0.6 });
            s.cyl(0, 0, 0, a * 0.58, 14, pal.hull, { band: [8, 10, team] });
            s.cyl(0, 0, 14, a * 0.4, 8, tint(pal.hull, 10), { rTop: a * 0.3 });
            s.glow(0, 0, 23, frame ? 3.2 : 2.6, pal.glow);
        } else {
            // squat concrete casemate
            s.box(0, 0, -1, a * 1.8, a * 1.8, 1.5, 0, pal.base, { inset: 0.6 });
            s.box(0, 0, 0, a * 1.5, a * 1.5, 16, 0, pal.hull, { inset: 2.4, band: [11, 13, team] });
            s.cyl(0, 0, 16, a * 0.42, 4, tint(pal.hull, 6));
            s.glow(a * 0.6, -a * 0.6, 14, 0.7, frame ? '#ff4433' : '#882211');
        }
    },

    // Neutral tech bunker: frame 0 = sealed, 1 = looted
    bunker(s, ft, pal, f, frame) {
        const con = '#8c877a';
        const a = ft * 16;
        s.box(0, 0, -1, a * 1.9, a * 1.9, 1.6, 0, '#77736a', { inset: 0.8 });
        s.blob(0, -2, 0, a * 0.6, 16, tint(con, -4));
        s.box(a * 0.15, a * 0.45, 0, a * 0.7, 6, 9, 0, tint(con, -8), { inset: 0.6 });
        s.poly([[a * 0.15 - 6, a * 0.45 + 3.05, 0.5], [a * 0.15 + 6, a * 0.45 + 3.05, 0.5], [a * 0.15 + 6, a * 0.45 + 3.05, 7], [a * 0.15 - 6, a * 0.45 + 3.05, 7]], frame === 0 ? '#2c2a24' : '#0e0d0a');
        for (let i = 0; i < 5; i++) {
            const ang = 0.6 + i * 1.1;
            s.box(Math.cos(ang) * a * 0.85, Math.sin(ang) * a * 0.85, 0, 4, 2.6, 2.2, ang, '#8a7a58', { inset: 0.6, bevel: false });
        }
        if (frame === 0) {
            s.tube(-6, -8, 12, -6, -8, 30, 0.5, '#4a4740');
            s.glow(-6, -8, 31, 1.8, '#66e0ff');
            s.glow(a * 0.15, a * 0.45 + 3, 4, 1.4, '#66e0ff');
            // hazard stripes on the door frame
            for (let i = 0; i < 4; i++) s.poly([[a * 0.15 - 6 + i * 3.4, a * 0.45 + 3.1, 7.5], [a * 0.15 - 4.3 + i * 3.4, a * 0.45 + 3.1, 7.5], [a * 0.15 - 2.6 + i * 3.4, a * 0.45 + 3.1, 9], [a * 0.15 - 4.3 + i * 3.4, a * 0.45 + 3.1, 9]], i % 2 ? '#1c1a16' : '#d8b03c');
        } else {
            s.tube(-6, -8, 12, -1, -4, 19, 0.5, '#4a4740');
        }
    }
};

