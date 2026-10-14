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

function makeCamera(w, h, ax, ay) {
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
    sun.position.copy(SUN.clone().multiplyScalar(300));
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
    plane.position.z = 0;
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
    const cam = makeCamera(spec.w, spec.h, spec.w - spec.ax, spec.ay);
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
    for (const [o, m] of saved) { o.material = m; o.visible = true; }

    scene.remove(kit.group);
    edgeLight(color, normals);
    return compose(color, shadow, mask, kit, spec, opts);
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
        sd.data[i + 3] = solid ? 217 : 0;
    }
    sc.putImageData(sd, 0, 0);

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const oc = out.getContext('2d');
    if (opts.groundShadow !== false) {
        oc.globalAlpha = 0.85;
        oc.drawImage(shadow, 0, 0);
        oc.globalAlpha = 1;
    }
    const d = k * 0.75;
    if (opts.outline !== false) {
        for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d * 0.7, -d * 0.7], [d * 0.7, d * 0.7], [-d * 0.7, d * 0.7], [d * 0.7, -d * 0.7]]) {
            oc.drawImage(sil, ox, oy);
        }
    }
    oc.drawImage(color, 0, 0);

    // glow halos (lamps, energy cores, eyes)
    oc.globalCompositeOperation = 'lighter';
    for (const g of kit.glows) {
        const px = (spec.ax + (g.x - g.y)) * k;
        const py = (spec.ay + (g.x + g.y) / 2 - g.z) * k;
        const rad = g.r * 3 * k;
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
    return { color: down(out), mask: down(mk) };
}

function hexToRgb(c) {
    if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).join(',');
    const n = parseInt(c.replace('#', ''), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
