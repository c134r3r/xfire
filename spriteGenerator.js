// ============================================
// XFire Krossfire - Isometric Sprite Factory (v2)
// Procedurally models every unit and building out of lit 3D
// primitives and bakes them into cached sprites:
//   - per-face Lambert lighting (sun from the upper left), warm
//     highlights / cool shadows, bevelled top edges, contact shadows
//   - team colors painted onto every unit and building (stripes,
//     flags, lights), so friend and foe read instantly
//   - 16 facing directions, walk cycles for infantry and beasts
//   - rendered 3x supersampled, stored at 2x for crisp zoom / HiDPI
// Local coordinates: x = east, y = south (world axes), z = up;
// 32 units = 1 tile. Projection: sx = x - y, sy = (x + y) / 2 - z.
// ============================================

const IsoSprites = (() => {

    const DIRS = 16;
    const SS = 3;          // supersampling while drawing
    const OUT = 2;         // stored resolution multiple
    const cache = new Map();
    const iconCache = new Map();

    // light direction (normalized): from the west/north-west, high up
    const L = (() => { const v = [-0.45, 0.35, 0.82]; const n = Math.hypot(...v); return v.map(c => c / n); })();

    // ---------- color helpers ----------
    const clamp255 = v => Math.max(0, Math.min(255, Math.round(v)));
    function hexRGB(color) {
        if (Array.isArray(color)) return color;
        const num = parseInt(color.replace('#', ''), 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    function rgbStr(c, a) {
        return a === undefined ? `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`
            : `rgba(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])},${a})`;
    }
    function tint(color, percent) {
        const c = hexRGB(color);
        const amt = 2.55 * percent;
        const h = (v) => clamp255(v + amt).toString(16).padStart(2, '0');
        return '#' + h(c[0]) + h(c[1]) + h(c[2]);
    }
    function withAlpha(color, a) {
        const c = hexRGB(color);
        return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    }
    function mixHex(a, b, t) {
        const x = hexRGB(a), y = hexRGB(b);
        return rgbStr([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
    }
    // Lambert shading with a warm key light and cool ambient
    function shade(color, n) {
        const c = hexRGB(color);
        const len = Math.hypot(n[0], n[1], n[2]) || 1;
        const d = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len;
        const lit = Math.max(0, d);
        const k = 0.46 + lit * 0.64 + (n[2] / len) * 0.06;
        return rgbStr([c[0] * k + lit * 10 - (1 - lit) * 3, c[1] * k + lit * 6 - (1 - lit) * 1, c[2] * k - lit * 2 + (1 - lit) * 5]);
    }

    const rot = (yaw, x, y) => [x * Math.cos(yaw) - y * Math.sin(yaw), x * Math.sin(yaw) + y * Math.cos(yaw)];
    function fwd(yaw, d, side = 0) {
        const [x, y] = rot(yaw, d, side);
        return { x, y };
    }

    // ---------- drawing surface ----------
    class Surface {
        constructor(w, h, ax, ay) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = w * SS;
            this.canvas.height = h * SS;
            this.canvas.logicalWidth = w;
            this.canvas.logicalHeight = h;
            this.canvas.anchorX = ax;
            this.canvas.anchorY = ay;
            this.ctx = this.canvas.getContext('2d');
            this.ctx.scale(SS, SS);
            this.ctx.lineJoin = 'round';
            this.ax = ax;
            this.ay = ay;
            this.pulse = 1;
        }

        p(x, y, z) {
            return { x: this.ax + (x - y), y: this.ay + (x + y) * 0.5 - (z || 0) };
        }

        path(pts) {
            const c = this.ctx;
            c.beginPath();
            pts.forEach((pt, i) => {
                const s = this.p(pt[0], pt[1], pt[2] || 0);
                if (i === 0) c.moveTo(s.x, s.y); else c.lineTo(s.x, s.y);
            });
            c.closePath();
        }

        poly(points, color, strokeColor, lw = 0.8) {
            this.path(points);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            if (strokeColor) {
                this.ctx.strokeStyle = strokeColor;
                this.ctx.lineWidth = lw;
                this.ctx.stroke();
            }
        }

        // Generic convex solid: a bottom ring and a top ring of 3D points
        // (same count, matching order). Every face is Lambert-lit and
        // back-face culled; the top rim gets a bevel highlight.
        solid(bottom, top, color, opts = {}) {
            const n = bottom.length;
            let cx = 0, cy = 0, cz = 0;
            for (const p of bottom.concat(top)) { cx += p[0]; cy += p[1]; cz += p[2]; }
            cx /= 2 * n; cy /= 2 * n; cz /= 2 * n;
            const faces = [];
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                const b0 = bottom[i], b1 = bottom[j], t0 = top[i], t1 = top[j];
                const ux = b1[0] - b0[0], uy = b1[1] - b0[1], uz = b1[2] - b0[2];
                const vx = t0[0] - b0[0], vy = t0[1] - b0[1], vz = t0[2] - b0[2];
                let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
                const mx = (b0[0] + b1[0] + t0[0] + t1[0]) / 4 - cx;
                const my = (b0[1] + b1[1] + t0[1] + t1[1]) / 4 - cy;
                const mz = (b0[2] + b1[2] + t0[2] + t1[2]) / 4 - cz;
                if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
                if (nx + ny + nz <= 0.0001) continue; // faces away from the camera
                faces.push({ pts: [b0, b1, t1, t0], n: [nx, ny, nz], d: mx + my - mz * 0.1, i });
            }
            faces.sort((a, b) => a.d - b.d);
            for (const f of faces) {
                this.poly(f.pts, shade(color, f.n));
                if (opts.band) {
                    // horizontal band (team stripe, window strip) across the face
                    const [z0, z1, bc] = opts.band;
                    const lerpZ = (a, b, z) => {
                        const t = (z - a[2]) / ((b[2] - a[2]) || 1);
                        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z];
                    };
                    const [b0, b1, t1, t0] = f.pts;
                    this.poly([lerpZ(b0, t0, z0), lerpZ(b1, t1, z0), lerpZ(b1, t1, z1), lerpZ(b0, t0, z1)], shade(bc, f.n));
                }
                if (opts.grime !== false && Math.abs(f.pts[3][2] - f.pts[0][2]) > 5) {
                    // ambient occlusion where the face meets what's below
                    const [b0, b1, t1, t0] = f.pts;
                    const k = 0.3;
                    const m = (a, b) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
                    this.poly([b0, b1, m(b1, t1), m(b0, t0)], 'rgba(12,10,8,0.2)');
                }
            }
            // top face
            const topColor = opts.topColor || color;
            let tnx = 0, tny = 0, tnz = 1;
            if (top.length >= 3) {
                const a = top[0], b = top[1], c = top[2];
                const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
                const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
                tnx = uy * vz - uz * vy; tny = uz * vx - ux * vz; tnz = ux * vy - uy * vx;
                if (tnz < 0) { tnx = -tnx; tny = -tny; tnz = -tnz; }
            }
            this.poly(top, shade(topColor, [tnx, tny, tnz]));
            if (opts.topMark) {
                const [scale, mc] = opts.topMark;
                let tx = 0, ty = 0, tz = 0;
                for (const p of top) { tx += p[0]; ty += p[1]; tz += p[2]; }
                tx /= n; ty /= n; tz /= n;
                this.poly(top.map(p => [tx + (p[0] - tx) * scale, ty + (p[1] - ty) * scale, tz + (p[2] - tz) * scale + 0.05]),
                    shade(mc, [tnx, tny, tnz]));
            }
            // bevel: light rim on edges facing the sun, dark lip elsewhere
            if (opts.bevel !== false) {
                const c = this.ctx;
                let tx = 0, ty = 0;
                for (const p of top) { tx += p[0]; ty += p[1]; }
                tx /= n; ty /= n;
                c.lineWidth = 0.7;
                for (let i = 0; i < n; i++) {
                    const a = top[i], b = top[(i + 1) % n];
                    const ox = (a[0] + b[0]) / 2 - tx, oy = (a[1] + b[1]) / 2 - ty;
                    const lit = ox * L[0] + oy * L[1] > 0;
                    const pa = this.p(a[0], a[1], a[2]), pb = this.p(b[0], b[1], b[2]);
                    c.strokeStyle = lit ? 'rgba(255,244,214,0.42)' : 'rgba(20,14,8,0.32)';
                    c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
                }
            }
        }

        // Rotated box; w along the local forward axis, l sideways.
        // opts: taper (front top pulled back), back (rear top pulled in),
        // inset (all-round slope), band, topMark, topColor
        box(cx, cy, z, w, l, h, yaw, color, opts = {}) {
            const hw = w / 2, hl = l / 2;
            const ins = opts.inset || 0, tf = opts.taper || 0, tb = opts.back || 0;
            const sideIns = opts.sideInset !== undefined ? opts.sideInset : ins;
            const B = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
            const T = [[-hw + ins + tb, -hl + sideIns], [hw - ins - tf, -hl + sideIns], [hw - ins - tf, hl - sideIns], [-hw + ins + tb, hl - sideIns]];
            const tr = ([x, y], zz) => { const [rx, ry] = rot(yaw || 0, x, y); return [cx + rx, cy + ry, zz]; };
            this.solid(B.map(p => tr(p, z)), T.map(p => tr(p, z + h)), color, opts);
        }

        // Vertical cylinder (or cone with rTop) with smooth shading
        cyl(cx, cy, z, r, h, color, opts = {}) {
            const c = this.ctx;
            const rt = opts.rTop !== undefined ? opts.rTop : r;
            const base = this.p(cx, cy, z), top = this.p(cx, cy, z + h);
            const rx = r * 1.414, ry = r * 0.707, rtx = rt * 1.414, rty = rt * 0.707;
            const g = c.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
            const col = hexRGB(color);
            const sh = (k) => rgbStr([col[0] * k, col[1] * k, col[2] * k]);
            g.addColorStop(0, sh(0.78));
            g.addColorStop(0.28, sh(1.05));
            g.addColorStop(0.42, sh(1.12));
            g.addColorStop(0.75, sh(0.62));
            g.addColorStop(1, sh(0.46));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(top.x - rtx, top.y);
            c.lineTo(base.x - rx, base.y);
            c.ellipse(base.x, base.y, rx, ry, 0, Math.PI, 0, true);
            c.lineTo(top.x + rtx, top.y);
            c.ellipse(top.x, top.y, rtx, rty, 0, 0, Math.PI, false);
            c.closePath();
            c.fill();
            if (opts.band) {
                const [z0, z1, bc] = opts.band;
                const bcol = hexRGB(bc);
                const g2 = c.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
                g2.addColorStop(0, rgbStr(bcol.map(v => v * 0.8)));
                g2.addColorStop(0.4, rgbStr(bcol.map(v => v * 1.1)));
                g2.addColorStop(1, rgbStr(bcol.map(v => v * 0.5)));
                const b0 = this.p(cx, cy, z + z0), b1 = this.p(cx, cy, z + z1);
                const rr = r + (rt - r) * (z0 / h);
                c.fillStyle = g2;
                c.beginPath();
                c.moveTo(b1.x - rr * 1.414, b1.y);
                c.lineTo(b0.x - rr * 1.414, b0.y);
                c.ellipse(b0.x, b0.y, rr * 1.414, rr * 0.707, 0, Math.PI, 0, true);
                c.lineTo(b1.x + rr * 1.414, b1.y);
                c.ellipse(b1.x, b1.y, rr * 1.414, rr * 0.707, 0, 0, Math.PI, false);
                c.closePath();
                c.fill();
            }
            if (opts.noTop) return;
            c.fillStyle = rgbStr(hexRGB(opts.topColor || color).map(v => v * 1.08));
            c.beginPath();
            c.ellipse(top.x, top.y, rtx, rty, 0, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = 'rgba(255,240,210,0.3)';
            c.lineWidth = 0.6;
            c.beginPath();
            c.ellipse(top.x, top.y, rtx, rty, 0, Math.PI * 0.95, Math.PI * 1.75);
            c.stroke();
        }

        // Barrel / pipe / limb: a shaded tube between two 3D points
        tube(x1, y1, z1, x2, y2, z2, r, color, opts = {}) {
            const c = this.ctx;
            const a = this.p(x1, y1, z1), b = this.p(x2, y2, z2);
            const col = hexRGB(color);
            c.lineCap = opts.cap || 'round';
            c.strokeStyle = rgbStr(col.map(v => v * 0.5));
            c.lineWidth = r * 2;
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            c.strokeStyle = rgbStr(col.map(v => v * 0.92));
            c.lineWidth = r * 1.35;
            c.beginPath(); c.moveTo(a.x, a.y - r * 0.18); c.lineTo(b.x, b.y - r * 0.18); c.stroke();
            c.strokeStyle = rgbStr(col.map(v => Math.min(255, v * 1.35 + 18)));
            c.lineWidth = Math.max(0.5, r * 0.45);
            c.beginPath(); c.moveTo(a.x, a.y - r * 0.5); c.lineTo(b.x, b.y - r * 0.5); c.stroke();
            c.lineCap = 'butt';
        }

        // Shaded ball
        sphere(cx, cy, z, r, color) {
            const c = this.ctx;
            const s = this.p(cx, cy, z);
            const col = hexRGB(color);
            const g = c.createRadialGradient(s.x - r * 0.4, s.y - r * 0.45, r * 0.1, s.x, s.y, r * 1.05);
            g.addColorStop(0, rgbStr(col.map(v => Math.min(255, v * 1.35 + 20))));
            g.addColorStop(0.5, rgbStr(col));
            g.addColorStop(1, rgbStr(col.map(v => v * 0.5)));
            c.fillStyle = g;
            c.beginPath(); c.arc(s.x, s.y, r, 0, Math.PI * 2); c.fill();
        }

        // Organic dome / body with spherical shading
        blob(cx, cy, z, r, h, color, opts = {}) {
            const c = this.ctx;
            const base = this.p(cx, cy, z);
            const rx = r * 1.414 * (opts.stretchX || 1);
            const ry = r * 0.707 * (opts.stretchY || 1);
            const col = hexRGB(color);
            const g = c.createRadialGradient(base.x - rx * 0.35, base.y - h * 0.85, 1, base.x, base.y - h * 0.3, Math.max(rx, h) * 1.2);
            g.addColorStop(0, rgbStr(col.map(v => Math.min(255, v * 1.3 + 16))));
            g.addColorStop(0.55, rgbStr(col));
            g.addColorStop(1, rgbStr(col.map(v => v * 0.48)));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(base.x - rx, base.y);
            c.bezierCurveTo(base.x - rx, base.y - h * 1.3, base.x + rx, base.y - h * 1.3, base.x + rx, base.y);
            c.ellipse(base.x, base.y, rx, ry, 0, 0, Math.PI, false);
            c.closePath();
            c.fill();
            if (opts.edge !== false) {
                c.strokeStyle = rgbStr(col.map(v => v * 0.35), 0.55);
                c.lineWidth = 0.7;
                c.stroke();
            }
        }

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

        // Soft ground shadow
        shadow(cx, cy, r, alpha = 0.35, stretch = 1) {
            const c = this.ctx;
            const s = this.p(cx + r * 0.15, cy + r * 0.1, 0);
            const rx = r * 1.414 * stretch, ry = r * 0.707;
            c.save();
            c.translate(s.x, s.y);
            c.scale(1, ry / rx);
            const g = c.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
            g.addColorStop(0, `rgba(10,6,2,${alpha})`);
            g.addColorStop(0.65, `rgba(10,6,2,${alpha * 0.7})`);
            g.addColorStop(1, 'rgba(10,6,2,0)');
            c.fillStyle = g;
            c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
            c.restore();
        }

        // Additive glow (lamps, energy cores, muzzles)
        glow(x, y, z, r, color) {
            const c = this.ctx;
            r *= this.pulse || 1;
            const s = this.p(x, y, z);
            const col = hexRGB(color);
            c.save();
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
            g.addColorStop(0, rgbStr(col, 0.75));
            g.addColorStop(0.35, rgbStr(col, 0.3));
            g.addColorStop(1, rgbStr(col, 0));
            c.fillStyle = g;
            c.beginPath(); c.arc(s.x, s.y, r * 3, 0, Math.PI * 2); c.fill();
            c.restore();
            c.fillStyle = rgbStr(col.map(v => Math.min(255, v * 0.4 + 160)));
            c.beginPath(); c.arc(s.x, s.y, r * 0.75, 0, Math.PI * 2); c.fill();
        }
        glowDot(x, y, z, r, color) { this.glow(x, y, z, r, color); }

        // Wheel standing upright, rolling along yaw
        wheel(cx, cy, z, r, width, yaw, tire = '#24221f', hub = '#8a8a86') {
            const f = [Math.cos(yaw), Math.sin(yaw)];
            const side = [-f[1], f[0]];
            const K = 14;
            const ring = (off) => {
                const pts = [];
                for (let i = 0; i < K; i++) {
                    const a = (i / K) * Math.PI * 2;
                    const u = Math.cos(a) * r, v = Math.sin(a) * r;
                    pts.push([cx + f[0] * u + side[0] * off, cy + f[1] * u + side[1] * off, z + r + v]);
                }
                return pts;
            };
            // the outward face is the one toward the camera
            const sgn = (side[0] + side[1]) >= 0 ? 1 : -1;
            const near = ring(sgn * width / 2), far = ring(-sgn * width / 2);
            this.poly(far, tint(tire, -10));
            for (let i = 0; i < K; i++) {
                const j = (i + 1) % K;
                this.poly([far[i], far[j], near[j], near[i]], i % 2 ? tint(tire, -6) : tint(tire, 4));
            }
            this.poly(near, tire);
            const hubR = r * 0.5;
            const hc = [cx + side[0] * sgn * width / 2, cy + side[1] * sgn * width / 2];
            const hpts = [];
            for (let i = 0; i < K; i++) {
                const a = (i / K) * Math.PI * 2;
                hpts.push([hc[0] + f[0] * Math.cos(a) * hubR + side[0] * sgn * 0.3, hc[1] + f[1] * Math.cos(a) * hubR + side[1] * sgn * 0.3, z + r + Math.sin(a) * hubR]);
            }
            this.poly(hpts, hub, 'rgba(0,0,0,0.35)', 0.5);
        }

        // Track assembly (tank tread) along yaw at sideways offset
        track(off, len, width, h, yaw, color, wheelColor) {
            const c0 = fwd(yaw, 0, off);
            this.box(c0.x, c0.y, 0, len, width, h, yaw, color, { inset: 1.2, sideInset: 0.2, bevel: false, grime: false });
            // road wheels on the outer face
            const sgn = (Math.sign(off) || 1);
            const side = fwd(yaw, 0, sgn);
            const outward = (side.x + side.y) > 0;
            if (!outward) return;
            const n = Math.max(3, Math.round(len / 6));
            for (let i = 0; i < n; i++) {
                const t = (i / (n - 1) - 0.5) * (len - 6);
                const wp = fwd(yaw, t, off + sgn * width * 0.52);
                const s = this.p(wp.x, wp.y, h * 0.48);
                this.ctx.fillStyle = wheelColor || '#5a5a54';
                this.ctx.beginPath();
                this.ctx.ellipse(s.x, s.y, h * 0.36, h * 0.42, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
                this.ctx.beginPath();
                this.ctx.ellipse(s.x, s.y, h * 0.12, h * 0.14, 0, 0, Math.PI * 2);
                this.ctx.fill();
            }
            // tread segments
            const a = fwd(yaw, -len / 2 + 1, off + sgn * width * 0.5), b = fwd(yaw, len / 2 - 1, off + sgn * width * 0.5);
            const c = this.ctx;
            c.strokeStyle = 'rgba(0,0,0,0.35)';
            c.lineWidth = 0.6;
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
                const p0 = this.p(x, y, 0.4), p1 = this.p(x, y, 1.6);
                c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
            }
        }

        // Triangular spike (claws, horns, bone spurs)
        spike(cx, cy, z, yaw, len, baseW, rise, color) {
            const cos = Math.cos(yaw), sin = Math.sin(yaw);
            const px = -sin, py = cos;
            const tip = [cx + cos * len, cy + sin * len, z + rise];
            const l = [cx + px * baseW / 2, cy + py * baseW / 2, z];
            const r = [cx - px * baseW / 2, cy - py * baseW / 2, z];
            const top = [cx, cy, z + baseW * 0.45];
            this.poly([l, tip, top], shade(color, [px, py, 0.6]));
            this.poly([r, tip, top], shade(color, [-px, -py, 0.6]));
        }

        // Upright flag in team color
        flag(x, y, z, team, size = 1) {
            this.tube(x, y, z, x, y, z + 18 * size, 0.6, '#9a9a94');
            this.poly([[x, y, z + 18 * size], [x + 8 * size, y - 3 * size, z + 16 * size], [x + 9 * size, y - 3 * size, z + 12 * size], [x, y, z + 12.5 * size]], team);
            this.poly([[x, y, z + 15.2 * size], [x + 8.5 * size, y - 3 * size, z + 14 * size], [x + 8.5 * size, y - 3 * size, z + 13 * size], [x, y, z + 14 * size]], 'rgba(0,0,0,0.18)');
        }
    }

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
                const hp = s.p(0, 0, hz + 0.6);
                const c = s.ctx;
                c.fillStyle = shade(pal.hullDark, [0, 0, 1]);
                c.beginPath(); c.ellipse(hp.x, hp.y, 3.1, 2.5, 0, Math.PI, 0); c.fill();
                c.fillStyle = team;
                c.fillRect(hp.x - 3.1, hp.y - 0.4, 6.2, 0.9);
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

    function hoverGlow(s, r, glow, stretch = 1) {
        const c = s.ctx;
        const p = s.p(0, 0, 0);
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.translate(p.x, p.y);
        c.scale(1, 0.5);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.6 * stretch);
        g.addColorStop(0, withAlpha(glow, 0.35));
        g.addColorStop(1, withAlpha(glow, 0));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r * 1.6 * stretch, 0, Math.PI * 2); c.fill();
        c.restore();
    }

    function rider(s, x, y, z, pal, team, faction) {
        s.box(x, y, z, 3.2, 4.6, 5, 0, faction === 'evolved' ? pal.skin : pal.cloth, { inset: 0.5, band: [2, 3.4, team] });
        s.sphere(x, y, z + 7, 2.1, faction === 'evolved' ? pal.skin : '#d6a67a');
        if (faction === 'survivors') {
            const hp = s.p(x, y, z + 7.6);
            s.ctx.fillStyle = team;
            s.ctx.beginPath(); s.ctx.ellipse(hp.x, hp.y, 2.5, 2, 0, Math.PI, 0); s.ctx.fill();
        }
    }

    const UNIT_BUILDERS = {
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

    const TURRET_MOUNT = {
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

    const TOWER_TURRET_MOUNT = {
        tower: { survivors: 22, evolved: 25, series9: 23 },
        towerHeavy: { survivors: 21, evolved: 27, series9: 25 }
    };

    const TURRET_BUILDERS = {
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
            s.disc(0, 0, 0, a * 0.95, withAlpha('#3a2618', 0.45));
            s.disc(-a * 0.2, a * 0.1, 0.1, a * 0.6, withAlpha('#5a3a24', 0.35));
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
        const c = s.ctx;
        // slab seams
        c.strokeStyle = 'rgba(20,18,14,0.3)';
        c.lineWidth = 0.6;
        for (let i = -1; i <= 1; i++) {
            const p0 = s.p(i * a * 0.5, -a, 0.65), p1 = s.p(i * a * 0.5, a, 0.65);
            const q0 = s.p(-a, i * a * 0.5, 0.65), q1 = s.p(a, i * a * 0.5, 0.65);
            c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.stroke();
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
        const c = s.ctx;
        const p = s.p(x, y, z);
        c.fillStyle = shade(pal.metal, [-0.3, 0.3, 1]);
        c.beginPath(); c.ellipse(p.x, p.y, r * 1.2, r * 0.75, -0.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = shade(pal.metal, [0.3, 0.2, 0.4]);
        c.beginPath(); c.ellipse(p.x + 0.6, p.y + 0.4, r * 0.85, r * 0.5, -0.5, 0, Math.PI * 2); c.fill();
    }

    const BUILDING_BUILDERS = {

        hq(s, ft, pal, f, frame, team) {
            apron(s, ft, pal, f, team);
            const a = ft * 16;
            if (f === 'evolved') {
                // Clan Hall: great hide dome ringed with tusks
                s.blob(-2, -2, 0, a * 0.62, 34, pal.hull);
                s.blob(a * 0.32, -a * 0.38, 0, a * 0.28, 18, tint(pal.hull, -8));
                s.blob(-a * 0.45, a * 0.25, 0, a * 0.26, 16, tint(pal.hull, -12));
                const c = s.ctx;
                const top = s.p(-2, -2, 0);
                c.strokeStyle = withAlpha(pal.hullDark, 0.6);
                c.lineWidth = 1.2;
                for (let i = -2; i <= 2; i++) {
                    c.beginPath(); c.ellipse(top.x + i * 9, top.y - 14, 5, 22, 0, -Math.PI * 0.42, Math.PI * 0.42); c.stroke();
                }
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
                const c = s.p(-a * 0.1, -a * 0.1, 24);
                s.ctx.strokeStyle = shade(pal.metal, [0, 0.4, 1]);
                s.ctx.lineWidth = 3.5;
                s.ctx.beginPath(); s.ctx.ellipse(c.x, c.y, a * 0.7, a * 0.35, 0, 0, Math.PI * 2); s.ctx.stroke();
                s.ctx.strokeStyle = withAlpha(pal.glow, 0.85);
                s.ctx.lineWidth = 1.2;
                s.ctx.stroke();
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
                const c0 = s.p(0, -2, 0);
                s.ctx.strokeStyle = withAlpha(pal.hullDark, 0.75);
                s.ctx.lineWidth = 1.6;
                for (let i = -2; i <= 2; i++) {
                    s.ctx.beginPath(); s.ctx.ellipse(c0.x + i * 11, c0.y - 14, 7, 20, 0, -Math.PI * 0.45, Math.PI * 0.45); s.ctx.stroke();
                }
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
                    const c = s.p(0, 0, z + (frame ? 1 : 0));
                    s.ctx.strokeStyle = withAlpha(pal.glow, 0.8);
                    s.ctx.lineWidth = 1;
                    const r = a * 0.5 - z * 0.25;
                    s.ctx.beginPath(); s.ctx.ellipse(c.x, c.y, r * 1.414, r * 0.707, 0, 0, Math.PI * 2); s.ctx.stroke();
                }
                s.glow(0, 0, 30, 2.2, pal.glow);
            } else {
                s.box(0, 0, 0, a * 1.3, a * 1.1, 10, 0, pal.hull, { inset: 0.8, band: [6.5, 8, team] });
                windowStripE(s, -a * 0.4, a * 0.35, a * 0.65 - 0.4, 3, 6, pal.window, frame === 1);
                // observatory dome
                s.blob(-a * 0.12, -a * 0.12, 10, a * 0.36, 12, '#b9bcb8');
                const sl = s.p(-a * 0.12, -a * 0.12, 18);
                s.ctx.fillStyle = '#1b1d1c';
                s.ctx.fillRect(sl.x - 1, sl.y - 6, 2.4, 8);
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
                const hook = s.p(2, 0, 9);
                s.ctx.strokeStyle = '#2a2826';
                s.ctx.lineWidth = 1;
                s.ctx.beginPath(); s.ctx.arc(hook.x, hook.y, 1.6, -0.4, Math.PI); s.ctx.stroke();
                s.glow(a * 0.62, a * 0.5, 18.5, 0.7, frame ? '#ffcc33' : '#886611');
            }
        },

        tower(s, ft, pal, f, frame, team) {
            const a = ft * 16;
            if (f === 'evolved') {
                s.disc(0, 0, 0, a * 0.95, withAlpha('#3a2618', 0.4));
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
                s.disc(0, 0, 0, a * 0.95, withAlpha('#3a2618', 0.4));
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

    // ---------- post-processing ----------
    let noisePattern = null;
    function getNoisePattern(ctx) {
        if (noisePattern) return noisePattern;
        const n = document.createElement('canvas');
        n.width = 64; n.height = 64;
        const nc = n.getContext('2d');
        const img = nc.createImageData(64, 64);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() < 0.5 ? 0 : 255;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = Math.random() * 20;
        }
        nc.putImageData(img, 0, 0);
        noisePattern = ctx.createPattern(n, 'repeat');
        return noisePattern;
    }

    // Dark contour + sun rim + grain, then downsample to the stored
    // resolution (OUT x logical size).
    function finish(src, opts = {}) {
        const w = src.width, h = src.height;
        const sil = (color) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const cc = c.getContext('2d');
            cc.drawImage(src, 0, 0);
            cc.globalCompositeOperation = 'source-in';
            cc.fillStyle = color;
            cc.fillRect(0, 0, w, h);
            return c;
        };
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        const oc = out.getContext('2d');
        if (opts.outline !== false) {
            const dark = sil('rgba(14,10,6,0.9)');
            const d = SS * 0.9;
            for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d * 0.7, -d * 0.7], [d * 0.7, d * 0.7], [-d * 0.7, d * 0.7], [d * 0.7, -d * 0.7]]) {
                oc.drawImage(dark, ox, oy);
            }
        }
        oc.drawImage(src, 0, 0);
        // rim light along the upper-left silhouette edge
        const rim = sil('rgba(255,232,180,1)');
        const rc = rim.getContext('2d');
        rc.globalCompositeOperation = 'destination-out';
        rc.drawImage(src, 1.3 * SS, 1.3 * SS);
        oc.globalAlpha = 0.4;
        oc.drawImage(rim, 0, 0);
        oc.globalAlpha = 1;
        oc.globalCompositeOperation = 'source-atop';
        oc.fillStyle = getNoisePattern(oc);
        oc.fillRect(0, 0, w, h);
        oc.globalCompositeOperation = 'source-over';

        const f = document.createElement('canvas');
        f.width = Math.round(src.logicalWidth * OUT);
        f.height = Math.round(src.logicalHeight * OUT);
        f.logicalWidth = src.logicalWidth;
        f.logicalHeight = src.logicalHeight;
        f.anchorX = src.anchorX;
        f.anchorY = src.anchorY;
        const fc = f.getContext('2d');
        fc.imageSmoothingEnabled = true;
        fc.imageSmoothingQuality = 'high';
        fc.drawImage(out, 0, 0, f.width, f.height);
        return f;
    }

    // ============================================
    // ASSET PACK (pre-rendered 3D sprite sheets)
    // Bundles from tools/asset-baker register sheets in
    // window.XFIRE_ASSETS. Each sheet has columns = directions,
    // rows = animation frames, plus a team mask: team-colored parts are
    // tinted per player at load time. Anything missing falls back to
    // the procedural sprites below.
    // ============================================
    const Pack = { entries: new Map(), enabled: true, loaded: false };

    function loadImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    async function loadPack() {
        const all = window.XFIRE_ASSETS || {};
        const jobs = [];
        for (const faction of Object.keys(all)) {
            for (const [key, e] of Object.entries(all[faction])) {
                jobs.push((async () => {
                    const [color, mask] = await Promise.all([loadImage(e.color), loadImage(e.mask)]);
                    if (!color) return;
                    // mask: gray in RGB -> alpha channel, once per sheet
                    let maskA = null;
                    if (mask) {
                        maskA = document.createElement('canvas');
                        maskA.width = mask.width; maskA.height = mask.height;
                        const mc = maskA.getContext('2d');
                        mc.drawImage(mask, 0, 0);
                        const d = mc.getImageData(0, 0, mask.width, mask.height);
                        let any = false;
                        for (let i = 0; i < d.data.length; i += 4) {
                            const v = d.data[i];
                            d.data[i + 3] = v > 8 ? v : 0;
                            d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
                            if (v > 8) any = true;
                        }
                        mc.putImageData(d, 0, 0);
                        if (!any) maskA = null;
                    }
                    Pack.entries.set(key, { ...e, colorImg: color, maskA });
                })());
            }
        }
        await Promise.all(jobs);
        Pack.loaded = true;
        // procedural sprites cached so far are replaced by the pack
        cache.clear();
        iconCache.clear();
        return Pack.entries.size;
    }

    function setPackEnabled(on) {
        if (Pack.enabled === on) return;
        Pack.enabled = on;
        cache.clear();
        iconCache.clear();
    }

    function packCell(kind, role, faction, dir, frame, team) {
        if (!Pack.enabled) return null;
        const e = Pack.entries.get(`${kind}|${role}|${faction}`);
        if (!e) return null;
        const cw = e.w * OUT, ch = e.h * OUT;
        const sx = (dir % e.dirs) * cw, sy = Math.min(frame, e.frames - 1) * ch;
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        c.logicalWidth = e.w; c.logicalHeight = e.h;
        c.anchorX = e.ax; c.anchorY = e.ay;
        const cc = c.getContext('2d');
        cc.drawImage(e.colorImg, sx, sy, cw, ch, 0, 0, cw, ch);
        if (e.maskA && team) {
            const t = document.createElement('canvas');
            t.width = cw; t.height = ch;
            const tc = t.getContext('2d');
            tc.drawImage(e.maskA, sx, sy, cw, ch, 0, 0, cw, ch);
            tc.globalCompositeOperation = 'source-in';
            tc.fillStyle = team;
            tc.fillRect(0, 0, cw, ch);
            // team paint: shaded light-grey base x team color
            cc.globalCompositeOperation = 'multiply';
            cc.drawImage(t, 0, 0);
            cc.globalCompositeOperation = 'destination-in';
            cc.drawImage(e.colorImg, sx, sy, cw, ch, 0, 0, cw, ch);
            cc.globalCompositeOperation = 'source-over';
        }
        return c;
    }

    // ============================================
    // PUBLIC API
    // ============================================

    const INFANTRY_ROLES = new Set(['trooper', 'flamer', 'rocketeer']);
    const UNIT_CANVAS = {
        trooper: [60, 60, 30, 44], flamer: [60, 60, 30, 44], rocketeer: [60, 60, 30, 44],
        bike: [76, 66, 38, 44], buggy: [86, 74, 43, 48],
        tank: [100, 84, 50, 54], heavy: [124, 104, 62, 64], artillery: [116, 104, 58, 64]
    };
    const DEFAULT_TEAM = '#3fa9ff';

    function animatedFrames(role, faction) {
        if (INFANTRY_ROLES.has(role)) return 5;          // 0 idle + 4 walk
        if (faction === 'evolved' && role !== 'heavy') return 4;
        if (faction === 'evolved' && role === 'heavy') return 4;
        return 1;
    }

    function unitSprite(role, faction, dirIndex, frame = 0, team = DEFAULT_TEAM) {
        const frames = animatedFrames(role, faction);
        frame = frames === 1 ? 0 : (INFANTRY_ROLES.has(role) ? frame % 5 : frame % 4);
        const key = `u|${role}|${faction}|${dirIndex}|${frame}|${team}`;
        if (cache.has(key)) return cache.get(key);
        const baked = packCell('unit', role, faction, dirIndex, frame, team);
        if (baked) { cache.set(key, baked); return baked; }
        const [w, h, ax, ay] = UNIT_CANVAS[role] || [100, 90, 50, 56];
        const s = new Surface(w, h, ax, ay);
        const yaw = (dirIndex / DIRS) * Math.PI * 2;
        const pal = FACTIONS[faction].palette;
        const builder = UNIT_BUILDERS[role];
        if (builder) builder(s, yaw, pal, faction, team, frame);
        const out = finish(s.canvas);
        cache.set(key, out);
        return out;
    }

    function turretSprite(role, faction, dirIndex, team = DEFAULT_TEAM) {
        const key = `t|${role}|${faction}|${dirIndex}|${team}`;
        if (cache.has(key)) return cache.get(key);
        const baked = packCell('turret', role, faction, dirIndex, 0, team);
        if (baked) { cache.set(key, baked); return baked; }
        const s = new Surface(96, 84, 48, 52);
        const yaw = (dirIndex / DIRS) * Math.PI * 2;
        const pal = FACTIONS[faction].palette;
        const builder = TURRET_BUILDERS[role];
        if (builder) builder(s, yaw, pal, faction, team);
        const out = finish(s.canvas);
        cache.set(key, out);
        return out;
    }

    function turretMount(role, faction) {
        return TURRET_MOUNT[role] ? TURRET_MOUNT[role][faction] : null;
    }

    function towerTurretMount(role, faction) {
        return TOWER_TURRET_MOUNT[role] ? TOWER_TURRET_MOUNT[role][faction] : null;
    }

    // Hull + turret combined (icons, wrecks, death animations)
    function unitComposite(role, faction, dirIndex, frame = 0, team = DEFAULT_TEAM) {
        if (!TURRET_MOUNT[role]) return unitSprite(role, faction, dirIndex, frame, team);
        const key = `comp|${role}|${faction}|${dirIndex}|${team}`;
        if (cache.has(key)) return cache.get(key);
        const body = unitSprite(role, faction, dirIndex, 0, team);
        const tur = turretSprite(role, faction, dirIndex, team);
        const m = TURRET_MOUNT[role][faction];
        const yaw = (dirIndex / DIRS) * Math.PI * 2;
        const mx = m.ox * Math.cos(yaw), my = m.ox * Math.sin(yaw);
        const dx = (mx - my), dy = (mx + my) / 2 - m.z;
        const c = document.createElement('canvas');
        c.width = body.width; c.height = body.height;
        c.logicalWidth = body.logicalWidth; c.logicalHeight = body.logicalHeight;
        c.anchorX = body.anchorX; c.anchorY = body.anchorY;
        const cc = c.getContext('2d');
        cc.drawImage(body, 0, 0);
        cc.drawImage(tur,
            (body.anchorX + dx - tur.anchorX) * OUT, (body.anchorY + dy - tur.anchorY) * OUT,
            tur.logicalWidth * OUT, tur.logicalHeight * OUT);
        cache.set(key, c);
        return c;
    }

    function buildingSprite(role, faction, frame = 0, team = DEFAULT_TEAM) {
        const type = BUILDING_TYPES[role];
        const ft = type ? type.size : 2;
        const key = `b|${role}|${faction}|${frame}|${team}`;
        if (cache.has(key)) return cache.get(key);
        const baked = packCell('building', role, role === 'bunker' ? 'survivors' : faction, 0, frame, team);
        if (baked) { cache.set(key, baked); return baked; }
        const w = ft * 64 + 40;
        const h = ft * 32 + 96;
        const s = new Surface(w, h, w / 2, h - ft * 16 - 12);
        s.shadow(4, 2, ft * 16 * 1.05, 0.38, 1);
        s.pulse = frame === 1 ? 1.3 : 1;
        const pal = FACTIONS[faction].palette;
        const builder = BUILDING_BUILDERS[role];
        if (builder) builder(s, ft, pal, faction, frame, team);
        const out = finish(s.canvas);
        cache.set(key, out);
        return out;
    }

    // Small icon (data URL) for sidebar buttons and portraits
    function icon(kind, role, faction, playerId = 0) {
        const team = playerId === 1 ? '#ff3b30' : playerId === 2 ? '#e8c440' : DEFAULT_TEAM;
        const key = `${kind}|${role}|${faction}|${team}`;
        if (iconCache.has(key)) return iconCache.get(key);
        const src = kind === 'unit'
            ? unitComposite(role, faction, 3, 0, team)
            : buildingSprite(role, faction, 0, team);
        const S = 112;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const cc = c.getContext('2d');
        cc.imageSmoothingQuality = 'high';
        const lw = src.logicalWidth, lh = src.logicalHeight;
        // crop around the drawn content (anchor-relative bounds)
        const scale = kind === 'unit'
            ? (S / Math.max(lw * 0.62, lh * 0.7))
            : (S / Math.max(lw * 0.92, lh * 0.88));
        const dw = lw * scale, dh = lh * scale;
        const ox = S / 2 - src.anchorX * scale;
        const oy = (kind === 'unit' ? S * 0.68 : S * 0.78) - src.anchorY * scale;
        cc.drawImage(src, ox, oy, dw, dh);
        const url = c.toDataURL();
        iconCache.set(key, url);
        return url;
    }

    function dirFromAngle(angle) {
        return Math.round(((angle % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2) * DIRS) % DIRS;
    }

    // Burned-out wreck: darkened, charred copy of the unit sprite
    function wreckSprite(role, faction, dirIndex) {
        const key = `w|${role}|${faction}|${dirIndex}`;
        if (cache.has(key)) return cache.get(key);
        const base = unitComposite(role, faction, dirIndex, 0, '#3a3530');
        const c = document.createElement('canvas');
        c.width = base.width; c.height = base.height;
        c.logicalWidth = base.logicalWidth; c.logicalHeight = base.logicalHeight;
        c.anchorX = base.anchorX; c.anchorY = base.anchorY;
        const cc = c.getContext('2d');
        cc.drawImage(base, 0, 0);
        cc.globalCompositeOperation = 'source-atop';
        cc.fillStyle = 'rgba(22,16,10,0.74)';
        cc.fillRect(0, 0, c.width, c.height);
        cc.globalCompositeOperation = 'overlay';
        cc.fillStyle = 'rgba(130,80,40,0.3)';
        cc.fillRect(0, 0, c.width, c.height);
        cache.set(key, c);
        return c;
    }

    // Background cache warming: queue every sprite a side will need and
    // bake a few per frame within a time budget, so armies showing up for
    // the first time don't stall a frame while their sprites are drawn.
    const warmQueue = [];
    function prewarm(faction, team, roles) {
        for (const role of roles) {
            const frames = animatedFrames(role, faction);
            for (let f = 0; f < frames; f++) {
                for (let d = 0; d < DIRS; d++) warmQueue.push(() => unitSprite(role, faction, d, f, team));
            }
            if (TURRET_MOUNT[role]) for (let d = 0; d < DIRS; d++) warmQueue.push(() => turretSprite(role, faction, d, team));
        }
    }
    function prewarmStep(budgetMs = 4) {
        const t0 = performance.now();
        while (warmQueue.length && performance.now() - t0 < budgetMs) warmQueue.shift()();
    }
    function clearPrewarm() { warmQueue.length = 0; }

    return {
        unitSprite, unitComposite, turretSprite, turretMount, towerTurretMount,
        buildingSprite, wreckSprite, icon, dirFromAngle, prewarm, loadPack, setPackEnabled,
        get packLoaded() { return Pack.loaded; }, get packSize() { return Pack.entries.size; }, prewarmStep, clearPrewarm, animatedFrames,
        DIRS, OUT, tint, withAlpha
    };
})();
