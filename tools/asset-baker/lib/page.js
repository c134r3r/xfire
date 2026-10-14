// Bake page: exposes window.bake(job) to the node driver.
import { Kit3D, TEAM } from './kit.js';
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
        const kit = new Kit3D({ pulse: frame === 1 ? 1.3 : 1 });
        BUILDING_BUILDERS[role](kit, ft, pal, faction, frame, TEAM);
        return { spec, out: renderSprite(kit, spec, { shadowExtent: ft * 50 + 40 }) };
    }
    const yaw = (dir / DIRS) * Math.PI * 2;
    const kit = new Kit3D();
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
