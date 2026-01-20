// ============================================
// XFire - Game Constants and Types
// ============================================

// Game Settings
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_SIZE = 64;

// SVG Icon Helper - creates inline SVG data URLs for crisp icons
const SVG_ICONS = {
    // Units
    infantry: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-1 6v2H9v2h2v6h2v-6h2v-2h-2v-2h-2z"/><path d="M16 12l2-2v4l-2-2zM8 12l-2-2v4l2-2z"/></svg>`,
    lightTank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="12" width="16" height="6" rx="1"/><rect x="6" y="10" width="8" height="4" rx="1"/><rect x="12" y="11" width="8" height="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="18" r="2"/></svg>`,
    mediumTank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="7" rx="1"/><rect x="6" y="8" width="10" height="5" rx="2"/><rect x="14" y="9" width="8" height="2"/><circle cx="5" cy="18" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/></svg>`,
    heavyTank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="20" height="8" rx="1"/><rect x="5" y="6" width="12" height="6" rx="2"/><rect x="15" y="7" width="9" height="3" rx="1"/><circle cx="4" cy="18" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="20" cy="18" r="3"/><rect x="7" y="8" width="4" height="2" fill="#333"/></svg>`,
    harvester: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="8" width="16" height="10" rx="2"/><rect x="6" y="5" width="12" height="5" rx="1" fill="#fa0"/><path d="M3 14h2v4H3zM19 14h2v4h-2z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><rect x="8" y="10" width="8" height="3" fill="#333" opacity="0.3"/></svg>`,
    artillery: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="10" cy="16" rx="6" ry="4"/><rect x="8" y="6" width="4" height="10" transform="rotate(-30 10 11)"/><circle cx="10" cy="16" r="3"/><circle cx="6" cy="18" r="2"/><circle cx="14" cy="18" r="2"/></svg>`,
    flak: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="13" width="14" height="6" rx="1"/><circle cx="12" cy="11" r="4"/><rect x="10" y="3" width="1.5" height="8"/><rect x="12.5" y="3" width="1.5" height="8"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>`,
    scout: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="14" rx="8" ry="4"/><path d="M12 10c-3 0-6 1-6 4h12c0-3-3-4-6-4z"/><circle cx="12" cy="8" r="3"/><path d="M4 14l-2-4h2zM20 14l2-4h-2z" opacity="0.6"/></svg>`,
    rocket: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="2.5"/><rect x="10" y="8" width="4" height="8"/><rect x="14" y="10" width="6" height="3" rx="1"/><path d="M20 10l2-1v4l-2-1z" fill="#f44"/><rect x="9" y="16" width="2" height="4"/><rect x="13" y="16" width="2" height="4"/></svg>`
};

// Unit Types Definition
const UNIT_TYPES = {
    infantry: {
        name: 'Infantry',
        icon: SVG_ICONS.infantry,
        cost: 80,
        hp: 40,
        speed: 0.15,
        range: 40,
        damage: 10,
        attackSpeed: 600,
        sight: 100,
        size: 8,
        category: 'infantry'
    },
    lightTank: {
        name: 'Light Tank',
        icon: SVG_ICONS.lightTank,
        cost: 250,
        hp: 150,
        speed: 0.15,
        range: 50,
        damage: 20,
        attackSpeed: 800,
        sight: 120,
        size: 14,
        category: 'armor'
    },
    mediumTank: {
        name: 'Battle Tank',
        icon: SVG_ICONS.mediumTank,
        cost: 350,
        hp: 280,
        speed: 0.15,
        range: 60,
        damage: 35,
        attackSpeed: 1200,
        sight: 110,
        size: 16,
        category: 'armor'
    },
    heavyTank: {
        name: 'Heavy Tank',
        icon: SVG_ICONS.heavyTank,
        cost: 500,
        hp: 450,
        speed: 0.15,
        range: 65,
        damage: 55,
        attackSpeed: 1500,
        sight: 100,
        size: 18,
        category: 'armor'
    },
    harvester: {
        name: 'Harvester',
        icon: SVG_ICONS.harvester,
        cost: 450,
        hp: 150,
        speed: 0.15,
        range: 0,
        damage: 0,
        attackSpeed: 0,
        sight: 80,
        size: 18,
        capacity: 1000,
        category: 'armor'
    },
    artillery: {
        name: 'Artillery',
        icon: SVG_ICONS.artillery,
        cost: 500,
        hp: 120,
        speed: 0.15,
        range: 140,
        damage: 60,
        attackSpeed: 5000,
        sight: 200,
        size: 14,
        category: 'armor'
    },
    flak: {
        name: 'Flak Cannon',
        icon: SVG_ICONS.flak,
        cost: 300,
        hp: 100,
        speed: 0.15,
        range: 75,
        damage: 25,
        attackSpeed: 600,
        sight: 130,
        size: 12,
        category: 'armor'
    },
    scout: {
        name: 'Scout',
        icon: SVG_ICONS.scout,
        cost: 120,
        hp: 25,
        speed: 0.15,
        range: 50,
        damage: 8,
        attackSpeed: 400,
        sight: 180,
        size: 10,
        category: 'infantry'
    },
    rocket: {
        name: 'Rocket Soldier',
        icon: SVG_ICONS.rocket,
        cost: 200,
        hp: 70,
        speed: 0.15,
        range: 60,
        damage: 35,
        attackSpeed: 1000,
        sight: 110,
        size: 12,
        category: 'infantry'
    }
};

// SVG Building Icons
const SVG_BUILDING_ICONS = {
    hq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="10" width="18" height="12" rx="1"/><path d="M12 2l9 8H3l9-8z"/><rect x="6" y="14" width="3" height="4" fill="#88ccff"/><rect x="15" y="14" width="3" height="4" fill="#88ccff"/><rect x="10" y="16" width="4" height="6"/><circle cx="18" cy="6" r="2" fill="#ff0"/><line x1="18" y1="2" x2="18" y2="4" stroke="currentColor" stroke-width="1"/></svg>`,
    barracks: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="8" width="20" height="14" rx="1"/><path d="M2 8l10-6 10 6"/><rect x="5" y="12" width="2" height="3"/><rect x="9" y="12" width="2" height="3"/><rect x="13" y="12" width="2" height="3"/><rect x="17" y="12" width="2" height="3"/><rect x="8" y="17" width="8" height="5"/></svg>`,
    factory: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="10" width="20" height="12" rx="1"/><rect x="4" y="4" width="4" height="8"/><rect x="10" y="6" width="4" height="6"/><rect x="16" y="2" width="4" height="10"/><circle cx="18" cy="4" r="1.5" fill="#888"/><rect x="6" y="14" width="5" height="4"/><rect x="13" y="14" width="5" height="4"/></svg>`,
    derrick: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-6 10h12L12 2z"/><rect x="10" y="12" width="4" height="10"/><ellipse cx="12" cy="22" rx="6" ry="2"/><circle cx="12" cy="8" r="2" fill="#fa0"/><line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" stroke-width="1"/></svg>`,
    turret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="18" rx="8" ry="4"/><rect x="8" y="12" width="8" height="8" rx="2"/><circle cx="12" cy="10" r="5"/><rect x="2" y="9" width="10" height="3" rx="1"/><circle cx="12" cy="10" r="2"/></svg>`,
    rifleTurret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="18" rx="7" ry="3"/><rect x="9" y="13" width="6" height="6" rx="1"/><circle cx="12" cy="11" r="4"/><rect x="3" y="9.5" width="9" height="1.5"/><rect x="3" y="11.5" width="9" height="1.5"/><circle cx="12" cy="11" r="1.5" fill="#f44"/></svg>`,
    missileTurret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="19" rx="8" ry="3"/><rect x="7" y="12" width="10" height="8" rx="2"/><circle cx="12" cy="10" r="5"/><rect x="4" y="6" width="8" height="3" rx="1" transform="rotate(-20 8 7.5)"/><rect x="12" y="6" width="8" height="3" rx="1" transform="rotate(20 16 7.5)"/><circle cx="4" cy="5" r="1.5" fill="#f60"/><circle cx="20" cy="5" r="1.5" fill="#f60"/></svg>`,
    researchLab: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="10" width="18" height="12" rx="1"/><rect x="5" y="8" width="14" height="4"/><circle cx="8" cy="6" r="2" fill="#0f0"/><circle cx="12" cy="5" r="2" fill="#f0f"/><circle cx="16" cy="6" r="2" fill="#ff0"/><rect x="7" y="14" width="4" height="4" fill="#88ccff"/><rect x="13" y="14" width="4" height="4" fill="#88ccff"/></svg>`,
    powerplant: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="10" width="16" height="12" rx="1"/><rect x="6" y="6" width="5" height="6"/><rect x="13" y="4" width="5" height="8"/><path d="M11 14l2-4 2 4-2 4z" fill="#ff0"/><rect x="8" y="16" width="8" height="2" fill="#0f0"/></svg>`,
    academy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="12" width="16" height="10" rx="1"/><path d="M12 4l10 8H2l10-8z"/><rect x="6" y="8" width="2" height="6"/><rect x="16" y="8" width="2" height="6"/><rect x="9" y="15" width="6" height="7"/><circle cx="12" cy="10" r="2" fill="#88f"/></svg>`,
    techLab: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="10" width="18" height="12" rx="1"/><rect x="5" y="6" width="14" height="6" rx="1"/><circle cx="8" cy="9" r="2"/><circle cx="16" cy="9" r="2"/><path d="M8 9h8" stroke="#0ff" stroke-width="1"/><rect x="6" y="14" width="5" height="4"/><rect x="13" y="14" width="5" height="4"/><circle cx="12" cy="16" r="3" fill="#0ff" opacity="0.5"/></svg>`
};

// Building Types Definition
const BUILDING_TYPES = {
    hq: {
        name: 'HQ',
        icon: SVG_BUILDING_ICONS.hq,
        cost: 0,
        hp: 1000,
        size: 3,
        produces: [],
        sight: 130
    },
    barracks: {
        name: 'Barracks',
        icon: SVG_BUILDING_ICONS.barracks,
        cost: 400,
        hp: 400,
        size: 2,
        produces: ['infantry', 'scout', 'rocket'],
        sight: 100,
        powerUse: 10
    },
    factory: {
        name: 'Factory',
        icon: SVG_BUILDING_ICONS.factory,
        cost: 600,
        hp: 600,
        size: 3,
        produces: ['lightTank', 'mediumTank', 'heavyTank', 'harvester', 'artillery', 'flak'],
        sight: 100,
        powerUse: 20
    },
    derrick: {
        name: 'Derrick',
        icon: SVG_BUILDING_ICONS.derrick,
        cost: 200,
        hp: 200,
        size: 1,
        produces: [],
        generates: 10,
        sight: 100,
        powerUse: 5
    },
    turret: {
        name: 'Turret',
        icon: SVG_BUILDING_ICONS.turret,
        cost: 350,
        hp: 300,
        size: 1,
        produces: [],
        range: 125,
        damage: 20,
        attackSpeed: 800,
        sight: 200,
        powerUse: 8
    },
    rifleTurret: {
        name: 'Rifle Turret',
        icon: SVG_BUILDING_ICONS.rifleTurret,
        cost: 300,
        hp: 250,
        size: 1,
        produces: [],
        range: 140,
        damage: 35,
        attackSpeed: 600,
        sight: 220,
        versus: 'infantry',
        powerUse: 10
    },
    missileTurret: {
        name: 'Missile Turret',
        icon: SVG_BUILDING_ICONS.missileTurret,
        cost: 450,
        hp: 200,
        size: 1,
        produces: [],
        range: 160,
        damage: 50,
        attackSpeed: 1200,
        sight: 250,
        versus: 'armor',
        powerUse: 15
    },
    researchLab: {
        name: 'Research Lab',
        icon: SVG_BUILDING_ICONS.researchLab,
        cost: 500,
        hp: 350,
        size: 2,
        produces: [],
        sight: 150,
        researches: ['rifleTurret', 'missileTurret'],
        powerUse: 15
    },
    powerplant: {
        name: 'Power Plant',
        icon: SVG_BUILDING_ICONS.powerplant,
        cost: 300,
        hp: 250,
        size: 2,
        produces: [],
        powerGen: 50,
        sight: 100
    },
    academy: {
        name: 'Academy',
        icon: SVG_BUILDING_ICONS.academy,
        cost: 450,
        hp: 350,
        size: 2,
        produces: [],
        sight: 150,
        bonuses: { infantryDamage: 1.15, infantryHP: 1.1 }
    },
    techLab: {
        name: 'Tech Lab',
        icon: SVG_BUILDING_ICONS.techLab,
        cost: 550,
        hp: 400,
        size: 2,
        produces: [],
        sight: 150,
        bonuses: { vehicleDamage: 1.15, vehicleHP: 1.1 }
    }
};

// Enemy Building SVG Icons - Red-toned versions
const SVG_ENEMY_BUILDING_ICONS = {
    hq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="3" y="10" width="18" height="12" rx="1"/><path d="M12 2l9 8H3l9-8z"/><rect x="6" y="14" width="3" height="4" fill="#f88"/><rect x="15" y="14" width="3" height="4" fill="#f88"/><rect x="10" y="16" width="4" height="6"/></svg>`,
    barracks: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="2" y="8" width="20" height="14" rx="1"/><path d="M2 8l10-6 10 6"/><rect x="8" y="17" width="8" height="5"/></svg>`,
    factory: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="2" y="10" width="20" height="12" rx="1"/><rect x="4" y="4" width="4" height="8"/><rect x="16" y="2" width="4" height="10"/></svg>`,
    derrick: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><path d="M12 2l-6 10h12L12 2z"/><rect x="10" y="12" width="4" height="10"/><ellipse cx="12" cy="22" rx="6" ry="2"/></svg>`,
    turret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><ellipse cx="12" cy="18" rx="8" ry="4"/><circle cx="12" cy="10" r="5"/><rect x="2" y="9" width="10" height="3" rx="1"/></svg>`,
    rifleTurret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><ellipse cx="12" cy="18" rx="7" ry="3"/><circle cx="12" cy="11" r="4"/><rect x="3" y="10" width="9" height="2"/></svg>`,
    missileTurret: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><ellipse cx="12" cy="19" rx="8" ry="3"/><circle cx="12" cy="10" r="5"/><circle cx="6" cy="5" r="2" fill="#f60"/><circle cx="18" cy="5" r="2" fill="#f60"/></svg>`,
    researchLab: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="3" y="10" width="18" height="12" rx="1"/><rect x="5" y="8" width="14" height="4"/></svg>`,
    powerplant: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="4" y="10" width="16" height="12" rx="1"/><rect x="6" y="6" width="5" height="6"/><rect x="13" y="4" width="5" height="8"/><path d="M11 14l2-4 2 4-2 4z" fill="#f80"/></svg>`,
    academy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="4" y="12" width="16" height="10" rx="1"/><path d="M12 4l10 8H2l10-8z"/></svg>`,
    techLab: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#c44"><rect x="3" y="10" width="18" height="12" rx="1"/><rect x="5" y="6" width="14" height="6" rx="1"/></svg>`
};

// Legacy emoji icons (kept for backward compatibility if needed)
const ENEMY_BUILDING_ICONS = SVG_ENEMY_BUILDING_ICONS;

// Function to get building icon based on player
function getBuildingIcon(buildingType, isEnemy = false) {
    if (isEnemy && ENEMY_BUILDING_ICONS[buildingType]) {
        return ENEMY_BUILDING_ICONS[buildingType];
    }
    return BUILDING_TYPES[buildingType]?.icon || '□';
}

// Tech Tree Dependencies
const TECH_TREE = {
    barracks: { requires: [], unlocks: ['academy'] },
    factory: { requires: [], unlocks: ['techLab'] },
    academy: { requires: ['barracks'], unlocks: [] },
    techLab: { requires: ['factory'], unlocks: [] },
    researchLab: { requires: [], unlocks: ['rifleTurret', 'missileTurret'] },
    rifleTurret: { requires: ['researchLab'], unlocks: [] },
    missileTurret: { requires: ['researchLab'], unlocks: [] }
};

// Initialize Game State
function initializeGameState() {
    return {
        running: true,
        tick: 0,
        camera: { x: MAP_SIZE * TILE_WIDTH / 4, y: 0 },
        mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
        selection: [],
        selectionBox: null,
        placingBuilding: null,
        players: [
            {
                id: 0,
                color: '#4488ff',
                oil: 1200,
                power: 100,
                team: 'player',
                tech: { barracks: true, factory: false, academy: false, researchLab: false, rifleTurret: false, missileTurret: false }
            },
            {
                id: 1,
                color: '#ff4444',
                oil: 1200,
                power: 100,
                team: 'enemy',
                tech: { barracks: true, factory: false, academy: false, researchLab: false, rifleTurret: false, missileTurret: false }
            }
        ],
        units: [],
        buildings: [],
        projectiles: [],
        particles: [],
        map: [],
        fogOfWar: [],
        group1: [],
        group2: [],
        group3: [],
        group4: [],
        group5: []
    };
}
