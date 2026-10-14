// Detect Mac (used for modifier-key handling)
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

// ============================================
// XFIRE - Krossfire Skirmish RTS Game Engine
// ============================================

let canvas, ctx, minimapCanvas, minimapCtx;

// Sound system: see sfx.js (SoundManager, VoiceManager)
// Initialize sound system
SoundManager.init();
// Cap the backing-store resolution on touch devices: phone DPRs of 3-4
// quadruple the pixel load for no visible gain at RTS zoom levels.
const dpr = window.matchMedia('(pointer: coarse)').matches
    ? Math.min(window.devicePixelRatio || 1, 2)
    : (window.devicePixelRatio || 1);

// Resize canvas to match actual display size
function resizeCanvas() {
    if (!canvas || !ctx) return;

    // Get actual rendered size
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 800;
    const height = rect.height || canvas.clientHeight || 500;

    // Set canvas internal dimensions for high DPI
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.scale(dpr, dpr);

    // Enable image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    console.log(`Canvas resized to ${width}x${height} (${canvas.width}x${canvas.height} internal)`);
}

// Initialize canvas when DOM is ready
function initializeCanvases() {
    canvas = document.getElementById('canvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return false;
    }

    ctx = canvas.getContext('2d', { alpha: false, antialias: true });
    if (!ctx) {
        console.error('Could not get 2D context!');
        return false;
    }

    // Canvas will be properly sized when game starts (when visible)

    minimapCanvas = document.getElementById('minimap');
    if (!minimapCanvas) {
        console.error('Minimap canvas element not found!');
        return false;
    }

    minimapCtx = minimapCanvas.getContext('2d');
    if (!minimapCtx) {
        console.error('Could not get minimap 2D context!');
        return false;
    }

    return true;
}

// Game Settings
const gameSettings = {
    timeLimit: 'unlimited',
    difficulty: 'normal',
    mapSize: 'medium',
    startingOil: 5000,
    tutorial: true,
    playerFaction: 'survivors',
    enemyFaction: 'random',
    MAP_SIZE: MAP_SIZE,
    zoom: 1.0,
    minZoom: 0.5,
    maxZoom: 2.2,
    wheelZoom: true
};

// Helper function to get current map size (use this instead of MAP_SIZE constant)
function getMapSize() {
    return gameSettings.MAP_SIZE || MAP_SIZE;
}

// Helper function to get current zoom level
function getZoom() {
    return gameSettings.zoom || 1.0;
}

// Audio initialization flag (required by modern browsers)
let audioUnlocked = false;

// Game State (Constants imported from constants.js)
const game = {
    running: true,
    paused: false,
    status: 'MENU', // MENU, PLAYING, PAUSED, WON, LOST
    tick: 0,
    timeElapsed: 0,
    camera: { x: 0, y: (MAP_SIZE / 2) * TILE_HEIGHT },
    mouse: { x: 0, y: 0, worldX: 0, worldY: 0 },
    selection: [],
    selectionBox: null,
    placingBuilding: null,
    placingBuildingFrom: null,
    attackMoveMode: false,
    players: [
        {
            id: 0,
            color: '#4488ff',
            faction: 'survivors',
            oil: 5000,
            techLevel: 1,
            team: 'player'
        },
        {
            id: 1,
            color: '#ff4444',
            faction: 'evolved',
            oil: 5000,
            techLevel: 1,
            team: 'enemy'
        },
        {
            id: 2,
            color: '#cfae3a',
            faction: 'evolved',
            oil: 0,
            techLevel: 1,
            team: 'neutral'
        }
    ],
    units: [],
    buildings: [],
    projectiles: [],
    particles: [],
    damageNumbers: [],
    map: [],
    fogOfWar: [],
    group1: [], group2: [], group3: [], group4: [], group5: [],
    stats: { unitsBuilt: 0, unitsLost: 0, unitsKilled: 0, buildingsRazed: 0, oilEarned: 0, bunkersClaimed: 0 }
};

// Game constants imported from constants.js:
// - TILE_WIDTH, TILE_HEIGHT, MAP_SIZE
// - UNIT_TYPES, BUILDING_TYPES, TECH_TREE

// ============================================
// MAP GENERATION
// ============================================

function generateMap() {
    game.map = [];
    game.fogOfWar = [];
    game.oilTiles = [];
    const mapSize = getMapSize();

    // Initialize with grass
    for (let y = 0; y < mapSize; y++) {
        game.map[y] = [];
        game.fogOfWar[y] = [];
        for (let x = 0; x < mapSize; x++) {
            game.map[y][x] = {
                type: 'grass',
                height: 0,
                oil: false
            };
            game.fogOfWar[y][x] = game.players[0].team === 'player' ? 0 : 2;
        }
    }

    // Scale terrain features based on map size
    const sizeMultiplier = mapSize / 64;

    // Add hill areas (15% of map = mostly grass)
    const hillCount = Math.floor((2 + Math.floor(Math.random() * 2)) * sizeMultiplier);
    for (let h = 0; h < hillCount; h++) {
        const centerX = 10 + Math.floor(Math.random() * (mapSize - 20));
        const centerY = 10 + Math.floor(Math.random() * (mapSize - 20));
        const hillSize = 1 + Math.floor(Math.random() * 2);

        for (let y = centerY - hillSize; y <= centerY + hillSize; y++) {
            for (let x = centerX - hillSize; x <= centerX + hillSize; x++) {
                if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) continue;
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (dist <= hillSize) {
                    const tile = game.map[y][x];
                    // Only add hills to grass
                    if (tile.type === 'grass') {
                        tile.type = 'hill';
                        tile.height = 2;
                    }
                }
            }
        }
    }

    // Add small rivers/lakes (a few small water features, not large seas)
    const waterCount = Math.floor((2 + Math.floor(Math.random() * 2)) * sizeMultiplier);
    for (let w = 0; w < waterCount; w++) {
        const centerX = 10 + Math.floor(Math.random() * (mapSize - 20));
        const centerY = 10 + Math.floor(Math.random() * (mapSize - 20));
        const waterSize = 1 + Math.floor(Math.random() * 2); // Small lakes/rivers

        for (let y = centerY - waterSize; y <= centerY + waterSize; y++) {
            for (let x = centerX - waterSize; x <= centerX + waterSize; x++) {
                if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) continue;
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (dist <= waterSize) {
                    const tile = game.map[y][x];
                    // Only add water to grass
                    if (tile.type === 'grass') {
                        tile.type = 'water';
                        tile.height = -1;
                    }
                }
            }
        }
    }

    // Rock-wall ridges: long impassable lines that block shots and
    // funnel armies through chokepoints
    const ridgeCount = Math.floor((2 + Math.floor(Math.random() * 2)) * sizeMultiplier);
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < ridgeCount; r++) {
        let x = 8 + Math.floor(Math.random() * (mapSize - 16));
        let y = 8 + Math.floor(Math.random() * (mapSize - 16));
        let [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        const len = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < len; i++) {
            if (x < 2 || x >= mapSize - 2 || y < 2 || y >= mapSize - 2) break;
            const tile = game.map[y][x];
            if (tile.type === 'grass' && !tile.oil) {
                tile.type = 'hill';
                tile.height = 2;
                tile.wall = true;
            }
            // occasional kink so ridges don't look ruler-straight
            if (Math.random() < 0.2) {
                [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
            }
            x += dx;
            y += dy;
        }
    }

    // Add oil fields - plenty of small clusters, scaled with map size
    const fieldCount = Math.floor((9 + Math.floor(Math.random() * 4)) * sizeMultiplier);
    for (let i = 0; i < fieldCount; i++) {
        const x = 6 + Math.floor(Math.random() * (mapSize - 12));
        const y = 6 + Math.floor(Math.random() * (mapSize - 12));
        placeOilField(x, y, 1 + Math.floor(Math.random() * 2));
    }
}

// Place a cluster of oil patches around (x, y)
function placeOilField(x, y, extra = 1) {
    const mapSize = getMapSize();
    const spots = [[0, 0]];
    const offsets = [[2, 1], [-1, 2], [2, -2], [-2, -1]];
    for (let i = 0; i < extra; i++) spots.push(offsets[i % offsets.length]);
    for (const [dx, dy] of spots) {
        const px = x + dx, py = y + dy;
        if (px < 2 || px >= mapSize - 2 || py < 2 || py >= mapSize - 2) continue;
        const tile = game.map[py][px];
        if (tile.type === 'grass' && !tile.oil) {
            tile.oil = true;
            tile.oilAmount = 25000 + Math.floor(Math.random() * 25000);
            game.oilTiles.push({ x: px, y: py });
        }
    }
}

// ============================================
// TERRAIN VALIDATION HELPERS
// ============================================

/**
 * Check if a tile is passable (not water or hill)
 */
function isTilePassable(x, y) {
    const mapSize = getMapSize();
    if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) return false;
    const tile = game.map[Math.floor(y)]?.[Math.floor(x)];
    if (!tile) return false;
    // building footprints count as impassable, otherwise spawn/rescue
    // spots can land units inside a structure
    return tile.type === 'grass' && !isTileBlocked(x, y);
}

/**
 * Find a valid spawn position near the given coordinates
 * Searches in expanding circles until a passable tile is found
 */
function findValidSpawnPosition(targetX, targetY, maxRadius = 10) {
    // First check if target is already valid
    if (isTilePassable(targetX, targetY)) {
        return { x: targetX, y: targetY };
    }

    // Search in expanding circles
    for (let radius = 1; radius <= maxRadius; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                // Only check the outer ring of the current radius
                if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                const newX = targetX + dx;
                const newY = targetY + dy;

                if (isTilePassable(newX, newY)) {
                    return { x: newX, y: newY };
                }
            }
        }
    }

    // Fallback: return original position (shouldn't happen with proper map generation)
    return { x: targetX, y: targetY };
}

/**
 * Ensure a spawn area is clear of impassable terrain
 * Used for base placement to guarantee buildable area
 */
function ensurePassableArea(centerX, centerY, radius = 5) {
    const mapSize = getMapSize();
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                const tile = game.map[y][x];
                if (tile.type === 'water' || tile.type === 'hill') {
                    tile.type = 'grass';
                    tile.height = 0;
                }
            }
        }
    }
}

// ============================================
// COORDINATE CONVERSION (Isometric)
// ============================================

function worldToScreen(x, y) {
    const zoom = getZoom();
    const isoX = (x - y) * (TILE_WIDTH / 2) * zoom;
    const isoY = (x + y) * (TILE_HEIGHT / 2) * zoom;
    return {
        x: isoX - game.camera.x * zoom + canvas.offsetWidth / 2,
        y: isoY - game.camera.y * zoom + canvas.offsetHeight / 2
    };
}

function screenToWorld(sx, sy) {
    const zoom = getZoom();
    const x = (sx - canvas.offsetWidth / 2) / zoom + game.camera.x;
    const y = (sy - canvas.offsetHeight / 2) / zoom + game.camera.y;
    const worldX = (x / (TILE_WIDTH / 2) + y / (TILE_HEIGHT / 2)) / 2;
    const worldY = (y / (TILE_HEIGHT / 2) - x / (TILE_WIDTH / 2)) / 2;
    return { x: worldX, y: worldY };
}

function tileToWorld(tx, ty) {
    return { x: tx, y: ty };
}

// ============================================
// RENDERING
// ============================================

// ============================================
// TERRAIN CACHE
// The whole map is rendered once into an offscreen
// canvas (at zoom 1) and blitted each frame. Only
// oil-patch bubbles are animated on top.
// ============================================
let dustMotes = [];
let fogCanvas = null;

// Fog-of-war visibility (player perspective).
// 0 = never seen (full shroud), 1 = explored but not in sight, 2 = visible.
function tileFog(tx, ty) {
    const row = game.fogOfWar[Math.floor(ty)];
    return row ? (row[Math.floor(tx)] ?? 0) : 0;
}
function isVisible(tx, ty) { return tileFog(tx, ty) === 2; }

// Bake the current fog state into a tiny canvas (one pixel per tile).
// Rebuilt whenever updateFogOfWar runs; blitted with an affine transform.
function updateFogCanvas() {
    const mapSize = getMapSize();
    // one pixel per tile plus an opaque one-pixel border, so smoothing
    // never lets the terrain edge bleed through the shroud
    const N = mapSize + 2;
    if (!fogCanvas || fogCanvas.width !== N) {
        fogCanvas = document.createElement('canvas');
        fogCanvas.width = N;
        fogCanvas.height = N;
    }
    const fctx = fogCanvas.getContext('2d');
    const img = fctx.createImageData(N, N);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    for (let y = 0; y < mapSize; y++) {
        const row = game.fogOfWar[y];
        for (let x = 0; x < mapSize; x++) {
            const fog = row ? (row[x] ?? 0) : 0;
            img.data[((y + 1) * N + x + 1) * 4 + 3] = fog === 2 ? 0 : (fog === 1 ? 150 : 255);
        }
    }
    fctx.putImageData(img, 0, 0);
}

// One smoothed drawImage covers the whole shroud: pixel (tx+1, ty+1)
// maps onto tile [tx, tx+1) x [ty, ty+1) under the iso transform.
function drawFog() {
    if (!fogCanvas) return;
    const zoom = getZoom();
    const mapSize = getMapSize();
    const o = worldToScreen(0, 0);
    const a = (TILE_WIDTH / 2) * zoom;
    const b = (TILE_HEIGHT / 2) * zoom;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.transform(a, b, -a, b, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCanvas, -1, -1, mapSize + 2, mapSize + 2);
    ctx.restore();
}
// (the former #vignette overlay was removed - it read as a gray film
// over the battlefield)

// Faint dust motes drifting across the wasteland


// ============================================
// UNIT COLLISION
// Soft-body separation via a per-tile spatial hash,
// plus a push-out from building footprints, so units
// stop stacking on one spot or driving through bases.
// ============================================

function unitRadius(type) {
    return type.size / 34; // tiles (infantry ~0.26, heavy ~0.53)
}

function resolveUnitCollisions() {
    const units = game.units;
    if (units.length < 2) return;

    // spatial hash: bucket units per tile (and stamp an index so each
    // pair is resolved exactly once)
    const grid = new Map();
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        u._ci = i;
        const key = (u.x | 0) * 4096 + (u.y | 0);
        let cell = grid.get(key);
        if (!cell) grid.set(key, cell = []);
        cell.push(u);
    }

    // Busy units (moving/fighting) shove idle ones aside instead of both
    // stalling; heavier hulls shove lighter ones.
    const mass = (u, t) => t.size * (u._moving || u.targetX !== undefined ? 1 : 0.45);
    const nudge = (u, dx, dy) => {
        const nx = u.x + dx, ny = u.y + dy;
        if (isWalkable(nx, ny)) { u.x = nx; u.y = ny; }
        else if (isWalkable(nx, u.y)) u.x = nx;
        else if (isWalkable(u.x, ny)) u.y = ny;
    };

    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const ut = UNIT_TYPES[u.type];
        if (!ut) continue;
        const ru = unitRadius(ut);
        const cx = u.x | 0, cy = u.y | 0;
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
                const cell = grid.get(gx * 4096 + gy);
                if (!cell) continue;
                for (const v of cell) {
                    if (v._ci <= i) continue;
                    const vt = UNIT_TYPES[v.type];
                    if (!vt) continue;
                    const minD = ru + unitRadius(vt);
                    let dx = v.x - u.x, dy = v.y - u.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 >= minD * minD) continue;

                    // Tracked vehicles grind enemy infantry under their
                    // treads: a moving crusher closes in, and once the
                    // soldier is under the hull he's gone
                    if (u.playerId !== v.playerId) {
                        let crusher = null, victim = null;
                        if (ut.crushes && vt.category === 'infantry') { crusher = u; victim = v; }
                        else if (vt.crushes && ut.category === 'infantry') { crusher = v; victim = u; }
                        if (victim && victim.hp > 0 && crusher._moving) {
                            if (d2 < minD * minD * 0.45) {
                                victim.hp = 0;
                                victim.crushed = true;
                                victim.crushAngle = crusher.angle || 0;
                                crusher.kills = (crusher.kills || 0) + 1;
                                if (crusher.playerId === 0) game.stats.unitsKilled++;
                            }
                            continue;
                        }
                    }
                    let d = Math.sqrt(d2);
                    if (d < 0.001) {
                        const a = Math.random() * Math.PI * 2;
                        dx = Math.cos(a); dy = Math.sin(a); d = 1;
                    }
                    const push = Math.min(0.08, (minD - d) * 0.5);
                    const nx = dx / d, ny = dy / d;
                    const mu = mass(u, ut), mv = mass(v, vt);
                    const shareU = mv / (mu + mv), shareV = mu / (mu + mv);
                    nudge(u, -nx * push * shareU * 2, -ny * push * shareU * 2);
                    nudge(v, nx * push * shareV * 2, ny * push * shareV * 2);
                }
            }
        }
    }
}

// ============================================
// BATTLEFIELD DECALS (wrecks, splats, scorch)
// Persist for a while after fights, then fade.
// ============================================

function addDecal(decal) {
    if (!game.decals) game.decals = [];
    decal.maxLife = decal.life;
    game.decals.push(decal);
    if (game.decals.length > 110) game.decals.shift();
}


// Short death animation before the wreck/splat decal takes over:
// vehicles flash white and sink, infantry topples over.
function updateDying(dt) {
    if (!game.dying) return;
    for (let i = game.dying.length - 1; i >= 0; i--) {
        const d = game.dying[i];
        d.t += dt;
        const duration = d.infantry ? 0.55 : 0.5;
        if (d.t >= duration) {
            if (d.infantry) {
                addDecal({
                    type: 'splat', x: d.x, y: d.y, life: 25,
                    color: d.faction === 'series9' ? 'rgba(30,34,40,0.7)' : 'rgba(84,22,16,0.65)',
                    drops: Array.from({ length: 3 }, () => [
                        (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 9, 1.5 + Math.random() * 2])
                });
            } else {
                addDecal({
                    type: 'wreck', x: d.x, y: d.y, life: 40,
                    role: d.role, faction: d.faction, dir: d.dir
                });
            }
            game.dying.splice(i, 1);
        }
    }
}


function updateDecals(dt) {
    if (!game.decals) return;
    for (let i = game.decals.length - 1; i >= 0; i--) {
        game.decals[i].life -= dt;
        if (game.decals[i].life <= 0) game.decals.splice(i, 1);
    }
}

// ============================================
// GUIDED START: objective chain with map arrows
// ============================================

function initObjectives() {
    if (!gameSettings.tutorial) {
        game.objectives = [];
        return;
    }
    const f = game.players[0].faction;
    game.objectives = [
        {
            text: `Build an ${buildingDisplayName('derrick', f)} ON A DARK OIL PATCH (sidebar, ${BUILDING_TYPES.derrick.cost} oil)`,
            guide: 'oil',
            check: () => game.buildings.some(b => b.playerId === 0 && b.type === 'derrick')
        },
        {
            text: `Build a ${buildingDisplayName('barracks', f)} to train infantry`,
            check: () => game.buildings.some(b => b.playerId === 0 && b.type === 'barracks')
        },
        {
            text: `Build a ${buildingDisplayName('factory', f)} for vehicles`,
            check: () => game.buildings.some(b => b.playerId === 0 && b.type === 'factory')
        },
        {
            text: 'Train an army (8+ units) - click your production buildings',
            check: () => game.units.filter(u => u.playerId === 0).length >= 8
        },
        {
            text: `Build a ${buildingDisplayName('researchLab', f)} and research Tech Level 2`,
            check: () => game.players[0].techLevel >= 2
        },
        {
            text: 'Send a unit to a glowing TECH BUNKER for a reward',
            guide: 'bunker',
            check: () => !game.bunkers || game.bunkers.every(b => b.claimed) ||
                         game.bunkers.some(b => b.claimed && b.claimedBy === 0)
        },
        {
            text: 'Destroy the enemy base! (A = attack-move)',
            check: () => false
        }
    ];
}

function currentObjective() {
    return (game.objectives || []).find(o => !o.done) || null;
}

function updateObjectives() {
    const obj = currentObjective();
    if (!obj) return;
    if (obj.check()) {
        obj.done = true;
        game.objectiveFlash = { text: obj.text, until: Date.now() + 3000 };
        SoundManager.play('research_complete', { volume: 0.7 });
    }
}

// Objective panel (top-left) + completed flash

// Bouncing golden arrow above a world position; clamps to the
// screen edge and points toward the target when it is off-screen

// Where should the guide arrows point for the active objective?
function drawObjectiveGuides() {
    const obj = currentObjective();
    if (!obj || !obj.guide) return;
    const hq = game.buildings.find(b => b.playerId === 0 && b.type === 'hq');
    if (!hq) return;

    if (obj.guide === 'oil') {
        // two nearest live, unoccupied oil patches
        const spots = (game.oilTiles || [])
            .filter(t => {
                const tile = game.map[t.y]?.[t.x];
                if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) return false;
                return !game.buildings.some(b => b.type === 'derrick' && Math.abs(b.x - t.x) < 2 && Math.abs(b.y - t.y) < 2);
            })
            .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))
            .slice(0, 2);
        for (const t of spots) drawGuideArrow(t.x + 0.5, t.y + 0.5);
    } else if (obj.guide === 'bunker') {
        const bunker = (game.bunkers || [])
            .filter(b => !b.claimed)
            .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
        if (bunker) drawGuideArrow(bunker.x, bunker.y);
    }
}

// Compact formation grid around a destination: each unit in a group
// order gets its own slot instead of everyone crowding one point.
function formationOffsets(n, spacing = 1.05) {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const offs = [];
    for (let i = 0; i < n; i++) {
        const c = i % cols, r = (i / cols) | 0;
        offs.push({
            x: (c - (cols - 1) / 2) * spacing,
            y: (r - (rows - 1) / 2) * spacing
        });
    }
    return offs;
}

// Generic minimap pings (bunker claims, raids, dried-up patches)
function addPing(x, y, color) {
    if (!game.pings) game.pings = [];
    game.pings.push({ x, y, color, time: Date.now() });
    if (game.pings.length > 8) game.pings.shift();
}

// Full controls reference, toggled with F1



// Neutral tech bunkers (drawn between terrain and entities)

// Pulsing rings confirming move (green) and attack (red) orders



// Pseudo-random based on coordinates (consistent per tile)
function tileRandom(tx, ty, seed = 0) {
    const n = Math.sin(tx * 12.9898 + ty * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}

// Bilinear-interpolated value noise: smooth tonal patches across the map
function smoothNoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const s = (a, b) => tileRandom(a, b, 42);
    const top = s(x0, y0) + (s(x0 + 1, y0) - s(x0, y0)) * sx;
    const bot = s(x0, y0 + 1) + (s(x0 + 1, y0 + 1) - s(x0, y0 + 1)) * sx;
    return top + (bot - top) * sy;
}

// Buildings render smaller than their footprint so bases stay readable
// (scaling about the sprite anchor keeps them planted on their tile).


// Hostile units get a red-shifted copy of their sprite so friend and foe
// read at a glance even when both sides field the same faction. Cached -
// the tint is baked once per sprite, not per frame.




// ============================================
// MINIMAP (isometric: same orientation as the main view)
// ============================================
const MM = { pad: 6, layer: null, lastFogTick: -1 };

function mmScale() {
    return (minimapCanvas.width - 2 * MM.pad) / (2 * getMapSize());
}
function worldToMinimap(x, y) {
    const s = mmScale();
    return { x: minimapCanvas.width / 2 + (x - y) * s, y: MM.pad + (x + y) * s / 2 };
}
function minimapToWorld(px, py) {
    const s = mmScale();
    const a = (px - minimapCanvas.width / 2) / s;       // x - y
    const b = (py - MM.pad) * 2 / s;                    // x + y
    return { x: (a + b) / 2, y: (b - a) / 2 };
}

const MM_COLORS = {
    grass: [146, 122, 84], water: [52, 92, 104], hill: [96, 78, 58], oil: [26, 24, 18], oilDry: [70, 62, 48]
};

// Terrain + fog layer, re-rendered per pixel whenever the fog changes
function renderMinimapLayer() {
    const W = minimapCanvas.width, H = minimapCanvas.height;
    if (!MM.layer || MM.layer.width !== W || MM.layer.height !== H) {
        MM.layer = document.createElement('canvas');
        MM.layer.width = W; MM.layer.height = H;
    }
    const lctx = MM.layer.getContext('2d');
    const img = lctx.createImageData(W, H);
    const d = img.data;
    const ms = getMapSize();
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const w = minimapToWorld(px + 0.5, py + 0.5);
            if (w.x < 0 || w.y < 0 || w.x >= ms || w.y >= ms) continue;
            const tx = w.x | 0, ty = w.y | 0;
            const fog = game.fogOfWar[ty]?.[tx] ?? 0;
            const i = (py * W + px) * 4;
            if (fog === 0) { d[i] = 14; d[i + 1] = 13; d[i + 2] = 12; d[i + 3] = 255; continue; }
            const tile = game.map[ty][tx];
            let c = MM_COLORS[tile.type] || MM_COLORS.grass;
            if (tile.oil) c = (tile.oilAmount !== undefined && tile.oilAmount <= 0) ? MM_COLORS.oilDry : MM_COLORS.oil;
            const shade = (fog === 1 ? 0.5 : 1) * (0.92 + tileRandom(tx, ty, 3) * 0.12);
            d[i] = c[0] * shade; d[i + 1] = c[1] * shade; d[i + 2] = c[2] * shade; d[i + 3] = 255;
        }
    }
    lctx.putImageData(img, 0, 0);
}

function renderMinimap() {
    if (!minimapCtx || !game.map.length) return;
    const W = minimapCanvas.width, H = minimapCanvas.height;
    if (MM.lastFogTick !== game._fogTick || !MM.layer) {
        MM.lastFogTick = game._fogTick;
        renderMinimapLayer();
    }
    const m = minimapCtx;
    m.fillStyle = '#07080a';
    m.fillRect(0, 0, W, H);
    m.drawImage(MM.layer, 0, 0);

    // map border
    const ms = getMapSize();
    const c0 = worldToMinimap(0, 0), c1 = worldToMinimap(ms, 0), c2 = worldToMinimap(ms, ms), c3 = worldToMinimap(0, ms);
    m.strokeStyle = 'rgba(255,200,120,0.25)';
    m.lineWidth = 1;
    m.beginPath();
    m.moveTo(c0.x, c0.y); m.lineTo(c1.x, c1.y); m.lineTo(c2.x, c2.y); m.lineTo(c3.x, c3.y); m.closePath();
    m.stroke();

    const dot = (x, y, r, color, outline) => {
        const p = worldToMinimap(x, y);
        m.fillStyle = color;
        m.fillRect(p.x - r, p.y - r * 0.75, r * 2, r * 1.5);
        if (outline) { m.strokeStyle = outline; m.lineWidth = 1; m.strokeRect(p.x - r - 0.5, p.y - r * 0.75 - 0.5, r * 2 + 1, r * 1.5 + 1); }
    };

    // Buildings (own always; hostiles once seen and while in sight)
    for (const b of game.buildings) {
        if (b.playerId !== 0 && !isVisible(b.x, b.y)) continue;
        const r = 1.5 + BUILDING_TYPES[b.type].size;
        dot(b.x, b.y, r, teamColor(b.playerId), 'rgba(0,0,0,0.7)');
    }
    // Units
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    for (const u of game.units) {
        if (u.playerId !== 0 && !isVisible(u.x, u.y)) continue;
        const selected = game.selection.includes(u);
        dot(u.x, u.y, 1.6, selected && blink ? '#ffffff' : teamColor(u.playerId));
    }
    // Unclaimed tech bunkers
    if (game.bunkers) {
        for (const b of game.bunkers) {
            if (b.claimed || tileFog(b.x, b.y) === 0) continue;
            dot(b.x, b.y, 2.2, '#66e0ff', '#003040');
        }
    }

    // Event pings
    const ring = (x, y, color, age, maxR) => {
        const p = worldToMinimap(x, y);
        const pulse = (age * 2) % 1;
        m.strokeStyle = color;
        m.globalAlpha = 1 - pulse;
        m.lineWidth = 1.5;
        m.beginPath();
        m.ellipse(p.x, p.y, 3 + pulse * maxR, (3 + pulse * maxR) * 0.6, 0, 0, Math.PI * 2);
        m.stroke();
        m.globalAlpha = 1;
    };
    if (game.pings) {
        for (const p of game.pings) {
            const age = (Date.now() - p.time) / 1000;
            if (age <= 4) ring(p.x, p.y, p.color, age, 8);
        }
    }
    if (game.lastAttackAlert && Date.now() - game.lastAttackAlert.time < 4000) {
        ring(game.lastAttackAlert.x, game.lastAttackAlert.y, '#ff3c28', (Date.now() - game.lastAttackAlert.time) / 1000, 10);
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 180));
        m.strokeStyle = `rgba(255,50,40,${pulse})`;
        m.lineWidth = 2;
        m.strokeRect(1, 1, W - 2, H - 2);
    }

    // Camera viewport: the screen rectangle projected onto the map
    const corners = [[0, 0], [canvas.offsetWidth, 0], [canvas.offsetWidth, canvas.offsetHeight], [0, canvas.offsetHeight]]
        .map(([x, y]) => { const w = screenToWorld(x, y); return worldToMinimap(w.x, w.y); });
    m.strokeStyle = 'rgba(255,255,255,0.9)';
    m.lineWidth = 1.2;
    m.beginPath();
    corners.forEach((p, i) => i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y));
    m.closePath();
    m.stroke();
}

function teamColor(playerId) {
    return playerId === 0 ? '#3fa9ff' : playerId === 1 ? '#ff3b30' : '#e8c440';
}

// ============================================
// GAME LOGIC
// ============================================

function update(dt) {
    game.tick++;

    updateUnits(dt);
    resolveUnitCollisions();
    updateBuildings(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateDamageNumbers(dt);
    updateAI();
    // Recompute line-of-sight a few times per second
    if (game.tick % 10 === 0) {
        updateFogOfWar();
        updateFogCanvas();
        game._fogTick = game.tick;
    }
    updateResources();
    updateBunkers();
    updateScavengers();
    updateUI();
    updateObjectives();
    updateDecals(dt);
    updateDying(dt);
    updateRemnantsPing();
    updateLowFundsHint();

    // Battle heat decays; the music engine crossfades its layers
    game.combatHeat = Math.max(0, (game.combatHeat || 0) - dt * 0.08);
    if (typeof MusicEngine !== 'undefined' && game.tick % 30 === 0) {
        MusicEngine.setHeat(game.combatHeat);
    }

    // Fade out order feedback markers
    if (game.orderMarkers) {
        for (let i = game.orderMarkers.length - 1; i >= 0; i--) {
            game.orderMarkers[i].life -= dt * 1.6;
            if (game.orderMarkers[i].life <= 0) game.orderMarkers.splice(i, 1);
        }
    }
}

// ============================================
// NAVIGATION
// Tile walkability, A* over an 8-connected grid (binary heap, typed
// arrays, no corner cutting), nearest-reachable fallback when the goal
// itself is blocked, and string-pulled paths so units drive straight
// lines instead of tile zig-zags.
// ============================================

const PATH_CLEARANCE = 0.22;   // keep unit centers this far off obstacles when smoothing
const PATH_BUDGET_PER_TICK = 16;

function isWalkable(x, y) {
    const ms = getMapSize();
    if (x < 0 || y < 0 || x >= ms || y >= ms) return false;
    const tx = x | 0, ty = y | 0;
    const t = game.map[ty]?.[tx];
    if (!t || t.type === 'water' || t.type === 'hill') return false;
    return !(game.blockGrid && game.blockGrid[ty * ms + tx] > 0);
}

function isTileWalkable(tx, ty) {
    return isWalkable(tx + 0.5, ty + 0.5);
}

// Straight segment walkable, optionally with clearance r to both sides
function lineWalkable(x0, y0, x1, y1, r = 0) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return isWalkable(x1, y1);
    const steps = Math.max(1, Math.ceil(len / 0.2));
    const px = -dy / len * r, py = dx / len * r;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + dx * t, y = y0 + dy * t;
        if (!isWalkable(x, y)) return false;
        if (r > 0 && (!isWalkable(x + px, y + py) || !isWalkable(x - px, y - py))) return false;
    }
    return true;
}

// Closest walkable point to (x, y); with (fromX, fromY) given, ties
// are broken toward that side (attackers stop on THEIR side of a
// building instead of walking around it).
function nearestWalkable(x, y, maxR = 8, fromX, fromY) {
    if (isWalkable(x, y)) return { x, y };
    const cx = Math.floor(x), cy = Math.floor(y);
    let best = null, bestD = Infinity;
    for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const tx = cx + dx, ty = cy + dy;
                if (!isTileWalkable(tx, ty)) continue;
                let d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
                if (fromX !== undefined) d += 0.3 * Math.hypot(tx + 0.5 - fromX, ty + 0.5 - fromY);
                if (d < bestD) { bestD = d; best = { x: tx + 0.5, y: ty + 0.5 }; }
            }
        }
        if (best) return best;
    }
    return null;
}

const Nav = { n: 0, g: null, parent: null, stamp: null, closed: null, id: 0 };
const NAV_DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
                  [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

function navEnsure(n) {
    if (Nav.n === n) return;
    Nav.n = n;
    Nav.g = new Float32Array(n);
    Nav.parent = new Int32Array(n);
    Nav.stamp = new Uint32Array(n);
    Nav.closed = new Uint32Array(n);
    Nav.id = 0;
}

// Returns a smoothed list of waypoints [{x, y}] ending at the goal (or
// at the closest reachable point to it), [] if already there, or null
// when there is nowhere to go at all.
function findPath(startX, startY, endX, endY, clearance = PATH_CLEARANCE) {
    const ms = getMapSize();
    if (!game.map || game.map.length === 0) return null;
    const goal = nearestWalkable(
        Math.max(0, Math.min(ms - 0.01, endX)), Math.max(0, Math.min(ms - 0.01, endY)),
        10, startX, startY);
    if (!goal) return null;

    const sx = Math.max(0, Math.min(ms - 1, startX | 0));
    const sy = Math.max(0, Math.min(ms - 1, startY | 0));
    const gx = goal.x | 0, gy = goal.y | 0;
    if (sx === gx && sy === gy) return [{ x: goal.x, y: goal.y }];
    if (lineWalkable(startX, startY, goal.x, goal.y, clearance)) return [{ x: goal.x, y: goal.y }];

    navEnsure(ms * ms);
    const id = ++Nav.id;
    const { g, parent, stamp, closed } = Nav;
    const start = sy * ms + sx, target = gy * ms + gx;
    const h = (x, y) => {
        const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
        return dx + dy - 0.5858 * Math.min(dx, dy);
    };

    // binary min-heap of [f, node]
    const heapF = [], heapN = [];
    const push = (f, node) => {
        let i = heapF.length;
        heapF.push(f); heapN.push(node);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heapF[p] <= f) break;
            heapF[i] = heapF[p]; heapN[i] = heapN[p];
            i = p;
        }
        heapF[i] = f; heapN[i] = node;
    };
    const pop = () => {
        const top = heapN[0];
        const lf = heapF.pop(), ln = heapN.pop();
        const len = heapF.length;
        if (len > 0) {
            let i = 0;
            while (true) {
                let c = 2 * i + 1;
                if (c >= len) break;
                if (c + 1 < len && heapF[c + 1] < heapF[c]) c++;
                if (heapF[c] >= lf) break;
                heapF[i] = heapF[c]; heapN[i] = heapN[c];
                i = c;
            }
            heapF[i] = lf; heapN[i] = ln;
        }
        return top;
    };

    g[start] = 0; stamp[start] = id; parent[start] = -1;
    push(h(sx, sy), start);
    let bestNode = start, bestH = h(sx, sy);
    let found = false, expansions = 0;
    const maxExpansions = ms * ms;

    while (heapF.length > 0 && expansions < maxExpansions) {
        const cur = pop();
        if (closed[cur] === id) continue;
        closed[cur] = id;
        expansions++;
        if (cur === target) { found = true; break; }
        const cx = cur % ms, cy = (cur / ms) | 0;
        const hc = h(cx, cy);
        if (hc < bestH) { bestH = hc; bestNode = cur; }
        for (const [dx, dy, cost] of NAV_DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= ms || ny >= ms) continue;
            const ni = ny * ms + nx;
            if (closed[ni] === id) continue;
            if (!isTileWalkable(nx, ny)) continue;
            if (dx !== 0 && dy !== 0 && (!isTileWalkable(cx + dx, cy) || !isTileWalkable(cx, cy + dy))) continue;
            const ng = g[cur] + cost;
            if (stamp[ni] !== id || ng < g[ni]) {
                stamp[ni] = id;
                g[ni] = ng;
                parent[ni] = cur;
                push(ng + h(nx, ny), ni);
            }
        }
    }

    const end = found ? target : bestNode;
    if (end === start) return null;
    const pts = [];
    for (let n = end; n !== start && n !== -1; n = parent[n]) {
        pts.push({ x: (n % ms) + 0.5, y: ((n / ms) | 0) + 0.5 });
    }
    pts.reverse();
    if (found) pts[pts.length - 1] = { x: goal.x, y: goal.y };
    return smoothPath(startX, startY, pts, clearance);
}

// Greedy string pulling: from each anchor jump to the furthest
// waypoint (within a window) that is reachable in a straight line.
function smoothPath(sx, sy, pts, r) {
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
        let j = Math.min(pts.length - 1, i + 14);
        while (j > i && !lineWalkable(ax, ay, pts[j].x, pts[j].y, r)) j--;
        out.push(pts[j]);
        ax = pts[j].x; ay = pts[j].y;
        i = j + 1;
    }
    return out;
}

// ============================================
// UNIT MOVEMENT
// ============================================

// Hull turn rate in radians per tick: infantry pivot on the spot,
// heavy armor swings round slowly.
function turnRate(type) {
    if (type.category === 'infantry') return 0.3;
    if (type.size <= 11) return 0.2;
    if (type.size <= 13) return 0.15;
    if (type.size <= 15) return 0.1;
    return 0.075;
}

// Move up to `sp` tiles toward (tx, ty). Slides along walls when the
// direct step is blocked instead of freezing on contact.
function stepToward(unit, tx, ty, sp) {
    const dx = tx - unit.x, dy = ty - unit.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return 0;
    const s = Math.min(sp, d);
    const mx = dx / d * s, my = dy / d * s;
    if (isWalkable(unit.x + mx, unit.y + my)) { unit.x += mx; unit.y += my; return s; }
    if (Math.abs(mx) > s * 0.2 && isWalkable(unit.x + mx, unit.y)) { unit.x += mx; return Math.abs(mx); }
    if (Math.abs(my) > s * 0.2 && isWalkable(unit.x, unit.y + my)) { unit.y += my; return Math.abs(my); }
    return 0;
}

// Follow the unit's planned path. Returns 'arrived', 'moving' or 'blocked'.
function followPath(unit, type, speed) {
    const path = unit.path;
    while (path.length > 1 && Math.hypot(path[0].x - unit.x, path[0].y - unit.y) < 0.4) path.shift();
    const wp = path[0];
    const d = Math.hypot(wp.x - unit.x, wp.y - unit.y);
    if (path.length === 1 && d <= Math.max(0.1, speed)) {
        if (isWalkable(wp.x, wp.y)) { unit.x = wp.x; unit.y = wp.y; }
        path.shift();
        return 'arrived';
    }
    const desired = Math.atan2(wp.y - unit.y, wp.x - unit.x);
    unit.angle = rotateToward(unit.angle || 0, desired, turnRate(type));
    let sp = speed;
    if (type.category !== 'infantry') {
        // vehicles slow down to swing their hull round
        const off = angleDiff(unit.angle, desired);
        if (off > 1.2) sp *= 0.25;
        else if (off > 0.5) sp *= 0.65;
    }
    const moved = stepToward(unit, wp.x, wp.y, sp);
    unit._moving = moved > 0;
    return moved > 0 || sp < speed ? 'moving' : 'blocked';
}

// Plan (when needed, within the per-tick pathfinding budget) and drive
// toward (gx, gy). Returns 'arrived', 'moving', 'blocked', 'waiting'
// or 'unreachable'.
function navigate(unit, type, gx, gy, speed, minReplanTicks = 0) {
    const goalMoved = !unit._navGoal ||
        Math.hypot(unit._navGoal.x - gx, unit._navGoal.y - gy) > 0.75;
    const needPlan = !unit.path ||
        (goalMoved && game.tick - (unit._planTick ?? -9999) >= minReplanTicks);
    if (needPlan && game._pathBudget > 0) {
        game._pathBudget--;
        unit._planTick = game.tick;
        unit._navGoal = { x: gx, y: gy };
        unit.path = findPath(unit.x, unit.y, gx, gy);
        if (!unit.path) { unit.path = []; return 'unreachable'; }
    }
    if (!unit.path) return 'waiting';
    if (unit.path.length === 0) return 'arrived';
    return followPath(unit, type, speed);
}

// Central order helper: everything that sends a unit somewhere goes
// through here so the planner state is always reset consistently.
function issueMove(unit, x, y, attackMove = false) {
    unit.targetX = x;
    unit.targetY = y;
    unit.attackMove = attackMove;
    unit.attackTarget = null;
    unit.path = null;
    unit._navGoal = null;
    unit._prog = null;
    unit.closeTarget = null;
    unit._defend = null;
    unit._repairing = null;
    unit._hunt = false;
    unit._opp = null;
    if (!attackMove) { unit.resumeX = undefined; unit.resumeY = undefined; }
}

function issueAttack(unit, target) {
    unit.attackTarget = target;
    unit.targetX = undefined;
    unit.targetY = undefined;
    unit.attackMove = false;
    unit.resumeX = undefined;
    unit.resumeY = undefined;
    unit.path = null;
    unit._navGoal = null;
    unit._leash = null;
    unit._defend = null;
    unit._repairing = null;
    unit._hunt = false;
    unit._opp = null;
    unit._chaseFails = 0;
    unit._explicitTarget = true;
}

function stopUnit(unit) {
    unit.targetX = undefined;
    unit.targetY = undefined;
    unit.attackTarget = null;
    unit.path = null;
    unit._navGoal = null;
    unit.closeTarget = null;
    unit.attackMove = false;
    unit.resumeX = undefined;
    unit.resumeY = undefined;
    unit._leash = null;
    unit._defend = null;
    unit._repairing = null;
    unit._hunt = false;
    unit._opp = null;
}

// ============================================
// TARGETING
// ============================================

function isAlive(e) {
    return !!e && !e.dead && e.hp > 0;
}

// Collision/footprint radius of anything that can be targeted
function targetRadius(e) {
    const ut = UNIT_TYPES[e.type];
    if (ut) return unitRadius(ut);
    const bt = BUILDING_TYPES[e.type];
    return bt ? bt.size * 0.5 : 0.3;
}

// Distance from a shooter's center to the target's hull/footprint edge:
// big buildings can be hit from their walls, not just their center.
function edgeDistance(a, t) {
    return Math.max(0, Math.hypot(t.x - a.x, t.y - a.y) - targetRadius(t));
}

// Rock walls block direct fire. Samples right next to the shooter and
// the target are skipped so a unit hugging a cliff can still shoot
// past it.
function hasLineOfFire(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.9) return true;
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const along = t * len;
        if (along < 0.45 || len - along < 0.45) continue;
        const tile = game.map[(y1 + dy * t) | 0]?.[(x1 + dx * t) | 0];
        if (tile && tile.type === 'hill') return false;
    }
    return true;
}

// Legacy signature: -1 = clear, otherwise "blocked"
function checkLineOfSight(x1, y1, x2, y2) {
    return hasLineOfFire(x1, y1, x2, y2) ? -1 : 0.5;
}

// Pick the most sensible enemy within `radius` tiles: prefers targets
// already in weapon range, threats over harmless things, and targets
// the weapon is effective against.
function findTarget(src, srcType, radius, unitsOnly = false) {
    const pid = src.playerId;
    const weapon = WEAPON_CLASS[src.type] || 'mg';
    const range = rangeT(srcType);
    let best = null, bestScore = Infinity;
    for (const e of game.units) {
        if (e.playerId === pid || e.hp <= 0) continue;
        if (Math.abs(e.x - src.x) > radius + 1 || Math.abs(e.y - src.y) > radius + 1) continue;
        const d = edgeDistance(src, e);
        if (d > radius) continue;
        const et = UNIT_TYPES[e.type];
        let score = d;
        if (!et || et.damage <= 0) score += 3;
        score -= (weaponMultiplier(weapon, e) - 1) * 2.5;
        if (d <= range) score -= 2;
        if (score >= bestScore) continue;
        if (!srcType.overWalls && !hasLineOfFire(src.x, src.y, e.x, e.y)) continue;
        best = e; bestScore = score;
    }
    if (unitsOnly) return best;
    for (const b of game.buildings) {
        if (b.playerId === pid || b.hp <= 0 || b.isUnderConstruction && b.playerId === 2) continue;
        if (Math.abs(b.x - src.x) > radius + 3 || Math.abs(b.y - src.y) > radius + 3) continue;
        const d = edgeDistance(src, b);
        if (d > radius) continue;
        const bt = BUILDING_TYPES[b.type];
        let score = d + (bt.damage ? 1.5 : 4.5);
        score -= (weaponMultiplier(weapon, b) - 1) * 2;
        if (score >= bestScore) continue;
        if (!srcType.overWalls && !hasLineOfFire(src.x, src.y, b.x, b.y)) continue;
        best = b; bestScore = score;
    }
    return best;
}

// A unit got shot: idle units fire back, and idle squad mates close by
// join in. Units on an explicit move order keep moving (classic RTS:
// a retreat order must stay a retreat).
function onUnitDamaged(victim, attacker) {
    if (!attacker || !isAlive(attacker) || !isAlive(victim)) return;
    if (attacker.playerId === victim.playerId) return;
    const vt = UNIT_TYPES[victim.type];
    if (!vt) return;
    const respond = (u) => {
        const t = UNIT_TYPES[u.type];
        if (!t || t.damage <= 0 || u._repairing) return;
        if (u.attackTarget && isAlive(u.attackTarget)) return;
        if (u.targetX !== undefined && !u.attackMove) return;
        if (u.attackMove) {
            u.resumeX = u.targetX; u.resumeY = u.targetY;
            u.attackTarget = attacker;
        } else if (!autoEngage(u, attacker, 10)) {
            return; // shooter out of reach of the tower zone: hold
        }
        u.targetX = undefined;
        u.targetY = undefined;
        u.path = null;
    };
    victim._hurtTick = game.tick;
    respond(victim);
    if (game.tick - (victim._helpTick || -999) < 30) return;
    victim._helpTick = game.tick;
    for (const u of game.units) {
        if (u === victim || u.playerId !== victim.playerId) continue;
        if (Math.abs(u.x - victim.x) > 5 || Math.abs(u.y - victim.y) > 5) continue;
        respond(u);
    }
}

function updateUnits(dt) {
    game._pathBudget = PATH_BUDGET_PER_TICK;
    for (let i = game.units.length - 1; i >= 0; i--) {
        const unit = game.units[i];
        const type = UNIT_TYPES[unit.type];
        unit._moving = false;

        // Death check: hand the unit over to the dying animation
        if (unit.hp <= 0) {
            killUnit(unit, type);
            game.units.splice(i, 1);
            continue;
        }

        const speed = type.speed * dt * 60;

        // Turret tracking: swing toward the target, else settle forward
        if (type.turret) {
            let tgt = unit.attackTarget;
            if (isAlive(unit._opp) && isAlive(tgt) && edgeDistance(unit, tgt) > rangeT(type)) tgt = unit._opp;
            const desired = isAlive(tgt)
                ? Math.atan2(tgt.y - unit.y, tgt.x - unit.x)
                : unit.angle || 0;
            unit.turretAngle = rotateToward(unit.turretAngle ?? unit.angle ?? 0, desired, 0.09);
        }

        if (unit.attackTarget) {
            updateUnitAttack(unit, type, speed);
        } else if (unit.targetX !== undefined && unit.targetY !== undefined) {
            updateUnitMove(unit, type, speed, i);
        } else {
            unit.path = null;
        }

        // Keep in bounds; rescue units that ended up inside an obstacle
        const mapSize = getMapSize();
        unit.x = Math.max(0.05, Math.min(mapSize - 0.05, unit.x));
        unit.y = Math.max(0.05, Math.min(mapSize - 0.05, unit.y));
        if (!isWalkable(unit.x, unit.y)) {
            const p = nearestWalkable(unit.x, unit.y, 6);
            if (p) { unit.x = p.x; unit.y = p.y; unit.path = null; }
        }

        // Dust trail behind moving vehicles
        if (unit._moving && type.category !== 'infantry' && Math.random() < 0.14) {
            game.particles.push({
                x: unit.x - Math.cos(unit.angle) * unitRadius(type),
                y: unit.y - Math.sin(unit.angle) * unitRadius(type),
                z: 1,
                vx: (Math.random() - 0.5) * 0.01,
                vy: (Math.random() - 0.5) * 0.01,
                vz: 0.12 + Math.random() * 0.1,
                color: '#a08a66',
                size: 3 + Math.random() * 3 + type.size * 0.15,
                life: 1, decay: 0.035, grow: 1.5,
                type: 'dust'
            });
        }

        // Elite veterans (rank 3) slowly patch themselves up
        if (veterancyRank(unit.kills) >= 3 && unit.hp < type.hp && game.tick % 60 === 0) {
            unit.hp = Math.min(type.hp, unit.hp + 3);
        }

        // Badly wounded infantry leave a blood-drip trail while moving
        if (type.category === 'infantry' && unit.hp < type.hp * 0.4 &&
            unit._moving && (game.tick + i) % 22 === 0) {
            addDecal({
                type: 'splat',
                x: unit.x + (Math.random() - 0.5) * 0.3,
                y: unit.y + (Math.random() - 0.5) * 0.3,
                life: 10, size: 1.8,
                color: getFaction(unit.playerId) === 'series9'
                    ? 'rgba(30,34,40,0.5)' : 'rgba(96,20,14,0.45)',
                drops: []
            });
        }

        // Auto-acquire: idle units engage enemies within sight
        // (staggered scan keeps big battles cheap)
        if (!unit.attackTarget && unit.targetX === undefined && type.damage > 0 &&
            !unit._repairing && (game.tick + i) % 12 === 0) {
            const t = findTarget(unit, type, sightT(type));
            // self-acquired target: remember the post to return to
            if (t) autoEngage(unit, t, 7);
        }

        if ((game.tick + i) % 15 === 0) updateRepairRetreat(unit, type);
    }
}

// Death cry by faction: humans, mutant beasts, machines
function deathSound(unit) {
    const f = getFaction(unit.playerId);
    if (f === 'series9') return 'death_robot';
    if (f === 'evolved') return UNIT_TYPES[unit.type].category === 'infantry' ? 'death_human' : 'death_beast';
    return 'death_human';
}

// Remove a dead unit: death effects, wreck/splat, bookkeeping
function killUnit(unit, type) {
    unit.dead = true;
    if (unit.crushed) {
        // ground under the treads: a smeared pool along the drive line
        const smearAngle = unit.crushAngle !== undefined
            ? Math.atan2(Math.sin(unit.crushAngle) * 0.5, Math.cos(unit.crushAngle))
            : 0;
        addDecal({
            type: 'splat', x: unit.x, y: unit.y, life: 50, size: 9,
            smear: smearAngle,
            color: getFaction(unit.playerId) === 'series9'
                ? 'rgba(30,34,40,0.75)' : 'rgba(88,18,12,0.75)',
            drops: Array.from({ length: 7 }, () => [
                (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 14, 1.5 + Math.random() * 2.5])
        });
        createBloodSpray(unit.x, unit.y, getFaction(unit.playerId), true);
        SoundManager.play('impact_flesh', { x: unit.x, y: unit.y, volume: 1.4 });
        SoundManager.play(deathSound(unit), { x: unit.x, y: unit.y });
    } else {
        if (type.category === 'infantry') {
            createBloodSpray(unit.x, unit.y, getFaction(unit.playerId), true);
        } else {
            createExplosion(unit.x, unit.y, type.size >= 15);
        }
        if (type.category === 'infantry') SoundManager.play(deathSound(unit), { x: unit.x, y: unit.y });
        else SoundManager.play(type.size >= 15 ? 'explosion_large' : 'explosion_small', { x: unit.x, y: unit.y });
        if (!game.dying) game.dying = [];
        game.dying.push({
            role: unit.type,
            faction: getFaction(unit.playerId),
            playerId: unit.playerId,
            dir: IsoSprites.dirFromAngle(unit.angle || 0),
            x: unit.x, y: unit.y, t: 0,
            infantry: type.category === 'infantry'
        });
    }
    if (unit.playerId === 0) game.stats.unitsLost++;
    game.selection = game.selection.filter(s => s !== unit);
}

function updateUnitAttack(unit, type, speed) {
    const target = unit.attackTarget;

    if (!isAlive(target)) {
        unit.attackTarget = null;
        unit.path = null;
        unit._navGoal = null;
        // Attack-move: resume marching to the ordered destination
        if (unit.attackMove && unit.resumeX !== undefined) {
            unit.targetX = unit.resumeX;
            unit.targetY = unit.resumeY;
        } else if (unit._explicitTarget || unit._hunt) {
            // ordered target destroyed: keep clearing the area around it
            // on our own (anchored, so a chain of kills can't wander off)
            if (!unit._hunt) unit._huntAnchor = { x: target.x, y: target.y };
            const a = unit._huntAnchor;
            const next = findTarget({ x: a.x, y: a.y, type: unit.type, playerId: unit.playerId }, type, HUNT_RADIUS);
            unit._explicitTarget = false;
            unit._opp = null;
            if (next) { unit.attackTarget = next; unit._hunt = true; unit._chaseFails = 0; }
            else unit._hunt = false;
        } else if (unit._defend) {
            // raiders left in reach of the zone? take the next one
            const next = nextDefenseTarget(unit);
            if (next) unit.attackTarget = next;
            else endDefense(unit);
        } else if (unit._leash) {
            // threat dealt with: return to the guard post
            unit.targetX = unit._leash.x;
            unit.targetY = unit._leash.y;
            unit._leash = null;
        }
        return;
    }

    const dist = edgeDistance(unit, target);
    const range = rangeT(type);

    // Leash: self-acquired engagements break off when dragged too far
    // from the post, or when the target escapes far out of sight
    if (unit._leash) {
        const ldist = Math.hypot(unit.x - unit._leash.x, unit.y - unit._leash.y);
        if (ldist > (unit._leash.r || 7) || dist > sightT(type) * 1.6) {
            unit.attackTarget = null;
            unit.targetX = unit._leash.x;
            unit.targetY = unit._leash.y;
            unit.path = null;
            unit._leash = null;
            return;
        }
    }

    const dx = target.x - unit.x, dy = target.y - unit.y;
    const desired = Math.atan2(dy, dx);
    const inRange = dist <= range;
    const clear = inRange && (type.overWalls || hasLineOfFire(unit.x, unit.y, target.x, target.y));

    // Defenders never chase out of the zone: close in only as far as
    // its edge; a target that can't be hit from there is dropped
    if (unit._defend && !clear) {
        const fp = defenseFirePos(unit, target);
        if (fp && !fp.inside) {
            const res = navigate(unit, type, fp.x, fp.y, speed, 20);
            if (res === 'arrived' || res === 'unreachable') fp.blocked = true;
            else return;
        }
        if (!fp || fp.blocked) {
            unit._defIgnore = target;
            unit.path = null;
            unit._navGoal = null;
            const next = nextDefenseTarget(unit);
            if (next) unit.attackTarget = next;
            else endDefense(unit);
            return;
        }
    }

    if (clear) {
        // in range with a clear line: stand and fire
        unit._opp = null;
        unit.path = null;
        unit._navGoal = null;
        unit._chaseFails = 0;
        if (!type.turret) unit.angle = rotateToward(unit.angle || 0, desired, turnRate(type) * 1.5);
        const aim = type.turret ? (unit.turretAngle ?? unit.angle) : unit.angle;
        const tolerance = type.category === 'infantry' ? 0.5 : 0.3;
        if (angleDiff(aim, desired) < tolerance &&
            game.tick - (unit.lastAttack || 0) >= type.attackSpeed / 16) {
            fireProjectile(unit, target);
            unit.lastAttack = game.tick;
        }
        return;
    }

    // Ordered attack: shoot targets of opportunity on the way, but keep
    // driving toward the clicked target
    if (unit._explicitTarget || unit._hunt) snapShot(unit, type, target);

    // Close in: path to the target, re-planning as it moves. Out of
    // range only because a wall blocks the line? Same thing - drive
    // until the shot is clear.
    const res = navigate(unit, type, target.x, target.y, speed, 20);
    if (res === 'unreachable' || res === 'arrived') {
        // the planner can't get closer: if a re-plan doesn't help either,
        // give the target up instead of twitching in place forever
        unit.path = null;
        unit._chaseFails = (unit._chaseFails || 0) + 1;
        if (unit._chaseFails > 3) {
            unit.attackTarget = null;
            unit._chaseFails = 0;
        }
    }
}

// After an ordered target dies, units hunt for more enemies within
// this many tiles of where it stood before going idle
const HUNT_RADIUS = 8;

// Fire at whatever enemy is in range while driving, without turning
// toward it: turrets swing freely, fixed guns only take shots that line
// up with the direction of travel.
function snapShot(unit, type, main) {
    if (game.tick - (unit.lastAttack || 0) < type.attackSpeed / 16) return;
    const range = rangeT(type);
    let opp = unit._opp;
    if (!isAlive(opp) || edgeDistance(unit, opp) > range) {
        opp = unit._opp = null;
        if ((game.tick + unit.id) % 8 !== 0) return;
        opp = findTarget(unit, type, range);
        if (!opp || opp === main) return;
        unit._opp = opp;
    }
    const desired = Math.atan2(opp.y - unit.y, opp.x - unit.x);
    const aim = type.turret ? (unit.turretAngle ?? unit.angle) : unit.angle;
    const tol = type.category === 'infantry' ? 0.7 : 0.35;
    if (angleDiff(aim || 0, desired) >= tol) return;
    if (!type.overWalls && !hasLineOfFire(unit.x, unit.y, opp.x, opp.y)) { unit._opp = null; return; }
    fireProjectile(unit, opp);
    unit.lastAttack = game.tick;
}

function updateUnitMove(unit, type, speed, i) {
    const dist = Math.hypot(unit.targetX - unit.x, unit.targetY - unit.y);

    // Attack-move: engage anything spotted along the way
    if (unit.attackMove && type.damage > 0 && (game.tick + i) % 10 === 0) {
        const t = findTarget(unit, type, sightT(type));
        if (t) {
            unit.resumeX = unit.targetX;
            unit.resumeY = unit.targetY;
            unit.attackTarget = t;
            unit._explicitTarget = false;
            unit.targetX = undefined;
            unit.targetY = undefined;
            unit.path = null;
            return;
        }
    }

    const res = navigate(unit, type, unit.targetX, unit.targetY, speed);
    if (res === 'arrived' || res === 'unreachable') {
        arrive(unit);
        return;
    }

    // Progress watchdog: wedged against other units or a fresh building?
    // Re-plan; if the destination slot is simply crowded, call it done.
    if ((game.tick + i) % 30 === 0) {
        const p = unit._prog;
        if (p && Math.hypot(unit.x - p.x, unit.y - p.y) < 0.12) {
            p.fails++;
            if (dist < 1.2 + 0.4 * p.fails || p.fails >= 6) {
                arrive(unit);
                return;
            }
            unit.path = null;
        } else {
            unit._prog = { x: unit.x, y: unit.y, fails: 0 };
        }
        if (p) { p.x = unit.x; p.y = unit.y; }
    }
}

function arrive(unit) {
    // Shift-queued waypoints: continue with the next leg
    if (unit.waypoints && unit.waypoints.length > 0) {
        const wp = unit.waypoints.shift();
        issueMove(unit, wp.x, wp.y, wp.attackMove);
        return;
    }
    unit.targetX = undefined;
    unit.targetY = undefined;
    unit.path = null;
    unit._navGoal = null;
    unit._prog = null;
    unit.attackMove = false;
    unit.resumeX = undefined;
    unit.resumeY = undefined;
}

// ============================================
// BASE DEFENSE
// Idle units answer an attack on the base, but fight from a defense
// zone: inside the reach of nearby towers, so every raider that trades
// shots with them also takes tower fire. Without towers the zone is a
// ring around the struck building. Units on a player order are never
// pulled away.
// ============================================
const DEFENSE_RECRUIT_RADIUS = 16; // idle units this close to a struck building respond
const DEFENSE_FREE_RADIUS = 9;     // zone radius around the building when there are no towers
const DEFENSE_TOWER_SPAN = 12;     // towers this close to the anchor shape the zone
const REPAIR_RETREAT_HP = 0.2;     // vehicles below this fall back to a Repair Bay

function defenseZone(playerId, x, y) {
    const circles = [];
    for (const b of game.buildings) {
        if (b.playerId !== playerId || !isAlive(b) || b.isUnderConstruction) continue;
        const bt = BUILDING_TYPES[b.type];
        if (!bt.damage) continue;
        if (Math.hypot(b.x - x, b.y - y) > DEFENSE_TOWER_SPAN) continue;
        // a tile inside the tower's reach: whoever shoots at the
        // defender from point-blank is still covered
        circles.push({ x: b.x, y: b.y, r: Math.max(1.5, rangeT(bt) - 1) });
    }
    if (circles.length) return { circles, towers: true };
    return { circles: [{ x, y, r: DEFENSE_FREE_RADIUS }], towers: false };
}

function inZone(zone, x, y) {
    return zone.circles.some(c => Math.hypot(x - c.x, y - c.y) <= c.r + 0.25);
}

// The zone follows the towers (built, destroyed) while a fight goes on
function defendZone(unit) {
    const d = unit._defend;
    if (!d.zone || game.tick - d.zoneTick > 30) {
        d.zone = defenseZone(unit.playerId, d.x, d.y);
        d.zoneTick = game.tick;
    }
    return d.zone;
}

function startDefending(unit, x, y) {
    if (!unit._defend) unit._defend = { x, y, post: { x: unit.x, y: unit.y } };
    unit._defend.zone = null;
    unit._leash = null;
}

// Where a defender should stand to shoot `target` without leaving its
// zone: the target itself if it is inside, else the zone edge facing
// it. null when the target can't be reached from anywhere in the zone.
function defenseFirePos(unit, target) {
    const zone = defendZone(unit);
    const reach = rangeT(UNIT_TYPES[unit.type]) + targetRadius(target);
    let best = null, bestGap = Infinity;
    for (const c of zone.circles) {
        const d = Math.hypot(target.x - c.x, target.y - c.y);
        if (d <= c.r) return { x: target.x, y: target.y, inside: true };
        const gap = d - c.r;
        if (gap > reach || gap >= bestGap) continue;
        bestGap = gap;
        best = { x: c.x + (target.x - c.x) / d * c.r, y: c.y + (target.y - c.y) / d * c.r, inside: false };
    }
    return best;
}

// Next raider a defender can hit from its zone (nearest first)
function nextDefenseTarget(unit) {
    let best = null, bestD = Infinity;
    for (const e of game.units) {
        if (e.playerId === unit.playerId || e.hp <= 0 || e === unit._defIgnore) continue;
        const d = Math.hypot(e.x - unit.x, e.y - unit.y);
        if (d >= bestD || d > DEFENSE_RECRUIT_RADIUS + 8) continue;
        if (!defenseFirePos(unit, e)) continue;
        best = e; bestD = d;
    }
    return best;
}

// Defense over (or nothing reachable): walk back to the post
function endDefense(unit) {
    const post = unit._defend.post;
    unit._defend = null;
    unit._defIgnore = null;
    unit.attackTarget = null;
    unit.path = null;
    unit._navGoal = null;
    if (Math.hypot(unit.x - post.x, unit.y - post.y) > 0.8) {
        unit.targetX = post.x;
        unit.targetY = post.y;
    }
}

// Self-initiated engagement (no player order). Next to own towers the
// unit fights from the tower zone, elsewhere on a plain leash.
function autoEngage(unit, target, leashR) {
    if (!unit._defend) {
        const z = defenseZone(unit.playerId, unit.x, unit.y);
        if (z.towers && inZone(z, unit.x, unit.y)) startDefending(unit, unit.x, unit.y);
    }
    if (unit._defend) {
        if (!defenseFirePos(unit, target)) return false;
    } else if (!unit._leash) {
        unit._leash = { x: unit.x, y: unit.y, r: leashR };
    }
    unit.attackTarget = target;
    unit._explicitTarget = false;
    return true;
}

// A building takes a hit: idle combat units near it move in to defend
function alertDefenders(building, attacker) {
    if (game.tick - (building._alertTick || -999) < 30) return;
    building._alertTick = game.tick;
    for (const u of game.units) {
        if (u.playerId !== building.playerId) continue;
        const t = UNIT_TYPES[u.type];
        if (!t || t.damage <= 0 || u._repairing) continue;
        if (u.targetX !== undefined) continue;                    // on an order
        if (u.attackTarget && (u._explicitTarget || u._hunt || u._defend)) continue; // already fighting
        if (Math.hypot(u.x - building.x, u.y - building.y) > DEFENSE_RECRUIT_RADIUS) continue;
        u._leash = null;
        u._defend = null;
        startDefending(u, building.x, building.y);
        const t2 = defenseFirePos(u, attacker) ? attacker : nextDefenseTarget(u);
        if (t2) {
            u.attackTarget = t2;
            u._explicitTarget = false;
            u.path = null;
        } else {
            u._defend = null; // raider out of reach of the zone: hold position
        }
    }
}

// Badly hurt vehicles that are defending (not on a player order) fall
// back to the nearest Repair Bay, then return to their post. An ordered
// attack is the player's call and is never interrupted.
function updateRepairRetreat(unit, type) {
    if (type.category !== 'armor') return;
    const r = unit._repairing;
    if (r) {
        const player = game.players[unit.playerId];
        if (unit.targetX !== undefined) return; // still driving there
        const bt = BUILDING_TYPES[r.bay.type];
        if (isAlive(r.bay) && Math.hypot(unit.x - r.bay.x, unit.y - r.bay.y) > bt.repairRadius &&
            (r.tries = (r.tries || 0) + 1) <= 2) {
            // stopped short in a crowd: squeeze in closer
            const p = nearestWalkable(r.bay.x, r.bay.y, 4, unit.x, unit.y);
            if (p) { unit.targetX = p.x; unit.targetY = p.y; unit.path = null; return; }
        }
        if (!isAlive(r.bay) || unit.hp >= type.hp || player.oil < 2 ||
            Math.hypot(unit.x - r.bay.x, unit.y - r.bay.y) > bt.repairRadius) {
            unit._repairing = null;
            if (unit.hp >= type.hp && !unit.attackTarget) {
                unit.targetX = r.post.x;
                unit.targetY = r.post.y;
                unit.path = null;
            }
        }
        return;
    }
    if (unit.hp >= type.hp * REPAIR_RETREAT_HP) return;
    if (unit.attackMove || unit.targetX !== undefined) return;
    if (unit.attackTarget && (unit._explicitTarget || unit._hunt)) return;
    // only in a defensive fight: engaged on its own or shot recently
    const fighting = (unit.attackTarget && !unit._explicitTarget) ||
        game.tick - (unit._hurtTick || -9999) < 180;
    if (!fighting) return;
    if (game.players[unit.playerId].oil < 2) return;
    // defense means at home: a vehicle left idle deep in enemy land after
    // an ordered attack is still on offense
    if (!unit._defend && !game.buildings.some(b => b.playerId === unit.playerId && isAlive(b) &&
        Math.hypot(b.x - unit.x, b.y - unit.y) <= DEFENSE_RECRUIT_RADIUS)) return;
    let bay = null, bestD = Infinity;
    for (const b of game.buildings) {
        if (b.playerId !== unit.playerId || !isAlive(b) || b.isUnderConstruction) continue;
        if (!BUILDING_TYPES[b.type].repairRate) continue;
        const d = Math.hypot(b.x - unit.x, b.y - unit.y);
        if (d < bestD) { bay = b; bestD = d; }
    }
    if (!bay) return;
    const post = unit._defend ? unit._defend.post : unit._leash ? { x: unit._leash.x, y: unit._leash.y } : { x: unit.x, y: unit.y };
    const bt = BUILDING_TYPES[bay.type];
    let dest = { x: unit.x, y: unit.y };
    if (bestD > bt.repairRadius - 0.8) {
        const k = (bt.size * 0.5 + 1.3) / bestD;
        dest = nearestWalkable(bay.x + (unit.x - bay.x) * k, bay.y + (unit.y - bay.y) * k, 4) || { x: bay.x, y: bay.y };
    }
    issueMove(unit, dest.x, dest.y);
    unit._leash = null;
    unit._defend = null;
    unit._repairing = { bay, post };
    if (unit.playerId === 0 && game.tick - (game._retreatMsgTick || -9999) > 600) {
        game._retreatMsgTick = game.tick;
        setBanner('Damaged vehicles falling back to the Repair Bay', 3, '#66ffaa');
    }
}

// Convert range/sight stats (pixel-ish values) into tile distances
function rangeT(type) { return (type.range || 0) / 24; }
function sightT(type) { return (type.sight || 100) / 24; }

// Rotate an angle toward a target angle by at most `step`, wrap-aware
function rotateToward(current, target, step) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= step) return target;
    return current + Math.sign(diff) * step;
}

function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
}

function updateBuildings(dt) {
    for (let i = game.buildings.length - 1; i >= 0; i--) {
        const building = game.buildings[i];
        const type = BUILDING_TYPES[building.type];

        // Building construction progress
        if (building.isUnderConstruction) {
            building.buildProgress++;
            if (building.buildProgress >= building.buildTime) {
                building.isUnderConstruction = false;
                building.hp = type.hp;
                building.buildProgress = 0;
                // Set activation time for turrets (3 second delay)
                if (type.damage) {
                    building.activationTime = game.tick + 180; // ~3 seconds at 60 FPS
                }
                if (building.playerId === 0) {
                    SoundManager.play('construction_complete');
                    if (typeof VoiceManager !== 'undefined') VoiceManager.say('Construction complete', 4000);
                }
            } else {
                // Construction in progress - keep hp at 1
                building.hp = 1;
            }
        }

        // Death check
        if (building.hp <= 0 && !building.isUnderConstruction) {
            createExplosion(building.x, building.y, true);
            SoundManager.play('building_collapse', { x: building.x, y: building.y });
            blockTilesFor(building, false);
            addDecal({
                type: 'scorch', x: building.x, y: building.y, life: 60,
                size: 16 + type.size * 9,
                rubble: Array.from({ length: 4 + type.size }, () => [
                    (Math.random() - 0.5) * type.size * 22,
                    (Math.random() - 0.5) * type.size * 11,
                    2 + Math.random() * 3,
                    Math.random() * Math.PI])
            });
            building.dead = true;
            game.buildings.splice(i, 1);
            game.selection = game.selection.filter(s => s !== building);
            continue;
        }

        // Defense towers: re-scan for the best target a few times per
        // second, track it smoothly every tick, fire once aligned
        if (type.damage && !building.isUnderConstruction) {
            const isActivated = !building.activationTime || game.tick >= building.activationTime;
            let tgt = building.currentTarget;
            if (tgt && (!isAlive(tgt) || edgeDistance(building, tgt) > rangeT(type) ||
                !hasLineOfFire(building.x, building.y, tgt.x, tgt.y))) {
                tgt = building.currentTarget = null;
            }
            if (isActivated && (game.tick + i) % 8 === 0) {
                tgt = building.currentTarget = findTarget(building, type, rangeT(type), true);
            }
            const desired = tgt ? Math.atan2(tgt.y - building.y, tgt.x - building.x) : building.turretAngle;
            building.turretAngle = rotateToward(building.turretAngle ?? Math.PI / 4, desired, 0.08);
            if (tgt && isActivated && angleDiff(building.turretAngle, desired) < 0.3 &&
                game.tick - (building.lastAttack || 0) >= type.attackSpeed / 16) {
                fireProjectile(building, tgt, type.damage);
                building.lastAttack = game.tick;
            }
        }

        // Heavily damaged buildings burn
        if (!building.isUnderConstruction && building.hp < type.hp * 0.4 && Math.random() < 0.12) {
            const fire = Math.random() < 0.4;
            game.particles.push({
                x: building.x + (Math.random() - 0.5) * type.size * 0.7,
                y: building.y + (Math.random() - 0.5) * type.size * 0.7,
                z: 8 + Math.random() * 10,
                vx: (Math.random() - 0.5) * 0.004 + 0.002,
                vy: (Math.random() - 0.5) * 0.004 - 0.001,
                vz: 0.3 + Math.random() * 0.25,
                color: fire ? '#ff7722' : '#2e2b28',
                size: fire ? 6 + Math.random() * 4 : 7 + Math.random() * 5,
                life: 1, decay: fire ? 0.04 : 0.012, grow: fire ? 0.6 : 1.8,
                type: fire ? 'fire' : 'smoke'
            });
        }

        // Tech research (Research Lab)
        if (building.researching && !building.isUnderConstruction) {
            building.researching.progress++;
            if (building.researching.progress >= building.researching.time) {
                const player = game.players[building.playerId];
                player.techLevel = Math.max(player.techLevel, building.researching.level);
                building.researching = null;
                if (building.playerId === 0) {
                    SoundManager.play('research_complete');
                    if (typeof VoiceManager !== 'undefined') VoiceManager.say('Research complete');
                    setBanner(`Research complete: Tech Level ${player.techLevel} unlocked!`, 5, '#cc66ff');
                }
            }
        }

        // Repair Bay: slowly heal friendly vehicles nearby (costs oil)
        if (type.repairRate && !building.isUnderConstruction && game.tick % 30 === 0) {
            const player = game.players[building.playerId];
            for (const unit of game.units) {
                if (unit.playerId !== building.playerId) continue;
                const uType = UNIT_TYPES[unit.type];
                if (!uType || uType.category !== 'armor' || unit.hp >= uType.hp) continue;
                const dist = Math.hypot(unit.x - building.x, unit.y - building.y);
                if (dist <= type.repairRadius && player.oil >= 2) {
                    unit.hp = Math.min(uType.hp, unit.hp + type.repairRate / 2);
                    player.oil -= 2;
                    // spark effect
                    if (Math.random() < 0.5) {
                        game.particles.push({
                            x: unit.x, y: unit.y, z: 8,
                            vx: (Math.random() - 0.5) * 0.02,
                            vy: (Math.random() - 0.5) * 0.02,
                            vz: 0.8, grav: 0.08,
                            color: '#66ffaa', size: 1.2, life: 1, decay: 0.05, type: 'spark'
                        });
                    }
                }
            }
        }

        // Production queue
        if (building.productionQueue.length > 0 && !building.isUnderConstruction) {
            const current = building.productionQueue[0];
            building.produceProgress += 1;
            building.produceTime = current.time;

            if (building.produceProgress >= building.produceTime &&
                game.units.filter(u => u.playerId === building.playerId).length >= unitCapFor(building.playerId)) {
                // population cap reached: the unit waits at the door
                building.produceProgress = building.produceTime;
                building.capBlocked = true;
            } else if (building.produceProgress >= building.produceTime) {
                building.capBlocked = false;
                const exit = productionExit(building);
                const spawnX = exit.x, spawnY = exit.y;
                const newUnit = spawnUnit(current.type, building.playerId, spawnX, spawnY);
                if (building.playerId === 0) {
                    SoundManager.play('unit_ready');
                    if (typeof VoiceManager !== 'undefined') VoiceManager.say('Unit ready', 7000);
                    if (typeof VoiceManager !== 'undefined') {
                        VoiceManager.play('ready', getFaction(0));
                    }
                    game.stats.unitsBuilt++;
                }
                // Send to rally point if set
                if (newUnit) {
                    newUnit.angle = Math.atan2(spawnY - building.y, spawnX - building.x);
                    newUnit.turretAngle = newUnit.angle;
                    if (building.rallyX !== undefined) {
                        issueMove(newUnit, building.rallyX + (Math.random() - 0.5) * 1.5,
                            building.rallyY + (Math.random() - 0.5) * 1.5);
                    } else {
                        // step clear of the door so the next unit has room
                        const ox = spawnX - building.x, oy = spawnY - building.y;
                        const ol = Math.hypot(ox, oy) || 1;
                        const p = nearestWalkable(spawnX + ox / ol * 1.2, spawnY + oy / ol * 1.2, 3);
                        if (p) issueMove(newUnit, p.x, p.y);
                    }
                }
                building.productionQueue.shift();
                building.produceProgress = 0;
            }
        }
    }
}

// Book a confirmed kill: scoreboard, veterancy and promotion fanfare
function registerKill(proj, victim) {
    if (victim._killRegistered) return;
    victim._killRegistered = true;

    if (proj.playerId === 0) {
        if (UNIT_TYPES[victim.type]) game.stats.unitsKilled++;
        else game.stats.buildingsRazed++;
    }

    const shooter = proj.source;
    if (shooter && UNIT_TYPES[shooter.type] && game.units.includes(shooter)) {
        const before = veterancyRank(shooter.kills);
        shooter.kills = (shooter.kills || 0) + 1;
        const after = veterancyRank(shooter.kills);
        if (after > before && shooter.playerId === 0) {
            // Promotion celebration: golden burst + jingle
            for (let i = 0; i < 10; i++) {
                const ang = (i / 10) * Math.PI * 2;
                game.particles.push({
                    x: shooter.x, y: shooter.y, z: 6,
                    vx: Math.cos(ang) * 0.03, vy: Math.sin(ang) * 0.03, vz: 1.4, grav: 0.06,
                    color: '#ffd14a', size: 1.6, life: 1, decay: 0.03, type: 'spark'
                });
            }
            SoundManager.play('unit_ready');
            if (typeof VoiceManager !== 'undefined') {
                VoiceManager.play('promote', getFaction(0));
            }
            if (!game._promoBannerShown) {
                game._promoBannerShown = true;
                const name = unitDisplayName(shooter.type, getFaction(0));
                setBanner(`${name} promoted to veteran! (+15% damage per rank)`, 5, '#ffd14a');
            }
        }
    }
}

function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const proj = game.projectiles[i];
        proj.life--;

        if (proj.arc) {
            // Artillery: ballistic arc toward a fixed impact point
            proj.t++;
            const p = Math.min(1, proj.t / proj.T);
            const px = proj.x, py = proj.y;
            proj.x = proj.startX + (proj.aimX - proj.startX) * p;
            proj.y = proj.startY + (proj.aimY - proj.startY) * p;
            proj.z = Math.sin(p * Math.PI) * proj.apex;
            proj.vx = proj.x - px;
            proj.vy = proj.y - py;
            proj.progress = p;
            if (p >= 1) {
                detonateShell(proj);
                game.projectiles.splice(i, 1);
            }
            continue;
        }

        // Rounds that are going to hit track their target, so a shot
        // never "hits" thin air next to a unit that drove on
        if (proj.willHit && isAlive(proj.target)) {
            proj.aimX = proj.target.x;
            proj.aimY = proj.target.y;
        }
        const hitR = proj.willHit && proj.target ? targetRadius(proj.target) * 0.7 : 0;
        const dx = proj.aimX - proj.x, dy = proj.aimY - proj.y;
        const d = Math.hypot(dx, dy);
        if (d <= proj.speed + hitR || proj.life <= 0) {
            if (proj.willHit && isAlive(proj.target)) {
                applyHit(proj, proj.target, proj.x + (d > 0 ? dx / d : 0) * Math.max(0, d - hitR),
                    proj.y + (d > 0 ? dy / d : 0) * Math.max(0, d - hitR));
            } else {
                // a miss kicks up dirt where it lands
                createDustPuff(proj.aimX, proj.aimY);
                if (proj.weapon === 'mg' || proj.weapon === 'hmg') {
                    SoundManager.play(Math.random() < 0.12 ? 'ricochet' : 'impact_dirt', { x: proj.aimX, y: proj.aimY });
                } else if (proj.weapon === 'cannon' || proj.weapon === 'rocket') {
                    SoundManager.play('explosion_small', { x: proj.aimX, y: proj.aimY, volume: 0.6 });
                }
            }
            game.projectiles.splice(i, 1);
            continue;
        }
        proj.vx = dx / d * proj.speed;
        proj.vy = dy / d * proj.speed;
        proj.x += proj.vx;
        proj.y += proj.vy;
    }
}

// Deal damage to one entity and run all the side effects (alerts,
// retaliation, kill bookkeeping, music heat)
function dealDamage(victim, dmg, proj) {
    if (!isAlive(victim)) return;
    victim.hp -= dmg;
    victim._hitFlash = 6;
    if (proj.playerId === 0 || victim.playerId === 0) {
        game.combatHeat = Math.min(1, (game.combatHeat || 0) + 0.1);
    }
    const src = proj.source;
    if (BUILDING_TYPES[victim.type] && isAlive(src)) alertDefenders(victim, src);
    if (UNIT_TYPES[victim.type] && isAlive(src)) onUnitDamaged(victim, src);
    // Base-under-attack alert (minimap ping + throttled sound + Space jumps there)
    if (victim.playerId === 0) {
        game.lastAttackAlert = { x: victim.x, y: victim.y, time: Date.now() };
        if (!game._lastAlertSound || Date.now() - game._lastAlertSound > 12000) {
            game._lastAlertSound = Date.now();
            SoundManager.play('alert');
            if (typeof VoiceManager !== 'undefined') VoiceManager.say(BUILDING_TYPES[victim.type] ? 'Our base is under attack' : 'Our units are under attack', 15000);
            if (BUILDING_TYPES[victim.type]) setBanner('Our base is under attack! (Space: jump there)', 4, '#ff5533');
            else setBanner('Our units are under attack! (Space: jump there)', 3, '#ff8855');
        }
    }
    if (victim.hp <= 0) registerKill(proj, victim);
}

// Direct hit: weapon-vs-armor multiplier, effects, optional splash
function applyHit(proj, target, ix, iy) {
    const mult = weaponMultiplier(proj.weapon, target);
    const dmg = Math.max(1, Math.round(proj.damage * mult));
    dealDamage(target, dmg, proj);
    createDamageNumber(ix, iy, dmg, mult);

    if (proj.weapon === 'flame') {
        for (let f = 0; f < 3; f++) {
            game.particles.push({
                x: ix + (Math.random() - 0.5) * 0.6,
                y: iy + (Math.random() - 0.5) * 0.6,
                z: 1, vx: 0, vy: 0, vz: 0.05,
                color: proj.faction === 'series9' ? '#7dffb0' : ['#ff5511', '#ff8822', '#ffcc33'][f],
                size: 3 + Math.random() * 3,
                life: 0.9 + Math.random() * 0.6,
                type: 'fire'
            });
        }
    }
    if (proj.splash > 0) {
        splashDamage(proj, ix, iy, proj.splash, target, 0.5);
        if (proj.weapon !== 'flame') addDecal({ type: 'crater', x: ix, y: iy, life: 30, size: 9 });
    }
    if (armorClass(target) === 'infantry') {
        createBloodSpray(ix, iy, getFaction(target.playerId));
        if (proj.weapon === 'cannon' || proj.weapon === 'rocket') SoundManager.play('explosion_small', { x: ix, y: iy, volume: 0.7 });
        else SoundManager.play('impact_flesh', { x: ix, y: iy });
    } else {
        createImpact(ix, iy, proj.weapon);
        if (proj.weapon === 'cannon' || proj.weapon === 'rocket') SoundManager.play('explosion_small', { x: ix, y: iy, volume: 0.75 });
        else if (proj.weapon !== 'flame') SoundManager.play(Math.random() < 0.08 ? 'ricochet' : 'impact_metal', { x: ix, y: iy });
    }
}

// Area damage around an impact point; full damage near the center,
// falling off toward the rim. Never hurts the shooter's own side.
function splashDamage(proj, x, y, radius, skip, scale = 1) {
    const victims = [...game.units, ...game.buildings];
    for (const v of victims) {
        if (v === skip || v.playerId === proj.playerId || !isAlive(v)) continue;
        if (Math.abs(v.x - x) > radius + 2 || Math.abs(v.y - y) > radius + 2) continue;
        const d = Math.max(0, Math.hypot(v.x - x, v.y - y) - targetRadius(v));
        if (d > radius) continue;
        const falloff = d < 0.3 ? 1 : 1 - 0.6 * (d / radius);
        const dmg = Math.round(proj.damage * scale * falloff * weaponMultiplier(proj.weapon, v));
        if (dmg > 0) {
            dealDamage(v, dmg, proj);
            if (UNIT_TYPES[v.type]) createDamageNumber(v.x, v.y, dmg, weaponMultiplier(proj.weapon, v));
        }
    }
}

// Artillery shell lands: the blast hurts whatever is there NOW
function detonateShell(proj) {
    SoundManager.play('explosion_small', { x: proj.aimX, y: proj.aimY, volume: 1.2 });
    createExplosion(proj.aimX, proj.aimY, false);
    addDecal({ type: 'crater', x: proj.aimX, y: proj.aimY, life: 40, size: 10 + Math.random() * 4 });
    splashDamage(proj, proj.aimX, proj.aimY, proj.splash || 1, null, 1);
}


function updateFogOfWar() {
    const fogMapSize = getMapSize();
    // Reset explored areas to "seen but not visible"
    for (let y = 0; y < fogMapSize; y++) {
        for (let x = 0; x < fogMapSize; x++) {
            if (game.fogOfWar[y]?.[x] === 2) {
                game.fogOfWar[y][x] = 1;
            }
        }
    }

    // Update visibility from player units and buildings
    const revealers = [
        ...game.units.filter(u => u.playerId === 0),
        ...game.buildings.filter(b => b.playerId === 0)
    ];

    for (const entity of revealers) {
        const type = UNIT_TYPES[entity.type] || BUILDING_TYPES[entity.type];
        const sight = sightT(type);

        for (let dy = -sight; dy <= sight; dy++) {
            for (let dx = -sight; dx <= sight; dx++) {
                if (dx * dx + dy * dy <= sight * sight) {
                    const tx = Math.floor(entity.x + dx);
                    const ty = Math.floor(entity.y + dy);
                    if (tx >= 0 && tx < fogMapSize && ty >= 0 && ty < fogMapSize) {
                        game.fogOfWar[ty][tx] = 2;
                    }
                }
            }
        }
    }
}

function updateAI() {
    // Orientation phase: like a human player, the AI needs a moment
    // before its first action (easy waits the longest)
    const startDelay = { easy: 4200, normal: 2700, hard: 1500 }[gameSettings.difficulty] || 2700;
    if (game.tick < startDelay) return;
    if (game.tick % 120 !== 0) return; // Run every 2 seconds

    const ai = game.players[1];
    const aiUnits = game.units.filter(u => u.playerId === 1);
    const aiBuildings = game.buildings.filter(b => b.playerId === 1);
    const playerUnits = game.units.filter(u => u.playerId === 0);
    const playerBuildings = game.buildings.filter(b => b.playerId === 0);

    executeAIStrategy(ai, aiUnits, aiBuildings, playerUnits, playerBuildings);

    // Small oil drip based on difficulty, slowly escalating so
    // long games build toward bigger late-game clashes
    const difficultyOilBonus = { easy: 4, normal: 10, hard: 20 };
    const escalation = 1 + Math.min(1.2, (game.tick / 60) / 700);
    ai.oil += (difficultyOilBonus[gameSettings.difficulty] || 10) * escalation;
}

// Find a free oil patch near a position (for AI derrick placement)
function findFreeOilPatch(nearX, nearY, maxDist = 30) {
    const mapSize = getMapSize();
    let best = null;
    let bestDist = Infinity;
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const tile = game.map[y]?.[x];
            if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) continue;
            // must satisfy normal placement rules (no overlaps)
            if (!canBuildAt('derrick', x, y, 1)) continue;
            const dist = Math.hypot(x - nearX, y - nearY);
            if (dist < bestDist && dist <= maxDist) {
                bestDist = dist;
                best = { x, y };
            }
        }
    }
    return best;
}

function executeAIStrategy(ai, aiUnits, aiBuildings, playerUnits, playerBuildings) {
    const aiHQ = aiBuildings.find(b => b.type === 'hq') || aiBuildings[0];
    if (!aiHQ) return;

    // Counts include structures under construction (so the AI doesn't double-build)
    const count = role => aiBuildings.filter(b => b.type === role).length;
    const stations = count('powerStation');
    const derricks = count('derrick');
    const numBarracks = count('barracks');
    const numFactories = count('factory');
    const numLabs = count('researchLab');
    const barracks = aiBuildings.filter(b => b.type === 'barracks' && !b.isUnderConstruction);
    const factories = aiBuildings.filter(b => b.type === 'factory' && !b.isUnderConstruction);
    const labs = aiBuildings.filter(b => b.type === 'researchLab' && !b.isUnderConstruction);
    const towers = count('tower') + count('towerHeavy');

    // Human-like action budget: at most one construction order per
    // think-tick (every 2s), like a player clicking through their base
    let buildActions = 1;
    const tryBuild = (role, near) => {
        if (buildActions <= 0) return false;
        const type = BUILDING_TYPES[role];
        if (ai.oil < type.cost) return false;
        let pos;
        if (type.needsOil) {
            pos = findFreeOilPatch(near.x, near.y, 35);
        } else {
            pos = findBuildPosition(near.x, near.y, role);
        }
        if (!pos) return false;
        createBuilding(role, 1, pos.x, pos.y, true);
        ai.oil -= type.cost;
        buildActions--;
        return true;
    };

    // ---- ECONOMY: power station first, then derricks on oil patches ----
    const maxDerricks = { easy: 2, normal: 3, hard: 5 }[gameSettings.difficulty] || 3;
    if (stations < 1) { tryBuild('powerStation', aiHQ); return; }
    if (derricks < 2) tryBuild('derrick', aiHQ);

    // ---- TECH CHAIN ----
    if (numBarracks < 1) tryBuild('barracks', aiHQ);
    if (barracks.length > 0 && numFactories < 1) tryBuild('factory', aiHQ);
    if (factories.length > 0 && numLabs < 1 && ai.oil > 900) tryBuild('researchLab', aiHQ);

    // Research tech levels
    if (labs.length > 0 && ai.techLevel < MAX_TECH_LEVEL) {
        const lab = labs.find(l => !l.researching);
        const next = ai.techLevel + 1;
        const upgrade = TECH_UPGRADES[next];
        if (lab && upgrade && ai.oil >= upgrade.cost + 400) {
            ai.oil -= upgrade.cost;
            lab.researching = { level: next, progress: 0, time: upgrade.time };
        }
    }

    // ---- EXPANSION & DEFENSE ----
    if (derricks < maxDerricks && ai.oil > 600) tryBuild('derrick', aiHQ);
    if (stations < 2 && derricks >= 3 && ai.oil > 1200) tryBuild('powerStation', aiHQ);

    const maxTowers = { easy: 2, normal: 4, hard: 6 }[gameSettings.difficulty] || 4;
    if (towers < maxTowers && ai.oil > 1000) {
        tryBuild(ai.techLevel >= 2 && Math.random() > 0.5 ? 'towerHeavy' : 'tower', aiHQ);
    }
    if (numBarracks < 2 && ai.oil > 1500) tryBuild('barracks', aiHQ);
    if (numFactories < 2 && ai.oil > 2000) tryBuild('factory', aiHQ);

    // ---- UNIT PRODUCTION ----
    // production pace by difficulty: the AI doesn't queue every think
    const prodChance = { easy: 0.25, normal: 0.4, hard: 0.75 }[gameSettings.difficulty] || 0.5;
    let prodActions = Math.random() < prodChance ? (game.tick < 18000 ? 1 : 2) : 0;
    const queueUnit = (building, role) => {
        if (prodActions <= 0) return false;
        const uType = UNIT_TYPES[role];
        if (!uType || ai.oil < uType.cost || ai.techLevel < uType.tech) return false;
        if (aiUnits.length + aiBuildings.reduce((n, b) => n + b.productionQueue.length, 0) >= unitCapFor(1)) return false;
        if (building.productionQueue.length >= 1) return false;
        ai.oil -= uType.cost;
        addToProductionQueue(building, role);
        prodActions--;
        return true;
    };

    // Infantry mix
    for (const b of barracks) {
        const roll = Math.random();
        if (ai.techLevel >= 2 && roll > 0.65) queueUnit(b, 'rocketeer');
        else if (ai.techLevel >= 2 && roll > 0.45) queueUnit(b, 'flamer');
        else queueUnit(b, 'trooper');
    }

    // Vehicle mix scales with tech level
    for (const f of factories) {
        const roll = Math.random();
        if (ai.techLevel >= 3 && roll > 0.75) queueUnit(f, 'heavy');
        else if (ai.techLevel >= 3 && roll > 0.6) queueUnit(f, 'artillery');
        else if (ai.techLevel >= 2 && roll > 0.35) queueUnit(f, 'tank');
        else if (roll > 0.15) queueUnit(f, 'buggy');
        else queueUnit(f, 'bike');
    }

    // ---- BUNKER HUNTING: send a fast unit to grab free tech bunkers ----
    const openBunker = (game.bunkers || []).find(b => !b.claimed);
    if (openBunker) {
        const runner = aiUnits.find(u => (u.type === 'bike' || u.type === 'buggy') &&
            !u.attackTarget && u.targetX === undefined);
        if (runner) issueMove(runner, openBunker.x, openBunker.y);
    }

    // ---- ATTACK WAVES ----
    // A human can't field an assault force in the first minutes -
    // neither does the AI (per-difficulty earliest attack time)
    const minAttackTick = { easy: 32400, normal: 25200, hard: 16200 }[gameSettings.difficulty] || 25200;
    if (game.tick < minAttackTick) return;

    const combatUnits = aiUnits;
    const attackThreshold = { easy: 16, normal: 12, hard: 8 }[gameSettings.difficulty] || 12;
    const gameTime = game.tick / 60;
    if (combatUnits.length >= attackThreshold || (gameTime > 480 && combatUnits.length >= 5)) {
        // Warn the player when a fresh wave rolls out (throttled)
        if (!game._lastWaveBanner || Date.now() - game._lastWaveBanner > 45000) {
            game._lastWaveBanner = Date.now();
            setBanner('WARNING: Enemy attack wave incoming!', 4, '#ff5533');
            SoundManager.play('warn');
            if (typeof VoiceManager !== 'undefined') VoiceManager.say('Warning. Enemy forces approaching', 30000);
        }
        attackPlayerBase(playerBuildings, playerUnits, aiUnits);
    }
}

function attackPlayerBase(playerBuildings, playerUnits, aiUnits) {
    // Find the player HQ or nearest player building as rally point
    const playerHQ = playerBuildings.find(b => b.type === 'hq');
    const rallyTarget = playerHQ || playerBuildings[0] || playerUnits[0];

    for (const unit of aiUnits) {
        if (unit.attackTarget && unit.attackTarget.hp > 0) {
            // Already has a living target, skip
            continue;
        }

        const unitType = UNIT_TYPES[unit.type];
        const sightRange = unitType ? sightT(unitType) : 4;

        // Look for nearby enemy units first (prioritize closest)
        let nearestTarget = null;
        let nearestDist = Infinity;

        for (const u of playerUnits) {
            const dist = Math.hypot(u.x - unit.x, u.y - unit.y);
            if (dist <= sightRange && dist < nearestDist) {
                nearestDist = dist;
                nearestTarget = u;
            }
        }

        // If no units found, look for nearby buildings
        if (!nearestTarget) {
            for (const b of playerBuildings) {
                const dist = Math.hypot(b.x - unit.x, b.y - unit.y);
                if (dist <= sightRange && dist < nearestDist) {
                    nearestDist = dist;
                    nearestTarget = b;
                }
            }
        }

        if (nearestTarget) {
            unit.attackTarget = nearestTarget;
            unit._leash = null;
        } else if (rallyTarget) {
            // March toward the player base as an attack-move wave
            if (unit.targetX === undefined || Math.abs(unit.targetX - rallyTarget.x) > 5 || Math.abs(unit.targetY - rallyTarget.y) > 5) {
                issueMove(unit, rallyTarget.x + (Math.random() - 0.5) * 6,
                    rallyTarget.y + (Math.random() - 0.5) * 6, true);
            }
        }
    }
}

// ============================================
// TECH BUNKERS & SCAVENGERS (map events)
// ============================================

function placeBunkers() {
    game.bunkers = [];
    const mapSize = getMapSize();
    const count = 3 + Math.floor(mapSize / 32);
    let attempts = 0;
    while (game.bunkers.length < count && attempts < 400) {
        attempts++;
        const x = 8 + Math.floor(Math.random() * (mapSize - 16));
        const y = 8 + Math.floor(Math.random() * (mapSize - 16));
        const tile = game.map[y]?.[x];
        if (!tile || tile.type !== 'grass' || tile.oil) continue;
        // keep away from both HQs and other bunkers
        const nearBase = game.buildings.some(b => b.type === 'hq' && Math.hypot(b.x - x, b.y - y) < 14);
        const nearBunker = game.bunkers.some(b => Math.hypot(b.x - x, b.y - y) < 10);
        if (nearBase || nearBunker) continue;
        game.bunkers.push({ x: x + 0.5, y: y + 0.5, claimed: false });
    }
}

function updateBunkers() {
    if (!game.bunkers || game.tick % 12 !== 0) return;
    for (const bunker of game.bunkers) {
        if (bunker.claimed) continue;
        // First combat unit to reach the bunker claims it (scavengers can't)
        const claimer = game.units.find(u => u.playerId !== 2 &&
            Math.hypot(u.x - bunker.x, u.y - bunker.y) < 2);
        if (!claimer) continue;

        bunker.claimed = true;
        bunker.claimedBy = claimer.playerId;
        const player = game.players[claimer.playerId];
        const roll = Math.random();
        let rewardText = '';

        if (claimer.playerId === 0) game.stats.bunkersClaimed++;
        if (roll < 0.4) {
            const amount = 600 + Math.floor(Math.random() * 400);
            player.oil = Math.min(50000, player.oil + amount);
            if (claimer.playerId === 0) game.stats.oilEarned += amount;
            rewardText = `Bunker secured: +${amount} oil salvaged`;
        } else if (roll < 0.75) {
            const pool = ['trooper', 'trooper', 'buggy', 'tank'];
            const n = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) {
                const role = pool[Math.floor(Math.random() * pool.length)];
                const pos = findValidSpawnPosition(Math.floor(bunker.x) + (i % 2) * 2 - 1, Math.floor(bunker.y) + 2, 5);
                spawnUnit(role, claimer.playerId, pos.x + 0.5, pos.y + 0.5);
            }
            rewardText = `Bunker secured: ${n} stranded units join you`;
        } else {
            let boosted = 0;
            for (const u of game.units) {
                if (u.playerId !== claimer.playerId) continue;
                if (Math.hypot(u.x - bunker.x, u.y - bunker.y) < 7) {
                    u.kills = (u.kills || 0) + VETERANCY_KILLS[0];
                    boosted++;
                }
            }
            rewardText = `Bunker secured: combat data hardens ${boosted} nearby unit${boosted === 1 ? '' : 's'}`;
        }

        // Celebration effects
        for (let i = 0; i < 14; i++) {
            const ang = (i / 14) * Math.PI * 2;
            game.particles.push({
                x: bunker.x, y: bunker.y, z: 2,
                vx: Math.cos(ang) * 0.04, vy: Math.sin(ang) * 0.04, vz: 1.6, grav: 0.06,
                color: '#66e0ff', size: 1.8, life: 1, decay: 0.025, type: 'spark'
            });
        }
        if (claimer.playerId === 0) {
            setBanner(rewardText, 5, '#66e0ff');
            SoundManager.play('bonus');
            if (typeof VoiceManager !== 'undefined') VoiceManager.say('Tech bunker secured');
        } else {
            setBanner('The enemy secured a tech bunker!', 4, '#ff7755');
            SoundManager.play('warn');
            if (typeof VoiceManager !== 'undefined') VoiceManager.say('The enemy has captured a tech bunker');
        }
        addPing(bunker.x, bunker.y, '#66e0ff');
    }
}

// When the enemy is nearly wiped out, reveal the stragglers so the
// player never has to comb the map for one hidden building
function updateRemnantsPing() {
    if (game.tick % 300 !== 0) return; // every 5s
    const enemies = [
        ...game.units.filter(u => u.playerId === 1),
        ...game.buildings.filter(b => b.playerId === 1)
    ];
    if (enemies.length === 0 || enemies.length > 3) return;
    if (Date.now() - (game._remnantsPingTime || 0) < 20000) {
        // keep the minimap pings coming, but not the banner
        for (const e of enemies) addPing(e.x, e.y, '#ff5533');
        return;
    }
    game._remnantsPingTime = Date.now();
    for (const e of enemies) addPing(e.x, e.y, '#ff5533');
    setBanner('Enemy remnants located - finish them off!', 5, '#ff8866');
}

// If the player is broke with no income, point them back at the oil
function updateLowFundsHint() {
    if (game.tick % 300 !== 0 || game.tick < 3600) return;
    const player = game.players[0];
    if (player.oil >= 150) return;
    const hasIncome = game.buildings.some(b => b.playerId === 0 && b.type === 'derrick' &&
        !b.isUnderConstruction && (b.oilLeft === undefined || b.oilLeft > 0));
    if (hasIncome) return;
    if (Date.now() - (game._lowFundsTime || 0) < 45000) return;
    game._lowFundsTime = Date.now();
    setBanner('Low on funds! Build Oil Derricks on the dark oil patches.', 6, '#cfae3a');
    SoundManager.play('warn');
    if (typeof VoiceManager !== 'undefined') VoiceManager.say('Insufficient funds', 30000);
}

// Roaming scavenger packs keep the wasteland dangerous
function updateScavengers() {
    if (game.tick < 5400) return;          // 90s grace period
    if (game.tick % 120 !== 0) return;
    const neutrals = game.units.filter(u => u.playerId === 2);
    if (neutrals.length > 5) return;
    const chance = { easy: 0.012, normal: 0.022, hard: 0.034 }[gameSettings.difficulty] || 0.022;
    if (Math.random() > chance) return;

    const mapSize = getMapSize();
    // spawn at a random map edge
    const edge = Math.floor(Math.random() * 4);
    let sx = 2 + Math.floor(Math.random() * (mapSize - 4));
    let sy = 2 + Math.floor(Math.random() * (mapSize - 4));
    if (edge === 0) sy = 2; else if (edge === 1) sy = mapSize - 3;
    else if (edge === 2) sx = 2; else sx = mapSize - 3;
    const start = findValidSpawnPosition(sx, sy, 6);

    // raid target: a random building of either side
    const targets = game.buildings.filter(b => b.playerId !== 2);
    if (targets.length === 0) return;
    const target = targets[Math.floor(Math.random() * targets.length)];

    const pack = ['bike', 'trooper', 'trooper', 'buggy'];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
        const role = pack[Math.floor(Math.random() * pack.length)];
        const u = spawnUnit(role, 2, start.x + 0.5 + (i % 3), start.y + 0.5 + Math.floor(i / 3));
        if (u) issueMove(u, target.x + (Math.random() - 0.5) * 4, target.y + (Math.random() - 0.5) * 4, true);
    }
    setBanner('Scavengers spotted in the wasteland!', 4, '#cfae3a');
    SoundManager.play('warn');
    if (typeof VoiceManager !== 'undefined') VoiceManager.say('Scavengers detected');
    addPing(start.x, start.y, '#cfae3a');
}

function updateResources() {
    // Derricks pump funds directly from their oil patch.
    // Each finished power station boosts every derrick's output.
    const stationCounts = game.players.map(p =>
        game.buildings.filter(b => b.playerId === p.id && b.type === 'powerStation' && !b.isUnderConstruction).length);

    for (const building of game.buildings) {
        if (building.type === 'derrick' && !building.isUnderConstruction) {
            const type = BUILDING_TYPES.derrick;
            const player = game.players[building.playerId];

            // Bind the derrick to its oil tile once
            if (building.oilLeft === undefined) {
                // bind to the richest live oil tile under the footprint
                const r = footprintRect(building.type, building.tx, building.ty);
                let tile = null;
                for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
                    const t = game.map[y]?.[x];
                    if (t && t.oil && (t.oilAmount ?? 1) > 0 && (!tile || (t.oilAmount ?? 0) > (tile.oilAmount ?? 0))) {
                        tile = t;
                        building.oilTileXY = { x, y };
                    }
                }
                building.oilTile = tile;
                building.oilLeft = building.oilTile ? (building.oilTile.oilAmount ?? 30000) : 0;
                building.oilStart = Math.max(1, building.oilLeft);
            }

            if (building.oilLeft > 0) {
                const psType = BUILDING_TYPES.powerStation;
                const boost = 1 + Math.min(stationCounts[building.playerId], psType.maxBoostCount) * psType.incomeBoost;
                const pumped = Math.min((type.pumpRate * boost) / 60, building.oilLeft);
                building.oilLeft -= pumped;
                player.oil = Math.min(50000, player.oil + pumped);
                if (building.playerId === 0) game.stats.oilEarned += pumped;
                if (building.oilTile) {
                    building.oilTile.oilAmount = Math.max(0, building.oilLeft);
                    // Patch ran dry: update the cached terrain and warn the owner
                    if (building.oilLeft <= 0) {
                        if (building.oilTileXY) Terrain.repaintOil(building.oilTileXY.x, building.oilTileXY.y);
                        if (building.playerId === 0) {
                            setBanner('An oil patch has run dry - expand to a new field!', 5, '#cfae3a');
                            SoundManager.play('warn');
                            if (typeof VoiceManager !== 'undefined') VoiceManager.say('Oil field depleted');
                            addPing(building.x, building.y, '#cfae3a');
                        }
                    }
                }
            }
        }
    }
}

// ============================================
// HUD + SIDEBAR
// The build sidebar is always available (no need to find and click a
// barracks first): tabs for structures, infantry, vehicles and
// research. Unit orders go to the least busy producer automatically.
// DOM is built once per tab/faction and then only patched in place,
// so hover states and clicks are never lost to a rebuild.
// ============================================

const SIDEBAR_TABS = [
    { id: 'build', label: 'Base' },
    { id: 'infantry', label: 'Infantry' },
    { id: 'vehicles', label: 'Vehicles' },
    { id: 'tech', label: 'Research' }
];
const SIDEBAR_HOTKEYS = ['w', 'e', 'r', 't', 'd', 'f', 'g', 'c', 'v'];
let sidebarTab = 'build';
let sidebarButtons = [];   // [{ el, kind, role, ... }]
let sidebarBuiltKey = '';

function hasBuilding(playerId, role) {
    return game.buildings.some(b => b.playerId === playerId && b.type === role && !b.isUnderConstruction);
}

function buildingRequirementsMet(playerId, role) {
    const reqs = BUILDING_REQUIRES[role] || [];
    return reqs.every(r => hasBuilding(playerId, r));
}

function producersFor(playerId, role) {
    return game.buildings.filter(b => b.playerId === playerId && !b.isUnderConstruction &&
        BUILDING_TYPES[b.type].produces.includes(role));
}

function totalQueued(playerId) {
    return game.buildings.reduce((n, b) => n + (b.playerId === playerId ? b.productionQueue.length : 0), 0);
}

// Queue a unit at the best producer (selected one first, else shortest queue)
function orderUnit(role) {
    const player = game.players[0];
    const uType = UNIT_TYPES[role];
    const producers = producersFor(0, role);
    const faction = player.faction;
    if (producers.length === 0) {
        const need = role === 'trooper' || role === 'flamer' || role === 'rocketeer' ? 'barracks' : 'factory';
        setBanner(`Build a ${buildingDisplayName(need, faction)} first`, 2.5, '#ff8866');
        SoundManager.play('denied');
        return false;
    }
    if (player.techLevel < uType.tech) {
        setBanner(`Requires Tech Level ${uType.tech} (Research tab)`, 2.5, '#cc88ff');
        SoundManager.play('denied');
        return false;
    }
    if (player.oil < uType.cost) {
        setBanner('Not enough oil', 2, '#ff8866');
        SoundManager.play('denied');
        return false;
    }
    const selected = producers.find(b => game.selection.includes(b) && b.productionQueue.length < 10);
    const best = selected || producers.filter(b => b.productionQueue.length < 10)
        .sort((a, b) => a.productionQueue.length - b.productionQueue.length)[0];
    if (!best) {
        setBanner('Production queues are full', 2, '#ff8866');
        SoundManager.play('denied');
        return false;
    }
    player.oil -= uType.cost;
    addToProductionQueue(best, role);
    SoundManager.play('ui_click');
    return true;
}

// Cancel the most recently queued unit of a role (full refund)
function cancelUnit(role) {
    let best = null, bestIdx = -1;
    for (const b of producersFor(0, role)) {
        for (let qi = b.productionQueue.length - 1; qi >= 0; qi--) {
            if (b.productionQueue[qi].type === role) {
                if (!best || qi > bestIdx) { best = b; bestIdx = qi; }
                break;
            }
        }
    }
    if (!best) { SoundManager.play('denied'); return; }
    best.productionQueue.splice(bestIdx, 1);
    if (bestIdx === 0) best.produceProgress = 0;
    game.players[0].oil += UNIT_TYPES[role].cost;
    SoundManager.play('ui_click');
}

function startResearch() {
    const player = game.players[0];
    const next = player.techLevel + 1;
    const upgrade = TECH_UPGRADES[next];
    if (!upgrade) return;
    const labs = game.buildings.filter(b => b.playerId === 0 && b.type === 'researchLab' && !b.isUnderConstruction);
    if (labs.length === 0) {
        setBanner(`Build a ${buildingDisplayName('researchLab', player.faction)} first`, 2.5, '#cc88ff');
        SoundManager.play('denied');
        return;
    }
    if (labs.some(l => l.researching)) return;
    if (player.oil < upgrade.cost) {
        setBanner('Not enough oil', 2, '#ff8866');
        SoundManager.play('denied');
        return;
    }
    player.oil -= upgrade.cost;
    labs[0].researching = { level: next, progress: 0, time: upgrade.time };
    SoundManager.play('ui_click');
}

function selectBuildingRole(role) {
    const player = game.players[0];
    const type = BUILDING_TYPES[role];
    if (player.techLevel < type.tech) {
        setBanner(`Requires Tech Level ${type.tech}`, 2.5, '#cc88ff');
        SoundManager.play('denied');
        return;
    }
    if (!buildingRequirementsMet(0, role)) {
        const missing = (BUILDING_REQUIRES[role] || []).filter(r => !hasBuilding(0, r))
            .map(r => buildingDisplayName(r, player.faction)).join(', ');
        setBanner(`Requires: ${missing}`, 2.5, '#ff8866');
        SoundManager.play('denied');
        return;
    }
    if (player.oil < type.cost) {
        setBanner('Not enough oil', 2, '#ff8866');
        SoundManager.play('denied');
        return;
    }
    game.placingBuilding = game.placingBuilding === role ? null : role;
    game.attackMoveMode = false;
    SoundManager.play('ui_click');
    updateCursorEmoji();
}

function setSidebarTab(id) {
    if (sidebarTab === id) return;
    sidebarTab = id;
    sidebarBuiltKey = '';
    hideTooltip();
}

function cycleSidebarTab(dir) {
    const i = SIDEBAR_TABS.findIndex(t => t.id === sidebarTab);
    setSidebarTab(SIDEBAR_TABS[(i + dir + SIDEBAR_TABS.length) % SIDEBAR_TABS.length].id);
    updateBuildMenu();
}

function sidebarHotkey(k) {
    const idx = SIDEBAR_HOTKEYS.indexOf(k);
    if (idx < 0 || !sidebarButtons[idx]) return false;
    sidebarButtons[idx].activate();
    return true;
}

// strong/weak summary from the weapon table
function counterSummary(role) {
    const w = WEAPON_VS[WEAPON_CLASS[role] || 'mg'];
    const names = { infantry: 'infantry', armor: 'vehicles', building: 'buildings' };
    const strong = Object.keys(w).filter(k => w[k] >= 1.2).map(k => names[k]);
    const weak = Object.keys(w).filter(k => w[k] <= 0.6).map(k => names[k]);
    return { strong, weak };
}

function unitStatsLine(role) {
    const u = UNIT_TYPES[role];
    const { strong, weak } = counterSummary(role);
    let s = `Damage ${u.damage} · Range ${(u.range / 24).toFixed(1)} · Speed ${(u.speed * 60).toFixed(1)} · HP ${u.hp}`;
    if (strong.length) s += `\n<span class="tt-good">Strong vs ${strong.join(', ')}</span>`;
    if (weak.length) s += `\n<span class="tt-bad">Weak vs ${weak.join(', ')}</span>`;
    if (u.overWalls) s += '\nFires over rock walls';
    return s;
}

function buildSidebar() {
    const menu = document.getElementById('buildMenu');
    const tabs = document.getElementById('buildTabs');
    if (!menu || !tabs) return;
    const player = game.players[0];
    const faction = player.faction;
    sidebarButtons = [];
    menu.innerHTML = '';

    tabs.innerHTML = '';
    for (const t of SIDEBAR_TABS) {
        const el = document.createElement('button');
        el.className = 'build-tab' + (t.id === sidebarTab ? ' active' : '');
        el.dataset.tab = t.id;
        el.innerHTML = `<span>${t.label}</span><i class="tab-badge"></i>`;
        el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            setSidebarTab(t.id);
            updateBuildMenu();
            SoundManager.play('ui_click');
        });
        tabs.appendChild(el);
    }

    const add = (spec) => {
        const btn = document.createElement('button');
        btn.className = 'build-btn';
        const hk = SIDEBAR_HOTKEYS[sidebarButtons.length];
        btn.innerHTML =
            `<span class="bb-icon"><img src="${spec.icon}" alt=""></span>` +
            `<span class="build-btn-label">${spec.name}</span>` +
            `<span class="build-btn-cost">${spec.cost}</span>` +
            (hk ? `<kbd class="bb-key">${hk.toUpperCase()}</kbd>` : '') +
            `<i class="bb-count"></i><i class="bb-lock"></i><i class="bb-progress"></i>`;
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button === 2) { if (spec.cancel) spec.cancel(); return; }
            if (e.button !== 0) return;
            spec.activate();
            updateBuildMenu(true);
        });
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        btn.addEventListener('mouseenter', () => showTooltip(btn, spec.name, spec.cost, spec.statsFn ? spec.statsFn() : '', spec.desc, spec.statusFn));
        btn.addEventListener('mouseleave', hideTooltip);
        menu.appendChild(btn);
        sidebarButtons.push(Object.assign(spec, { el: btn }));
    };

    if (sidebarTab === 'build') {
        for (const role of BUILD_ORDER) {
            const type = BUILDING_TYPES[role];
            add({
                kind: 'building', role,
                name: buildingDisplayName(role, faction),
                cost: type.cost,
                icon: IsoSprites.icon('building', role, faction),
                desc: BUILDING_DESC[role],
                statsFn: () => type.range ? `Damage ${type.damage} · Range ${(type.range / 24).toFixed(1)} · HP ${type.hp}` : `HP ${type.hp}`,
                activate: () => selectBuildingRole(role)
            });
        }
    } else if (sidebarTab === 'infantry' || sidebarTab === 'vehicles') {
        const roles = BUILDING_TYPES[sidebarTab === 'infantry' ? 'barracks' : 'factory'].produces;
        for (const role of roles) {
            add({
                kind: 'unit', role,
                name: unitDisplayName(role, faction),
                cost: UNIT_TYPES[role].cost,
                icon: IsoSprites.icon('unit', role, faction),
                desc: UNIT_DESC[role],
                statsFn: () => unitStatsLine(role) + '\n<span class="tt-hint">Right-click: cancel one (refund)</span>',
                activate: () => orderUnit(role),
                cancel: () => cancelUnit(role)
            });
        }
    } else {
        for (const level of [2, 3]) {
            const up = TECH_UPGRADES[level];
            add({
                kind: 'tech', level,
                name: up.label,
                cost: up.cost,
                icon: IsoSprites.icon('building', 'researchLab', faction),
                desc: `Unlocks: ${up.unlocks}`,
                activate: () => {
                    if (game.players[0].techLevel + 1 === level) startResearch();
                    else SoundManager.play('denied');
                }
            });
        }
    }
}

function updateBuildMenu(force = false) {
    const player = game.players[0];
    const key = `${sidebarTab}|${player.faction}`;
    if (key !== sidebarBuiltKey) {
        sidebarBuiltKey = key;
        buildSidebar();
    } else if (!force && game.tick % 6 !== 0) {
        return;
    }

    // tab badges: units in production per tab
    const queued = { infantry: 0, vehicles: 0 };
    for (const b of game.buildings) {
        if (b.playerId !== 0) continue;
        for (const q of b.productionQueue) {
            if (UNIT_TYPES[q.type].category === 'infantry') queued.infantry++; else queued.vehicles++;
        }
    }
    const researching = game.buildings.find(b => b.playerId === 0 && b.researching);
    document.querySelectorAll('#buildTabs .build-tab').forEach(el => {
        const t = el.dataset.tab;
        el.classList.toggle('active', t === sidebarTab);
        const badge = el.querySelector('.tab-badge');
        const n = t === 'tech' ? (researching ? '…' : '') : (queued[t] || '');
        badge.textContent = n;
        badge.style.display = n ? '' : 'none';
    });

    for (const spec of sidebarButtons) {
        const el = spec.el;
        let locked = '', affordable = true, progress = -1, count = 0, active = false, done = false;
        if (spec.kind === 'building') {
            const type = BUILDING_TYPES[spec.role];
            if (player.techLevel < type.tech) locked = `Tech ${type.tech}`;
            else if (!buildingRequirementsMet(0, spec.role)) {
                locked = (BUILDING_REQUIRES[spec.role] || []).filter(r => !hasBuilding(0, r))
                    .map(r => buildingDisplayName(r, player.faction)).join(', ');
            }
            affordable = player.oil >= type.cost;
            active = game.placingBuilding === spec.role;
        } else if (spec.kind === 'unit') {
            const u = UNIT_TYPES[spec.role];
            const producers = producersFor(0, spec.role);
            if (producers.length === 0) {
                locked = buildingDisplayName(u.category === 'infantry' ? 'barracks' : 'factory', player.faction);
            } else if (player.techLevel < u.tech) locked = `Tech ${u.tech}`;
            affordable = player.oil >= u.cost;
            for (const b of producers) {
                for (const q of b.productionQueue) if (q.type === spec.role) count++;
                if (b.productionQueue[0] && b.productionQueue[0].type === spec.role) {
                    progress = Math.max(progress, b.produceProgress / Math.max(1, b.produceTime));
                }
            }
        } else if (spec.kind === 'tech') {
            const lvl = spec.level;
            if (player.techLevel >= lvl) done = true;
            else if (!hasBuilding(0, 'researchLab')) locked = buildingDisplayName('researchLab', player.faction);
            else if (player.techLevel + 1 < lvl) locked = `Tech ${lvl - 1}`;
            affordable = player.oil >= TECH_UPGRADES[lvl].cost;
            if (researching && researching.researching.level === lvl) {
                progress = researching.researching.progress / researching.researching.time;
            }
        }
        el.classList.toggle('locked', !!locked);
        el.classList.toggle('poor', !locked && !affordable && !done);
        el.classList.toggle('active', active);
        el.classList.toggle('done', done);
        el.classList.toggle('working', progress >= 0);
        el.querySelector('.bb-lock').textContent = locked ? locked : '';
        const c = el.querySelector('.bb-count');
        c.textContent = count > 0 ? count : '';
        c.style.display = count > 0 ? '' : 'none';
        el.style.setProperty('--p', progress >= 0 ? progress.toFixed(3) : 0);
        if (done) el.querySelector('.build-btn-cost').textContent = 'DONE';
    }
}

// ---- Rich hover tooltip for sidebar buttons ----
let tooltipEl = null;

function showTooltip(btn, name, cost, statsLine, desc) {
    if (document.body.classList.contains('touch-device')) return;
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'game-tooltip';
        document.body.appendChild(tooltipEl);
    }
    let html = `<div class="tt-title">${name}` +
        (cost !== undefined && cost !== '' ? ` <span class="tt-cost">${cost}</span>` : '') + `</div>`;
    if (desc) html += `<div class="tt-desc">${desc}</div>`;
    const lock = btn.querySelector('.bb-lock')?.textContent;
    if (lock) html += `<div class="tt-bad">Requires: ${lock}</div>`;
    if (statsLine) html += `<div class="tt-stats">${statsLine.replace(/\n/g, '<br>')}</div>`;
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    const rect = btn.getBoundingClientRect();
    const ttw = 250;
    tooltipEl.style.width = ttw + 'px';
    tooltipEl.style.left = Math.max(8, rect.left - ttw - 12) + 'px';
    const h = tooltipEl.offsetHeight;
    tooltipEl.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, rect.top - 4)) + 'px';
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
}

// ---- Selection panel ----
let selPanelKey = '';

function hpColor(p) {
    return p > 0.6 ? '#4ee06a' : p > 0.3 ? '#ffc93a' : '#ff4a4a';
}

function renderSelectionPanel() {
    const infoEl = document.getElementById('selectionInfo');
    if (!infoEl) return;
    const sel = game.selection;
    const key = sel.map(s => s.id).join(',') + '|' + (sel.length === 1 ? (sel[0].productionQueue || []).map(q => q.type).join('.') +
        (sel[0].researching ? 'R' : '') + veterancyRank(sel[0].kills) : '');
    const rebuild = key !== selPanelKey;
    selPanelKey = key;
    const faction0 = game.players[0].faction;

    if (sel.length === 0) {
        if (rebuild) infoEl.innerHTML = `<div class="sel-empty">Nothing selected<small>Drag a box to select units · Q = idle army · F1 = controls</small></div>`;
        document.getElementById('commandBar')?.classList.add('dim');
        return;
    }
    const hasUnits = sel.some(s => UNIT_TYPES[s.type] && s.playerId === 0);
    document.getElementById('commandBar')?.classList.toggle('dim', !hasUnits);

    if (sel.length === 1) {
        const e = sel[0];
        const isUnit = !!UNIT_TYPES[e.type];
        const type = UNIT_TYPES[e.type] || BUILDING_TYPES[e.type];
        const faction = getFaction(e.playerId);
        const own = e.playerId === 0;
        const hp = Math.max(0, e.hp / type.hp);
        if (rebuild && own && !isUnit) {
            // jump the sidebar to what this building makes
            const tab = { barracks: 'infantry', factory: 'vehicles', researchLab: 'tech' }[e.type];
            if (tab) { setSidebarTab(tab); updateBuildMenu(true); }
        }
        if (rebuild) {
            const name = isUnit ? unitDisplayName(e.type, faction) : buildingDisplayName(e.type, faction);
            const icon = IsoSprites.icon(isUnit ? 'unit' : 'building', e.type, faction, e.playerId);
            let extra = '';
            if (isUnit) {
                const { strong, weak } = counterSummary(e.type);
                extra += `<div class="sel-stats">DMG ${type.damage} · RNG ${(type.range / 24).toFixed(1)} · SPD ${(type.speed * 60).toFixed(1)}</div>`;
                if (strong.length) extra += `<div class="sel-good">▲ ${strong.join(', ')}</div>`;
                if (weak.length) extra += `<div class="sel-bad">▼ ${weak.join(', ')}</div>`;
                const rank = veterancyRank(e.kills);
                if (rank > 0) extra += `<div class="sel-vet">${'★'.repeat(rank)} Veteran · +${rank * 15}% dmg</div>`;
            } else if (own) {
                if (e.isUnderConstruction) extra += `<div class="sel-stats" data-live="build"></div>`;
                if (e.type === 'derrick') extra += `<div class="sel-good" data-live="derrick"></div>`;
                if (type.incomeBoost) extra += `<div class="sel-stats">+${Math.round(type.incomeBoost * 100)}% output for all derricks</div>`;
                if (type.repairRate) extra += `<div class="sel-stats">Repairs vehicles nearby</div>`;
                if (type.damage) extra += `<div class="sel-stats">DMG ${type.damage} · RNG ${(type.range / 24).toFixed(1)}</div>`;
                if (e.researching) extra += `<div class="sel-tech" data-live="research"></div>`;
                if (e.productionQueue && e.productionQueue.length > 0) {
                    extra += `<div class="sel-queue">` + e.productionQueue.map((q, qi) =>
                        `<span class="sel-qi${qi === 0 ? ' first' : ''}" data-q="${qi}" title="Click to cancel"><img src="${IsoSprites.icon('unit', q.type, faction)}"></span>`).join('') + `</div>`;
                }
                if (type.produces.length > 0) extra += `<div class="sel-hint">Right-click the map to set a rally point</div>`;
            }
            infoEl.innerHTML =
                `<div class="sel-single${own ? '' : ' hostile'}">` +
                `<div class="sel-portrait"><img src="${icon}"></div>` +
                `<div class="sel-body"><div class="sel-name">${name}${own ? '' : ' <em>enemy</em>'}</div>` +
                `<div class="sel-hp"><i></i></div><div class="sel-hptext"></div>${extra}</div></div>`;
            infoEl.querySelectorAll('.sel-qi').forEach(q => q.addEventListener('mousedown', (ev) => {
                ev.stopPropagation();
                const qi = +q.dataset.q;
                const item = e.productionQueue[qi];
                if (!item) return;
                e.productionQueue.splice(qi, 1);
                if (qi === 0) e.produceProgress = 0;
                game.players[0].oil += UNIT_TYPES[item.type].cost;
                SoundManager.play('ui_click');
            }));
        }
        const bar = infoEl.querySelector('.sel-hp i');
        if (bar) { bar.style.width = (hp * 100).toFixed(1) + '%'; bar.style.background = hpColor(hp); }
        const ht = infoEl.querySelector('.sel-hptext');
        if (ht) ht.textContent = e.isUnderConstruction ? 'Under construction' : `${Math.ceil(e.hp)} / ${type.hp}`;
        const live = (k) => infoEl.querySelector(`[data-live="${k}"]`);
        if (live('build')) live('build').textContent = `Building… ${Math.round(e.buildProgress / e.buildTime * 100)}%`;
        if (live('research') && e.researching) live('research').textContent = `Researching Tech ${e.researching.level}… ${Math.round(e.researching.progress / e.researching.time * 100)}%`;
        if (live('derrick')) {
            const psType = BUILDING_TYPES.powerStation;
            const stations = game.buildings.filter(b => b.playerId === 0 && b.type === 'powerStation' && !b.isUnderConstruction).length;
            const boost = 1 + Math.min(stations, psType.maxBoostCount) * psType.incomeBoost;
            const rate = e.oilLeft > 0 ? (BUILDING_TYPES.derrick.pumpRate * boost).toFixed(1) : '0';
            live('derrick').textContent = `+${rate} oil/s · reserves ${e.oilLeft !== undefined ? Math.floor(e.oilLeft) : '?'}`;
        }
        const first = infoEl.querySelector('.sel-qi.first');
        if (first && e.productionQueue && e.productionQueue.length) {
            first.style.setProperty('--p', (e.produceProgress / Math.max(1, e.produceTime)).toFixed(3));
        }
        return;
    }

    // Multi-selection: a portrait per unit, click to narrow down
    if (rebuild) {
        const shown = sel.slice(0, 24);
        infoEl.innerHTML = `<div class="sel-multi-head">${sel.length} units selected</div><div class="sel-grid">` +
            shown.map((u, i) => `<span class="sel-cell" data-i="${i}" title="${unitDisplayName(u.type, faction0)}"><img src="${IsoSprites.icon('unit', u.type, getFaction(u.playerId))}"><i></i></span>`).join('') +
            (sel.length > shown.length ? `<span class="sel-more">+${sel.length - shown.length}</span>` : '') + `</div>`;
        infoEl.querySelectorAll('.sel-cell').forEach(c => c.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
            const u = game.selection[+c.dataset.i];
            if (!u) return;
            if (ev.shiftKey) game.selection = game.selection.filter(s => s !== u);
            else if (ev.ctrlKey || ev.metaKey) game.selection = game.selection.filter(s => s.type === u.type);
            else game.selection = [u];
            SoundManager.play('unit_select');
        }));
    }
    infoEl.querySelectorAll('.sel-cell').forEach(c => {
        const u = game.selection[+c.dataset.i];
        if (!u) return;
        const p = Math.max(0, u.hp / UNIT_TYPES[u.type].hp);
        const bar = c.querySelector('i');
        bar.style.width = (p * 100) + '%';
        bar.style.background = hpColor(p);
    });
}

let _oilHistory = [];

function updateUI() {
    if (game.tick % 3 !== 0) return;
    const player = game.players[0];
    const oilEl = document.getElementById('oil');
    if (!oilEl) return;
    oilEl.textContent = Math.floor(player.oil);

    // income readout: sliding window over derrick output
    const psType = BUILDING_TYPES.powerStation;
    const stations = game.buildings.filter(b => b.playerId === 0 && b.type === 'powerStation' && !b.isUnderConstruction).length;
    const boost = 1 + Math.min(stations, psType.maxBoostCount) * psType.incomeBoost;
    const pumping = game.buildings.filter(b => b.playerId === 0 && b.type === 'derrick' && !b.isUnderConstruction &&
        (b.oilLeft === undefined || b.oilLeft > 0)).length;
    const rate = pumping * BUILDING_TYPES.derrick.pumpRate * boost;
    const rateEl = document.getElementById('oilRate');
    if (rateEl) {
        rateEl.textContent = `+${rate.toFixed(0)}/s`;
        rateEl.classList.toggle('zero', rate === 0);
    }

    const techEl = document.getElementById('techLevel');
    if (techEl) techEl.textContent = player.techLevel;
    const tp = document.getElementById('techProgress');
    const researching = game.buildings.find(b => b.playerId === 0 && b.researching);
    if (tp) tp.textContent = researching ? `${Math.round(researching.researching.progress / researching.researching.time * 100)}%` : '';

    const unitsEl = document.getElementById('playerUnits');
    const mine = game.units.filter(u => u.playerId === 0).length;
    if (unitsEl) {
        unitsEl.textContent = `${mine}/${unitCapFor(0)}`;
        unitsEl.parentElement.classList.toggle('capped', mine >= unitCapFor(0));
    }

    renderSelectionPanel();
    updateBuildMenu();
    updateContextHint();
}

// Footer: always tells you what your mouse buttons will do right now
function updateContextHint() {
    const el = document.getElementById('controlsHelp');
    if (!el) return;
    let html;
    const units = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
    if (game.placingBuilding) {
        html = '<b>Left-click</b> place structure · <b>Shift</b> place several · <b>Right-click / Esc</b> cancel';
    } else if (game.attackMoveMode) {
        html = '<b>Left-click</b> attack-move there (engage everything on the way) · <b>Right-click / Esc</b> cancel';
    } else if (units.length > 0) {
        html = '<b>Right-click</b> move / attack · <b>Shift+Right-click</b> queue waypoint · <b>A</b> attack-move · <b>S</b> stop · <b>Ctrl+1-9</b> group';
    } else if (game.selection.length === 1 && game.selection[0].playerId === 0 && BUILDING_TYPES[game.selection[0].type]?.produces.length) {
        html = '<b>Right-click</b> set rally point · train units from the sidebar';
    } else {
        html = '<b>Drag</b> select · <b>Double-click</b> all of a type · <b>Wheel</b> zoom · <b>Arrows/edge/middle-drag</b> scroll · <b>F1</b> all controls';
    }
    if (el._html !== html) { el._html = html; el.innerHTML = html; }
}


// ============================================
// HELPER FUNCTIONS
// ============================================

function spawnUnit(type, playerId, x, y) {
    const unitType = UNIT_TYPES[type];
    if (!unitType) return null;
    const newUnit = {
        id: game.nextId = (game.nextId || 0) + 1,
        type,
        playerId,
        x, y,
        hp: unitType.hp,
        angle: 0,
        lastAttack: 0,
        kills: 0
    };
    game.units.push(newUnit);
    return newUnit;
}

// ============================================
// BUILDING FOOTPRINTS
// A building of size s covers an s x s block of tiles. Its tile anchor
// (tx, ty) is the tile under the cursor when placed; the footprint is
// tiles [tx - floor(s/2), tx - floor(s/2) + s - 1]. building.x/y hold
// the true center of that block, so sprites, collision, targeting and
// selection all agree on where the building is.
// ============================================

function footprintRect(role, tx, ty) {
    const s = BUILDING_TYPES[role]?.size || 1;
    const x0 = tx - Math.floor(s / 2), y0 = ty - Math.floor(s / 2);
    return { x0, y0, x1: x0 + s - 1, y1: y0 + s - 1, cx: x0 + s / 2, cy: y0 + s / 2, s };
}

// Occupancy grid: tiles covered by building footprints are unwalkable
// for pathfinding and movement (counts, so overlaps can't corrupt it).
function blockTilesFor(building, block) {
    const ms = getMapSize();
    if (!game.blockGrid || game.blockGrid.length !== ms * ms) game.blockGrid = new Uint8Array(ms * ms);
    const r = footprintRect(building.type, building.tx, building.ty);
    for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) {
            if (x < 0 || y < 0 || x >= ms || y >= ms) continue;
            const i = y * ms + x;
            game.blockGrid[i] = Math.max(0, game.blockGrid[i] + (block ? 1 : -1));
        }
    }
}

function isTileBlocked(x, y) {
    const ms = getMapSize();
    if (!game.blockGrid || x < 0 || y < 0 || x >= ms || y >= ms) return false;
    return game.blockGrid[(y | 0) * ms + (x | 0)] > 0;
}

function createBuilding(type, playerId, tx, ty, isUnderConstruction = false) {
    const bType = BUILDING_TYPES[type];
    const buildTimes = {
        // Small structures: ~10 seconds (60 ticks/sec)
        derrick: 600,
        tower: 600,
        towerHeavy: 700,
        // Medium structures: ~15 seconds
        barracks: 900,
        researchLab: 900,
        repairBay: 900,
        powerStation: 900,
        // Large structures: ~20 seconds
        factory: 1100,
        hq: 1200
    };
    const r = footprintRect(type, tx, ty);

    const building = {
        id: game.nextId = (game.nextId || 0) + 1,
        type,
        playerId,
        tx, ty,
        x: r.cx, y: r.cy,
        hp: isUnderConstruction ? 1 : bType.hp,
        productionQueue: [],
        produceProgress: 0,
        produceTime: 0,
        buildProgress: isUnderConstruction ? 0 : bType.hp,
        buildTime: buildTimes[type] || 900,
        isUnderConstruction: isUnderConstruction,
        turretAngle: Math.PI / 4
    };

    // Set activation time for turrets even if not under construction
    if (bType.damage && !isUnderConstruction) {
        building.activationTime = game.tick + 180; // 3 second delay
    }

    game.buildings.push(building);
    blockTilesFor(building, true);

    // Units caught under a fresh footprint step out of the way
    for (const u of game.units) {
        if (u.x >= r.x0 - 0.3 && u.x <= r.x1 + 1.3 && u.y >= r.y0 - 0.3 && u.y <= r.y1 + 1.3) {
            u.path = null;
            if (!isWalkable(u.x, u.y)) {
                const p = nearestWalkable(u.x, u.y, 6);
                if (p) { u.x = p.x; u.y = p.y; }
            }
        }
    }
    return building;
}

// Why a placement fails (null = it's fine) - shown under the ghost
function buildBlockReason(buildingType, tx, ty, playerId = 0) {
    const type = BUILDING_TYPES[buildingType];
    if (!type) return 'Unknown structure';
    const mapSize = getMapSize();
    const r = footprintRect(buildingType, tx, ty);
    if (r.x0 < 1 || r.y0 < 1 || r.x1 >= mapSize - 1 || r.y1 >= mapSize - 1) return 'Too close to the map edge';

    // Derricks MUST sit on a live oil patch; nothing else may
    if (type.needsOil) {
        let oil = false;
        for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
            const t = game.map[y]?.[x];
            if (t && t.oil && (t.oilAmount === undefined || t.oilAmount > 0)) oil = true;
        }
        if (!oil) return 'Must be placed on an oil patch';
        if (game.buildings.some(b => b.type === 'derrick' &&
            Math.abs(b.x - r.cx) < 2 && Math.abs(b.y - r.cy) < 2)) return 'Patch already tapped';
    }

    for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) {
            const tile = game.map[y]?.[x];
            if (!tile || tile.type === 'water' || tile.type === 'hill') return 'Ground is not buildable';
            if (!type.needsOil && tile.oil && (tile.oilAmount === undefined || tile.oilAmount > 0)) {
                return 'Keep oil patches free for derricks';
            }
            if (playerId === 0 && tileFog(x, y) === 0) return 'Unexplored ground';
        }
    }

    // Keep clear of tech bunkers
    if (game.bunkers && game.bunkers.some(b =>
        b.x > r.x0 - 1.5 && b.x < r.x1 + 2.5 && b.y > r.y0 - 1.5 && b.y < r.y1 + 2.5)) {
        return 'Too close to a tech bunker';
    }

    // Footprints keep a one-tile lane between them so units never get
    // walled in (towers may stand shoulder to shoulder)
    for (const building of game.buildings) {
        const o = footprintRect(building.type, building.tx, building.ty);
        const gap = (type.size === 1 && BUILDING_TYPES[building.type].size === 1) ? 0 : 1;
        if (r.x0 <= o.x1 + gap && r.x1 >= o.x0 - gap && r.y0 <= o.y1 + gap && r.y1 >= o.y0 - gap) {
            return 'Blocked by another structure';
        }
    }

    if (!type.needsOil && !nearOwnBase(playerId, r.cx, r.cy, 10)) return 'Too far from your base';

    // Can't drop a structure on top of units
    for (const u of game.units) {
        if (u.x >= r.x0 && u.x < r.x1 + 1 && u.y >= r.y0 && u.y < r.y1 + 1) {
            return 'Units in the way';
        }
    }
    return null;
}

function canBuildAt(buildingType, x, y, playerId = 0) {
    return buildBlockReason(buildingType, x, y, playerId) === null;
}

// Build radius: new structures must be placed near your own base
function nearOwnBase(playerId, tx, ty, radius = 9) {
    return game.buildings.some(b => b.playerId === playerId &&
        Math.hypot(b.x - tx, b.y - ty) <= radius + BUILDING_TYPES[b.type].size / 2);
}

// Exit point for a freshly produced unit: a free tile around the
// footprint, preferring the side facing the rally point (or the camera)
function productionExit(building) {
    const r = footprintRect(building.type, building.tx, building.ty);
    const wantX = building.rallyX ?? (r.x1 + 3), wantY = building.rallyY ?? (r.y1 + 3);
    let best = null, bestD = Infinity;
    for (let ring = 1; ring <= 4 && !best; ring++) {
        for (let y = r.y0 - ring; y <= r.y1 + ring; y++) {
            for (let x = r.x0 - ring; x <= r.x1 + ring; x++) {
                if (x > r.x0 - ring && x < r.x1 + ring && y > r.y0 - ring && y < r.y1 + ring) continue;
                if (!isTileWalkable(x, y)) continue;
                const crowd = game.units.filter(u => Math.abs(u.x - x - 0.5) < 0.6 && Math.abs(u.y - y - 0.5) < 0.6).length;
                const d = Math.hypot(x + 0.5 - wantX, y + 0.5 - wantY) + crowd * 2;
                if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
            }
        }
    }
    return best || nearestWalkable(building.x, building.y, 8) || { x: building.x, y: building.y + r.s };
}

function addToProductionQueue(building, unitType) {
    // Max 10 units in queue
    if (building.productionQueue.length >= 10) {
        return false;
    }

    const uType = UNIT_TYPES[unitType];
    building.productionQueue.push({
        type: unitType,
        time: (uType && uType.buildTime) || 120
    });

    return true;
}

function fireProjectile(source, target, customDamage) {
    const type = UNIT_TYPES[source.type] || BUILDING_TYPES[source.type];
    let damage = customDamage || type.damage;

    // Veterancy: experienced units hit harder and more often
    const rank = veterancyRank(source.kills);
    if (rank > 0) damage = Math.round(damage * (1 + rank * VETERANCY_DAMAGE_BONUS));

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const ang = Math.atan2(dy, dx);

    // Weapon class + faction drive the shot's look and sound
    const weapon = WEAPON_CLASS[source.type] || 'mg';
    const bal = WEAPON_BALLISTICS[weapon] || WEAPON_BALLISTICS.mg;
    const faction = getFaction(source.playerId);

    // positional firing sound (pan, distance, air absorption in SoundManager)
    const at = { x: source.x, y: source.y };
    const s9 = faction === 'series9';
    if (weapon === 'arty') SoundManager.play('artillery', at);
    else if (weapon === 'cannon') SoundManager.play(s9 ? 'plasma' : 'cannon', at);
    else if (weapon === 'rocket') SoundManager.play('rocket', at);
    else if (weapon === 'flame') SoundManager.play('flame', at);
    else if (weapon === 'hmg') SoundManager.play(s9 ? 'gun_zap' : 'gun_hmg', at);
    else SoundManager.play(s9 ? 'gun_zap' : 'gun_rifle', { ...at, volume: BUILDING_TYPES[source.type] ? 1.1 : 0.9 });

    // Muzzle: in front of the hull (towers fire from their head)
    const isUnit = !!UNIT_TYPES[source.type];
    const muzzle = isUnit ? unitRadius(type) * 1.15 : 0.45;
    const mx = source.x + Math.cos(ang) * muzzle;
    const my = source.y + Math.sin(ang) * muzzle;
    const mz = isUnit ? (type.category === 'infantry' ? 7 : 9 + type.size * 0.3) : (weapon === 'cannon' ? 26 : 22);
    game.particles.push({
        x: mx, y: my, z: mz, vx: 0, vy: 0, vz: 0,
        color: faction === 'series9' ? '#9dffd0' : (weapon === 'flame' ? '#ffb347' : '#ffe08a'),
        size: weapon === 'cannon' || weapon === 'arty' ? 9 : (weapon === 'mg' ? 4 : 6),
        life: 0.25, type: 'muzzle', noGravity: true
    });
    if (weapon === 'cannon' || weapon === 'arty' || weapon === 'rocket') {
        for (let k = 0; k < 4; k++) {
            game.particles.push({
                x: mx, y: my, z: mz,
                vx: Math.cos(ang + (Math.random() - 0.5) * 0.9) * 0.03,
                vy: Math.sin(ang + (Math.random() - 0.5) * 0.9) * 0.03,
                vz: 0.12 + Math.random() * 0.1,
                color: '#b8b0a0', size: 5 + Math.random() * 4,
                life: 0.8, type: 'smoke', noGravity: true
            });
        }
    }
    // recoil kick for the renderer
    source._recoil = 4;

    const base = {
        target, damage, weapon, faction,
        splash: type.splash || 0,
        playerId: source.playerId,
        sourceType: source.type,
        source,
        startX: mx, startY: my, z: mz
    };

    if (weapon === 'arty') {
        // Shell lands where the target is NOW, with some scatter -
        // anything that moves away in time escapes the blast
        const scatter = 0.25 + dist * 0.035;
        const sa = Math.random() * Math.PI * 2, sr = Math.random() * scatter;
        const aimX = target.x + Math.cos(sa) * sr, aimY = target.y + Math.sin(sa) * sr;
        const T = Math.round(60 * (0.9 + dist * 0.07));
        // incoming whistle in the last second of the flight, at the impact point
        SoundManager.play('shell_whistle', { x: aimX, y: aimY, delay: Math.max(0, T / 60 - 1.0) });
        game.projectiles.push(Object.assign(base, {
            arc: true, x: mx, y: my, aimX, aimY, t: 0, T, apex: 26 + dist * 7,
            vx: 0, vy: 0, life: T + 5, progress: 0
        }));
        return;
    }

    // Hit roll: small, fast infantry are hard to hit with rockets and
    // shells; buildings are never missed
    let hitChance = 1;
    if (UNIT_TYPES[target.type]) {
        hitChance = armorClass(target) === 'infantry' ? bal.vsInfantry : bal.accuracy;
        hitChance = Math.min(1, hitChance + rank * 0.04);
    }
    const willHit = Math.random() < hitChance;
    let aimX = target.x, aimY = target.y;
    if (!willHit) {
        // near miss: lands beside the target, mostly past it
        const side = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
        const over = (Math.random() - 0.2) * 0.9;
        aimX = target.x - Math.sin(ang) * side + Math.cos(ang) * over;
        aimY = target.y + Math.cos(ang) * side + Math.sin(ang) * over;
    }
    const speed = bal.speed / 60;
    game.projectiles.push(Object.assign(base, {
        x: mx, y: my, aimX, aimY, willHit, speed,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: Math.ceil(dist / speed) + 40
    }));
}


// Missed round kicking up the dirt


// Flesh hit: a spray of blood droplets (Series 9 bleed dark hydraulic
// oil instead). big=true is the kill burst - more, faster, plus a
// lasting pool on the ground.

// Floating damage numbers: yellow = effective weapon (bonus damage),
// grey = the armor shrugs it off - teaches the counter system by sight
function createDamageNumber(x, y, damage, mult = 1) {
    if (!isVisible(x, y)) return;
    game.damageNumbers.push({
        x, y,
        damage: Math.round(damage),
        life: 1.0,
        offsetY: 0,
        isCritical: mult >= 1.2,
        isWeak: mult <= 0.6,
        driftX: (Math.random() - 0.5) * 0.02
    });
    if (game.damageNumbers.length > 60) game.damageNumbers.shift();
}

function updateDamageNumbers(dt) {
    for (let i = game.damageNumbers.length - 1; i >= 0; i--) {
        const dmg = game.damageNumbers[i];
        dmg.offsetY += 0.6;
        dmg.x += dmg.driftX;
        dmg.life -= 0.022;
        if (dmg.life <= 0) game.damageNumbers.splice(i, 1);
    }
}


function findBuildPosition(nearX, nearY, role) {
    // Search outward from the base, using the same placement rules as the player
    for (let r = 3; r <= 14; r++) {
        for (let angle = Math.random() * 0.3; angle < Math.PI * 2; angle += 0.3) {
            const x = Math.floor(nearX + Math.cos(angle) * r);
            const y = Math.floor(nearY + Math.sin(angle) * r);
            if (canBuildAt(role, x, y, 1)) return { x, y };
        }
    }
    return null;
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ============================================
// INPUT HANDLING
// ============================================

const keys = {};

// ============================================
// INPUT HELPERS: picking, orders, placement, zoom
// ============================================

function selectAllArmy(idleOnly = false) {
    const army = game.units.filter(u => u.playerId === 0 && UNIT_TYPES[u.type].damage > 0 &&
        (!idleOnly || (!u.attackTarget && u.targetX === undefined)));
    if (army.length === 0) return;
    game.selection = army;
    SoundManager.play('unit_select');
    if (idleOnly) setBanner(`${army.length} idle unit${army.length === 1 ? '' : 's'} selected`, 1.5, '#9fd4ff');
}

function isHostileTo(ent, playerId) {
    return ent.playerId !== playerId;
}

function onScreen(ent, margin = 0) {
    const s = worldToScreen(ent.x, ent.y);
    return s.x >= -margin && s.x <= canvas.offsetWidth + margin &&
           s.y >= -margin && s.y <= canvas.offsetHeight + margin;
}

// Screen-space hit test that matches what the player sees: units are
// hit on their sprite (raised above the ground point), buildings on
// their footprint or their body. Scales with zoom. Hidden hostiles
// can't be picked.
function pickEntity(sx, sy, filter) {
    const zoom = getZoom();
    let best = null, bestScore = Infinity;
    for (const u of game.units) {
        if (filter && !filter(u)) continue;
        if (u.playerId !== 0 && !isVisible(u.x, u.y)) continue;
        const t = UNIT_TYPES[u.type];
        const s = worldToScreen(u.x, u.y);
        const h = (t.category === 'infantry' ? 21 : 12 + t.size * 0.75) * zoom;
        const rx = Math.max(10, t.size * 1.2 + 4) * zoom;
        const ry = (h + 8 * zoom) / 2;
        const nx = (sx - s.x) / rx, ny = (sy - (s.y - h / 2)) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1 && d < bestScore) { best = u; bestScore = d; }
    }
    if (best) return best;
    const w = screenToWorld(sx, sy);
    for (const b of game.buildings) {
        if (filter && !filter(b)) continue;
        if (b.playerId !== 0 && tileFog(b.x, b.y) !== 2) continue;
        const bt = BUILDING_TYPES[b.type];
        const half = bt.size / 2;
        let hit = Math.abs(w.x - b.x) <= half && Math.abs(w.y - b.y) <= half;
        if (!hit) {
            const s = worldToScreen(b.x, b.y);
            const bw = bt.size * 28 * zoom, bh = (14 + bt.size * 16) * zoom;
            hit = sx > s.x - bw && sx < s.x + bw && sy > s.y - bh && sy < s.y + 4 * zoom;
        }
        if (hit) {
            const d = Math.hypot(w.x - b.x, w.y - b.y);
            if (d < bestScore) { best = b; bestScore = d; }
        }
    }
    return best;
}

// Assign formation slots so units don't cross each other's paths: each
// slot goes to the closest still-unassigned unit.
function assignFormation(units, cx, cy, spacing) {
    const n = units.length;
    if (n === 0) return [];
    const gx = units.reduce((a, u) => a + u.x, 0) / n;
    const gy = units.reduce((a, u) => a + u.y, 0) / n;
    // rotate the grid so its rows face the direction of travel
    const ang = Math.atan2(cy - gy, cx - gx) + Math.PI / 2;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const slots = formationOffsets(n, spacing).map(o => {
        const x = cx + o.x * cos - o.y * sin;
        const y = cy + o.x * sin + o.y * cos;
        const p = isWalkable(x, y) ? { x, y } : (nearestWalkable(x, y, 4) || { x: cx, y: cy });
        return p;
    });
    const free = units.slice();
    const result = new Map();
    // far slots first: the front row gets filled by whoever is nearest
    slots.sort((a, b) => Math.hypot(b.x - gx, b.y - gy) - Math.hypot(a.x - gx, a.y - gy));
    for (const slot of slots) {
        let bi = 0, bd = Infinity;
        for (let i = 0; i < free.length; i++) {
            const d = Math.hypot(free[i].x - slot.x, free[i].y - slot.y);
            if (d < bd) { bd = d; bi = i; }
        }
        result.set(free[bi], slot);
        free.splice(bi, 1);
    }
    return result;
}

// Right-click / attack-move click with the current selection.
// enemy = hostile entity under the cursor (attack it), else move.
// queue = Shift held: append as a waypoint instead of replacing orders.
function commandSelection(wx, wy, enemy, attackMove, queue = false) {
    const movers = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);

    // A lone production building: right-click sets its rally point
    if (movers.length === 0) {
        const b = game.selection.length === 1 ? game.selection[0] : null;
        if (b && b.playerId === 0 && BUILDING_TYPES[b.type] && BUILDING_TYPES[b.type].produces.length > 0) {
            const p = nearestWalkable(wx, wy, 6) || { x: wx, y: wy };
            b.rallyX = p.x;
            b.rallyY = p.y;
            addOrderMarker(p.x, p.y, 'rally');
            SoundManager.play('ui_click');
        }
        return;
    }

    if (enemy) {
        for (const u of movers) {
            if (UNIT_TYPES[u.type].damage > 0) issueAttack(u, enemy);
        }
        enemy._targetFlash = 40;
        addOrderMarker(enemy.x, enemy.y, 'attack');
        SoundManager.play('ack_attack');
        if (typeof VoiceManager !== 'undefined') VoiceManager.play('attack', getFaction(0));
        return;
    }

    const ms = getMapSize();
    wx = Math.max(0.5, Math.min(ms - 0.5, wx));
    wy = Math.max(0.5, Math.min(ms - 0.5, wy));
    const big = movers.some(u => UNIT_TYPES[u.type].size >= 15);
    const slots = assignFormation(movers, wx, wy, big ? 1.35 : 1.0);
    for (const u of movers) {
        const slot = slots.get(u) || { x: wx, y: wy };
        if (queue && (u.targetX !== undefined || u.attackTarget)) {
            if (!u.waypoints) u.waypoints = [];
            u.waypoints.push({ x: slot.x, y: slot.y, attackMove });
        } else {
            u.waypoints = [];
            issueMove(u, slot.x, slot.y, attackMove);
            u._leash = null;
            u._explicitTarget = false;
        }
    }
    addOrderMarker(wx, wy, attackMove ? 'attack' : 'move');
    SoundManager.play(attackMove ? 'ack_attack' : 'ack_move');
    if (typeof VoiceManager !== 'undefined') VoiceManager.play(attackMove ? 'attack' : 'move', getFaction(0));
}

function tryPlaceBuilding(sx, sy, keepPlacing) {
    const world = screenToWorld(sx, sy);
    const role = game.placingBuilding;
    const tile = placementTile(role, world.x, world.y);
    const type = BUILDING_TYPES[role];
    const reason = buildBlockReason(role, tile.x, tile.y, 0);
    if (!reason && game.players[0].oil >= type.cost) {
        createBuilding(role, 0, tile.x, tile.y, true);
        game.players[0].oil -= type.cost;
        SoundManager.play('ui_build');
        // Shift keeps the ghost for placing several (towers, derricks)
        if (!keepPlacing || game.players[0].oil < type.cost) game.placingBuilding = null;
    } else {
        SoundManager.play('denied');
        setBanner(reason || 'Not enough oil', 2, '#ff6655');
    }
}

// Tile anchor for a building ghost so the footprint centers on the
// cursor (even sizes snap to the nearest tile corner)
function placementTile(role, wx, wy) {
    const s = BUILDING_TYPES[role]?.size || 1;
    if (s % 2 === 0) return { x: Math.round(wx), y: Math.round(wy) };
    return { x: Math.floor(wx), y: Math.floor(wy) };
}

function zoomAt(sx, sy, newZoom) {
    const before = screenToWorld(sx, sy);
    gameSettings.zoom = Math.max(gameSettings.minZoom, Math.min(gameSettings.maxZoom, newZoom));
    const after = screenToWorld(sx, sy);
    // shift the camera so the world point under the cursor stays put
    game.camera.x += ((before.x - before.y) - (after.x - after.y)) * (TILE_WIDTH / 2);
    game.camera.y += ((before.x + before.y) - (after.x + after.y)) * (TILE_HEIGHT / 2);
}

function centerCameraOn(wx, wy) {
    game.camera.x = (wx - wy) * (TILE_WIDTH / 2);
    game.camera.y = (wx + wy) * (TILE_HEIGHT / 2);
}

// Keep the camera over the map diamond
function clampCamera() {
    const ms = getMapSize();
    game.camera.x = Math.max(-ms * TILE_WIDTH / 2, Math.min(ms * TILE_WIDTH / 2, game.camera.x));
    game.camera.y = Math.max(0, Math.min(ms * TILE_HEIGHT, game.camera.y));
}

// Context cursor: what will a click do here?
const CURSOR_SVG = (() => {
    const mk = (svg) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${svg}</svg>`)}`;
    return {
        attack: mk('<g fill="none" stroke="#000" stroke-width="4" opacity=".55"><circle cx="16" cy="16" r="9"/><path d="M16 2v8M16 22v8M2 16h8M22 16h8"/></g><g fill="none" stroke="#ff4433" stroke-width="2"><circle cx="16" cy="16" r="9"/><path d="M16 2v8M16 22v8M2 16h8M22 16h8"/></g><circle cx="16" cy="16" r="2" fill="#ff4433"/>'),
        amove: mk('<g fill="none" stroke="#000" stroke-width="4" opacity=".55"><circle cx="16" cy="16" r="9"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6"/></g><g fill="none" stroke="#ffaa22" stroke-width="2"><circle cx="16" cy="16" r="9"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6"/></g>'),
        move: mk('<g stroke="#000" stroke-width="3.5" opacity=".5" fill="none"><path d="M16 4v24M4 16h24"/></g><g fill="#5dff7a" stroke="#0b3313" stroke-width="1"><path d="M16 3l4 5h-8zM16 29l4-5h-8zM3 16l5-4v8zM29 16l-5-4v8z"/></g><circle cx="16" cy="16" r="2.5" fill="#5dff7a" stroke="#0b3313"/>'),
        select: mk('<g fill="none" stroke="#000" stroke-width="4" opacity=".5"><path d="M5 11V5h6M21 5h6v6M27 21v6h-6M11 27H5v-6"/></g><g fill="none" stroke="#e8f4ff" stroke-width="2"><path d="M5 11V5h6M21 5h6v6M27 21v6h-6M11 27H5v-6"/></g>'),
        nogo: mk('<circle cx="16" cy="16" r="9" fill="none" stroke="#000" stroke-width="5" opacity=".5"/><circle cx="16" cy="16" r="9" fill="none" stroke="#ff4433" stroke-width="2.5"/><path d="M9.6 22.4L22.4 9.6" stroke="#ff4433" stroke-width="2.5"/>'),
        rally: mk('<path d="M9 29V4" stroke="#000" stroke-width="4" opacity=".5"/><path d="M9 29V4" stroke="#ddd" stroke-width="2"/><path d="M10 4h15l-4 5 4 5H10z" fill="#5dff7a" stroke="#0b3313"/>')
    };
})();

function updateCursorEmoji() {
    if (!canvas) return;
    if (middleMouseDrag) { canvas.style.cursor = 'grabbing'; return; }
    if (game.placingBuilding) { canvas.style.cursor = 'none'; return; }
    const cur = (k) => `url("${CURSOR_SVG[k]}") 16 16, crosshair`;
    const mx = game.mouse.x, my = game.mouse.y;
    const hover = pickEntity(mx, my);
    game.hover = hover;

    if (game.attackMoveMode) { canvas.style.cursor = cur(hover && hover.playerId !== 0 ? 'attack' : 'amove'); return; }

    const movers = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
    if (movers.length > 0) {
        if (hover && hover.playerId !== 0) { canvas.style.cursor = cur('attack'); return; }
        if (hover && hover.playerId === 0) { canvas.style.cursor = cur('select'); return; }
        const w = screenToWorld(mx, my);
        const ms = getMapSize();
        const inside = w.x >= 0 && w.y >= 0 && w.x < ms && w.y < ms;
        const t = inside ? game.map[w.y | 0]?.[w.x | 0] : null;
        const unexplored = inside && tileFog(w.x, w.y) === 0;
        canvas.style.cursor = cur(!inside || (!unexplored && t && (t.type === 'water' || t.type === 'hill')) ? 'nogo' : 'move');
        return;
    }
    const sel = game.selection.length === 1 ? game.selection[0] : null;
    if (sel && sel.playerId === 0 && BUILDING_TYPES[sel.type]?.produces.length > 0 && !(hover && hover.playerId === 0)) {
        canvas.style.cursor = cur('rally');
        return;
    }
    canvas.style.cursor = hover ? cur('select') : 'default';
}

function initializeEventHandlers() {
    if (!canvas) {
        console.error('Cannot initialize event handlers: canvas not found');
        return;
    }

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        game.mouse.x = x; game.mouse.y = y;

        // Middle mouse button - camera drag
        if (e.button === 1) {
            e.preventDefault();
            middleMouseDrag = {
                startX: e.clientX, startY: e.clientY,
                cameraStartX: game.camera.x, cameraStartY: game.camera.y
            };
            canvas.style.cursor = 'grabbing';
            return;
        }

        // Right click, or Cmd/Ctrl+click for one-button mice
        const isRightClick = e.button === 2 || (e.button === 0 && (e.metaKey || e.ctrlKey));

        if (!isRightClick && e.button === 0) {
            if (game.attackMoveMode) {
                const world = screenToWorld(x, y);
                const enemy = pickEntity(x, y, ent => isHostileTo(ent, 0));
                commandSelection(world.x, world.y, enemy, true, e.shiftKey);
                if (!e.shiftKey) game.attackMoveMode = false;
                return;
            }
            if (game.placingBuilding) {
                tryPlaceBuilding(x, y, e.shiftKey);
                return;
            }
            // selection box (a click without drag is resolved on mouseup)
            game.selectionBox = { x1: x, y1: y, x2: x, y2: y };
            return;
        }

        if (isRightClick) {
            // Right-click cancels modes first
            if (game.placingBuilding) {
                game.placingBuilding = null;
                return;
            }
            if (game.attackMoveMode) {
                game.attackMoveMode = false;
                return;
            }
            const world = screenToWorld(x, y);
            const enemy = pickEntity(x, y, ent => isHostileTo(ent, 0));
            commandSelection(world.x, world.y, enemy, false, e.shiftKey);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        game.mouse.x = e.clientX - rect.left;
        game.mouse.y = e.clientY - rect.top;
        game.mouse.inside = true;

        if (middleMouseDrag) {
            const zoom = getZoom();
            game.camera.x = middleMouseDrag.cameraStartX - (e.clientX - middleMouseDrag.startX) / zoom;
            game.camera.y = middleMouseDrag.cameraStartY - (e.clientY - middleMouseDrag.startY) / zoom;
            return;
        }

        const world = screenToWorld(game.mouse.x, game.mouse.y);
        game.mouse.worldX = world.x;
        game.mouse.worldY = world.y;

        if (game.selectionBox) {
            game.selectionBox.x2 = game.mouse.x;
            game.selectionBox.y2 = game.mouse.y;
        }
        updateCursorEmoji();
    });

    canvas.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const clicked = pickEntity(e.clientX - rect.left, e.clientY - rect.top, ent => ent.playerId === 0);
        if (clicked && UNIT_TYPES[clicked.type]) {
            // all units of that type currently on screen (classic RTS)
            game.selection = game.units.filter(u => u.playerId === 0 && u.type === clicked.type && onScreen(u));
            SoundManager.play('unit_select');
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 1 && middleMouseDrag) {
            middleMouseDrag = null;
            updateCursorEmoji();
            return;
        }
        if (e.button !== 0 || !game.selectionBox) return;

        const box = game.selectionBox;
        game.selectionBox = null;
        const minX = Math.min(box.x1, box.x2), maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2), maxY = Math.max(box.y1, box.y2);
        const additive = e.shiftKey || keys['Shift'];

        if (maxX - minX < 6 && maxY - minY < 6) {
            // Click select: own units first, then own buildings, then
            // anything visible (enemies can be inspected, not ordered)
            const own = pickEntity(box.x1, box.y1, ent => ent.playerId === 0);
            const any = own || pickEntity(box.x1, box.y1, ent => ent.playerId !== 0);
            if (!any) {
                if (!additive) game.selection = [];
                return;
            }
            if (any.playerId !== 0) {
                game.selection = [any];
                return;
            }
            if (additive && UNIT_TYPES[any.type] && game.selection.every(s => UNIT_TYPES[s.type] && s.playerId === 0)) {
                game.selection = game.selection.includes(any)
                    ? game.selection.filter(s => s !== any)
                    : [...game.selection, any];
            } else {
                game.selection = [any];
            }
            SoundManager.play('unit_select');
            if (UNIT_TYPES[any.type] && typeof VoiceManager !== 'undefined') VoiceManager.play('select', getFaction(0));
            return;
        }

        // Box select: own units only (buildings never mix into an army)
        const zoom = getZoom();
        const picked = game.units.filter(u => {
            if (u.playerId !== 0) return false;
            const s = worldToScreen(u.x, u.y);
            const cy = s.y - UNIT_TYPES[u.type].size * 0.6 * zoom;
            return s.x >= minX - 4 && s.x <= maxX + 4 && cy >= minY - 6 && cy <= maxY + 6;
        });
        if (additive) {
            for (const u of picked) if (!game.selection.includes(u)) game.selection.push(u);
            game.selection = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
        } else if (picked.length > 0) {
            game.selection = picked;
        } else {
            game.selection = [];
        }
        if (picked.length > 0) {
            SoundManager.play('unit_select');
            if (typeof VoiceManager !== 'undefined') VoiceManager.play('select', getFaction(0));
        }
    });

    canvas.addEventListener('mouseleave', () => {
        game.mouse.inside = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent middle-click autoscroll browser behavior
    canvas.addEventListener('auxclick', (e) => {
        if (e.button === 1) e.preventDefault();
    });

    // Mouse wheel / trackpad: two-finger scroll pans, pinch or Ctrl+wheel
    // zooms toward the cursor (the point under the mouse stays put)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const isMouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0 && Number.isInteger(e.deltaY));
        if (e.ctrlKey || e.metaKey || (isMouseWheel && gameSettings.wheelZoom)) {
            const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
            zoomAt(mx, my, gameSettings.zoom * factor);
        } else {
            const zoom = getZoom();
            const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
            game.camera.x += clamp(e.deltaX, -120, 120) * 0.6 / zoom;
            game.camera.y += clamp(e.deltaY, -120, 120) * 0.6 / zoom;
        }
    }, { passive: false });

// ============================================
// TOUCH CONTROLS (mobile / tablet)
// Tap = select; tap with selection = command (move/attack/rally);
// drag = pan camera; long-press then drag = box select;
// pinch = zoom; double-tap = select all of type.
// Synthesizes the existing mouse events so all command logic
// stays in one place.
// ============================================
const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (IS_TOUCH_DEVICE) {
    document.body.classList.add('touch-device');
    // phones start closer in - units are hard to tap at 1.0
    gameSettings.zoom = Math.max(gameSettings.zoom, 1.25);
}

if (IS_TOUCH_DEVICE && canvas) {
    let touchState = null;   // { mode: 'tap'|'pan'|'box'|'ghost', ... }
    let pinch = null;        // { d0, zoom0, mx, my, camX, camY }
    let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

    const touchPos = (t) => {
        const r = canvas.getBoundingClientRect();
        return { x: t.clientX - r.left, y: t.clientY - r.top, cx: t.clientX, cy: t.clientY };
    };
    const fakeMouse = (type, button, cx, cy) => {
        canvas.dispatchEvent(new MouseEvent(type, { button, clientX: cx, clientY: cy, bubbles: true }));
    };
    const ownEntityAt = (x, y) => {
        const near = (ent, radius) => {
            const s = worldToScreen(ent.x, ent.y);
            return Math.hypot(s.x - x, s.y - y) < radius;
        };
        return game.units.find(u => u.playerId === 0 && near(u, 30)) ||
               game.buildings.find(b => b.playerId === 0 && near(b, 34));
    };

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (game.status !== 'PLAYING') return;
        if (e.touches.length === 2) {
            if (touchState) clearTimeout(touchState.longPressTimer);
            touchState = null;
            game.selectionBox = null;
            const a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
            pinch = {
                d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
                zoom0: gameSettings.zoom,
                mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
                camX: game.camera.x, camY: game.camera.y
            };
            return;
        }
        if (e.touches.length !== 1 || pinch) return;
        const p = touchPos(e.touches[0]);
        touchState = {
            mode: 'tap',
            startX: p.x, startY: p.y, cx: p.cx, cy: p.cy,
            camX: game.camera.x, camY: game.camera.y,
            moved: false, longPressTimer: null
        };
        if (game.placingBuilding) fakeMouse('mousemove', 0, p.cx, p.cy);
        touchState.longPressTimer = setTimeout(() => {
            if (touchState && !touchState.moved && !game.placingBuilding && !game.attackMoveMode) {
                touchState.mode = 'box';
                game.selectionBox = { x1: touchState.startX, y1: touchState.startY, x2: touchState.startX, y2: touchState.startY };
                if (navigator.vibrate) navigator.vibrate(20);
            }
        }, 350);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (game.status !== 'PLAYING') return;
        if (pinch && e.touches.length >= 2) {
            const a = touchPos(e.touches[0]), b = touchPos(e.touches[1]);
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            gameSettings.zoom = Math.max(gameSettings.minZoom,
                Math.min(gameSettings.maxZoom, pinch.zoom0 * d / pinch.d0));
            const zoom = getZoom();
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            game.camera.x = pinch.camX - (mx - pinch.mx) / zoom;
            game.camera.y = pinch.camY - (my - pinch.my) / zoom;
            return;
        }
        if (!touchState || e.touches.length !== 1) return;
        const p = touchPos(e.touches[0]);
        const dx = p.x - touchState.startX, dy = p.y - touchState.startY;
        if (!touchState.moved && Math.hypot(dx, dy) > 12) {
            touchState.moved = true;
            clearTimeout(touchState.longPressTimer);
            if (touchState.mode === 'tap') {
                touchState.mode = game.placingBuilding ? 'ghost' : 'pan';
            }
        }
        if (touchState.mode === 'pan') {
            const zoom = getZoom();
            game.camera.x = touchState.camX - dx / zoom;
            game.camera.y = touchState.camY - dy / zoom;
        } else if (touchState.mode === 'box' && game.selectionBox) {
            game.selectionBox.x2 = p.x;
            game.selectionBox.y2 = p.y;
        } else if (touchState.mode === 'ghost') {
            // drag positions the building ghost before committing
            fakeMouse('mousemove', 0, p.cx, p.cy);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (pinch) {
            if (e.touches.length < 2) pinch = null;
            return;
        }
        if (!touchState) return;
        clearTimeout(touchState.longPressTimer);
        const st = touchState;
        touchState = null;
        if (game.status !== 'PLAYING') return;

        if (st.mode === 'box') {
            // mouseup consumes game.selectionBox regardless of event coords
            fakeMouse('mouseup', 0, st.cx, st.cy);
            return;
        }
        if (st.mode === 'pan' || st.mode === 'ghost') return;

        // plain tap
        const now = Date.now();
        const isDouble = now - lastTapTime < 320 &&
            Math.hypot(st.startX - lastTapX, st.startY - lastTapY) < 30;
        lastTapTime = now; lastTapX = st.startX; lastTapY = st.startY;
        if (isDouble) {
            fakeMouse('dblclick', 0, st.cx, st.cy);
            return;
        }
        if (game.placingBuilding || game.attackMoveMode) {
            fakeMouse('mousemove', 0, st.cx, st.cy);
            fakeMouse('mousedown', 0, st.cx, st.cy);
            fakeMouse('mouseup', 0, st.cx, st.cy);
            return;
        }
        // own entity under the finger -> select; otherwise with a
        // commandable selection the tap is an order (right-click)
        const own = ownEntityAt(st.startX, st.startY);
        const canCommand = game.selection.some(s => s.playerId === 0 && UNIT_TYPES[s.type]) ||
            (game.selection.length === 1 && game.selection[0].playerId === 0 &&
             BUILDING_TYPES[game.selection[0].type] &&
             BUILDING_TYPES[game.selection[0].type].produces.length > 0);
        if (!own && canCommand) {
            fakeMouse('mousedown', 2, st.cx, st.cy);
            fakeMouse('mouseup', 2, st.cx, st.cy);
        } else {
            fakeMouse('mousedown', 0, st.cx, st.cy);
            fakeMouse('mouseup', 0, st.cx, st.cy);
        }
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
        if (touchState) clearTimeout(touchState.longPressTimer);
        touchState = null;
        pinch = null;
        game.selectionBox = null;
    });

    // floating command buttons (attack-move / deselect)
    const tcAttack = document.getElementById('tcAttack');
    const tcDeselect = document.getElementById('tcDeselect');
    if (tcAttack) tcAttack.addEventListener('click', () => {
        if (game.selection.some(s => s.playerId === 0 && UNIT_TYPES[s.type])) {
            game.attackMoveMode = true;
        }
    });
    if (tcDeselect) tcDeselect.addEventListener('click', () => {
        game.selection = [];
        game.attackMoveMode = false;
        game.placingBuilding = null;
        game.placingBuildingFrom = null;
    });
    const tcPause = document.getElementById('tcPause');
    if (tcPause) tcPause.addEventListener('click', () => togglePause());

    // manual fullscreen toggle - startGame already tries, but the
    // browser may deny it or the player may have exited since
    const tcFullscreen = document.getElementById('tcFullscreen');
    if (tcFullscreen) tcFullscreen.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            window.requestMobileImmersion();
        }
    });

    // collapsible sidebar: more battlefield on small screens
    const tcSidebar = document.getElementById('tcSidebar');
    if (tcSidebar) tcSidebar.addEventListener('click', () => {
        const collapsed = document.body.classList.toggle('sidebar-collapsed');
        tcSidebar.innerHTML = collapsed ? '&#9664;' : '&#9654;';
        resizeCanvas(); // canvas gains/loses the sidebar width
    });

    // battles shouldn't run down the clock while the app is backgrounded
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && game.status === 'PLAYING') togglePause();
    });
}

// Best effort on touch: immersive fullscreen + landscape lock once the
// player starts a match (both APIs require a user gesture and may be
// unsupported - failures are silently ignored). Exposed on window
// because this scope is nested while startGame is module-level.
window.requestMobileImmersion = function requestMobileImmersion() {
    if (!IS_TOUCH_DEVICE) return;
    const el = document.documentElement;
    const fs = el.requestFullscreen || el.webkitRequestFullscreen;
    const afterFs = () => {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    };
    if (fs && !document.fullscreenElement) {
        try {
            const p = fs.call(el);
            if (p && p.then) p.then(afterFs, () => {}); else afterFs();
        } catch (e) { /* unsupported */ }
    } else {
        afterFs();
    }
};

    // Browser-only support (Mobile removed)

    // Minimap: left-click/drag moves the camera, right-click sends the
    // selected units there (attack-move in attack-move mode)
    if (minimapCanvas) {
        let mmDrag = false;
        const mmWorld = (e) => {
            const rect = minimapCanvas.getBoundingClientRect();
            return minimapToWorld((e.clientX - rect.left) * (minimapCanvas.width / rect.width),
                (e.clientY - rect.top) * (minimapCanvas.height / rect.height));
        };
        minimapCanvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const w = mmWorld(e);
            if (e.button === 2 || (e.button === 0 && game.attackMoveMode)) {
                commandSelection(w.x, w.y, null, game.attackMoveMode, e.shiftKey);
                game.attackMoveMode = false;
                return;
            }
            if (e.button !== 0) return;
            mmDrag = true;
            centerCameraOn(w.x, w.y);
        });
        window.addEventListener('mousemove', (e) => {
            if (!mmDrag) return;
            const w = mmWorld(e);
            centerCameraOn(w.x, w.y);
        });
        window.addEventListener('mouseup', () => { mmDrag = false; });
        minimapCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === 'Shift') keys['Shift'] = true;
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        if (e.key === 'p' || e.key === 'P' || (e.key === 'Escape' && game.status === 'PAUSED')) {
            togglePause();
            e.preventDefault();
            return;
        }
        if (game.status !== 'PLAYING') return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const mod = e.metaKey || e.ctrlKey;

        // Control groups: Ctrl/Cmd+1-9 assigns, Shift+1-9 adds,
        // 1-9 recalls, double-tap centers the camera on the group
        if (e.code && /^Digit[1-9]$/.test(e.code)) {
            const n = e.code.slice(5);
            const groupKey = `group${n}`;
            const units = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
            if (mod) {
                game[groupKey] = [...units];
                for (const u of units) u.group = +n;
                setBanner(`Group ${n} assigned (${units.length} units)`, 1.5, '#9fd4ff');
            } else if (e.shiftKey) {
                game[groupKey] = [...new Set([...(game[groupKey] || []), ...units])];
                for (const u of units) u.group = +n;
            } else {
                const members = (game[groupKey] || []).filter(isAlive);
                game[groupKey] = members;
                if (members.length > 0) {
                    game.selection = [...members];
                    SoundManager.play('unit_select');
                    const now = Date.now();
                    if (game._lastGroupKey === n && now - (game._lastGroupTime || 0) < 350) {
                        centerCameraOn(members.reduce((s, u) => s + u.x, 0) / members.length,
                            members.reduce((s, u) => s + u.y, 0) / members.length);
                    }
                    game._lastGroupKey = n;
                    game._lastGroupTime = now;
                }
            }
            e.preventDefault();
            return;
        }

        if (mod && k === 'a') {
            selectAllArmy();
            e.preventDefault();
            return;
        }
        if (mod) return;

        switch (k) {
            case 'a': // attack-move: then left-click a destination
                if (game.selection.some(s => UNIT_TYPES[s.type] && s.playerId === 0)) {
                    game.attackMoveMode = true;
                    game.placingBuilding = null;
                    updateCursorEmoji();
                }
                e.preventDefault();
                break;
            case 's':
            case 'x':
                for (const sel of game.selection) {
                    if (sel.playerId === 0 && UNIT_TYPES[sel.type]) { stopUnit(sel); sel.waypoints = []; }
                }
                break;
            case ' ':
                if (game.lastAttackAlert) centerCameraOn(game.lastAttackAlert.x, game.lastAttackAlert.y);
                e.preventDefault();
                break;
            case 'h': {
                const hq = game.buildings.find(b => b.playerId === 0 && b.type === 'hq') ||
                    game.buildings.find(b => b.playerId === 0);
                if (hq) {
                    game.selection = [hq];
                    centerCameraOn(hq.x, hq.y);
                }
                break;
            }
            case 'q': // idle army: select every combat unit with nothing to do
                selectAllArmy(true);
                break;
            case 'F1':
                game.showHelp = !game.showHelp;
                e.preventDefault();
                break;
            case 'F2':
                selectAllArmy();
                e.preventDefault();
                break;
            case 'Escape':
                if (game.showHelp) game.showHelp = false;
                else if (game.placingBuilding || game.attackMoveMode) {
                    game.placingBuilding = null;
                    game.attackMoveMode = false;
                } else game.selection = [];
                updateCursorEmoji();
                break;
            case 'Tab':
                // cycle sidebar tabs
                e.preventDefault();
                if (typeof cycleSidebarTab === 'function') cycleSidebarTab(e.shiftKey ? -1 : 1);
                break;
            case '+': case '=':
                zoomAt(canvas.offsetWidth / 2, canvas.offsetHeight / 2, gameSettings.zoom * 1.12);
                e.preventDefault();
                break;
            case '-': case '_':
                zoomAt(canvas.offsetWidth / 2, canvas.offsetHeight / 2, gameSettings.zoom / 1.12);
                e.preventDefault();
                break;
            case '0':
                zoomAt(canvas.offsetWidth / 2, canvas.offsetHeight / 2, 1);
                break;
            default:
                // sidebar hotkeys (shown on the buttons)
                if (typeof sidebarHotkey === 'function' && sidebarHotkey(k)) e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
        if (e.key === 'Shift') keys['Shift'] = false;
    });
    window.addEventListener('blur', () => { for (const key in keys) keys[key] = false; });

    // Unlock audio on first user interaction (required by modern browsers)
    function unlockAudio() {
        if (!audioUnlocked) {
            audioUnlocked = true;
            const introMusic = document.getElementById('introMusic');
            const bgMusic = document.getElementById('backgroundMusic');

            // Play appropriate music based on current game state
            if (game.status === 'MENU' && introMusic) {
                introMusic.volume = 0.3;
                introMusic.play().catch(e => console.log('Intro music error:', e));
            } else if (game.status === 'PLAYING' && bgMusic) {
                bgMusic.volume = 0.3;
                bgMusic.play().catch(e => console.log('Background music error:', e));
            }

            // Remove listeners after first unlock
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        }
    }

    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    // Handle browser window resize - keep canvas properly sized
    window.addEventListener('resize', () => {
        if (game.status === 'PLAYING' || game.status === 'PAUSED') {
            resizeCanvas();
        }
    });
}

// Camera scrolling (keyboard + edge scrolling + middle mouse drag)
const EDGE_SCROLL_MARGIN = 20; // pixels from canvas edge to trigger scrolling
const EDGE_SCROLL_SPEED = 8;

// Middle mouse drag state
let middleMouseDrag = null; // { startX, startY, cameraStartX, cameraStartY }

function updateCamera(frameDt = 1 / 60) {
    const k = frameDt * 60;
    const speed = 12 * k / getZoom();

    // Keyboard scrolling (arrow keys; A/S are unit commands)
    if (keys['ArrowUp']) game.camera.y -= speed;
    if (keys['ArrowDown']) game.camera.y += speed;
    if (keys['ArrowLeft']) game.camera.x -= speed;
    if (keys['ArrowRight']) game.camera.x += speed;

    // Edge scrolling (mouse near canvas edges)
    if (canvas && game.status === 'PLAYING' && !game.paused) {
        const mx = game.mouse.x;
        const my = game.mouse.y;
        const cw = canvas.offsetWidth;
        const ch = canvas.offsetHeight;
        const zoom = getZoom();
        const edgeSpeed = EDGE_SCROLL_SPEED * k / zoom;

        // Only edge scroll once the pointer has actually entered the canvas
        if (game.mouse.inside && mx >= 0 && mx <= cw && my >= 0 && my <= ch) {
            if (mx < EDGE_SCROLL_MARGIN) game.camera.x -= edgeSpeed;
            if (mx > cw - EDGE_SCROLL_MARGIN) game.camera.x += edgeSpeed;
            if (my < EDGE_SCROLL_MARGIN) game.camera.y -= edgeSpeed;
            if (my > ch - EDGE_SCROLL_MARGIN) game.camera.y += edgeSpeed;
        }
    }
}

// ============================================
// MENU SYSTEM
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.fullscreen-overlay').forEach(el => {
        el.classList.add('hidden');
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
    }
}

function goToMainMenu() {
    game.status = 'MENU';
    game.paused = false;
    game.units = [];
    game.buildings = [];
    game.selection = [];
    showScreen('mainMenu');

    // Hide game interface
    document.getElementById('header').classList.remove('game-active');
    document.getElementById('gameContainer').classList.remove('game-active');
    document.getElementById('footer').classList.remove('game-active');

    // Stop background music and play intro music
    const bgMusic = document.getElementById('backgroundMusic');
    const introMusic = document.getElementById('introMusic');

    if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }

    if (typeof MusicEngine !== 'undefined') MusicEngine.stop();

    if (introMusic && audioUnlocked) {
        introMusic.volume = 0.3;
        introMusic.currentTime = 0;
        introMusic.play().catch(e => console.log('Intro music error:', e));
    }
}

function goToSettings() {
    showScreen('settingsMenu');
}

function startGame() {
    // Resume audio context on user interaction (required by browsers)
    SoundManager.resume();
    if (window.requestMobileImmersion) window.requestMobileImmersion();

    const timeLimitEl = document.getElementById('timeLimitSelect');
    const difficultyEl = document.getElementById('difficultySelect');
    const mapSizeEl = document.getElementById('mapSizeSelect');
    const oilEl = document.getElementById('startingOilSelect');

    if (!timeLimitEl || !difficultyEl || !mapSizeEl || !oilEl) {
        console.error('Settings elements not found');
        return;
    }

    gameSettings.timeLimit = timeLimitEl.value;
    gameSettings.difficulty = difficultyEl.value;
    gameSettings.mapSize = mapSizeEl.value;
    gameSettings.startingOil = parseInt(oilEl.value);

    // Faction selection
    const playerFactionEl = document.getElementById('playerFactionSelect');
    const enemyFactionEl = document.getElementById('enemyFactionSelect');
    if (playerFactionEl) gameSettings.playerFaction = playerFactionEl.value;
    if (enemyFactionEl) gameSettings.enemyFaction = enemyFactionEl.value;

    // Rendered asset pack or procedural sprites
    const gfxEl = document.getElementById('graphicsSelect');
    gameSettings.graphics = gfxEl ? gfxEl.value : 'pack';
    IsoSprites.setPackEnabled(gameSettings.graphics === 'pack');

    // Guided start on/off
    const tutorialEl = document.getElementById('tutorialSelect');
    gameSettings.tutorial = !tutorialEl || tutorialEl.value === 'on';

    // Remember the chosen settings for next time
    try {
        localStorage.setItem('xfire_settings', JSON.stringify({
            timeLimit: gameSettings.timeLimit,
            difficulty: gameSettings.difficulty,
            mapSize: gameSettings.mapSize,
            startingOil: gameSettings.startingOil,
            playerFaction: gameSettings.playerFaction,
            enemyFaction: gameSettings.enemyFaction,
            tutorial: gameSettings.tutorial ? 'on' : 'off',
            graphics: gameSettings.graphics
        }));
    } catch (e) { /* private mode etc. */ }

    // Set actual map size based on selection
    const mapSizes = {
        small: 32,
        medium: 64,
        large: 96
    };
    gameSettings.MAP_SIZE = mapSizes[gameSettings.mapSize] || 64;

    resetGame();
    initGame();
    game.status = 'PLAYING';
    const hf = document.getElementById('hudFaction');
    if (hf) hf.textContent = FACTIONS[game.players[0].faction].name + ' vs ' + FACTIONS[game.players[1].faction].name;
    showScreen('mainMenu');
    document.getElementById('mainMenu').classList.add('hidden');
    

    // Show game interface
    document.getElementById('header').classList.add('game-active');
    document.getElementById('gameContainer').classList.add('game-active');
    document.getElementById('footer').classList.add('game-active');

    // Resize canvas now that it's visible
    setTimeout(resizeCanvas, 0);

    // Stop intro music and play background music
    const introMusic = document.getElementById('introMusic');
    const bgMusic = document.getElementById('backgroundMusic');

    if (introMusic) {
        introMusic.pause();
        introMusic.currentTime = 0;
    }

    // In-game soundtrack is fully procedural now
    if (bgMusic) bgMusic.pause();
    SoundManager.resume();
    if (typeof MusicEngine !== 'undefined') MusicEngine.start();
}

function togglePause() {
    if (game.status !== 'PLAYING' && game.status !== 'PAUSED') return;

    const bgMusic = document.getElementById('backgroundMusic');

    if (game.status === 'PLAYING') {
        game.status = 'PAUSED';
        game.paused = true;
        showScreen('pauseScreen');
        if (typeof MusicEngine !== 'undefined') MusicEngine.stop();
    } else if (game.status === 'PAUSED') {
        game.status = 'PLAYING';
        game.paused = false;
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        if (typeof MusicEngine !== 'undefined') MusicEngine.start();
    }
}

function resetGame() {
    game.tick = 0;
    game.timeElapsed = 0;
    game.paused = false;
    game.selection = [];
    game.selectionBox = null;
    game.placingBuilding = null;
    game.units = [];
    game.buildings = [];
    game.projectiles = [];
    game.particles = [];
    game.damageNumbers = [];
    game.map = [];
    game.fogOfWar = [];
    game.group1 = [];
    game.group2 = [];
    game.group3 = [];
    game.group4 = [];
    game.group5 = [];
    // Reset camera to center of map
    game.camera.x = 0;
    game.camera.y = (getMapSize() / 2) * TILE_HEIGHT;
    game.attackMoveMode = false;
    game.orderMarkers = [];
    game.lastAttackAlert = null;
    game.bunkers = [];
    game.banner = null;
    game.pings = [];
    game.objectives = [];
    game.objectiveFlash = null;
    game.decals = [];
    game.dying = [];
    game.blockGrid = null;
    game.stats = { unitsBuilt: 0, unitsLost: 0, unitsKilled: 0, buildingsRazed: 0, oilEarned: 0, bunkersClaimed: 0 };
    game._promoBannerShown = false;
    game._remnantsPingTime = 0;
    game.showHelp = false;
    game.shake = 0;
    Terrain.reset();
    for (let g = 6; g <= 9; g++) game[`group${g}`] = [];

    // Resolve factions (enemy may be random)
    const playerFaction = FACTIONS[gameSettings.playerFaction] ? gameSettings.playerFaction : 'survivors';
    let enemyFaction = gameSettings.enemyFaction;
    if (!FACTIONS[enemyFaction]) {
        const pool = FACTION_KEYS.filter(f => f !== playerFaction);
        enemyFaction = pool[Math.floor(Math.random() * pool.length)];
    }

    game.players[0].oil = gameSettings.startingOil;
    game.players[0].techLevel = 1;
    game.players[0].faction = playerFaction;
    game.players[1].oil = gameSettings.startingOil;
    game.players[1].techLevel = 1;
    game.players[1].faction = enemyFaction;
}

function updateGameTimer() {
    if (game.status !== 'PLAYING') return;

    game.timeElapsed += (1 / 60);
    const totalSeconds = Math.floor(game.timeElapsed);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timerEl = document.getElementById('gameTimer');
    if (timerEl) {
        timerEl.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

        // Warning when less than 1 minute left
        if (gameSettings.timeLimit !== 'unlimited') {
            const timeLimitSeconds = parseInt(gameSettings.timeLimit) * 60;
            const timeLeft = timeLimitSeconds - totalSeconds;
            if (timeLeft > 0 && timeLeft <= 60) {
                timerEl.classList.add('warning');
            } else {
                timerEl.classList.remove('warning');
            }

            // Time's up
            if (timeLeft <= 0) {
                checkTimeLimit();
            }
        }
    }
}

function checkTimeLimit() {
    const playerUnits = game.units.filter(u => u.playerId === 0).length;
    const playerBuildings = game.buildings.filter(b => b.playerId === 0).length;
    const enemyUnits = game.units.filter(u => u.playerId === 1).length;
    const enemyBuildings = game.buildings.filter(b => b.playerId === 1).length;

    // Compare total forces to determine winner
    const playerScore = playerUnits + playerBuildings * 2;
    const enemyScore = enemyUnits + enemyBuildings * 2;

    if (playerScore > enemyScore) {
        game.status = 'WON';
        SoundManager.play('victory');
        if (typeof VoiceManager !== 'undefined') VoiceManager.say('Mission accomplished', 0);
        showScreen('victoryScreen');
        const statsEl = document.getElementById('victoryStats');
        if (statsEl) statsEl.innerHTML = '<div style="margin-bottom:8px;">Time limit reached - your forces prevail!</div>' + buildStatsHTML();
    } else {
        game.status = 'LOST';
        SoundManager.play('defeat');
        if (typeof VoiceManager !== 'undefined') VoiceManager.say('Mission failed', 0);
        showScreen('defeatScreen');
        const statsEl = document.getElementById('defeatStats');
        if (statsEl) statsEl.innerHTML = '<div style="margin-bottom:8px;">Time limit reached - the enemy holds the field.</div>' + buildStatsHTML();
    }
}

// Formatted end-of-match scoreboard
function buildStatsHTML() {
    const s = game.stats;
    const timeMin = Math.floor(game.timeElapsed / 60);
    const timeSec = Math.floor(game.timeElapsed % 60);
    const vets = game.units.filter(u => u.playerId === 0 && veterancyRank(u.kills) > 0).length;
    const row = (label, value) =>
        `<div style="display:flex;justify-content:space-between;gap:24px;">` +
        `<span style="color:#8888aa;">${label}</span><strong>${value}</strong></div>`;
    return `<div style="text-align:left;min-width:260px;">` +
        row('Match time', `${timeMin}:${String(timeSec).padStart(2, '0')}`) +
        row('Units built', s.unitsBuilt) +
        row('Units lost', s.unitsLost) +
        row('Enemies destroyed', s.unitsKilled) +
        row('Buildings razed', s.buildingsRazed) +
        row('Oil earned', Math.floor(s.oilEarned)) +
        row('Tech bunkers claimed', s.bunkersClaimed) +
        row('Veterans in the field', vets) +
        `</div>`;
}

function checkWinCondition() {
    const enemyUnits = game.units.filter(u => u.playerId === 1);
    const enemyBuildings = game.buildings.filter(b => b.playerId === 1);

    if (enemyUnits.length === 0 && enemyBuildings.length === 0) {
        game.status = 'WON';
        SoundManager.play('victory');
        if (typeof VoiceManager !== 'undefined') VoiceManager.say('Mission accomplished', 0);
        const playerUnits = game.units.filter(u => u.playerId === 0).length;
        const playerBuildings = game.buildings.filter(b => b.playerId === 0).length;
        showScreen('victoryScreen');
        const statsEl = document.getElementById('victoryStats');
        if (statsEl) statsEl.innerHTML = buildStatsHTML();
    }
}

function checkLoseCondition() {
    const playerUnits = game.units.filter(u => u.playerId === 0);
    const playerBuildings = game.buildings.filter(b => b.playerId === 0);

    if (playerUnits.length === 0 && playerBuildings.length === 0) {
        game.status = 'LOST';
        SoundManager.play('defeat');
        if (typeof VoiceManager !== 'undefined') VoiceManager.say('Mission failed', 0);
        showScreen('defeatScreen');
        const statsEl = document.getElementById('defeatStats');
        if (statsEl) statsEl.innerHTML = buildStatsHTML();
    }
}

// Restore the last-used settings into the menu selects
function restoreSavedSettings() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem('xfire_settings'));
    } catch (e) { return; }
    if (!saved) return;
    const apply = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined && [...el.options].some(o => o.value === String(value))) {
            el.value = String(value);
        }
    };
    apply('timeLimitSelect', saved.timeLimit);
    apply('difficultySelect', saved.difficulty);
    apply('mapSizeSelect', saved.mapSize);
    apply('startingOilSelect', saved.startingOil);
    apply('playerFactionSelect', saved.playerFaction);
    apply('enemyFactionSelect', saved.enemyFaction);
    apply('tutorialSelect', saved.tutorial);
    apply('graphicsSelect', saved.graphics);
}

function setupMenuHandlers() {
    // Add click sound to ALL menu buttons
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            SoundManager.play('ui_click');
        });
    });

    // Main menu buttons
    const newGameBtn = document.getElementById('newGameBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    const backBtn = document.getElementById('backBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const quitBtn = document.getElementById('quitBtn');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const retryBtn = document.getElementById('retryBtn');
    const menuReturnBtns = document.querySelectorAll('.menu-return');

    if (newGameBtn) newGameBtn.addEventListener('click', startGame);
    if (settingsBtn) settingsBtn.addEventListener('click', goToSettings);
    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (backBtn) backBtn.addEventListener('click', goToMainMenu);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
    if (quitBtn) quitBtn.addEventListener('click', goToMainMenu);

    // Combat sound toggle in pause menu
    const announcerToggle = document.getElementById('announcerToggle');
    if (announcerToggle && typeof VoiceManager !== 'undefined') {
        announcerToggle.checked = VoiceManager.announcer;
        announcerToggle.addEventListener('change', (e) => VoiceManager.setAnnouncer(e.target.checked));
    }
    const combatSoundToggle = document.getElementById('combatSoundToggle');
    if (combatSoundToggle) {
        combatSoundToggle.addEventListener('change', (e) => {
            SoundManager.combatEnabled = e.target.checked;
        });
    }

    // Audio mixer sliders (persisted between sessions)
    const mixer = [
        ['musicVolume', v => typeof MusicEngine !== 'undefined' && MusicEngine.setVolume(v)],
        ['sfxVolume', v => SoundManager.setSfxVolume(v)],
        ['voiceVolume', v => typeof VoiceManager !== 'undefined' && VoiceManager.setVolume(v)]
    ];
    let savedMix = {};
    try { savedMix = JSON.parse(localStorage.getItem('xfire_mixer')) || {}; } catch (e) { /* fresh */ }
    for (const [id, apply] of mixer) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (savedMix[id] !== undefined) el.value = savedMix[id];
        apply(el.value / 100);
        el.addEventListener('input', () => {
            apply(el.value / 100);
            savedMix[id] = el.value;
            try { localStorage.setItem('xfire_mixer', JSON.stringify(savedMix)); } catch (e) { /* ignore */ }
        });
    }

    if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
        resetGame();
        initGame();
        game.status = 'PLAYING';
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        
        // Show game interface
        document.getElementById('header').classList.add('game-active');
        document.getElementById('gameContainer').classList.add('game-active');
        document.getElementById('footer').classList.add('game-active');
        setTimeout(resizeCanvas, 0);
        // Restart the procedural soundtrack
        SoundManager.resume();
        if (typeof MusicEngine !== 'undefined') {
            MusicEngine.stop();
            MusicEngine.start();
        }
    });
    if (retryBtn) retryBtn.addEventListener('click', () => {
        resetGame();
        initGame();
        game.status = 'PLAYING';
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        
        // Show game interface
        document.getElementById('header').classList.add('game-active');
        document.getElementById('gameContainer').classList.add('game-active');
        document.getElementById('footer').classList.add('game-active');
        setTimeout(resizeCanvas, 0);
        // Restart the procedural soundtrack
        SoundManager.resume();
        if (typeof MusicEngine !== 'undefined') {
            MusicEngine.stop();
            MusicEngine.start();
        }
    });

    menuReturnBtns.forEach(btn => {
        btn.addEventListener('click', goToMainMenu);
    });

    // In-game HUD buttons and the command bar under the selection panel
    document.getElementById('hudPause')?.addEventListener('click', () => togglePause());
    document.getElementById('hudHelp')?.addEventListener('click', () => { game.showHelp = !game.showHelp; });
    document.querySelectorAll('#commandBar .cmd-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const cmd = btn.dataset.cmd;
            const units = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
            if (cmd === 'amove' && units.length) { game.attackMoveMode = true; game.placingBuilding = null; }
            else if (cmd === 'stop') units.forEach(u => { stopUnit(u); u.waypoints = []; });
            else if (cmd === 'idle') selectAllArmy(true);
            else if (cmd === 'army') selectAllArmy();
            SoundManager.play('ui_click');
        });
    });
}

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
    generateMap();
    game.blockGrid = new Uint8Array(getMapSize() * getMapSize());

    const mapSizeVal = getMapSize();

    // Define base positions
    const playerBaseX = 10;
    const playerBaseY = 10;
    const enemyBaseX = mapSizeVal - 12;
    const enemyBaseY = mapSizeVal - 12;

    // Ensure base areas are passable (clear water/hills)
    ensurePassableArea(playerBaseX, playerBaseY, 8);
    ensurePassableArea(enemyBaseX, enemyBaseY, 8);

    // Guarantee plenty of oil fields near both bases
    placeOilField(playerBaseX + 7, playerBaseY - 2, 2);
    placeOilField(playerBaseX - 3, playerBaseY + 7, 2);
    placeOilField(playerBaseX + 9, playerBaseY + 6, 1);
    placeOilField(enemyBaseX - 7, enemyBaseY + 2, 2);
    placeOilField(enemyBaseX + 3, enemyBaseY - 7, 2);
    placeOilField(enemyBaseX - 9, enemyBaseY - 6, 1);

    // Scatter neutral tech bunkers across the wasteland
    placeBunkers();

    // Guided-start objectives (uses the resolved player faction)
    initObjectives();

    // Seed the fog of war so the starting base is revealed immediately
    updateFogOfWar();
    updateFogCanvas();

    // Map is final now - render the static terrain cache
    Terrain.build();

    // queue sprite baking for both armies (own side first)
    IsoSprites.clearPrewarm();
    const allRoles = Object.keys(UNIT_TYPES);
    IsoSprites.prewarm(game.players[0].faction, teamColor(0), allRoles);
    IsoSprites.prewarm(game.players[1].faction, teamColor(1), allRoles);

    // KKnD-style start: Outpost + Power Station + a few troopers
    createBuilding('hq', 0, playerBaseX, playerBaseY);
    createBuilding('powerStation', 0, playerBaseX + 4, playerBaseY + 4);
    spawnUnit('trooper', 0, playerBaseX + 2.5, playerBaseY - 1.5);
    spawnUnit('trooper', 0, playerBaseX - 1.5, playerBaseY + 2.5);
    spawnUnit('bike', 0, playerBaseX + 3, playerBaseY + 1);

    createBuilding('hq', 1, enemyBaseX, enemyBaseY);
    createBuilding('powerStation', 1, enemyBaseX - 4, enemyBaseY - 4);
    spawnUnit('trooper', 1, enemyBaseX - 2.5, enemyBaseY + 1.5);
    spawnUnit('trooper', 1, enemyBaseX + 1.5, enemyBaseY - 2.5);
    spawnUnit('bike', 1, enemyBaseX - 3, enemyBaseY - 1);

    // Center camera on player base using isometric coordinates
    const playerHQ = game.buildings.find(b => b.playerId === 0 && b.type === 'hq');
    if (playerHQ) {
        // Convert world coords to isometric screen coords for camera
        const isoX = (playerHQ.x - playerHQ.y) * (TILE_WIDTH / 2);
        const isoY = (playerHQ.x + playerHQ.y) * (TILE_HEIGHT / 2);
        game.camera.x = isoX;
        game.camera.y = isoY;
    }
}

// ============================================
// GAME LOOP
// ============================================

let lastTime = 0;
let simAccumulator = 0;
const SIM_DT = 1 / 60;

// Fixed-timestep simulation: the game logic always advances in 1/60 s
// ticks, whatever the monitor refresh rate. (Previously one tick ran
// per rendered frame, so a 144 Hz screen made fire rates, build times
// and projectiles run 2.4x faster than unit movement.)
function gameLoop(timestamp) {
    if (!canvas || !ctx) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const frameDt = Math.min((timestamp - (lastTime || timestamp)) / 1000, 0.25);
    lastTime = timestamp;

    canvas.classList.toggle('placing-building', !!game.placingBuilding);

    if (game.status === 'PLAYING') {
        updateCamera(frameDt);
        simAccumulator += frameDt;
        let steps = 0;
        while (simAccumulator >= SIM_DT && steps < 6 && game.status === 'PLAYING') {
            update(SIM_DT);
            updateGameTimer();
            checkWinCondition();
            checkLoseCondition();
            simAccumulator -= SIM_DT;
            steps++;
        }
        if (steps === 6) simAccumulator = 0; // too slow: drop time rather than spiral
        clampCamera();
    } else {
        simAccumulator = 0;
    }

    render(frameDt);
    requestAnimationFrame(gameLoop);
}

// Loading screen animation and intro music preload
function showLoadingScreen() {
    return new Promise((resolve) => {
        const loadingBar = document.getElementById('loadingBar');
        const loadingText = document.getElementById('loadingText');
        const goButton = document.getElementById('goButton');
        const introMusic = document.getElementById('introMusic');
        let progress = 0;
        const duration = 2000; // 2 seconds
        // decode the 3D asset pack while the bar fills
        let packDone = false;
        IsoSprites.loadPack().then(n => {
            packDone = true;
            console.log(`[assets] ${n} rendered sprite sheets loaded`);
        }).catch(() => { packDone = true; });
        const startTime = Date.now();

        // Start preloading intro music
        if (introMusic) {
            introMusic.load();
        }

        // Animate loading bar
        function updateLoadingBar() {
            const elapsed = Date.now() - startTime;
            progress = Math.min((elapsed / duration) * 100, 100);

            if (loadingBar) {
                loadingBar.style.width = progress + '%';
            }

            if (progress < 100 || !packDone) {
                progress = Math.min(progress, 99);
                if (loadingBar) loadingBar.style.width = progress + '%';
                requestAnimationFrame(updateLoadingBar);
            } else {
                // Loading complete - show GO button
                if (loadingText) {
                    loadingText.textContent = 'Ready!';
                }
                if (goButton) {
                    goButton.style.display = 'block';
                    goButton.onclick = () => {
                        // Play click sound and unlock audio
                        SoundManager.init();
                        SoundManager.resume();
                        SoundManager.play('ui_click');
                        // Start intro music and show menu
                        if (introMusic) {
                            introMusic.volume = 0.3;
                            introMusic.currentTime = 0;
                            introMusic.play().catch(e => console.log('Intro music autoplay prevented:', e));
                        }
                        resolve();
                    };
                }
            }
        }

        updateLoadingBar();
    });
}

// Initialize canvases and start game loop
// defer attribute ensures this runs after DOM is ready
try {
    if (!initializeCanvases()) {
        alert('Error: Could not initialize game canvases');
    } else {
        initializeEventHandlers();
        setupMenuHandlers();
        restoreSavedSettings();

        // Show loading screen, then main menu
        showLoadingScreen().then(() => {
            showScreen('mainMenu');
            requestAnimationFrame(gameLoop);
        }).catch(() => {
            showScreen('mainMenu');
            requestAnimationFrame(gameLoop);
        });
    }
} catch (e) {
    alert('Fatal error: ' + e.message);
}