// ============================================
// XFire - Game Constants and Types
// ============================================

// Game Settings
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_SIZE = 64;

// Unit Types Definition
const UNIT_TYPES = {
    infantry: {
        name: 'Infantry',
        icon: '&#9823;',
        cost: 80,
        hp: 40,
        speed: 0.15,
        range: 80,
        damage: 10,
        attackSpeed: 600,
        sight: 100,
        size: 8,
        category: 'infantry'
    },
    lightTank: {
        name: 'Light Tank',
        icon: '🏎️',
        cost: 250,
        hp: 150,
        speed: 0.15,
        range: 100,
        damage: 20,
        attackSpeed: 800,
        sight: 120,
        size: 14,
        category: 'armor'
    },
    mediumTank: {
        name: 'Battle Tank',
        icon: '🛻',
        cost: 350,
        hp: 280,
        speed: 0.15,
        range: 120,
        damage: 35,
        attackSpeed: 1200,
        sight: 110,
        size: 16,
        category: 'armor'
    },
    heavyTank: {
        name: 'Heavy Tank',
        icon: '⛽',
        cost: 500,
        hp: 450,
        speed: 0.15,
        range: 130,
        damage: 55,
        attackSpeed: 1500,
        sight: 100,
        size: 18,
        category: 'armor'
    },
    harvester: {
        name: 'Harvester',
        icon: '&#9819;',
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
        icon: '&#9814;',
        cost: 500,
        hp: 120,
        speed: 0.15,
        range: 280,
        damage: 60,
        attackSpeed: 2000,
        sight: 200,
        size: 14,
        category: 'armor'
    },
    flak: {
        name: 'Flak Cannon',
        icon: '⚔️',
        cost: 300,
        hp: 100,
        speed: 0.15,
        range: 150,
        damage: 25,
        attackSpeed: 600,
        sight: 130,
        size: 12,
        category: 'armor'
    },
    scout: {
        name: 'Scout',
        icon: '&#9816;',
        cost: 120,
        hp: 25,
        speed: 0.15,
        range: 100,
        damage: 8,
        attackSpeed: 400,
        sight: 180,
        size: 10,
        category: 'infantry'
    },
    rocket: {
        name: 'Rocket Soldier',
        icon: '&#9917;',
        cost: 200,
        hp: 70,
        speed: 0.15,
        range: 120,
        damage: 35,
        attackSpeed: 1000,
        sight: 110,
        size: 12,
        category: 'infantry'
    }
};

// Building Types Definition
const BUILDING_TYPES = {
    hq: {
        name: 'HQ',
        icon: '&#127984;',
        cost: 0,
        hp: 1000,
        size: 3,
        produces: [],
        sight: 130
    },
    barracks: {
        name: 'Barracks',
        icon: '&#127976;',
        cost: 400,
        hp: 400,
        size: 2,
        produces: ['infantry', 'scout', 'rocket'],
        sight: 100,
        powerUse: 10
    },
    factory: {
        name: 'Factory',
        icon: '&#127981;',
        cost: 600,
        hp: 600,
        size: 3,
        produces: ['lightTank', 'mediumTank', 'heavyTank', 'harvester', 'artillery', 'flak'],
        sight: 100,
        powerUse: 20
    },
    derrick: {
        name: 'Derrick',
        icon: '&#9981;',
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
        icon: '&#9876;',
        cost: 350,
        hp: 300,
        size: 1,
        produces: [],
        range: 250,
        damage: 20,
        attackSpeed: 800,
        sight: 200,
        powerUse: 8
    },
    rifleTurret: {
        name: 'Rifle Turret',
        icon: '🎯',
        cost: 300,
        hp: 250,
        size: 1,
        produces: [],
        range: 280,
        damage: 35,
        attackSpeed: 600,
        sight: 220,
        versus: 'infantry',
        powerUse: 10
    },
    missileTurret: {
        name: 'Missile Turret',
        icon: '🚀',
        cost: 450,
        hp: 200,
        size: 1,
        produces: [],
        range: 320,
        damage: 50,
        attackSpeed: 1200,
        sight: 250,
        versus: 'armor',
        powerUse: 15
    },
    researchLab: {
        name: 'Research Lab',
        icon: '🔬',
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
        icon: '&#9889;',
        cost: 300,
        hp: 250,
        size: 2,
        produces: [],
        powerGen: 50,
        sight: 100
    },
    academy: {
        name: 'Academy',
        icon: '&#127891;',
        cost: 450,
        hp: 350,
        size: 2,
        produces: [],
        sight: 150,
        bonuses: { infantryDamage: 1.15, infantryHP: 1.1 }
    },
    techLab: {
        name: 'Tech Lab',
        icon: '&#128300;',
        cost: 550,
        hp: 400,
        size: 2,
        produces: [],
        sight: 150,
        bonuses: { vehicleDamage: 1.15, vehicleHP: 1.1 }
    }
};

// Enemy Building Icons - Red-toned alternatives for visual distinction
const ENEMY_BUILDING_ICONS = {
    hq: '🏰',
    barracks: '🔴',
    factory: '🏗️',
    derrick: '🛢️',
    turret: '🔴',
    rifleTurret: '🔴',
    missileTurret: '🎯',
    researchLab: '💣',
    powerplant: '🔥',
    academy: '📚',
    techLab: '⚙️'
};

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
