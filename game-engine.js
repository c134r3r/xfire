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
    } else {
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
    players: [
        {
            id: 0,
            color: '#4488ff',
            oil: 1200,
            power: 100,
            team: 'player',
            tech: {
                barracks: true,
                factory: true,
                derrick: true,
                turret: true,
                powerplant: true,
                academy: true,
                techLab: true,
                researchLab: true,
                rifleTurret: false,
                missileTurret: false
            }
        },
        {
            id: 1,
            color: '#ff0000',
            oil: 1200,
            power: 100,
            team: 'enemy',
            tech: {
                barracks: true,
                factory: true,
                derrick: true,
                turret: true,
                powerplant: true,
                academy: true,
                techLab: true,
                researchLab: true,
                rifleTurret: false,
                missileTurret: false
            }
        }
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

    // Add oil deposits - scale with map size
    const oilCount = Math.floor((8 + Math.floor(Math.random() * 5)) * sizeMultiplier);
    for (let i = 0; i < oilCount; i++) {
        const x = 5 + Math.floor(Math.random() * (mapSize - 10));
        const y = 5 + Math.floor(Math.random() * (mapSize - 10));
        if (game.map[y][x].type === 'grass') {
            game.map[y][x].oil = true;
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

function render() {
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    // Determine visible tiles - larger buffer for isometric edges
    const startTile = screenToWorld(0, 0);
    const endTile = screenToWorld(canvas.offsetWidth, canvas.offsetHeight);

    // Also check corner points for better isometric coverage
    const topRight = screenToWorld(canvas.offsetWidth, 0);
    const bottomLeft = screenToWorld(0, canvas.offsetHeight);

    // Calculate bounds from all corner points for full isometric coverage
    const allX = [startTile.x, endTile.x, topRight.x, bottomLeft.x];
    const allY = [startTile.y, endTile.y, topRight.y, bottomLeft.y];

    const minX = Math.max(0, Math.floor(Math.min(...allX)) - 4);
    const maxX = Math.min(getMapSize(), Math.ceil(Math.max(...allX)) + 4);
    const minY = Math.max(0, Math.floor(Math.min(...allY)) - 4);
    const maxY = Math.min(getMapSize(), Math.ceil(Math.max(...allY)) + 4);

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

    const screen = worldToScreen(tx, ty);
    const zoom = getZoom();

    // Scaled tile dimensions
    const tileW = TILE_WIDTH * zoom;
    const tileH = TILE_HEIGHT * zoom;

    // Tile colors
    const colors = {
        grass: '#3d5c3d',
        sand: '#a08050',
        rock: '#606060',
        water: '#66aaff',
        hill: '#6b4423'
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
    ctx.moveTo(screen.x, screen.y - tileH / 2);
    ctx.lineTo(screen.x + tileW / 2, screen.y);
    ctx.lineTo(screen.x, screen.y + tileH / 2);
    ctx.lineTo(screen.x - tileW / 2, screen.y);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Draw oil deposit (always visible)
    if (tile.oil) {
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - 2 * zoom, 5 * zoom, 0, Math.PI * 2);
        ctx.fill();
    }

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

    // Use red for enemy buildings, team color for own
    const buildingColor = building.playerId === 0 ? player.color : '#ff4444';

    // If under construction, reduce alpha
    const baseAlpha = building.isUnderConstruction ? 0.4 : 0.8;

    // Draw base structure
    ctx.fillStyle = buildingColor;
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
        ctx.fillStyle = shadeColor(buildingColor, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size - 5, size, size);

        // Main structure
        ctx.fillStyle = buildingColor;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 3, size - 4, size - 4);

        // Command antenna
        ctx.strokeStyle = shadeColor(buildingColor, -50);
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
        ctx.fillStyle = shadeColor(buildingColor, -40);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - size/2, size/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = buildingColor;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y - size/2, size/2 - 3, 0, Math.PI * 2);
        ctx.fill();

        // Gun barrel
        ctx.strokeStyle = shadeColor(buildingColor, -60);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screen.x - 2, screen.y - size/2);
        ctx.lineTo(screen.x - size/2 - 2, screen.y - size/2 - 3);
        ctx.stroke();

    } else if (building.type === 'factory') {
        // Factory: industrial complex
        ctx.fillStyle = shadeColor(buildingColor, -35);
        ctx.fillRect(screen.x - size/2, screen.y - size, size, size);

        ctx.fillStyle = buildingColor;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 8, size - 4, size - 6);

        // Production lines
        ctx.strokeStyle = shadeColor(buildingColor, -50);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(screen.x - size/2 + 6, screen.y - size + 6 + i * 4);
            ctx.lineTo(screen.x + size/2 - 6, screen.y - size + 6 + i * 4);
            ctx.stroke();
        }

    } else if (building.type === 'barracks') {
        // Barracks: training facility
        ctx.fillStyle = shadeColor(buildingColor, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size + 3, size, size - 6);

        ctx.fillStyle = buildingColor;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size + 5, size - 4, size - 10);

        // Training yard lines
        ctx.strokeStyle = shadeColor(buildingColor, -50);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screen.x - size/4, screen.y - size/2 + 3);
        ctx.lineTo(screen.x - size/4, screen.y + size/2 - 3);
        ctx.stroke();

    } else if (building.type === 'derrick') {
        // Oil derrick: tall pump structure
        ctx.strokeStyle = shadeColor(buildingColor, -40);
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
        ctx.fillStyle = buildingColor;
        ctx.fillRect(screen.x - 6, screen.y - size + 4, 12, 8);

        // Oil base
        ctx.fillStyle = shadeColor(buildingColor, -30);
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y + 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

    } else {
        // PowerPlant and default: rectangular structure
        ctx.fillStyle = shadeColor(buildingColor, -30);
        ctx.fillRect(screen.x - size/2, screen.y - size, size, size);

        ctx.fillStyle = buildingColor;
        ctx.fillRect(screen.x - size/2 + 2, screen.y - size - 8, size - 4, size - 6);

        // Details
        ctx.fillStyle = shadeColor(buildingColor, -50);
        ctx.fillRect(screen.x - size/2 + 5, screen.y - size + 3, size/3 - 7, 4);
        ctx.fillRect(screen.x + size/6, screen.y - size + 3, size/3 - 7, 4);
    }

    // Roof highlight (shared)
    ctx.fillStyle = shadeColor(buildingColor, 40);
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
    if (unit.type === 'tank' || unit.type === 'lightTank' || unit.type === 'mediumTank' || unit.type === 'heavyTank') {
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

            let color = '#3d5c3d';
            if (tile.type === 'water') color = '#66aaff';
            else if (tile.type === 'rock') color = '#606060';
            else if (tile.type === 'sand') color = '#a08050';
            else if (tile.type === 'hill') color = '#6b4423';

            minimapCtx.fillStyle = color;
            minimapCtx.fillRect(x * scale, y * scale, scale + 1, scale + 1);

            // Show all oil deposits on minimap
            if (tile.oil) {
                minimapCtx.fillStyle = '#000';
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
    updateAI();
    updateResources();
    updateUI();
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
    const maxIterations = 500; // Prevent infinite loops

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
        for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;

            // Bounds check
            if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;

            // Check if passable
            const tile = game.map[ny]?.[nx];
            if (!tile || tile.type === 'water' || tile.type === 'hill') continue;

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
                    const optimalRange = type.range * 0.75;
                    const backupDistance = type.range * 0.3; // Only back up if much too close

                    if (dist > optimalRange) {
                        // Move towards target to get in range
                        const speed = type.speed * dt * 60;
                        const moveX = (dx / dist) * speed;
                        const moveY = (dy / dist) * speed;

                        // Check if next position is passable
                        const nextX = unit.x + moveX;
                        const nextY = unit.y + moveY;
                        const nextTile = game.map[Math.floor(nextY)]?.[Math.floor(nextX)];

                        if (!nextTile || (nextTile.type !== 'hill' && nextTile.type !== 'water')) {
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
                    if (dist <= type.range && game.tick - unit.lastAttack > type.attackSpeed / 16) {
                        fireProjectile(unit, target);
                        unit.lastAttack = game.tick;
                    }
                }
            }
        }
        // Direct movement to target (continuous like harvester)
        else if (unit.targetX !== undefined && unit.targetY !== undefined) {
            const dx = unit.targetX - unit.x;
            const dy = unit.targetY - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.5) {
                // Reached target
                unit.targetX = undefined;
                unit.targetY = undefined;
            } else {
                // Move directly toward target
                unit.angle = Math.atan2(dy, dx);
                const speed = type.speed * dt * 60;
                const moveX = (dx / dist) * speed;
                const moveY = (dy / dist) * speed;

                // Check if next tile is passable
                const nextTile = game.map[Math.floor(unit.y + moveY)]?.[Math.floor(unit.x + moveX)];
                if (nextTile && (nextTile.type === 'hill' || nextTile.type === 'water')) {
                    // Blocked by terrain - stop movement
                    unit.targetX = undefined;
                    unit.targetY = undefined;
                } else {
                    // Move to next position
                    unit.x += moveX;
                    unit.y += moveY;

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
        }

        // Keep in bounds and avoid hills/water/rocks
        unit.x = Math.max(0, Math.min(getMapSize() - 1, unit.x));
        unit.y = Math.max(0, Math.min(getMapSize() - 1, unit.y));

        const tileType = game.map[Math.floor(unit.y)]?.[Math.floor(unit.x)]?.type;
        if (tileType === 'water' || tileType === 'hill') {
            // Push unit back slightly if stuck on impassable terrain
            const backDist = Math.sqrt((unit.x) ** 2 + (unit.y) ** 2) || 1;
            unit.x = Math.max(0, Math.min(getMapSize() - 1, unit.x - 0.5 * (unit.x / backDist)));
            unit.y = Math.max(0, Math.min(getMapSize() - 1, unit.y - 0.5 * (unit.y / backDist)));
        }
    }
}

function updateHarvester(unit, type) {
    const player = game.players[unit.playerId];

    // Find nearest HQ for dropoff
    const hq = game.buildings.find(b => b.playerId === unit.playerId && b.type === 'hq');

    if (unit.cargo >= type.capacity || (unit.returning && unit.cargo > 0)) {
        // Return to HQ - only if HQ exists
        if (hq) {
            unit.returning = true;
            const dx = hq.x - unit.x;
            const dy = hq.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 2) {
                // Avoid division by zero (dist is guaranteed > 2 here)
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
        } else {
            // HQ doesn't exist - reset returning state
            unit.returning = false;
        }
    } else if (unit.targetOilX !== undefined && unit.targetOilY !== undefined) {
        // Go to assigned oil location
        const targetOil = unit.targetOilX;
        const targetOilY = unit.targetOilY;

        // Check if oil still exists at target location
        const oilStillThere = targetOil >= 0 && targetOil < getMapSize() &&
                              targetOilY >= 0 && targetOilY < getMapSize() &&
                              game.map[targetOilY]?.[targetOil]?.oil;

        if (!oilStillThere) {
            // Oil depleted or invalid - clear target
            unit.targetOilX = undefined;
            unit.targetOilY = undefined;
            if (unit.cargo > 0) unit.returning = true;
            return;
        }

        const dx = targetOil - unit.x;
        const dy = targetOilY - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
            // Move to oil
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
            // Harvest at target location
            unit.cargo = Math.min(type.capacity, unit.cargo + 1);
        }
    } else if (unit.cargo > 0) {
        // Have cargo but no target - return to HQ
        unit.returning = true;
    }
    // Else: idle (no target, no cargo)
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

        // Turret attack (only if visible to the building's owner and activated)
        if (type.damage && !building.isUnderConstruction) {
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

                    if (dist < type.range && dist < nearestDist && dist < (type.sight || 250)) {
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

        // Production queue
        if (building.productionQueue.length > 0 && !building.isUnderConstruction) {
            const current = building.productionQueue[0];
            const player = game.players[building.playerId];
            // Slow production if low power (50% speed)
            const powerMultiplier = player.lowPower ? 0.5 : 1.0;
            building.produceProgress += powerMultiplier;
            building.produceTime = current.time;

            if (building.produceProgress >= building.produceTime) {
                // Spawn unit with offset to avoid clustering
                const angle = Math.random() * Math.PI * 2;
                const offset = 1.5 + Math.random() * 1.5;
                const spawnX = building.x + Math.cos(angle) * offset;
                const spawnY = building.y + Math.sin(angle) * offset;
                spawnUnit(current.type, building.playerId, spawnX, spawnY);
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
                    // Create impact effect on hit
                    createImpact(proj.x, proj.y);
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

    // Give AI oil based on difficulty setting
    const difficultyOilBonus = {
        easy: 5,
        normal: 10,
        hard: 18
    };
    ai.oil += difficultyOilBonus[gameSettings.difficulty] || 10;
}

function executeAIStrategy(ai, mode, aiUnits, aiBuildings, playerUnits, playerBuildings) {
    const aiHQ = aiBuildings.find(b => b.type === 'hq');
    const aiBarracks = aiBuildings.filter(b => b.type === 'barracks');
    const aiFactory = aiBuildings.filter(b => b.type === 'factory');
    const aiDerricks = aiBuildings.filter(b => b.type === 'derrick');

    if (!aiHQ) return;

    // Difficulty-based attack thresholds (lower = more aggressive)
    const attackThresholds = {
        easy: { rusher: 5, tech: 12, balanced: 8 },
        normal: { rusher: 3, tech: 8, balanced: 5 },
        hard: { rusher: 2, tech: 6, balanced: 4 }
    };
    const thresholds = attackThresholds[gameSettings.difficulty] || attackThresholds.normal;

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
        if (aiUnits.length >= thresholds.rusher) {
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
        if (aiUnits.length >= thresholds.tech) {
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
        if (aiUnits.length >= thresholds.balanced) {
            attackPlayerBase(playerBuildings, playerUnits, aiUnits);
        }
    }
}

function attackPlayerBase(playerBuildings, playerUnits, aiUnits) {
    // Only attack if there are visible enemies nearby
    // Each unit should find its own target based on sight range
    for (const unit of aiUnits) {
        if (unit.attackTarget) {
            // Already has a target, skip
            continue;
        }

        const unitType = UNIT_TYPES[unit.type];
        const sightRange = unitType?.sight || 100;

        // Look for nearby enemy units first
        let target = playerUnits.find(u => {
            const dx = u.x - unit.x;
            const dy = u.y - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return dist <= sightRange;
        });

        // If no units found, look for nearby buildings
        if (!target) {
            target = playerBuildings.find(b => {
                const dx = b.x - unit.x;
                const dy = b.y - unit.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                return dist <= sightRange;
            });
        }

        if (target) {
            unit.attackTarget = target;
        }
    }
}

function updateResources() {
    // Calculate power for each player
    for (const player of game.players) {
        let powerProduced = 100; // Base power
        let powerConsumed = 0;

        for (const building of game.buildings) {
            if (building.playerId !== player.id || building.isUnderConstruction) continue;

            const type = BUILDING_TYPES[building.type];

            // Power production from power plants
            if (type.powerGen) {
                powerProduced += type.powerGen;
            }

            // Power consumption from buildings
            if (type.powerUse) {
                powerConsumed += type.powerUse;
            }
        }

        // Store power balance (can be negative)
        player.powerProduced = powerProduced;
        player.powerConsumed = powerConsumed;
        player.power = powerProduced - powerConsumed;
        player.lowPower = player.power < 0;
    }

    // Derricks generate oil
    for (const building of game.buildings) {
        if (building.type === 'derrick' && !building.isUnderConstruction) {
            const type = BUILDING_TYPES.derrick;
            const player = game.players[building.playerId];
            // Reduced oil generation if low power
            const powerMultiplier = player.lowPower ? 0.5 : 1.0;
            player.oil += (type.generates / 60) * powerMultiplier;
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

    // Show power balance with color coding
    const player = game.players[0];
    const powerBalance = player.power || 0;
    powerEl.textContent = powerBalance >= 0 ? `+${Math.floor(powerBalance)}` : Math.floor(powerBalance);
    powerEl.style.color = powerBalance >= 0 ? '#0f0' : '#f00';

    // Show warning if low power
    if (player.lowPower) {
        powerEl.title = 'LOW POWER! Production slowed 50%';
    } else {
        powerEl.title = `Power: ${player.powerProduced || 100} produced, ${player.powerConsumed || 0} consumed`;
    }

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
            for (let i = 0; i < type.produces.length; i++) {
                const unitType = type.produces[i];
                const uType = UNIT_TYPES[unitType];
                const keyNum = i + 1; // 1-N
                const btn = document.createElement('button');
                btn.className = 'build-btn';
                btn.innerHTML = `<div>${uType.icon}</div><span style="font-size: 10px; font-weight: bold;">[${keyNum}]</span><span style="font-size: 9px;">${uType.cost}</span>`;

                // Check harvester requirement: factory must exist
                const canBuild = player.oil >= uType.cost && selectedBuilding.productionQueue.length < 10;
                const requirementMet = unitType !== 'harvester' ||
                                      game.buildings.some(b => b.playerId === 0 && b.type === 'factory' && !b.isUnderConstruction);

                btn.title = unitType === 'harvester' && !requirementMet
                    ? `${uType.name} - Requires Factory`
                    : `${uType.name} - Press [${keyNum}] or click - ${uType.cost} oil`;
                btn.disabled = !canBuild || !requirementMet;

                btn.onclick = () => {
                    if (canBuild && requirementMet) {
                        player.oil -= uType.cost;
                        addToProductionQueue(selectedBuilding, unitType);
                        updateBuildMenu();
                    }
                };
                menu.appendChild(btn);
            }
        }
        // Show turret/defensive building info
        else if (type.range && type.damage) {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'padding: 10px; font-size: 12px; color: #ccc;';
            let infoHTML = `<strong style="color: #fff;">${type.name}</strong><br><br>`;
            infoHTML += `<span style="color: #f80;">Range:</span> ${type.range}<br>`;
            infoHTML += `<span style="color: #f00;">Damage:</span> ${type.damage}<br>`;
            infoHTML += `<span style="color: #0af;">Attack Speed:</span> ${type.attackSpeed}ms<br>`;
            if (type.versus) {
                const versusColor = type.versus === 'infantry' ? '#0f0' : '#ff0';
                infoHTML += `<br><span style="color: ${versusColor};">+50% vs ${type.versus}</span>`;
            }
            if (type.powerUse) {
                infoHTML += `<br><span style="color: #88f;">Power:</span> -${type.powerUse}`;
            }
            infoDiv.innerHTML = infoHTML;
            menu.appendChild(infoDiv);
        }
        // Show other building info (powerplant, derrick, etc.)
        else {
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'padding: 10px; font-size: 12px; color: #ccc;';
            let infoHTML = `<strong style="color: #fff;">${type.name}</strong><br><br>`;
            if (type.powerGen) {
                infoHTML += `<span style="color: #0f0;">Power:</span> +${type.powerGen}<br>`;
            }
            if (type.generates) {
                infoHTML += `<span style="color: #fa0;">Oil/sec:</span> +${(type.generates / 60).toFixed(2)}<br>`;
            }
            if (type.powerUse) {
                infoHTML += `<span style="color: #88f;">Power Use:</span> -${type.powerUse}<br>`;
            }
            if (type.bonuses) {
                if (type.bonuses.infantryDamage) {
                    infoHTML += `<span style="color: #0f0;">Infantry Damage:</span> +${Math.round((type.bonuses.infantryDamage - 1) * 100)}%<br>`;
                }
                if (type.bonuses.vehicleDamage) {
                    infoHTML += `<span style="color: #ff0;">Vehicle Damage:</span> +${Math.round((type.bonuses.vehicleDamage - 1) * 100)}%<br>`;
                }
            }
            infoDiv.innerHTML = infoHTML;
            menu.appendChild(infoDiv);
        }
    } else {
        // Show building options (only available techs)
        menu.innerHTML = '';
        const buildable = ['barracks', 'factory', 'derrick', 'turret', 'rifleTurret', 'missileTurret', 'powerplant', 'researchLab'];

        for (let i = 0; i < buildable.length; i++) {
            const bType = buildable[i];
            const type = BUILDING_TYPES[bType];
            if (!type) continue;

            // Check if tech is available
            const isTechAvailable = game.players[0].tech[bType] !== false;
            const keyNum = i + 1; // 1-8

            const btn = document.createElement('button');
            btn.className = 'build-btn';
            btn.innerHTML = `<div>${type.icon}</div><span style="font-size: 10px; font-weight: bold;">[${keyNum}]</span><span style="font-size: 9px;">${type.cost}</span>`;
            btn.title = isTechAvailable ? `${type.name} - Press [${keyNum}] or click - ${type.cost} oil` : `${type.name} - Requires tech`;
            btn.disabled = player.oil < type.cost || !isTechAvailable;
            btn.onclick = () => {
                if (player.oil >= type.cost && isTechAvailable) {
                    game.placingBuilding = bType;
                    // If a building is selected, set it as source
                    const selectedBuilding = game.selection.find(s => BUILDING_TYPES[s.type]);
                    if (selectedBuilding && selectedBuilding.playerId === 0) {
                        game.placingBuildingFrom = selectedBuilding;
                    } else {
                        game.placingBuildingFrom = null;
                    }
                }
            };
            menu.appendChild(btn);;
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

    // Set activation time for turrets even if not under construction
    if (bType.damage && !isUnderConstruction) {
        building.activationTime = game.tick + 180; // 3 second delay
    }

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

    // Check map bounds
    if (x < 0 || x >= getMapSize() || y < 0 || y >= getMapSize()) return false;

    // Check for building collision (don't build on top of other buildings)
    const bSize = type.size;
    let canPlaceHere = true;

    for (const building of game.buildings) {
        const bType = BUILDING_TYPES[building.type];
        const bdx = Math.abs(x - building.x);
        const bdy = Math.abs(y - building.y);
        const dist = Math.max(bdx, bdy);

        // If too close to another building, can't place
        if (dist < bSize + bType.size) {
            canPlaceHere = false;
            break;
        }
    }

    return canPlaceHere;
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

    // Prevent division by zero if source and target are at the same position
    if (dist === 0) return;

    // Check if path is blocked by hills
    const blockadeIndex = checkLineOfSight(source.x, source.y, target.x, target.y);

    // Add accuracy/inaccuracy - 20% chance to miss
    const hitChance = 0.8;
    const willHit = Math.random() < hitChance;

    let finalTargetX = target.x;
    let finalTargetY = target.y;

    // If miss: calculate where projectile will go (off-target)
    if (!willHit) {
        // Random offset away from target (angular deviation)
        const angle = Math.random() * Math.PI * 2;
        const missOffset = 30 + Math.random() * 40; // 30-70 units away
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
        life: 100,
        blockadeIndex: blockadeIndex,
        willHit: willHit,
        maxRange: type.range || 200,
        startX: source.x,
        startY: source.y
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

            if (x < 0 || x >= getMapSize() || y < 0 || y >= getMapSize()) continue;
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
            // Reuse x, y from above (no duplicate calculation needed)
            const clickedBuilding = game.buildings.find(b => {
                if (b.playerId !== 0) return false;
                const screen = worldToScreen(b.x, b.y);
                const dx = screen.x - x;
                const dy = screen.y - y;
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
        const tileX = Math.floor(world.x);
        const tileY = Math.floor(world.y);

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

        // Check if clicking on oil
        const hasOil = tileX >= 0 && tileX < getMapSize() && tileY >= 0 && tileY < getMapSize() &&
                       game.map[tileY]?.[tileX]?.oil;

        for (const sel of game.selection) {
            if (UNIT_TYPES[sel.type] && sel.playerId === 0) {
                if (enemy) {
                    sel.attackTarget = enemy;
                    sel.targetX = undefined;
                    sel.targetY = undefined;
                    sel.targetOilX = undefined;
                    sel.targetOilY = undefined;
                    sel.path = null;
                } else if (sel.type === 'harvester' && hasOil) {
                    // Assign harvester to oil
                    sel.targetOilX = tileX;
                    sel.targetOilY = tileY;
                    sel.targetX = undefined;
                    sel.targetY = undefined;
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
                    sel.targetOilX = undefined;
                    sel.targetOilY = undefined;
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

    // Update cursor based on selection and what's under the mouse
    updateCursorEmoji();
});

function updateCursorEmoji() {
    const tileX = Math.floor(game.mouse.worldX);
    const tileY = Math.floor(game.mouse.worldY);
    let newCursor = 'default';

    if (game.selection.length > 0) {
        const sel = game.selection[0];

        // Check if Harvester is selected and mouse is over oil
        if (sel.type === 'harvester') {
            const hasOil = tileX >= 0 && tileX < getMapSize() && tileY >= 0 && tileY < getMapSize() &&
                          game.map[tileY]?.[tileX]?.oil;
            if (hasOil) {
                newCursor = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHRleHQgeD0iNSIgeT0iMjUiIGZvbnQtc2l6ZT0iMjQiPvCXpYA8L3RleHQ+PC9zdmc+") 16 16, auto';
            }
        } else if (sel.type && UNIT_TYPES[sel.type]) {
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
                newCursor = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHRleHQgeD0iNSIgeT0iMjUiIGZvbnQtc2l6ZT0iMjQiPvCfk7g8L3RleHQ+PC9zdmc+") 16 16, auto';
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

    // Trackpad pinch zoom (Cmd+Scroll on Mac) or Ctrl+Scroll
    if (e.ctrlKey || e.metaKey) {
        // Zoom in/out
        const zoomSpeed = 0.1;
        const zoomDelta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        gameSettings.zoom = Math.max(
            gameSettings.minZoom,
            Math.min(gameSettings.maxZoom, gameSettings.zoom + zoomDelta)
        );
    } else {
        // Regular scroll for camera movement
        const scrollSpeed = 20 / getZoom(); // Adjust scroll speed based on zoom
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

            const minimapSize = minimapCanvas.width;
            const scale = getMapSize() / minimapSize;
            game.camera.x = x * scale * TILE_WIDTH / 2;
            game.camera.y = y * scale * TILE_HEIGHT;
        });
    }

    document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Number keys 1-8: Context-dependent
    if (e.key >= '1' && e.key <= '8' && !(e.metaKey || e.ctrlKey) && game.status === 'PLAYING') {
        const keyNum = parseInt(e.key);

        // Check if a building with production is selected
        const selectedBuilding = game.selection.find(s => BUILDING_TYPES[s.type]);

        if (selectedBuilding && selectedBuilding.playerId === 0 && BUILDING_TYPES[selectedBuilding.type].produces.length > 0) {
            // Building with production is selected - use numbers for units
            const produces = BUILDING_TYPES[selectedBuilding.type].produces;
            const unitIndex = keyNum - 1;

            if (produces[unitIndex]) {
                const unitType = produces[unitIndex];
                const uType = UNIT_TYPES[unitType];
                const player = game.players[0];

                // Check if affordable and queue not full
                if (player.oil >= uType.cost && selectedBuilding.productionQueue.length < 10) {
                    player.oil -= uType.cost;
                    addToProductionQueue(selectedBuilding, unitType);
                    updateBuildMenu();
                    e.preventDefault();
                }
            }
        } else {
            // No building selected or building has no production - use numbers for buildings
            const buildableList = ['barracks', 'factory', 'derrick', 'turret', 'rifleTurret', 'missileTurret', 'powerplant', 'researchLab'];
            const buildingIndex = keyNum - 1;

            if (buildableList[buildingIndex]) {
                const bType = buildableList[buildingIndex];
                const type = BUILDING_TYPES[bType];
                const player = game.players[0];

                // Check if building is affordable and tech available
                const isTechAvailable = player.tech[bType] !== false;
                if (player.oil >= type.cost && isTechAvailable) {
                    game.placingBuilding = bType;
                    // If a building is selected, set it as source
                    const selectedBuildingForBuild = game.selection.find(s => BUILDING_TYPES[s.type]);
                    if (selectedBuildingForBuild && selectedBuildingForBuild.playerId === 0) {
                        game.placingBuildingFrom = selectedBuildingForBuild;
                    } else {
                        game.placingBuildingFrom = null;
                    }
                    e.preventDefault();
                }
            }
        }
    }
    // Number keys for control groups (Cmd+1-5 on Mac, Ctrl+1-5 elsewhere)
    else if (e.key >= '1' && e.key <= '5' && (e.metaKey || e.ctrlKey)) {
        // Assign group
        game[`group${e.key}`] = [...game.selection];
        e.preventDefault();
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
        game.placingBuildingFrom = null;
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
    game.players[0].oil = gameSettings.startingOil;
    game.players[0].power = 100;
    // Initialize all building techs - all available by default except specialized ones
    game.players[0].tech = {
        barracks: true,
        factory: true,
        derrick: true,
        turret: true,
        powerplant: true,
        academy: true,
        techLab: true,
        researchLab: true,
        rifleTurret: false,
        missileTurret: false
    };
    game.players[1].oil = gameSettings.startingOil;
    game.players[1].power = 100;
    // Initialize all building techs - all available by default except specialized ones
    game.players[1].tech = {
        barracks: true,
        factory: true,
        derrick: true,
        turret: true,
        powerplant: true,
        academy: true,
        techLab: true,
        researchLab: true,
        rifleTurret: false,
        missileTurret: false
    };
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
    if (playAgainBtn) playAgainBtn.addEventListener('click', () => {
        resetGame();
        initGame();
        game.status = 'PLAYING';
        showScreen('mainMenu');
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('timerDisplay').style.display = 'block';
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

    // Balanced game start: HQ + Harvester only for both players
    // Player base (bottom-left area)
    createBuilding('hq', 0, 10, 10);
    spawnUnit('harvester', 0, 11, 12);

    // Enemy base (top-right area)
    const mapSizeVal = getMapSize();
    createBuilding('hq', 1, mapSizeVal - 12, mapSizeVal - 12);
    spawnUnit('harvester', 1, mapSizeVal - 13, mapSizeVal - 14);

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