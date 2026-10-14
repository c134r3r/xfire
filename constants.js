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
            hull: '#61684a',       // olive drab armor, sun-faded not pastel
            hullDark: '#3d422c',
            hullLight: '#848c62',
            metal: '#7e8187',
            metalDark: '#4c4f54',
            tread: '#2f302a',
            accent: '#c8a23c',     // brass
            glow: '#ffd14a',
            skin: '#d8a878',
            cloth: '#525c42',
            base: '#6d6f64',       // weathered concrete pad
            baseDark: '#4e5047',
            roof: '#666f4c',
            window: '#7fb9dd'
        },
        unitNames: {
            trooper: 'Machine Gunner',
            flamer: 'Flamer',
            rocketeer: 'Bazooka Trooper',
            bike: 'Dirt Bike',
            buggy: 'ATV',
            tank: 'Anaconda Tank',
            heavy: 'Juggernaut',
            artillery: 'Barrage Craft'
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
            artillery: 'Missile Crab'
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
            artillery: 'Tremor'
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
        name: 'Trooper', tech: 1, cost: 100, hp: 60, speed: 0.018,
        range: 68, damage: 9, attackSpeed: 600, sight: 140, size: 9,
        category: 'infantry', buildTime: 240
    },
    flamer: {
        // short-ranged but brutal against infantry (splash)
        name: 'Flamer', tech: 2, cost: 190, hp: 80, speed: 0.016,
        range: 44, damage: 18, attackSpeed: 700, sight: 120, size: 10,
        category: 'infantry', splash: 0.9, buildTime: 300
    },
    rocketeer: {
        // slow projectile cadence, long reach, melts armor
        name: 'Rocketeer', tech: 2, cost: 230, hp: 65, speed: 0.016,
        range: 100, damage: 30, attackSpeed: 1800, sight: 150, size: 10,
        category: 'infantry', buildTime: 330
    },
    bike: {
        // fastest unit in the game: scouting and harassment
        name: 'Scout Bike', tech: 1, cost: 200, hp: 100, speed: 0.05,
        range: 56, damage: 9, attackSpeed: 450, sight: 210, size: 11,
        category: 'armor', buildTime: 300
    },
    buggy: {
        name: 'Light Vehicle', tech: 1, cost: 320, hp: 180, speed: 0.036,
        range: 76, damage: 15, attackSpeed: 600, sight: 160, size: 13,
        category: 'armor', buildTime: 420
    },
    tank: {
        name: 'Battle Tank', tech: 2, cost: 480, hp: 340, speed: 0.026,
        range: 104, damage: 42, attackSpeed: 1400, sight: 160, size: 15,
        category: 'armor', turret: true, crushes: true, buildTime: 600
    },
    heavy: {
        // slow siege brawler; lobs shells over rock walls
        name: 'Heavy Assault', tech: 3, cost: 800, hp: 600, speed: 0.017,
        range: 116, damage: 65, attackSpeed: 1700, sight: 160, size: 18,
        category: 'armor', splash: 0.9, overWalls: true, turret: true, crushes: true, buildTime: 900
    },
    artillery: {
        // siege weapon: huge range (needs spotters), fragile, fires over rock walls
        name: 'Artillery', tech: 3, cost: 640, hp: 150, speed: 0.015,
        range: 200, damage: 80, attackSpeed: 5000, sight: 190, size: 14,
        category: 'armor', splash: 1.6, overWalls: true, crushes: true, buildTime: 780
    }
};

// ============================================
// BUILDING ROLES
// Economy: derricks sit on oil patches and pump
// funds directly; power stations refine the crude
// and boost the output of every derrick.
// ============================================
const BUILDING_TYPES = {
    hq: {
        name: 'HQ', tech: 1, cost: 0, hp: 2200, size: 3, sight: 150,
        produces: []
    },
    powerStation: {
        // refines crude on-site: each one boosts all derrick output
        name: 'Power Station', tech: 1, cost: 500, hp: 650, size: 3, sight: 110,
        produces: [], incomeBoost: 0.25, maxBoostCount: 2
    },
    derrick: {
        // must sit on an oil patch; pumps funds directly until the patch runs dry
        name: 'Derrick', tech: 1, cost: 300, hp: 380, size: 2, sight: 100,
        produces: [], needsOil: true, pumpRate: 14
    },
    barracks: {
        name: 'Barracks', tech: 1, cost: 400, hp: 520, size: 2, sight: 110,
        produces: ['trooper', 'flamer', 'rocketeer']
    },
    factory: {
        name: 'Factory', tech: 1, cost: 700, hp: 750, size: 3, sight: 110,
        produces: ['bike', 'buggy', 'tank', 'artillery', 'heavy']
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
        // rapid anti-infantry fire, decent reach
        name: 'Tower', tech: 1, cost: 400, hp: 420, size: 1, sight: 200,
        produces: [], range: 140, damage: 16, attackSpeed: 550
    },
    towerHeavy: {
        // anti-armor cannon, outranges battle tanks
        name: 'Heavy Tower', tech: 2, cost: 680, hp: 520, size: 1, sight: 230,
        produces: [], range: 168, damage: 48, attackSpeed: 1400, splash: 0.8
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

// Population cap (units per side). Keeps battles readable and the
// frame rate stable; the AI's cap scales with difficulty.
const UNIT_CAP = 70;
const AI_UNIT_CAP = { easy: 30, normal: 45, hard: 65 };

function unitCapFor(playerId) {
    if (playerId === 1 && typeof gameSettings !== 'undefined') return AI_UNIT_CAP[gameSettings.difficulty] || 45;
    return UNIT_CAP;
}

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

// ============================================
// TECH BUNKERS (KKnD signature): neutral bunkers
// scattered across the wasteland. First side to
// reach one claims a random reward.
// ============================================
const BUNKER_REWARDS = [
    { kind: 'oil', weight: 0.40 },          // salvaged oil cache
    { kind: 'units', weight: 0.35 },        // stranded reinforcements
    { kind: 'veterancy', weight: 0.25 }     // combat data: nearby units rank up
];

// Weapon class per role: drives projectile visuals and firing sounds.
// mg = ballistic tracer, flame = fire stream, rocket = missile,
// cannon = shell, arty = arcing siege shell.
const WEAPON_CLASS = {
    trooper: 'mg', tower: 'mg',
    bike: 'hmg', buggy: 'hmg',
    flamer: 'flame',
    rocketeer: 'rocket',
    tank: 'cannon', heavy: 'cannon', towerHeavy: 'cannon',
    artillery: 'arty'
};

// Damage multiplier per weapon class against each armor class
// (infantry / armor = vehicles / building). This is the rock-paper-
// scissors of the game: rifles shred infantry but plink off armor,
// rockets and cannons crack vehicles, artillery levels bases.
const WEAPON_VS = {
    mg:     { infantry: 1.0, armor: 0.4,  building: 0.3 },
    hmg:    { infantry: 1.0, armor: 0.7,  building: 0.45 },
    flame:  { infantry: 1.5, armor: 0.45, building: 0.8 },
    rocket: { infantry: 0.5, armor: 1.5,  building: 1.0 },
    cannon: { infantry: 0.6, armor: 1.2,  building: 0.85 },
    arty:   { infantry: 1.0, armor: 0.9,  building: 1.4 }
};

// Ballistics per weapon class: projectile speed (tiles/s) and base
// chance to hit a unit (buildings are always hit; artillery has no
// hit roll - its shells land where the target WAS, so moving units
// can dodge them).
const WEAPON_BALLISTICS = {
    mg:     { speed: 24, accuracy: 0.85, vsInfantry: 0.85 },
    hmg:    { speed: 24, accuracy: 0.85, vsInfantry: 0.85 },
    flame:  { speed: 10, accuracy: 1.0,  vsInfantry: 1.0 },
    rocket: { speed: 10, accuracy: 0.92, vsInfantry: 0.65 },
    cannon: { speed: 17, accuracy: 0.92, vsInfantry: 0.7 },
    arty:   { speed: 0,  accuracy: 1.0,  vsInfantry: 1.0 }
};

function armorClass(entity) {
    const ut = UNIT_TYPES[entity.type];
    if (ut) return ut.category === 'infantry' ? 'infantry' : 'armor';
    return 'building';
}

function weaponMultiplier(weapon, entity) {
    const row = WEAPON_VS[weapon] || WEAPON_VS.mg;
    return row[armorClass(entity)] ?? 1;
}

// ============================================
// TOOLTIP DESCRIPTIONS (what is it for?)
// ============================================
const BUILDING_DESC = {
    hq: 'Your command center. Lose it and all your buildings, and the battle is over.',
    powerStation: 'Refines crude oil: each one boosts the income of EVERY derrick by +25% (max 2 count). You start with one.',
    derrick: 'Your income source. MUST be placed on a dark oil patch! Pumps funds automatically until the patch runs dry.',
    barracks: 'Trains infantry: cheap riflemen, anti-infantry flamers and anti-tank rocketeers.',
    factory: 'Builds vehicles: scout bikes, tanks and artillery - the backbone of your army.',
    researchLab: 'Researches Tech Level 2 and 3, unlocking advanced units, the Repair Bay and heavy towers.',
    repairBay: 'Automatically repairs your vehicles parked nearby (costs a little oil per tick).',
    tower: 'Rapid-fire defense turret. Shreds infantry, weak against armor.',
    towerHeavy: 'Heavy anti-armor cannon tower. Outranges battle tanks - the wall against vehicle pushes.'
};

const UNIT_DESC = {
    trooper: 'Cheap rifle infantry. Shreds infantry, nearly useless against vehicles and buildings.',
    flamer: 'Very short range, burns groups of infantry with splash. Weak against vehicles.',
    rocketeer: 'Anti-tank infantry with long reach but slow rockets. Escort them.',
    bike: 'Fastest unit in the game: scouting, grabbing tech bunkers, harassment.',
    buggy: 'Fast heavy-MG vehicle. Good raider and escort, decent against everything light.',
    tank: 'Main battle tank - strong vs vehicles and buildings, runs infantry over.',
    heavy: 'Slow assault monster with splash damage that fires OVER rock walls. Breaks bases.',
    artillery: 'Extreme-range siege gun that fires OVER rock walls. Needs other units to spot targets. Moving units can dodge its shells.'
};
