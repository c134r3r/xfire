// ============================================
// XFire - Terrain renderer
// The wasteland ground is painted once per match into a large cache:
//   1. a world-space texture (16 texels per tile) with layered value
//      noise: sand / dirt / rust patches, wet shores, rubble around
//      cliffs - blitted through the isometric transform,
//   2. a screen-space grain pass for crisp detail at any zoom,
//   3. organic water bodies (rounded shorelines, depth, foam),
//   4. vector props: boulders, scrub, bones, scrap, tire tracks, oil.
// Rock walls are separate depth-sorted sprites (one per tile), so a
// unit standing behind a cliff is correctly hidden by it.
//
// Tile (tx, ty) covers world [tx, tx+1) x [ty, ty+1) - the same
// convention the game logic uses (Math.floor for tile lookups).
// ============================================

const Terrain = (() => {
    const TEX = 16;          // texels per tile in the world-space texture
    const PAD = 40;          // cache margin in pixels
    let cache = null;        // { canvas, ctx, ms, x0 }
    let walls = [];          // [{ tx, ty, depth, sprite }]
    let grainPattern = null;

    // ---------- noise ----------
    function hash(x, y, seed) {
        let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967295;
    }
    function vnoise(x, y, seed = 0) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const fx = x - x0, fy = y - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
        const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
    function fbm(x, y, seed = 0, oct = 3) {
        let v = 0, amp = 0.5, f = 1, norm = 0;
        for (let i = 0; i < oct; i++) {
            v += vnoise(x * f, y * f, seed + i * 17) * amp;
            norm += amp;
            amp *= 0.5;
            f *= 2.03;
        }
        return v / norm;
    }
    const smooth = (e0, e1, x) => {
        const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
    };
    const mix = (a, b, t) => a + (b - a) * t;

    // per-match random seed so every map paints differently
    let SEED = 1;

    // Smooth 0..1 field of "tile is X", sampled between tile centers
    function tileField(ms, test) {
        const f = new Float32Array(ms * ms);
        for (let y = 0; y < ms; y++) for (let x = 0; x < ms; x++) f[y * ms + x] = test(game.map[y][x]) ? 1 : 0;
        return (wx, wy) => {
            const x = wx - 0.5, y = wy - 0.5;
            const x0 = Math.floor(x), y0 = Math.floor(y);
            const fx = x - x0, fy = y - y0;
            const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
            const g = (xx, yy) => {
                xx = Math.max(0, Math.min(ms - 1, xx));
                yy = Math.max(0, Math.min(ms - 1, yy));
                return f[yy * ms + xx];
            };
            const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
            return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
    }

    function cachePos(wx, wy) {
        return { x: (wx - wy) * (TILE_WIDTH / 2) + cache.x0, y: (wx + wy) * (TILE_HEIGHT / 2) + PAD };
    }

    // ---------- 1. ground + 3. water textures ----------
    function paintTextures(ms) {
        const N = ms * TEX;
        const land = document.createElement('canvas');
        land.width = N; land.height = N;
        const water = document.createElement('canvas');
        water.width = N; water.height = N;
        const lctx = land.getContext('2d'), wctx = water.getContext('2d');
        const L = lctx.createImageData(N, N), W = wctx.createImageData(N, N);
        const ld = L.data, wd = W.data;

        const waterF = tileField(ms, t => t.type === 'water');
        const wallF = tileField(ms, t => t.type === 'hill');
        const oilF = tileField(ms, t => t.oil);

        for (let py = 0; py < N; py++) {
            const wy = (py + 0.5) / TEX;
            for (let px = 0; px < N; px++) {
                const wx = (px + 0.5) / TEX;
                const i = (py * N + px) * 4;

                // --- land ---
                const big = fbm(wx * 0.11, wy * 0.11, SEED, 3);
                const mid = fbm(wx * 0.45 + 13.1, wy * 0.45 + 7.7, SEED + 3, 3);
                const fine = vnoise(wx * 3.1, wy * 3.1, SEED + 9);
                const rust = smooth(0.58, 0.75, fbm(wx * 0.07 + 40, wy * 0.07 + 11, SEED + 21, 2));
                const pale = smooth(0.55, 0.8, big);
                // sand -> packed dirt -> pale dust
                let r = mix(124, 160, smooth(0.25, 0.7, big)), g = mix(100, 133, smooth(0.25, 0.7, big)), b = mix(68, 92, smooth(0.25, 0.7, big));
                r = mix(r, 182, pale * 0.55); g = mix(g, 160, pale * 0.55); b = mix(b, 118, pale * 0.55);
                r = mix(r, 152, rust * 0.6); g = mix(g, 98, rust * 0.6); b = mix(b, 64, rust * 0.6);
                let k = 0.9 + mid * 0.18 + (fine - 0.5) * 0.07;

                // rubble-strewn, shadowed ground at the foot of cliffs
                const wallN = wallF(wx + (vnoise(wx * 2, wy * 2, SEED + 5) - 0.5) * 0.5, wy);
                if (wallN > 0.05) {
                    const t = smooth(0.05, 0.6, wallN);
                    r = mix(r, 108, t * 0.6); g = mix(g, 92, t * 0.6); b = mix(b, 72, t * 0.6);
                    k *= 1 - t * 0.12;
                }
                // wet, darker sand around water
                const wv = waterF(wx + (vnoise(wx * 1.7, wy * 1.7, SEED + 2) - 0.5) * 0.55,
                                  wy + (vnoise(wx * 1.7 + 9, wy * 1.7, SEED + 2) - 0.5) * 0.55);
                if (wv > 0.12) {
                    const t = smooth(0.12, 0.5, wv);
                    r = mix(r, 92, t * 0.65); g = mix(g, 82, t * 0.65); b = mix(b, 62, t * 0.65);
                }
                // oil-soaked earth around the patches
                const ov = oilF(wx, wy);
                if (ov > 0.1) {
                    const t = smooth(0.1, 0.7, ov) * (0.6 + vnoise(wx * 4, wy * 4, SEED + 7) * 0.4);
                    r = mix(r, 58, t * 0.55); g = mix(g, 50, t * 0.55); b = mix(b, 36, t * 0.55);
                }
                ld[i] = r * k; ld[i + 1] = g * k; ld[i + 2] = b * k; ld[i + 3] = 255;

                // --- water ---
                if (wv > 0.4) {
                    const a = smooth(0.46, 0.52, wv);
                    const depth = smooth(0.52, 0.95, wv);
                    const ripple = vnoise(wx * 5, wy * 9, SEED + 31) - 0.5;
                    let wr = mix(70, 22, depth), wg = mix(112, 56, depth), wb = mix(110, 68, depth);
                    wr += ripple * 10; wg += ripple * 12; wb += ripple * 12;
                    // foam line just inside the shore
                    const foam = (1 - smooth(0.5, 0.58, wv)) * a * (0.55 + vnoise(wx * 6, wy * 6, SEED + 33) * 0.45);
                    wr = mix(wr, 214, foam * 0.75); wg = mix(wg, 226, foam * 0.75); wb = mix(wb, 214, foam * 0.75);
                    wd[i] = wr; wd[i + 1] = wg; wd[i + 2] = wb; wd[i + 3] = a * 255;
                }
            }
        }
        lctx.putImageData(L, 0, 0);
        wctx.putImageData(W, 0, 0);
        return { land, water };
    }

    // ---------- 2. screen-space grain ----------
    function getGrain(c) {
        if (grainPattern) return grainPattern;
        const n = document.createElement('canvas');
        n.width = 192; n.height = 96;
        const nc = n.getContext('2d');
        const img = nc.createImageData(n.width, n.height);
        for (let y = 0; y < n.height; y++) {
            for (let x = 0; x < n.width; x++) {
                const i = (y * n.width + x) * 4;
                // fine speckle + sparse pebbles, slightly stretched like iso ground
                let v = 128 + (hash(x, y, 77) - 0.5) * 70;
                if (hash(x >> 1, y, 91) > 0.985) v = 70;
                if (hash(x >> 1, y, 93) > 0.988) v = 210;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
        }
        nc.putImageData(img, 0, 0);
        grainPattern = c.createPattern(n, 'repeat');
        return grainPattern;
    }

    // ---------- 4. props ----------
    function boulder(c, x, y, r, tone = 0) {
        // contact shadow
        c.fillStyle = 'rgba(30,20,10,0.35)';
        c.beginPath(); c.ellipse(x + r * 0.35, y + r * 0.25, r * 1.15, r * 0.55, 0, 0, Math.PI * 2); c.fill();
        const g = c.createRadialGradient(x - r * 0.35, y - r * 0.55, r * 0.1, x, y - r * 0.2, r * 1.2);
        g.addColorStop(0, `rgb(${196 + tone},${178 + tone},${146 + tone})`);
        g.addColorStop(0.55, `rgb(${136 + tone},${116 + tone},${90 + tone})`);
        g.addColorStop(1, `rgb(${78 + tone},${64 + tone},${50 + tone})`);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - r, y);
        c.quadraticCurveTo(x - r * 0.95, y - r * 0.85, x - r * 0.2, y - r * 0.95);
        c.quadraticCurveTo(x + r * 0.8, y - r * 0.9, x + r, y - r * 0.1);
        c.quadraticCurveTo(x + r * 0.6, y + r * 0.5, x, y + r * 0.42);
        c.quadraticCurveTo(x - r * 0.7, y + r * 0.45, x - r, y);
        c.fill();
        c.strokeStyle = 'rgba(40,28,18,0.45)';
        c.lineWidth = 0.8;
        c.stroke();
    }

    function tuft(c, x, y, s, rnd) {
        const n = 4 + (rnd() * 4 | 0);
        for (let i = 0; i < n; i++) {
            const ang = -Math.PI / 2 + (rnd() - 0.5) * 1.6;
            const len = (4 + rnd() * 5) * s;
            c.strokeStyle = rnd() > 0.5 ? 'rgba(120,108,58,0.85)' : 'rgba(168,148,86,0.8)';
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(x + (rnd() - 0.5) * 3, y);
            c.quadraticCurveTo(x + Math.cos(ang) * len * 0.4, y + Math.sin(ang) * len * 0.6,
                x + Math.cos(ang) * len, y + Math.sin(ang) * len);
            c.stroke();
        }
    }

    function deadBush(c, x, y, rnd) {
        c.fillStyle = 'rgba(30,20,10,0.25)';
        c.beginPath(); c.ellipse(x + 2, y + 1, 8, 3, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(70,52,32,0.95)';
        const branch = (bx, by, ang, len, w, depth) => {
            const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len * 0.8;
            c.lineWidth = w;
            c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
            if (depth > 0) {
                branch(ex, ey, ang - 0.5 - rnd() * 0.3, len * 0.65, w * 0.65, depth - 1);
                branch(ex, ey, ang + 0.4 + rnd() * 0.3, len * 0.6, w * 0.65, depth - 1);
            }
        };
        for (let i = 0; i < 3; i++) branch(x, y, -Math.PI / 2 + (i - 1) * 0.7, 5 + rnd() * 3, 1.6, 2);
    }

    function bones(c, x, y, rnd) {
        c.strokeStyle = 'rgba(226,216,190,0.9)';
        c.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.arc(x - 5 + i * 4, y, 4 - i * 0.5, Math.PI * 0.15, Math.PI * 0.85);
            c.stroke();
        }
        // skull
        c.fillStyle = '#e4dcc4';
        c.beginPath(); c.ellipse(x + 8, y - 2, 3.4, 2.8, 0.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a2e22';
        c.fillRect(x + 6.6, y - 2.6, 1.2, 1.2);
        c.fillRect(x + 8.8, y - 2.4, 1.2, 1.2);
    }

    function scrap(c, x, y, rnd) {
        const kind = rnd();
        if (kind < 0.4) {
            // rusted barrel on its side
            c.fillStyle = 'rgba(30,20,10,0.3)';
            c.beginPath(); c.ellipse(x + 1, y + 3, 9, 3, 0, 0, Math.PI * 2); c.fill();
            const g = c.createLinearGradient(x, y - 5, x, y + 3);
            g.addColorStop(0, '#a5623a'); g.addColorStop(0.5, '#7a3f22'); g.addColorStop(1, '#3f2012');
            c.fillStyle = g;
            c.fillRect(x - 7, y - 4, 13, 7);
            c.fillStyle = '#5a2e18';
            c.beginPath(); c.ellipse(x + 6, y - 0.5, 2.2, 3.6, 0, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(40,20,10,0.6)'; c.lineWidth = 0.8;
            c.beginPath(); c.moveTo(x - 3, y - 4); c.lineTo(x - 3, y + 3); c.moveTo(x + 2, y - 4); c.lineTo(x + 2, y + 3); c.stroke();
        } else if (kind < 0.7) {
            // half-buried tire
            c.strokeStyle = '#1c1a17'; c.lineWidth = 3;
            c.beginPath(); c.ellipse(x, y, 6, 3.4, 0, Math.PI, 0); c.stroke();
            c.strokeStyle = 'rgba(120,110,100,0.5)'; c.lineWidth = 0.8;
            c.beginPath(); c.ellipse(x, y - 0.6, 6, 3.4, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
        } else {
            // twisted metal sheet
            c.fillStyle = '#6b6258';
            c.beginPath(); c.moveTo(x - 7, y + 1); c.lineTo(x - 2, y - 3); c.lineTo(x + 6, y - 1); c.lineTo(x + 3, y + 3); c.closePath(); c.fill();
            c.fillStyle = 'rgba(140,70,30,0.6)';
            c.beginPath(); c.moveTo(x - 2, y - 3); c.lineTo(x + 6, y - 1); c.lineTo(x + 2, y); c.closePath(); c.fill();
        }
    }

    function cracks(c, x, y, rnd) {
        c.strokeStyle = 'rgba(58,44,28,0.45)';
        c.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) {
            let cx = x + (rnd() - 0.5) * 16, cy = y + (rnd() - 0.5) * 8;
            c.beginPath(); c.moveTo(cx, cy);
            for (let k = 0; k < 3; k++) {
                cx += (rnd() - 0.5) * 14; cy += (rnd() - 0.5) * 7;
                c.lineTo(cx, cy);
            }
            c.stroke();
        }
    }

    function tireTracks(c, x, y, ang, len) {
        c.strokeStyle = 'rgba(70,54,36,0.18)';
        c.lineWidth = 2.2;
        c.setLineDash([3, 2]);
        for (const off of [-4, 4]) {
            c.beginPath();
            const ox = -Math.sin(ang) * off, oy = Math.cos(ang) * off * 0.5;
            c.moveTo(x + ox, y + oy);
            c.quadraticCurveTo(x + ox + Math.cos(ang) * len * 0.5 + 6, y + oy + Math.sin(ang) * len * 0.25,
                x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len * 0.5);
            c.stroke();
        }
        c.setLineDash([]);
    }

    // Oil patch: glossy black pool with a rainbow sheen
    function oilPool(c, cx, cy, rnd, depleted) {
        const blobs = 3 + (rnd() * 2 | 0);
        const pts = [];
        for (let i = 0; i < blobs; i++) {
            pts.push([cx + (rnd() - 0.5) * 16, cy + (rnd() - 0.5) * 7, 8 + rnd() * 7]);
        }
        // soaked halo
        c.fillStyle = depleted ? 'rgba(40,34,24,0.35)' : 'rgba(22,18,10,0.35)';
        for (const [x, y, r] of pts) { c.beginPath(); c.ellipse(x, y, r + 7, (r + 7) * 0.5, 0, 0, Math.PI * 2); c.fill(); }
        if (depleted) {
            c.fillStyle = 'rgba(52,44,32,0.75)';
            for (const [x, y, r] of pts) { c.beginPath(); c.ellipse(x, y, r * 0.7, r * 0.33, 0, 0, Math.PI * 2); c.fill(); }
            return;
        }
        for (const [x, y, r] of pts) {
            const g = c.createRadialGradient(x - r * 0.3, y - r * 0.2, 1, x, y, r);
            g.addColorStop(0, '#2c2a26');
            g.addColorStop(0.6, '#0e0d0b');
            g.addColorStop(1, '#050404');
            c.fillStyle = g;
            c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); c.fill();
        }
        // iridescent sheen + specular glint
        const [hx, hy, hr] = pts[0];
        const sheen = c.createLinearGradient(hx - hr, hy, hx + hr, hy);
        sheen.addColorStop(0, 'rgba(120,60,160,0)');
        sheen.addColorStop(0.35, 'rgba(120,60,160,0.22)');
        sheen.addColorStop(0.55, 'rgba(60,160,140,0.22)');
        sheen.addColorStop(0.8, 'rgba(200,170,60,0.18)');
        sheen.addColorStop(1, 'rgba(200,170,60,0)');
        c.fillStyle = sheen;
        c.beginPath(); c.ellipse(hx, hy - 1, hr * 0.8, hr * 0.28, -0.1, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,240,0.55)';
        c.beginPath(); c.ellipse(hx - hr * 0.35, hy - hr * 0.16, hr * 0.28, hr * 0.07, -0.15, 0, Math.PI * 2); c.fill();
    }

    function seededRnd(seed) {
        let s = seed | 0;
        return () => {
            s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };
    }

    // ---------- rock walls (depth-sorted sprites) ----------
    function wallHeight(tx, ty) {
        return 20 + fbm(tx * 0.35, ty * 0.35, SEED + 50, 2) * 16;
    }

    function isWall(tx, ty) {
        return game.map[ty]?.[tx]?.type === 'hill';
    }

    // Lambert-lit rock face color
    function rockShade(nx, ny, nz, base) {
        const L = [-0.45, 0.35, 0.82];
        const len = Math.hypot(nx, ny, nz) || 1;
        const d = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / len);
        const k = 0.42 + d * 0.72;
        return `rgb(${Math.min(255, base[0] * k) | 0},${Math.min(255, base[1] * k) | 0},${Math.min(255, base[2] * k) | 0})`;
    }

    function makeWallSprite(tx, ty) {
        const rnd = seededRnd((tx * 7919 + ty * 104729 + SEED * 31) | 0);
        const H = wallHeight(tx, ty);
        const SS = 2;
        const w = 104, h = 110;
        const ax = w / 2, ay = h - 30; // anchor = tile center on the ground
        const cv = document.createElement('canvas');
        cv.width = w * SS; cv.height = h * SS;
        cv.logicalWidth = w; cv.logicalHeight = h; cv.anchorX = ax; cv.anchorY = ay;
        const c = cv.getContext('2d');
        c.scale(SS, SS);
        const P = (x, y, z) => ({ x: ax + (x - y) * 32, y: ay + (x + y) * 16 - z });

        // irregular footprint: tile square, bulging toward wall neighbors
        // so a ridge reads as one continuous mass
        const nN = isWall(tx, ty - 1), nS = isWall(tx, ty + 1), nW = isWall(tx - 1, ty), nE = isWall(tx + 1, ty);
        const ext = (has) => has ? 0.62 : 0.4;
        const ring = [];
        const K = 12;
        for (let i = 0; i < K; i++) {
            const a = (i / K) * Math.PI * 2;
            const cx = Math.cos(a), cy = Math.sin(a);
            // super-ellipse: squarish but rounded
            const sq = 1 / Math.pow(Math.pow(Math.abs(cx), 3) + Math.pow(Math.abs(cy), 3), 1 / 3);
            const rx = cx > 0 ? ext(nE) : ext(nW);
            const ry = cy > 0 ? ext(nS) : ext(nN);
            const j = 0.86 + rnd() * 0.22;
            ring.push([cx * sq * rx * j, cy * sq * ry * j]);
        }
        // top is a slightly shrunken, jittered copy (sloped cliff faces)
        // sides that continue into a neighboring wall keep their full
        // width up top (one continuous ridge); open sides slope inward
        const top = ring.map(([x, y]) => {
            const toN = (x > 0.15 && nE) || (x < -0.15 && nW) || (y > 0.15 && nS) || (y < -0.15 && nN);
            const k = toN ? 0.96 : 0.7 + rnd() * 0.12;
            const hn = (Math.abs(x) > 0.3 ? wallHeight(tx + Math.sign(x), ty) : H) * 0.5 + (Math.abs(y) > 0.3 ? wallHeight(tx, ty + Math.sign(y)) : H) * 0.5;
            const hz = toN ? (H + hn) / 2 : H * (0.9 + rnd() * 0.14);
            return [x * k, y * k, hz];
        });
        const base = [146, 116, 82];

        // side faces, far to near
        const faces = [];
        for (let i = 0; i < K; i++) {
            const j = (i + 1) % K;
            const b0 = ring[i], b1 = ring[j], t0 = top[i], t1 = top[j];
            // normal = (b1 - b0) x (t0 - b0)
            const ux = b1[0] - b0[0], uy = b1[1] - b0[1], uz = 0;
            const vx = t0[0] - b0[0], vy = t0[1] - b0[1], vz = t0[2];
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            // visible when facing the camera (toward +x +y +z)
            if (nx + ny + nz <= 0) continue;
            faces.push({ b0, b1, t0, t1, n: [nx, ny, nz], depth: b0[0] + b0[1] + b1[0] + b1[1] });
        }
        faces.sort((a, b) => a.depth - b.depth);
        for (const f of faces) {
            const q = [P(f.b0[0], f.b0[1], 0), P(f.b1[0], f.b1[1], 0), P(f.t1[0], f.t1[1], f.t1[2]), P(f.t0[0], f.t0[1], f.t0[2])];
            c.fillStyle = rockShade(f.n[0], f.n[1], f.n[2], base);
            c.beginPath();
            q.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
            c.closePath();
            c.fill();
            // strata: horizontal bands across the face
            c.save();
            c.clip();
            for (let s = 1; s < 4; s++) {
                const z = H * (s / 4) + (rnd() - 0.5) * 3;
                const a = P(f.b0[0] * 0.9, f.b0[1] * 0.9, z), b = P(f.b1[0] * 0.9, f.b1[1] * 0.9, z);
                c.strokeStyle = s % 2 ? 'rgba(40,26,14,0.28)' : 'rgba(255,230,190,0.12)';
                c.lineWidth = 1.2;
                c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
            }
            // ground occlusion at the base
            const g = c.createLinearGradient(0, P(0, 0, 0).y, 0, P(0, 0, H * 0.4).y);
            g.addColorStop(0, 'rgba(20,12,6,0.35)');
            g.addColorStop(1, 'rgba(20,12,6,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, w, h);
            c.restore();
        }

        // top surface
        const tp = top.map(([x, y, z]) => P(x, y, z));
        const tg = c.createLinearGradient(tp[6].x, tp[9].y, tp[0].x, tp[3].y);
        tg.addColorStop(0, 'rgb(196,166,124)');
        tg.addColorStop(1, 'rgb(158,128,92)');
        c.fillStyle = tg;
        c.beginPath();
        tp.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        c.closePath();
        c.fill();
        // lit rim on the north-west edges, dark lip on the south-east
        c.lineWidth = 1.2;
        for (let i = 0; i < K; i++) {
            const a = tp[i], b = tp[(i + 1) % K];
            const mx = (top[i][0] + top[(i + 1) % K][0]), my = (top[i][1] + top[(i + 1) % K][1]);
            c.strokeStyle = (mx + my) < 0 ? 'rgba(255,236,200,0.55)' : 'rgba(60,40,22,0.6)';
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        // cracks and loose rocks on top
        c.save();
        c.beginPath();
        tp.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        c.closePath();
        c.clip();
        c.strokeStyle = 'rgba(70,48,28,0.45)';
        c.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) {
            let p = P((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, H);
            c.beginPath(); c.moveTo(p.x, p.y);
            for (let k = 0; k < 3; k++) { p = { x: p.x + (rnd() - 0.5) * 14, y: p.y + (rnd() - 0.5) * 7 }; c.lineTo(p.x, p.y); }
            c.stroke();
        }
        for (let i = 0; i < 4; i++) {
            const p = P((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, H * 0.97);
            const r = 1.5 + rnd() * 2.5;
            c.fillStyle = 'rgba(80,58,36,0.6)';
            c.beginPath(); c.ellipse(p.x + 0.6, p.y + 0.6, r, r * 0.6, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(214,190,150,0.8)';
            c.beginPath(); c.ellipse(p.x - 0.3, p.y - 0.4, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); c.fill();
        }
        c.restore();
        return cv;
    }

    // ---------- build ----------
    function build() {
        const ms = getMapSize();
        SEED = (Math.random() * 100000) | 0;
        const W = ms * TILE_WIDTH + PAD * 2;
        const H = ms * TILE_HEIGHT + PAD * 2 + 20;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c = cv.getContext('2d');
        cache = { canvas: cv, ctx: c, ms, x0: ms * TILE_WIDTH / 2 + PAD };

        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);

        const diamond = () => {
            const a = cachePos(0, 0), b = cachePos(ms, 0), d = cachePos(ms, ms), e = cachePos(0, ms);
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y); c.closePath();
        };

        // 1. world texture through the iso transform
        const { land, water } = paintTextures(ms);
        const k = 1 / TEX;
        c.save();
        diamond();
        c.clip();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.setTransform(32 * k, 16 * k, -32 * k, 16 * k, cache.x0, PAD);
        c.drawImage(land, 0, 0);
        c.setTransform(1, 0, 0, 1, 0, 0);

        // 2. grain
        c.globalCompositeOperation = 'overlay';
        c.globalAlpha = 0.32;
        c.fillStyle = getGrain(c);
        c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';

        // cliff shadows (cast toward the east / south-east)
        for (let ty = 0; ty < ms; ty++) for (let tx = 0; tx < ms; tx++) {
            if (!isWall(tx, ty)) continue;
            const p = cachePos(tx + 1.15, ty + 0.75);
            const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 46);
            g.addColorStop(0, 'rgba(24,14,6,0.42)');
            g.addColorStop(1, 'rgba(24,14,6,0)');
            c.fillStyle = g;
            c.beginPath(); c.ellipse(p.x, p.y, 46, 22, 0, 0, Math.PI * 2); c.fill();
        }

        // 3. water on top of the wet sand
        c.setTransform(32 * k, 16 * k, -32 * k, 16 * k, cache.x0, PAD);
        c.drawImage(water, 0, 0);
        c.setTransform(1, 0, 0, 1, 0, 0);

        // 4. props
        const rnd = seededRnd(SEED + 99);
        for (let ty = 0; ty < ms; ty++) {
            for (let tx = 0; tx < ms; tx++) {
                const tile = game.map[ty][tx];
                if (tile.type !== 'grass' || tile.oil) continue;
                // keep the immediate surroundings of water / walls clean
                let nearObstacle = false;
                for (let dy = -1; dy <= 1 && !nearObstacle; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const t = game.map[ty + dy]?.[tx + dx];
                    if (t && (t.type === 'water')) { nearObstacle = true; break; }
                }
                const r = hash(tx, ty, SEED + 400);
                const p = cachePos(tx + 0.2 + hash(tx, ty, SEED + 401) * 0.6, ty + 0.2 + hash(tx, ty, SEED + 402) * 0.6);
                const nearWall = isWall(tx - 1, ty) || isWall(tx + 1, ty) || isWall(tx, ty - 1) || isWall(tx, ty + 1);
                if (nearWall && r < 0.55) {
                    // scree at the foot of the cliffs
                    for (let i = 0; i < 3; i++) boulder(c, p.x + (rnd() - 0.5) * 22, p.y + (rnd() - 0.5) * 10, 2 + rnd() * 3.5, -10);
                } else if (nearObstacle) {
                    if (r < 0.25) tuft(c, p.x, p.y, 1.1, rnd);
                } else if (r < 0.025) {
                    for (let i = 0; i < 2 + (rnd() * 3 | 0); i++) boulder(c, p.x + (rnd() - 0.5) * 20, p.y + (rnd() - 0.5) * 9, 2.5 + rnd() * 4.5, (rnd() * 20 - 10) | 0);
                } else if (r < 0.05) {
                    deadBush(c, p.x, p.y, rnd);
                } else if (r < 0.06) {
                    bones(c, p.x, p.y, rnd);
                } else if (r < 0.072) {
                    scrap(c, p.x, p.y, rnd);
                } else if (r < 0.1) {
                    cracks(c, p.x, p.y, rnd);
                } else if (r < 0.2) {
                    tuft(c, p.x, p.y, 0.8 + rnd() * 0.5, rnd);
                } else if (r < 0.205) {
                    tireTracks(c, p.x, p.y, rnd() * Math.PI * 2, 60 + rnd() * 80);
                }
            }
        }
        // oil patches
        for (const t of game.oilTiles || []) paintOil(t.x, t.y);

        // soft darkening toward the map edge so the border reads as a horizon
        c.globalCompositeOperation = 'source-atop';
        for (const [lw, al] of [[150, 0.1], [100, 0.12], [60, 0.14], [26, 0.18]]) {
            c.strokeStyle = `rgba(0,0,0,${al})`;
            c.lineWidth = lw;
            diamond();
            c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        c.restore();

        // rock wall sprites
        walls = [];
        for (let ty = 0; ty < ms; ty++) for (let tx = 0; tx < ms; tx++) {
            if (isWall(tx, ty)) walls.push({ tx, ty, x: tx + 0.5, y: ty + 0.5, depth: tx + ty + 1, sprite: null });
        }
    }

    function paintOil(tx, ty) {
        if (!cache) return;
        const tile = game.map[ty]?.[tx];
        if (!tile || !tile.oil) return;
        const p = cachePos(tx + 0.5, ty + 0.5);
        const depleted = tile.oilAmount !== undefined && tile.oilAmount <= 0;
        oilPool(cache.ctx, p.x, p.y, seededRnd(tx * 31 + ty * 17 + SEED), depleted);
    }

    // Blit the visible part of the cache
    function draw() {
        if (!cache) return;
        const zoom = getZoom();
        const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
        const o = worldToScreen(0, 0);
        const ox = o.x - cache.x0 * zoom, oy = o.y - PAD * zoom;   // screen pos of cache (0,0)
        let sx = -ox / zoom, sy = -oy / zoom, sw = cw / zoom, sh = ch / zoom;
        let dx = 0, dy = 0;
        if (sx < 0) { dx = -sx * zoom; sw += sx; sx = 0; }
        if (sy < 0) { dy = -sy * zoom; sh += sy; sy = 0; }
        sw = Math.min(sw, cache.canvas.width - sx);
        sh = Math.min(sh, cache.canvas.height - sy);
        if (sw > 0 && sh > 0) ctx.drawImage(cache.canvas, sx, sy, sw, sh, dx, dy, sw * zoom, sh * zoom);
    }

    function drawWall(w) {
        if (!w.sprite) w.sprite = makeWallSprite(w.tx, w.ty);
        const zoom = getZoom();
        const s = worldToScreen(w.x, w.y);
        const spr = w.sprite;
        ctx.drawImage(spr, s.x - spr.anchorX * zoom, s.y - spr.anchorY * zoom, spr.logicalWidth * zoom, spr.logicalHeight * zoom);
    }

    // Animated sparkle on live oil: slow bubbles and a drifting glint
    function drawOilAnimations() {
        if (!game.oilTiles) return;
        const zoom = getZoom();
        const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
        const now = Date.now();
        for (const t of game.oilTiles) {
            const tile = game.map[t.y]?.[t.x];
            if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) continue;
            if (tileFog(t.x, t.y) !== 2) continue;
            const s = worldToScreen(t.x + 0.5, t.y + 0.5);
            if (s.x < -50 || s.x > cw + 50 || s.y < -50 || s.y > ch + 50) continue;
            const ph = (now / 1100 + t.x * 1.7 + t.y * 0.9) % 3;
            if (ph < 1) {
                const r = (1.2 + ph * 1.8) * zoom;
                ctx.strokeStyle = `rgba(150,140,110,${0.6 * (1 - ph)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(s.x + 4 * zoom, s.y - zoom, r, r * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    function visibleWalls(out) {
        const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
        const zoom = getZoom();
        for (const w of walls) {
            if (tileFog(w.tx, w.ty) === 0) continue;
            const s = worldToScreen(w.x, w.y);
            if (s.x < -60 * zoom || s.x > cw + 60 * zoom || s.y < -20 * zoom || s.y > ch + 90 * zoom) continue;
            out.push(w);
        }
        return out;
    }

    return {
        build,
        draw,
        drawWall,
        drawOilAnimations,
        visibleWalls,
        repaintOil: paintOil,
        reset() { cache = null; walls = []; },
        get ready() { return !!cache; }
    };
})();
