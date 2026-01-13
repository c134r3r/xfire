// Detect Mac and update control help text
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
if (isMac) {
    const helpEl = document.getElementById('controlsHelp');
    if (helpEl) {
        helpEl.innerHTML = 'Controls: Left-click select | ⌘+Click or right-click move/attack | Drag to box-select | WASD/Arrows scroll | ⌘+1–5 unit groups';
    }
}

// ============================================
// XFIRE - Skirmish RTS Game Engine
// ============================================

let canvas, ctx, minimapCanvas, minimapCtx;
let assetLoader;
let useSprites = true; // Toggle between sprite-based and procedural graphics
const dpr = window.devicePixelRatio || 1;

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

    // High-DPI canvas setup for crisp graphics
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = (canvas.width / dpr) + 'px';
    canvas.style.height = (canvas.height / dpr) + 'px';

    // Enable image smoothing for better rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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

    // Initialize asset loader with placeholder graphics
    if (typeof AssetLoader !== 'undefined') {
        assetLoader = new AssetLoader();
        assetLoader.createPlaceholders();
        console.log('Asset loader initialized with placeholder sprites');
    } else {
        console.warn('AssetLoader not available - using procedural graphics only');
        useSprites = false;
    }

    return true;
}

// Game Settings
const gameSettings = {
    timeLimit: 'unlimited',
    difficulty: 'normal',
    mapSize: 'medium',
    startingOil: 1200,
    MAP_SIZE: MAP_SIZE
};

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
    players: [
        { id: 0, color: '#4488ff', oil: 1200, power: 100, team: 'player', tech: { barracks: true, factory: false, academy: false } },
        { id: 1, color: '#ff4444', oil: 1200, power: 100, team: 'enemy', tech: { barracks: true, factory: false, academy: false } }
    ],
    units: [],
    buildings: [],
    projectiles: [],
    particles: [],
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

    // Initialize with grass
    for (let y = 0; y < MAP_SIZE; y++) {
        game.map[y] = [];
        game.fogOfWar[y] = [];
        for (let x = 0; x < MAP_SIZE; x++) {
            game.map[y][x] = {
                type: 'grass',
                height: 0,
                oil: false
            };
            game.fogOfWar[y][x] = game.players[0].team === 'player' ? 0 : 2;
        }
    }

    // Add terrain features using simplex-like noise
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) +
                         Math.sin(x * 0.05 + 1) * Math.cos(y * 0.07) * 0.5;

            if (noise > 0.7) {
                game.map[y][x].type = 'rock';
                game.map[y][x].height = 1;
            } else if (noise < -0.6) {
                game.map[y][x].type = 'water';
                game.map[y][x].height = -1;
            } else if (noise > 0.3 && noise < 0.5) {
                game.map[y][x].type = 'sand';
            }
        }
    }

    // Add hill areas (small mountain clusters for cover)
    const hillCount = 3 + Math.floor(Math.random() * 3);
    for (let h = 0; h < hillCount; h++) {
        const centerX = 10 + Math.floor(Math.random() * (MAP_SIZE - 20));
        const centerY = 10 + Math.floor(Math.random() * (MAP_SIZE - 20));
        const hillSize = 3 + Math.floor(Math.random() * 4);

        for (let y = centerY - hillSize; y <= centerY + hillSize; y++) {
            for (let x = centerX - hillSize; x <= centerX + hillSize; x++) {
                if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (dist <= hillSize) {
                    const tile = game.map[y][x];
                    // Only add hills to grass/sand
                    if (tile.type === 'grass' || tile.type === 'sand') {
                        tile.type = 'hill';
                        tile.height = 2; // Higher elevation
                    }
                }
            }
        }
    }

    // Add oil deposits
    const oilCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < oilCount; i++) {
        const x = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
        const y = 5 + Math.floor(Math.random() * (MAP_SIZE - 10));
        if (game.map[y][x].type === 'grass' || game.map[y][x].type === 'sand') {
            game.map[y][x].oil = true;
        }
    }
}

// ============================================
// COORDINATE CONVERSION (Isometric)
// ============================================

function worldToScreen(x, y) {
    const isoX = (x - y) * (TILE_WIDTH / 2);
    const isoY = (x + y) * (TILE_HEIGHT / 2);
    return {
        x: isoX - game.camera.x + canvas.offsetWidth / 2,
        y: isoY - game.camera.y + canvas.offsetHeight / 2
    };
}

function screenToWorld(sx, sy) {
    const x = sx + game.camera.x - canvas.offsetWidth / 2;
    const y = sy + game.camera.y - canvas.offsetHeight / 2;
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

function render() {
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Determine visible tiles
    const startTile = screenToWorld(0, 0);
    const endTile = screenToWorld(canvas.offsetWidth, canvas.offsetHeight);

    const minX = Math.max(0, Math.floor(startTile.x) - 2);
    const maxX = Math.min(MAP_SIZE, Math.ceil(endTile.x) + 4);
    const minY = Math.max(0, Math.floor(startTile.y) - 2);
    const maxY = Math.min(MAP_SIZE, Math.ceil(endTile.y) + 4);

    // Draw tiles
    for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
            drawTile(x, y);
        }
    }

    // Draw buildings (sorted by y for depth)
    const sortedBuildings = [...game.buildings].sort((a, b) => a.y - b.y);
    for (const building of sortedBuildings) {
        drawBuilding(building);
    }

    // Draw units (sorted by y for depth)
    const sortedUnits = [...game.units].sort((a, b) => a.y - b.y);
    for (const unit of sortedUnits) {
        // Draw glow for selected units
        if (game.selection.includes(unit)) {
            drawUnitGlow(unit);
        }
        drawUnit(unit);
    }

    // Draw projectiles
    for (const proj of game.projectiles) {
        drawProjectile(proj);
    }

    // Draw particles
    for (const particle of game.particles) {
        drawParticle(particle);
    }

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

    // Draw building placement preview
    if (game.placingBuilding) {
        const world = screenToWorld(game.mouse.x, game.mouse.y);
        const tx = Math.floor(world.x);
        const ty = Math.floor(world.y);

        const isValid = canBuildAt(game.placingBuilding, tx, ty) &&
                        game.players[0].oil >= BUILDING_TYPES[game.placingBuilding].cost;

        drawBuildingPreview(game.placingBuilding, tx, ty, isValid);
    }

    // Draw minimap
    renderMinimap();
}

function drawBuildingPreview(buildingType, tx, ty, isValid) {
    const type = BUILDING_TYPES[buildingType];
    if (!type) return;

    const screen = worldToScreen(tx, ty);
    const size = type.size * 20;

    // Choose color based on validity
    let color = isValid ? '#00ff00' : '#ff0000';
    let alpha = isValid ? 0.5 : 0.3;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    // Draw building preview box
    ctx.fillRect(screen.x - size/2, screen.y - size - 5, size, size);

    ctx.globalAlpha = 1;

    // Draw border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(screen.x - size/2, screen.y - size - 5, size, size);

    // Draw range indicator for towers
    if (type.range) {
        ctx.strokeStyle = isValid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rangeRadius = type.range / 64 * 20; // Convert to screen coords
        ctx.arc(screen.x, screen.y - size/2, rangeRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw building icon/name in center
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type.icon, screen.x, screen.y - size/2);

    // Draw validity text
    if (!isValid) {
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('CANNOT BUILD HERE', screen.x, screen.y + 20);
    }
}

function drawTile(tx, ty) {
    const tile = game.map[ty]?.[tx];
    if (!tile) return;

    const fog = game.fogOfWar[ty]?.[tx] ?? 0;
    const screen = worldToScreen(tx, ty);

    // Tile colors
    const colors = {
        grass: '#3d5c3d',
        sand: '#a08050',
        rock: '#606060',
        water: '#304060',
        hill: '#5d7c4d'
    };

    let color = colors[tile.type] || colors.grass;

    // Height shading
    if (tile.height > 0) {
        color = shadeColor(color, 20);
    } else if (tile.height < 0) {
        color = shadeColor(color, -20);
    }

    // Draw isometric tile
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - TILE_HEIGHT / 2);
    ctx.lineTo(screen.x + TILE_WIDTH / 2, screen.y);
    ctx.lineTo(screen.x, screen.y + TILE_HEIGHT / 2);
    ctx.lineTo(screen.x - TILE_WIDTH / 2, screen.y);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Tile highlight (top edge)
    ctx.strokeStyle = shadeColor(color, 30);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - TILE_HEIGHT / 2);
    ctx.lineTo(screen.x + TILE_WIDTH / 2, screen.y);
    ctx.stroke();

    // Tile shadow (bottom edge)
    ctx.strokeStyle = shadeColor(color, -30);
    ctx.beginPath();
    ctx.moveTo(screen.x + TILE_WIDTH / 2, screen.y);
    ctx.lineTo(screen.x, screen.y + TILE_HEIGHT / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw oil deposit
    if (tile.oil && fog >= 1) {
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 2, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Fog of war overlay - terrain always visible
    if (fog === 0) {
        // Unseen areas: very dark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
    } else if (fog === 1) {
        // Seen but not visible: very subtle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fill();
    }
    // fog === 2: fully visible, no overlay
}

function drawBuilding(building) {
    // Try sprite-based rendering first, fall back to procedural if not available
    if (useSprites && assetLoader && drawBuildingSprite(building)) {
        // If under construction, draw progress bar on top
        if (building.isUnderConstruction) {
            const screen = worldToScreen(building.x, building.y);
            const progress = building.buildProgress / building.buildTime;
            ctx.fillStyle = '#333';
            ctx.fillRect(screen.x - 25, screen.y - 45, 50, 4);
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(screen.x - 25, screen.y - 45, 50 * progress, 4);
        }
        return;
    }

    const type = BUILDING_TYPES[building.type];
    const screen = worldToScreen(building.x, building.y);
    const player = game.players[building.playerId];

    // Check visibility
    const fog = game.fogOfWar[Math.floor(building.y)]?.[Math.floor(building.x)] ?? 0;
    if (fog < 2 && building.playerId !== 0) return; // Hide enemy buildings in fog

    // If under construction, reduce alpha
    const baseAlpha = building.isUnderConstruction ? 0.4 : 0.8;

    // Draw base structure
    ctx.fillStyle = player.color;
    ctx.globalAlpha = baseAlpha;
    ctx.fillRect(screen.x - 20, screen.y - 20, 40, 40);
    ctx.globalAlpha = 1;

    // Draw construction progress bar (if under construction)
    if (building.isUnderConstruction) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screen.x - 20, screen.y - 30, 40, 5);
        ctx.fillStyle = '#4488ff';
        const progress = building.buildProgress / building.buildTime;
        ctx.fillRect(screen.x - 20, screen.y - 30, 40 * progress, 5);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(screen.x - 20, screen.y - 30, 40, 5);
    }
    // Draw health bar
    else if (building.hp < type.hp) {
        ctx.fillStyle = '#f00';
        ctx.fillRect(screen.x - 20, screen.y - 30, 40 * (building.hp / type.hp), 5);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(screen.x - 20, screen.y - 30, 40, 5);
    }

    // Draw emoji/icon (simple colored box, no emoji needed)
    // Just draw the colored rectangle below

    const size = type.size * 20;

    // Building-specific designs
    if (building.type === 'hq') {
        // HQ: prominent command center
        ctx.fillStyle = shadeColor(player.color, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size - 5, size, size);

        // Main structure
        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 3, size - 4, size - 4);

        // Command antenna
        ctx.strokeStyle = shadeColor(player.color, -50);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x + 2, screen.y - size);
        ctx.lineTo(screen.x + 2, screen.y - size - 12);
        ctx.stroke();

        // Command light
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(screen.x + 2, screen.y - size - 12, 3, 0, Math.PI * 2);
        ctx.fill();

    } else if (building.type === 'turret') {
        // Turret: aggressive gun emplacement
        ctx.fillStyle = shadeColor(player.color, -40);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - size/2, size/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - size/2, size/2 - 3, 0, Math.PI * 2);
        ctx.fill();

        // Gun barrel
        ctx.strokeStyle = shadeColor(player.color, -60);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screen.x - 2, screen.y - size/2);
        ctx.lineTo(screen.x - size/2 - 2, screen.y - size/2 - 3);
        ctx.stroke();

    } else if (building.type === 'factory') {
        // Factory: industrial complex
        ctx.fillStyle = shadeColor(player.color, -35);
        ctx.fillRect(screen.x - size/2, screen.y - size, size, size);

        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 8, size - 4, size - 6);

        // Production lines
        ctx.strokeStyle = shadeColor(player.color, -50);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(screen.x - size/2 + 6, screen.y - size + 6 + i * 4);
            ctx.lineTo(screen.x + size/2 - 6, screen.y - size + 6 + i * 4);
            ctx.stroke();
        }

    } else if (building.type === 'barracks') {
        // Barracks: training facility
        ctx.fillStyle = shadeColor(player.color, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size + 3, size, size - 6);

        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size + 5, size - 4, size - 10);

        // Training yard lines
        ctx.strokeStyle = shadeColor(player.color, -50);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screen.x - size/4, screen.y - size/2 + 3);
        ctx.lineTo(screen.x - size/4, screen.y + size/2 - 3);
        ctx.stroke();

    } else if (building.type === 'derrick') {
        // Oil derrick: tall pump structure
        ctx.strokeStyle = shadeColor(player.color, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y - size);
        ctx.lineTo(screen.x - 4, screen.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y - size);
        ctx.lineTo(screen.x + 4, screen.y);
        ctx.stroke();

        // Pump head
        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - 6, screen.y - size + 4, 12, 8);

        // Oil base
        ctx.fillStyle = shadeColor(player.color, -30);
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

    } else {
        // PowerPlant and default: rectangular structure
        ctx.fillStyle = shadeColor(player.color, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size, size, size);

        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 8, size - 4, size - 6);

        // Details
        ctx.fillStyle = shadeColor(player.color, -50);
        ctx.fillRect(screen.x - size/2 + 5, screen.y - size + 3, size/3 - 7, 4);
        ctx.fillRect(screen.x + size/6, screen.y - size + 3, size/3 - 7, 4);
    }

    // Roof highlight (shared)
    ctx.fillStyle = shadeColor(player.color, 40);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(screen.x - size/2 + 3, screen.y - size - 7, size - 6, 3);
    ctx.globalAlpha = 1;

    // Health bar
    const hpPercent = building.hp / type.hp;
    ctx.fillStyle = '#333';
    ctx.fillRect(screen.x - 20, screen.y - size - 20, 40, 4);
    ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(screen.x - 20, screen.y - size - 20, 40 * hpPercent, 4);

    // Selection indicator
    if (game.selection.includes(building)) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(screen.x - size/2 - 3, screen.y - size - 13, size + 6, size + 16);
    }

    // Production progress
    if (building.productionQueue.length > 0) {
        const progress = building.produceProgress / building.produceTime;
        ctx.fillStyle = '#555';
        ctx.fillRect(screen.x - 15, screen.y + 5, 30, 3);
        ctx.fillStyle = '#0ff';
        ctx.fillRect(screen.x - 15, screen.y + 5, 30 * progress, 3);
    }
}

/**
 * Draw unit using sprite graphics if available, otherwise use procedural graphics
 */
function drawUnitSprite(unit) {
    const type = UNIT_TYPES[unit.type];
    const screen = worldToScreen(unit.x, unit.y);
    const sprite = assetLoader?.getAsset('units', unit.type);

    if (!sprite) {
        return false; // Fall back to procedural drawing
    }

    // Check visibility
    const fog = game.fogOfWar[Math.floor(unit.y)]?.[Math.floor(unit.x)] ?? 0;
    if (fog < 2 && unit.playerId !== 0) return true; // Hide enemy units in fog

    // Shadow with blur effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 8, type.size * 1.2, type.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw sprite at unit position, scaled appropriately
    const spriteWidth = sprite.width || 48;
    const spriteHeight = sprite.height || 48;
    const scale = (type.size * 2) / spriteWidth;

    ctx.save();
    ctx.globalAlpha = 0.9;

    // Rotate if needed
    if (unit.angle) {
        ctx.translate(screen.x, screen.y);
        ctx.rotate(unit.angle);
        ctx.drawImage(sprite, -spriteWidth * scale / 2, -spriteHeight * scale / 2, spriteWidth * scale, spriteHeight * scale);
        ctx.restore();
    } else {
        ctx.drawImage(sprite, screen.x - spriteWidth * scale / 2, screen.y - spriteHeight * scale / 2, spriteWidth * scale, spriteHeight * scale);
        ctx.restore();
    }

    // Health bar
    const hpPercent = unit.hp / type.hp;
    if (hpPercent < 1) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screen.x - 12, screen.y - type.size - 18, 24, 3);
        ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(screen.x - 12, screen.y - type.size - 18, 24 * hpPercent, 3);
    }

    // Selection indicator
    if (game.selection.includes(unit)) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, type.size + 8, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Harvester cargo indicator
    if (unit.type === 'harvester' && unit.cargo > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screen.x - 10, screen.y + 12, 20, 3);
        ctx.fillStyle = '#fa0';
        ctx.fillRect(screen.x - 10, screen.y + 12, 20 * (unit.cargo / type.capacity), 3);
    }

    return true;
}

/**
 * Draw building using sprite graphics if available, otherwise use procedural graphics
 */
function drawBuildingSprite(building) {
    const type = BUILDING_TYPES[building.type];
    const screen = worldToScreen(building.x, building.y);
    const sprite = assetLoader?.getAsset('buildings', building.type);

    if (!sprite) {
        return false; // Fall back to procedural drawing
    }

    // Check visibility
    const fog = game.fogOfWar[Math.floor(building.y)]?.[Math.floor(building.x)] ?? 0;
    if (fog < 2 && building.playerId !== 0) return true; // Hide enemy buildings in fog

    // Shadow with blur effect
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 12, type.size * 18, type.size * 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw sprite at building position
    const spriteWidth = sprite.width || 64;
    const spriteHeight = sprite.height || 64;
    const scale = (type.size * 25) / spriteWidth;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(sprite, screen.x - spriteWidth * scale / 2, screen.y - spriteHeight * scale / 2, spriteWidth * scale, spriteHeight * scale);
    ctx.restore();

    // Health bar
    const hpPercent = building.hp / type.hp;
    ctx.fillStyle = '#333';
    ctx.fillRect(screen.x - 20, screen.y - type.size * 20 - 20, 40, 4);
    ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
    ctx.fillRect(screen.x - 20, screen.y - type.size * 20 - 20, 40 * hpPercent, 4);

    // Selection indicator
    if (game.selection.includes(building)) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(screen.x - spriteWidth * scale / 2 - 3, screen.y - spriteHeight * scale / 2 - 3, spriteWidth * scale + 6, spriteHeight * scale + 6);
    }

    // Production progress
    if (building.producing) {
        const progress = building.produceProgress / building.produceTime;
        ctx.fillStyle = '#555';
        ctx.fillRect(screen.x - 15, screen.y + 8, 30, 3);
        ctx.fillStyle = '#0ff';
        ctx.fillRect(screen.x - 15, screen.y + 8, 30 * progress, 3);
    }

    return true;
}

function drawUnitGlow(unit) {
    const type = UNIT_TYPES[unit.type];
    const screen = worldToScreen(unit.x, unit.y);

    // Glow effect for selected units
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#00ff00';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, type.size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function drawUnit(unit) {
    // Try sprite-based rendering first, fall back to procedural if not available
    if (useSprites && assetLoader && drawUnitSprite(unit)) {
        return;
    }

    const type = UNIT_TYPES[unit.type];
    const screen = worldToScreen(unit.x, unit.y);
    const player = game.players[unit.playerId];

    // Check visibility
    const fog = game.fogOfWar[Math.floor(unit.y)]?.[Math.floor(unit.x)] ?? 0;
    if (fog < 2 && unit.playerId !== 0) return; // Hide enemy units in fog

    // Draw unit circle background
    ctx.fillStyle = player.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Draw health bar on top
    if (unit.hp < type.hp) {
        ctx.fillStyle = '#f00';
        ctx.fillRect(screen.x - 12, screen.y - 18, 24 * (unit.hp / type.hp), 3);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(screen.x - 12, screen.y - 18, 24, 3);
    }

    // Draw unit (colored circle, specific type drawn below)

    const angle = unit.angle || 0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Unit-specific rendering
    if (unit.type === 'tank') {
        // Tank: larger rect with turret
        ctx.fillStyle = player.color;
        ctx.fillRect(screen.x - type.size * 0.7, screen.y - type.size * 0.5, type.size * 1.4, type.size);

        // Turret
        ctx.fillStyle = shadeColor(player.color, -20);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - type.size / 2, type.size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Turret barrel
        ctx.strokeStyle = shadeColor(player.color, -40);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y - type.size / 2);
        ctx.lineTo(
            screen.x + cosA * type.size * 1.3,
            screen.y - type.size / 2 + sinA * type.size * 1.3
        );
        ctx.stroke();
    } else if (unit.type === 'harvester') {
        // Harvester: rounded shape
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y - type.size / 2, type.size * 0.9, type.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Storage capacity indicator
        ctx.fillStyle = shadeColor(player.color, -30);
        ctx.fillRect(screen.x - type.size * 0.7, screen.y + 2, type.size * 1.4, 3);
    } else if (unit.type === 'artillery') {
        // Artillery: smaller base, long barrel
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - type.size / 2, type.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Long barrel
        ctx.strokeStyle = shadeColor(player.color, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y - type.size / 2);
        ctx.lineTo(
            screen.x + cosA * type.size * 1.6,
            screen.y - type.size / 2 + sinA * type.size * 1.6
        );
        ctx.stroke();
    } else if (unit.type === 'scout') {
        // Scout: small and fast-looking
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - type.size / 2, type.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Speed lines
        ctx.strokeStyle = shadeColor(player.color, 30);
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(screen.x + cosA * type.size * 0.7, screen.y - type.size / 2 + sinA * type.size * 0.7 + i * 2);
            ctx.lineTo(screen.x - cosA * type.size * 1.2, screen.y + sinA * type.size * 1.2 + i * 2);
            ctx.stroke();
        }
    } else if (unit.type === 'rocket') {
        // Rocket: pointed triangle shape
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.moveTo(screen.x + cosA * type.size, screen.y - type.size / 2 + sinA * type.size);
        ctx.lineTo(screen.x - cosA * type.size * 0.7 + sinA * type.size * 0.6, screen.y + sinA * type.size * 0.7 + cosA * type.size * 0.6);
        ctx.lineTo(screen.x - cosA * type.size * 0.7 - sinA * type.size * 0.6, screen.y + sinA * type.size * 0.7 - cosA * type.size * 0.6);
        ctx.closePath();
        ctx.fill();
    } else {
        // Infantry: default circle design
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - type.size / 2, type.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Highlight for depth
    ctx.fillStyle = shadeColor(player.color, 40);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(screen.x - 2, screen.y - type.size / 2 - 2, type.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Health bar
    const hpPercent = unit.hp / type.hp;
    if (hpPercent < 1) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screen.x - 12, screen.y - type.size - 10, 24, 3);
        ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(screen.x - 12, screen.y - type.size - 10, 24 * hpPercent, 3);
    }

    // Selection indicator
    if (game.selection.includes(unit)) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - type.size / 2, type.size + 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Harvester cargo indicator
    if (unit.type === 'harvester' && unit.cargo > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(screen.x - 10, screen.y + 8, 20, 3);
        ctx.fillStyle = '#fa0';
        ctx.fillRect(screen.x - 10, screen.y + 8, 20 * (unit.cargo / type.capacity), 3);
    }
}

function drawProjectile(proj) {
    const screen = worldToScreen(proj.x, proj.y);

    // Trail
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(screen.x - proj.vx * 3, screen.y - proj.vy * 3);
    ctx.stroke();

    // Projectile
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawParticle(particle) {
    const screen = worldToScreen(particle.x, particle.y);
    ctx.globalAlpha = Math.max(0, particle.life) * 0.8;
    ctx.fillStyle = particle.color;

    // Particle glow for explosion effects
    if (particle.type === 'explosion') {
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.arc(screen.x, screen.y - particle.z, particle.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

function renderMinimap() {
    minimapCtx.fillStyle = '#111';
    minimapCtx.fillRect(0, 0, 180, 180);

    const scale = 180 / MAP_SIZE;

    // Draw terrain
    for (let y = 0; y < MAP_SIZE; y++) {
        if (!game.map[y]) continue;
        for (let x = 0; x < MAP_SIZE; x++) {
            const tile = game.map[y][x];
            if (!tile) continue;
            const fog = game.fogOfWar[y]?.[x] ?? 0;

            let color = '#3d5c3d';
            if (tile.type === 'water') color = '#304060';
            else if (tile.type === 'rock') color = '#606060';
            else if (tile.type === 'sand') color = '#a08050';
            else if (tile.type === 'hill') color = '#5d7c4d';

            // Apply fog darkness based on visibility level
            if (fog === 0) color = shadeColor(color, -60); // Unexplored: very dark
            else if (fog === 1) color = shadeColor(color, -30); // Explored but not visible

            minimapCtx.fillStyle = color;
            minimapCtx.fillRect(x * scale, y * scale, scale + 1, scale + 1);

            if (tile.oil && fog >= 1) {
                minimapCtx.fillStyle = '#000';
                minimapCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }

    // Draw buildings
    for (const b of game.buildings) {
        minimapCtx.fillStyle = game.players[b.playerId].color;
        minimapCtx.fillRect(b.x * scale - 2, b.y * scale - 2, 4, 4);
    }

    // Draw units
    for (const u of game.units) {
        minimapCtx.fillStyle = game.players[u.playerId].color;
        minimapCtx.fillRect(u.x * scale - 1, u.y * scale - 1, 2, 2);
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
    updateFogOfWar();
    updateAI();
    updateResources();
    updateUI();
}

function updateUnits(dt) {
    for (let i = game.units.length - 1; i >= 0; i--) {
        const unit = game.units[i];
        const type = UNIT_TYPES[unit.type];

        // Death check
        if (unit.hp <= 0) {
            createExplosion(unit.x, unit.y);
            game.units.splice(i, 1);
            game.selection = game.selection.filter(s => s !== unit);
            continue;
        }

        // Harvester logic
        if (unit.type === 'harvester') {
            updateHarvester(unit, type);
            continue;
        }

        // Attack logic
        if (unit.attackTarget) {
            const target = unit.attackTarget;
            if (target.hp <= 0) {
                unit.attackTarget = null;
            } else {
                const dx = target.x - unit.x;
                const dy = target.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                unit.angle = Math.atan2(dy, dx);

                if (dist > type.range) {
                    // Move towards target
                    unit.x += (dx / dist) * type.speed * dt * 60;
                    unit.y += (dy / dist) * type.speed * dt * 60;
                } else {
                    // Attack
                    if (game.tick - unit.lastAttack > type.attackSpeed / 16) {
                        fireProjectile(unit, target);
                        unit.lastAttack = game.tick;
                    }
                }
            }
        }
        // Movement
        else if (unit.targetX !== undefined) {
            const dx = unit.targetX - unit.x;
            const dy = unit.targetY - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0.5) {
                unit.angle = Math.atan2(dy, dx);
                const speed = type.speed * dt * 60;

                // Better pathfinding: try to move while avoiding collisions
                let moveX = (dx / dist) * speed;
                let moveY = (dy / dist) * speed;

                // Check for collisions and adjust path
                let avoidanceForce = { x: 0, y: 0 };
                for (const other of game.units) {
                    if (other === unit || other.playerId !== unit.playerId) continue; // Avoid friendly units only
                    const odx = unit.x - other.x;
                    const ody = unit.y - other.y;
                    const odist = Math.sqrt(odx * odx + ody * ody);

                    // Stronger avoidance if very close
                    if (odist < 1.5 && odist > 0.1) {
                        const force = 1 - (odist / 1.5);
                        avoidanceForce.x += (odx / odist) * force * 0.5;
                        avoidanceForce.y += (ody / odist) * force * 0.5;
                    }
                }

                // Apply movement + avoidance
                unit.x += moveX + avoidanceForce.x;
                unit.y += moveY + avoidanceForce.y;

                // Create dust trail effect
                if (Math.random() < 0.3) { // 30% chance each frame
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

            } else {
                unit.targetX = undefined;
                unit.targetY = undefined;
            }
        }

        // Auto-attack nearby enemies
        if (!unit.attackTarget && type.damage > 0) {
            for (const other of game.units) {
                if (other.playerId === unit.playerId) continue;
                const dx = other.x - unit.x;
                const dy = other.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < type.sight) {
                    unit.attackTarget = other;
                    break;
                }
            }
        }

        // Keep in bounds and avoid hills/water/rocks
        unit.x = Math.max(0, Math.min(MAP_SIZE - 1, unit.x));
        unit.y = Math.max(0, Math.min(MAP_SIZE - 1, unit.y));

        const tileType = game.map[Math.floor(unit.y)]?.[Math.floor(unit.x)]?.type;
        if (tileType === 'water' || tileType === 'rock' || tileType === 'hill') {
            // Push unit back slightly if stuck on impassable terrain
            const backDist = Math.sqrt((unit.x) ** 2 + (unit.y) ** 2) || 1;
            unit.x = Math.max(0, Math.min(MAP_SIZE - 1, unit.x - 0.5 * (unit.x / backDist)));
            unit.y = Math.max(0, Math.min(MAP_SIZE - 1, unit.y - 0.5 * (unit.y / backDist)));
        }
    }
}

function updateHarvester(unit, type) {
    const player = game.players[unit.playerId];

    // Find nearest HQ for dropoff
    const hq = game.buildings.find(b => b.playerId === unit.playerId && b.type === 'hq');

    if (unit.cargo >= type.capacity || (unit.returning && unit.cargo > 0)) {
        // Return to HQ
        unit.returning = true;
        if (hq) {
            const dx = hq.x - unit.x;
            const dy = hq.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 2) {
                unit.x += (dx / dist) * type.speed * 0.016 * 60;
                unit.y += (dy / dist) * type.speed * 0.016 * 60;
                unit.angle = Math.atan2(dy, dx);

                // Create dust trail effect
                if (Math.random() < 0.2) {
                    game.particles.push({
                        x: unit.x + (Math.random() - 0.5) * type.size,
                        y: unit.y + (Math.random() - 0.5) * type.size,
                        z: 0,
                        vx: (Math.random() - 0.5) * 0.1,
                        vy: (Math.random() - 0.5) * 0.1,
                        vz: Math.random() * 0.08,
                        color: '#777777',
                        size: Math.random() * 2 + 1.5,
                        life: 0.4
                    });
                }
            } else {
                // Deposit cargo
                player.oil += unit.cargo;
                unit.cargo = 0;
                unit.returning = false;
            }
        }
    } else {
        // Find oil
        let nearestOil = null;
        let nearestDist = Infinity;

        for (let y = 0; y < MAP_SIZE; y++) {
            for (let x = 0; x < MAP_SIZE; x++) {
                if (game.map[y][x].oil) {
                    // Check if not already occupied by derrick
                    const hasDerrick = game.buildings.some(b =>
                        b.type === 'derrick' && Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1
                    );
                    if (hasDerrick) continue;

                    const dx = x - unit.x;
                    const dy = y - unit.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestOil = { x, y };
                    }
                }
            }
        }

        if (nearestOil) {
            if (nearestDist > 1) {
                const dx = nearestOil.x - unit.x;
                const dy = nearestOil.y - unit.y;
                unit.x += (dx / nearestDist) * type.speed * 0.016 * 60;
                unit.y += (dy / nearestDist) * type.speed * 0.016 * 60;
                unit.angle = Math.atan2(dy, dx);

                // Create dust trail effect
                if (Math.random() < 0.2) {
                    game.particles.push({
                        x: unit.x + (Math.random() - 0.5) * type.size,
                        y: unit.y + (Math.random() - 0.5) * type.size,
                        z: 0,
                        vx: (Math.random() - 0.5) * 0.1,
                        vy: (Math.random() - 0.5) * 0.1,
                        vz: Math.random() * 0.08,
                        color: '#777777',
                        size: Math.random() * 2 + 1.5,
                        life: 0.4
                    });
                }
            } else {
                // Harvest
                unit.cargo = Math.min(type.capacity, unit.cargo + 2);
            }
        } else if (unit.cargo > 0) {
            unit.returning = true;
        }
    }
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
                // Now unlock tech when construction is complete
                unlockTech(building.type, building.playerId);
            } else {
                // Construction in progress - keep hp at 1
                building.hp = 1;
            }
        }

        // Death check
        if (building.hp <= 0 && !building.isUnderConstruction) {
            createExplosion(building.x, building.y, true);
            game.buildings.splice(i, 1);
            game.selection = game.selection.filter(s => s !== building);
            continue;
        }

        // Turret attack (only if visible to the building's owner)
        if (type.damage && !building.isUnderConstruction) {
            let nearestEnemy = null;
            let nearestDist = Infinity;

            for (const unit of game.units) {
                if (unit.playerId === building.playerId) continue;

                // Check if enemy is in sight range
                const dx = unit.x - building.x;
                const dy = unit.y - building.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < type.range && dist < nearestDist && dist < (type.sight || 250)) {
                    nearestDist = dist;
                    nearestEnemy = unit;
                }
            }

            if (nearestEnemy && game.tick - (building.lastAttack || 0) > type.attackSpeed / 16) {
                fireProjectile(building, nearestEnemy, type.damage);
                building.lastAttack = game.tick;
            }
        }

        // Production queue
        if (building.productionQueue.length > 0 && !building.isUnderConstruction) {
            const current = building.productionQueue[0];
            building.produceProgress++;
            building.produceTime = current.time;

            if (building.produceProgress >= building.produceTime) {
                // Spawn unit
                spawnUnit(current.type, building.playerId, building.x + 2, building.y + 2);
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

        // Check hit
        const dx = proj.targetX - proj.x;
        const dy = proj.targetY - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1 || proj.life <= 0) {
            // Deal damage
            if (proj.target && proj.target.hp > 0) {
                proj.target.hp -= proj.damage;
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
    // Reset explored areas to "seen but not visible"
    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (game.fogOfWar[y][x] === 2) {
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
                    if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
                        game.fogOfWar[ty][tx] = 2;
                    }
                }
            }
        }
    }
}

function updateAI() {
    if (game.tick % 120 !== 0) return; // Run every 2 seconds

    const ai = game.players[1];
    const aiUnits = game.units.filter(u => u.playerId === 1);
    const aiBuildings = game.buildings.filter(b => b.playerId === 1);
    const playerUnits = game.units.filter(u => u.playerId === 0);
    const playerBuildings = game.buildings.filter(b => b.playerId === 0);

    // Determine AI strategy based on game state
    const gameTime = game.tick / 60; // seconds
    let aiMode = 'balanced';

    if (gameTime < 60) {
        // Early game: be aggressive
        aiMode = aiUnits.length > playerUnits.length ? 'rusher' : 'balanced';
    } else if (gameTime < 180) {
        // Mid game: mixed strategy
        aiMode = ai.oil > 2000 ? 'tech' : (playerUnits.length > aiUnits.length * 1.5 ? 'defender' : 'balanced');
    } else {
        // Late game: have all strategies
        aiMode = ai.oil > 3000 ? 'tech' : (playerBuildings.length > 4 ? 'aggressive' : 'balanced');
    }

    executeAIStrategy(ai, aiMode, aiUnits, aiBuildings, playerUnits, playerBuildings);

    // Give AI some oil (reduced from 20 to 10 for fair play)
    ai.oil += 10;
}

function executeAIStrategy(ai, mode, aiUnits, aiBuildings, playerUnits, playerBuildings) {
    const aiHQ = aiBuildings.find(b => b.type === 'hq');
    const aiBarracks = aiBuildings.filter(b => b.type === 'barracks');
    const aiFactory = aiBuildings.filter(b => b.type === 'factory');
    const aiDerricks = aiBuildings.filter(b => b.type === 'derrick');

    if (!aiHQ) return;

    // Universal: Build more derricks for economy
    if (ai.oil >= 200 && aiDerricks.length < 5) {
        const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
        if (pos) {
            createBuilding('derrick', 1, pos.x, pos.y, true);
            ai.oil -= 200;
        }
    }

    // Universal: Build research lab for tower tech
    const aiResearchLabs = aiBuildings.filter(b => b.type === 'researchLab');
    if (ai.oil >= 500 && aiResearchLabs.length < 1) {
        const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
        if (pos) {
            createBuilding('researchLab', 1, pos.x, pos.y, true);
            ai.oil -= 500;
        }
    }

    // Universal: Research tower tech
    if (aiResearchLabs.length > 0) {
        if (ai.oil >= 300 && !ai.tech.rifleTurret) {
            researchTechnology('rifleTurret', 1);
            ai.oil -= 300;
        } else if (ai.oil >= 450 && !ai.tech.missileTurret) {
            researchTechnology('missileTurret', 1);
            ai.oil -= 450;
        }
    }

    // Universal: Build defensive towers
    const aiTurrets = aiBuildings.filter(b => b.type === 'turret' || b.type === 'rifleTurret' || b.type === 'missileTurret');
    const buildDefense = () => {
        if (ai.oil >= 300 && ai.tech.rifleTurret && Math.random() > 0.5) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('rifleTurret', 1, pos.x, pos.y, true);
                ai.oil -= 300;
            }
        } else if (ai.oil >= 450 && ai.tech.missileTurret) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('missileTurret', 1, pos.x, pos.y, true);
                ai.oil -= 450;
            }
        }
    };

    if (mode === 'rusher') {
        // Build barracks quickly, mass produce infantry + rockets
        if (ai.oil >= 400 && aiBarracks.length < 3) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('barracks', 1, pos.x, pos.y, true);
                ai.oil -= 400;
            }
        }

        // Build factory for light tanks
        if (ai.oil >= 600 && aiFactory.length < 1) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('factory', 1, pos.x, pos.y, true);
                ai.oil -= 600;
            }
        }

        // Produce infantry and rockets constantly
        for (const barracks of aiBarracks) {
            if (barracks.productionQueue.length < 10) {
                if (ai.oil >= 80 && Math.random() > 0.3) {
                    addToProductionQueue(barracks, 'infantry');
                    ai.oil -= 80;
                } else if (ai.oil >= 200) {
                    addToProductionQueue(barracks, 'rocket');
                    ai.oil -= 200;
                }
            }
        }

        // Produce light tanks for fast raids
        for (const factory of aiFactory) {
            if (factory.productionQueue.length < 10 && ai.oil >= 250) {
                addToProductionQueue(factory, 'lightTank');
                ai.oil -= 250;
            }
        }

        // Attack early and often
        if (aiUnits.length >= 3) {
            attackPlayerBase(playerBuildings, playerUnits, aiUnits);
        }

    } else if (mode === 'defender') {
        // Build defensive turrets - prefer specialized ones
        if (aiTurrets.length < 6) {
            buildDefense();
        } else if (ai.oil >= 350 && aiTurrets.length < 8) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('turret', 1, pos.x, pos.y, true);
                ai.oil -= 350;
            }
        }

        // Build factory for heavy units
        if (ai.oil >= 600 && aiFactory.length < 1) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('factory', 1, pos.x, pos.y, true);
                ai.oil -= 600;
            }
        }

        // Produce medium and heavy tanks for defense
        for (const factory of aiFactory) {
            if (factory.productionQueue.length < 10) {
                if (ai.oil >= 500 && Math.random() > 0.6) {
                    addToProductionQueue(factory, 'heavyTank');
                    ai.oil -= 500;
                } else if (ai.oil >= 350) {
                    addToProductionQueue(factory, 'mediumTank');
                    ai.oil -= 350;
                }
            }
        }

        // Produce scout for intel
        for (const barracks of aiBarracks) {
            if (barracks.productionQueue.length < 10 && ai.oil >= 120 && aiUnits.filter(u => u.type === 'scout').length < 2) {
                addToProductionQueue(barracks, 'scout');
                ai.oil -= 120;
            }
        }

        // Counter-attack if attacked
        if (playerUnits.length > 2) {
            attackPlayerBase(playerBuildings, playerUnits, aiUnits);
        }

    } else if (mode === 'tech') {
        // Focus on late-game units
        if (ai.oil >= 600 && aiFactory.length < 2) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('factory', 1, pos.x, pos.y, true);
                ai.oil -= 600;
            }
        }

        if (ai.oil >= 400 && aiBarracks.length < 1) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('barracks', 1, pos.x, pos.y, true);
                ai.oil -= 400;
            }
        }

        // Produce heavy tanks, artillery and flak for late-game power
        for (const factory of aiFactory) {
            if (factory.productionQueue.length < 10) {
                const rand = Math.random();
                if (ai.oil >= 500 && rand > 0.4) {
                    addToProductionQueue(factory, 'heavyTank');
                    ai.oil -= 500;
                } else if (ai.oil >= 500 && rand > 0.2) {
                    addToProductionQueue(factory, 'artillery');
                    ai.oil -= 500;
                } else if (ai.oil >= 300) {
                    addToProductionQueue(factory, 'flak');
                    ai.oil -= 300;
                }
            }
        }

        // Build some harvesters
        if (ai.oil >= 450 && aiUnits.filter(u => u.type === 'harvester').length < 2) {
            const factory = aiFactory[0];
            if (factory && factory.productionQueue.length < 10) {
                addToProductionQueue(factory, 'harvester');
                ai.oil -= 450;
            }
        }

        // Build missile turrets for late-game defense
        if (aiTurrets.length < 3) {
            buildDefense();
        }

        // Powerful late-game attack
        if (aiUnits.length >= 8) {
            attackPlayerBase(playerBuildings, playerUnits, aiUnits);
        }

    } else {
        // Balanced mode
        if (ai.oil >= 400 && aiBarracks.length < 2) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('barracks', 1, pos.x, pos.y, true);
                ai.oil -= 400;
            }
        }

        if (ai.oil >= 600 && aiFactory.length < 1 && aiBarracks.length > 0) {
            const pos = findBuildPosition(aiHQ.x, aiHQ.y, 1);
            if (pos) {
                createBuilding('factory', 1, pos.x, pos.y, true);
                ai.oil -= 600;
            }
        }

        // Mix of unit types
        for (const barracks of aiBarracks) {
            if (barracks.productionQueue.length < 10) {
                const rand = Math.random();
                if (ai.oil >= 80 && rand > 0.5) {
                    addToProductionQueue(barracks, 'infantry');
                    ai.oil -= 80;
                } else if (ai.oil >= 120 && rand > 0.7) {
                    addToProductionQueue(barracks, 'scout');
                    ai.oil -= 120;
                } else if (ai.oil >= 200) {
                    addToProductionQueue(barracks, 'rocket');
                    ai.oil -= 200;
                }
            }
        }

        // Balanced mix of light and medium tanks
        for (const factory of aiFactory) {
            if (factory.productionQueue.length < 10) {
                if (ai.oil >= 350 && Math.random() > 0.5) {
                    addToProductionQueue(factory, 'mediumTank');
                    ai.oil -= 350;
                } else if (ai.oil >= 250) {
                    addToProductionQueue(factory, 'lightTank');
                    ai.oil -= 250;
                } else if (ai.oil >= 240) {
                    addToProductionQueue(factory, 'harvester');
                    ai.oil -= 240;
                }
            }
        }

        // Build some defensive towers for balance
        if (aiTurrets.length < 2) {
            buildDefense();
        }

        // Attack when ready
        if (aiUnits.length >= 5) {
            attackPlayerBase(playerBuildings, playerUnits, aiUnits);
        }
    }
}

function attackPlayerBase(playerBuildings, playerUnits, aiUnits) {
    // Find primary target (HQ > other buildings > units)
    let target = playerBuildings.find(b => b.type === 'hq');
    if (!target) target = playerBuildings[0];
    if (!target) target = playerUnits[0];

    if (target) {
        for (const unit of aiUnits) {
            if (!unit.attackTarget) {
                unit.attackTarget = target;
            }
        }
    }
}

function updateResources() {
    // Derricks generate oil
    for (const building of game.buildings) {
        if (building.type === 'derrick' && !building.isUnderConstruction) {
            const type = BUILDING_TYPES.derrick;
            game.players[building.playerId].oil += type.generates / 60;
        }
        if (building.type === 'powerplant') {
            const type = BUILDING_TYPES.powerplant;
            // Power is just tracked, not consumed for now
        }
    }

    // Cap oil at 10,000
    for (const player of game.players) {
        player.oil = Math.min(10000, player.oil);
    }
}

function updateUI() {
    const oilEl = document.getElementById('oil');
    const powerEl = document.getElementById('power');
    const playerUnitsEl = document.getElementById('playerUnits');
    const enemyUnitsEl = document.getElementById('enemyUnits');
    const infoEl = document.getElementById('selectionInfo');

    if (!oilEl || !powerEl || !playerUnitsEl || !enemyUnitsEl || !infoEl) {
        console.warn('UI elements not found - skipping UI update');
        return;
    }

    oilEl.textContent = Math.floor(game.players[0].oil);
    powerEl.textContent = Math.floor(game.players[0].power);

    // Unit counts
    const playerUnits = game.units.filter(u => u.playerId === 0).length;
    const enemyUnits = game.units.filter(u => u.playerId === 1).length;
    playerUnitsEl.textContent = `${playerUnits} units`;
    enemyUnitsEl.textContent = `${enemyUnits} units`;

    // Color code: green if ahead, red if behind, yellow if equal
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
        infoEl.innerHTML = 'No selection';
    } else if (game.selection.length === 1) {
        const sel = game.selection[0];
        const type = UNIT_TYPES[sel.type] || BUILDING_TYPES[sel.type];
        let infoText = `<strong>${type.name}</strong><br>HP: ${Math.floor(sel.hp)}/${type.hp}`;
        if (sel.cargo !== undefined) {
            infoText += `<br>Cargo: ${sel.cargo}/${type.capacity}`;
        }
        if (sel.productionQueue && sel.productionQueue.length > 0) {
            const progress = Math.round((sel.produceProgress / sel.produceTime) * 100);
            const current = sel.productionQueue[0];
            infoText += `<br>Building: ${UNIT_TYPES[current.type].name} (${progress}%)`;
            if (sel.productionQueue.length > 1) {
                infoText += ` [Queue: ${sel.productionQueue.length}]`;
            }
        }
        infoEl.innerHTML = infoText;
    } else {
        infoEl.innerHTML = `${game.selection.length} units selected`;
    }

    // Build menu
    updateBuildMenu();
}

function updateBuildMenu() {
    const menu = document.getElementById('buildMenu');
    const player = game.players[0];

    // Check what's selected
    const selectedBuilding = game.selection.find(s => BUILDING_TYPES[s.type]);

    if (selectedBuilding && selectedBuilding.playerId === 0) {
        const type = BUILDING_TYPES[selectedBuilding.type];
        menu.innerHTML = '';

        // Show research options for Research Lab
        if (selectedBuilding.type === 'researchLab' && type.researches) {
            const researchInfo = document.createElement('div');
            researchInfo.style.cssText = 'padding: 8px; font-size: 12px; color: #aaa; border-bottom: 1px solid #444;';
            researchInfo.innerHTML = `<strong>Research Technologies</strong>`;
            menu.appendChild(researchInfo);

            // Research buttons
            for (const techType of type.researches) {
                const techDef = BUILDING_TYPES[techType];
                if (!techDef) continue;

                const btn = document.createElement('button');
                btn.className = 'build-btn';

                // Check if already researched
                const isResearched = player.tech[techType];
                if (isResearched) {
                    btn.innerHTML = `${techDef.icon} <span>✓</span>`;
                    btn.title = `${techDef.name} - Already researched`;
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                } else {
                    btn.innerHTML = `${techDef.icon}<span>${techDef.cost}</span>`;
                    btn.title = `${techDef.name} - ${techDef.cost} oil to research`;
                    btn.disabled = player.oil < techDef.cost;
                    btn.onclick = () => {
                        if (player.oil >= techDef.cost && !player.tech[techType]) {
                            player.oil -= techDef.cost;
                            researchTechnology(techType, 0);
                            updateBuildMenu();
                        }
                    };
                }
                menu.appendChild(btn);
            }
        }
        // Show production queue if building can produce
        else if (type.produces.length > 0) {
            // Queue info
            const queueInfo = document.createElement('div');
            queueInfo.style.cssText = 'padding: 8px; font-size: 12px; color: #aaa; border-bottom: 1px solid #444;';
            queueInfo.innerHTML = `Queue: <strong>${selectedBuilding.productionQueue.length}/10</strong>`;
            menu.appendChild(queueInfo);

            // Production progress bar
            if (selectedBuilding.productionQueue.length > 0) {
                const current = selectedBuilding.productionQueue[0];
                const progress = Math.round((selectedBuilding.produceProgress / selectedBuilding.produceTime) * 100);
                const progressBar = document.createElement('div');
                progressBar.style.cssText = `height: 4px; background: #333; margin: 8px; border-radius: 2px; overflow: hidden;`;
                progressBar.innerHTML = `<div style="height: 100%; background: #4488ff; width: ${progress}%; transition: width 0.1s;"></div>`;
                menu.appendChild(progressBar);
            }

            // Unit production buttons
            for (const unitType of type.produces) {
                const uType = UNIT_TYPES[unitType];
                const btn = document.createElement('button');
                btn.className = 'build-btn';
                btn.innerHTML = `${uType.icon}<span>${uType.cost}</span>`;
                btn.title = `${uType.name} - ${uType.cost} oil`;
                btn.disabled = player.oil < uType.cost || selectedBuilding.productionQueue.length >= 10;
                btn.onclick = () => {
                    if (player.oil >= uType.cost && selectedBuilding.productionQueue.length < 10) {
                        player.oil -= uType.cost;
                        addToProductionQueue(selectedBuilding, unitType);
                        updateBuildMenu();
                    }
                };
                menu.appendChild(btn);
            }
        }
    } else {
        // Show building options (only available techs)
        menu.innerHTML = '';
        const buildable = ['barracks', 'factory', 'derrick', 'turret', 'researchLab', 'powerplant', 'academy', 'techLab'];

        for (const bType of buildable) {
            const type = BUILDING_TYPES[bType];
            if (!type) continue;

            // Check if tech is available
            const isTechAvailable = game.players[0].tech[bType] !== false;

            const btn = document.createElement('button');
            btn.className = 'build-btn';
            btn.innerHTML = `${type.icon}<span>${type.cost}</span>`;
            btn.title = isTechAvailable ? `${type.name} - ${type.cost} oil` : `${type.name} - Requires tech`;
            btn.disabled = player.oil < type.cost || !isTechAvailable;
            btn.onclick = () => {
                if (player.oil >= type.cost && isTechAvailable) {
                    game.placingBuilding = bType;
                    // If a building is selected, set it as source
                    const selectedBuilding = game.selection.find(s => BUILDING_TYPES[s.type]);
                    if (selectedBuilding && selectedBuilding.playerId === 0) {
                        game.placingBuildingFrom = selectedBuilding;
                    }
                }
            };
            menu.appendChild(btn);
        }
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function spawnUnit(type, playerId, x, y) {
    const unitType = UNIT_TYPES[type];
    game.units.push({
        type,
        playerId,
        x, y,
        hp: unitType.hp,
        angle: 0,
        lastAttack: 0,
        cargo: 0
    });
}

function createBuilding(type, playerId, x, y, isUnderConstruction = false) {
    const bType = BUILDING_TYPES[type];
    const buildTimes = {
        // Small buildings: 20 seconds = 1200 ticks (60 ticks/sec)
        derrick: 1200,
        turret: 1200,
        rifleTurret: 1200,
        missileTurret: 1200,
        // Medium buildings: 35 seconds
        barracks: 2100,
        researchLab: 2100,
        powerplant: 2100,
        factory: 2100,
        // Large buildings: 35 seconds
        academy: 2100,
        techLab: 2100,
        hq: 2100
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
        buildTime: buildTimes[type] || 1500,
        isUnderConstruction: isUnderConstruction
    };

    game.buildings.push(building);

    // Only unlock tech when building is COMPLETE
    if (!isUnderConstruction) {
        unlockTech(type, playerId);
    }

    return building;
}

function canBuildAt(buildingType, x, y) {
    const type = BUILDING_TYPES[buildingType];
    if (!type) return false;

    // Determine max distance based on source
    let maxDist = 6;
    let sourceBuilding = null;

    if (game.placingBuildingFrom) {
        sourceBuilding = game.placingBuildingFrom;
        maxDist = 3;
    } else {
        sourceBuilding = game.buildings.find(b => b.type === 'hq' && b.playerId === 0);
        maxDist = 6;
    }

    // Check distance from source building
    if (sourceBuilding) {
        const dx = x - sourceBuilding.x;
        const dy = y - sourceBuilding.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) return false;
    }

    // Check terrain
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return false;
    const tileType = game.map[Math.floor(y)]?.[Math.floor(x)]?.type;
    if (tileType === 'water' || tileType === 'rock' || tileType === 'hill') return false;

    // Check if on oil for derrick
    if (buildingType === 'derrick') {
        if (!game.map[Math.floor(y)]?.[Math.floor(x)]?.oil) return false;
    }

    // Check for building collision
    const bSize = type.size;
    for (const building of game.buildings) {
        const bType = BUILDING_TYPES[building.type];
        const bdx = x - building.x;
        const bdy = y - building.y;
        if (Math.abs(bdx) < bSize + bType.size && Math.abs(bdy) < bSize + bType.size) {
            return false;
        }
    }

    return true;
}

function unlockTech(buildingType, playerId) {
    const player = game.players[playerId];
    if (!player || !player.tech) return;

    // Mark building type as researched
    player.tech[buildingType] = true;

    // Unlock dependent techs
    for (const [tech, deps] of Object.entries(TECH_TREE)) {
        if (deps.requires.includes(buildingType)) {
            player.tech[tech] = true;
        }
    }
}

function researchTechnology(techType, playerId) {
    const player = game.players[playerId];
    if (!player || !player.tech) return;

    // Mark technology as researched
    player.tech[techType] = true;

    // Unlock dependent techs
    for (const [tech, deps] of Object.entries(TECH_TREE)) {
        if (deps.requires.includes(techType)) {
            player.tech[tech] = true;
        }
    }
}

function addToProductionQueue(building, unitType) {
    // Max 10 units in queue
    if (building.productionQueue.length >= 10) {
        return false;
    }

    const times = {
        infantry: 90,
        scout: 60,
        rocket: 90,
        lightTank: 120,
        mediumTank: 180,
        heavyTank: 240,
        harvester: 240,
        artillery: 200,
        flak: 140
    };
    building.productionQueue.push({
        type: unitType,
        time: times[unitType] || 120
    });

    return true;
}

function fireProjectile(source, target, customDamage) {
    const type = UNIT_TYPES[source.type] || BUILDING_TYPES[source.type];
    const damage = customDamage || type.damage;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 0.3;

    // Check if path is blocked by hills
    const blockadeIndex = checkLineOfSight(source.x, source.y, target.x, target.y);

    game.projectiles.push({
        x: source.x,
        y: source.y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        targetX: target.x,
        targetY: target.y,
        target,
        damage,
        life: 100,
        blockadeIndex: blockadeIndex
    });
}

function checkLineOfSight(x1, y1, x2, y2) {
    // Check if path is blocked by hills - return distance to blockade or -1 if clear
    const steps = Math.ceil(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 2);
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = Math.round(x1 + (x2 - x1) * t);
        const y = Math.round(y1 + (y2 - y1) * t);
        if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;

        const tile = game.map[y]?.[x];
        if (tile && tile.type === 'hill') {
            return i / steps; // Return how far along the path blockade is
        }
    }
    return -1; // No blockade
}

function createExplosion(x, y, big = false) {
    // Create multiple rings of particles for impressive effect
    const count = big ? 35 : 20;
    const colors = ['#ff4400', '#ff6600', '#ffaa00', '#ffdd00', '#ff2200', '#fff000'];

    // Main explosion particles
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 0.5 + 0.3;

        game.particles.push({
            x, y, z: 0,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            vz: Math.random() * 0.7 + 0.3,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 6 + 3,
            life: 1,
            type: 'explosion'
        });
    }

    // Secondary smoke particles (slower, larger)
    if (big) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.2 + 0.1;
            game.particles.push({
                x, y, z: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: Math.random() * 0.3 + 0.15,
                color: '#999999',
                size: Math.random() * 8 + 4,
                life: 0.6
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

function findBuildPosition(nearX, nearY, playerId) {
    // Search up to 6 tiles away from the base
    for (let r = 1; r <= 6; r++) {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
            const x = Math.floor(nearX + Math.cos(angle) * r);
            const y = Math.floor(nearY + Math.sin(angle) * r);

            if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) continue;
            if (game.map[y][x].type === 'water' || game.map[y][x].type === 'rock' || game.map[y][x].type === 'hill') continue;

            const blocked = game.buildings.some(b => {
                const size = BUILDING_TYPES[b.type].size;
                return Math.abs(b.x - x) < size + 1 && Math.abs(b.y - y) < size + 1;
            });

            if (!blocked) return { x, y };
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

    // Right click (button 2) or Command+Click (macOS) or Ctrl+Click (Windows/Linux)
    const isRightClick = e.button === 2 || (e.button === 0 && (e.metaKey || e.ctrlKey));

    if (e.button === 0 && !isRightClick) { // Left click (not Command/Ctrl)
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
            }
            game.placingBuilding = null;
            game.placingBuildingFrom = null;
        } else {
            // Check if clicking on own building to build from it
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            const clickedBuilding = game.buildings.find(b => {
                if (b.playerId !== 0) return false;
                const screen = worldToScreen(b.x, b.y);
                const dx = screen.x - screenX;
                const dy = screen.y - screenY;
                return Math.sqrt(dx * dx + dy * dy) < 25;
            });

            if (clickedBuilding) {
                // Select this building for building from
                game.selection = [clickedBuilding];
            } else {
                // Start selection box
                game.selectionBox = { x1: x, y1: y, x2: x, y2: y };
            }
        }
    } else if (isRightClick) {
        const world = screenToWorld(x, y);

        // Check if clicking on enemy
        const enemy = game.units.find(u => {
            if (u.playerId === 0) return false;
            const screen = worldToScreen(u.x, u.y);
            const dx = screen.x - x;
            const dy = screen.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 20;
        }) || game.buildings.find(b => {
            if (b.playerId === 0) return false;
            const screen = worldToScreen(b.x, b.y);
            const dx = screen.x - x;
            const dy = screen.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 30;
        });

        for (const sel of game.selection) {
            if (UNIT_TYPES[sel.type] && sel.playerId === 0) {
                if (enemy) {
                    sel.attackTarget = enemy;
                    sel.targetX = undefined;
                    sel.targetY = undefined;
                } else {
                    sel.targetX = world.x;
                    sel.targetY = world.y;
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

    const world = screenToWorld(game.mouse.x, game.mouse.y);
    game.mouse.worldX = world.x;
    game.mouse.worldY = world.y;

    if (game.selectionBox) {
        game.selectionBox.x2 = game.mouse.x;
        game.selectionBox.y2 = game.mouse.y;
    }
});

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
        if (maxX - minX < 5 && maxY - minY < 5) {
            // Click select (single unit/building)
            const clicked = [...game.units, ...game.buildings].find(entity => {
                const screen = worldToScreen(entity.x, entity.y);
                const dx = screen.x - game.mouse.x;
                const dy = screen.y - game.mouse.y;
                return Math.sqrt(dx * dx + dy * dy) < 20;
            });

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

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Trackpad scroll and zoom support
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Trackpad pinch zoom (Cmd+Scroll on Mac)
    if (e.ctrlKey || e.metaKey) {
        // TODO: Implement zoom (would need to modify camera/zoom system)
    } else {
        // Regular scroll for camera movement
        const scrollSpeed = 20;
        game.camera.x += (e.deltaX / Math.abs(e.deltaX || 1)) * scrollSpeed;
        game.camera.y += (e.deltaY / Math.abs(e.deltaY || 1)) * scrollSpeed;
    }
}, { passive: false });

    // Browser-only support (Mobile removed)

    // Minimap click
    if (minimapCanvas) {
        minimapCanvas.addEventListener('click', (e) => {
            const rect = minimapCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const scale = MAP_SIZE / 180;
            game.camera.x = x * scale * TILE_WIDTH / 2;
            game.camera.y = y * scale * TILE_HEIGHT;
        });
    }

    document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Number keys for control groups (Cmd+1-5 on Mac, Ctrl+1-5 elsewhere)
    if (e.key >= '1' && e.key <= '5') {
        if (e.metaKey || e.ctrlKey) {
            // Assign group
            game[`group${e.key}`] = [...game.selection];
        } else {
            // Select group
            game.selection = game[`group${e.key}`] || [];
        }
    }

    // A for attack move
    if (e.key === 'a' || e.key === 'A') {
        // TODO: Attack move cursor
    }

    // S for stop
    if (e.key === 's' || e.key === 'S') {
        for (const sel of game.selection) {
            sel.targetX = undefined;
            sel.targetY = undefined;
            sel.attackTarget = null;
        }
    }

    // P for pause
    if (e.key === 'p' || e.key === 'P') {
        togglePause();
    }

    // Escape to cancel
    if (e.key === 'Escape') {
        game.placingBuilding = null;
        game.selection = [];
    }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
}

// Camera scrolling
function updateCamera() {
    const speed = 10;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) game.camera.y -= speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) game.camera.y += speed;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) game.camera.x -= speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) game.camera.x += speed;
}

// ============================================
// MENU SYSTEM
// ============================================

function showScreen(screenId) {
    console.log('📺 showScreen called with:', screenId);
    document.querySelectorAll('.fullscreen-overlay').forEach(el => {
        console.log('  ➖ Hiding:', el.id);
        el.classList.add('hidden');
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        console.log('  ✅ Showing:', screenId);
        screen.classList.remove('hidden');
    } else {
        console.error('  ❌ Screen not found:', screenId);
    }
}

function goToMainMenu() {
    game.status = 'MENU';
    game.paused = false;
    game.units = [];
    game.buildings = [];
    game.selection = [];
    showScreen('mainMenu');

    // Stop background music
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
}

function goToSettings() {
    showScreen('settingsMenu');
}

function startGame() {
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

    resetGame();
    initGame();
    game.status = 'PLAYING';
    showScreen('mainMenu');
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('timerDisplay').style.display = 'block';

    // Play background music
    const bgMusic = document.getElementById('backgroundMusic');
    if (bgMusic) {
        bgMusic.volume = 0.3; // 30% Lautstärke
        bgMusic.play().catch(e => console.log('Music autoplay prevented:', e));
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
    game.map = [];
    game.fogOfWar = [];
    game.group1 = [];
    game.group2 = [];
    game.group3 = [];
    game.group4 = [];
    game.group5 = [];
    // Reset camera to center of map
    game.camera.x = 0;
    game.camera.y = (MAP_SIZE / 2) * TILE_HEIGHT;
    game.players[0].oil = gameSettings.startingOil;
    game.players[0].power = 100;
    game.players[0].tech = { barracks: true, factory: false, academy: false };
    game.players[1].oil = gameSettings.startingOil;
    game.players[1].power = 100;
    game.players[1].tech = { barracks: true, factory: false, academy: false };
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

    game.status = 'LOST';
    showScreen('defeatScreen');
    const statsEl = document.getElementById('defeatStats');
    if (statsEl) {
        statsEl.innerHTML = `Time Limit Reached<br>
Your Forces: ${playerUnits} units, ${playerBuildings} buildings<br>
Enemy Forces: ${enemyUnits} units, ${enemyBuildings} buildings`;
    }
}

function checkWinCondition() {
    const enemyUnits = game.units.filter(u => u.playerId === 1);
    const enemyBuildings = game.buildings.filter(b => b.playerId === 1);

    if (enemyUnits.length === 0 && enemyBuildings.length === 0) {
        game.status = 'WON';
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
    // Main menu buttons
    console.log('⚙️ Setting up menu handlers...');
    const newGameBtn = document.getElementById('newGameBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    const backBtn = document.getElementById('backBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const quitBtn = document.getElementById('quitBtn');
    const playAgainBtn = document.getElementById('playAgainBtn');
    const retryBtn = document.getElementById('retryBtn');
    const menuReturnBtns = document.querySelectorAll('.menu-return');

    console.log('  newGameBtn:', newGameBtn ? '✅' : '❌');
    console.log('  settingsBtn:', settingsBtn ? '✅' : '❌');
    console.log('  startGameBtn:', startGameBtn ? '✅' : '❌');
    console.log('  backBtn:', backBtn ? '✅' : '❌');
    console.log('  resumeBtn:', resumeBtn ? '✅' : '❌');
    console.log('  quitBtn:', quitBtn ? '✅' : '❌');
    console.log('  playAgainBtn:', playAgainBtn ? '✅' : '❌');
    console.log('  retryBtn:', retryBtn ? '✅' : '❌');
    console.log('  menuReturnBtns count:', menuReturnBtns.length);

    if (newGameBtn) newGameBtn.addEventListener('click', goToSettings);
    if (settingsBtn) settingsBtn.addEventListener('click', goToSettings);
    if (startGameBtn) startGameBtn.addEventListener('click', startGame);
    if (backBtn) backBtn.addEventListener('click', goToMainMenu);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
    if (quitBtn) quitBtn.addEventListener('click', goToMainMenu);
    if (playAgainBtn) playAgainBtn.addEventListener('click', () => { resetGame(); initGame(); game.status = 'PLAYING'; showScreen('mainMenu'); document.getElementById('mainMenu').classList.add('hidden'); });
    if (retryBtn) retryBtn.addEventListener('click', () => { resetGame(); initGame(); game.status = 'PLAYING'; showScreen('mainMenu'); document.getElementById('mainMenu').classList.add('hidden'); });

    menuReturnBtns.forEach(btn => {
        btn.addEventListener('click', goToMainMenu);
    });

    console.log('  ✅ Menu handlers setup complete');
}

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
    generateMap();

    // Balanced game start: HQ + Harvester only for both players
    // Player base (bottom-left area)
    createBuilding('hq', 0, 10, 10);
    spawnUnit('harvester', 0, 11, 12);

    // Enemy base (top-right area)
    createBuilding('hq', 1, MAP_SIZE - 12, MAP_SIZE - 12);
    spawnUnit('harvester', 1, MAP_SIZE - 13, MAP_SIZE - 14);

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

// Initialize canvases and start game loop
// defer attribute ensures this runs after DOM is ready
try {
    if (!initializeCanvases()) {
        console.error('Failed to initialize canvases');
        alert('Error: Could not initialize game canvases');
    } else {
        console.log('Canvases initialized successfully');
        initializeEventHandlers();
        setupMenuHandlers();
        try {
            // Show main menu
            console.log('Showing main menu');
            showScreen('mainMenu');
            console.log('Starting render loop');
            requestAnimationFrame(gameLoop);
        } catch (gameError) {
            console.error('Error during initialization:', gameError);
            alert('Error: ' + gameError.message);
        }
    }
} catch (e) {
    console.error('Fatal error:', e);
    alert('Fatal error: ' + e.message);
}

console.log('XFire RTS Engine loaded!');
console.log('Controls: WASD to move, Q to build structure, E to select unit');