// ============================================
// Iso renderer for the asset baker
// An orthographic camera looking along (1,1,1) with non-uniform screen
// scaling reproduces the game's 2:1 projection exactly:
//   screen x = x - y,  screen y = (x + y) / 2 - z   (local sprite units)
// so baked sprites line up with the engine's anchors and turret mounts.
// Each sprite is rendered in three passes (color, ground shadow, team
// mask), then glow halos and a dark contour are added in 2D.
// ============================================
import * as THREE from 'three';

export const RS = 4;   // render pixels per logical pixel (supersampling)
export const OUT = 2;  // stored pixels per logical pixel

const SUN = new THREE.Vector3(-0.45, 0.35, 0.82).normalize();
// top-down sprites (Ironclad): light from the upper left of the screen
const SUN_TOP = new THREE.Vector3(-0.42, -0.52, 0.74).normalize();
const AO_DIRS = 16;

let renderer = null;

function getRenderer() {
    if (renderer) return renderer;
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = !globalThis.NO_SHADOW;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    return renderer;
}

function makeCamera(w, h, ax, ay, view, scale = 1) {
    if (view === 'top') {
        // straight down: screen x = x, screen y = y (scale px per unit)
        const cam = new THREE.OrthographicCamera(-ax / scale, (w - ax) / scale, ay / scale, -(h - ay) / scale, 1, 2000);
        cam.up.set(0, -1, 0);
        cam.position.set(0, 0, 600);
        cam.lookAt(0, 0, 0);
        cam.updateProjectionMatrix();
        return cam;
    }
    // view basis: e1 = screen right, e2 = screen down, e3 = toward viewer
    const sx = Math.SQRT2;            // px per view unit horizontally
    const sy = 3 / Math.sqrt(6);      // px per view unit vertically (1.2247)
    const cam = new THREE.OrthographicCamera(-ax / sx, (w - ax) / sx, ay / sy, -(h - ay) / sy, 1, 2000);
    cam.up.set(-1, -1, 2).normalize();
    cam.position.set(600, 600, 600);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    return cam;
}

function makeScene(group, opts) {
    const scene = new THREE.Scene();
    scene.add(group);

    const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x8a7050, 2.6);
    hemi.position.set(0, 0, 1);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d6, 7.5);
    sun.position.copy((opts.view === 'top' ? SUN_TOP : SUN).clone().multiplyScalar(300));
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    const ext = opts.shadowExtent || 90;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 800;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.25;
    scene.add(sun, sun.target);

    // soft bounce from the camera side so shadowed faces keep detail
    const fill = new THREE.DirectionalLight(0xbfd2ff, 1.1);
    fill.position.set(200, 220, 120);
    scene.add(fill);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.5 }));
    plane.position.z = opts.groundZ || 0;
    plane.receiveShadow = true;
    scene.add(plane);
    return { scene, plane };
}

function readCanvas(r, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.translate(w, 0);
    x.scale(-1, 1);
    x.drawImage(r.domElement, 0, 0);
    return c;
}

// Render one model (a Kit3D) into a sprite cell.
// spec: { w, h, ax, ay } in logical pixels.
export function renderSprite(kit, spec, opts = {}) {
    const r = getRenderer();
    const W = spec.w * RS, H = spec.h * RS;
    r.setSize(W, H, false);
    // the game's axes (x east, y south, z up) are left-handed: render
    // mirrored around the anchor and flip the image back afterwards
    const cam = makeCamera(spec.w, spec.h, spec.w - spec.ax, spec.ay, opts.view, spec.scale || 1);
    const { scene, plane } = makeScene(kit.group, opts);

    // pass 1: color (no ground plane)
    plane.visible = false;
    r.render(scene, cam);
    const color = readCanvas(r, W, H);

    // pass 2: ground shadow only (model invisible but still casting)
    plane.visible = true;
    const saved = [];
    kit.group.traverse(o => {
        if (o.isMesh) { saved.push([o, o.material]); }
    });
    const hidden = new THREE.MeshBasicMaterial({ colorWrite: false });
    for (const [o] of saved) o.material = hidden;
    r.render(scene, cam);
    const shadow = readCanvas(r, W, H);

    // pass 3: team mask (team parts white, everything else black)
    plane.visible = false;
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    for (const [o, m] of saved) {
        const team = Array.isArray(m) ? false : !!m.userData?.team;
        o.material = team ? white : black;
        if (m.transparent && m.opacity < 0.5) o.visible = false;
    }
    const tm = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.render(scene, cam);
    r.toneMapping = tm;
    const mask = readCanvas(r, W, H);
    // pass 4: view-space normals for the edge-highlight post pass
    const nmat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, flatShading: true });
    for (const [o, m] of saved) {
        o.material = nmat;
        if (m.transparent && m.opacity < 0.5) o.visible = false;
    }
    r.toneMapping = THREE.NoToneMapping;
    r.render(scene, cam);
    r.toneMapping = tm;
    const normals = readCanvas(r, W, H);
    // pass 5: sky occlusion (model + ground), see ambientOcclusion()
    for (const [o, m] of saved) { if (m.transparent && m.opacity < 0.5) o.visible = false; }
    const ao = opts.ao === false ? null : ambientOcclusion(r, kit.group, cam, W, H, opts);
    for (const [o, m] of saved) { o.material = m; o.visible = true; }

    scene.remove(kit.group);
    edgeLight(color, normals);
    let contact = null;
    if (ao) contact = applyAO(color, ao, opts);
    opts = { ...opts, contact };
    return compose(color, shadow, mask, kit, spec, opts);
}

// Sky occlusion by shadow accumulation: light the scene from AO_DIRS
// directions spread over the sky dome, once with shadows and once
// without. The ratio is how much of the sky each pixel can see; it
// darkens crevices on the model and gives a soft contact shadow on the
// ground, which is what makes a sprite sit in the terrain.
let aoRig = null;
function ambientOcclusion(r, group, cam, W, H, opts) {
    if (!aoRig) {
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const dirs = [];
        for (let i = 0; i < AO_DIRS; i++) {
            const z = 0.22 + 0.78 * (i + 0.5) / AO_DIRS, a = i * 2.39996323, q = Math.sqrt(1 - z * z);
            dirs.push(new THREE.Vector3(Math.cos(a) * q, Math.sin(a) * q, z));
        }
        const shadowed = new THREE.Scene(), open = new THREE.Scene();
        shadowed.overrideMaterial = mat; open.overrideMaterial = mat;
        const light = new THREE.DirectionalLight(0xffffff, Math.PI * 0.9);
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.radius = 4;
        light.shadow.bias = -0.0008;
        light.shadow.normalBias = 0.35;
        light.shadow.camera.near = 10; light.shadow.camera.far = 800;
        shadowed.add(light, light.target);
        for (const d of dirs) {
            const l = new THREE.DirectionalLight(0xffffff, Math.PI * 0.9 / AO_DIRS);
            l.position.copy(d).multiplyScalar(300);
            open.add(l, l.target);
        }
        const mk = () => { const p = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat); p.receiveShadow = true; return p; };
        aoRig = { dirs, shadowed, open, light, planes: [mk(), mk()] };
        shadowed.add(aoRig.planes[0]); open.add(aoRig.planes[1]);
    }
    const { dirs, shadowed, open, light, planes } = aoRig;
    for (const p of planes) { p.position.z = opts.groundZ || 0; p.visible = opts.groundShadow !== false; }
    const ext = (opts.shadowExtent || 90) * 1.25;
    const sc = light.shadow.camera;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.updateProjectionMatrix();
    const tm = r.toneMapping, cs = r.outputColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    const grab = () => readCanvas(r, W, H).getContext('2d').getImageData(0, 0, W, H).data;
    const acc = new Float32Array(W * H);
    shadowed.add(group);
    for (const d of dirs) {
        light.position.copy(d).multiplyScalar(300);
        r.render(shadowed, cam);
        const px = grab();
        for (let i = 0; i < acc.length; i++) acc[i] += px[i * 4];
    }
    shadowed.remove(group);
    open.add(group);
    r.render(open, cam);
    const ref = grab();
    open.remove(group);
    r.toneMapping = tm; r.outputColorSpace = cs;
    for (let i = 0; i < acc.length; i++) {
        const d = ref[i * 4];
        acc[i] = d < 6 ? 1 : Math.min(1, acc[i] / AO_DIRS / d);
    }
    return acc;
}

// Multiply the occlusion into the model; returns the ground part as a
// black canvas whose alpha is the contact shadow
function applyAO(color, ao, opts) {
    const W = color.width, H = color.height;
    const cc = color.getContext('2d');
    const img = cc.getImageData(0, 0, W, H), d = img.data;
    const ground = document.createElement('canvas');
    ground.width = W; ground.height = H;
    const gc = ground.getContext('2d');
    const gi = gc.createImageData(W, H);
    const K = opts.aoStrength === undefined ? 0.78 : opts.aoStrength;
    const fadeW = Math.min(W, H) * 0.14;
    for (let i = 0, p = 0; i < ao.length; i++, p += 4) {
        const o = 1 - ao[i];
        if (d[p + 3] > 8) {
            // occluded paint goes dark and slightly cool (sky light only)
            const f = 1 - K * Math.pow(o, 0.9);
            d[p] *= f * (1 - 0.04 * o); d[p + 1] *= f; d[p + 2] *= f * (1 + 0.03 * o);
        }
        if (d[p + 3] < 250) {
            // fade out toward the cell border so sprites never show their box
            const x = i % W, y = (i / W) | 0;
            const edge = Math.min(1, Math.min(x, W - 1 - x, y, H - 1 - y) / fadeW);
            gi.data[p + 3] = Math.min(255, Math.pow(Math.max(0, o - 0.03), 1.15) * 255 * 0.9 * edge * edge * (3 - 2 * edge));
        }
    }
    cc.putImageData(img, 0, 0);
    gc.putImageData(gi, 0, 0);
    const soft = document.createElement('canvas');
    soft.width = W; soft.height = H;
    const sc = soft.getContext('2d');
    sc.filter = `blur(${RS * 0.6}px)`;
    sc.drawImage(ground, 0, 0);
    return soft;
}

// Crisp bevels: where the surface normal changes sharply, add a light
// lip on edges facing the sun and a dark crease on the others
function edgeLight(color, normals) {
    const W = color.width, H = color.height;
    const cc = color.getContext('2d');
    const img = cc.getImageData(0, 0, W, H), d = img.data;
    const n = normals.getContext('2d').getImageData(0, 0, W, H).data;
    const out = new Uint8ClampedArray(d);
    const R = 2;   // edge half-width in render pixels
    for (let y = R; y < H - R; y++) {
        for (let x = R; x < W - R; x++) {
            const i = (y * W + x) * 4;
            if (d[i + 3] < 128) continue;
            let diff = 0;
            for (const [dx, dy] of [[R, 0], [-R, 0], [0, R], [0, -R]]) {
                const j = ((y + dy) * W + x + dx) * 4;
                if (n[j + 3] < 128) continue;
                diff = Math.max(diff, Math.abs(n[i] - n[j]) + Math.abs(n[i + 1] - n[j + 1]) + Math.abs(n[i + 2] - n[j + 2]));
            }
            if (diff < 70) continue;
            // view normal (mirrored image: flip x); up-facing or left-facing = lit
            const nx = -(n[i] / 127.5 - 1), ny = n[i + 1] / 127.5 - 1;
            const lit = ny * 0.8 - nx * 0.5 > 0.15;
            const k = Math.min(1, (diff - 70) / 120);
            if (lit) {
                out[i] = d[i] + (255 - d[i]) * 0.32 * k;
                out[i + 1] = d[i + 1] + (245 - d[i + 1]) * 0.3 * k;
                out[i + 2] = d[i + 2] + (215 - d[i + 2]) * 0.26 * k;
            } else {
                out[i] = d[i] * (1 - 0.3 * k);
                out[i + 1] = d[i + 1] * (1 - 0.3 * k);
                out[i + 2] = d[i + 2] * (1 - 0.28 * k);
            }
        }
    }
    img.data.set(out);
    cc.putImageData(img, 0, 0);
}

// 2D post: glow halos, contour, shadow underlay, downsample
function compose(color, shadow, mask, kit, spec, opts) {
    const W = color.width, H = color.height;
    const k = RS;

    // dark contour around the model silhouette
    const sil = document.createElement('canvas');
    sil.width = W; sil.height = H;
    const sc = sil.getContext('2d');
    // outline only around solid pixels: semi-transparent ground decals
    // would otherwise stack into a dark halo
    sc.drawImage(color, 0, 0);
    const sd = sc.getImageData(0, 0, W, H);
    for (let i = 0; i < sd.data.length; i += 4) {
        const solid = sd.data[i + 3] > 200;
        sd.data[i] = 16; sd.data[i + 1] = 11; sd.data[i + 2] = 6;
        sd.data[i + 3] = solid ? (opts.outlineAlpha === undefined ? 120 : opts.outlineAlpha) : 0;
    }
    sc.putImageData(sd, 0, 0);

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const oc = out.getContext('2d');
    // ground layer: sun shadow + soft contact occlusion
    const under = document.createElement('canvas');
    under.width = W; under.height = H;
    if (opts.groundShadow !== false) {
        const uc = under.getContext('2d');
        uc.globalAlpha = 0.85;
        uc.drawImage(shadow, 0, 0);
        uc.globalAlpha = 1;
        if (opts.contact) uc.drawImage(opts.contact, 0, 0);
        if (!opts.separateShadow) oc.drawImage(under, 0, 0);
    }
    const d = k * 0.5;
    if (opts.outline !== false) {
        for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d * 0.7, -d * 0.7], [d * 0.7, d * 0.7], [-d * 0.7, d * 0.7], [d * 0.7, -d * 0.7]]) {
            oc.drawImage(sil, ox, oy);
        }
    }
    oc.drawImage(color, 0, 0);

    // glow halos (lamps, energy cores, eyes)
    oc.globalCompositeOperation = 'lighter';
    for (const g of kit.glows) {
        const top = opts.view === 'top', gs = spec.scale || 1;
        const px = top ? (spec.ax + g.x * gs) * k : (spec.ax + (g.x - g.y)) * k;
        const py = top ? (spec.ay + g.y * gs) * k : (spec.ay + (g.x + g.y) / 2 - g.z) * k;
        const rad = g.r * 3 * k * (top ? gs : 1);
        const c = g.color.match ? g.color : '#ffffff';
        const rgb = hexToRgb(c);
        const grad = oc.createRadialGradient(px, py, 0, px, py, rad);
        grad.addColorStop(0, `rgba(${rgb},0.8)`);
        grad.addColorStop(0.35, `rgba(${rgb},0.3)`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        oc.fillStyle = grad;
        oc.beginPath(); oc.arc(px, py, rad, 0, Math.PI * 2); oc.fill();
    }
    oc.globalCompositeOperation = 'source-over';

    const down = (src) => {
        const f = document.createElement('canvas');
        f.width = spec.w * OUT; f.height = spec.h * OUT;
        const fc = f.getContext('2d');
        fc.imageSmoothingEnabled = true;
        fc.imageSmoothingQuality = 'high';
        // two-step downscale for clean antialiasing
        const mid = document.createElement('canvas');
        mid.width = W / 2; mid.height = H / 2;
        const mc = mid.getContext('2d');
        mc.imageSmoothingQuality = 'high';
        mc.drawImage(src, 0, 0, mid.width, mid.height);
        fc.drawImage(mid, 0, 0, f.width, f.height);
        return f;
    };
    // mask -> white with alpha = mask value, cut to the visible model
    const mk = document.createElement('canvas');
    mk.width = W; mk.height = H;
    const mctx = mk.getContext('2d');
    mctx.drawImage(mask, 0, 0);
    const md = mctx.getImageData(0, 0, W, H);
    for (let i = 0; i < md.data.length; i += 4) {
        const v = md.data[i];
        md.data[i] = md.data[i + 1] = md.data[i + 2] = 255;
        md.data[i + 3] = md.data[i + 3] ? v : 0;
    }
    mctx.putImageData(md, 0, 0);
    return { color: down(out), mask: down(mk), shadow: opts.separateShadow ? down(under) : null };
}

function hexToRgb(c) {
    if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).join(',');
    const n = parseInt(c.replace('#', ''), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
