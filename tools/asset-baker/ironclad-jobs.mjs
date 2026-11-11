// IRONCLAD sprite sheets. cell = logical px per frame at the reference
// hull half-length `ref`; the game scales by size / ref.
const body = (model, extra = {}) => ({ name: model, model, ref: 20, scale: 2, cell: 76, dirs: 16, ...extra });
export const IRONCLAD_JOBS = [
    body('tank', { tint: '#3f93a8' }), body('buggy', { tint: '#d9822b' }), body('armoredCar', { tint: '#b5432c' }),
    body('dozer', { tint: '#8e2f24', cell: 84 }), body('mortar', { tint: '#9a7a3c' }), body('bike', { tint: '#e05a24' }),
    body('truck', { tint: '#6e7a3c' }), body('apc', { tint: '#7a5a3a' }), body('bomber', { tint: '#7d6a4a' }),
    body('heli', { tint: '#556048', cell: 96, shadow: false }),
    body('boss', { tint: '#7c1f18', ref: 40, scale: 4, cell: 140 }),
    { name: 'rack', model: 'rack', ref: 20, scale: 2, cell: 36, dirs: 16, tint: '#80402c' },
    { name: 'turret120', model: 'turret', barrel: 1.2, ref: 20, scale: 2, cell: 84, dirs: 16, tint: '#a64032' },
    { name: 'turret135', model: 'turret', barrel: 1.35, ref: 20, scale: 2, cell: 88, dirs: 16, tint: '#3f93a8' },
    { name: 'turret190', model: 'turret', barrel: 1.9, ref: 20, scale: 2, cell: 108, dirs: 16, tint: '#8a6a3a' },
    { name: 'turretBoss', model: 'turret', barrel: 1.4, boss: true, ref: 30, scale: 3, cell: 128, dirs: 16, tint: '#7c1f18' },
    { name: 'barrel', model: 'barrel', ref: 20, scale: 2, cell: 56, dirs: 1 },
    { name: 'crate', model: 'crate', ref: 20, scale: 2, cell: 72, dirs: 1 }
];
