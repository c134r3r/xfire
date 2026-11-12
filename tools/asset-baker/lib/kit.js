// ============================================
// Kit3D - 3D modelling kit for the asset baker
// Same primitive API as the game's 2D Surface (box, cyl, tube, sphere,
// blob, disc, wheel, track, spike, flag, glow, solid, poly), but every
// call builds real three.js geometry with PBR materials. Coordinates
// are the game's local sprite units: x = east, y = south, z = up,
// 32 units per tile, z in screen pixels.
// The special color 'TEAM' marks team-colored parts: they render as a
// neutral light paint and are written to the team mask.
// ============================================
import * as THREE from 'three';

export const TEAM = 'TEAM';

// ---------- color helpers (team-aware) ----------
export function hexRGB(color) {
    if (Array.isArray(color)) return color;
    if (typeof color === 'string' && color.startsWith('rgb')) {
        const m = color.match(/[\d.]+/g).map(Number);
        return [m[0], m[1], m[2]];
    }
    const num = parseInt(String(color).replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
export function alphaOf(color) {
    if (typeof color === 'string' && color.startsWith('rgba')) return Number(color.match(/[\d.]+/g)[3]);
    return 1;
}
export function tint(color, percent) {
    if (color === TEAM) return TEAM;
    const c = hexRGB(color);
    const amt = 2.55 * percent;
    const h = (v) => Math.max(0, Math.min(255, Math.round(v + amt))).toString(16).padStart(2, '0');
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
}
export function withAlpha(color, a) {
    if (color === TEAM) return TEAM;
    const c = hexRGB(color);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
export const rot = (yaw, x, y) => [x * Math.cos(yaw) - y * Math.sin(yaw), x * Math.sin(yaw) + y * Math.cos(yaw)];
export function fwd(yaw, d, side = 0) {
    const [x, y] = rot(yaw, d, side);
    return { x, y };
}

// ---------- procedural surface detail ----------
// Weathering is computed in the fragment shader from the object-space
// position (un-rotated by the model's yaw so it sticks to the vehicle
// in all 16 directions): camouflage blotches, grunge, rain streaks on
// vertical plates, paint chips and dust creeping up from the ground.
const NOISE_GLSL = `
uniform float uYaw;
uniform vec4 uCamo;      // rgb multiplier for the dark camo tone, a = amount
uniform vec4 uCamo2;     // second tone
uniform vec4 uDust;      // rgb dust color, a = amount
uniform vec4 uWear;      // x grunge, y streaks, z chips, w dust height
uniform float uSeed;
uniform float uFilm;
uniform float uPanel;
varying vec3 vOP;
float h31(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / 0.9375; }
`;
const DETAIL_GLSL = `
    float wc = cos(uYaw), ws = sin(uYaw);
    vec3 op = vec3(wc * vOP.x + ws * vOP.y, -ws * vOP.x + wc * vOP.y, vOP.z) + uSeed;
    vec3 gN = normalize(cross(dFdx(vOP), dFdy(vOP)));
    float wVert = 1.0 - abs(gN.z);
    float wN1 = fbm(op * 0.33);
    float wN2 = fbm(op * 1.2 + 5.0);
    // camouflage: two darker tones in large soft-edged blotches
    float cA = smoothstep(0.50, 0.535, fbm(op * 0.115 + 3.0));
    float cB = smoothstep(0.585, 0.615, fbm(op * 0.14 + 19.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uCamo.rgb, cA * uCamo.a);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uCamo2.rgb, cB * uCamo2.a);
    // machined panel seams on a regular grid (never on a face's own plane)
    if (uPanel > 0.0) {
        vec3 rN = abs(vec3(wc * gN.x + ws * gN.y, -ws * gN.x + wc * gN.y, gN.z));
        vec3 pg = abs(fract((op - uSeed) / uPanel + 0.5) - 0.5) * uPanel + rN * 9.0;
        float seam = 1.0 - smoothstep(0.1, 0.24, min(pg.x, min(pg.y, pg.z)));
        diffuseColor.rgb *= 1.0 - 0.42 * seam;
    }
    // sun-faded / stained paint
    diffuseColor.rgb *= 1.0 + uWear.x * (wN1 - 0.5) * 0.9 + uWear.x * (wN2 - 0.5) * 0.35;
    // streaks running down vertical plates
    float wS = vnoise(vec3(op.xy * 1.9, op.z * 0.16));
    diffuseColor.rgb *= 1.0 - uWear.y * wVert * smoothstep(0.5, 0.85, wS) * 0.42;
    // chipped paint down to dark primer/steel
    float wC = smoothstep(0.71, 0.76, vnoise(op * 2.6) * 0.75 + wN2 * 0.3);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.46, 0.42), wC * uWear.z);
    // dust: thick near the ground, a film on upward faces
    float wD = smoothstep(uWear.w, 0.0, vOP.z + (wN2 - 0.5) * uWear.w * 0.9);
    wD = max(wD, max(gN.z, 0.0) * smoothstep(0.42, 0.7, wN1) * uFilm);
    diffuseColor.rgb = mix(diffuseColor.rgb, uDust.rgb, clamp(wD * uDust.a, 0.0, 0.92));
`;

// How strongly each finish takes the kit's weathering style:
// [camo, grunge, streaks, chips, dust]
const WEAR = {
    paint:  [1, 1, 1, 1, 1],
    metal:  [0, 0.8, 0.7, 0.5, 0.8],
    rubber: [0, 0.5, 0, 0, 1.25],
    flesh:  [1, 1.2, 0.25, 0, 0.6],
    bone:   [0, 0.9, 0.5, 0, 0.5],
    glass:  [0, 0.15, 0, 0, 0.25],
    ground: [0, 1.3, 0, 0.7, 0.3]
};
export const STYLE_DEFAULT = {
    camo: [0.72, 0.74, 0.62, 0], camo2: [0.86, 0.72, 0.56, 0],
    dust: '#9c8058', dustAmt: 0.6, dustH: 4, grunge: 0.3, streaks: 0.6, chips: 0.5, seed: 0
};

// Material presets by "finish"
const FINISH = {
    paint:  { roughness: 0.6, metalness: 0.08 },
    metal:  { roughness: 0.42, metalness: 0.55 },
    rubber: { roughness: 0.92, metalness: 0.0 },
    flesh:  { roughness: 0.55, metalness: 0.0 },
    bone:   { roughness: 0.48, metalness: 0.0 },
    glass:  { roughness: 0.12, metalness: 0.3 },
    ground: { roughness: 0.95, metalness: 0.0 }
};

export class Kit3D {
    constructor(opts = {}) {
        this.group = new THREE.Group();
        this.glows = [];          // [{ x, y, z, r, color }]
        this.teamMeshes = [];
        this.matCache = new Map();
        this.pulse = opts.pulse || 1;
        this.finish = 'paint';    // default finish for new parts
        this.receiveOnly = false;
        this.yaw = opts.yaw || 0;                 // model yaw (weathering sticks to it)
        this.style = { ...STYLE_DEFAULT, ...(opts.style || {}) };
        this.bevel = opts.bevel === undefined ? 0.45 : opts.bevel;
    }

    // ---- materials ----
    mat(color, finish) {
        finish = finish || this.finish;
        const team = color === TEAM;
        const a = team ? 1 : alphaOf(color);
        const key = `${team ? 'T' : hexRGB(color).join(',')}|${a}|${finish}`;
        let m = this.matCache.get(key);
        if (m) return m;
        const f = FINISH[finish] || FINISH.paint;
        const col = team ? new THREE.Color('#d9d9d9') : new THREE.Color().setRGB(...hexRGB(color).map(v => v / 255), THREE.SRGBColorSpace);
        m = new THREE.MeshStandardMaterial({
            color: col,
            roughness: f.roughness,
            metalness: f.metalness,
            transparent: a < 1,
            opacity: a,
            depthWrite: a >= 0.99,
            side: THREE.DoubleSide
        });
        m.userData.team = team;
        m.userData.finish = finish;
        const st = this.style, w = WEAR[finish] || WEAR.paint;
        const dust = hexRGB(st.dust).map(v => Math.pow(v / 255, 2.2));
        const camoK = team ? 0 : w[0];
        const U = {
            uYaw: { value: this.yaw },
            uCamo: { value: new THREE.Vector4(st.camo[0], st.camo[1], st.camo[2], st.camo[3] * camoK) },
            uCamo2: { value: new THREE.Vector4(st.camo2[0], st.camo2[1], st.camo2[2], st.camo2[3] * camoK) },
            uDust: { value: new THREE.Vector4(dust[0], dust[1], dust[2], st.dustAmt * w[4] * (team ? 0.6 : 1) * (a < 1 ? 0 : 1)) },
            uWear: { value: new THREE.Vector4(st.grunge * w[1], st.streaks * w[2], st.chips * w[3] * (team ? 0.6 : 1), st.dustH) },
            uSeed: { value: st.seed },
            uFilm: { value: st.film === undefined ? 0.4 : st.film },
            uPanel: { value: finish === 'paint' && !team ? (st.panel || 0) : 0 }
        };
        m.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, U);
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vOP;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', '#include <common>\n' + NOISE_GLSL)
                .replace('#include <map_fragment>', '#include <map_fragment>\n' + DETAIL_GLSL)
                .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (wN1 - 0.5) * 0.35 + wD * uDust.a * 0.4, 0.06, 1.0);');
        };
        this.matCache.set(key, m);
        return m;
    }

    add(geom, color, finish, opts = {}) {
        const mesh = new THREE.Mesh(geom, this.mat(color, finish));
        mesh.castShadow = opts.cast !== false && alphaOf(color) >= 0.99;
        mesh.receiveShadow = true;
        if (color === TEAM) this.teamMeshes.push(mesh);
        this.group.add(mesh);
        return mesh;
    }

    // ---- generic convex solid from a stack of rings ----
    solidGeometry(bottom, top, mid = []) {
        const rings = [bottom, ...mid, top];
        const n = bottom.length;
        const pos = [];
        const pushTri = (a, b, c) => pos.push(...a, ...b, ...c);
        for (let r = 0; r < rings.length - 1; r++) {
            const lo = rings[r], hi = rings[r + 1];
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                pushTri(lo[i], lo[j], hi[j]);
                pushTri(lo[i], hi[j], hi[i]);
            }
        }
        for (let i = 1; i < n - 1; i++) {
            pushTri(top[0], top[i], top[i + 1]);
            pushTri(bottom[0], bottom[i + 1], bottom[i]);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2));
        return fixOutward(g);
    }

    // chamfer ring: the top ring pulled in toward its centroid
    static insetRing(ring, d, dz) {
        let cx = 0, cy = 0;
        for (const p of ring) { cx += p[0]; cy += p[1]; }
        cx /= ring.length; cy /= ring.length;
        return ring.map(p => {
            const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
            const k = Math.min(d, l * 0.45);
            return [p[0] - dx / l * k, p[1] - dy / l * k, p[2] + dz];
        });
    }

    solid(bottom, top, color, opts = {}) {
        // every solid gets a small chamfer on its top edges: real plate
        // and masonry is never knife-sharp, and the chamfer catches light
        const h = Math.min(...top.map((p, i) => p[2] - bottom[i][2]));
        const bv = opts.bevel === false ? 0 : Math.min(typeof opts.bevel === 'number' ? opts.bevel : this.bevel, h * 0.35);
        if (bv > 0.12) {
            const shoulder = top.map(p => [p[0], p[1], p[2] - bv]);
            this.add(this.solidGeometry(bottom, Kit3D.insetRing(shoulder, bv, bv), [shoulder]), color, opts.finish);
        } else this.add(this.solidGeometry(bottom, top), color, opts.finish);
        if (opts.topMark) {
            const [scale, mc] = opts.topMark;
            const n = top.length;
            let tx = 0, ty = 0, tz = 0;
            for (const p of top) { tx += p[0]; ty += p[1]; tz += p[2]; }
            tx /= n; ty /= n; tz /= n;
            const ring = top.map(p => [tx + (p[0] - tx) * scale, ty + (p[1] - ty) * scale, tz + (p[2] - tz) * scale]);
            this.solid(ring, ring.map(p => [p[0], p[1], p[2] + 0.35]), mc, { finish: opts.finish });
        }
        if (opts.band) {
            const [z0, z1, bc] = opts.band;
            const lerpRing = (z) => bottom.map((b, i) => {
                const t = top[i];
                const k = (z - b[2]) / ((t[2] - b[2]) || 1);
                return [b[0] + (t[0] - b[0]) * k, b[1] + (t[1] - b[1]) * k, z];
            });
            let cx = 0, cy = 0;
            for (const p of bottom) { cx += p[0]; cy += p[1]; }
            cx /= bottom.length; cy /= bottom.length;
            const grow = (ring) => ring.map(p => {
                const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
                return [p[0] + dx / l * 0.25, p[1] + dy / l * 0.25, p[2]];
            });
            this.solid(grow(lerpRing(z0)), grow(lerpRing(z1)), bc, { finish: opts.finish });
        }
    }

    // Rotated box with optional sloped sides (taper = front, back, inset all round)
    box(cx, cy, z, w, l, h, yaw, color, opts = {}) {
        const hw = w / 2, hl = l / 2;
        const ins = opts.inset || 0, tf = opts.taper || 0, tb = opts.back || 0;
        const sideIns = opts.sideInset !== undefined ? opts.sideInset : ins;
        const B = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
        const T = [[-hw + ins + tb, -hl + sideIns], [hw - ins - tf, -hl + sideIns], [hw - ins - tf, hl - sideIns], [-hw + ins + tb, hl - sideIns]];
        const tr = ([x, y], zz) => { const [rx, ry] = rot(yaw || 0, x, y); return [cx + rx, cy + ry, zz]; };
        this.solid(B.map(p => tr(p, z)), T.map(p => tr(p, z + h)), color, opts);
        if (opts.topColor) {
            const t = T.map(p => tr([p[0] * 0.98, p[1] * 0.98], z + h + 0.05));
            this.solid(t, t.map(p => [p[0], p[1], p[2] + 0.2]), opts.topColor, { finish: opts.finish });
        }
    }

    cyl(cx, cy, z, r, h, color, opts = {}) {
        const rt = opts.rTop !== undefined ? opts.rTop : r;
        const g = new THREE.CylinderGeometry(rt, r, Math.max(0.05, h), opts.seg || 24, 1, !!opts.noTop);
        g.rotateX(Math.PI / 2);
        g.translate(cx, cy, z + h / 2);
        this.add(g, color, opts.finish);
        if (opts.band) {
            const [z0, z1, bc] = opts.band;
            const rr0 = r + (rt - r) * (z0 / h) + 0.2, rr1 = r + (rt - r) * (z1 / h) + 0.2;
            const b = new THREE.CylinderGeometry(rr1, rr0, z1 - z0, opts.seg || 24, 1, true);
            b.rotateX(Math.PI / 2);
            b.translate(cx, cy, z + (z0 + z1) / 2);
            this.add(b, bc, opts.finish);
        }
        if (opts.topColor) this.disc(cx, cy, z + h + 0.05, rt * 0.96, opts.topColor);
    }

    // 2D sprite radii were screen pixels; 3D radius ~ px / 1.3
    tube(x1, y1, z1, x2, y2, z2, r, color, opts = {}) {
        const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
        const len = a.distanceTo(b);
        if (len < 1e-4) return;
        const rr = Math.max(0.18, r * 0.78);
        const g = new THREE.CylinderGeometry(rr, rr, len, opts.seg || 12, 1, false);
        // cylinder is along +Y: orient it from a to b
        const dir = b.clone().sub(a).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        g.applyQuaternion(q);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        g.translate(mid.x, mid.y, mid.z);
        this.add(g, color, opts.finish || (color === TEAM ? 'paint' : 'metal'));
        if (opts.cap !== 'butt' && rr > 0.35) {
            for (const p of [a, b]) {
                const s = new THREE.SphereGeometry(rr, 10, 8);
                s.translate(p.x, p.y, p.z);
                this.add(s, color, opts.finish || 'metal');
            }
        }
    }

    sphere(cx, cy, z, r, color, opts = {}) {
        const g = new THREE.SphereGeometry(r * 0.78, 20, 14);
        if (opts.scale) g.scale(...opts.scale);
        g.translate(cx, cy, z);
        this.add(g, color, opts.finish);
    }

    // dome: upper half ellipsoid standing on z
    blob(cx, cy, z, r, h, color, opts = {}) {
        const g = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        g.rotateX(Math.PI / 2);
        g.scale(r * (opts.stretchX || 1), r * (opts.stretchY || 1), h);
        g.translate(cx, cy, z);
        this.add(g, color, opts.finish || 'flesh');
    }

    disc(cx, cy, z, r, color, opts = {}) {
        const g = new THREE.CircleGeometry(1, 32);
        g.scale(r * (opts.stretchX || 1), r * (opts.stretchY || 1), 1);
        g.translate(cx, cy, z + 0.06);
        this.add(g, color, opts.finish, { cast: false });
        if (opts.edge) {
            const t = new THREE.TorusGeometry(1, (opts.edgeWidth || 1) * 0.04, 6, 40);
            t.scale(r * (opts.stretchX || 1), r * (opts.stretchY || 1), 1);
            t.translate(cx, cy, z + 0.15);
            this.add(t, opts.edge, 'metal', { cast: false });
        }
    }

    // Torus lying flat (rings, rims, fusion halos)
    ring(cx, cy, z, r, thick, color, opts = {}) {
        const g = new THREE.TorusGeometry(r, thick, 10, 48, opts.arc || Math.PI * 2);
        if (opts.tiltX) g.rotateX(opts.tiltX);
        if (opts.rotZ) g.rotateZ(opts.rotZ);
        g.translate(cx, cy, z);
        this.add(g, color, opts.finish || 'metal');
    }

    // Arched rib over a dome (bone frame / carapace ridges); lean = angle
    // of the rib's plane around the vertical axis
    rib(cx, cy, z, r, h, lean, color) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const t = (i / 16) * Math.PI;
            pts.push(new THREE.Vector3(Math.cos(t) * r * 1.01, 0, Math.sin(t) * h * 1.01));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const g = new THREE.TubeGeometry(curve, 24, 0.55, 6, false);
        g.rotateZ(Math.PI / 2 + lean);
        g.translate(cx, cy, z);
        this.add(g, color, 'bone');
    }

    // Satellite dish on a short mast
    dish(x, y, z, r, color) {
        const g = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32);
        g.rotateX(-Math.PI / 2 - 0.5);
        g.rotateZ(0.9);
        g.translate(x, y, z);
        this.add(g, color, 'metal');
        this.tube(x, y, z, x + 1.5, y + 1.5, z + 2.5, 0.3, '#2a2826');
    }

    // Side profile [[u, z], ...] (u = forward) extruded across `width`,
    // centred on (cx, cy), with real bevelled edges. This is how hulls,
    // track runs and gabled roofs are built.
    prism(cx, cy, profile, width, yaw, color, opts = {}) {
        const shape = new THREE.Shape(profile.map(([u, z]) => new THREE.Vector2(u, z)));
        if (opts.hole) shape.holes.push(new THREE.Path(opts.hole.map(([u, z]) => new THREE.Vector2(u, z))));
        const bv = opts.bevel === undefined ? 0.4 : opts.bevel;
        const g = new THREE.ExtrudeGeometry(shape, {
            depth: Math.max(0.05, width - bv * 2), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv,
            bevelOffset: -bv, bevelSegments: 1, steps: 1, curveSegments: 6
        });
        g.translate(0, 0, -(width - bv * 2) / 2);
        // shape x -> forward, shape y -> up, extrusion -> -side
        const c = Math.cos(yaw || 0), sn = Math.sin(yaw || 0);
        const m = new THREE.Matrix4().set(
            c, 0, sn, cx,
            sn, 0, -c, cy,
            0, 1, 0, opts.z || 0,
            0, 0, 0, 1);
        g.applyMatrix4(m);
        const flat = g.toNonIndexed();
        flat.computeVertexNormals();
        return this.add(flat, color, opts.finish, opts);
    }

    // Box with rounded plan corners and bevelled top/bottom edges
    rbox(cx, cy, z, w, l, h, yaw, color, opts = {}) {
        const r = Math.min(opts.radius === undefined ? 1 : opts.radius, w / 2 - 0.01, l / 2 - 0.01);
        const hw = w / 2, hl = l / 2;
        const sh = new THREE.Shape();
        sh.moveTo(-hw + r, -hl); sh.lineTo(hw - r, -hl); sh.quadraticCurveTo(hw, -hl, hw, -hl + r);
        sh.lineTo(hw, hl - r); sh.quadraticCurveTo(hw, hl, hw - r, hl);
        sh.lineTo(-hw + r, hl); sh.quadraticCurveTo(-hw, hl, -hw, hl - r);
        sh.lineTo(-hw, -hl + r); sh.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
        const bv = Math.min(opts.bevel === undefined ? 0.5 : opts.bevel, h * 0.4);
        const g = new THREE.ExtrudeGeometry(sh, {
            depth: h - bv * 2, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv,
            bevelSegments: opts.round ? 3 : 1, steps: 1, curveSegments: 5
        });
        g.translate(0, 0, bv);
        g.rotateZ(yaw || 0);
        g.translate(cx, cy, z);
        return this.add(g, color, opts.finish, opts);
    }

    // Free cylinder between two points with independent end radii
    // (gun barrels, exhausts, axles, legs)
    rod(x1, y1, z1, x2, y2, z2, r1, r2, color, opts = {}) {
        const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
        const len = a.distanceTo(b);
        if (len < 1e-4) return;
        const g = new THREE.CylinderGeometry(r2 === undefined ? r1 : r2, r1, len, opts.seg || 14, 1, false);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
        const mid = a.add(b).multiplyScalar(0.5);
        g.translate(mid.x, mid.y, mid.z);
        return this.add(g, color, opts.finish || 'metal', opts);
    }

    // Ellipsoid (rx, ry along the model's forward/side axes)
    ellipsoid(cx, cy, z, rx, ry, rz, yaw, color, opts = {}) {
        const g = new THREE.SphereGeometry(1, 24, 16);
        g.scale(rx, ry, rz);
        g.rotateZ(yaw || 0);
        g.translate(cx, cy, z);
        return this.add(g, color, opts.finish);
    }

    shadow() { /* real shadows are cast by the sun */ }

    glow(x, y, z, r, color) {
        r *= this.pulse || 1;
        const g = new THREE.SphereGeometry(Math.max(0.3, r * 0.55), 12, 10);
        g.translate(x, y, z);
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...hexRGB(color).map(v => Math.min(1, v / 255 * 0.5 + 0.55)), THREE.SRGBColorSpace) });
        const mesh = new THREE.Mesh(g, m);
        this.group.add(mesh);
        this.glows.push({ x, y, z, r, color });
    }
    glowDot(x, y, z, r, color) { this.glow(x, y, z, r, color); }

    wheel(cx, cy, z, r, width, yaw, tire = '#22201d', hub = '#77786f') {
        const side = new THREE.Vector3(-Math.sin(yaw), Math.cos(yaw), 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), side);
        const hw = width / 2;
        // tyre with rounded shoulders, recessed rim, hub
        const prof = [[r * 0.5, -hw * 0.82], [r * 0.86, -hw], [r, -hw * 0.6], [r, hw * 0.6], [r * 0.86, hw], [r * 0.5, hw * 0.82]];
        const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 26);
        g.applyQuaternion(q);
        g.translate(cx, cy, z + r);
        this.add(g, tire, 'rubber');
        // chunky tread lugs
        const lugs = Math.max(10, Math.round(r * 4.5));
        for (let i = 0; i < lugs; i++) {
            const a = (i / lugs) * Math.PI * 2;
            const f = fwd(yaw, Math.cos(a) * r, 0);
            const t = new THREE.BoxGeometry(width * 0.92, r * 0.2, r * 0.14);
            t.rotateX(-a);
            t.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw + Math.PI / 2));
            t.translate(cx + f.x, cy + f.y, z + r + Math.sin(a) * r);
            this.add(t, tint(tire, -5), 'rubber', { cast: false });
        }
        for (const s of [-1, 1]) {
            const rim = new THREE.CylinderGeometry(r * 0.5, r * 0.56, hw * 0.5, 18);
            rim.applyQuaternion(q);
            rim.translate(cx + side.x * s * hw * 0.62, cy + side.y * s * hw * 0.62, z + r);
            this.add(rim, hub, 'metal');
            const cap = new THREE.CylinderGeometry(r * 0.17, r * 0.2, hw * 0.3, 10);
            cap.applyQuaternion(q);
            cap.translate(cx + side.x * s * hw * 0.95, cy + side.y * s * hw * 0.95, z + r);
            this.add(cap, tint(hub, -18), 'metal');
        }
    }

    // Track assembly: tread block, road wheels, drive sprocket, tread grousers
    track(off, len, width, h, yaw, color, wheelColor) {
        const c0 = fwd(yaw, 0, off);
        this.box(c0.x, c0.y, 0, len, width, h, yaw, color, { inset: 1.2, sideInset: 0.15, finish: 'rubber' });
        const n = Math.max(3, Math.round(len / 6));
        for (let i = 0; i < n; i++) {
            const t = (i / (n - 1) - 0.5) * (len - 6);
            for (const s of [-1, 1]) {
                const wp = fwd(yaw, t, off + s * (width * 0.5 + 0.35));
                const g = new THREE.CylinderGeometry(h * 0.4, h * 0.4, 1.0, 16);
                g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(yaw), Math.cos(yaw), 0)));
                g.translate(wp.x, wp.y, h * 0.45);
                this.add(g, wheelColor || '#5a5a54', 'metal', { cast: false });
            }
        }
        // grousers on top run
        for (let i = 0; i < Math.round(len / 2.2); i++) {
            const t = -len / 2 + 1.5 + i * 2.2;
            const p = fwd(yaw, t, off);
            const g = new THREE.BoxGeometry(0.7, width * 0.98, 0.5);
            g.rotateZ(yaw);
            g.translate(p.x, p.y, h + 0.1);
            this.add(g, tint(color, -8), 'rubber', { cast: false });
        }
    }

    spike(cx, cy, z, yaw, len, baseW, rise, color) {
        const tip = new THREE.Vector3(cx + Math.cos(yaw) * len, cy + Math.sin(yaw) * len, z + rise);
        const base = new THREE.Vector3(cx, cy, z);
        const L = tip.distanceTo(base);
        if (L < 1e-3) return;
        const g = new THREE.ConeGeometry(baseW * 0.42, L, 10);
        g.translate(0, L / 2, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize()));
        g.translate(cx, cy, z);
        this.add(g, color, 'bone');
    }

    flag(x, y, z, team, size = 1) {
        this.tube(x, y, z, x, y, z + 18 * size, 0.6, '#9a9a94');
        const W = 9 * size, H = 5.5 * size;
        const g = new THREE.PlaneGeometry(W, H, 8, 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const u = (p.getX(i) + W / 2) / W;
            p.setZ(i, Math.sin(u * Math.PI * 1.6) * 1.1 * size * u);
        }
        g.computeVertexNormals();
        // plane XY -> vertical plane along (1,-0.35) direction
        g.rotateX(Math.PI / 2);
        g.rotateZ(-0.35);
        g.translate(x + W / 2 * Math.cos(-0.35), y + W / 2 * Math.sin(-0.35), z + 18 * size - H / 2);
        this.add(g, team === TEAM ? TEAM : team, 'paint');
    }

    // Flat polygon (windows, stripes, hatches) nudged toward the camera
    poly(points, color) {
        if (points.length < 3) return;
        const a = new THREE.Vector3(...points[0]), b = new THREE.Vector3(...points[1]), c = new THREE.Vector3(...points[2]);
        const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        if (n.x + n.y + n.z < 0) n.negate();
        const pos = [];
        const off = n.clone().multiplyScalar(0.12);
        const P = points.map(p => new THREE.Vector3(...p).add(off));
        for (let i = 1; i < P.length - 1; i++) pos.push(...P[0].toArray(), ...P[i].toArray(), ...P[i + 1].toArray());
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0.5), 2));
        g.computeVertexNormals();
        const isWindow = typeof color === 'string' && /^#(7fb9dd|9fc8dc|ffd98a)/i.test(color);
        this.add(g, color, isWindow ? 'glass' : undefined, { cast: false });
    }
}

// Flat-shade a solid and make every face normal point away from the
// solid's centroid (ring winding varies with yaw)
function fixOutward(g) {
    const pos = g.attributes.position;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < pos.count; i++) { cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); }
    cx /= pos.count; cy /= pos.count; cz /= pos.count;
    const nrm = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
        A.fromBufferAttribute(pos, i); B.fromBufferAttribute(pos, i + 1); C.fromBufferAttribute(pos, i + 2);
        const n = B.clone().sub(A).cross(C.clone().sub(A));
        if (n.lengthSq() < 1e-10) n.set(0, 0, 1);
        n.normalize();
        const m = A.clone().add(B).add(C).multiplyScalar(1 / 3).sub(new THREE.Vector3(cx, cy, cz));
        if (n.dot(m) < 0) {
            n.negate();
            // swap winding too
            const tx = pos.getX(i + 1), ty = pos.getY(i + 1), tz = pos.getZ(i + 1);
            pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
            pos.setXYZ(i + 2, tx, ty, tz);
        }
        for (let k = 0; k < 3; k++) nrm.push(n.x, n.y, n.z);
    }
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
}
