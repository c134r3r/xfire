// ============================================
// XFire - Krossfire Skirmish
// Game Constants: Factions, Units, Buildings
// Inspired by KKnD2: Krossfire (1998)
// ============================================

// Isometric tile metrics
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const MAP_SIZE = 64;

// ============================================
// FACTIONS
// Three sides, KKnD2-style: human Survivors,
// mutant Evolved and the Series 9 robots.
// Unit/building roles are shared across factions
// (mirrored rosters like in KKnD) but each faction
// has its own names, looks and color palette.
// ============================================
const FACTIONS = {
    survivors: {
        name: 'Survivors',
        tagline: 'Steel, oil and gunpowder',
        color: '#4488ff',
        palette: {
            hull: '#6e7a4e',       // olive drab armor
            hullDark: '#49532f',
            hullLight: '#94a06c',
            metal: '#8d9097',
            metalDark: '#5a5d63',
            tread: '#33342e',
            accent: '#c8a23c',     // brass
            glow: '#ffd14a',
            skin: '#d8a878',
            cloth: '#5b6648',
            base: '#7c7f72',       // concrete pad
            baseDark: '#5d6055',
            roof: '#7d8a5a',
            window: '#9fd4ff'
        },
        unitNames: {
            trooper: 'Machine Gunner',
            flamer: 'Flamer',
            rocketeer: 'Bazooka Trooper',
            bike: 'Dirt Bike',
            buggy: 'ATV',
            tank: 'Anaconda Tank',
            heavy: 'Juggernaut',
            artillery: 'Barrage Craft',
            tanker: 'Oil Tanker'
        },
        buildingNames: {
            hq: 'Outpost',
            powerStation: 'Power Station',
            derrick: 'Oil Derrick',
            barracks: 'Barracks',
            factory: 'Machine Shop',
            researchLab: 'Research Lab',
            repairBay: 'Repair Bay',
            tower: 'Guard Tower',
            towerHeavy: 'Cannon Tower'
        }
    },
    evolved: {
        name: 'Evolved',
        tagline: 'Flesh, bone and mutant fury',
        color: '#cc3333',
        palette: {
            hull: '#9a5a38',       // hide / chitin
            hullDark: '#6b3a22',
            hullLight: '#c08355',
            metal: '#7a4a3a',
            metalDark: '#52301f',
            tread: '#46291a',
            accent: '#d8cfae',     // bone
            glow: '#7ddf64',       // toxic green
            skin: '#b98a64',
            cloth: '#7a3326',
            base: '#7a5d43',       // packed earth
            baseDark: '#5b432e',
            roof: '#8e5a36',
            window: '#7ddf64'
        },
        unitNames: {
            trooper: 'Berserker',
            flamer: 'Pyromaniac',
            rocketeer: 'Homing Bazookoid',
            bike: 'Dire Wolf',
            buggy: 'Giant Beetle',
            tank: 'Scorpion',
            heavy: 'War Mastodon',
            artillery: 'Missile Crab',
            tanker: 'Tanker Beetle'
        },
        buildingNames: {
            hq: 'Clan Hall',
            powerStation: 'Bio Refinery',
            derrick: 'Pump Beast',
            barracks: 'Breeding Den',
            factory: 'Beast Enclosure',
            researchLab: 'Alchemy Hall',
            repairBay: 'Healing Pools',
            tower: 'Spike Tower',
            towerHeavy: 'Acid Hurler'
        }
    },
    series9: {
        name: 'Series 9',
        tagline: 'Agricultural robots gone to war',
        color: '#33bb77',
        palette: {
            hull: '#5a6470',       // gunmetal
            hullDark: '#3a4149',
            hullLight: '#828d9a',
            metal: '#6f7a85',
            metalDark: '#454d56',
            tread: '#2c3036',
            accent: '#caa64b',
            glow: '#4dffa6',       // emerald energy
            skin: '#9aa4ae',
            cloth: '#3a4149',
            base: '#5e6670',       // alloy plate
            baseDark: '#454c54',
            roof: '#67737f',
            window: '#4dffa6'
        },
        unitNames: {
            trooper: 'Seeder',
            flamer: 'Weed Killer',
            rocketeer: 'Sterilizer',
            bike: 'Probe',
            buggy: 'Enforcer',
            tank: 'Sentinel',
            heavy: 'Annihilator',
            artillery: 'Tremor',
            tanker: 'Transporter'
        },
        buildingNames: {
            hq: 'Mainframe',
            powerStation: 'Fusion Plant',
            derrick: 'Auto Extractor',
            barracks: 'Droid Works',
            factory: 'Machine Forge',
            researchLab: 'Data Core',
            repairBay: 'Maintenance Dock',
            tower: 'Pulse Turret',
            towerHeavy: 'Plasma Tower'
        }
    }
};

const FACTION_KEYS = Object.keys(FACTIONS);

// ============================================
// UNIT ROLES (shared stats, faction-specific skins)
// tech: required tech level (researched at the lab)
// ============================================
const UNIT_TYPES = {
    trooper: {
        name: 'Trooper', tech: 1, cost: 100, hp: 55, speed: 0.10,
        range: 45, damage: 9, attackSpeed: 600, sight: 110, size: 9,
        category: 'infantry', buildTime: 90
    },
    flamer: {
        name: 'Flamer', tech: 2, cost: 190, hp: 75, speed: 0.09,
        range: 38, damage: 24, attackSpeed: 900, sight: 100, size: 10,
        category: 'infantry', versus: 'infantry', buildTime: 110
    },
    rocketeer: {
        name: 'Rocketeer', tech: 2, cost: 230, hp: 65, speed: 0.09,
        range: 72, damage: 32, attackSpeed: 1500, sight: 120, size: 10,
        category: 'infantry', versus: 'armor', buildTime: 130
    },
    bike: {
        name: 'Scout Bike', tech: 1, cost: 200, hp: 95, speed: 0.27,
        range: 45, damage: 10, attackSpeed: 480, sight: 190, size: 11,
        category: 'armor', buildTime: 90
    },
    buggy: {
        name: 'Light Vehicle', tech: 1, cost: 320, hp: 170, speed: 0.18,
        range: 55, damage: 16, attackSpeed: 650, sight: 140, size: 13,
        category: 'armor', buildTime: 130
    },
    tank: {
        name: 'Battle Tank', tech: 2, cost: 480, hp: 320, speed: 0.12,
        range: 65, damage: 40, attackSpeed: 1300, sight: 125, size: 15,
        category: 'armor', buildTime: 190
    },
    heavy: {
        name: 'Heavy Assault', tech: 3, cost: 800, hp: 560, speed: 0.075,
        range: 72, damage: 62, attackSpeed: 1600, sight: 115, size: 18,
        category: 'armor', buildTime: 270
    },
    artillery: {
        name: 'Artillery', tech: 3, cost: 640, hp: 150, speed: 0.07,
        range: 150, damage: 75, attackSpeed: 4500, sight: 175, size: 14,
        category: 'armor', buildTime: 230
    },
    tanker: {
        name: 'Tanker', tech: 1, cost: 350, hp: 260, speed: 0.14,
        range: 0, damage: 0, attackSpeed: 0, sight: 100, size: 16,
        capacity: 500, category: 'armor', buildTime: 150
    }
};

// ============================================
// BUILDING ROLES
// KKnD economy: derricks sit on oil patches and pump
// into local storage; tankers haul the oil to the
// power station where it is converted to funds.
// ============================================
const BUILDING_TYPES = {
    hq: {
        name: 'HQ', tech: 1, cost: 0, hp: 1600, size: 3, sight: 150,
        produces: []
    },
    powerStation: {
        name: 'Power Station', tech: 1, cost: 500, hp: 650, size: 3, sight: 110,
        produces: [], dropOff: true
    },
    derrick: {
        name: 'Derrick', tech: 1, cost: 300, hp: 380, size: 2, sight: 100,
        produces: [], needsOil: true, pumpRate: 25, storageMax: 1500
    },
    barracks: {
        name: 'Barracks', tech: 1, cost: 400, hp: 520, size: 2, sight: 110,
        produces: ['trooper', 'flamer', 'rocketeer']
    },
    factory: {
        name: 'Factory', tech: 1, cost: 700, hp: 750, size: 3, sight: 110,
        produces: ['bike', 'buggy', 'tanker', 'tank', 'artillery', 'heavy']
    },
    researchLab: {
        name: 'Research Lab', tech: 1, cost: 600, hp: 420, size: 2, sight: 110,
        produces: [], research: true
    },
    repairBay: {
        name: 'Repair Bay', tech: 2, cost: 500, hp: 480, size: 2, sight: 110,
        produces: [], repairRate: 18, repairRadius: 4.5
    },
    tower: {
        name: 'Tower', tech: 1, cost: 400, hp: 420, size: 1, sight: 200,
        produces: [], range: 120, damage: 18, attackSpeed: 650
    },
    towerHeavy: {
        name: 'Heavy Tower', tech: 2, cost: 680, hp: 520, size: 1, sight: 230,
        produces: [], range: 150, damage: 48, attackSpeed: 1400, versus: 'armor'
    }
};

// Sidebar build order and prerequisites (KKnD-ish tech chain)
const BUILD_ORDER = ['powerStation', 'derrick', 'barracks', 'factory', 'researchLab', 'repairBay', 'tower', 'towerHeavy'];

const BUILDING_REQUIRES = {
    powerStation: [],
    derrick: ['powerStation'],
    barracks: ['powerStation'],
    factory: ['barracks'],
    researchLab: ['factory'],
    repairBay: ['factory'],
    tower: ['barracks'],
    towerHeavy: ['researchLab']
};

// Tech level upgrades, researched at the Research Lab
const TECH_UPGRADES = {
    2: { cost: 700, time: 900, label: 'Tech Level 2', unlocks: 'Flamer, Rocketeer, Battle Tank, Repair Bay, Heavy Tower' },
    3: { cost: 1400, time: 1400, label: 'Tech Level 3', unlocks: 'Heavy Assault, Artillery' }
};
const MAX_TECH_LEVEL = 3;

// Veterancy (KKnD2-style experience): kills needed per rank,
// each rank adds a damage bonus.
const VETERANCY_KILLS = [3, 7, 14];
const VETERANCY_DAMAGE_BONUS = 0.15;

// ============================================
// Helpers
// ============================================
function getFaction(playerId) {
    const p = (typeof game !== 'undefined') ? game.players[playerId] : null;
    return (p && p.faction) || 'survivors';
}

function unitDisplayName(role, factionKey) {
    return FACTIONS[factionKey]?.unitNames[role] || UNIT_TYPES[role]?.name || role;
}

function buildingDisplayName(role, factionKey) {
    return FACTIONS[factionKey]?.buildingNames[role] || BUILDING_TYPES[role]?.name || role;
}

function veterancyRank(kills) {
    let rank = 0;
    for (const k of VETERANCY_KILLS) {
        if ((kills || 0) >= k) rank++;
    }
    return rank;
}
