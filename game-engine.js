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
            // SFX bus (music and voices have their own buses in audio.js)
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 1;
            this.sfxGain.connect(this.ctx.destination);
            if (typeof MusicEngine !== 'undefined') MusicEngine.init(this.ctx);
            if (typeof VoiceManager !== 'undefined') VoiceManager.init(this.ctx);
            console.log('[SoundManager] Initialized');
        } catch (e) {
            console.warn('[SoundManager] Web Audio not supported');
            this.enabled = false;
        }
    },

    setSfxVolume(v) {
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
            gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
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
        gain.connect(this.sfxGain || ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    }
};

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
let terrainCache = null;
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
    if (!fogCanvas || fogCanvas.width !== mapSize) {
        fogCanvas = document.createElement('canvas');
        fogCanvas.width = mapSize;
        fogCanvas.height = mapSize;
    }
    const fctx = fogCanvas.getContext('2d');
    const img = fctx.createImageData(mapSize, mapSize);
    for (let y = 0; y < mapSize; y++) {
        const row = game.fogOfWar[y];
        for (let x = 0; x < mapSize; x++) {
            const fog = row ? (row[x] ?? 0) : 0;
            const idx = (y * mapSize + x) * 4;
            // black, alpha by fog state
            img.data[idx + 3] = fog === 2 ? 0 : (fog === 1 ? 145 : 255);
        }
    }
    fctx.putImageData(img, 0, 0);
}

// One smoothed drawImage covers the whole shroud: the world-square
// [tx-0.5,tx+0.5]^2 maps exactly onto the tile diamond under the iso
// transform, so each fog pixel lands on its tile.
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
    ctx.drawImage(fogCanvas, -0.5, -0.5, mapSize, mapSize);
    ctx.restore();
}
// (the former #vignette overlay was removed - it read as a gray film
// over the battlefield)

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
    // Black background so off-diamond cache area blends with the shroud
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            drawTileToCache(x, y);
        }
    }
    // Soft mottling: big feathered light/dark blotches dissolve any
    // remaining tile seams into continuous ground
    const blotches = Math.floor(mapSize * mapSize / 14);
    for (let i = 0; i < blotches; i++) {
        const bx = tileRandom(i, 7) * mapSize;
        const by = tileRandom(i, 13) * mapSize;
        const tile = game.map[by | 0]?.[bx | 0];
        if (!tile || tile.type !== 'grass') continue;
        const p = tileCachePos(bx, by);
        const r = (1.5 + tileRandom(i, 23) * 2.5) * TILE_WIDTH / 2;
        const light = tileRandom(i, 31) > 0.5;
        const g = tctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, light ? 'rgba(190,168,120,0.10)' : 'rgba(52,40,24,0.10)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = g;
        tctx.beginPath();
        tctx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI * 2);
        tctx.fill();
    }

    // Second pass: raised rock walls over the ground layer
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            if (game.map[y]?.[x]?.type === 'hill') drawWallToCache(x, y);
        }
    }
}

// Raised rock outcrop: cliff faces down to the ground, cracked rocky top.
// Drawn in row order so southern walls naturally overlap northern faces.
function drawWallToCache(tx, ty) {
    if (!terrainCache) return;
    const c = terrainCache.ctx;
    const pos = tileCachePos(tx, ty);
    const H = 20; // wall height in px
    const hw = TILE_WIDTH / 2, hh = TILE_HEIGHT / 2;

    const top = { x: pos.x, y: pos.y - hh - H };
    const right = { x: pos.x + hw, y: pos.y - H };
    const bottom = { x: pos.x, y: pos.y + hh - H };
    const left = { x: pos.x - hw, y: pos.y - H };

    const v = (tileRandom(tx, ty, 5) - 0.5) * 18;
    const rockTop = `rgb(${Math.floor(132 + v)},${Math.floor(112 + v)},${Math.floor(84 + v)})`;
    const faceSE = `rgb(${Math.floor(92 + v)},${Math.floor(74 + v)},${Math.floor(52 + v)})`;
    const faceSW = `rgb(${Math.floor(70 + v)},${Math.floor(56 + v)},${Math.floor(40 + v)})`;

    // south-east cliff face
    c.fillStyle = faceSE;
    c.beginPath();
    c.moveTo(right.x, right.y);
    c.lineTo(bottom.x, bottom.y);
    c.lineTo(bottom.x, bottom.y + H);
    c.lineTo(right.x, right.y + H);
    c.closePath();
    c.fill();

    // south-west cliff face
    c.fillStyle = faceSW;
    c.beginPath();
    c.moveTo(bottom.x, bottom.y);
    c.lineTo(left.x, left.y);
    c.lineTo(left.x, left.y + H);
    c.lineTo(bottom.x, bottom.y + H);
    c.closePath();
    c.fill();

    // vertical strata cracks on the faces
    c.strokeStyle = 'rgba(30,22,14,0.4)';
    c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const t = 0.2 + tileRandom(tx, ty, 120 + i) * 0.6;
        const fx = bottom.x + (right.x - bottom.x) * t;
        const fy = bottom.y + (right.y - bottom.y) * t;
        c.beginPath();
        c.moveTo(fx, fy + 2);
        c.lineTo(fx + (tileRandom(tx, ty, 130 + i) - 0.5) * 3, fy + H - 2);
        c.stroke();
        const gx = left.x + (bottom.x - left.x) * t;
        const gy = left.y + (bottom.y - left.y) * t;
        c.beginPath();
        c.moveTo(gx, gy + 2);
        c.lineTo(gx + (tileRandom(tx, ty, 140 + i) - 0.5) * 3, gy + H - 2);
        c.stroke();
    }

    // rocky top
    c.fillStyle = rockTop;
    c.beginPath();
    c.moveTo(top.x, top.y);
    c.lineTo(right.x, right.y);
    c.lineTo(bottom.x, bottom.y);
    c.lineTo(left.x, left.y);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(40,30,20,0.5)';
    c.stroke();

    // boulders + cracks on top
    for (let i = 0; i < 3; i++) {
        const ox = (tileRandom(tx, ty, 150 + i) - 0.5) * 20;
        const oy = (tileRandom(tx, ty, 160 + i) - 0.5) * 10 - H;
        const rw = 2.5 + tileRandom(tx, ty, 170 + i) * 4;
        c.fillStyle = `rgba(60,46,32,0.55)`;
        c.beginPath();
        c.ellipse(pos.x + ox, pos.y + oy, rw, rw * 0.55, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(168,146,112,0.6)';
        c.beginPath();
        c.ellipse(pos.x + ox - rw * 0.25, pos.y + oy - rw * 0.3, rw * 0.45, rw * 0.28, 0, 0, Math.PI * 2);
        c.fill();
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
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = tx + dx, y = ty + dy;
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize &&
                game.map[y]?.[x]?.type === 'hill') {
                drawWallToCache(x, y);
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
        if (tileFog(t.x, t.y) !== 2) continue;
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
    // Clear to black: the off-map void reads as shroud rather than the
    // page background bleeding through past the world edge.
    ctx.fillStyle = '#000';
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
    drawDying();
    drawBunkers();

    // Draw buildings and units together, sorted by isometric depth (x + y).
    // Hostile entities stay hidden unless they sit on a currently-visible tile.
    const entities = [...game.buildings, ...game.units].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const entity of entities) {
        if (entity.playerId !== 0 && !isVisible(entity.x, entity.y)) continue;
        if (BUILDING_TYPES[entity.type] && game.buildings.includes(entity)) {
            drawBuilding(entity);
        } else {
            drawUnit(entity);
        }
    }

    // Fog-of-war shroud over everything on the ground
    drawFog();

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
            if (tileFog(t.x, t.y) === 0) continue;
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

    // F1 controls overlay
    if (game.showHelp) drawHelpOverlay();

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
    if (units.length < 2 && game.buildings.length === 0) return;

    // spatial hash: bucket units per tile (and stamp an index so each
    // pair is resolved exactly once without a costly indexOf lookup)
    const grid = new Map();
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        u._ci = i;
        const key = (u.x | 0) + ',' + (u.y | 0);
        let cell = grid.get(key);
        if (!cell) grid.set(key, cell = []);
        cell.push(u);
    }

    // pairwise separation within the 3x3 neighborhood
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const ut = UNIT_TYPES[u.type];
        if (!ut) continue;
        const ru = unitRadius(ut);
        const cx = u.x | 0, cy = u.y | 0;
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
                const cell = grid.get(gx + ',' + gy);
                if (!cell) continue;
                for (const v of cell) {
                    // handle each pair once
                    if (v._ci <= i) continue;
                    const vt = UNIT_TYPES[v.type];
                    if (!vt) continue;
                    const minD = ru + unitRadius(vt);
                    let dx = v.x - u.x, dy = v.y - u.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 >= minD * minD) continue;

                    // Tracked vehicles grind enemy infantry under their
                    // treads: no polite side-step for these pairs - a moving
                    // crusher closes in, and once the soldier is under the
                    // hull he's gone
                    if (u.playerId !== v.playerId) {
                        let crusher = null, victim = null;
                        if (ut.crushes && vt.category === 'infantry') { crusher = u; victim = v; }
                        else if (vt.crushes && ut.category === 'infantry') { crusher = v; victim = u; }
                        if (victim && victim.hp > 0) {
                            const driving = crusher.targetX !== undefined ||
                                (crusher.path && crusher.path.length > 0) || crusher.attackTarget;
                            if (driving) {
                                if (d2 < minD * minD * 0.5) {
                                    victim.hp = 0;
                                    victim.crushed = true;
                                    crusher.kills = (crusher.kills || 0) + 1;
                                }
                                continue; // never separate - let the treads do their work
                            }
                        }
                    }
                    let d = Math.sqrt(d2);
                    if (d < 0.001) {
                        // perfectly stacked: nudge apart in a random direction
                        const a = Math.random() * Math.PI * 2;
                        dx = Math.cos(a); dy = Math.sin(a); d = 1;
                    }
                    const push = Math.min(0.06, (minD - d) * 0.35);
                    const nx = dx / d, ny = dy / d;
                    u.x -= nx * push; u.y -= ny * push;
                    v.x += nx * push; v.y += ny * push;
                }
            }
        }

        // push out of building footprints - but never INTO a neighbouring
        // one: between two adjacent buildings that ping-pongs the unit
        // back and forth forever (units visibly "tangled" between them)
        for (const b of game.buildings) {
            const bt = BUILDING_TYPES[b.type];
            if (!bt) continue;
            const half = bt.size / 2 + ru * 0.5;
            const dx = u.x - b.x, dy = u.y - b.y;
            if (Math.abs(dx) < half && Math.abs(dy) < half) {
                const exitX = b.x + Math.sign(dx || 1) * Math.min(half, Math.abs(dx) + 0.06);
                const exitY = b.y + Math.sign(dy || 1) * Math.min(half, Math.abs(dy) + 0.06);
                const xFree = !isTileBlocked(exitX, u.y);
                const yFree = !isTileBlocked(u.x, exitY);
                if (Math.abs(dx) > Math.abs(dy) && xFree) {
                    u.x = exitX;
                } else if (yFree) {
                    u.y = exitY;
                } else if (xFree) {
                    u.x = exitX;
                } else {
                    // pocketed on both axes: lift the unit to the nearest
                    // genuinely free tile so it can be ordered away
                    const p = findValidSpawnPosition(Math.floor(u.x), Math.floor(u.y), 6);
                    u.x = p.x + 0.5;
                    u.y = p.y + 0.5;
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
                (spr.logicalWidth || spr.width) * zoom,
                (spr.logicalHeight || spr.height) * zoom);
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

function drawDying() {
    if (!game.dying) return;
    const zoom = getZoom();
    for (const d of game.dying) {
        const s = worldToScreen(d.x, d.y);
        const spr = IsoSprites.unitComposite(d.role, d.faction, d.dir);
        const w = (spr.logicalWidth || spr.width) * zoom;
        const h = (spr.logicalHeight || spr.height) * zoom;
        ctx.save();
        if (d.infantry) {
            // topple around the feet
            const p = Math.min(1, d.t / 0.55);
            ctx.translate(s.x, s.y);
            ctx.rotate(p * 1.5);
            ctx.globalAlpha = 1 - p * 0.7;
            ctx.drawImage(spr, -spr.anchorX * zoom, -spr.anchorY * zoom, w, h);
        } else {
            // white flash, then sink and fade under the fireball
            const p = Math.min(1, d.t / 0.5);
            ctx.globalAlpha = 1 - p * 0.8;
            const sink = p * 4 * zoom;
            try { if (d.t < 0.14) ctx.filter = 'brightness(2.4) saturate(0.5)'; } catch (e) { /* older engines */ }
            ctx.drawImage(spr, s.x - spr.anchorX * zoom, s.y - spr.anchorY * zoom + sink, w, h);
        }
        ctx.restore();
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
function drawHelpOverlay() {
    const lines = [
        ['Left click / drag', 'Select / box-select units'],
        ['Double-click', 'Select all units of that type'],
        ['Right click', 'Move / attack / set rally point'],
        ['A + left click', 'Attack-move (engage everything on the way)'],
        ['S or X', 'Stop'],
        ['H', 'Select & center your HQ'],
        ['Space', 'Jump to the last attack on your base'],
        ['1-9 / Ctrl+1-9', 'Recall / assign control group (double-tap centers)'],
        ['Arrows / screen edge', 'Scroll the map'],
        ['Wheel / trackpad', 'Scroll; Ctrl+wheel or +/- zoom'],
        ['Middle-drag', 'Pan the camera'],
        ['Right-click unit button', 'Cancel last queued unit (refund)'],
        ['P', 'Pause'],
        ['Esc', 'Cancel placement / clear selection'],
        ['F1', 'Close this help']
    ];
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    const w = 520, rowH = 24;
    const h = lines.length * rowH + 64;
    const x = (cw - w) / 2, y = (ch - h) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.font = 'bold 16px Rajdhani, Arial';
    ctx.fillStyle = '#ff8c55';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONTROLS', cw / 2, y + 26);

    ctx.font = '13px Rajdhani, Arial';
    lines.forEach(([key, what], i) => {
        const ly = y + 52 + i * rowH;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd890';
        ctx.fillText(key, x + 200, ly);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ccccdd';
        ctx.fillText(what, x + 216, ly);
    });
    ctx.restore();
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
        if (tileFog(b.x, b.y) === 0) continue; // still unexplored
        const screen = worldToScreen(b.x, b.y);
        if (screen.x < -120 || screen.x > canvas.offsetWidth + 120 ||
            screen.y < -140 || screen.y > canvas.offsetHeight + 80) continue;
        const sprite = IsoSprites.buildingSprite('bunker', 'survivors', b.claimed ? 1 : 0);
        const bscale = zoom * BUILDING_DRAW_SCALE;
        ctx.drawImage(sprite,
            screen.x - sprite.anchorX * bscale,
            screen.y - sprite.anchorY * bscale,
            (sprite.logicalWidth || sprite.width) * bscale,
            (sprite.logicalHeight || sprite.height) * bscale);
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
    const bscale = zoom * BUILDING_DRAW_SCALE;
    ctx.globalAlpha = isValid ? 0.65 : 0.35;
    ctx.drawImage(sprite,
        screen.x - sprite.anchorX * bscale,
        screen.y - sprite.anchorY * bscale,
        (sprite.logicalWidth || sprite.width) * bscale,
        (sprite.logicalHeight || sprite.height) * bscale);
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
    const variation = (smoothNoise(tx / 5, ty / 5) - 0.5) * 34 +
                      (smoothNoise(tx / 2.2 + 40, ty / 2.2 + 40) - 0.5) * 12 +
                      (tileRandom(tx, ty) - 0.5) * 2;
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

    // Draw isometric tile base, expanded ~1px so neighbours overlap.
    // Exact-fit diamonds leave antialiased subpixel gaps against the
    // black cache background - invisible at zoom 1.0 but they surface
    // as a dark grid when the cache is blitted at fractional zoom.
    const bleedX = tileW / 2 + 1.2;
    const bleedY = tileH / 2 + 0.8;
    c.beginPath();
    c.moveTo(pos.x, pos.y - bleedY);
    c.lineTo(pos.x + bleedX, pos.y);
    c.lineTo(pos.x, pos.y + bleedY);
    c.lineTo(pos.x - bleedX, pos.y);
    c.closePath();
    c.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
    c.fill();

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
            // (raised wall drawn in the second pass; keep base ground plain)
            break;
        case '_hill_unused':
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

// Buildings render smaller than their footprint so bases stay readable
// (scaling about the sprite anchor keeps them planted on their tile).
const BUILDING_DRAW_SCALE = 0.65;

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
    const bscale = zoom * BUILDING_DRAW_SCALE;
    const dx = screen.x - sprite.anchorX * bscale;
    const dy = screen.y - sprite.anchorY * bscale;
    const dw = (sprite.logicalWidth || sprite.width) * bscale;
    const dh = (sprite.logicalHeight || sprite.height) * bscale;

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

    // Rotating tower head
    if ((building.type === 'tower' || building.type === 'towerHeavy')) {
        const tdir = IsoSprites.dirFromAngle(building.turretAngle ?? Math.PI / 4);
        const tur = IsoSprites.turretSprite(building.type, faction, tdir);
        const mz = IsoSprites.towerTurretMount(building.type, faction) || 20;
        const ty = screen.y - mz * bscale;
        ctx.drawImage(tur,
            screen.x - tur.anchorX * bscale,
            ty - tur.anchorY * bscale,
            (tur.logicalWidth || tur.width) * bscale,
            (tur.logicalHeight || tur.height) * bscale);
    }

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
        // rally flag
        ctx.strokeStyle = '#c8c8b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rally.x, rally.y);
        ctx.lineTo(rally.x, rally.y - 14);
        ctx.stroke();
        ctx.fillStyle = '#33ff55';
        ctx.beginPath();
        ctx.moveTo(rally.x, rally.y - 14);
        ctx.lineTo(rally.x + 10, rally.y - 11);
        ctx.lineTo(rally.x, rally.y - 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(rally.x, rally.y, 4, 2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Hostile units get a red-shifted copy of their sprite so friend and foe
// read at a glance even when both sides field the same faction. Cached -
// the tint is baked once per sprite, not per frame.
const hostileTintCache = new Map();
function hostileTinted(sprite, key) {
    let c = hostileTintCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = sprite.width;
    c.height = sprite.height;
    c.logicalWidth = sprite.logicalWidth;
    c.logicalHeight = sprite.logicalHeight;
    c.anchorX = sprite.anchorX;
    c.anchorY = sprite.anchorY;
    const cc = c.getContext('2d');
    cc.drawImage(sprite, 0, 0);
    cc.globalCompositeOperation = 'source-atop';
    cc.fillStyle = 'rgba(255,42,30,0.24)';
    cc.fillRect(0, 0, c.width, c.height);
    hostileTintCache.set(key, c);
    return c;
}

function drawUnit(unit) {
    const type = UNIT_TYPES[unit.type];
    const screen = worldToScreen(unit.x, unit.y);
    const zoom = getZoom();
    const faction = getFaction(unit.playerId);
    const hostile = unit.playerId !== 0;

    const dir = IsoSprites.dirFromAngle(unit.angle || 0);
    // Infantry animates a two-frame stride while moving
    const moving = unit.targetX !== undefined || (unit.path && unit.path.length > 0);
    const walkFrame = moving ? Math.floor(game.tick / 10 + unit.x * 3) % 2 : 0;
    let sprite = IsoSprites.unitSprite(unit.type, faction, dir, walkFrame);
    if (hostile) sprite = hostileTinted(sprite, `u|${unit.type}|${faction}|${dir}|${walkFrame}`);

    const isSelected = game.selection.includes(unit);

    // hostile marker: faint red ring under every enemy unit
    if (hostile && !isSelected) {
        const rx = (type.size + 4) * zoom, ry = (type.size + 4) * 0.5 * zoom;
        ctx.strokeStyle = 'rgba(255,55,40,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 2 * zoom, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

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
        (sprite.logicalWidth || sprite.width) * zoom,
        (sprite.logicalHeight || sprite.height) * zoom);

    // Rotating turret overlay, mounted on the hull
    if (type.turret) {
        const tdir = IsoSprites.dirFromAngle(unit.turretAngle ?? unit.angle ?? 0);
        let tur = IsoSprites.turretSprite(unit.type, faction, tdir);
        if (hostile) tur = hostileTinted(tur, `t|${unit.type}|${faction}|${tdir}`);
        const m = IsoSprites.turretMount(unit.type, faction);
        const yaw = unit.angle || 0;
        const mx = m.ox * Math.cos(yaw), my = m.ox * Math.sin(yaw);
        const tx = screen.x + (mx - my) * zoom;
        const ty = screen.y + ((mx + my) / 2 - m.z) * zoom;
        ctx.drawImage(tur,
            tx - tur.anchorX * zoom,
            ty - tur.anchorY * zoom,
            (tur.logicalWidth || tur.width) * zoom,
            (tur.logicalHeight || tur.height) * zoom);
    }

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

    // Draw terrain, respecting the fog of war
    const mapSize = getMapSize();
    for (let y = 0; y < mapSize; y++) {
        if (!game.map[y]) continue;
        for (let x = 0; x < mapSize; x++) {
            const tile = game.map[y][x];
            if (!tile) continue;

            const fog = game.fogOfWar[y]?.[x] ?? 0;
            if (fog === 0) continue; // unexplored stays dark

            let color = '#85714e';
            if (tile.type === 'water') color = '#3a5c66';
            else if (tile.type === 'rock') color = '#606060';
            else if (tile.type === 'sand') color = '#a08050';
            else if (tile.type === 'hill') color = '#68523a';

            minimapCtx.fillStyle = color;
            minimapCtx.fillRect(x * scale, y * scale, scale + 1, scale + 1);

            // Oil deposits, once scouted
            if (tile.oil) {
                minimapCtx.fillStyle = (tile.oilAmount !== undefined && tile.oilAmount <= 0) ? '#332f1f' : '#cfae3a';
                minimapCtx.fillRect(x * scale, y * scale, scale, scale);
            }

            // Veil explored-but-unseen tiles
            if (fog === 1) {
                minimapCtx.fillStyle = 'rgba(0,0,0,0.5)';
                minimapCtx.fillRect(x * scale, y * scale, scale + 1, scale + 1);
            }
        }
    }

    // Draw buildings (own always; hostiles only while in sight)
    for (const b of game.buildings) {
        if (b.playerId !== 0 && !isVisible(b.x, b.y)) continue;
        minimapCtx.fillStyle = b.playerId === 0 ? game.players[b.playerId].color : '#ff4444';
        minimapCtx.fillRect(b.x * scale - 2, b.y * scale - 2, 4, 4);
    }

    // Draw units (own always; hostiles only while in sight)
    for (const u of game.units) {
        if (u.playerId !== 0 && !isVisible(u.x, u.y)) continue;
        minimapCtx.fillStyle = u.playerId === 0 ? game.players[u.playerId].color : '#ff4444';
        minimapCtx.fillRect(u.x * scale - 1, u.y * scale - 1, 2, 2);
    }

    // Unclaimed tech bunkers
    if (game.bunkers) {
        for (const b of game.bunkers) {
            if (b.claimed || tileFog(b.x, b.y) === 0) continue;
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
    const maxIterations = 3500; // Allow longer detours around bases and ridges

    while (openSet.length > 0 && iterations < maxIterations) {
        iterations++;

        // Find node with lowest fScore
        let current = openSet[0];
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            const currentF = fScore.get(key(openSet[i].x, openSet[i].y)) ?? Infinity;
            const bestF = fScore.get(key(current.x, current.y)) ?? Infinity;
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
            // Building footprints block the way (except the goal itself,
            // so ordering units next to a building still works)
            if (isTileBlocked(nx, ny) && !(nx === end.x && ny === end.y)) {
                continue;
            }
            // No corner cutting: a diagonal step needs both orthogonal
            // neighbors free, or the movement clips the obstacle corner
            if (dir.dx !== 0 && dir.dy !== 0) {
                const sideA = game.map?.[current.y]?.[nx];
                const sideB = game.map?.[ny]?.[current.x];
                const aBad = !sideA || sideA.type === 'water' || sideA.type === 'hill' ||
                    isTileBlocked(nx, current.y);
                const bBad = !sideB || sideB.type === 'water' || sideB.type === 'hill' ||
                    isTileBlocked(current.x, ny);
                if (aBad || bBad) continue;
            }

            validNeighbors++;
            const tentativeG = (gScore.get(key(current.x, current.y)) ?? Infinity) +
                              (dir.dx !== 0 && dir.dy !== 0 ? 1.414 : 1); // Diagonal cost

            const neighborKey = key(nx, ny);
            const currentG = gScore.get(neighborKey) ?? Infinity;

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

        // Death check: hand the unit over to the dying animation
        if (unit.hp <= 0) {
            if (unit.crushed) {
                // ground under the treads: instant splat, no fireball
                addDecal({
                    type: 'splat', x: unit.x, y: unit.y, life: 30,
                    color: getFaction(unit.playerId) === 'series9'
                        ? 'rgba(30,34,40,0.7)' : 'rgba(84,22,16,0.65)',
                    drops: Array.from({ length: 4 }, () => [
                        (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 11, 1.5 + Math.random() * 2])
                });
                for (let p = 0; p < 8; p++) {
                    game.particles.push({
                        x: unit.x + (Math.random() - 0.5) * 0.6,
                        y: unit.y + (Math.random() - 0.5) * 0.6,
                        z: 1,
                        vx: (Math.random() - 0.5) * 0.25,
                        vy: (Math.random() - 0.5) * 0.25,
                        vz: Math.random() * 0.12,
                        color: p < 5 ? '#7a1e12' : '#8a7a5a',
                        size: Math.random() * 2 + 1,
                        life: 0.5
                    });
                }
                SoundManager.play('explosion_small');
            } else {
                createExplosion(unit.x, unit.y);
                SoundManager.play('explosion_small');
                if (!game.dying) game.dying = [];
                game.dying.push({
                    role: unit.type,
                    faction: getFaction(unit.playerId),
                    dir: IsoSprites.dirFromAngle(unit.angle || 0),
                    x: unit.x, y: unit.y, t: 0,
                    infantry: type.category === 'infantry'
                });
            }
            if (unit.playerId === 0) game.stats.unitsLost++;
            game.units.splice(i, 1);
            game.selection = game.selection.filter(s => s !== unit);
            continue;
        }

        // Turret tracking: swing toward the target, else settle forward
        if (type.turret) {
            const tgt = unit.attackTarget;
            const desired = (tgt && tgt.hp > 0)
                ? Math.atan2(tgt.y - unit.y, tgt.x - unit.x)
                : unit.angle || 0;
            unit.turretAngle = rotateToward(unit.turretAngle ?? unit.angle ?? 0, desired, 0.09);
        }

        // Attack logic
        if (unit.attackTarget) {
            const target = unit.attackTarget;

            // Leash: units that engaged on their own (base defense or
            // idle auto-attack) break pursuit and walk back to their post
            // instead of chasing a retreating raider across the map.
            // Two break conditions: dragged too far from the post, or the
            // target has escaped out of sight (it outruns us anyway).
            if (unit._leash && target.hp > 0) {
                const ldist = Math.hypot(unit.x - unit._leash.x, unit.y - unit._leash.y);
                const tdist = Math.hypot(target.x - unit.x, target.y - unit.y);
                if (ldist > 7 || tdist > sightT(type) * 1.5) {
                    unit.attackTarget = null;
                    unit.targetX = unit._leash.x;
                    unit.targetY = unit._leash.y;
                    unit.path = null;
                    unit._leash = null;
                    continue;
                }
            }

            if (target.hp <= 0) {
                unit.attackTarget = null;
                // Attack-move: resume marching to the ordered destination
                if (unit.attackMove && unit.resumeX !== undefined) {
                    unit.targetX = unit.resumeX;
                    unit.targetY = unit.resumeY;
                } else if (unit._leash) {
                    // threat dealt with: return to the guard post
                    unit.targetX = unit._leash.x;
                    unit.targetY = unit._leash.y;
                    unit._leash = null;
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

                    // Rock walls block direct fire: units without overWalls
                    // must keep advancing until they have a clear line
                    const losClear = type.overWalls ||
                        checkLineOfSight(unit.x, unit.y, target.x, target.y) < 0;

                    // Stay at optimal range (with some buffer)
                    const optimalRange = rangeT(type) * 0.9;
                    const backupDistance = rangeT(type) * 0.3; // Only back up if much too close

                    if (dist > optimalRange || (!losClear && dist > 1.4)) {
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
                    // Fire with a clear line and (for turreted units) an aligned turret
                    const aimed = !type.turret ||
                        angleDiff(unit.turretAngle ?? unit.angle, Math.atan2(dy, dx)) < 0.35;
                    if (dist <= rangeT(type) && losClear && aimed &&
                        game.tick - unit.lastAttack > type.attackSpeed / 16) {
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

            // Stuck watchdog: if the unit hasn't gotten closer to its
            // destination for a while (wedged on a wall, a building or
            // other units), find a fresh path on its own. After repeated
            // failures, nudge the goal; eventually give up gracefully.
            if ((game.tick + i) % 45 === 0) {
                const prog = unit._prog;
                if (prog && prog.tx === unit.targetX && prog.ty === unit.targetY) {
                    const moved = Math.hypot(unit.x - prog.x, unit.y - prog.y);
                    if (moved < 0.2 && dist > 1.2) {
                        prog.fails = (prog.fails || 0) + 1;
                        if (prog.fails >= 6) {
                            // hopeless: stop cleanly instead of twitching forever
                            unit.targetX = undefined;
                            unit.targetY = undefined;
                            unit.path = null;
                            unit._prog = null;
                        } else {
                            if (prog.fails >= 3) {
                                // loosen the goal a little - the exact slot
                                // may simply be unreachable
                                unit.targetX += (Math.random() - 0.5) * 2;
                                unit.targetY += (Math.random() - 0.5) * 2;
                            }
                            unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
                        }
                    } else if (moved >= 0.2) {
                        prog.fails = 0;
                    }
                }
                if (unit.targetX !== undefined) {
                    unit._prog = {
                        x: unit.x, y: unit.y,
                        tx: unit.targetX, ty: unit.targetY,
                        fails: (unit._prog && unit._prog.fails) || 0
                    };
                }
            }

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
                const nextBlocked = nextTile &&
                    (nextTile.type === 'hill' || nextTile.type === 'water' ||
                     isTileBlocked(unit.x + moveX, unit.y + moveY));

                if (unit.path && unit.path.length > 0) {
                    // Committed to a path: follow it waypoint by waypoint
                    // instead of abandoning it whenever the direct line
                    // briefly opens up (that caused endless wall-hugging)
                    const wp = unit.path[0];
                    const pdx = wp.x - unit.x;
                    const pdy = wp.y - unit.y;
                    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

                    if (pdist < 0.5) {
                        unit.path.shift();
                    } else {
                        unit.x += (pdx / pdist) * speed;
                        unit.y += (pdy / pdist) * speed;
                        unit.angle = Math.atan2(pdy, pdx);
                    }
                } else if (nextBlocked) {
                    // Blocked with no path: plan one
                    unit.path = findPath(unit.x, unit.y, unit.targetX, unit.targetY);
                    if (!unit.path) {
                        unit.stuckCounter = (unit.stuckCounter || 0) + 1;
                        if (unit.stuckCounter > 30) {
                            // Back up and try a different route
                            unit.x -= (dx / dist) * speed * 0.5;
                            unit.y -= (dy / dist) * speed * 0.5;
                            unit.stuckCounter = 0;
                        }
                    } else {
                        unit.stuckCounter = 0;
                    }
                } else {
                    // Clear line: move directly
                    unit.x += moveX;
                    unit.y += moveY;
                    unit.angle = Math.atan2(dy, dx);
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
        if (tileType === 'water' || tileType === 'hill' || isTileBlocked(unit.x, unit.y)) {
            // Push unit to nearest valid position (also rescues units
            // that ended up inside a building footprint)
            const validPos = findValidSpawnPosition(Math.floor(unit.x), Math.floor(unit.y), 6);
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

            // Check for enemy units in sight range (walls hide targets
            // from direct-fire units)
            for (const enemy of game.units) {
                if (enemy.playerId === unit.playerId) continue;
                const dx = enemy.x - unit.x;
                const dy = enemy.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= sightRange && dist < nearestDist &&
                    (type.overWalls || checkLineOfSight(unit.x, unit.y, enemy.x, enemy.y) < 0)) {
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

                    if (dist <= sightRange && dist < nearestDist &&
                        (type.overWalls || checkLineOfSight(unit.x, unit.y, building.x, building.y) < 0)) {
                        nearestDist = dist;
                        nearestEnemy = building;
                    }
                }
            }

            if (nearestEnemy && nearestEnemy.hp > 0) {
                unit.attackTarget = nearestEnemy;
                // self-acquired target: remember the post to return to
                unit._leash = { x: unit.x, y: unit.y };
            }
        }
    }
}

// When a building takes a hit, idle combat units of the same player
// near the base move in to defend. They engage on a leash (see
// updateUnits) so a hit-and-run raider doesn't drag them away.
function alertDefenders(building, attacker) {
    for (const u of game.units) {
        if (u.playerId !== building.playerId) continue;
        const t = UNIT_TYPES[u.type];
        if (!t || t.damage <= 0) continue;
        if (u.attackTarget || u.targetX !== undefined) continue; // busy
        if (Math.hypot(u.x - building.x, u.y - building.y) > 14) continue;
        u.attackTarget = attacker;
        u._leash = { x: u.x, y: u.y };
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
            game.buildings.splice(i, 1);
            game.selection = game.selection.filter(s => s !== building);
            continue;
        }

        // Tower head rotation runs every frame (smooth tracking)
        if (type.damage && !building.isUnderConstruction) {
            const tgt = building.currentTarget;
            const valid = tgt && tgt.hp > 0 && game.units.includes(tgt);
            if (!valid) building.currentTarget = null;
            const desired = valid
                ? Math.atan2(tgt.y - building.y, tgt.x - building.x)
                : Math.PI / 4;
            building.turretAngle = rotateToward(building.turretAngle ?? Math.PI / 4, desired, 0.06);
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

                    // In range and not hidden behind a rock wall
                    const dx = unit.x - building.x;
                    const dy = unit.y - building.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < rangeT(type) && dist < nearestDist &&
                        checkLineOfSight(building.x, building.y, unit.x, unit.y) < 0) {
                        nearestDist = dist;
                        nearestEnemy = unit;
                    }
                }

                building.currentTarget = nearestEnemy || null;
                if (nearestEnemy && nearestEnemy.hp > 0 &&
                    angleDiff(building.turretAngle ?? Math.PI / 4,
                        Math.atan2(nearestEnemy.y - building.y, nearestEnemy.x - building.x)) < 0.4 &&
                    game.tick - (building.lastAttack || 0) > type.attackSpeed / 16) {
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
                    if (typeof VoiceManager !== 'undefined') {
                        VoiceManager.play('ready', getFaction(0));
                    }
                    game.stats.unitsBuilt++;
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
                    vx: Math.cos(ang) * 0.18, vy: Math.sin(ang) * 0.18, vz: 0.4,
                    color: '#ffd14a', size: 2.2, life: 0.8, type: 'spark'
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
                    // battle heat feeds the dynamic music layer
                    if (proj.playerId === 0 || proj.target.playerId === 0) {
                        game.combatHeat = Math.min(1, (game.combatHeat || 0) + 0.12);
                    }
                    // a hit on a building scrambles nearby idle defenders
                    if (BUILDING_TYPES[proj.target.type] && proj.source &&
                        proj.source.hp > 0 && game.units.includes(proj.source)) {
                        alertDefenders(proj.target, proj.source);
                    }
                    // Base-under-attack alert (minimap ping + throttled sound + Space jumps there)
                    if (proj.target.playerId === 0) {
                        game.lastAttackAlert = { x: proj.target.x, y: proj.target.y, time: Date.now() };
                        if (!game._lastAlertSound || Date.now() - game._lastAlertSound > 12000) {
                            game._lastAlertSound = Date.now();
                            SoundManager.play('alert');
                        }
                    }
                    if (proj.target.hp <= 0) registerKill(proj, proj.target);
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
                                    if (v.hp <= 0) registerKill(proj, v);
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
                if (building.playerId === 0) game.stats.oilEarned += pumped;
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

    const makeButton = (iconUrl, label, cost, title, enabled, onClick, desc, onCancel) => {
        const btn = document.createElement('button');
        btn.className = 'build-btn';
        btn.innerHTML = `<img src="${iconUrl}" alt=""><span class="build-btn-label">${label}</span><span class="build-btn-cost">${cost}</span>`;
        if (!enabled) btn.classList.add('disabled');
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button === 2) {
                if (onCancel) onCancel();
                return;
            }
            if (e.button !== 0) return;
            if (btn.classList.contains('disabled')) {
                SoundManager.play('denied');
                return;
            }
            onClick();
        });
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
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
            // the rally-point hint talks about right-click - meaningless on
            // touch, and the long text wraps the narrow mobile sidebar badly
            const rallyHint = document.body.classList.contains('touch-device')
                ? '' : ' <span style="color:#667;">(Right-click ground: rally point)</span>';
            queueInfo.innerHTML = `Queue: <strong>${selectedBuilding.productionQueue.length}/10</strong>` + rallyHint;
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
                const stats = `DMG ${uType.damage} | RNG ${(uType.range / 24).toFixed(1)} | SPD ${(uType.speed * 60).toFixed(1)} | HP ${uType.hp}\nRight-click: cancel last queued (refund)`;
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
                }, UNIT_DESC[unitRole], () => {
                    // cancel the most recent queued unit of this role, full refund
                    for (let qi = selectedBuilding.productionQueue.length - 1; qi >= 0; qi--) {
                        if (selectedBuilding.productionQueue[qi].type === unitRole) {
                            selectedBuilding.productionQueue.splice(qi, 1);
                            if (qi === 0) selectedBuilding.produceProgress = 0;
                            player.oil += uType.cost;
                            SoundManager.play('ui_click');
                            menu._lastStateKey = null;
                            updateBuildMenu();
                            return;
                        }
                    }
                    SoundManager.play('denied');
                });
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

// Occupancy grid: tiles covered by building footprints are unwalkable
// for pathfinding and direct movement.
function blockTilesFor(building, block) {
    if (!game.blockedTiles) game.blockedTiles = new Set();
    const bType = BUILDING_TYPES[building.type];
    if (!bType) return;
    const reach = Math.max(0, Math.floor(bType.size / 2));
    for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
            const key = (Math.floor(building.x) + dx) + ',' + (Math.floor(building.y) + dy);
            if (block) game.blockedTiles.add(key);
            else game.blockedTiles.delete(key);
        }
    }
}

function isTileBlocked(x, y) {
    return game.blockedTiles && game.blockedTiles.has((x | 0) + ',' + (y | 0));
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
    blockTilesFor(building, true);
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

    // Rock walls block direct fire; siege weapons lob over them
    const blockadeIndex = type.overWalls ? -1 :
        checkLineOfSight(source.x, source.y, target.x, target.y);

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
            const fighters = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
            const slots = formationOffsets(fighters.length, 1.3);
            fighters.forEach((sel, k) => {
                sel.targetX = world.x + slots[k].x;
                sel.targetY = world.y + slots[k].y;
                sel.attackMove = true;
                sel.attackTarget = null;
                sel.path = findPath(sel.x, sel.y, sel.targetX, sel.targetY);
            });
            game.attackMoveMode = false;
            addOrderMarker(world.x, world.y, 'attack');
            SoundManager.play('ack_attack');
            if (typeof VoiceManager !== 'undefined') {
                VoiceManager.play('attack', getFaction(0));
            }
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
                if (typeof VoiceManager !== 'undefined') {
                    VoiceManager.play('select', getFaction(0));
                }
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
        const movers = game.selection.filter(s => UNIT_TYPES[s.type] && s.playerId === 0);
        if (movers.length > 0) {
            const isAttackOrder = !!(enemyDirectClick || enemyNearbyClick);
            addOrderMarker(world.x, world.y, isAttackOrder ? 'attack' : 'move');
            SoundManager.play(isAttackOrder ? 'ack_attack' : 'ack_move');
            if (typeof VoiceManager !== 'undefined') {
                VoiceManager.play(isAttackOrder ? 'attack' : 'move', getFaction(0));
            }
        }

        // Group moves spread into a formation grid around the click point
        const slots = formationOffsets(movers.length);
        let slotIndex = 0;

        for (const sel of game.selection) {
            if (UNIT_TYPES[sel.type] && sel.playerId === 0) {
                const slot = slots[slotIndex++] || { x: 0, y: 0 };
                sel.attackMove = false;
                sel.resumeX = undefined;
                sel.resumeY = undefined;
                sel._leash = null; // explicit orders override guard duty
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
                    // Move to this unit's formation slot
                    const gx = world.x + slot.x;
                    const gy = world.y + slot.y;
                    const path = findPath(sel.x, sel.y, gx, gy);
                    if (path && path.length > 0) {
                        sel.path = path;
                        sel.pathIndex = 0;
                        sel.targetX = gx;
                        sel.targetY = gy;
                    } else {
                        // Fallback to direct movement if no path found
                        sel.targetX = gx;
                        sel.targetY = gy;
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

    // F1: toggle the controls overlay
    if (e.key === 'F1') {
        game.showHelp = !game.showHelp;
        e.preventDefault();
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
            tutorial: gameSettings.tutorial ? 'on' : 'off'
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
    game.blockedTiles = new Set();
    game.stats = { unitsBuilt: 0, unitsLost: 0, unitsKilled: 0, buildingsRazed: 0, oilEarned: 0, bunkersClaimed: 0 };
    game._promoBannerShown = false;
    game._remnantsPingTime = 0;
    game.showHelp = false;
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
        if (statsEl) statsEl.innerHTML = '<div style="margin-bottom:8px;">Time limit reached - your forces prevail!</div>' + buildStatsHTML();
    } else {
        game.status = 'LOST';
        SoundManager.play('defeat');
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
        document.getElementById('timerDisplay').style.display = 'block';
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
        document.getElementById('timerDisplay').style.display = 'block';
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

    // Seed the fog of war so the starting base is revealed immediately
    updateFogOfWar();
    updateFogCanvas();

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