// ============================================
// XFire Krossfire - Isometric Sprite Factory
// Procedurally renders KKnD-style isometric
// sprites (units in 16 directions, buildings
// with animation frames) onto cached canvases.
// ============================================

const IsoSprites = (() => {

    const DIRS = 16;
    const cache = new Map();
    const iconCache = new Map();

    // Light comes from the upper left of the screen
    const LX = -0.88, LY = -0.48;

    // ---------- color helpers ----------
    function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

    function tint(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = clamp255((num >> 16) + amt);
        const G = clamp255(((num >> 8) & 0xff) + amt);
        const B = clamp255((num & 0xff) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    function withAlpha(color, a) {
        const num = parseInt(color.replace('#', ''), 16);
        return `rgba(${(num >> 16) & 0xff},${(num >> 8) & 0xff},${num & 0xff},${a})`;
    }

    // ---------- isometric drawing surface ----------
    // Local coordinates: x = east, y = south (world axes), z = up.
    // Projection matches the engine: sx = x - y, sy = (x + y) / 2 - z
    class Surface {
        constructor(w, h, ax, ay) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = w;
            this.canvas.height = h;
            this.canvas.anchorX = ax;
            this.canvas.anchorY = ay;
            this.ctx = this.canvas.getContext('2d');
            this.ax = ax;
            this.ay = ay;
        }

        p(x, y, z) {
            return { x: this.ax + (x - y), y: this.ay + (x + y) * 0.5 - (z || 0) };
        }

        // Filled polygon from 3D points
        poly(points, color, strokeColor) {
            const c = this.ctx;
            c.beginPath();
            points.forEach((pt, i) => {
                const s = this.p(pt[0], pt[1], pt[2] || 0);
                if (i === 0) c.moveTo(s.x, s.y); else c.lineTo(s.x, s.y);
            });
            c.closePath();
            c.fillStyle = color;
            c.fill();
            if (strokeColor) {
                c.strokeStyle = strokeColor;
                c.lineWidth = 1;
                c.stroke();
            }
        }

        // Rotated 3D box. w along local x (forward), l along y, yaw rotates around z.
        box(cx, cy, z, w, l, h, yaw, color, opts = {}) {
            const cos = Math.cos(yaw || 0), sin = Math.sin(yaw || 0);
            const hw = w / 2, hl = l / 2;
            const loc = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
            const rot = loc.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
            const normals = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([nx, ny]) =>
                [nx * cos - ny * sin, nx * sin + ny * cos]);

            // Side faces (painter order: far faces first)
            const faces = [];
            for (let i = 0; i < 4; i++) {
                const j = (i + 1) % 4;
                faces.push({ i, j, n: normals[i] });
            }
            faces.sort((a, b) => {
                const ya = (rot[a.i][0] + rot[a.i][1] + rot[a.j][0] + rot[a.j][1]);
                const yb = (rot[b.i][0] + rot[b.i][1] + rot[b.j][0] + rot[b.j][1]);
                return ya - yb;
            });
            for (const f of faces) {
                // Back-face cull via signed area in screen space
                const a = this.p(rot[f.i][0], rot[f.i][1], z);
                const b = this.p(rot[f.j][0], rot[f.j][1], z);
                const t = this.p(rot[f.j][0], rot[f.j][1], z + h);
                const area = (b.x - a.x) * (t.y - a.y) - (t.x - a.x) * (b.y - a.y);
                if (area >= 0) continue;
                const lum = Math.max(0, f.n[0] * LX + f.n[1] * LY);
                const shade = -34 + lum * 46;
                this.poly([
                    [rot[f.i][0], rot[f.i][1], z],
                    [rot[f.j][0], rot[f.j][1], z],
                    [rot[f.j][0], rot[f.j][1], z + h],
                    [rot[f.i][0], rot[f.i][1], z + h]
                ], tint(color, shade));
            }
            // Top face
            this.poly(rot.map(([x, y]) => [x, y, z + h]),
                tint(color, opts.topShade !== undefined ? opts.topShade : 20),
                opts.edge ? tint(color, -45) : null);
        }

        // Vertical cylinder
        cyl(cx, cy, z, r, h, color, opts = {}) {
            const c = this.ctx;
            const rx = r * 1.414, ry = r * 0.707;
            const base = this.p(cx, cy, z);
            const top = this.p(cx, cy, z + h);
            // Side
            const grad = c.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
            grad.addColorStop(0, tint(color, 14));
            grad.addColorStop(0.45, tint(color, -6));
            grad.addColorStop(1, tint(color, -36));
            c.fillStyle = grad;
            c.beginPath();
            c.moveTo(base.x - rx, top.y);
            c.lineTo(base.x - rx, base.y);
            c.ellipse(base.x, base.y, rx, ry, 0, Math.PI, 0, true);
            c.lineTo(base.x + rx, top.y);
            c.ellipse(base.x, top.y, rx, ry, 0, 0, Math.PI, false);
            c.closePath();
            c.fill();
            // Top
            c.fillStyle = tint(opts.topColor || color, 22);
            c.beginPath();
            c.ellipse(top.x, top.y, rx, ry, 0, 0, Math.PI * 2);
            c.fill();
            if (opts.edge) {
                c.strokeStyle = tint(color, -40);
                c.lineWidth = 1;
                c.stroke();
            }
        }

        // Organic dome / blob with spherical shading
        blob(cx, cy, z, r, h, color, opts = {}) {
            const c = this.ctx;
            const base = this.p(cx, cy, z);
            const rx = r * 1.414 * (opts.stretchX || 1);
            const ry = r * 0.707 * (opts.stretchY || 1);
            const grad = c.createRadialGradient(
                base.x - rx * 0.35, base.y - h * 0.75, 1,
                base.x, base.y - h * 0.35, rx * 1.25);
            grad.addColorStop(0, tint(color, 30));
            grad.addColorStop(0.6, color);
            grad.addColorStop(1, tint(color, -38));
            c.fillStyle = grad;
            c.beginPath();
            // Dome: arched top + lower half ellipse
            c.moveTo(base.x - rx, base.y);
            c.bezierCurveTo(base.x - rx, base.y - h * 1.25, base.x + rx, base.y - h * 1.25, base.x + rx, base.y);
            c.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI, false);
            c.closePath();
            c.fill();
            if (opts.edge) {
                c.strokeStyle = withAlpha(tint(color, -50), 0.6);
                c.lineWidth = 1;
                c.stroke();
            }
        }

        // Thick 3D line (gun barrels, poles, legs)
        rod(x1, y1, z1, x2, y2, z2, width, color) {
            const c = this.ctx;
            const a = this.p(x1, y1, z1);
            const b = this.p(x2, y2, z2);
            c.strokeStyle = color;
            c.lineWidth = width;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(a.x, a.y);
            c.lineTo(b.x, b.y);
            c.stroke();
        }

        // Flat ellipse on the ground plane (pads, pools, shadows)
        disc(cx, cy, z, r, color, opts = {}) {
            const c = this.ctx;
            const s = this.p(cx, cy, z);
            c.fillStyle = color;
            c.beginPath();
            c.ellipse(s.x, s.y, r * 1.414 * (opts.stretchX || 1), r * 0.707 * (opts.stretchY || 1), 0, 0, Math.PI * 2);
            c.fill();
            if (opts.edge) {
                c.strokeStyle = opts.edge;
                c.lineWidth = opts.edgeWidth || 1;
                c.stroke();
            }
        }

        // Glowing dot
        glowDot(x, y, z, r, color) {
            const c = this.ctx;
            const s = this.p(x, y, z);
            c.save();
            c.shadowColor = color;
            c.shadowBlur = r * 3;
            c.fillStyle = color;
            c.beginPath();
            c.arc(s.x, s.y, r, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }

        // Triangular spike pointing along yaw, raked upward
        spike(cx, cy, z, yaw, len, baseW, rise, color) {
            const cos = Math.cos(yaw), sin = Math.sin(yaw);
            const px = -sin, py = cos; // perpendicular
            this.poly([
                [cx + px * baseW / 2, cy + py * baseW / 2, z],
                [cx - px * baseW / 2, cy - py * baseW / 2, z],
                [cx + cos * len, cy + sin * len, z + rise]
            ], color);
        }

        shadow(cx, cy, r, alpha = 0.3, stretch = 1) {
            this.disc(cx, cy, 0, r, `rgba(0,0,0,${alpha})`, { stretchX: stretch });
        }
    }

    // ============================================
    // UNIT SPRITES
    // ============================================

    function wheels(s, yaw, positions, r, color) {
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        for (const [lx, ly] of positions) {
            const x = lx * cos - ly * sin;
            const y = lx * sin + ly * cos;
            s.cyl(x, y, 0, r, r * 1.2, color);
        }
    }

    function treads(s, yaw, len, offset, width, height, color) {
        s.box(Math.sin(yaw) * offset, -Math.cos(yaw) * offset, 0, len, width, height, yaw, color);
        s.box(-Math.sin(yaw) * offset, Math.cos(yaw) * offset, 0, len, width, height, yaw, color);
    }

    function legs(s, yaw, count, spread, len, color, phase = 0) {
        // Insect legs splayed sideways from the body
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        for (let i = 0; i < count; i++) {
            const t = (count === 1) ? 0 : (i / (count - 1) - 0.5) * 2; // -1..1 along body
            const bend = (i % 2 === 0 ? 1 : -1) * phase;
            for (const side of [-1, 1]) {
                const bx = t * spread * cos - side * 4 * sin;
                const by = t * spread * sin + side * 4 * cos;
                const ex = t * (spread + 2 + bend) * cos - side * (len + 2) * sin;
                const ey = t * (spread + 2 + bend) * sin + side * (len + 2) * cos;
                s.rod(bx, by, 6, ex, ey, 0, 2.6, color);
            }
        }
    }

    function rider(s, x, y, z, pal) {
        s.blob(x, y, z, 2.4, 5, pal.cloth);
        const head = s.p(x, y, z + 7);
        s.ctx.fillStyle = pal.skin;
        s.ctx.beginPath();
        s.ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2);
        s.ctx.fill();
    }

    function fwd(yaw, d, side = 0) {
        const cos = Math.cos(yaw), sin = Math.sin(yaw);
        return { x: d * cos - side * sin, y: d * sin + side * cos };
    }

    function drawInfantry(s, yaw, pal, faction, weapon) {
        // legs
        if (faction === 'series9') {
            s.box(0, 0, 0, 4, 4, 3, yaw, pal.tread);
        } else {
            s.rod(-1.2, 0.8, 4, -1.6, 1.4, 0, 1.6, pal.cloth);
            s.rod(1.2, -0.8, 4, 1.6, -1.4, 0, 1.6, pal.cloth);
        }
        // torso
        const torsoCol = faction === 'evolved' ? pal.skin : pal.hull;
        s.blob(0, 0, 3.5, 2.6, 6, torsoCol, { edge: true });
        // head
        const headP = s.p(0, 0, 11.5);
        s.ctx.fillStyle = faction === 'series9' ? pal.metal : pal.skin;
        s.ctx.beginPath();
        s.ctx.arc(headP.x, headP.y, 2.6, 0, Math.PI * 2);
        s.ctx.fill();
        if (faction === 'survivors') {
            // helmet
            s.ctx.fillStyle = pal.hullDark;
            s.ctx.beginPath();
            s.ctx.arc(headP.x, headP.y - 0.7, 2.7, Math.PI, 0);
            s.ctx.fill();
        } else if (faction === 'evolved') {
            // mohawk
            s.ctx.fillStyle = '#cc3322';
            s.ctx.fillRect(headP.x - 0.8, headP.y - 4.4, 1.6, 3);
        } else {
            // robot eye facing forward
            const eye = fwd(yaw, 2);
            s.glowDot(eye.x, eye.y, 11.5, 1, pal.glow);
        }
        // weapon
        const w1 = fwd(yaw, 1, 2);
        const w2 = fwd(yaw, 7, 1.5);
        if (weapon === 'rifle') {
            s.rod(w1.x, w1.y, 7, w2.x, w2.y, 7.5, 1.6, pal.metalDark);
        } else if (weapon === 'flame') {
            s.rod(w1.x, w1.y, 7, w2.x, w2.y, 7, 2.2, pal.metalDark);
            s.glowDot(w2.x, w2.y, 7, 1.3, '#ff8822');
            // fuel tank on the back
            const b = fwd(yaw, -2.5);
            s.cyl(b.x, b.y, 5, 1.4, 5, '#b3622a');
        } else if (weapon === 'rocket') {
            // launcher tube on the shoulder
            const r1 = fwd(yaw, -3, 1.5);
            const r2 = fwd(yaw, 6, 1.5);
            s.rod(r1.x, r1.y, 11, r2.x, r2.y, 12.5, 3, pal.metalDark);
            s.glowDot(r2.x, r2.y, 12.5, 1.2, '#ffaa44');
        }
    }

    const UNIT_BUILDERS = {

        // ---------- infantry ----------
        trooper(s, yaw, pal, faction) {
            s.shadow(0, 0, 4.5, 0.3);
            drawInfantry(s, yaw, pal, faction, 'rifle');
        },
        flamer(s, yaw, pal, faction) {
            s.shadow(0, 0, 4.5, 0.3);
            drawInfantry(s, yaw, pal, faction, 'flame');
        },
        rocketeer(s, yaw, pal, faction) {
            s.shadow(0, 0, 4.5, 0.3);
            drawInfantry(s, yaw, pal, faction, 'rocket');
        },

        // ---------- vehicles ----------
        bike(s, yaw, pal, faction) {
            s.shadow(0, 0, 7, 0.3, 1.1);
            if (faction === 'evolved') {
                // Dire Wolf: lean beast with a rider
                const f = fwd(yaw, 7), b = fwd(yaw, -7);
                legs(s, yaw, 2, 6, 7, pal.hullDark);
                s.blob(0, 0, 5, 5, 9, pal.hull, { edge: true });
                s.blob(f.x, f.y, 7, 3, 5, tint(pal.hull, 8));
                // ears + tail
                s.spike(f.x, f.y, 12, yaw + 2.6, 4, 1.5, 3, pal.hullDark);
                s.spike(b.x, b.y, 7, yaw + Math.PI, 6, 2, 2, pal.hullDark);
                rider(s, b.x * 0.4, b.y * 0.4, 9, pal);
            } else if (faction === 'series9') {
                // Probe: small hover wedge
                s.box(0, 0, 5, 16, 7, 4, yaw, pal.hull, { edge: true });
                const f = fwd(yaw, 8);
                s.spike(f.x, f.y, 5, yaw, 6, 7, 2, tint(pal.hull, -10));
                s.glowDot(f.x * 0.7, f.y * 0.7, 9, 1.8, pal.glow);
                const b = fwd(yaw, -8);
                s.glowDot(b.x, b.y, 6, 1.4, pal.glow);
            } else {
                // Dirt Bike
                const f = fwd(yaw, 6), b = fwd(yaw, -6);
                s.cyl(f.x, f.y, 0, 2.6, 4, pal.tread);
                s.cyl(b.x, b.y, 0, 2.6, 4, pal.tread);
                s.box(0, 0, 3, 13, 4, 4, yaw, pal.hull);
                const h = fwd(yaw, 5);
                s.rod(h.x, h.y, 7, h.x, h.y, 9, 2, pal.metalDark);
                rider(s, -f.x * 0.2, -f.y * 0.2, 6, pal);
            }
        },

        buggy(s, yaw, pal, faction) {
            s.shadow(0, 0, 9, 0.32, 1.1);
            if (faction === 'evolved') {
                // Giant Beetle
                legs(s, yaw, 3, 8, 9, pal.hullDark);
                s.blob(0, 0, 5, 9, 14, pal.hull, { stretchX: 1.15, edge: true });
                // carapace split
                const f = fwd(yaw, 10), b = fwd(yaw, -10);
                s.rod(b.x, b.y, 11, f.x, f.y, 12, 1.4, tint(pal.hullDark, -10));
                // mandibles
                s.spike(f.x, f.y, 4, yaw + 0.45, 7, 2, 1, pal.accent);
                s.spike(f.x, f.y, 4, yaw - 0.45, 7, 2, 1, pal.accent);
                s.glowDot(f.x * 0.85, f.y * 0.85, 8, 1.4, pal.glow);
            } else if (faction === 'series9') {
                // Enforcer: hover skiff with twin emitters
                s.box(0, 0, 4, 20, 12, 5, yaw, pal.hull, { edge: true });
                s.box(0, 0, 9, 11, 8, 4, yaw, tint(pal.hull, 8));
                const m1 = fwd(yaw, 10, 3), m2 = fwd(yaw, 10, -3);
                s.rod(0, 0, 12, m1.x, m1.y, 12, 2.2, pal.metalDark);
                s.rod(0, 0, 12, m2.x, m2.y, 12, 2.2, pal.metalDark);
                s.glowDot(m1.x, m1.y, 12, 1.3, pal.glow);
                s.glowDot(m2.x, m2.y, 12, 1.3, pal.glow);
            } else {
                // ATV with roll cage and MG
                wheels(s, yaw, [[7, 6], [7, -6], [-7, 6], [-7, -6]], 2.6, pal.tread);
                s.box(0, 0, 4, 17, 10, 6, yaw, pal.hull, { edge: true });
                const c1 = fwd(yaw, 4, 4), c2 = fwd(yaw, 4, -4);
                s.rod(c1.x, c1.y, 10, c2.x, c2.y, 10, 1.6, pal.metalDark);
                s.rod(c1.x, c1.y, 10, c1.x, c1.y, 13, 1.6, pal.metalDark);
                s.rod(c2.x, c2.y, 10, c2.x, c2.y, 13, 1.6, pal.metalDark);
                const g = fwd(yaw, 9);
                s.rod(0, 0, 12, g.x, g.y, 12.5, 2, pal.metalDark);
            }
        },

        tank(s, yaw, pal, faction) {
            s.shadow(0, 0, 11, 0.34, 1.1);
            if (faction === 'evolved') {
                // Scorpion: clawed beast with a tail stinger
                legs(s, yaw, 4, 9, 10, pal.hullDark, 1);
                s.blob(0, 0, 5, 10, 13, pal.hull, { stretchX: 1.25, edge: true });
                const f = fwd(yaw, 12);
                s.spike(f.x, f.y, 4, yaw + 0.55, 9, 3, 1, pal.accent);
                s.spike(f.x, f.y, 4, yaw - 0.55, 9, 3, 1, pal.accent);
                // tail arcs over the back, stinger forward
                let px = -10, pz = 8;
                for (let i = 0; i < 4; i++) {
                    const seg = fwd(yaw, px);
                    s.blob(seg.x, seg.y, pz, 2.6 - i * 0.3, 4, tint(pal.hull, -6 + i * 6));
                    px += 4.5; pz += 4;
                }
                const tip = fwd(yaw, 8);
                s.spike(tip.x, tip.y, pz + 2, yaw, 8, 2.5, -2, pal.accent);
                s.glowDot(tip.x, tip.y, pz + 2, 1.6, pal.glow);
            } else if (faction === 'series9') {
                // Sentinel: hover tank with energy cannon
                s.box(0, 0, 4, 24, 15, 6, yaw, pal.hull, { edge: true });
                const skL = fwd(yaw, 0, 9), skR = fwd(yaw, 0, -9);
                s.box(skL.x, skL.y, 3, 20, 3, 3, yaw, pal.hullDark);
                s.box(skR.x, skR.y, 3, 20, 3, 3, yaw, pal.hullDark);
                s.box(-2 * Math.cos(yaw), -2 * Math.sin(yaw), 10, 11, 9, 5, yaw, tint(pal.hull, 10), { edge: true });
                const m = fwd(yaw, 14);
                s.rod(0, 0, 13, m.x, m.y, 13.5, 3.2, pal.metalDark);
                s.glowDot(m.x, m.y, 13.5, 1.8, pal.glow);
                s.glowDot(-6 * Math.cos(yaw), -6 * Math.sin(yaw), 13, 1.5, pal.glow);
            } else {
                // Anaconda: classic tread tank
                treads(s, yaw, 26, 9, 6, 5, pal.tread);
                s.box(0, 0, 5, 24, 15, 6, yaw, pal.hull, { edge: true });
                const t = fwd(yaw, -2);
                s.cyl(t.x, t.y, 11, 6, 5, tint(pal.hull, 6), { edge: true });
                const m = fwd(yaw, 16);
                s.rod(t.x, t.y, 14, m.x, m.y, 14.5, 3, pal.metalDark);
                const mm = fwd(yaw, 19);
                s.rod(fwd(yaw, 17).x, fwd(yaw, 17).y, 14.5, mm.x, mm.y, 14.6, 4, pal.metalDark);
                s.glowDot(t.x - 3, t.y - 3, 17, 1, pal.accent);
            }
        },

        heavy(s, yaw, pal, faction) {
            s.shadow(0, 0, 14, 0.38, 1.15);
            if (faction === 'evolved') {
                // War Mastodon
                const cos = Math.cos(yaw), sin = Math.sin(yaw);
                for (const [lx, ly] of [[8, 8], [8, -8], [-8, 8], [-8, -8]]) {
                    s.cyl(lx * cos - ly * sin, lx * sin + ly * cos, 0, 2.6, 7, pal.hullDark);
                }
                s.blob(0, 0, 7, 12, 17, pal.hull, { stretchX: 1.2, edge: true });
                const h = fwd(yaw, 14);
                s.blob(h.x, h.y, 9, 6, 8, tint(pal.hull, 6), { edge: true });
                // tusks
                s.spike(h.x, h.y, 8, yaw + 0.35, 12, 3, 4, pal.accent);
                s.spike(h.x, h.y, 8, yaw - 0.35, 12, 3, 4, pal.accent);
                // howdah with cannon
                s.box(-4 * cos, -4 * sin, 19, 9, 8, 4, yaw, pal.metalDark, { edge: true });
                const m = fwd(yaw, 10);
                s.rod(-4 * cos, -4 * sin, 22, m.x, m.y, 24, 2.6, pal.tread);
                s.glowDot(h.x + 2, h.y - 2, 14, 1.2, pal.glow);
            } else if (faction === 'series9') {
                // Annihilator: massive hover wedge with twin lances
                s.box(0, 0, 5, 32, 20, 7, yaw, pal.hull, { edge: true });
                s.box(-3 * Math.cos(yaw), -3 * Math.sin(yaw), 12, 18, 13, 6, yaw, tint(pal.hull, 8), { edge: true });
                // central core
                s.glowDot(0, 0, 19, 3, pal.glow);
                for (const side of [4.5, -4.5]) {
                    const m = fwd(yaw, 19, side);
                    s.rod(fwd(yaw, -2, side).x, fwd(yaw, -2, side).y, 16, m.x, m.y, 16.5, 3, pal.metalDark);
                    s.glowDot(m.x, m.y, 16.5, 1.6, pal.glow);
                }
            } else {
                // Juggernaut: twin-cannon land fortress
                treads(s, yaw, 32, 11, 8, 6, pal.tread);
                s.box(0, 0, 6, 30, 19, 7, yaw, pal.hull, { edge: true });
                s.box(-2 * Math.cos(yaw), -2 * Math.sin(yaw), 13, 18, 13, 6, yaw, tint(pal.hull, 7), { edge: true });
                const t = fwd(yaw, -2);
                s.cyl(t.x, t.y, 19, 6.5, 5, tint(pal.hull, 12), { edge: true });
                for (const side of [2.6, -2.6]) {
                    const m = fwd(yaw, 19, side);
                    s.rod(fwd(yaw, -2, side).x, fwd(yaw, -2, side).y, 22, m.x, m.y, 22.5, 2.8, pal.metalDark);
                }
                s.rod(t.x - 4, t.y - 4, 24, t.x - 5, t.y - 5, 30, 1.2, pal.metalDark);
                s.glowDot(t.x - 5, t.y - 5, 30, 1.2, pal.accent);
            }
        },

        artillery(s, yaw, pal, faction) {
            s.shadow(0, 0, 11, 0.34, 1.1);
            if (faction === 'evolved') {
                // Missile Crab
                legs(s, yaw, 3, 8, 11, pal.hullDark, 1);
                s.blob(0, 0, 5, 10, 12, pal.hull, { stretchX: 1.35, edge: true });
                const f = fwd(yaw, 12);
                s.spike(f.x, f.y, 5, yaw + 0.7, 10, 3.5, 1, pal.accent);
                s.spike(f.x, f.y, 5, yaw - 0.7, 10, 3.5, 1, pal.accent);
                // back-mounted missile husks
                for (const side of [3, 0, -3]) {
                    const r = fwd(yaw, -6, side);
                    s.rod(r.x, r.y, 9, r.x - 5 * Math.cos(yaw), r.y - 5 * Math.sin(yaw), 17, 3, pal.metal);
                    s.glowDot(r.x - 5 * Math.cos(yaw), r.y - 5 * Math.sin(yaw), 18.5, 1.3, '#ff6644');
                }
                s.glowDot(f.x * 0.8, f.y * 0.8, 8, 1.3, pal.glow);
            } else if (faction === 'series9') {
                // Tremor: hover mortar platform
                s.box(0, 0, 4, 22, 16, 5, yaw, pal.hull, { edge: true });
                s.cyl(0, 0, 9, 5, 4, tint(pal.hull, 8), { edge: true });
                const m = fwd(yaw, 9);
                s.rod(0, 0, 12, m.x, m.y, 24, 4.5, pal.metalDark);
                s.glowDot(m.x, m.y, 24, 2.2, pal.glow);
                const b = fwd(yaw, -9);
                s.box(b.x, b.y, 9, 6, 10, 4, yaw, pal.hullDark);
            } else {
                // Barrage Craft: wheeled long-gun
                wheels(s, yaw, [[8, 7], [8, -7], [-8, 7], [-8, -7]], 3, pal.tread);
                s.box(0, 0, 5, 20, 12, 5, yaw, pal.hull, { edge: true });
                const piv = fwd(yaw, -4);
                s.cyl(piv.x, piv.y, 10, 4, 3, tint(pal.hull, 8));
                const m = fwd(yaw, 14);
                s.rod(piv.x, piv.y, 12, m.x, m.y, 25, 3.4, pal.metalDark);
                const sup = fwd(yaw, -10);
                s.rod(sup.x, sup.y, 5, sup.x - 4 * Math.cos(yaw), sup.y - 4 * Math.sin(yaw), 0, 2, pal.metalDark);
            }
        },

    };

    // ============================================
    // BUILDING SPRITES
    // ============================================

    function basePlate(s, ft, pal, faction) {
        const a = ft * 30; // slightly inside the exact tile diamond
        s.poly([[a, a, 0], [a, -a, 0], [-a, -a, 0], [-a, a, 0]], pal.base, tint(pal.baseDark, -15));
        // bevel on the south-facing edges
        s.poly([[a, -a, 0], [a, a, 0], [a + 3, a + 3, -2], [a + 3, -a - 3, -2]], tint(pal.baseDark, -8));
        s.poly([[-a, a, 0], [a, a, 0], [a + 3, a + 3, -2], [-a - 3, a + 3, -2]], tint(pal.baseDark, -18));
        if (faction === 'evolved') {
            // organic splatter
            for (let i = 0; i < 5; i++) {
                const ang = i * 2.39996;
                s.disc(Math.cos(ang) * a * 0.5, Math.sin(ang) * a * 0.5, 0.5,
                    4 + (i % 3) * 2, withAlpha(pal.hullDark, 0.35));
            }
        } else {
            // panel seams
            s.ctx.strokeStyle = withAlpha(pal.baseDark, 0.6);
            s.ctx.lineWidth = 1;
            const p1 = s.p(0, -a, 1), p2 = s.p(0, a, 1), p3 = s.p(-a, 0, 1), p4 = s.p(a, 0, 1);
            s.ctx.beginPath();
            s.ctx.moveTo(p1.x, p1.y); s.ctx.lineTo(p2.x, p2.y);
            s.ctx.moveTo(p3.x, p3.y); s.ctx.lineTo(p4.x, p4.y);
            s.ctx.stroke();
        }
    }

    function teamFlag(s, x, y, z, teamColor) {
        s.rod(x, y, z, x, y, z + 14, 1.4, '#888888');
        s.poly([[x, y, z + 14], [x + 9, y - 4, z + 11.5], [x, y, z + 9]], teamColor);
    }

    function smokeStack(s, x, y, h, pal) {
        s.cyl(x, y, 0, 3.5, h, pal.metal, { edge: true });
        s.cyl(x, y, h, 4.2, 2.5, pal.metalDark);
    }

    const BUILDING_BUILDERS = {

        hq(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            if (faction === 'evolved') {
                s.blob(0, 0, 0, a * 0.62, 44, pal.hull, { edge: true });
                s.blob(-a * 0.4, a * 0.35, 0, a * 0.28, 22, tint(pal.hull, -8), { edge: true });
                // entrance maw
                s.disc(a * 0.42, a * 0.42, 1, 9, '#1a0e08', { stretchX: 0.8 });
                // crown of spikes
                for (let i = 0; i < 7; i++) {
                    const ang = (i / 7) * Math.PI * 2;
                    s.spike(Math.cos(ang) * a * 0.4, Math.sin(ang) * a * 0.4, 34, ang, 10, 4, 12, pal.accent);
                }
                s.glowDot(a * 0.2, -a * 0.2, 40, 2.5, pal.glow);
                s.glowDot(-a * 0.25, a * 0.1, 36, 2, pal.glow);
                teamFlag(s, -a * 0.55, -a * 0.55, 18, teamColor);
            } else if (faction === 'series9') {
                s.box(0, 0, 0, a * 1.3, a * 1.3, 13, 0, pal.hull, { edge: true });
                s.box(0, 0, 13, a * 1.0, a * 1.0, 13, 0, tint(pal.hull, 6), { edge: true });
                s.box(0, 0, 26, a * 0.68, a * 0.68, 13, 0, tint(pal.hull, 12), { edge: true });
                // glow seams
                for (const z of [13, 26]) {
                    s.ctx.strokeStyle = withAlpha(pal.glow, 0.8);
                    s.ctx.lineWidth = 1.5;
                    const w = z === 13 ? a : a * 0.68;
                    const pts = [[w, w], [w, -w], [-w, -w]].map(([x, y]) => s.p(x, y, z));
                    s.ctx.beginPath();
                    s.ctx.moveTo(pts[0].x, pts[0].y);
                    pts.forEach(pt => s.ctx.lineTo(pt.x, pt.y));
                    s.ctx.stroke();
                }
                s.rod(0, 0, 39, 0, 0, 58, 2, pal.metalDark);
                s.glowDot(0, 0, 58, 3, pal.glow);
                teamFlag(s, -a * 0.55, -a * 0.55, 14, teamColor);
            } else {
                // Survivors Outpost: bunker complex
                s.box(0, 0, 0, a * 1.25, a * 1.05, 22, 0, pal.hull, { edge: true });
                s.box(-a * 0.15, -a * 0.15, 22, a * 0.75, a * 0.6, 16, 0, tint(pal.hull, 8), { edge: true });
                // windows
                for (let i = -1; i <= 1; i++) {
                    s.poly([[a * 0.63, i * 12 - 4, 10], [a * 0.63, i * 12 + 4, 10], [a * 0.63, i * 12 + 4, 16], [a * 0.63, i * 12 - 4, 16]], pal.window);
                }
                // door
                s.poly([[12, a * 0.53, 0], [26, a * 0.53, 0], [26, a * 0.53, 12], [12, a * 0.53, 12]], '#22241e');
                // comm tower with dish
                s.rod(-a * 0.45, a * 0.3, 22, -a * 0.45, a * 0.3, 52, 2.4, pal.metalDark);
                s.disc(-a * 0.45, a * 0.3, 48, 6, pal.metal, { stretchY: 2.2, edge: tint(pal.metalDark, -10) });
                s.glowDot(-a * 0.45, a * 0.3, 53, 1.8, '#ff5533');
                teamFlag(s, a * 0.4, -a * 0.45, 38, teamColor);
            }
        },

        powerStation(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            // docking pad for tankers (all factions)
            s.disc(a * 0.45, a * 0.45, 0.5, 13, withAlpha('#000000', 0.25), { edge: withAlpha(pal.glow, 0.9), edgeWidth: 2 });
            if (faction === 'evolved') {
                s.blob(-a * 0.3, -a * 0.25, 0, a * 0.4, 30, pal.hull, { edge: true });
                s.blob(a * 0.25, -a * 0.35, 0, a * 0.3, 24, tint(pal.hull, -6), { edge: true });
                // glowing vat mouths
                s.disc(-a * 0.3, -a * 0.25, 30, 8, withAlpha(pal.glow, 0.85), { edge: tint(pal.hullDark, -20) });
                s.disc(a * 0.25, -a * 0.35, 24, 6, withAlpha(pal.glow, 0.7));
                // bone pipe into the pad
                s.rod(-a * 0.1, 0, 12, a * 0.4, a * 0.4, 2, 3.5, pal.accent);
            } else if (faction === 'series9') {
                s.box(-a * 0.15, -a * 0.15, 0, a * 0.9, a * 0.9, 10, 0, pal.hull, { edge: true });
                // fusion ring
                const c = s.p(-a * 0.15, -a * 0.15, 26);
                s.ctx.strokeStyle = pal.metal;
                s.ctx.lineWidth = 5;
                s.ctx.beginPath();
                s.ctx.ellipse(c.x, c.y, 24, 12, 0, 0, Math.PI * 2);
                s.ctx.stroke();
                s.ctx.strokeStyle = withAlpha(pal.glow, 0.9);
                s.ctx.lineWidth = 2;
                s.ctx.stroke();
                s.glowDot(-a * 0.15, -a * 0.15, 26, 4.5, pal.glow);
                s.rod(-a * 0.15, -a * 0.15, 10, -a * 0.15, -a * 0.15, 20, 3, pal.metalDark);
            } else {
                s.box(-a * 0.25, -a * 0.2, 0, a * 0.75, a * 0.75, 16, 0, pal.hull, { edge: true });
                // twin oil silos
                s.cyl(a * 0.35, -a * 0.4, 0, 9, 26, pal.metal, { edge: true });
                s.cyl(a * 0.05, -a * 0.55, 0, 7, 20, pal.metal, { edge: true });
                smokeStack(s, -a * 0.5, a * 0.15, 34, pal);
                // pipe to pad
                s.rod(0, 0, 8, a * 0.42, a * 0.42, 2, 3, pal.metalDark);
                s.glowDot(-a * 0.5, a * 0.15, 36, 1.6, '#ff7733');
            }
        },

        derrick(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            // oil pool glints
            s.disc(a * 0.4, a * 0.4, 0.5, 8, '#14120e', { edge: withAlpha('#3a3a2a', 0.8) });
            if (faction === 'evolved') {
                // Pump Beast: breathing blob with proboscis in the ground
                const squash = frame === 0 ? 1 : 0.88;
                s.blob(-a * 0.1, -a * 0.1, 0, a * 0.42, 30 * squash, pal.hull, { edge: true });
                s.blob(-a * 0.1, -a * 0.1, 30 * squash - 6, a * 0.18, 10, tint(pal.hull, 10));
                // proboscis
                s.rod(-a * 0.1 + 8, -a * 0.1 + 8, 14 * squash, a * 0.4, a * 0.4, 1, 4.5, pal.hullDark);
                s.glowDot(-a * 0.2, -a * 0.25, 22 * squash, 1.8, pal.glow);
                s.glowDot(0, -a * 0.05, 25 * squash, 1.5, pal.glow);
            } else if (faction === 'series9') {
                // Auto Extractor: pumping piston
                const lift = frame === 0 ? 0 : 7;
                s.box(-a * 0.1, -a * 0.1, 0, a * 0.7, a * 0.7, 7, 0, pal.hull, { edge: true });
                s.cyl(-a * 0.1, -a * 0.1, 7, 8, 16, pal.metal, { edge: true });
                s.cyl(-a * 0.1, -a * 0.1, 23, 5, 8 + lift, tint(pal.metal, 12), { edge: true });
                s.glowDot(-a * 0.1, -a * 0.1, 33 + lift, 2.2, pal.glow);
                s.rod(-a * 0.1, -a * 0.1, 10, a * 0.4, a * 0.4, 1, 2.5, pal.metalDark);
            } else {
                // Classic lattice derrick with a nodding pump
                const top = [-a * 0.1, -a * 0.1, 46];
                const legsB = [[-a * 0.38, -a * 0.38], [a * 0.18, -a * 0.38], [a * 0.18, a * 0.18], [-a * 0.38, a * 0.18]];
                for (const [lx, ly] of legsB) {
                    s.rod(lx, ly, 0, top[0], top[1], top[2], 2, pal.metalDark);
                }
                // cross braces
                s.rod(legsB[0][0], legsB[0][1], 14, legsB[1][0], legsB[1][1], 14, 1.2, pal.metalDark);
                s.rod(legsB[1][0], legsB[1][1], 14, legsB[2][0], legsB[2][1], 14, 1.2, pal.metalDark);
                s.rod(legsB[0][0], legsB[0][1], 28, legsB[1][0], legsB[1][1], 28, 1.2, pal.metalDark);
                // nodding donkey beam
                const tiltZ = frame === 0 ? 6 : -4;
                s.rod(-a * 0.1, -a * 0.1, 38, a * 0.42, a * 0.42, 20 + tiltZ, 3, pal.hull);
                s.rod(-a * 0.1 - 10, -a * 0.1 - 10, 38, -a * 0.1, -a * 0.1, 38, 3.5, pal.hullDark);
                // pump head into the pool
                s.rod(a * 0.42, a * 0.42, 20 + tiltZ, a * 0.42, a * 0.42, 2, 2.5, pal.metalDark);
                s.glowDot(top[0], top[1], top[2] + 2, 1.5, '#ff7733');
                // small shed
                s.box(a * 0.3, -a * 0.35, 0, 16, 12, 9, 0, pal.hull, { edge: true });
            }
        },

        barracks(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            if (faction === 'evolved') {
                // hide tent with bone poles
                s.blob(0, 0, 0, a * 0.55, 26, pal.roof, { edge: true });
                s.rod(-a * 0.4, -a * 0.4, 0, 0, 0, 34, 2.2, pal.accent);
                s.rod(a * 0.4, -a * 0.4, 0, 0, 0, 34, 2.2, pal.accent);
                s.disc(a * 0.35, a * 0.35, 1, 7, '#1a0e08', { stretchX: 0.7 });
                // skull totem
                s.rod(-a * 0.5, a * 0.3, 0, -a * 0.5, a * 0.3, 16, 1.8, pal.accent);
                const sk = s.p(-a * 0.5, a * 0.3, 18);
                s.ctx.fillStyle = pal.accent;
                s.ctx.beginPath(); s.ctx.arc(sk.x, sk.y, 3.5, 0, Math.PI * 2); s.ctx.fill();
                s.ctx.fillStyle = '#1a0e08';
                s.ctx.fillRect(sk.x - 2, sk.y - 1, 1.5, 1.5);
                s.ctx.fillRect(sk.x + 0.5, sk.y - 1, 1.5, 1.5);
            } else if (faction === 'series9') {
                s.blob(0, -a * 0.1, 0, a * 0.5, 24, pal.hull, { edge: true });
                s.poly([[8, a * 0.42, 0], [22, a * 0.42, 0], [22, a * 0.42, 11], [8, a * 0.42, 11]], withAlpha(pal.glow, 0.85));
                for (let i = 0; i < 3; i++) {
                    s.glowDot(-a * 0.3 + i * 12, -a * 0.45, 16, 1.3, pal.glow);
                }
            } else {
                // long hut with pitched roof
                s.box(0, 0, 0, a * 1.1, a * 0.62, 13, 0, pal.hull, { edge: true });
                s.poly([[-a * 0.58, -a * 0.34, 13], [a * 0.58, -a * 0.34, 13], [a * 0.58, 0, 22], [-a * 0.58, 0, 22]], tint(pal.roof, 10));
                s.poly([[-a * 0.58, a * 0.34, 13], [a * 0.58, a * 0.34, 13], [a * 0.58, 0, 22], [-a * 0.58, 0, 22]], tint(pal.roof, -14));
                // door + sandbags
                s.poly([[-6, a * 0.32, 0], [8, a * 0.32, 0], [8, a * 0.32, 10], [-6, a * 0.32, 10]], '#22241e');
                for (let i = 0; i < 4; i++) {
                    s.disc(-a * 0.45 + i * 9, a * 0.5, 1.5, 3.2, tint(pal.base, -8));
                }
                teamFlag(s, a * 0.48, -a * 0.3, 22, teamColor);
            }
        },

        factory(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            if (faction === 'evolved') {
                // huge ribbed carapace
                s.blob(0, 0, 0, a * 0.6, 38, pal.hull, { stretchX: 1.15, edge: true });
                const c0 = s.p(0, 0, 0);
                s.ctx.strokeStyle = withAlpha(pal.hullDark, 0.7);
                s.ctx.lineWidth = 2;
                for (let i = -2; i <= 2; i++) {
                    s.ctx.beginPath();
                    s.ctx.ellipse(c0.x + i * 16, c0.y - 18, 10, 26, 0, -Math.PI * 0.45, Math.PI * 0.45);
                    s.ctx.stroke();
                }
                // mouth gate
                s.disc(a * 0.45, a * 0.45, 1, 11, '#1a0e08', { stretchX: 0.8, edge: withAlpha(pal.glow, 0.7), edgeWidth: 2 });
                s.spike(a * 0.3, a * 0.5, 8, 2.2, 8, 3, 6, pal.accent);
                s.spike(a * 0.5, a * 0.3, 8, 0.6, 8, 3, 6, pal.accent);
            } else if (faction === 'series9') {
                s.box(0, 0, 0, a * 1.15, a * 1.0, 18, 0, pal.hull, { edge: true });
                s.poly([[-a * 0.6, -a * 0.52, 18], [a * 0.6, -a * 0.52, 18], [a * 0.6, a * 0.1, 30], [-a * 0.6, a * 0.1, 30]], tint(pal.hull, 10));
                // glowing slit door
                s.poly([[2, a * 0.52, 0], [30, a * 0.52, 0], [30, a * 0.52, 14], [2, a * 0.52, 14]], '#101418');
                s.poly([[4, a * 0.53, 5], [28, a * 0.53, 5], [28, a * 0.53, 9], [4, a * 0.53, 9]], withAlpha(pal.glow, 0.9));
                smokeStack(s, -a * 0.42, -a * 0.3, 30, pal);
                s.glowDot(-a * 0.42, -a * 0.3, 33, 2, pal.glow);
            } else {
                // industrial hall with sawtooth roof and gate
                s.box(0, 0, 0, a * 1.2, a * 0.95, 17, 0, pal.hull, { edge: true });
                for (let i = -1; i <= 1; i++) {
                    s.poly([[i * a * 0.4 - a * 0.18, -a * 0.48, 17], [i * a * 0.4 + a * 0.18, -a * 0.48, 17],
                            [i * a * 0.4 + a * 0.18, a * 0.48, 17], [i * a * 0.4 - a * 0.18, a * 0.48, 17]], tint(pal.roof, -4));
                    s.poly([[i * a * 0.4 - a * 0.18, -a * 0.48, 17], [i * a * 0.4 - a * 0.18, a * 0.48, 17],
                            [i * a * 0.4 - a * 0.06, a * 0.48, 26], [i * a * 0.4 - a * 0.06, -a * 0.48, 26]], tint(pal.roof, 8));
                }
                // big gate with hazard stripe
                s.poly([[6, a * 0.49, 0], [34, a * 0.49, 0], [34, a * 0.49, 13], [6, a * 0.49, 13]], '#2a2c26');
                s.poly([[6, a * 0.5, 11], [34, a * 0.5, 11], [34, a * 0.5, 13], [6, a * 0.5, 13]], pal.accent);
                smokeStack(s, -a * 0.45, -a * 0.25, 32, pal);
                teamFlag(s, a * 0.5, -a * 0.45, 26, teamColor);
            }
        },

        researchLab(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            if (faction === 'evolved') {
                // alchemy cauldron
                s.cyl(0, 0, 0, a * 0.32, 16, pal.hullDark, { edge: true });
                s.disc(0, 0, 16, a * 0.28, withAlpha(pal.glow, 0.9));
                s.glowDot(-4, -2, 19, 2, pal.glow);
                s.glowDot(5, 1, 18, 1.4, pal.glow);
                // bone tripod
                s.rod(-a * 0.45, -a * 0.4, 0, 0, 0, 30, 2, pal.accent);
                s.rod(a * 0.45, -a * 0.4, 0, 0, 0, 30, 2, pal.accent);
                s.rod(0, a * 0.55, 0, 0, 0, 30, 2, pal.accent);
            } else if (faction === 'series9') {
                // data spire with rings
                s.cyl(0, 0, 0, a * 0.3, 10, pal.hull, { edge: true });
                s.cyl(0, 0, 10, a * 0.2, 14, tint(pal.hull, 8), { edge: true });
                s.cyl(0, 0, 24, a * 0.12, 12, tint(pal.hull, 14), { edge: true });
                for (const z of [12, 22, 32]) {
                    const c = s.p(0, 0, z);
                    s.ctx.strokeStyle = withAlpha(pal.glow, 0.85);
                    s.ctx.lineWidth = 1.6;
                    s.ctx.beginPath();
                    s.ctx.ellipse(c.x, c.y, a * 0.34 - z * 0.3, (a * 0.34 - z * 0.3) / 2, 0, 0, Math.PI * 2);
                    s.ctx.stroke();
                }
                s.glowDot(0, 0, 42, 3, pal.glow);
            } else {
                s.box(0, 0, 0, a * 0.95, a * 0.8, 12, 0, pal.hull, { edge: true });
                s.blob(-a * 0.08, -a * 0.08, 12, a * 0.3, 16, pal.metal, { edge: true });
                s.rod(a * 0.35, a * 0.25, 12, a * 0.35, a * 0.25, 34, 1.8, pal.metalDark);
                s.disc(a * 0.35, a * 0.25, 31, 4.5, pal.metal, { stretchY: 2, edge: pal.metalDark });
                s.poly([[a * 0.49, -8, 4], [a * 0.49, 8, 4], [a * 0.49, 8, 9], [a * 0.49, -8, 9]], pal.window);
                s.glowDot(-a * 0.08, -a * 0.08, 30, 1.6, pal.glow);
            }
        },

        repairBay(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            // repair pad
            s.disc(2, 2, 0.5, a * 0.32, withAlpha('#000000', 0.22), { edge: withAlpha(pal.glow, 0.8), edgeWidth: 2 });
            if (faction === 'evolved') {
                // healing pool
                s.disc(0, 0, 1, a * 0.38, withAlpha(pal.glow, 0.5), { edge: tint(pal.hullDark, -10), edgeWidth: 3 });
                for (let i = 0; i < 4; i++) {
                    const ang = i * 1.7;
                    s.glowDot(Math.cos(ang) * a * 0.2, Math.sin(ang) * a * 0.2, 2, 1.5, pal.glow);
                }
                for (let i = 0; i < 5; i++) {
                    const ang = i / 5 * Math.PI * 2 + 0.4;
                    s.spike(Math.cos(ang) * a * 0.46, Math.sin(ang) * a * 0.46, 0, ang, 6, 3, 14, pal.accent);
                }
            } else if (faction === 'series9') {
                // robotic service arms
                s.box(-a * 0.42, -a * 0.42, 0, 16, 16, 20, 0, pal.hull, { edge: true });
                s.rod(-a * 0.38, -a * 0.38, 20, 0, 0, 14, 2.6, pal.metalDark);
                s.rod(0, 0, 14, 4, 4, 6, 2.2, pal.metal);
                s.glowDot(4, 4, 6, 1.6, pal.glow);
            } else {
                // gantry frame with hook
                s.box(-a * 0.5, 0, 0, 10, a * 0.85, 24, 0, pal.hull, { edge: true });
                s.box(a * 0.5, 0, 0, 10, a * 0.85, 24, 0, pal.hull, { edge: true });
                s.box(0, 0, 24, a * 1.1, 12, 5, 0, pal.accent, { edge: true });
                s.rod(2, 2, 24, 2, 2, 14, 1.4, pal.metalDark);
                const hook = s.p(2, 2, 12);
                s.ctx.strokeStyle = pal.metalDark;
                s.ctx.lineWidth = 2;
                s.ctx.beginPath();
                s.ctx.arc(hook.x, hook.y, 3, -0.5, Math.PI);
                s.ctx.stroke();
            }
        },

        tower(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            const yaw = Math.PI / 4; // face the camera
            if (faction === 'evolved') {
                s.blob(0, 0, 0, a * 0.55, 30, pal.hull, { edge: true });
                for (let i = 0; i < 3; i++) {
                    const ang = i / 3 * Math.PI * 2 + 0.5;
                    s.spike(Math.cos(ang) * 6, Math.sin(ang) * 6, 28, ang, 8, 3, 10, pal.accent);
                }
                // thrower arm
                s.rod(0, 0, 26, Math.cos(yaw) * 16, Math.sin(yaw) * 16, 32, 3, pal.hullDark);
                s.glowDot(Math.cos(yaw) * 16, Math.sin(yaw) * 16, 32, 1.8, pal.glow);
            } else if (faction === 'series9') {
                s.cyl(0, 0, 0, a * 0.35, 22, pal.hull, { edge: true });
                s.glowDot(0, 0, 28, 3.5, pal.glow);
                for (let i = 0; i < 3; i++) {
                    const ang = i / 3 * Math.PI * 2;
                    s.rod(Math.cos(ang) * 6, Math.sin(ang) * 6, 22, Math.cos(ang) * 9, Math.sin(ang) * 9, 32, 1.8, pal.metalDark);
                }
            } else {
                s.cyl(0, 0, 0, a * 0.38, 20, pal.hull, { edge: true });
                s.box(0, 0, 20, 16, 16, 8, yaw, tint(pal.hull, 8), { edge: true });
                const m = fwd(yaw, 15);
                s.rod(0, 0, 25, m.x, m.y, 25.5, 2.6, pal.metalDark);
                // sandbag ring
                for (let i = 0; i < 6; i++) {
                    const ang = i / 6 * Math.PI * 2;
                    s.disc(Math.cos(ang) * a * 0.55, Math.sin(ang) * a * 0.55, 1, 3, tint(pal.base, -10));
                }
            }
        },

        towerHeavy(s, ft, pal, faction, frame, teamColor) {
            basePlate(s, ft, pal, faction);
            const a = ft * 30;
            const yaw = Math.PI / 4;
            if (faction === 'evolved') {
                s.blob(0, 0, 0, a * 0.5, 22, pal.hull, { edge: true });
                // bloated acid sac
                s.blob(0, 0, 20, a * 0.32, 16, tint(pal.glow, -25), { edge: true });
                s.glowDot(-3, -3, 30, 2.5, pal.glow);
                // lobber arm
                s.rod(0, 0, 30, Math.cos(yaw) * 14, Math.sin(yaw) * 14, 42, 3.5, pal.hullDark);
                s.glowDot(Math.cos(yaw) * 14, Math.sin(yaw) * 14, 42, 2.2, pal.glow);
            } else if (faction === 'series9') {
                s.cyl(0, 0, 0, a * 0.4, 18, pal.hull, { edge: true });
                s.cyl(0, 0, 18, a * 0.22, 8, tint(pal.hull, 10), { edge: true });
                s.glowDot(0, 0, 32, 4.5, pal.glow);
                for (let i = 0; i < 4; i++) {
                    const ang = i / 4 * Math.PI * 2 + 0.4;
                    s.rod(Math.cos(ang) * 5, Math.sin(ang) * 5, 26, Math.cos(ang) * 10, Math.sin(ang) * 10, 40, 2, pal.metalDark);
                }
            } else {
                s.box(0, 0, 0, a * 0.85, a * 0.85, 14, 0, pal.hull, { edge: true });
                s.cyl(0, 0, 14, a * 0.3, 10, tint(pal.hull, 8), { edge: true });
                for (const side of [3, -3]) {
                    const m = fwd(yaw, 19, side);
                    s.rod(fwd(yaw, 0, side).x, fwd(yaw, 0, side).y, 28, m.x, m.y, 29, 3, pal.metalDark);
                }
                s.glowDot(-6, -6, 26, 1.4, pal.accent);
            }
        }
    };

    // ============================================
    // PUBLIC API
    // ============================================

    function unitSprite(role, faction, dirIndex) {
        const key = `u|${role}|${faction}|${dirIndex}`;
        if (cache.has(key)) return cache.get(key);

        const big = (role === 'heavy' || role === 'tanker' || role === 'artillery');
        const size = big ? 132 : 104;
        const s = new Surface(size, size, size / 2, size * 0.62);
        const yaw = (dirIndex / DIRS) * Math.PI * 2;
        const pal = FACTIONS[faction].palette;
        const builder = UNIT_BUILDERS[role];
        if (builder) builder(s, yaw, pal, faction);
        cache.set(key, s.canvas);
        return s.canvas;
    }

    function buildingSprite(role, faction, frame = 0) {
        const type = BUILDING_TYPES[role];
        const ft = type ? type.size : 2;
        const key = `b|${role}|${faction}|${frame}`;
        if (cache.has(key)) return cache.get(key);

        const w = ft * 64 + 56;
        const h = ft * 32 + 110;
        const s = new Surface(w, h, w / 2, h - ft * 16 - 14);
        // baked drop shadow toward the south-east
        s.ctx.save();
        s.ctx.translate(6, 4);
        s.disc(0, 0, ft * 26, 'rgba(0,0,0,0.28)');
        s.ctx.restore();
        const pal = FACTIONS[faction].palette;
        const teamColor = FACTIONS[faction].color;
        const builder = BUILDING_BUILDERS[role];
        if (builder) builder(s, ft, pal, faction, frame, teamColor);
        cache.set(key, s.canvas);
        return s.canvas;
    }

    // Small icon (data URL) for sidebar buttons
    function icon(kind, role, faction) {
        const key = `${kind}|${role}|${faction}`;
        if (iconCache.has(key)) return iconCache.get(key);
        const src = kind === 'unit'
            ? unitSprite(role, faction, 3) // 3/4 front view
            : buildingSprite(role, faction, 0);
        const c = document.createElement('canvas');
        c.width = 44; c.height = 44;
        const cc = c.getContext('2d');
        const scale = Math.min(44 / src.width, 44 / src.height) * (kind === 'unit' ? 1.55 : 1.15);
        const dw = src.width * scale, dh = src.height * scale;
        cc.drawImage(src, (44 - dw) / 2, (44 - dh) / 2 + (kind === 'unit' ? -4 : 2), dw, dh);
        const url = c.toDataURL();
        iconCache.set(key, url);
        return url;
    }

    function dirFromAngle(angle) {
        return Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2) * DIRS) % DIRS;
    }

    return { unitSprite, buildingSprite, icon, dirFromAngle, DIRS, tint, withAlpha };
})();
