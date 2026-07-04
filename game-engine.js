// Detect Mac (used for modifier-key handling)
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

// ============================================
// XFIRE - Krossfire Skirmish RTS Game Engine
// ============================================

let canvas, ctx, minimapCanvas, minimapCtx;

// ============================================
// SOUND SYSTEM - Web Audio API
// ============================================
const SoundManager = {
    ctx: null,
    enabled: true,
    combatEnabled: true,  // Toggle for combat sounds (shooting, explosions)
    volume: 0.3,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('[SoundManager] Initialized');
        } catch (e) {
            console.warn('[SoundManager] Web Audio not supported');
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Play a synthetic sound effect
    play(type, options = {}) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const vol = (options.volume || 1) * this.volume;

        // Combat sounds check
        const isCombatSound = type.startsWith('shoot_') || type.startsWith('explosion_');
        if (isCombatSound && !this.combatEnabled) return;

        switch (type) {
            case 'shoot_light':
                this._playShoot(800, 0.08, vol * 0.4);
                break;
            case 'shoot_heavy':
                this._playShoot(200, 0.15, vol * 0.6);
                break;
            case 'shoot_artillery':
                this._playShoot(100, 0.25, vol * 0.8);
                break;
            case 'explosion_small':
                this._playExplosion(0.15, vol * 0.5);
                break;
            case 'explosion_large':
                this._playExplosion(0.3, vol * 0.7);
                break;
            case 'ui_click':
                this._playClick(vol * 0.3);
                break;
            case 'ui_build':
                this._playBuild(vol * 0.4);
                break;
            case 'unit_select':
                this._playSelect(vol * 0.25);
                break;
            case 'alert':
                this._playAlert(vol * 0.7);
                break;
            case 'shoot_flame':
                this._playFlame(vol * 0.5);
                break;
            case 'shoot_rocket':
                this._playRocket(vol * 0.5);
                break;
            case 'shoot_zap':
                this._playZap(vol * 0.45);
                break;
            case 'ack_move':
                // soft confirmation blip for movement orders
                this._tone(520, 0.05, 'sine', vol * 0.22);
                this._tone(700, 0.06, 'sine', vol * 0.18, 0.05);
                break;
            case 'ack_attack':
                // aggressive double blip for attack orders
                this._tone(300, 0.06, 'square', vol * 0.22);
                this._tone(240, 0.08, 'square', vol * 0.22, 0.06);
                break;
            case 'unit_ready':
                this._tone(620, 0.07, 'sine', vol * 0.3);
                this._tone(930, 0.11, 'sine', vol * 0.26, 0.08);
                break;
            case 'construction_complete':
                this._tone(440, 0.09, 'sine', vol * 0.32);
                this._tone(660, 0.13, 'sine', vol * 0.28, 0.1);
                break;
            case 'research_complete':
                this._tone(523, 0.1, 'sine', vol * 0.3);
                this._tone(659, 0.1, 'sine', vol * 0.3, 0.11);
                this._tone(784, 0.16, 'sine', vol * 0.32, 0.22);
                break;
            case 'bonus':
                // treasure jingle for bunker rewards
                this._tone(587, 0.08, 'sine', vol * 0.3);
                this._tone(740, 0.08, 'sine', vol * 0.3, 0.09);
                this._tone(880, 0.08, 'sine', vol * 0.3, 0.18);
                this._tone(1175, 0.18, 'sine', vol * 0.32, 0.27);
                break;
            case 'denied':
                this._tone(170, 0.13, 'sawtooth', vol * 0.28);
                break;
            case 'warn':
                this._tone(220, 0.11, 'square', vol * 0.32);
                this._tone(185, 0.13, 'square', vol * 0.28, 0.12);
                break;
            case 'victory':
                [523, 659, 784, 1047].forEach((f, i) => this._tone(f, i === 3 ? 0.4 : 0.14, 'sine', vol * 0.35, i * 0.15));
                break;
            case 'defeat':
                [392, 330, 262, 196].forEach((f, i) => this._tone(f, i === 3 ? 0.5 : 0.18, 'sine', vol * 0.35, i * 0.2));
                break;
        }
    },

    // Flame thrower: soft filtered-noise whoosh
    _playFlame(vol) {
        const ctx = this.ctx;
        const dur = 0.35;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(750, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + dur);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    // Rocket launch: noise burst + rising whistle
    _playRocket(vol) {
        const ctx = this.ctx;
        this._playExplosion(0.12, vol * 0.5);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(vol * 0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    },

    // Series 9 energy weapons: descending zap
    _playZap(vol) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(210, ctx.currentTime + 0.13);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
    },

    // Single enveloped tone, optionally delayed (building block for jingles)
    _tone(freq, duration, type, vol, delay = 0) {
        const ctx = this.ctx;
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.02);
    },

    _playAlert(vol) {
        const ctx = this.ctx;
        // Two urgent descending beeps
        [0, 0.18].forEach((t, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(i === 0 ? 880 : 660, ctx.currentTime + t);
            gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime + t);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + 0.15);
        });
    },

    _playShoot(freq, duration, vol) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    },

    _playExplosion(duration, vol) {
        const ctx = this.ctx;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // White noise with decay
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
    },

    _playClick(vol) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    },

    _playBuild(vol) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    },

    _playSelect(vol) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(800, ctx.currentTime + 0.03);

        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    }
};

// Initialize sound system
SoundManager.init();
const dpr = window.devicePixelRatio || 1;

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
    maxZoom: 2.0
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
    group1: [], group2: [], group3: [], group4: [], group5: []
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
    const hillCount = Math.floor((4 + Math.floor(Math.random() * 3)) * sizeMultiplier);
    for (let h = 0; h < hillCount; h++) {
        const centerX = 10 + Math.floor(Math.random() * (mapSize - 20));
        const centerY = 10 + Math.floor(Math.random() * (mapSize - 20));
        const hillSize = 2 + Math.floor(Math.random() * 3);

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
    return tile.type === 'grass';
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
let terrainCache = null;
let dustMotes = [];
// (the vignette/warm grade is a zero-cost CSS overlay: #vignette)

// Faint dust motes drifting across the wasteland
function drawDust() {
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    if (dustMotes.length === 0) {
        for (let i = 0; i < 16; i++) {
            dustMotes.push({
                x: Math.random() * cw, y: Math.random() * ch,
                vx: 0.25 + Math.random() * 0.4, vy: 0.08 + Math.random() * 0.15,
                size: 1 + Math.random() * 2, a: 0.05 + Math.random() * 0.08
            });
        }
    }
    ctx.fillStyle = '#f5e8c8';
    for (const m of dustMotes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x > cw + 4) { m.x = -4; m.y = Math.random() * ch; }
        if (m.y > ch + 4) { m.y = -4; }
        ctx.globalAlpha = m.a;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function buildTerrainCache() {
    const mapSize = getMapSize();
    const c = document.createElement('canvas');
    c.width = mapSize * TILE_WIDTH + TILE_WIDTH;
    c.height = mapSize * TILE_HEIGHT + TILE_HEIGHT;
    const tctx = c.getContext('2d');
    terrainCache = {
        canvas: c,
        ctx: tctx,
        originX: -(mapSize * TILE_WIDTH / 2) - TILE_WIDTH / 2,
        originY: -TILE_HEIGHT / 2
    };
    tctx.fillStyle = '#1a1a2e';
    tctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            drawTileToCache(x, y);
        }
    }
}

function tileCachePos(tx, ty) {
    return {
        x: (tx - ty) * (TILE_WIDTH / 2) - terrainCache.originX,
        y: (tx + ty) * (TILE_HEIGHT / 2) - terrainCache.originY
    };
}

// Repaint a tile and its neighbors in the cache (e.g. when a patch runs dry)
function redrawTerrainTile(tx, ty) {
    if (!terrainCache) return;
    const mapSize = getMapSize();
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = tx + dx, y = ty + dy;
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                drawTileToCache(x, y);
            }
        }
    }
}

function drawTerrain() {
    if (!terrainCache) return;
    const zoom = getZoom();
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;

    // View rectangle in cache pixel coordinates (zoom 1 iso space)
    let sx = (game.camera.x - cw / (2 * zoom)) - terrainCache.originX;
    let sy = (game.camera.y - ch / (2 * zoom)) - terrainCache.originY;
    let sw = cw / zoom;
    let sh = ch / zoom;
    let dx = 0, dy = 0;
    if (sx < 0) { dx = -sx * zoom; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy * zoom; sh += sy; sy = 0; }
    sw = Math.min(sw, terrainCache.canvas.width - sx);
    sh = Math.min(sh, terrainCache.canvas.height - sy);
    if (sw > 0 && sh > 0) {
        ctx.drawImage(terrainCache.canvas, sx, sy, sw, sh, dx, dy, sw * zoom, sh * zoom);
    }
}

// Animated oil bubbles on live patches (drawn over the static cache)
function drawOilAnimations() {
    if (!game.oilTiles) return;
    const zoom = getZoom();
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    for (const t of game.oilTiles) {
        const tile = game.map[t.y]?.[t.x];
        if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) continue;
        const screen = worldToScreen(t.x, t.y);
        if (screen.x < -50 || screen.x > cw + 50 || screen.y < -50 || screen.y > ch + 50) continue;

        const bubblePhase = (Date.now() / 900 + t.x * 1.7 + t.y) % 3;
        if (bubblePhase < 1) {
            ctx.fillStyle = 'rgba(110,120,90,0.5)';
            ctx.beginPath();
            ctx.arc(screen.x + 3 * zoom, screen.y - bubblePhase * 3 * zoom, (1.8 - bubblePhase) * zoom, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function render() {
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Screen shake: nudge the camera for this frame only
    let shakeX = 0, shakeY = 0;
    if (game.shake > 0.3 && game.status === 'PLAYING') {
        shakeX = (Math.random() - 0.5) * game.shake;
        shakeY = (Math.random() - 0.5) * game.shake;
        game.camera.x += shakeX;
        game.camera.y += shakeY;
    }
    game.shake = (game.shake || 0) * 0.88;

    // Terrain (cached) + animated oil patches
    drawTerrain();
    drawOilAnimations();
    drawDecals();
    drawBunkers();

    // Draw buildings and units together, sorted by isometric depth (x + y)
    const entities = [...game.buildings, ...game.units].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const entity of entities) {
        if (BUILDING_TYPES[entity.type] && game.buildings.includes(entity)) {
            drawBuilding(entity);
        } else {
            drawUnit(entity);
        }
    }

    // Move/attack order feedback markers
    drawOrderMarkers();

    // Draw projectiles
    for (const proj of game.projectiles) {
        drawProjectile(proj);
    }

    // Draw particles
    for (const particle of game.particles) {
        drawParticle(particle);
    }

    // Draw floating damage numbers
    drawDamageNumbers();

    // Draw selection box
    if (game.selectionBox) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            game.selectionBox.x1,
            game.selectionBox.y1,
            game.selectionBox.x2 - game.selectionBox.x1,
            game.selectionBox.y2 - game.selectionBox.y1
        );
        ctx.setLineDash([]);
    }

    // While placing a derrick: spotlight every live oil patch
    if (game.placingBuilding && BUILDING_TYPES[game.placingBuilding]?.needsOil && game.oilTiles) {
        const zoom = getZoom();
        const pulse = (Date.now() / 700) % 1;
        for (const t of game.oilTiles) {
            const tile = game.map[t.y]?.[t.x];
            if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) continue;
            const s = worldToScreen(t.x, t.y);
            if (s.x < -60 || s.x > canvas.offsetWidth + 60 || s.y < -60 || s.y > canvas.offsetHeight + 60) continue;
            ctx.strokeStyle = `rgba(255,204,68,${0.9 - pulse * 0.5})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, (16 + pulse * 6) * zoom, (8 + pulse * 3) * zoom, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Draw building placement preview
    if (game.placingBuilding) {
        const world = screenToWorld(game.mouse.x, game.mouse.y);
        const tx = Math.floor(world.x);
        const ty = Math.floor(world.y);

        const isValid = canBuildAt(game.placingBuilding, tx, ty) &&
                        game.players[0].oil >= BUILDING_TYPES[game.placingBuilding].cost;

        drawBuildingPreview(game.placingBuilding, tx, ty, isValid);
    }

    // Atmosphere: drifting dust motes
    if (game.status === 'PLAYING' || game.status === 'PAUSED') {
        drawDust();
    }

    // Guided-start overlays
    drawObjectiveGuides();
    drawObjectives();

    // Event banner (attack waves, bunker rewards, scavengers)
    drawBanner();

    // Attack-move mode: persistent status hint above the footer
    if (game.attackMoveMode) {
        ctx.save();
        ctx.font = 'bold 13px Rajdhani, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = 'ATTACK-MOVE: left-click a target area  (Esc / right-click cancels)';
        const w = ctx.measureText(text).width + 30;
        const cx = canvas.offsetWidth / 2;
        const cy = canvas.offsetHeight - 26;
        ctx.fillStyle = 'rgba(60,12,8,0.8)';
        ctx.fillRect(cx - w / 2, cy - 12, w, 24);
        ctx.strokeStyle = '#ff5533';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - w / 2, cy - 12, w, 24);
        ctx.fillStyle = '#ff8866';
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }

    // Undo the shake offset
    game.camera.x -= shakeX;
    game.camera.y -= shakeY;

    // Draw minimap
    renderMinimap();
}

// ============================================
// BATTLEFIELD DECALS (wrecks, splats, scorch)
// Persist for a while after fights, then fade.
// ============================================

function addDecal(decal) {
    if (!game.decals) game.decals = [];
    decal.maxLife = decal.life;
    game.decals.push(decal);
    if (game.decals.length > 60) game.decals.shift();
}

function drawDecals() {
    if (!game.decals) return;
    const zoom = getZoom();
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    for (const d of game.decals) {
        const s = worldToScreen(d.x, d.y);
        if (s.x < -140 || s.x > cw + 140 || s.y < -140 || s.y > ch + 140) continue;
        const alpha = Math.min(1, d.life / 10);
        ctx.globalAlpha = alpha;

        if (d.type === 'wreck') {
            const spr = IsoSprites.wreckSprite(d.role, d.faction, d.dir);
            ctx.drawImage(spr,
                s.x - spr.anchorX * zoom, s.y - spr.anchorY * zoom,
                spr.width * zoom, spr.height * zoom);
            // dwindling smoke from fresh wrecks
            if (d.maxLife - d.life < 6 && Math.random() < 0.12) {
                game.particles.push({
                    x: d.x, y: d.y, z: 6,
                    vx: (Math.random() - 0.5) * 0.04, vy: (Math.random() - 0.5) * 0.04,
                    vz: 0.15, color: '#44403a', size: 4 + Math.random() * 3,
                    life: 1, type: 'smoke'
                });
            }
        } else if (d.type === 'splat') {
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 7 * zoom, 3.5 * zoom, 0, 0, Math.PI * 2);
            ctx.fill();
            for (const [ox, oy, r] of d.drops) {
                ctx.beginPath();
                ctx.ellipse(s.x + ox * zoom, s.y + oy * zoom, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (d.type === 'scorch') {
            const grad = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, d.size * zoom);
            grad.addColorStop(0, 'rgba(14,10,8,0.75)');
            grad.addColorStop(0.6, 'rgba(24,18,12,0.45)');
            grad.addColorStop(1, 'rgba(30,24,16,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, d.size * zoom, d.size * 0.5 * zoom, 0, 0, Math.PI * 2);
            ctx.fill();
            // rubble chunks
            ctx.fillStyle = '#4c463e';
            for (const [ox, oy, r, rot] of d.rubble) {
                ctx.save();
                ctx.translate(s.x + ox * zoom, s.y + oy * zoom);
                ctx.rotate(rot);
                ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
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
        SoundManager.play('construction_complete');
    }
}

// Objective panel (top-left) + completed flash
function drawObjectives() {
    const obj = currentObjective();
    const flash = game.objectiveFlash && Date.now() < game.objectiveFlash.until ? game.objectiveFlash : null;
    if (!obj && !flash) return;

    ctx.save();
    ctx.font = 'bold 13px Rajdhani, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = 16;

    if (flash) {
        const text = '\u2714 ' + flash.text;
        const w = ctx.measureText(text).width + 24;
        ctx.globalAlpha = Math.min(1, (flash.until - Date.now()) / 600);
        ctx.fillStyle = 'rgba(10,26,12,0.8)';
        ctx.fillRect(10, y - 12, w, 24);
        ctx.strokeStyle = '#44dd66';
        ctx.strokeRect(10, y - 12, w, 24);
        ctx.fillStyle = '#66ee88';
        ctx.fillText(text, 22, y + 1);
        ctx.globalAlpha = 1;
        y += 30;
    }

    if (obj) {
        ctx.font = 'bold 11px Rajdhani, Arial';
        ctx.fillStyle = '#ffaa33';
        ctx.fillText('OBJECTIVE', 22, y + 1);
        y += 18;
        ctx.font = 'bold 13px Rajdhani, Arial';
        const w = ctx.measureText(obj.text).width + 24;
        ctx.fillStyle = 'rgba(12,12,20,0.78)';
        ctx.fillRect(10, y - 13, w, 26);
        ctx.strokeStyle = 'rgba(255,170,51,0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, y - 13, w, 26);
        ctx.fillStyle = '#ffd890';
        ctx.fillText(obj.text, 22, y + 1);
    }
    ctx.restore();
}

// Bouncing golden arrow above a world position; clamps to the
// screen edge and points toward the target when it is off-screen
function drawGuideArrow(wx, wy) {
    const zoom = getZoom();
    const s = worldToScreen(wx, wy);
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    const bob = Math.sin(Date.now() / 240) * 5;

    const onScreen = s.x > 30 && s.x < cw - 30 && s.y > 60 && s.y < ch - 40;
    let x = s.x, y = s.y, angle = Math.PI / 2; // pointing down at target
    if (!onScreen) {
        const cx = cw / 2, cy = ch / 2;
        angle = Math.atan2(s.y - cy, s.x - cx);
        const margin = 44;
        x = Math.max(margin, Math.min(cw - margin, s.x));
        y = Math.max(70, Math.min(ch - 50, s.y));
    }

    ctx.save();
    ctx.translate(x, y - (onScreen ? 34 * zoom + bob : 0));
    ctx.rotate(onScreen ? Math.PI / 2 : angle);
    ctx.fillStyle = '#ffcc44';
    ctx.strokeStyle = '#7a5a10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Ground ring when the target is visible
    if (onScreen) {
        const pulse = (Date.now() / 900) % 1;
        ctx.strokeStyle = `rgba(255,204,68,${0.8 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, (8 + pulse * 16) * zoom, (4 + pulse * 8) * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

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

// Generic minimap pings (bunker claims, raids, dried-up patches)
function addPing(x, y, color) {
    if (!game.pings) game.pings = [];
    game.pings.push({ x, y, color, time: Date.now() });
    if (game.pings.length > 8) game.pings.shift();
}

function setBanner(text, seconds = 4, color = '#ffcc44') {
    game.banner = { text, color, until: Date.now() + seconds * 1000 };
}

function drawBanner() {
    if (!game.banner || Date.now() > game.banner.until) return;
    const left = game.banner.until - Date.now();
    const alpha = Math.min(1, left / 800);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 16px Rajdhani, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(game.banner.text).width + 40;
    const cx = canvas.offsetWidth / 2;
    ctx.fillStyle = 'rgba(10,10,18,0.75)';
    ctx.fillRect(cx - w / 2, 14, w, 30);
    ctx.strokeStyle = game.banner.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, 14, w, 30);
    ctx.fillStyle = game.banner.color;
    ctx.fillText(game.banner.text, cx, 29);
    ctx.restore();
}

// Neutral tech bunkers (drawn between terrain and entities)
function drawBunkers() {
    if (!game.bunkers) return;
    const zoom = getZoom();
    for (const b of game.bunkers) {
        const screen = worldToScreen(b.x, b.y);
        if (screen.x < -120 || screen.x > canvas.offsetWidth + 120 ||
            screen.y < -140 || screen.y > canvas.offsetHeight + 80) continue;
        const sprite = IsoSprites.buildingSprite('bunker', 'survivors', b.claimed ? 1 : 0);
        const bscale = zoom * 0.65;
        ctx.drawImage(sprite,
            screen.x - sprite.anchorX * bscale,
            screen.y - sprite.anchorY * bscale,
            sprite.width * bscale,
            sprite.height * bscale);
        // Beckoning pulse while unclaimed
        if (!b.claimed) {
            const pulse = (Date.now() / 1200 + b.x) % 1;
            ctx.strokeStyle = `rgba(102,224,255,${0.7 * (1 - pulse)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(screen.x, screen.y, (8 + pulse * 22) * zoom, (4 + pulse * 11) * zoom, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Pulsing rings confirming move (green) and attack (red) orders
function drawOrderMarkers() {
    if (!game.orderMarkers) return;
    for (const m of game.orderMarkers) {
        const screen = worldToScreen(m.x, m.y);
        const t = 1 - m.life; // 0 -> 1
        const zoom = getZoom();
        const r = (4 + t * 14) * zoom;
        ctx.globalAlpha = m.life * 0.9;
        ctx.strokeStyle = m.kind === 'attack' ? '#ff5533' : '#33ff55';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

function addOrderMarker(x, y, kind) {
    if (!game.orderMarkers) game.orderMarkers = [];
    game.orderMarkers.push({ x, y, kind, life: 1 });
}

function drawBuildingPreview(buildingType, tx, ty, isValid) {
    const type = BUILDING_TYPES[buildingType];
    if (!type) return;

    const zoom = getZoom();
    const screen = worldToScreen(tx, ty);
    const color = isValid ? '#44ff66' : '#ff4444';

    // Footprint diamond (in world tiles)
    const half = type.size / 2;
    const c1 = worldToScreen(tx - half, ty - half);
    const c2 = worldToScreen(tx + half, ty - half);
    const c3 = worldToScreen(tx + half, ty + half);
    const c4 = worldToScreen(tx - half, ty + half);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ghost sprite of the building
    const faction = getFaction(0);
    const sprite = IsoSprites.buildingSprite(buildingType, faction, 0);
    const bscale = zoom * 0.65;
    ctx.globalAlpha = isValid ? 0.65 : 0.35;
    ctx.drawImage(sprite,
        screen.x - sprite.anchorX * bscale,
        screen.y - sprite.anchorY * bscale,
        sprite.width * bscale,
        sprite.height * bscale);
    ctx.globalAlpha = 1;

    // Range indicator for towers
    if (type.range) {
        ctx.strokeStyle = isValid ? 'rgba(68,255,102,0.35)' : 'rgba(255,68,68,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rangeRadius = (type.range / 32) * (TILE_WIDTH / 2) * zoom * 0.5;
        ctx.ellipse(screen.x, screen.y, rangeRadius, rangeRadius * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (!isValid) {
        ctx.fillStyle = '#ff5555';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const msg = type.needsOil ? 'MUST BE PLACED ON AN OIL PATCH' : 'CANNOT BUILD HERE';
        ctx.fillText(msg, screen.x, screen.y + 30 * zoom);
    }
}

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

// Render one tile into the terrain cache (fixed zoom 1)
function drawTileToCache(tx, ty) {
    const tile = game.map[ty]?.[tx];
    if (!tile || !terrainCache) return;

    const c = terrainCache.ctx;
    const pos = tileCachePos(tx, ty);
    const tileW = TILE_WIDTH;
    const tileH = TILE_HEIGHT;

    // Post-apocalyptic wasteland palette
    const baseColors = {
        grass: { r: 133, g: 113, b: 78 },   // dusty plains
        sand: { r: 160, g: 128, b: 80 },
        rock: { r: 96, g: 96, b: 96 },
        water: { r: 58, g: 92, b: 102 },    // murky water
        hill: { r: 104, g: 82, b: 58 }      // rocky outcrop
    };

    const base = baseColors[tile.type] || baseColors.grass;

    // Smooth large-scale tonal patches + a touch of per-tile grain
    // (kills the checkerboard look of pure per-tile randomness)
    const variation = (smoothNoise(tx / 5, ty / 5) - 0.5) * 36 +
                      (tileRandom(tx, ty) - 0.5) * 8;
    let r = Math.max(0, Math.min(255, base.r + variation));
    let g = Math.max(0, Math.min(255, base.g + variation));
    let b = Math.max(0, Math.min(255, base.b + variation));

    // Height shading
    if (tile.height > 0) {
        r = Math.min(255, r * 1.15);
        g = Math.min(255, g * 1.15);
        b = Math.min(255, b * 1.15);
    } else if (tile.height < 0) {
        r *= 0.85;
        g *= 0.85;
        b *= 0.85;
    }

    // Draw isometric tile base
    c.beginPath();
    c.moveTo(pos.x, pos.y - tileH / 2);
    c.lineTo(pos.x + tileW / 2, pos.y);
    c.lineTo(pos.x, pos.y + tileH / 2);
    c.lineTo(pos.x - tileW / 2, pos.y);
    c.closePath();
    c.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    c.fill();

    // Edge shadows for depth
    c.beginPath();
    c.moveTo(pos.x, pos.y + tileH / 2);
    c.lineTo(pos.x - tileW / 2, pos.y);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1;
    c.stroke();

    c.beginPath();
    c.moveTo(pos.x, pos.y + tileH / 2);
    c.lineTo(pos.x + tileW / 2, pos.y);
    c.strokeStyle = 'rgba(0,0,0,0.15)';
    c.stroke();

    // Shore foam on water edges that touch land
    if (tile.type === 'water') {
        const corners = {
            top: [pos.x, pos.y - tileH / 2],
            right: [pos.x + tileW / 2, pos.y],
            bottom: [pos.x, pos.y + tileH / 2],
            left: [pos.x - tileW / 2, pos.y]
        };
        const edges = [
            { n: [tx, ty - 1], a: corners.top, b: corners.right },
            { n: [tx + 1, ty], a: corners.right, b: corners.bottom },
            { n: [tx, ty + 1], a: corners.bottom, b: corners.left },
            { n: [tx - 1, ty], a: corners.left, b: corners.top }
        ];
        c.strokeStyle = 'rgba(205,235,240,0.55)';
        c.lineWidth = 2;
        for (const e of edges) {
            const nb = game.map[e.n[1]]?.[e.n[0]];
            if (nb && nb.type !== 'water') {
                c.beginPath();
                c.moveTo(e.a[0] + (pos.x - e.a[0]) * 0.06, e.a[1] + (pos.y - e.a[1]) * 0.06);
                c.lineTo(e.b[0] + (pos.x - e.b[0]) * 0.06, e.b[1] + (pos.y - e.b[1]) * 0.06);
                c.stroke();
            }
        }
    }

    drawTileDetailsToCache(c, tx, ty, tile.type, pos);

    // Scattered wasteland props (deterministic, plains only, never on oil)
    if (tile.type === 'grass' && !tile.oil) {
        const r7 = tileRandom(tx, ty, 7);
        if (r7 < 0.03) {
            // small rock cluster
            for (let i = 0; i < 3; i++) {
                const ox = (tileRandom(tx, ty, 20 + i) - 0.5) * 18;
                const oy = (tileRandom(tx, ty, 30 + i) - 0.5) * 9;
                const rw = 2.5 + tileRandom(tx, ty, 40 + i) * 3.5;
                c.fillStyle = '#6d6154';
                c.beginPath();
                c.ellipse(pos.x + ox, pos.y + oy, rw, rw * 0.6, 0, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = '#8d8172';
                c.beginPath();
                c.ellipse(pos.x + ox - rw * 0.25, pos.y + oy - rw * 0.3, rw * 0.5, rw * 0.3, 0, 0, Math.PI * 2);
                c.fill();
            }
        } else if (r7 < 0.05) {
            // dead bush
            c.strokeStyle = 'rgba(74,56,34,0.85)';
            c.lineWidth = 1.2;
            for (let i = 0; i < 5; i++) {
                const ang = -Math.PI * 0.15 - (i / 5) * Math.PI * 0.7;
                const len = 5 + tileRandom(tx, ty, 50 + i) * 5;
                c.beginPath();
                c.moveTo(pos.x, pos.y + 2);
                c.quadraticCurveTo(
                    pos.x + Math.cos(ang) * len * 0.5, pos.y + 2 + Math.sin(ang) * len * 0.7,
                    pos.x + Math.cos(ang) * len, pos.y + 2 + Math.sin(ang) * len);
                c.stroke();
            }
        } else if (r7 < 0.062) {
            // bleached bones
            c.strokeStyle = 'rgba(222,214,190,0.8)';
            c.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                c.beginPath();
                c.arc(pos.x - 4 + i * 4, pos.y, 3.5 - i * 0.5, Math.PI * 0.15, Math.PI * 0.85);
                c.stroke();
            }
            c.fillStyle = 'rgba(222,214,190,0.85)';
            c.beginPath();
            c.ellipse(pos.x + 8, pos.y - 1, 2.5, 1.8, 0.3, 0, Math.PI * 2);
            c.fill();
        } else if (r7 < 0.09) {
            // cracked, parched earth
            c.strokeStyle = 'rgba(60,48,30,0.4)';
            c.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const sx0 = pos.x + (tileRandom(tx, ty, 60 + i) - 0.5) * 20;
                const sy0 = pos.y + (tileRandom(tx, ty, 70 + i) - 0.5) * 10;
                c.beginPath();
                c.moveTo(sx0, sy0);
                c.lineTo(sx0 + (tileRandom(tx, ty, 80 + i) - 0.5) * 14, sy0 + (tileRandom(tx, ty, 90 + i) - 0.5) * 7);
                c.lineTo(sx0 + (tileRandom(tx, ty, 100 + i) - 0.5) * 18, sy0 + (tileRandom(tx, ty, 110 + i) - 0.5) * 9);
                c.stroke();
            }
        }
    }

    // Static oil pool (bubbles are animated separately)
    if (tile.oil) {
        const depleted = tile.oilAmount !== undefined && tile.oilAmount <= 0;
        const poolR = depleted ? 8 : 14;

        c.fillStyle = 'rgba(40,36,22,0.45)';
        c.beginPath();
        c.ellipse(pos.x, pos.y + 1, poolR + 6, (poolR + 6) * 0.55, 0, 0, Math.PI * 2);
        c.fill();

        c.fillStyle = depleted ? 'rgba(30,28,20,0.7)' : 'rgba(16,18,10,0.92)';
        c.beginPath();
        c.ellipse(pos.x, pos.y + 1, poolR, poolR * 0.55, 0, 0, Math.PI * 2);
        c.fill();

        if (!depleted) {
            c.fillStyle = 'rgba(70,90,60,0.45)';
            c.beginPath();
            c.ellipse(pos.x - 3, pos.y - 1, 6, 3, -0.3, 0, Math.PI * 2);
            c.fill();
        }
    }
}

function drawTileDetailsToCache(c, tx, ty, tileType, pos) {
    const detailCount = 3 + Math.floor(tileRandom(tx, ty, 1) * 3);

    switch (tileType) {
        case 'grass':
            // Dry scrub tufts
            c.strokeStyle = 'rgba(88,78,44,0.6)';
            c.lineWidth = 1;
            for (let i = 0; i < detailCount; i++) {
                const ox = (tileRandom(tx, ty, i * 2) - 0.5) * 20;
                const oy = (tileRandom(tx, ty, i * 2 + 1) - 0.5) * 10;
                const height = 3 + tileRandom(tx, ty, i * 3) * 4;
                const bend = (tileRandom(tx, ty, i * 4) - 0.5) * 3;

                c.beginPath();
                c.moveTo(pos.x + ox, pos.y + oy);
                c.quadraticCurveTo(
                    pos.x + ox + bend, pos.y + oy - height / 2,
                    pos.x + ox + bend * 1.5, pos.y + oy - height
                );
                c.stroke();
            }
            break;

        case 'sand':
            c.fillStyle = 'rgba(140,110,70,0.5)';
            for (let i = 0; i < detailCount; i++) {
                const ox = (tileRandom(tx, ty, i * 2) - 0.5) * 24;
                const oy = (tileRandom(tx, ty, i * 2 + 1) - 0.5) * 12;
                const size = 1 + tileRandom(tx, ty, i * 3);

                c.beginPath();
                c.arc(pos.x + ox, pos.y + oy, size, 0, Math.PI * 2);
                c.fill();
            }
            break;

        case 'rock':
            c.strokeStyle = 'rgba(40,40,40,0.4)';
            c.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                const ox = (tileRandom(tx, ty, i * 5) - 0.5) * 20;
                const oy = (tileRandom(tx, ty, i * 5 + 1) - 0.5) * 10;
                const len = 5 + tileRandom(tx, ty, i * 5 + 2) * 8;
                const angle = tileRandom(tx, ty, i * 5 + 3) * Math.PI;

                c.beginPath();
                c.moveTo(pos.x + ox, pos.y + oy);
                c.lineTo(pos.x + ox + Math.cos(angle) * len, pos.y + oy + Math.sin(angle) * len * 0.5);
                c.stroke();
            }
            break;

        case 'water':
            // Static wave lines (baked)
            c.strokeStyle = 'rgba(150,200,255,0.35)';
            c.lineWidth = 1;
            for (let i = 0; i < 2; i++) {
                const oy = (i - 0.5) * 8;
                const phase = tileRandom(tx, ty, 50 + i) * 4 - 2;
                c.beginPath();
                c.moveTo(pos.x - 12, pos.y + oy);
                c.quadraticCurveTo(pos.x, pos.y + oy + phase, pos.x + 12, pos.y + oy);
                c.stroke();
            }
            break;

        case 'hill':
            // Rocky outcrop boulders
            c.fillStyle = 'rgba(80,58,32,0.5)';
            for (let i = 0; i < detailCount; i++) {
                const ox = (tileRandom(tx, ty, i * 2) - 0.5) * 22;
                const oy = (tileRandom(tx, ty, i * 2 + 1) - 0.5) * 11;
                const w = 2 + tileRandom(tx, ty, i * 3) * 4;
                const h = 1 + tileRandom(tx, ty, i * 3 + 1) * 2.5;

                c.beginPath();
                c.ellipse(pos.x + ox, pos.y + oy - h, w, h, 0, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = 'rgba(140,112,76,0.4)';
                c.beginPath();
                c.ellipse(pos.x + ox - w * 0.25, pos.y + oy - h * 1.4, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = 'rgba(80,58,32,0.5)';
            }
            break;
    }
}

function drawBuilding(building) {
    const type = BUILDING_TYPES[building.type];
    const screen = worldToScreen(building.x, building.y);
    const zoom = getZoom();
    const faction = getFaction(building.playerId);

    // Animation frame: pumping derricks + blinking lights on everything else
    let frame = 0;
    if (!building.isUnderConstruction) {
        frame = Math.floor(game.tick / 40) % 2;
        // A dried-up derrick stops pumping
        if (building.type === 'derrick' && building.oilLeft === 0) frame = 0;
    }

    const sprite = IsoSprites.buildingSprite(building.type, faction, frame);
    const bscale = zoom * 0.65; // buildings drawn well inside their footprint
    const dx = screen.x - sprite.anchorX * bscale;
    const dy = screen.y - sprite.anchorY * bscale;
    const dw = sprite.width * bscale;
    const dh = sprite.height * bscale;

    if (building.isUnderConstruction) {
        const progress = building.buildProgress / building.buildTime;
        // Building rises out of the ground while being constructed
        ctx.save();
        ctx.globalAlpha = 0.45 + progress * 0.55;
        const visible = dh * (0.25 + progress * 0.75);
        ctx.beginPath();
        ctx.rect(dx - 4, dy + dh - visible, dw + 8, visible);
        ctx.clip();
        ctx.drawImage(sprite, dx, dy, dw, dh);
        ctx.restore();

        // Construction progress bar
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - 24, screen.y - 8, 48, 5);
        ctx.fillStyle = '#ffaa22';
        ctx.fillRect(screen.x - 24, screen.y - 8, 48 * progress, 5);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x - 24, screen.y - 8, 48, 5);
        return;
    }

    ctx.drawImage(sprite, dx, dy, dw, dh);

    const barY = dy - 2;

    // Health bar (only when damaged or selected)
    const isSelected = game.selection.includes(building);
    if (building.hp < type.hp || isSelected) {
        const hpPercent = Math.max(0, building.hp / type.hp);
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - 24, barY, 48, 4);
        ctx.fillStyle = hpPercent > 0.5 ? '#33dd44' : hpPercent > 0.25 ? '#ffcc00' : '#ff3333';
        ctx.fillRect(screen.x - 24, barY, 48 * hpPercent, 4);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x - 24, barY, 48, 4);
    }

    // Selection: footprint diamond outline
    if (isSelected) {
        const half = type.size / 2;
        const c1 = worldToScreen(building.x - half, building.y - half);
        const c2 = worldToScreen(building.x + half, building.y - half);
        const c3 = worldToScreen(building.x + half, building.y + half);
        const c4 = worldToScreen(building.x - half, building.y + half);
        ctx.save();
        ctx.shadowColor = '#33ff55';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#33ff55';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.lineTo(c4.x, c4.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    // Derrick: remaining patch reserves
    if (building.type === 'derrick' && building.oilStart) {
        const left = Math.max(0, (building.oilLeft || 0) / building.oilStart);
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - 16, screen.y + 6, 32, 3);
        ctx.fillStyle = left > 0 ? '#cfae3a' : '#553f20';
        ctx.fillRect(screen.x - 16, screen.y + 6, 32 * left, 3);
    }

    // Range ring for selected defensive towers
    if (isSelected && type.range) {
        const rT = rangeT(type);
        ctx.strokeStyle = 'rgba(255,140,80,0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, rT * (TILE_WIDTH / 2) * zoom, rT * (TILE_HEIGHT / 2) * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Production / research progress
    if (building.productionQueue.length > 0) {
        const progress = building.produceProgress / building.produceTime;
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - 18, screen.y + 11, 36, 3);
        ctx.fillStyle = '#33ccff';
        ctx.fillRect(screen.x - 18, screen.y + 11, 36 * progress, 3);
    } else if (building.researching) {
        const progress = building.researching.progress / building.researching.time;
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - 18, screen.y + 11, 36, 3);
        ctx.fillStyle = '#cc66ff';
        ctx.fillRect(screen.x - 18, screen.y + 11, 36 * progress, 3);
    }

    // Rally point line for selected production buildings
    if (isSelected && building.rallyX !== undefined && type.produces.length > 0) {
        const rally = worldToScreen(building.rallyX, building.rallyY);
        ctx.strokeStyle = 'rgba(51,255,85,0.5)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(rally.x, rally.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#33ff55';
        ctx.beginPath();
        ctx.arc(rally.x, rally.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawUnit(unit) {
    const type = UNIT_TYPES[unit.type];
    const screen = worldToScreen(unit.x, unit.y);
    const zoom = getZoom();
    const faction = getFaction(unit.playerId);

    const dir = IsoSprites.dirFromAngle(unit.angle || 0);
    const sprite = IsoSprites.unitSprite(unit.type, faction, dir);

    const isSelected = game.selection.includes(unit);

    // Selection: glowing double ring under the unit
    if (isSelected) {
        const col = unit.playerId === 0 ? '#33ff55' : '#ff5533';
        const rx = (type.size + 6) * zoom, ry = (type.size + 6) * 0.5 * zoom;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 7;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 2 * zoom, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = IsoSprites.withAlpha(col, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 2 * zoom, rx * 0.75, ry * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.drawImage(sprite,
        screen.x - sprite.anchorX * zoom,
        screen.y - sprite.anchorY * zoom,
        sprite.width * zoom,
        sprite.height * zoom);

    // Health bar (damaged or selected)
    const hpPercent = Math.max(0, unit.hp / type.hp);
    if (hpPercent < 1 || isSelected) {
        const barWidth = 22;
        const barY = screen.y - (type.size + 22) * zoom;
        ctx.fillStyle = '#222';
        ctx.fillRect(screen.x - barWidth / 2, barY, barWidth, 3);
        ctx.fillStyle = hpPercent > 0.6 ? '#33dd44' : hpPercent > 0.3 ? '#ffcc00' : '#ff3333';
        ctx.fillRect(screen.x - barWidth / 2, barY, barWidth * hpPercent, 3);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(screen.x - barWidth / 2, barY, barWidth, 3);
    }

    // Range ring for selected siege units
    if (isSelected && unit.type === 'artillery') {
        const rT = rangeT(type);
        ctx.strokeStyle = 'rgba(255,140,80,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, rT * (TILE_WIDTH / 2) * zoom, rT * (TILE_HEIGHT / 2) * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Veterancy chevrons
    const rank = veterancyRank(unit.kills);
    if (rank > 0) {
        ctx.fillStyle = '#ffd14a';
        const cy = screen.y - (type.size + 27) * zoom;
        for (let i = 0; i < rank; i++) {
            const cx = screen.x - (rank - 1) * 4 + i * 8;
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy + 3);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + 3, cy + 3);
            ctx.lineTo(cx, cy + 1.5);
            ctx.closePath();
            ctx.fill();
        }
    }

}

function drawProjectile(proj) {
    const screen = worldToScreen(proj.x, proj.y);
    const zoom = getZoom();

    // Faction flavor: Survivors ballistic, Evolved organic, Series 9 energy
    const faction = proj.faction || 'survivors';
    const glow = faction === 'series9' ? '#4dffa6' : (faction === 'evolved' ? '#9dff7a' : '#ffcc66');

    switch (proj.weapon) {

        case 'flame': {
            // Flickering flame gout growing along its path
            const cool = faction === 'series9'; // Weed Killer sprays green chems
            const colors = cool
                ? ['#c4ffda', '#7dffb0', '#3fd98a']
                : ['#ffe9b0', '#ffaa33', '#ff6611'];
            for (let i = 0; i < 3; i++) {
                const jx = (Math.random() - 0.5) * 6 * zoom;
                const jy = (Math.random() - 0.5) * 4 * zoom;
                ctx.globalAlpha = 0.75 - i * 0.2;
                ctx.fillStyle = colors[i];
                ctx.beginPath();
                ctx.arc(screen.x + jx - proj.vx * i * 8, screen.y + jy - proj.vy * i * 8,
                    (4.5 - i) * zoom, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            break;
        }

        case 'rocket': {
            // Missile: dark body, bright exhaust, trailing smoke puffs
            const ang = Math.atan2(proj.vy, proj.vx);
            for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = 0.35 - i * 0.09;
                ctx.fillStyle = '#999999';
                ctx.beginPath();
                ctx.arc(screen.x - proj.vx * i * 22, screen.y - proj.vy * i * 22,
                    (2 + i) * zoom, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = faction === 'evolved' ? '#c9b896' : '#556';
            ctx.lineWidth = 3.5 * zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(screen.x - Math.cos(ang) * 8 * zoom, screen.y - Math.sin(ang) * 8 * zoom);
            ctx.stroke();
            ctx.fillStyle = glow;
            ctx.shadowColor = glow;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(screen.x - Math.cos(ang) * 9 * zoom, screen.y - Math.sin(ang) * 9 * zoom,
                2.2 * zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;
        }

        case 'cannon': {
            if (faction === 'series9') {
                // Plasma lance: long glowing bolt
                const trail = 16;
                const grad = ctx.createLinearGradient(
                    screen.x, screen.y,
                    screen.x - proj.vx * trail, screen.y - proj.vy * trail);
                grad.addColorStop(0, '#eafff4');
                grad.addColorStop(0.4, glow);
                grad.addColorStop(1, 'transparent');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 3.5 * zoom;
                ctx.lineCap = 'round';
                ctx.shadowColor = glow;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(screen.x - proj.vx * trail, screen.y - proj.vy * trail);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                // Solid shell with a short motion blur
                ctx.strokeStyle = 'rgba(70,70,60,0.5)';
                ctx.lineWidth = 3 * zoom;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(screen.x, screen.y);
                ctx.lineTo(screen.x - proj.vx * 10, screen.y - proj.vy * 10);
                ctx.stroke();
                ctx.fillStyle = faction === 'evolved' ? '#d8cfae' : '#c8c8b8';
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, 2.6 * zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(screen.x - 0.8, screen.y - 0.8, 1 * zoom, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }

        case 'arty': {
            // Arcing siege shell with smoke trail
            const progress = 1 - (proj.life / 100);
            const arcY = -Math.sin(Math.min(1, progress * 2.5) * Math.PI) * 28 * zoom;

            for (let i = 5; i >= 0; i--) {
                ctx.globalAlpha = (5 - i) / 10;
                ctx.fillStyle = faction === 'evolved' ? '#8a9a6a' : '#888888';
                ctx.beginPath();
                ctx.arc(screen.x - proj.vx * i * 14, screen.y - proj.vy * i * 14 + arcY,
                    (2 + i * 0.4) * zoom, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            const shellCol = faction === 'series9' ? glow : (faction === 'evolved' ? '#b8e070' : '#ffaa44');
            ctx.fillStyle = shellCol;
            ctx.shadowColor = shellCol;
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y + arcY, 3.4 * zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y + arcY, 1.5 * zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            break;
        }

        default: {
            // mg: tracer round; needles for Evolved, energy dash for Series 9
            const trail = 8;
            let color;
            if (faction === 'series9') {
                color = glow;
                ctx.shadowColor = glow;
                ctx.shadowBlur = 6;
            } else if (faction === 'evolved') {
                color = '#e8dfc0'; // bone needle
            } else {
                color = '#ffe9a0'; // brass tracer
            }
            const grad = ctx.createLinearGradient(
                screen.x, screen.y,
                screen.x - proj.vx * trail, screen.y - proj.vy * trail);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
            ctx.strokeStyle = grad;
            ctx.lineWidth = (faction === 'evolved' ? 2.4 : 1.8) * zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(screen.x - proj.vx * trail, screen.y - proj.vy * trail);
            ctx.stroke();
            ctx.shadowBlur = 0;
            break;
        }
    }
}

function drawParticle(particle) {
    const screen = worldToScreen(particle.x, particle.y);
    const screenY = screen.y - particle.z;

    switch (particle.type) {
        case 'flash':
            // White-hot flash with intense glow
            ctx.globalAlpha = Math.min(1, particle.life * 2);
            ctx.fillStyle = particle.color;
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(screen.x, screenY, particle.size * (1 + (1 - particle.life) * 0.5), 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'explosion':
            // Fire particles with glow
            ctx.globalAlpha = Math.max(0, particle.life) * 0.9;
            ctx.fillStyle = particle.color;
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(screen.x, screenY, particle.size, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'spark':
            // Bright, small sparks with trails
            ctx.globalAlpha = Math.max(0, particle.life);
            ctx.strokeStyle = particle.color;
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = 6;
            ctx.lineWidth = particle.size;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(screen.x, screenY);
            ctx.lineTo(screen.x - particle.vx * 4, screenY - particle.vy * 4 + particle.vz * 2);
            ctx.stroke();
            break;

        case 'smoke':
            // Soft smoke puffs that expand
            const smokeSize = particle.size * (1 + (1 - particle.life) * 0.8);
            ctx.globalAlpha = Math.max(0, particle.life * 0.5);
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(screen.x, screenY, smokeSize, 0, Math.PI * 2);
            ctx.fill();
            break;

        case 'debris':
            // Small debris chunks
            ctx.globalAlpha = Math.max(0, particle.life) * 0.8;
            ctx.fillStyle = particle.color;
            ctx.save();
            ctx.translate(screen.x, screenY);
            ctx.rotate(particle.life * 10); // Spin
            ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            ctx.restore();
            break;

        case 'shockwave':
            // Expanding ring
            const ringSize = (1 - particle.life) * (particle.maxR || 30) + 5;
            ctx.globalAlpha = particle.life * 0.6;
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screen.x, screenY, ringSize, 0, Math.PI * 2);
            ctx.stroke();
            break;

        default:
            // Default particle rendering
            ctx.globalAlpha = Math.max(0, particle.life) * 0.8;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(screen.x, screenY, particle.size, 0, Math.PI * 2);
            ctx.fill();
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function renderMinimap() {
    // Use full minimap canvas size to show entire map
    const minimapSize = Math.min(minimapCanvas.width, minimapCanvas.height);
    const scale = minimapSize / getMapSize();

    minimapCtx.fillStyle = '#111';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Draw terrain (without fog of war - full visibility on minimap)
    const mapSize = getMapSize();
    for (let y = 0; y < mapSize; y++) {
        if (!game.map[y]) continue;
        for (let x = 0; x < mapSize; x++) {
            const tile = game.map[y][x];
            if (!tile) continue;

            let color = '#85714e';
            if (tile.type === 'water') color = '#3a5c66';
            else if (tile.type === 'rock') color = '#606060';
            else if (tile.type === 'sand') color = '#a08050';
            else if (tile.type === 'hill') color = '#68523a';

            minimapCtx.fillStyle = color;
            minimapCtx.fillRect(x * scale, y * scale, scale + 1, scale + 1);

            // Show all oil deposits on minimap
            if (tile.oil) {
                minimapCtx.fillStyle = (tile.oilAmount !== undefined && tile.oilAmount <= 0) ? '#332f1f' : '#cfae3a';
                minimapCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }

    // Draw buildings
    for (const b of game.buildings) {
        minimapCtx.fillStyle = b.playerId === 0 ? game.players[b.playerId].color : '#ff4444';
        minimapCtx.fillRect(b.x * scale - 2, b.y * scale - 2, 4, 4);
    }

    // Draw units
    for (const u of game.units) {
        minimapCtx.fillStyle = u.playerId === 0 ? game.players[u.playerId].color : '#ff4444';
        minimapCtx.fillRect(u.x * scale - 1, u.y * scale - 1, 2, 2);
    }

    // Unclaimed tech bunkers
    if (game.bunkers) {
        for (const b of game.bunkers) {
            if (b.claimed) continue;
            minimapCtx.fillStyle = '#66e0ff';
            minimapCtx.fillRect(b.x * scale - 2, b.y * scale - 2, 4, 4);
        }
    }

    // Generic event pings
    if (game.pings) {
        for (const p of game.pings) {
            const age = (Date.now() - p.time) / 1000;
            if (age > 4) continue;
            const pulse = (age * 2) % 1;
            minimapCtx.strokeStyle = p.color;
            minimapCtx.globalAlpha = 1 - pulse;
            minimapCtx.lineWidth = 1.5;
            minimapCtx.beginPath();
            minimapCtx.arc(p.x * scale, p.y * scale, 2 + pulse * 7, 0, Math.PI * 2);
            minimapCtx.stroke();
            minimapCtx.globalAlpha = 1;
        }
    }

    // Under-attack ping (pulsing ring, 4 seconds)
    if (game.lastAttackAlert && Date.now() - game.lastAttackAlert.time < 4000) {
        const age = (Date.now() - game.lastAttackAlert.time) / 1000;
        const pulse = (age * 2) % 1;
        minimapCtx.strokeStyle = `rgba(255,60,40,${1 - pulse})`;
        minimapCtx.lineWidth = 2;
        minimapCtx.beginPath();
        minimapCtx.arc(game.lastAttackAlert.x * scale, game.lastAttackAlert.y * scale, 3 + pulse * 8, 0, Math.PI * 2);
        minimapCtx.stroke();
    }

    // Red border flash while the base is under attack
    if (game.lastAttackAlert && Date.now() - game.lastAttackAlert.time < 3000) {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 180));
        minimapCtx.strokeStyle = `rgba(255,50,40,${pulse})`;
        minimapCtx.lineWidth = 3;
        minimapCtx.strokeRect(1.5, 1.5, minimapCanvas.width - 3, minimapCanvas.height - 3);
    }

    // Draw camera viewport
    const viewStart = screenToWorld(0, 0);
    const viewEnd = screenToWorld(canvas.offsetWidth, canvas.offsetHeight);
    minimapCtx.strokeStyle = '#fff';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(
        viewStart.x * scale,
        viewStart.y * scale,
        (viewEnd.x - viewStart.x) * scale,
        (viewEnd.y - viewStart.y) * scale
    );
}

// ============================================
// GAME LOGIC
// ============================================

function update(dt) {
    game.tick++;

    updateUnits(dt);
    updateBuildings(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateDamageNumbers(dt);
    updateAI();
    updateResources();
    updateBunkers();
    updateScavengers();
    updateUI();
    updateObjectives();
    updateDecals(dt);

    // Fade out order feedback markers
    if (game.orderMarkers) {
        for (let i = game.orderMarkers.length - 1; i >= 0; i--) {
            game.orderMarkers[i].life -= dt * 1.6;
            if (game.orderMarkers[i].life <= 0) game.orderMarkers.splice(i, 1);
        }
    }
}

// A* Pathfinding implementation
function findPath(startX, startY, endX, endY) {
    const mapSize = getMapSize();
    const start = { x: Math.floor(startX), y: Math.floor(startY) };
    const end = { x: Math.floor(endX), y: Math.floor(endY) };

    // Bounds check
    if (start.x < 0 || start.x >= mapSize || start.y < 0 || start.y >= mapSize ||
        end.x < 0 || end.x >= mapSize || end.y < 0 || end.y >= mapSize) {
        return null;
    }

    // Check if map exists
    if (!game.map || game.map.length === 0) {
        return null;
    }

    // Check if end is passable
    const endTile = game.map[end.y]?.[end.x];
    if (endTile && (endTile.type === 'water' || endTile.type === 'hill')) {
        return null;
    }

    // Heuristic function (Manhattan distance)
    const heuristic = (x, y) => Math.abs(x - end.x) + Math.abs(y - end.y);

    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    const key = (x, y) => `${x},${y}`;

    gScore.set(key(start.x, start.y), 0);
    fScore.set(key(start.x, start.y), heuristic(start.x, start.y));

    const directions = [
        { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
        { dx: 1, dy: -1 }, { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
    ];

    let iterations = 0;
    const maxIterations = 1500; // Allow longer paths on bigger maps

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        // Find node with lowest fScore
        let current = openSet[0];
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            const currentF = fScore.get(key(openSet[i].x, openSet[i].y)) || Infinity;
            const bestF = fScore.get(key(current.x, current.y)) || Infinity;
            if (currentF < bestF) {
                current = openSet[i];
                currentIndex = i;
            }
        }

        // Check if we reached the goal
        if (current.x === end.x && current.y === end.y) {
            // Reconstruct path
            const path = [];
            let curr = current;
            while (cameFrom.has(key(curr.x, curr.y))) {
                path.unshift({ x: curr.x + 0.5, y: curr.y + 0.5 });
                const prev = cameFrom.get(key(curr.x, curr.y));
                curr = prev;
            }
            return path;
        }

        // Remove current from openSet
        openSet.splice(currentIndex, 1);

        // Check neighbors
        let validNeighbors = 0;
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;

            // Bounds check
            if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;

            // Check if passable - be defensive about undefined values
            const tile = game.map?.[ny]?.[nx];
            if (!tile) {
                // Tile doesn't exist or isn't defined, assume not passable
                continue;
            }
            if (tile.type === 'water' || tile.type === 'hill') {
                continue;
            }

            validNeighbors++;
            const tentativeG = (gScore.get(key(current.x, current.y)) || Infinity) +
                              (dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1); // Diagonal cost

            const neighborKey = key(nx, ny);
            const currentG = gScore.get(neighborKey) || Infinity;

            if (tentativeG < currentG) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeG);
                fScore.set(neighborKey, tentativeG + heuristic(nx, ny));

                // Add to openSet if not already there
                if (!openSet.find(n => n.x === nx && n.y === ny)) {
                    openSet.push({ x: nx, y: ny });
                }
            }
        }

    }

    return null; // No path found
}

function updateUnits(dt) {
    for (let i = game.units.length - 1; i >= 0; i--) {
        const unit = game.units[i];
        const type = UNIT_TYPES[unit.type];

        // Death check
        if (unit.hp <= 0) {
            createExplosion(unit.x, unit.y);
            SoundManager.play('explosion_small');
            // leave something behind on the battlefield
            if (type.category === 'armor') {
                addDecal({
                    type: 'wreck', x: unit.x, y: unit.y, life: 40,
                    role: unit.type, faction: getFaction(unit.playerId),
                    dir: IsoSprites.dirFromAngle(unit.angle || 0)
                });
            } else {
                const faction = getFaction(unit.playerId);
                addDecal({
                    type: 'splat', x: unit.x, y: unit.y, life: 25,
                    color: faction === 'series9' ? 'rgba(30,34,40,0.7)' : 'rgba(84,22,16,0.65)',
                    drops: Array.from({ length: 3 }, () => [
                        (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 9, 1.5 + Math.random() * 2])
                });
            }
            game.units.splice(i, 1);
            game.selection = game.selection.filter(s => s !== unit);
            continue;
        }

        // Attack logic
        if (unit.attackTarget) {
            const target = unit.attackTarget;
            if (target.hp <= 0) {
                unit.attackTarget = null;
                // Attack-move: resume marching to the ordered destination
                if (unit.attackMove && unit.resumeX !== undefined) {
                    unit.targetX = unit.resumeX;
                    unit.targetY = unit.resumeY;
                }
            } else {
                const dx = target.x - unit.x;
                const dy = target.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Avoid division by zero
                if (dist < 0.01) {
                    // Already at target position, just attack
                    if (game.tick - unit.lastAttack > type.attackSpeed / 16) {
                        fireProjectile(unit, target);
                        unit.lastAttack = game.tick;
                    }
                } else {
                    unit.angle = Math.atan2(dy, dx);

                    // Stay at optimal range (75% of max range to have some buffer)
                    const optimalRange = rangeT(type) * 0.9;
                    const backupDistance = rangeT(type) * 0.3; // Only back up if much too close

                    if (dist > optimalRange) {
                        // Move towards target to get in range
                        const speed = type.speed * dt * 60;
                        const moveX = (dx / dist) * speed;
                        const moveY = (dy / dist) * speed;

                        // Check if next position is passable
                        const nextX = unit.x + moveX;
                        const nextY = unit.y + moveY;
                        const nextTile = game.map[Math.floor(nextY)]?.[Math.floor(nextX)];

                        if (nextTile && nextTile.type !== 'hill' && nextTile.type !== 'water') {
                            unit.x += moveX;
                            unit.y += moveY;
                        }
                    } else if (dist < backupDistance) {
                        // Too close, back up a bit
                        const speed = type.speed * dt * 60 * 0.3;
                        unit.x -= (dx / dist) * speed;
                        unit.y -= (dy / dist) * speed;
                    }
                    // Otherwise, stay in place if in optimal range
                    // If in range, attack
                    if (dist <= rangeT(type) && game.tick - unit.lastAttack > type.attackSpeed / 16) {
                        fireProjectile(unit, target);
                        unit.lastAttack = game.tick;
                    }
                }
            }
        }
        // Direct movement to target with pathfinding for obstacles
        else if (unit.targetX !== undefined && unit.targetY !== undefined) {
            const dx = unit.targetX - unit.x;
            const dy = unit.targetY - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Attack-move: engage anything spotted along the way
            if (unit.attackMove && type.damage > 0 && (game.tick + i) % 10 === 0) {
                const sightRange = sightT(type);
                let nearestEnemy = null;
                let nearestDist = Infinity;
                for (const enemy of game.units) {
                    if (enemy.playerId === unit.playerId) continue;
                    const edist = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
                    if (edist <= sightRange && edist < nearestDist) {
                        nearestDist = edist;
                        nearestEnemy = enemy;
                    }
                }
                if (!nearestEnemy) {
                    for (const b of game.buildings) {
                        if (b.playerId === unit.playerId) continue;
                        const edist = Math.hypot(b.x - unit.x, b.y - unit.y);
                        if (edist <= sightRange && edist < nearestDist) {
                            nearestDist = edist;
                            nearestEnemy = b;
                        }
                    }
                }
                if (nearestEnemy) {
                    unit.resumeX = unit.targetX;
                    unit.resumeY = unit.targetY;
                    unit.attackTarget = nearestEnemy;
                    unit.targetX = undefined;
                    unit.targetY = undefined;
                    continue;
                }
            }

            // If closeTarget is set, look for nearby enemies to attack
            if (unit.closeTarget && unit.closeTarget.hp > 0) {
                const cdx = unit.closeTarget.x - unit.x;
                const cdy = unit.closeTarget.y - unit.y;
                const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

                // If close enough to original target, search for nearest enemy in range
                if (cdist < rangeT(type) * 1.5) {
                    let nearestEnemy = null;
                    let nearestDist = Infinity;

                    for (const u of game.units) {
                        if (u.playerId === unit.playerId) continue;
                        const udx = u.x - unit.x;
                        const udy = u.y - unit.y;
                        const udist = Math.sqrt(udx * udx + udy * udy);

                        if (udist <= rangeT(type) && udist < nearestDist) {
                            nearestEnemy = u;
                            nearestDist = udist;
                        }
                    }

                    if (nearestEnemy && nearestEnemy.hp > 0) {
                        unit.attackTarget = nearestEnemy;
                        unit.closeTarget = null;
                        unit.targetX = undefined;
                        unit.targetY = undefined;
                    }
                }
            }

            if (dist < 0.5) {
                // Reached target
                unit.targetX = undefined;
                unit.targetY = undefined;
                unit.path = undefined;
                unit.stuckCounter = 0;
                unit.closeTarget = null;
            } else {
                // Use pathfinding if blocked or no direct path
                const speed = type.speed * dt * 60;
                const moveX = (dx / dist) * speed;
                const moveY = (dy / dist) * speed;
                const nextTile = game.map[Math.floor(unit.y + moveY)]?.[Math.floor(unit.x + moveX)];

                // Check if blocked
                if (nextTile && (nextTile.type === 'hill' || nextTile.type === 'water')) {
                    // Blocked - try pathfinding
                    if (!unit.path || unit.path.length === 0) {
                        unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
                        unit.stuckCounter = 0;
                    }

                    if (unit.path && unit.path.length > 0) {
                        const target = unit.path[0];
                        const pdx = target.x - unit.x;
                        const pdy = target.y - unit.y;
                        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

                        if (pdist < 0.5) {
                            unit.path.shift();
                        } else {
                            unit.x += (pdx / pdist) * speed;
                            unit.y += (pdy / pdist) * speed;
                            unit.angle = Math.atan2(pdy, pdx);
                        }
                    } else {
                        // No path found - increase stuck counter and try backing up
                        unit.stuckCounter = (unit.stuckCounter || 0) + 1;
                        if (unit.stuckCounter > 30) {
                            // Back up and try different route
                            unit.x -= (dx / dist) * speed * 0.5;
                            unit.y -= (dy / dist) * speed * 0.5;
                            unit.path = undefined;
                            unit.stuckCounter = 0;
                        }
                    }
                } else {
                    // Direct movement is possible
                    unit.x += moveX;
                    unit.y += moveY;
                    unit.angle = Math.atan2(dy, dx);
                    unit.path = undefined;
                    unit.stuckCounter = 0;
                }

                // Create dust trail effect
                if (Math.random() < 0.3) {
                    const dustColor = Math.random() > 0.5 ? '#888888' : '#999999';
                    game.particles.push({
                        x: unit.x + (Math.random() - 0.5) * type.size,
                        y: unit.y + (Math.random() - 0.5) * type.size,
                        z: 0,
                        vx: (Math.random() - 0.5) * 0.15,
                        vy: (Math.random() - 0.5) * 0.15,
                        vz: Math.random() * 0.1 + 0.05,
                        color: dustColor,
                        size: Math.random() * 2 + 1,
                        life: 0.5
                    });
                }
            }
        }

        // Keep in bounds and avoid hills/water/rocks
        const mapSize = getMapSize();
        unit.x = Math.max(0, Math.min(mapSize - 1, unit.x));
        unit.y = Math.max(0, Math.min(mapSize - 1, unit.y));

        const tileType = game.map[Math.floor(unit.y)]?.[Math.floor(unit.x)]?.type;
        if (tileType === 'water' || tileType === 'hill') {
            // Push unit to nearest valid position
            const validPos = findValidSpawnPosition(Math.floor(unit.x), Math.floor(unit.y), 3);
            unit.x = validPos.x + 0.5;
            unit.y = validPos.y + 0.5;
        }

        // Elite veterans (rank 3) slowly patch themselves up
        if (veterancyRank(unit.kills) >= 3 && unit.hp < type.hp && game.tick % 60 === 0) {
            unit.hp = Math.min(type.hp, unit.hp + 3);
        }

        // Auto-attack: Idle units attack nearby enemies (RTS standard behavior)
        // Staggered scan (every 12 ticks per unit) keeps big battles cheap
        if (!unit.attackTarget && unit.targetX === undefined && type.damage > 0 &&
            (game.tick + i) % 12 === 0) {
            const sightRange = sightT(type);
            let nearestEnemy = null;
            let nearestDist = Infinity;

            // Check for enemy units in sight range
            for (const enemy of game.units) {
                if (enemy.playerId === unit.playerId) continue;
                const dx = enemy.x - unit.x;
                const dy = enemy.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= sightRange && dist < nearestDist) {
                    nearestDist = dist;
                    nearestEnemy = enemy;
                }
            }

            // Also check enemy buildings
            if (!nearestEnemy) {
                for (const building of game.buildings) {
                    if (building.playerId === unit.playerId) continue;
                    const dx = building.x - unit.x;
                    const dy = building.y - unit.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= sightRange && dist < nearestDist) {
                        nearestDist = dist;
                        nearestEnemy = building;
                    }
                }
            }

            if (nearestEnemy && nearestEnemy.hp > 0) {
                unit.attackTarget = nearestEnemy;
            }
        }
    }
}

// Convert range/sight stats (pixel-ish values) into tile distances
function rangeT(type) { return (type.range || 0) / 24; }
function sightT(type) { return (type.sight || 100) / 24; }

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
                }
            } else {
                // Construction in progress - keep hp at 1
                building.hp = 1;
            }
        }

        // Death check
        if (building.hp <= 0 && !building.isUnderConstruction) {
            createExplosion(building.x, building.y, true);
            SoundManager.play('explosion_large');
            addDecal({
                type: 'scorch', x: building.x, y: building.y, life: 60,
                size: 16 + type.size * 9,
                rubble: Array.from({ length: 4 + type.size }, () => [
                    (Math.random() - 0.5) * type.size * 22,
                    (Math.random() - 0.5) * type.size * 11,
                    2 + Math.random() * 3,
                    Math.random() * Math.PI])
            });
            game.buildings.splice(i, 1);
            game.selection = game.selection.filter(s => s !== building);
            continue;
        }

        // Turret attack (staggered scan keeps many towers cheap)
        if (type.damage && !building.isUnderConstruction && (game.tick + i) % 6 === 0) {
            // Check if turret is activated (only shoot after activation delay)
            const isActivated = !building.activationTime || game.tick >= building.activationTime;

            if (isActivated) {
                let nearestEnemy = null;
                let nearestDist = Infinity;

                for (const unit of game.units) {
                    if (unit.playerId === building.playerId) continue;

                    // Check if enemy is in sight range
                    const dx = unit.x - building.x;
                    const dy = unit.y - building.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < rangeT(type) && dist < nearestDist) {
                        nearestDist = dist;
                        nearestEnemy = unit;
                    }
                }

                if (nearestEnemy && nearestEnemy.hp > 0 && game.tick - (building.lastAttack || 0) > type.attackSpeed / 16) {
                    fireProjectile(building, nearestEnemy, type.damage);
                    building.lastAttack = game.tick;
                }
            }
        }

        // Heavily damaged buildings burn
        if (!building.isUnderConstruction && building.hp < type.hp * 0.4 && Math.random() < 0.12) {
            const fire = Math.random() < 0.4;
            game.particles.push({
                x: building.x + (Math.random() - 0.5) * type.size * 0.7,
                y: building.y + (Math.random() - 0.5) * type.size * 0.7,
                z: 8 + Math.random() * 10,
                vx: (Math.random() - 0.5) * 0.05,
                vy: (Math.random() - 0.5) * 0.05,
                vz: 0.18 + Math.random() * 0.12,
                color: fire ? '#ff7722' : '#3d3d3d',
                size: fire ? 3 : 5 + Math.random() * 4,
                life: fire ? 0.6 : 1.2,
                type: fire ? 'explosion' : 'smoke'
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
                            vx: (Math.random() - 0.5) * 0.2,
                            vy: (Math.random() - 0.5) * 0.2,
                            vz: 0.2,
                            color: '#66ffaa', size: 2, life: 0.5, type: 'spark'
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

            if (building.produceProgress >= building.produceTime) {
                // Spawn unit with offset to avoid clustering
                // Try multiple angles to find passable terrain
                let spawnX, spawnY;
                let foundValidSpot = false;

                for (let attempt = 0; attempt < 8; attempt++) {
                    const angle = (Math.PI * 2 * attempt) / 8;
                    const offset = 1.5 + Math.random() * 1.5;
                    spawnX = building.x + Math.cos(angle) * offset;
                    spawnY = building.y + Math.sin(angle) * offset;

                    if (isTilePassable(Math.floor(spawnX), Math.floor(spawnY))) {
                        foundValidSpot = true;
                        break;
                    }
                }

                // If no valid spot found around building, use findValidSpawnPosition
                if (!foundValidSpot) {
                    const validPos = findValidSpawnPosition(Math.floor(building.x), Math.floor(building.y), 5);
                    spawnX = validPos.x + 0.5;
                    spawnY = validPos.y + 0.5;
                }

                const newUnit = spawnUnit(current.type, building.playerId, spawnX, spawnY);
                if (building.playerId === 0) {
                    SoundManager.play('unit_ready');
                }
                // Send to rally point if set
                if (newUnit && building.rallyX !== undefined) {
                    newUnit.targetX = building.rallyX + (Math.random() - 0.5) * 2;
                    newUnit.targetY = building.rallyY + (Math.random() - 0.5) * 2;
                }
                building.productionQueue.shift();
                building.produceProgress = 0;
            }
        }
    }
}

function updateProjectiles(dt) {
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
        const proj = game.projectiles[i];

        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life--;

        // Check if blocked by hill
        if (proj.blockadeIndex >= 0) {
            const distTraveled = 1 - (proj.life / 100); // How far we've traveled
            if (distTraveled >= proj.blockadeIndex) {
                // Hit the hill, remove projectile
                createImpact(proj.x, proj.y);
                game.projectiles.splice(i, 1);
                continue;
            }
        }

        // Check distance traveled (for missed shots)
        const distFromStart = Math.sqrt(
            (proj.x - proj.startX) ** 2 + (proj.y - proj.startY) ** 2
        );

        // Check hit
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Remove projectile if: reached target, max range exceeded, or life expired
        if (dist < 1 || proj.life <= 0 || distFromStart > proj.maxRange) {
            // Only deal damage if this was a hit
            if (proj.willHit && dist < 1) {
                const targetStillExists = proj.target && (
                    game.units.includes(proj.target) ||
                    game.buildings.includes(proj.target)
                );

                if (targetStillExists && proj.target.hp > 0) {
                    let finalDamage = proj.damage;

                    // Apply versus bonus (50% extra damage against matching category)
                    if (proj.versus && proj.target.type) {
                        const targetType = UNIT_TYPES[proj.target.type];
                        if (targetType && targetType.category === proj.versus) {
                            finalDamage = Math.floor(proj.damage * 1.5);
                        }
                    }

                    proj.target.hp -= finalDamage;
                    // Base-under-attack alert (minimap ping + throttled sound + Space jumps there)
                    if (proj.target.playerId === 0) {
                        game.lastAttackAlert = { x: proj.target.x, y: proj.target.y, time: Date.now() };
                        if (!game._lastAlertSound || Date.now() - game._lastAlertSound > 12000) {
                            game._lastAlertSound = Date.now();
                            SoundManager.play('alert');
                        }
                    }
                    // Veterancy: credit the kill to the shooter
                    if (proj.target.hp <= 0 && proj.source && UNIT_TYPES[proj.source.type] &&
                        game.units.includes(proj.source)) {
                        proj.source.kills = (proj.source.kills || 0) + 1;
                    }
                    // Flame hits set the ground on fire briefly
                    if (proj.weapon === 'flame') {
                        for (let f = 0; f < 3; f++) {
                            game.particles.push({
                                x: proj.x + (Math.random() - 0.5) * 0.8,
                                y: proj.y + (Math.random() - 0.5) * 0.8,
                                z: 1,
                                vx: 0, vy: 0, vz: 0.05,
                                color: proj.faction === 'series9' ? '#7dffb0' : ['#ff5511', '#ff8822', '#ffcc33'][f],
                                size: 2.5 + Math.random() * 2.5,
                                life: 1 + Math.random() * 0.7,
                                type: 'explosion'
                            });
                        }
                    }
                    // Area damage: hurt everything hostile around the impact
                    if (proj.splash > 0) {
                        const victims = [...game.units, ...game.buildings];
                        for (const v of victims) {
                            if (v === proj.target || v.playerId === proj.playerId || v.hp <= 0) continue;
                            const sdist = Math.hypot(v.x - proj.x, v.y - proj.y);
                            if (sdist <= proj.splash) {
                                const sdmg = Math.round(finalDamage * 0.5 * (1 - sdist / (proj.splash * 2)));
                                if (sdmg > 0) {
                                    v.hp -= sdmg;
                                    if (v.hp <= 0 && proj.source && UNIT_TYPES[proj.source.type] &&
                                        game.units.includes(proj.source)) {
                                        proj.source.kills = (proj.source.kills || 0) + 1;
                                    }
                                }
                            }
                        }
                        createExplosion(proj.x, proj.y, false);
                    }
                    // Create impact effect on hit
                    createImpact(proj.x, proj.y);
                    // Show damage number (critical if versus bonus was applied)
                    const isCritical = proj.versus && proj.target.type &&
                        UNIT_TYPES[proj.target.type]?.category === proj.versus;
                    createDamageNumber(proj.x, proj.y, finalDamage, isCritical);
                }
            } else if (!proj.willHit && distFromStart >= proj.maxRange) {
                // Miss: projectile stopped at max range, just particle animation stops
                // No impact effect for misses
            } else if (dist < 1) {
                // Hit but willHit is false (shouldn't happen, but safety)
                createImpact(proj.x, proj.y);
            }

            game.projectiles.splice(i, 1);
        }
    }
}

function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.vz -= 0.1; // gravity
        p.life -= 0.02;

        if (p.life <= 0 || p.z < 0) {
            game.particles.splice(i, 1);
        }
    }
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
        const sight = type.sight / TILE_WIDTH * 2;

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
            if (!canBuildAt('derrick', x, y)) continue;
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
    let prodActions = game.tick < 18000 ? 1 : 2;
    const queueUnit = (building, role) => {
        if (prodActions <= 0) return false;
        const uType = UNIT_TYPES[role];
        if (!uType || ai.oil < uType.cost || ai.techLevel < uType.tech) return false;
        if (building.productionQueue.length >= 2) return false;
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
        if (runner) {
            runner.targetX = openBunker.x;
            runner.targetY = openBunker.y;
        }
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
        } else if (rallyTarget) {
            // March toward the player base as an attack-move wave
            if (unit.targetX === undefined || Math.abs(unit.targetX - rallyTarget.x) > 5 || Math.abs(unit.targetY - rallyTarget.y) > 5) {
                unit.targetX = rallyTarget.x + (Math.random() - 0.5) * 6;
                unit.targetY = rallyTarget.y + (Math.random() - 0.5) * 6;
                unit.attackMove = true;
                unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
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

        if (roll < 0.4) {
            const amount = 600 + Math.floor(Math.random() * 400);
            player.oil = Math.min(50000, player.oil + amount);
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
                vx: Math.cos(ang) * 0.25, vy: Math.sin(ang) * 0.25, vz: 0.35,
                color: '#66e0ff', size: 2.5, life: 0.9, type: 'spark'
            });
        }
        if (claimer.playerId === 0) {
            setBanner(rewardText, 5, '#66e0ff');
            SoundManager.play('bonus');
        } else {
            setBanner('The enemy secured a tech bunker!', 4, '#ff7755');
            SoundManager.play('warn');
        }
        addPing(bunker.x, bunker.y, '#66e0ff');
    }
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
        if (u) {
            u.targetX = target.x + (Math.random() - 0.5) * 4;
            u.targetY = target.y + (Math.random() - 0.5) * 4;
            u.attackMove = true;
        }
    }
    setBanner('Scavengers spotted in the wasteland!', 4, '#cfae3a');
    SoundManager.play('warn');
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
                const tile = game.map[Math.floor(building.y)]?.[Math.floor(building.x)];
                building.oilTile = tile && tile.oil ? tile : null;
                building.oilLeft = building.oilTile ? (building.oilTile.oilAmount ?? 30000) : 0;
                building.oilStart = Math.max(1, building.oilLeft);
            }

            if (building.oilLeft > 0) {
                const psType = BUILDING_TYPES.powerStation;
                const boost = 1 + Math.min(stationCounts[building.playerId], psType.maxBoostCount) * psType.incomeBoost;
                const pumped = Math.min((type.pumpRate * boost) / 60, building.oilLeft);
                building.oilLeft -= pumped;
                player.oil = Math.min(50000, player.oil + pumped);
                if (building.oilTile) {
                    building.oilTile.oilAmount = Math.max(0, building.oilLeft);
                    // Patch ran dry: update the cached terrain and warn the owner
                    if (building.oilLeft <= 0) {
                        redrawTerrainTile(Math.floor(building.x), Math.floor(building.y));
                        if (building.playerId === 0) {
                            setBanner('An oil patch has run dry - expand to a new field!', 5, '#cfae3a');
                            SoundManager.play('warn');
                            addPing(building.x, building.y, '#cfae3a');
                        }
                    }
                }
            }
        }
    }
}

function updateUI() {
    const oilEl = document.getElementById('oil');
    const techEl = document.getElementById('techLevel');
    const playerUnitsEl = document.getElementById('playerUnits');
    const enemyUnitsEl = document.getElementById('enemyUnits');
    const infoEl = document.getElementById('selectionInfo');

    if (!oilEl || !playerUnitsEl || !enemyUnitsEl || !infoEl) {
        return;
    }

    const player = game.players[0];
    const playerFaction = player.faction;
    oilEl.textContent = Math.floor(player.oil);

    if (techEl) {
        techEl.textContent = player.techLevel;
        // Show research-in-progress with a pulsing style
        const researching = game.buildings.some(b => b.playerId === 0 && b.researching);
        techEl.style.color = researching ? '#cc66ff' : '#4dffa6';
    }

    // Unit counts
    const playerUnits = game.units.filter(u => u.playerId === 0).length;
    const enemyUnits = game.units.filter(u => u.playerId === 1).length;
    playerUnitsEl.textContent = `${playerUnits} units`;
    enemyUnitsEl.textContent = `${enemyUnits} units`;

    if (playerUnits > enemyUnits) {
        playerUnitsEl.style.color = '#0f0';
        enemyUnitsEl.style.color = '#f00';
    } else if (playerUnits < enemyUnits) {
        playerUnitsEl.style.color = '#f00';
        enemyUnitsEl.style.color = '#0f0';
    } else {
        playerUnitsEl.style.color = '#ff0';
        enemyUnitsEl.style.color = '#ff0';
    }

    // Selection info
    if (game.selection.length === 0) {
        infoEl.innerHTML = '<span style="color:#555570;">No selection</span>';
    } else if (game.selection.length === 1) {
        const sel = game.selection[0];
        const isUnit = UNIT_TYPES[sel.type] !== undefined;
        const type = UNIT_TYPES[sel.type] || BUILDING_TYPES[sel.type];
        const faction = getFaction(sel.playerId);
        const displayName = isUnit ? unitDisplayName(sel.type, faction) : buildingDisplayName(sel.type, faction);
        const hpPct = Math.round((sel.hp / type.hp) * 100);
        const hpColor = hpPct > 60 ? '#44dd66' : hpPct > 30 ? '#ffcc00' : '#ff3344';
        let infoText = `<strong style="font-size:14px;">${displayName}</strong>`;
        infoText += `<div class="sel-hp-bar"><div class="sel-hp-fill" style="width:${hpPct}%;background:${hpColor};"></div></div>`;
        infoText += `<span style="font-size:11px;color:#8888aa;">HP: ${Math.floor(sel.hp)} / ${type.hp}</span>`;
        if (isUnit) {
            const rank = veterancyRank(sel.kills);
            if (rank > 0) {
                infoText += `<br><span style="color:#ffd14a;">${'^'.repeat(rank)} Veteran (+${rank * 15}% damage)</span>`;
            }
        } else {
            if (sel.type === 'derrick') {
                const psType = BUILDING_TYPES.powerStation;
                const stations = game.buildings.filter(b => b.playerId === sel.playerId && b.type === 'powerStation' && !b.isUnderConstruction).length;
                const boost = 1 + Math.min(stations, psType.maxBoostCount) * psType.incomeBoost;
                const rate = (sel.oilLeft > 0) ? (BUILDING_TYPES.derrick.pumpRate * boost).toFixed(1) : '0';
                const left = sel.oilLeft !== undefined ? Math.floor(sel.oilLeft) : '?';
                infoText += `<br><span style="color:#cfae3a;">Income: +${rate} oil/s</span>`;
                infoText += `<br><span style="color:#8888aa;font-size:11px;">Reserves: ${left}</span>`;
            }
            if (sel.researching) {
                const progress = Math.round((sel.researching.progress / sel.researching.time) * 100);
                infoText += `<br><span style="color:#cc66ff;">Researching Tech ${sel.researching.level} (${progress}%)</span>`;
            }
            if (sel.productionQueue && sel.productionQueue.length > 0) {
                const progress = Math.round((sel.produceProgress / sel.produceTime) * 100);
                const current = sel.productionQueue[0];
                infoText += `<div class="prod-progress-bar"><div class="prod-progress-fill" style="width:${progress}%;"></div></div>`;
                infoText += `<span style="font-size:11px;">Building: ${unitDisplayName(current.type, faction)} (${progress}%)</span>`;
                if (sel.productionQueue.length > 1) {
                    infoText += ` <span style="color:#4499ff;">[+${sel.productionQueue.length - 1} queued]</span>`;
                }
            }
        }
        infoEl.innerHTML = infoText;
    } else {
        const counts = {};
        for (const s of game.selection) {
            if (UNIT_TYPES[s.type]) counts[s.type] = (counts[s.type] || 0) + 1;
        }
        const parts = Object.entries(counts)
            .map(([t, n]) => `${n}&times; ${unitDisplayName(t, playerFaction)}`);
        infoEl.innerHTML = `<strong style="font-size:14px;">${game.selection.length} units selected</strong>` +
            `<br><span style="font-size:11px;color:#8888aa;">${parts.join('<br>')}</span>`;
    }

    // Build menu
    updateBuildMenu();
}

// ---- Rich hover tooltip for sidebar buttons ----
let tooltipEl = null;

function showTooltip(btn, name, cost, statusLine, desc) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'game-tooltip';
        document.body.appendChild(tooltipEl);
    }
    let html = `<div class="tt-title">${name}` +
        (cost !== undefined && cost !== '' ? ` <span class="tt-cost">${cost} oil</span>` : '') + `</div>`;
    if (desc) html += `<div class="tt-desc">${desc}</div>`;
    if (statusLine) html += `<div class="tt-stats">${statusLine.replace(/\n/g, '<br>')}</div>`;
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    const rect = btn.getBoundingClientRect();
    const ttw = 240;
    tooltipEl.style.width = ttw + 'px';
    tooltipEl.style.left = Math.max(8, rect.left - ttw - 12) + 'px';
    tooltipEl.style.top = Math.max(8, Math.min(window.innerHeight - 140, rect.top - 8)) + 'px';
}

function hideTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
}

// Does the player have a finished building of this role?
function hasBuilding(playerId, role) {
    return game.buildings.some(b => b.playerId === playerId && b.type === role && !b.isUnderConstruction);
}

function buildingRequirementsMet(playerId, role) {
    const reqs = BUILDING_REQUIRES[role] || [];
    return reqs.every(r => hasBuilding(playerId, r));
}

function updateBuildMenu() {
    const menu = document.getElementById('buildMenu');
    const player = game.players[0];
    const faction = player.faction;

    // Check what's selected
    const selectedBuilding = game.selection.find(s => BUILDING_TYPES[s.type]);

    // Build a state key to detect actual changes - only rebuild DOM when needed
    const selType = selectedBuilding ? selectedBuilding.type : 'none';
    const selId = selectedBuilding ? (selectedBuilding.x + ',' + selectedBuilding.y) : '';
    const queueLen = selectedBuilding ? selectedBuilding.productionQueue.length : 0;
    const progress = selectedBuilding && queueLen > 0 ? Math.round((selectedBuilding.produceProgress / selectedBuilding.produceTime) * 100) : 0;
    const research = selectedBuilding && selectedBuilding.researching ? Math.round((selectedBuilding.researching.progress / selectedBuilding.researching.time) * 100) : -1;
    const oilBucket = Math.floor(player.oil / 25);
    const builtKeys = BUILD_ORDER.filter(r => hasBuilding(0, r)).join(',');
    const placing = game.placingBuilding || '';
    const stateKey = `${selType}|${selId}|${queueLen}|${progress}|${research}|${oilBucket}|${player.techLevel}|${builtKeys}|${placing}`;

    if (menu._lastStateKey === stateKey) return; // No change, skip DOM rebuild
    menu._lastStateKey = stateKey;

    // Clear menu
    menu.innerHTML = '';

    const addHeader = (text) => {
        const el = document.createElement('div');
        el.className = 'build-section-header';
        el.innerHTML = `<strong>${text}</strong>`;
        menu.appendChild(el);
    };

    const makeButton = (iconUrl, label, cost, title, enabled, onClick, desc) => {
        const btn = document.createElement('button');
        btn.className = 'build-btn';
        btn.innerHTML = `<img src="${iconUrl}" alt=""><span class="build-btn-label">${label}</span><span class="build-btn-cost">${cost}</span>`;
        if (!enabled) btn.classList.add('disabled');
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('disabled')) {
                SoundManager.play('denied');
                return;
            }
            onClick();
        });
        btn.addEventListener('mouseenter', () => showTooltip(btn, label, cost, title, desc));
        btn.addEventListener('mouseleave', hideTooltip);
        menu.appendChild(btn);
        return btn;
    };

    if (selectedBuilding && selectedBuilding.playerId === 0 && !selectedBuilding.isUnderConstruction) {
        const type = BUILDING_TYPES[selectedBuilding.type];

        // Research Lab: tech level upgrades
        if (type.research) {
            addHeader('Research');
            const next = player.techLevel + 1;
            if (next > MAX_TECH_LEVEL) {
                const done = document.createElement('div');
                done.className = 'queue-info';
                done.innerHTML = 'All technologies researched';
                menu.appendChild(done);
            } else {
                const upgrade = TECH_UPGRADES[next];
                if (selectedBuilding.researching) {
                    const pct = Math.round((selectedBuilding.researching.progress / selectedBuilding.researching.time) * 100);
                    const info = document.createElement('div');
                    info.className = 'queue-info';
                    info.innerHTML = `Researching Tech ${selectedBuilding.researching.level}... ${pct}%`;
                    menu.appendChild(info);
                } else {
                    makeButton(
                        IsoSprites.icon('building', 'researchLab', faction),
                        upgrade.label, upgrade.cost,
                        `Unlocks: ${upgrade.unlocks}`,
                        player.oil >= upgrade.cost,
                        () => {
                            if (player.oil >= upgrade.cost && !selectedBuilding.researching && player.techLevel + 1 === next) {
                                SoundManager.play('ui_click');
                                player.oil -= upgrade.cost;
                                selectedBuilding.researching = { level: next, progress: 0, time: upgrade.time };
                                menu._lastStateKey = null;
                                updateBuildMenu();
                            }
                        });
                }
            }
        }
        // Production building: unit buttons
        else if (type.produces.length > 0) {
            addHeader('Train Units');
            const queueInfo = document.createElement('div');
            queueInfo.className = 'queue-info';
            queueInfo.innerHTML = `Queue: <strong>${selectedBuilding.productionQueue.length}/10</strong> <span style="color:#667;">(Right-click ground: rally point)</span>`;
            menu.appendChild(queueInfo);

            if (selectedBuilding.productionQueue.length > 0) {
                const progressBar = document.createElement('div');
                progressBar.className = 'prod-progress-bar';
                progressBar.style.margin = '4px 8px 8px';
                progressBar.innerHTML = `<div class="prod-progress-fill" style="width: ${Math.round((selectedBuilding.produceProgress / selectedBuilding.produceTime) * 100)}%;"></div>`;
                menu.appendChild(progressBar);
            }

            for (const unitRole of type.produces) {
                const uType = UNIT_TYPES[unitRole];
                const name = unitDisplayName(unitRole, faction);
                const techOk = player.techLevel >= uType.tech;
                const canBuild = techOk && player.oil >= uType.cost && selectedBuilding.productionQueue.length < 10;
                const stats = `DMG ${uType.damage} | RNG ${(uType.range / 24).toFixed(1)} | SPD ${(uType.speed * 60).toFixed(1)} | HP ${uType.hp}`;
                const title = techOk
                    ? `${name} - ${uType.cost} oil\n${stats}`
                    : `${name} - Requires Tech Level ${uType.tech}\n${stats}`;
                makeButton(IsoSprites.icon('unit', unitRole, faction), name, techOk ? uType.cost : `T${uType.tech}`, title, canBuild, () => {
                    const okNow = player.techLevel >= uType.tech && player.oil >= uType.cost && selectedBuilding.productionQueue.length < 10;
                    if (okNow) {
                        SoundManager.play('ui_click');
                        player.oil -= uType.cost;
                        addToProductionQueue(selectedBuilding, unitRole);
                        menu._lastStateKey = null;
                        updateBuildMenu();
                    }
                }, UNIT_DESC[unitRole]);
            }
        }
        // Info-only buildings
        else {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'padding: 10px; font-size: 12px; color: #ccc;';
            let infoHTML = `<strong style="color: #fff;">${buildingDisplayName(selectedBuilding.type, faction)}</strong><br>`;
            if (type.incomeBoost) infoHTML += `<span style="color:#cfae3a;">+${Math.round(type.incomeBoost * 100)}% derrick output (max ${type.maxBoostCount})</span><br>`;
            if (type.pumpRate) infoHTML += `<span style="color:#cfae3a;">Pumps ${type.pumpRate} oil/s straight to your funds</span><br>`;
            if (type.repairRate) infoHTML += `<span style="color:#66ffaa;">Repairs nearby vehicles</span><br>`;
            if (type.damage) infoHTML += `<span style="color:#ff8855;">Damage: ${type.damage}</span><br>`;
            infoDiv.innerHTML = infoHTML;
            menu.appendChild(infoDiv);
        }

        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: linear-gradient(90deg, transparent, #2a2a44, transparent); margin: 8px 0;';
        menu.appendChild(separator);
    }

    // Structure construction list (always available)
    addHeader('Build Structures');

    for (const role of BUILD_ORDER) {
        const type = BUILDING_TYPES[role];
        if (!type) continue;

        const name = buildingDisplayName(role, faction);
        const techOk = player.techLevel >= type.tech;
        const reqsOk = buildingRequirementsMet(0, role);
        const canAfford = player.oil >= type.cost;
        const enabled = techOk && reqsOk && canAfford;

        let title = `${name} - ${type.cost} oil`;
        if (!techOk) {
            title = `${name} - Requires Tech Level ${type.tech}`;
        } else if (!reqsOk) {
            const missing = (BUILDING_REQUIRES[role] || []).filter(r => !hasBuilding(0, r))
                .map(r => buildingDisplayName(r, faction)).join(', ');
            title = `${name} - Requires: ${missing}`;
        } else if (type.needsOil) {
            title += ' (place on an oil patch)';
        }

        makeButton(IsoSprites.icon('building', role, faction), name, type.cost, title, enabled, () => {
            if (player.oil >= type.cost && player.techLevel >= type.tech && buildingRequirementsMet(0, role)) {
                SoundManager.play('ui_click');
                game.placingBuilding = role;
                game.placingBuildingFrom = null;
            }
        }, BUILDING_DESC[role]);
    }
}


// ============================================
// HELPER FUNCTIONS
// ============================================

function spawnUnit(type, playerId, x, y) {
    const unitType = UNIT_TYPES[type];
    if (!unitType) return null;
    const newUnit = {
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

function createBuilding(type, playerId, x, y, isUnderConstruction = false) {
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

    const building = {
        type,
        playerId,
        x, y,
        hp: isUnderConstruction ? 1 : bType.hp,
        productionQueue: [],
        produceProgress: 0,
        produceTime: 0,
        buildProgress: isUnderConstruction ? 0 : bType.hp,
        buildTime: buildTimes[type] || 900,
        isUnderConstruction: isUnderConstruction
    };

    // Set activation time for turrets even if not under construction
    if (bType.damage && !isUnderConstruction) {
        building.activationTime = game.tick + 180; // 3 second delay
    }

    game.buildings.push(building);
    return building;
}

function canBuildAt(buildingType, x, y) {
    const type = BUILDING_TYPES[buildingType];
    if (!type) return false;

    const mapSize = getMapSize();
    // Check map bounds with margin
    if (x < 1 || x >= mapSize - 1 || y < 1 || y >= mapSize - 1) return false;

    const centerTile = game.map[y]?.[x];
    if (!centerTile) return false;

    // Derricks MUST sit on a live oil patch; nothing else may
    if (type.needsOil) {
        if (!centerTile.oil || (centerTile.oilAmount !== undefined && centerTile.oilAmount <= 0)) {
            return false;
        }
    }

    // Check terrain footprint
    const reach = Math.max(1, Math.floor(type.size / 2));
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            const checkX = Math.floor(x + dx);
            const checkY = Math.floor(y + dy);
            if (checkX < 0 || checkX >= mapSize || checkY < 0 || checkY >= mapSize) return false;
            const tile = game.map[checkY]?.[checkX];
            if (!tile || tile.type === 'water' || tile.type === 'hill') {
                return false;
            }
            // Don't pave over oil patches with regular buildings
            if (!type.needsOil && tile.oil && (tile.oilAmount === undefined || tile.oilAmount > 0)) {
                return false;
            }
        }
    }

    // Keep clear of tech bunkers
    if (game.bunkers && game.bunkers.some(b =>
        Math.abs(x - b.x) < type.size / 2 + 1.5 && Math.abs(y - b.y) < type.size / 2 + 1.5)) {
        return false;
    }

    // Building collision: footprints may sit adjacent but not overlap
    for (const building of game.buildings) {
        const otherType = BUILDING_TYPES[building.type];
        const gap = Math.ceil((type.size + (otherType ? otherType.size : 2)) / 2);
        if (Math.abs(x - building.x) < gap && Math.abs(y - building.y) < gap) {
            return false;
        }
    }

    return true;
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

    // Veterancy: experienced units hit harder
    const rank = veterancyRank(source.kills);
    if (rank > 0) {
        damage = Math.round(damage * (1 + rank * VETERANCY_DAMAGE_BONUS));
    }

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 0.3;

    // Prevent division by zero if source and target are at the same position
    if (dist === 0) return;

    // Weapon class + faction drive the shot's look and sound
    const weapon = WEAPON_CLASS[source.type] || 'mg';
    const faction = getFaction(source.playerId);

    if (weapon === 'arty') {
        SoundManager.play('shoot_artillery');
    } else if (weapon === 'cannon') {
        SoundManager.play(faction === 'series9' ? 'shoot_zap' : 'shoot_heavy');
    } else if (weapon === 'rocket') {
        SoundManager.play('shoot_rocket');
    } else if (weapon === 'flame') {
        SoundManager.play('shoot_flame');
    } else {
        SoundManager.play(faction === 'series9' ? 'shoot_zap' : 'shoot_light');
    }

    // Muzzle flash for the big guns
    if (weapon === 'cannon' || weapon === 'arty') {
        const mAng = Math.atan2(dy, dx);
        for (let i = 0; i < 4; i++) {
            game.particles.push({
                x: source.x + Math.cos(mAng) * 0.5,
                y: source.y + Math.sin(mAng) * 0.5,
                z: 8,
                vx: Math.cos(mAng + (Math.random() - 0.5) * 0.7) * 0.35,
                vy: Math.sin(mAng + (Math.random() - 0.5) * 0.7) * 0.35,
                vz: 0.12,
                color: i === 0 ? '#ffffff' : '#ffbb44',
                size: 3 - i * 0.5,
                life: 0.28,
                type: 'flash'
            });
        }
    }

    // Check if path is blocked by hills
    const blockadeIndex = checkLineOfSight(source.x, source.y, target.x, target.y);

    // Add accuracy/inaccuracy - 20% chance to miss
    const hitChance = 0.8;
    const willHit = Math.random() < hitChance;

    let finalTargetX = target.x;
    let finalTargetY = target.y;

    // If miss: calculate where projectile will go (off-target, in tiles)
    if (!willHit) {
        const angle = Math.random() * Math.PI * 2;
        const missOffset = 1 + Math.random() * 1.5;
        finalTargetX = target.x + Math.cos(angle) * missOffset;
        finalTargetY = target.y + Math.sin(angle) * missOffset;
    }

    // Calculate actual velocity based on final target
    const finalDx = finalTargetX - source.x;
    const finalDy = finalTargetY - source.y;
    const finalDist = Math.sqrt(finalDx * finalDx + finalDy * finalDy);

    game.projectiles.push({
        x: source.x,
        y: source.y,
        vx: (finalDx / finalDist) * speed,
        vy: (finalDy / finalDist) * speed,
        targetX: finalTargetX,
        targetY: finalTargetY,
        target,
        damage,
        versus: type.versus || null,
        splash: type.splash || 0,
        weapon: weapon,
        faction: faction,
        life: 100,
        blockadeIndex: blockadeIndex,
        willHit: willHit,
        maxRange: rangeT(type) + 2,
        startX: source.x,
        startY: source.y,
        playerId: source.playerId,
        sourceType: source.type,
        source: source
    });
}

function checkLineOfSight(x1, y1, x2, y2) {
    // Check if path is blocked by hills - return distance to blockade or -1 if clear
    const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 2);
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = Math.round(x1 + (x2 - x1) * t);
        const y = Math.round(y1 + (y2 - y1) * t);
        if (x < 0 || x >= getMapSize() || y < 0 || y >= getMapSize()) continue;

        const tile = game.map[y]?.[x];
        if (tile && tile.type === 'hill') {
            return i / steps; // Return how far along the path blockade is
        }
    }
    return -1; // No blockade
}

function createExplosion(x, y, big = false) {
    // Screen shake when the blast is on screen
    if (canvas) {
        const s = worldToScreen(x, y);
        if (s.x > -60 && s.x < canvas.offsetWidth + 60 && s.y > -60 && s.y < canvas.offsetHeight + 60) {
            game.shake = Math.min(9, (game.shake || 0) + (big ? 5 : 1.2));
        }
    }

    // Multi-layered explosion with fire, sparks, smoke, and debris

    // Layer 1: Central flash (white-hot core)
    const flashCount = big ? 8 : 5;
    for (let i = 0; i < flashCount; i++) {
        const angle = (Math.PI * 2 * i) / flashCount;
        const speed = Math.random() * 0.2 + 0.1;
        game.particles.push({
            x, y, z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 0.4 + 0.2,
            color: '#ffffff',
            size: big ? 10 : 6,
            life: 0.4,
            type: 'flash'
        });
    }

    // Layer 2: Fire ring (orange/yellow)
    const fireColors = ['#ff4400', '#ff6600', '#ffaa00', '#ffcc00', '#ff8800'];
    const fireCount = big ? 45 : 25;
    for (let i = 0; i < fireCount; i++) {
        const angle = (Math.PI * 2 * i) / fireCount + (Math.random() - 0.5) * 0.6;
        const speed = Math.random() * 0.6 + 0.4;
        game.particles.push({
            x, y, z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 0.8 + 0.4,
            color: fireColors[Math.floor(Math.random() * fireColors.length)],
            size: Math.random() * 7 + 4,
            life: 1,
            type: 'explosion'
        });
    }

    // Layer 3: Sparks (fast, small, bright)
    const sparkColors = ['#ffff00', '#ffdd00', '#ffffff', '#ffaa00'];
    const sparkCount = big ? 30 : 15;
    for (let i = 0; i < sparkCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1.2 + 0.8;
        game.particles.push({
            x, y, z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 1.2 + 0.5,
            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
            size: Math.random() * 2 + 1,
            life: 0.8,
            type: 'spark'
        });
    }

    // Layer 4: Smoke (slow, large, gray-black)
    const smokeColors = ['#444444', '#555555', '#666666', '#777777', '#333333'];
    const smokeCount = big ? 25 : 12;
    for (let i = 0; i < smokeCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.15 + 0.05;
        game.particles.push({
            x: x + (Math.random() - 0.5) * 2,
            y: y + (Math.random() - 0.5) * 2,
            z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 0.25 + 0.1,
            color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
            size: Math.random() * 10 + 6,
            life: big ? 1.5 : 1,
            type: 'smoke'
        });
    }

    // Shockwave ring for every blast (bigger ones expand further)
    game.particles.push({
        x, y, z: 0,
        vx: 0, vy: 0, vz: 0,
        color: '#ff8800',
        size: 5,
        maxR: big ? 52 : 24,
        life: 0.5,
        type: 'shockwave'
    });

    // Lingering ground fire
    const fireSpots = big ? 4 : 2;
    for (let i = 0; i < fireSpots; i++) {
        game.particles.push({
            x: x + (Math.random() - 0.5) * (big ? 2 : 0.8),
            y: y + (Math.random() - 0.5) * (big ? 2 : 0.8),
            z: 1,
            vx: 0, vy: 0, vz: 0.06,
            color: ['#ff5511', '#ff8822', '#ffaa22'][i % 3],
            size: 3 + Math.random() * 3,
            life: 1.4 + Math.random() * 0.8,
            type: 'explosion'
        });
    }

    // Layer 5: Debris (only for big explosions)
    if (big) {
        const debrisColors = ['#553322', '#442211', '#332211', '#664433'];
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.8 + 0.4;
            game.particles.push({
                x, y, z: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: Math.random() * 1.0 + 0.6,
                color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
                size: Math.random() * 3 + 2,
                life: 1.2,
                type: 'debris'
            });
        }

    }
}

function createImpact(x, y) {
    const colors = ['#cccccc', '#999999', '#ffaa00', '#ff6600'];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = Math.random() * 0.3 + 0.1;
        game.particles.push({
            x, y, z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 0.3 + 0.1,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 2 + 1,
            life: 0.7
        });
    }
}

function createDamageNumber(x, y, damage, isCritical = false) {
    // Create floating damage number
    game.damageNumbers.push({
        x, y,
        damage: Math.round(damage),
        life: 1.0,
        offsetY: 0,
        isCritical,
        // Random horizontal drift for visual variety
        driftX: (Math.random() - 0.5) * 0.3
    });
}

function updateDamageNumbers(dt) {
    for (let i = game.damageNumbers.length - 1; i >= 0; i--) {
        const dmg = game.damageNumbers[i];
        // Float upward
        dmg.offsetY += 0.8;
        // Horizontal drift
        dmg.x += dmg.driftX;
        // Fade out
        dmg.life -= 0.025;

        if (dmg.life <= 0) {
            game.damageNumbers.splice(i, 1);
        }
    }
}

function drawDamageNumbers() {
    for (const dmg of game.damageNumbers) {
        const screen = worldToScreen(dmg.x, dmg.y);
        const y = screen.y - dmg.offsetY;

        // Calculate alpha (fade out at end)
        const alpha = Math.min(1, dmg.life * 2);
        ctx.globalAlpha = alpha;

        // Set up text style
        const fontSize = dmg.isCritical ? 16 : 12;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Color based on damage type
        let color = '#ff4444';  // Normal damage - red
        if (dmg.isCritical) {
            color = '#ffff00';  // Critical - yellow
        }

        // Draw outline for visibility
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(`-${dmg.damage}`, screen.x, y);

        // Draw text
        ctx.fillStyle = color;
        ctx.fillText(`-${dmg.damage}`, screen.x, y);

        // Add glow for critical hits
        if (dmg.isCritical) {
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 8;
            ctx.fillText(`-${dmg.damage}`, screen.x, y);
            ctx.shadowBlur = 0;
        }
    }
    ctx.globalAlpha = 1;
}

function findBuildPosition(nearX, nearY, role) {
    // Search outward from the base, using the same placement rules as the player
    for (let r = 2; r <= 10; r++) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
            const x = Math.floor(nearX + Math.cos(angle) * r);
            const y = Math.floor(nearY + Math.sin(angle) * r);
            if (canBuildAt(role, x, y)) return { x, y };
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

function initializeEventHandlers() {
    if (!canvas) {
        console.error('Cannot initialize event handlers: canvas not found');
        return;
    }

    canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Middle mouse button (button 1) - camera drag
    if (e.button === 1) {
        e.preventDefault();
        middleMouseDrag = {
            startX: e.clientX,
            startY: e.clientY,
            cameraStartX: game.camera.x,
            cameraStartY: game.camera.y
        };
        canvas.style.cursor = 'grabbing';
        return;
    }

    // Right click (button 2) or Command+Click (macOS) or Ctrl+Click (Windows/Linux)
    const isRightClick = e.button === 2 || (e.button === 0 && (e.metaKey || e.ctrlKey));

    if (e.button === 0 && !isRightClick) { // Left click (not Command/Ctrl)
        // Attack-move: A then left-click orders an aggressive march
        if (game.attackMoveMode) {
            const world = screenToWorld(x, y);
            for (const sel of game.selection) {
                if (!UNIT_TYPES[sel.type] || sel.playerId !== 0) continue;
                sel.targetX = world.x + (Math.random() - 0.5);
                sel.targetY = world.y + (Math.random() - 0.5);
                sel.attackMove = true;
                sel.attackTarget = null;
                sel.path = findPath(sel.x, sel.y, sel.targetX, sel.targetY);
            }
            game.attackMoveMode = false;
            addOrderMarker(world.x, world.y, 'attack');
            SoundManager.play('ack_attack');
            return;
        }
        if (game.placingBuilding) {
            // Place building
            const world = screenToWorld(x, y);
            const tx = Math.floor(world.x);
            const ty = Math.floor(world.y);
            const type = BUILDING_TYPES[game.placingBuilding];

            // Validate placement using canBuildAt function
            if (canBuildAt(game.placingBuilding, tx, ty) && game.players[0].oil >= type.cost) {
                // Create building with construction status
                createBuilding(game.placingBuilding, 0, tx, ty, true);
                game.players[0].oil -= type.cost;
                SoundManager.play('ui_build');
                // Only reset after successful placement
                game.placingBuilding = null;
                game.placingBuildingFrom = null;
            } else {
                SoundManager.play('denied');
            }
            // If placement failed, keep placingBuilding set so player can try again
            // Player can cancel with right-click or Escape
        } else {
            // Check if clicking on own unit or building
            // First check units (they should have priority since they're selectable for commands)
            const clickedUnit = game.units.find(u => {
                if (u.playerId !== 0) return false;
                const screen = worldToScreen(u.x, u.y);
                const dx = screen.x - x;
                const dy = screen.y - y;
                return Math.sqrt(dx * dx + dy * dy) < 25;
            });

            // Then check buildings
            const clickedBuilding = game.buildings.find(b => {
                if (b.playerId !== 0) return false;
                const screen = worldToScreen(b.x, b.y);
                const dx = screen.x - x;
                const dy = screen.y - y;
                return Math.sqrt(dx * dx + dy * dy) < 25;
            });

            if (clickedUnit) {
                // Directly select unit on mousedown for immediate feedback
                game.selection = [clickedUnit];
                SoundManager.play('unit_select');
            } else if (clickedBuilding) {
                // Select this building for building from
                game.selection = [clickedBuilding];
                SoundManager.play('unit_select');
            } else {
                // Start selection box
                game.selectionBox = { x1: x, y1: y, x2: x, y2: y };
            }
        }
    } else if (isRightClick) {
        // Cancel building placement / attack-move mode with right-click
        if (game.placingBuilding) {
            game.placingBuilding = null;
            game.placingBuildingFrom = null;
            return; // Don't process as unit command
        }
        if (game.attackMoveMode) {
            game.attackMoveMode = false;
            return;
        }

        const world = screenToWorld(x, y);

        // Rally point for a selected production building
        const selBuilding = game.selection.length === 1 ? game.selection[0] : null;
        if (selBuilding && BUILDING_TYPES[selBuilding.type] && selBuilding.playerId === 0 &&
            BUILDING_TYPES[selBuilding.type].produces.length > 0) {
            selBuilding.rallyX = world.x;
            selBuilding.rallyY = world.y;
            SoundManager.play('ui_click');
            return;
        }

        // Check if clicking on enemy - with different distance thresholds
        let enemyDirectClick = null;
        let enemyNearbyClick = null;

        // First check units
        const clickedUnit = game.units.find(u => {
            if (u.playerId === 0) return false;
            const screen = worldToScreen(u.x, u.y);
            const dx = screen.x - x;
            const dy = screen.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 40;
        });

        if (clickedUnit) {
            const screen = worldToScreen(clickedUnit.x, clickedUnit.y);
            const dist = Math.sqrt((screen.x - x) ** 2 + (screen.y - y) ** 2);
            if (dist < 15) {
                enemyDirectClick = clickedUnit;
            } else {
                enemyNearbyClick = clickedUnit;
            }
        }

        // If no unit clicked, check buildings
        if (!clickedUnit) {
            const clickedBuilding = game.buildings.find(b => {
                if (b.playerId === 0) return false;
                const screen = worldToScreen(b.x, b.y);
                const dx = screen.x - x;
                const dy = screen.y - y;
                return Math.sqrt(dx * dx + dy * dy) < 40;
            });

            if (clickedBuilding) {
                const screen = worldToScreen(clickedBuilding.x, clickedBuilding.y);
                const dist = Math.sqrt((screen.x - x) ** 2 + (screen.y - y) ** 2);
                if (dist < 20) {
                    enemyDirectClick = clickedBuilding;
                } else {
                    enemyNearbyClick = clickedBuilding;
                }
            }
        }

        // Audio-visual confirmation of the order
        const anyOwnUnits = game.selection.some(s => UNIT_TYPES[s.type] && s.playerId === 0);
        if (anyOwnUnits) {
            const isAttackOrder = !!(enemyDirectClick || enemyNearbyClick);
            addOrderMarker(world.x, world.y, isAttackOrder ? 'attack' : 'move');
            SoundManager.play(isAttackOrder ? 'ack_attack' : 'ack_move');
        }

        for (const sel of game.selection) {
            if (UNIT_TYPES[sel.type] && sel.playerId === 0) {
                sel.attackMove = false;
                sel.resumeX = undefined;
                sel.resumeY = undefined;
                if (enemyDirectClick) {
                    // Direct click on enemy - move back slightly while keeping in range
                    const type = UNIT_TYPES[sel.type];
                    const range = rangeT(type) || 2;
                    const backupRange = range * 0.6; // Stay at 60% of max range

                    const dx = enemyDirectClick.x - sel.x;
                    const dy = enemyDirectClick.y - sel.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Position behind the unit, keeping range
                    if (dist < backupRange) {
                        const angle = Math.atan2(dy, dx);
                        sel.targetX = enemyDirectClick.x - Math.cos(angle) * backupRange;
                        sel.targetY = enemyDirectClick.y - Math.sin(angle) * backupRange;
                    } else {
                        sel.targetX = sel.x;
                        sel.targetY = sel.y;
                    }

                    sel.attackTarget = enemyDirectClick;
                    sel.path = null;
                } else if (enemyNearbyClick) {
                    // Click near enemy - approach and auto-target nearby enemies
                    sel.closeTarget = enemyNearbyClick;
                    sel.targetX = enemyNearbyClick.x;
                    sel.targetY = enemyNearbyClick.y;
                    sel.attackTarget = null;
                    sel.path = null;
                } else {
                    // Calculate path for movement
                    const path = findPath(sel.x, sel.y, world.x, world.y);
                    if (path && path.length > 0) {
                        sel.path = path;
                        sel.pathIndex = 0;
                        sel.targetX = world.x;
                        sel.targetY = world.y;
                    } else {
                        // Fallback to direct movement if no path found
                        sel.targetX = world.x;
                        sel.targetY = world.y;
                        sel.path = null;
                    }
                    sel.attackTarget = null;
                }
            }
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    game.mouse.x = e.clientX - rect.left;
    game.mouse.y = e.clientY - rect.top;
    game.mouse.inside = true;

    // Middle mouse drag - pan camera
    if (middleMouseDrag) {
        const zoom = getZoom();
        const dx = (e.clientX - middleMouseDrag.startX) * 0.8 / zoom;
        const dy = (e.clientY - middleMouseDrag.startY) * 0.8 / zoom;
        game.camera.x = middleMouseDrag.cameraStartX - dx;
        game.camera.y = middleMouseDrag.cameraStartY - dy;
        return; // Don't update world coords or selection box while dragging
    }

    const world = screenToWorld(game.mouse.x, game.mouse.y);
    game.mouse.worldX = world.x;
    game.mouse.worldY = world.y;

    if (game.selectionBox) {
        game.selectionBox.x2 = game.mouse.x;
        game.selectionBox.y2 = game.mouse.y;
    }

    // Update cursor based on selection and what's under the mouse
    updateCursorEmoji();
});

// SVG Cursor definitions (proper vector cursors instead of emoji-based)
const CURSOR_SVG = {
    // Harvest cursor - oil drop icon
    harvest: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="%23fa0" stroke-width="2"/><path d="M16 6c-4 6-8 10-8 14a8 8 0 0 0 16 0c0-4-4-8-8-14z" fill="%23fa0"/><circle cx="13" cy="18" r="2" fill="%23fff" opacity="0.6"/></svg>')}`,
    // Attack cursor - crosshair with red accent
    attack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="%23f44" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="%23f44"/><line x1="16" y1="2" x2="16" y2="8" stroke="%23f44" stroke-width="2"/><line x1="16" y1="24" x2="16" y2="30" stroke="%23f44" stroke-width="2"/><line x1="2" y1="16" x2="8" y2="16" stroke="%23f44" stroke-width="2"/><line x1="24" y1="16" x2="30" y2="16" stroke="%23f44" stroke-width="2"/></svg>')}`
};

function updateCursorEmoji() {
    const tileX = Math.floor(game.mouse.worldX);
    const tileY = Math.floor(game.mouse.worldY);
    let newCursor = 'default';

    if (game.attackMoveMode) {
        newCursor = `url("${CURSOR_SVG.attack}") 16 16, auto`;
    } else if (game.selection.length > 0) {
        const sel = game.selection[0];

        if (sel.type && UNIT_TYPES[sel.type]) {
            // Check if any combat unit is selected and mouse is over enemy
            const isEnemy = game.units.find(u => {
                if (u.playerId === 0) return false;
                const screen = worldToScreen(u.x, u.y);
                const dx = screen.x - game.mouse.x;
                const dy = screen.y - game.mouse.y;
                return Math.sqrt(dx * dx + dy * dy) < 20;
            }) || game.buildings.find(b => {
                if (b.playerId === 0) return false;
                const screen = worldToScreen(b.x, b.y);
                const dx = screen.x - game.mouse.x;
                const dy = screen.y - game.mouse.y;
                return Math.sqrt(dx * dx + dy * dy) < 30;
            });

            if (isEnemy) {
                newCursor = `url("${CURSOR_SVG.attack}") 16 16, auto`;
            }
        }
    }

    if (newCursor !== 'default') {
        canvas.style.cursor = newCursor;
    } else {
        canvas.style.cursor = game.placingBuilding ? 'none' : 'crosshair';
    }
}

// Double-click to select all units of same type
let lastClickTarget = null;
let lastClickTime = 0;

canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = game.units.find(entity => {
        const screen = worldToScreen(entity.x, entity.y);
        const dx = screen.x - x;
        const dy = screen.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clicked && clicked.playerId === 0) {
        // Select all units of same type
        game.selection = game.units.filter(u => u.playerId === 0 && u.type === clicked.type);
    }
});

canvas.addEventListener('mouseup', (e) => {
    // Middle mouse button release - stop camera drag
    if (e.button === 1 && middleMouseDrag) {
        middleMouseDrag = null;
        canvas.style.cursor = game.placingBuilding ? 'none' : 'crosshair';
        return;
    }

    if (e.button === 0 && game.selectionBox) {
        const box = game.selectionBox;
        const minX = Math.min(box.x1, box.x2);
        const maxX = Math.max(box.x1, box.x2);
        const minY = Math.min(box.y1, box.y2);
        const maxY = Math.max(box.y1, box.y2);

        // Clear selection if not holding shift (Mac: Shift key)
        const isMultiSelect = keys['Shift'];
        if (!isMultiSelect) {
            game.selection = [];
        }

        // Box select or click select
        // Use the center of the selection box for click detection (more accurate than current mouse position)
        const clickX = (box.x1 + box.x2) / 2;
        const clickY = (box.y1 + box.y2) / 2;

        if (maxX - minX < 5 && maxY - minY < 5) {
            // Click select (single unit/building)
            // Sort by distance to find closest entity, prioritizing units over buildings
            const entitiesWithDistance = [...game.units, ...game.buildings]
                .filter(entity => entity.playerId === 0)
                .map(entity => {
                    const screen = worldToScreen(entity.x, entity.y);
                    const dx = screen.x - clickX;
                    const dy = screen.y - clickY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const isUnit = UNIT_TYPES[entity.type] !== undefined;
                    return { entity, dist, isUnit };
                })
                .filter(({ dist }) => dist < 30) // Increased click radius for better UX
                .sort((a, b) => {
                    // Prioritize units over buildings when close
                    if (a.isUnit !== b.isUnit && Math.abs(a.dist - b.dist) < 15) {
                        return a.isUnit ? -1 : 1;
                    }
                    return a.dist - b.dist;
                });

            const clicked = entitiesWithDistance.length > 0 ? entitiesWithDistance[0].entity : null;

            if (clicked && clicked.playerId === 0) {
                if (isMultiSelect && game.selection.includes(clicked)) {
                    // Deselect if already selected (Shift+Click toggle)
                    game.selection = game.selection.filter(u => u !== clicked);
                } else if (!isMultiSelect || !game.selection.includes(clicked)) {
                    // Add to selection or replace
                    if (!isMultiSelect) {
                        game.selection = [clicked];
                    } else {
                        game.selection.push(clicked);
                    }
                }
            }
        } else {
            // Box select (multiple units)
            for (const unit of game.units) {
                if (unit.playerId !== 0) continue;
                const screen = worldToScreen(unit.x, unit.y);
                if (screen.x >= minX && screen.x <= maxX &&
                    screen.y >= minY && screen.y <= maxY) {
                    if (!game.selection.includes(unit)) {
                        game.selection.push(unit);
                    }
                }
            }
        }

        game.selectionBox = null;
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

// Trackpad scroll and zoom support
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Trackpad pinch zoom (Cmd+Scroll on Mac) or Ctrl+Scroll
    if (e.ctrlKey || e.metaKey) {
        // Zoom in/out
        const zoomSpeed = 0.005;
        const zoomDelta = -e.deltaY * zoomSpeed;
        gameSettings.zoom = Math.max(
            gameSettings.minZoom,
            Math.min(gameSettings.maxZoom, gameSettings.zoom + zoomDelta)
        );
    } else {
        // Regular scroll for camera movement - proportional to scroll delta
        const zoom = getZoom();
        // Clamp the delta to avoid huge jumps, but keep proportional feel
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        const dx = clamp(e.deltaX, -100, 100) * 0.3 / zoom;
        const dy = clamp(e.deltaY, -100, 100) * 0.3 / zoom;
        game.camera.x += dx;
        game.camera.y += dy;
    }
}, { passive: false });

    // Browser-only support (Mobile removed)

    // Minimap click
    if (minimapCanvas) {
        minimapCanvas.addEventListener('mousedown', (e) => {
            const rect = minimapCanvas.getBoundingClientRect();
            // Convert CSS coordinates to canvas internal coordinates
            const canvasX = (e.clientX - rect.left) * (minimapCanvas.width / rect.width);
            const canvasY = (e.clientY - rect.top) * (minimapCanvas.height / rect.height);

            const minimapSize = Math.min(minimapCanvas.width, minimapCanvas.height);
            const scale = minimapSize / getMapSize();

            // Convert minimap pixel position to world tile coordinates
            const worldX = canvasX / scale;
            const worldY = canvasY / scale;

            // Convert world tile coords to isometric camera position
            game.camera.x = (worldX - worldY) * (TILE_WIDTH / 2);
            game.camera.y = (worldX + worldY) * (TILE_HEIGHT / 2);
        });
    }

    document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (game.status !== 'PLAYING' && e.key !== 'p' && e.key !== 'P') return;

    // Control groups: Ctrl/Cmd+1-9 assigns, 1-9 recalls, double-tap centers camera
    if (e.key >= '1' && e.key <= '9') {
        const groupKey = `group${e.key}`;
        if (e.metaKey || e.ctrlKey) {
            game[groupKey] = [...game.selection.filter(s => UNIT_TYPES[s.type])];
            e.preventDefault();
        } else {
            const members = (game[groupKey] || []).filter(u => game.units.includes(u) && u.hp > 0);
            game[groupKey] = members;
            if (members.length > 0) {
                game.selection = [...members];
                SoundManager.play('unit_select');
                // Double-tap: center camera on the group
                const now = Date.now();
                if (game._lastGroupKey === e.key && now - (game._lastGroupTime || 0) < 350) {
                    const cx = members.reduce((s, u) => s + u.x, 0) / members.length;
                    const cy = members.reduce((s, u) => s + u.y, 0) / members.length;
                    game.camera.x = (cx - cy) * (TILE_WIDTH / 2);
                    game.camera.y = (cx + cy) * (TILE_HEIGHT / 2);
                }
                game._lastGroupKey = e.key;
                game._lastGroupTime = now;
            }
            e.preventDefault();
        }
    }

    // A: attack-move mode (then left-click a destination)
    if ((e.key === 'a' || e.key === 'A') && !(e.metaKey || e.ctrlKey)) {
        const hasCombatUnits = game.selection.some(s => UNIT_TYPES[s.type] && s.playerId === 0);
        if (hasCombatUnits) {
            game.attackMoveMode = true;
            e.preventDefault();
        }
    }

    // S or X: stop
    if (e.key === 's' || e.key === 'S' || e.key === 'x' || e.key === 'X') {
        for (const sel of game.selection) {
            sel.targetX = undefined;
            sel.targetY = undefined;
            sel.attackTarget = null;
            sel.path = null;
            sel.closeTarget = null;
            sel.attackMove = false;
            sel.resumeX = undefined;
            sel.resumeY = undefined;
        }
    }

    // Space: jump to the last base-under-attack location
    if (e.key === ' ' && game.lastAttackAlert) {
        game.camera.x = (game.lastAttackAlert.x - game.lastAttackAlert.y) * (TILE_WIDTH / 2);
        game.camera.y = (game.lastAttackAlert.x + game.lastAttackAlert.y) * (TILE_HEIGHT / 2);
        e.preventDefault();
    }

    // H: select the HQ and center the camera on it
    if (e.key === 'h' || e.key === 'H') {
        const hq = game.buildings.find(b => b.playerId === 0 && b.type === 'hq');
        if (hq) {
            game.selection = [hq];
            game.camera.x = (hq.x - hq.y) * (TILE_WIDTH / 2);
            game.camera.y = (hq.x + hq.y) * (TILE_HEIGHT / 2);
        }
    }

    // P for pause
    if (e.key === 'p' || e.key === 'P') {
        togglePause();
    }

    // Escape to cancel
    if (e.key === 'Escape') {
        game.placingBuilding = null;
        game.placingBuildingFrom = null;
        game.attackMoveMode = false;
        game.selection = [];
    }

    // Zoom controls: + and - keys, or = and -
    if (e.key === '+' || e.key === '=' || e.key === 'NumpadAdd') {
        gameSettings.zoom = Math.min(gameSettings.maxZoom, gameSettings.zoom + 0.1);
        e.preventDefault();
    }
    if (e.key === '-' || e.key === '_' || e.key === 'NumpadSubtract') {
        gameSettings.zoom = Math.max(gameSettings.minZoom, gameSettings.zoom - 0.1);
        e.preventDefault();
    }
    // Reset zoom with 0
    if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        gameSettings.zoom = 1.0;
        e.preventDefault();
    }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

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

function updateCamera() {
    const speed = 10;

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
        const edgeSpeed = EDGE_SCROLL_SPEED / zoom;

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

    // Guided start on/off
    const tutorialEl = document.getElementById('tutorialSelect');
    gameSettings.tutorial = !tutorialEl || tutorialEl.value === 'on';

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
    showScreen('mainMenu');
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('timerDisplay').style.display = 'block';

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

    if (bgMusic && audioUnlocked) {
        bgMusic.volume = 0.3; // 30% Lautstärke
        bgMusic.currentTime = 0;
        bgMusic.play().catch(e => console.log('Music error:', e));
    }
}

function togglePause() {
    if (game.status !== 'PLAYING' && game.status !== 'PAUSED') return;

    const bgMusic = document.getElementById('backgroundMusic');

    if (game.status === 'PLAYING') {
        game.status = 'PAUSED';
        game.paused = true;
        showScreen('pauseScreen');
        // Pause music
        if (bgMusic) bgMusic.pause();
    } else if (game.status === 'PAUSED') {
        game.status = 'PLAYING';
        game.paused = false;
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        // Resume music
        if (bgMusic) bgMusic.play().catch(e => console.log('Resume music prevented:', e));
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
    game.shake = 0;
    terrainCache = null;
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
        showScreen('victoryScreen');
        const statsEl = document.getElementById('victoryStats');
        if (statsEl) {
            const timeMin = Math.floor(game.timeElapsed / 60);
            const timeSec = Math.floor(game.timeElapsed % 60);
            statsEl.innerHTML = `Time Limit Victory!<br>
Time: ${timeMin}:${String(timeSec).padStart(2, '0')}<br>
Your Forces: ${playerUnits} units, ${playerBuildings} buildings<br>
Enemy Forces: ${enemyUnits} units, ${enemyBuildings} buildings`;
        }
    } else {
        game.status = 'LOST';
        SoundManager.play('defeat');
        showScreen('defeatScreen');
        const statsEl = document.getElementById('defeatStats');
        if (statsEl) {
            statsEl.innerHTML = `Time Limit Reached<br>
Your Forces: ${playerUnits} units, ${playerBuildings} buildings<br>
Enemy Forces: ${enemyUnits} units, ${enemyBuildings} buildings`;
        }
    }
}

function checkWinCondition() {
    const enemyUnits = game.units.filter(u => u.playerId === 1);
    const enemyBuildings = game.buildings.filter(b => b.playerId === 1);

    if (enemyUnits.length === 0 && enemyBuildings.length === 0) {
        game.status = 'WON';
        SoundManager.play('victory');
        const playerUnits = game.units.filter(u => u.playerId === 0).length;
        const playerBuildings = game.buildings.filter(b => b.playerId === 0).length;
        showScreen('victoryScreen');
        const statsEl = document.getElementById('victoryStats');
        if (statsEl) {
            const timeMin = Math.floor(game.timeElapsed / 60);
            const timeSec = Math.floor(game.timeElapsed % 60);
            statsEl.innerHTML = `Time: ${timeMin}:${String(timeSec).padStart(2, '0')}<br>
Remaining Forces: ${playerUnits} units, ${playerBuildings} buildings<br>
Oil Remaining: ${Math.floor(game.players[0].oil)}`;
        }
    }
}

function checkLoseCondition() {
    const playerUnits = game.units.filter(u => u.playerId === 0);
    const playerBuildings = game.buildings.filter(b => b.playerId === 0);

    if (playerUnits.length === 0 && playerBuildings.length === 0) {
        game.status = 'LOST';
        SoundManager.play('defeat');
        showScreen('defeatScreen');
        const statsEl = document.getElementById('defeatStats');
        if (statsEl) {
            const timeMin = Math.floor(game.timeElapsed / 60);
            const timeSec = Math.floor(game.timeElapsed % 60);
            statsEl.innerHTML = `Time: ${timeMin}:${String(timeSec).padStart(2, '0')}<br>
All your units and buildings have been destroyed.`;
        }
    }
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

    if (newGameBtn) newGameBtn.addEventListener('click', goToSettings);
    if (settingsBtn) settingsBtn.addEventListener('click', goToSettings);
    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (backBtn) backBtn.addEventListener('click', goToMainMenu);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
    if (quitBtn) quitBtn.addEventListener('click', goToMainMenu);

    // Combat sound toggle in pause menu
    const combatSoundToggle = document.getElementById('combatSoundToggle');
    if (combatSoundToggle) {
        combatSoundToggle.addEventListener('change', (e) => {
            SoundManager.combatEnabled = e.target.checked;
        });
    }

    if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
        resetGame();
        initGame();
        game.status = 'PLAYING';
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('timerDisplay').style.display = 'block';
        // Show game interface
        document.getElementById('header').classList.add('game-active');
        document.getElementById('gameContainer').classList.add('game-active');
        document.getElementById('footer').classList.add('game-active');
        setTimeout(resizeCanvas, 0);
        // Restart background music
        const bgMusic = document.getElementById('backgroundMusic');
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(e => console.log('Music autoplay prevented:', e));
        }
    });
    if (retryBtn) retryBtn.addEventListener('click', () => {
        resetGame();
        initGame();
        game.status = 'PLAYING';
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('timerDisplay').style.display = 'block';
        // Show game interface
        document.getElementById('header').classList.add('game-active');
        document.getElementById('gameContainer').classList.add('game-active');
        document.getElementById('footer').classList.add('game-active');
        setTimeout(resizeCanvas, 0);
        // Restart background music
        const bgMusic = document.getElementById('backgroundMusic');
        if (bgMusic) {
            bgMusic.currentTime = 0;
            bgMusic.play().catch(e => console.log('Music autoplay prevented:', e));
        }
    });

    menuReturnBtns.forEach(btn => {
        btn.addEventListener('click', goToMainMenu);
    });
}

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
    generateMap();

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

    // Map is final now - render the static terrain cache
    buildTerrainCache();

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

function gameLoop(timestamp) {
    if (!canvas || !ctx) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Update canvas class based on placing building mode
    if (game.placingBuilding) {
        canvas.classList.add('placing-building');
    } else {
        canvas.classList.remove('placing-building');
    }

    // Only update and render game if playing (not paused/menu)
    if (game.status === 'PLAYING') {
        updateCamera();
        update(dt);
        updateGameTimer();
        checkWinCondition();
        checkLoseCondition();
    }

    render();
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

            if (progress < 100) {
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