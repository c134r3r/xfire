// Bake page: exposes window.bake(job) to the node driver.
import { Kit3D, TEAM } from './kit.js';
import { STYLES } from './styles.js';
import { renderSprite, OUT } from './iso.js';
import { UNIT_BUILDERS, TURRET_BUILDERS, BUILDING_BUILDERS } from './models.js';

const DIRS = 16;
export const UNIT_CANVAS = {
    trooper: [60, 60, 30, 44], flamer: [60, 60, 30, 44], rocketeer: [60, 60, 30, 44],
    bike: [76, 66, 38, 44], buggy: [86, 74, 43, 48],
    tank: [100, 84, 50, 54], heavy: [124, 104, 62, 64], artillery: [116, 104, 58, 64]
};
const TURRET_CANVAS = [96, 84, 48, 52];

function cell(kind, role, faction, dir, frame) {
    const pal = FACTIONS[faction].palette;
    if (kind === 'building') {
        const ft = (BUILDING_TYPES[role] || { size: 2 }).size;
        const w = ft * 64 + 40, h = ft * 32 + 96;
        const spec = { w, h, ax: w / 2, ay: h - ft * 16 - 12 };
        const kit = new Kit3D({ pulse: frame === 1 ? 1.3 : 1, style: STYLES[faction].building });
        BUILDING_BUILDERS[role](kit, ft, pal, faction, frame, TEAM);
        return { spec, out: renderSprite(kit, spec, { shadowExtent: ft * 50 + 40 }) };
    }
    const yaw = (dir / DIRS) * Math.PI * 2;
    const kit = new Kit3D({ yaw, style: STYLES[faction][role] || STYLES[faction].unit });
    let c;
    if (kind === 'turret') {
        c = TURRET_CANVAS;
        TURRET_BUILDERS[role](kit, yaw, pal, faction, TEAM);
    } else {
        c = UNIT_CANVAS[role];
        UNIT_BUILDERS[role](kit, yaw, pal, faction, TEAM, frame);
    }
    const spec = { w: c[0], h: c[1], ax: c[2], ay: c[3] };
    // turrets float above the hull: no ground shadow of their own
    return { spec, out: renderSprite(kit, spec, { groundShadow: kind !== 'turret', shadowExtent: 70 }) };
}

// Bake a whole sheet: columns = directions, rows = frames
window.bake = async (job) => {
    const { kind, role, faction, dirs, frames } = job;
    let spec = null, sheet = null, mask = null, sc, mc;
    for (let f = 0; f < frames; f++) {
        for (let d = 0; d < dirs; d++) {
            const r = cell(kind, role, faction, d, f);
            if (!sheet) {
                spec = r.spec;
                sheet = document.createElement('canvas');
                sheet.width = spec.w * OUT * dirs; sheet.height = spec.h * OUT * frames;
                mask = document.createElement('canvas');
                mask.width = sheet.width; mask.height = sheet.height;
                sc = sheet.getContext('2d'); mc = mask.getContext('2d');
            }
            sc.drawImage(r.out.color, d * spec.w * OUT, f * spec.h * OUT);
            mc.drawImage(r.out.mask, d * spec.w * OUT, f * spec.h * OUT);
        }
    }
    return { spec, color: sheet.toDataURL('image/png'), mask: mask.toDataURL('image/png') };
};
window.bakerReady = true;

// ---- preview contact sheet (tools/asset-baker/preview.mjs) ----
import { TURRET_MOUNT, TOWER_TURRET_MOUNT } from './models.js';
function tintCell(r, team) {
    const c = document.createElement('canvas'); c.width = r.out.color.width; c.height = r.out.color.height;
    const x = c.getContext('2d');
    x.drawImage(r.out.color, 0, 0);
    const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
    const mx = m.getContext('2d');
    mx.drawImage(r.out.mask, 0, 0); mx.globalCompositeOperation = 'source-in'; mx.fillStyle = team; mx.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'multiply'; x.drawImage(m, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(r.out.color, 0, 0);
    x.globalCompositeOperation = 'source-over';
    return c;
}
window.preview = async ({ specs, zoom, dirs, frame, team, bg }) => {
    const cells = [];
    for (const sp of specs) {
        const parts = sp.split(':');
        if (parts[0] === 'b') {
            const [, role, faction] = parts;
            const r = cell('building', role, faction, 0, frame);
            const c = tintCell(r, team);
            const tz = TOWER_TURRET_MOUNT[role] && TOWER_TURRET_MOUNT[role][faction];
            if (tz) {
                const t = cell('turret', role, faction, dirs[0], 0);
                c.getContext('2d').drawImage(tintCell(t, team), (r.spec.ax - t.spec.ax) * OUT, (r.spec.ay - tz - t.spec.ay) * OUT);
            }
            cells.push(c);
            continue;
        }
        const [role, faction] = parts;
        for (const d of dirs) {
            const r = cell('unit', role, faction, d, frame);
            const c = tintCell(r, team);
            const m = TURRET_MOUNT[role] && TURRET_MOUNT[role][faction];
            if (m) {
                const t = cell('turret', role, faction, d, 0);
                const yaw = (d / DIRS) * Math.PI * 2;
                const mx = m.ox * Math.cos(yaw), my = m.ox * Math.sin(yaw);
                c.getContext('2d').drawImage(tintCell(t, team), (r.spec.ax + (mx - my) - t.spec.ax) * OUT, (r.spec.ay + (mx + my) / 2 - m.z - t.spec.ay) * OUT);
            }
            cells.push(c);
        }
    }
    const Z = zoom / OUT, pad = 6;
    const maxW = 1900;
    let x = pad, y = pad, rowH = 0; const pos = [];
    for (const c of cells) {
        const w = c.width * Z, h = c.height * Z;
        if (x + w + pad > maxW && x > pad) { x = pad; y += rowH + pad; rowH = 0; }
        pos.push([x, y, w, h]); x += w + pad; rowH = Math.max(rowH, h);
    }
    const cv = document.createElement('canvas');
    cv.width = Math.min(maxW, Math.max(...pos.map(p => p[0] + p[2])) + pad); cv.height = y + rowH + pad;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.imageSmoothingQuality = 'high';
    cells.forEach((c, i) => g.drawImage(c, ...pos[i]));
    return cv.toDataURL();
};

// ---- IRONCLAD: top-down sheets (color + team mask + separate shadow) ----
import { IRONCLAD, IRONCLAD_PROPS, ironcladTurret } from './ironclad.js';
const IC_STYLE = { camo: [0.72, 0.7, 0.66, 0.5], camo2: [1.06, 0.9, 0.74, 0.4], dust: '#a58a62', dustAmt: 0.7, dustH: 3, grunge: 0.42, streaks: 0.3, chips: 0.9, seed: 21, film: 0.16 };
function icCell(job, dir) {
    const yaw = (dir / job.dirs) * Math.PI * 2;
    const kit = new Kit3D({ yaw, style: IC_STYLE, bevel: 0.35 });
    // models are authored facing +x: build, then turn the whole group
    if (job.model === 'turret') ironcladTurret(kit, job.barrel, job.boss);
    else (IRONCLAD[job.model] || IRONCLAD_PROPS[job.model])(kit);
    kit.group.rotation.z = yaw;
    kit.group.updateMatrixWorld(true);
    kit.group.traverse(o => { if (o.isMesh) { o.geometry.applyMatrix4(kit.group.matrixWorld); } });
    kit.group.rotation.z = 0; kit.group.updateMatrixWorld(true);
    for (const g of kit.glows) { const x = g.x * Math.cos(yaw) - g.y * Math.sin(yaw), y = g.x * Math.sin(yaw) + g.y * Math.cos(yaw); g.x = x; g.y = y; }
    const spec = { w: job.cell, h: job.cell, ax: job.cell / 2, ay: job.cell / 2, scale: job.scale };
    return { spec, out: renderSprite(kit, spec, { view: 'top', separateShadow: true, groundShadow: job.shadow !== false, shadowExtent: 60, outlineAlpha: 70, aoStrength: 0.85 }) };
}
window.bakeTop = async (job) => {
    const mk = () => { const c = document.createElement('canvas'); c.width = job.cell * OUT * job.dirs; c.height = job.cell * OUT; return c; };
    const color = mk(), mask = mk(), shadow = mk();
    for (let d = 0; d < job.dirs; d++) {
        const r = icCell(job, d);
        color.getContext('2d').drawImage(r.out.color, d * job.cell * OUT, 0);
        mask.getContext('2d').drawImage(r.out.mask, d * job.cell * OUT, 0);
        if (r.out.shadow) shadow.getContext('2d').drawImage(r.out.shadow, d * job.cell * OUT, 0);
    }
    return { color: color.toDataURL('image/png'), mask: mask.toDataURL('image/png'), shadow: job.shadow === false ? null : shadow.toDataURL('image/png') };
};
window.previewTop = async ({ jobs, zoom, dirs, team, bg }) => {
    const cells = [];
    for (const job of jobs) for (const d of dirs) {
        const r = icCell({ ...job, dirs: 16 }, d);
        const c = document.createElement('canvas'); c.width = r.out.color.width; c.height = r.out.color.height;
        const x = c.getContext('2d');
        if (r.out.shadow && job.shadow !== false) x.drawImage(r.out.shadow, 0, 0);
        x.drawImage(tintCell(r, job.tint || team), 0, 0);
        cells.push(c);
    }
    const Z = zoom / OUT, pad = 6, maxW = 1900;
    let x = pad, y = pad, rowH = 0; const pos = [];
    for (const c of cells) { const w = c.width * Z, h = c.height * Z; if (x + w + pad > maxW && x > pad) { x = pad; y += rowH + pad; rowH = 0; } pos.push([x, y, w, h]); x += w + pad; rowH = Math.max(rowH, h); }
    const cv = document.createElement('canvas');
    cv.width = Math.min(maxW, Math.max(...pos.map(p => p[0] + p[2])) + pad); cv.height = y + rowH + pad;
    const g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingQuality = 'high';
    cells.forEach((c, i) => g.drawImage(c, ...pos[i]));
    return cv.toDataURL();
};
