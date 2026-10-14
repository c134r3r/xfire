// ============================================
// XFire - Battlefield renderer & effects
// Draw order per frame:
//   terrain cache -> decals -> ground FX (light, scorch) -> depth-sorted
//   buildings / units / rock walls -> fog -> projectiles -> particles ->
//   overlays (orders, placement ghost, selection box) -> HUD text.
// Particles use pre-rendered radial sprites with additive blending
// instead of canvas shadowBlur (which is very slow), so big battles
// stay smooth.
// ============================================

// ---------- cached glow / puff textures ----------
const FxTex = (() => {
    const glow = new Map(), puff = new Map();
    function hexRGB(c) {
        const n = parseInt(c.replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return {
        glow(color) {
            let t = glow.get(color);
            if (t) return t;
            t = document.createElement('canvas');
            t.width = t.height = 64;
            const c = t.getContext('2d');
            const [r, g, b] = hexRGB(color);
            const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)},1)`);
            grad.addColorStop(0.25, `rgba(${r},${g},${b},0.85)`);
            grad.addColorStop(0.6, `rgba(${r},${g},${b},0.25)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            c.fillStyle = grad;
            c.fillRect(0, 0, 64, 64);
            glow.set(color, t);
            return t;
        },
        // ground scorch: dark soft disc (drawn squashed into the iso plane)
        scorch() {
            let t = glow.get('__scorch');
            if (t) return t;
            t = document.createElement('canvas');
            t.width = t.height = 96;
            const c = t.getContext('2d');
            const g = c.createRadialGradient(48, 48, 2, 48, 48, 48);
            g.addColorStop(0, 'rgba(12,9,6,0.82)');
            g.addColorStop(0.5, 'rgba(26,19,12,0.5)');
            g.addColorStop(1, 'rgba(30,24,16,0)');
            c.fillStyle = g;
            c.fillRect(0, 0, 96, 96);
            glow.set('__scorch', t);
            return t;
        },
        puff(color) {
            let t = puff.get(color);
            if (t) return t;
            t = document.createElement('canvas');
            t.width = t.height = 64;
            const c = t.getContext('2d');
            const [r, g, b] = hexRGB(color);
            // lumpy smoke: a few overlapping soft blobs
            for (const [x, y, rad, a] of [[32, 34, 26, 0.55], [24, 28, 16, 0.35], [40, 27, 15, 0.35], [32, 22, 13, 0.3]]) {
                const grad = c.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
                grad.addColorStop(0, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},${a})`);
                grad.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.6})`);
                grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
                c.fillStyle = grad;
                c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
            }
            puff.set(color, t);
            return t;
        }
    };
})();

// Units are drawn a bit larger than their modelled size so they read
// clearly next to buildings (infantry most of all)
function unitVisScale(type) {
    return type.category === 'infantry' ? 1.3 : 1.15;
}

const ADDITIVE_FX = new Set(['flash', 'fire', 'spark', 'muzzle', 'light', 'explosion', 'glowdot']);

// ============================================
// FRAME
// ============================================

function render(frameDt = 1 / 60) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    if (!Terrain.ready) return;

    // Screen shake: nudge the camera for this frame only
    let shakeX = 0, shakeY = 0;
    if (game.shake > 0.3 && game.status === 'PLAYING') {
        shakeX = (Math.random() - 0.5) * game.shake;
        shakeY = (Math.random() - 0.5) * game.shake;
        game.camera.x += shakeX;
        game.camera.y += shakeY;
    }
    game.shake = (game.shake || 0) * Math.pow(0.88, frameDt * 60);

    Terrain.draw();
    Terrain.drawOilAnimations();
    drawDecals();
    drawGroundFx();
    drawBunkers();
    drawRallyAndPaths();

    // Depth-sorted scene: buildings, units, dying units and rock walls.
    // Hostiles only show while they sit on a visible tile.
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    const zoom = getZoom();
    const scene = [];
    for (const b of game.buildings) {
        if (b.playerId !== 0 && tileFog(b.x, b.y) !== 2 && !b._seen) continue;
        if (b.playerId !== 0 && tileFog(b.x, b.y) === 2) b._seen = true;
        const s = worldToScreen(b.x, b.y);
        if (s.x < -160 * zoom || s.x > cw + 160 * zoom || s.y < -40 * zoom || s.y > ch + 220 * zoom) continue;
        scene.push({ d: b.x + b.y, k: 0, e: b });
    }
    for (const u of game.units) {
        if (u.playerId !== 0 && !isVisible(u.x, u.y)) continue;
        const s = worldToScreen(u.x, u.y);
        if (s.x < -70 * zoom || s.x > cw + 70 * zoom || s.y < -30 * zoom || s.y > ch + 90 * zoom) continue;
        scene.push({ d: u.x + u.y, k: 1, e: u });
    }
    for (const d of game.dying || []) if (isVisible(d.x, d.y)) scene.push({ d: d.x + d.y, k: 2, e: d });
    for (const w of Terrain.visibleWalls([])) scene.push({ d: w.depth, k: 3, e: w });
    scene.sort((a, b) => a.d - b.d);
    for (const it of scene) {
        if (it.k === 0) drawBuilding(it.e);
        else if (it.k === 1) drawUnit(it.e);
        else if (it.k === 2) drawDyingOne(it.e);
        else Terrain.drawWall(it.e);
    }

    drawFog();

    // Unit overlays above the fog-free scene: health bars, chevrons,
    // group numbers (drawn after the sort so they never get buried)
    for (const it of scene) if (it.k === 1 || it.k === 0) drawEntityOverlay(it.e);

    drawOrderMarkers();
    for (const proj of game.projectiles) drawProjectile(proj);
    drawParticles();
    drawDamageNumbers();

    if (game.selectionBox) {
        const b = game.selectionBox;
        const x = Math.min(b.x1, b.x2), y = Math.min(b.y1, b.y2);
        const w = Math.abs(b.x2 - b.x1), h = Math.abs(b.y2 - b.y1);
        if (w > 3 || h > 3) {
            ctx.fillStyle = 'rgba(80,255,120,0.08)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(110,255,140,0.9)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w, h);
            // corner ticks
            ctx.lineWidth = 2;
            for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
                ctx.beginPath();
                ctx.moveTo(cx, cy + dy * 7); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * 7, cy);
                ctx.stroke();
            }
        }
    }

    // While placing a derrick: spotlight every known live oil patch
    if (game.placingBuilding && BUILDING_TYPES[game.placingBuilding]?.needsOil && game.oilTiles) {
        const pulse = (Date.now() / 700) % 1;
        for (const t of game.oilTiles) {
            const tile = game.map[t.y]?.[t.x];
            if (!tile || !tile.oil || (tile.oilAmount !== undefined && tile.oilAmount <= 0)) continue;
            if (tileFog(t.x, t.y) === 0) continue;
            const s = worldToScreen(t.x + 0.5, t.y + 0.5);
            if (s.x < -60 || s.x > cw + 60 || s.y < -60 || s.y > ch + 60) continue;
            const taken = game.buildings.some(b => b.type === 'derrick' && Math.abs(b.x - t.x - 0.5) < 1.6 && Math.abs(b.y - t.y - 0.5) < 1.6);
            ctx.strokeStyle = taken ? 'rgba(255,90,70,0.5)' : `rgba(255,204,68,${0.95 - pulse * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, (18 + pulse * 6) * zoom, (9 + pulse * 3) * zoom, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    if (game.placingBuilding) drawBuildingPreview(game.placingBuilding);

    if (game.status === 'PLAYING' || game.status === 'PAUSED') drawDust();

    drawObjectiveGuides();
    drawObjectives();
    drawBanner();
    if (game.attackMoveMode) drawModeHint('ATTACK-MOVE  ·  left-click a target area  ·  Esc / right-click cancels', '#ffaa33');
    if (game.showHelp) drawHelpOverlay();

    game.camera.x -= shakeX;
    game.camera.y -= shakeY;

    // the entity under a still cursor can change as units move
    if ((game._cursorTick = (game._cursorTick || 0) + 1) % 8 === 0 && game.mouse.inside && game.status === 'PLAYING') {
        updateCursorEmoji();
    }

    renderMinimap();
    updateHoverTip();
    if (game.status === 'PLAYING') IsoSprites.prewarmStep(3);
}

// ============================================
// FOG + ATMOSPHERE
// ============================================

function drawDust() {
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    if (dustMotes.length === 0) {
        for (let i = 0; i < 22; i++) {
            dustMotes.push({
                x: Math.random() * cw, y: Math.random() * ch,
                vx: 0.2 + Math.random() * 0.45, vy: 0.05 + Math.random() * 0.15,
                size: 0.8 + Math.random() * 1.8, a: 0.05 + Math.random() * 0.1
            });
        }
    }
    ctx.fillStyle = '#f5e8c8';
    for (const m of dustMotes) {
        if (game.status === 'PLAYING') { m.x += m.vx; m.y += m.vy; }
        if (m.x > cw + 4) { m.x = -4; m.y = Math.random() * ch; }
        if (m.y > ch + 4) { m.y = -4; }
        ctx.globalAlpha = m.a;
        ctx.fillRect(m.x, m.y, m.size, m.size);
    }
    ctx.globalAlpha = 1;
}

// ============================================
// DECALS (wrecks, splats, scorch, craters)
// ============================================

function drawDecals() {
    if (!game.decals) return;
    const zoom = getZoom();
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    for (const d of game.decals) {
        if (tileFog(d.x, d.y) === 0) continue;
        const s = worldToScreen(d.x, d.y);
        if (s.x < -140 || s.x > cw + 140 || s.y < -140 || s.y > ch + 140) continue;
        ctx.globalAlpha = Math.min(1, d.life / 10);

        if (d.type === 'wreck') {
            const spr = IsoSprites.wreckSprite(d.role, d.faction, d.dir);
            const vz = zoom * unitVisScale(UNIT_TYPES[d.role]);
            ctx.drawImage(spr, s.x - spr.anchorX * vz, s.y - spr.anchorY * vz,
                spr.logicalWidth * vz, spr.logicalHeight * vz);
            if (d.maxLife - d.life < 8 && Math.random() < 0.1) {
                game.particles.push({
                    x: d.x + (Math.random() - 0.5) * 0.3, y: d.y + (Math.random() - 0.5) * 0.3, z: 8,
                    vx: 0.004, vy: -0.002, vz: 0.35, color: '#3a3632', size: 6 + Math.random() * 4,
                    life: 1, decay: 0.012, type: 'smoke', grow: 1.6
                });
            }
        } else if (d.type === 'splat') {
            const sz = d.size || 7;
            ctx.fillStyle = d.color;
            ctx.save();
            ctx.translate(s.x, s.y);
            if (d.smear) ctx.rotate(d.smear);
            ctx.beginPath();
            ctx.ellipse(0, 0, sz * (d.smear !== undefined ? 1.7 : 1) * zoom, sz * 0.5 * zoom, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            for (const [ox, oy, r] of d.drops) {
                ctx.beginPath();
                ctx.ellipse(s.x + ox * zoom, s.y + oy * zoom, r * zoom, r * 0.5 * zoom, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (d.type === 'scorch' || d.type === 'crater') {
            const size = d.size * zoom;
            ctx.drawImage(FxTex.scorch(), s.x - size, s.y - size * 0.5, size * 2, size);
            if (d.type === 'crater') {
                ctx.strokeStyle = 'rgba(150,126,90,0.35)';
                ctx.lineWidth = 1.2 * zoom;
                ctx.beginPath();
                ctx.ellipse(s.x, s.y + size * 0.05, size * 0.45, size * 0.2, 0, Math.PI * 0.1, Math.PI * 0.9);
                ctx.stroke();
            }
            if (d.rubble) {
                ctx.fillStyle = '#4c463e';
                for (const [ox, oy, r, rr] of d.rubble) {
                    ctx.save();
                    ctx.translate(s.x + ox * zoom, s.y + oy * zoom);
                    ctx.rotate(rr);
                    ctx.fillRect(-r * zoom, -r * 0.6 * zoom, r * 2 * zoom, r * 1.2 * zoom);
                    ctx.restore();
                }
            }
        }
        ctx.globalAlpha = 1;
    }
}

// Units in their death animation (depth-sorted with the scene)
function drawDyingOne(d) {
    const zoom = getZoom();
    const s = worldToScreen(d.x, d.y);
    const team = teamColor(d.playerId ?? 1);
    const spr = IsoSprites.unitComposite(d.role, d.faction, d.dir, 0, team);
    const vz = zoom * unitVisScale(UNIT_TYPES[d.role]);
    const w = spr.logicalWidth * vz, h = spr.logicalHeight * vz;
    ctx.save();
    if (d.infantry) {
        const p = Math.min(1, d.t / 0.55);
        ctx.translate(s.x, s.y);
        ctx.rotate(p * 1.45 * (d.dir < 8 ? 1 : -1));
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.drawImage(spr, -spr.anchorX * vz, -spr.anchorY * vz, w, h);
    } else {
        const p = Math.min(1, d.t / 0.5);
        ctx.globalAlpha = 1 - p * 0.85;
        ctx.drawImage(spr, s.x - spr.anchorX * vz, s.y - spr.anchorY * vz + p * 4 * zoom, w, h);
        if (d.t < 0.15) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.7 * (1 - d.t / 0.15);
            ctx.drawImage(spr, s.x - spr.anchorX * vz, s.y - spr.anchorY * vz, w, h);
        }
    }
    ctx.restore();
}
function drawDying() { /* drawn inside the depth-sorted scene */ }

// Ground-hugging light from explosions and muzzle flashes
function drawGroundFx() {
    const zoom = getZoom();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of game.particles) {
        if (p.type !== 'light') continue;
        const s = worldToScreen(p.x, p.y);
        const r = p.size * zoom * (1 + (1 - p.life) * 0.4);
        ctx.globalAlpha = Math.max(0, p.life) * 0.55;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(1, 0.5);
        ctx.drawImage(FxTex.glow(p.color), -r, -r, r * 2, r * 2);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
}

// ============================================
// BUILDINGS
// ============================================

function drawBuilding(building) {
    const type = BUILDING_TYPES[building.type];
    const s = worldToScreen(building.x, building.y);
    const zoom = getZoom();
    const faction = getFaction(building.playerId);
    const team = teamColor(building.playerId);

    let frame = 0;
    if (!building.isUnderConstruction) {
        frame = Math.floor(game.tick / 36) % 2;
        if (building.type === 'derrick' && building.oilLeft === 0) frame = 0;
    }
    const spr = IsoSprites.buildingSprite(building.type, faction, frame, team);
    const dx = s.x - spr.anchorX * zoom, dy = s.y - spr.anchorY * zoom;
    const dw = spr.logicalWidth * zoom, dh = spr.logicalHeight * zoom;
    const isSelected = game.selection.includes(building);

    if (isSelected || game.hover === building) drawFootprint(building, isSelected ? (building.playerId === 0 ? '#5dff7a' : '#ff5544') : 'rgba(255,255,255,0.55)');

    if (building.isUnderConstruction) {
        const progress = building.buildProgress / building.buildTime;
        // the structure rises inside a scaffold
        ctx.save();
        ctx.globalAlpha = 0.5 + progress * 0.5;
        const visible = dh * (0.18 + progress * 0.82);
        ctx.beginPath();
        ctx.rect(dx - 4, dy + dh - visible, dw + 8, visible);
        ctx.clip();
        ctx.drawImage(spr, dx, dy, dw, dh);
        ctx.restore();
        // scaffold lines + welding sparks
        const half = type.size / 2;
        ctx.strokeStyle = 'rgba(255,200,90,0.55)';
        ctx.lineWidth = 1;
        const h = (14 + type.size * 10) * zoom * (1 - progress * 0.5);
        for (const [cx, cy] of [[-half, -half], [half, -half], [half, half], [-half, half]]) {
            const p = worldToScreen(building.x + cx * 0.9, building.y + cy * 0.9);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - h); ctx.stroke();
        }
        if (Math.random() < 0.15) {
            game.particles.push({
                x: building.x + (Math.random() - 0.5) * type.size * 0.8, y: building.y + (Math.random() - 0.5) * type.size * 0.8,
                z: 8 + Math.random() * 20, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02, vz: 0.8,
                color: '#ffd27a', size: 1.5, life: 0.5, decay: 0.05, type: 'spark', grav: 0.15
            });
        }
        return;
    }

    ctx.drawImage(spr, dx, dy, dw, dh);
    if (building._hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = building._hitFlash / 12;
        ctx.drawImage(spr, dx, dy, dw, dh);
        ctx.restore();
        building._hitFlash--;
    }

    // rotating tower head
    if (building.type === 'tower' || building.type === 'towerHeavy') {
        const tdir = IsoSprites.dirFromAngle(building.turretAngle ?? Math.PI / 4);
        const tur = IsoSprites.turretSprite(building.type, faction, tdir, team);
        const mz = IsoSprites.towerTurretMount(building.type, faction) || 20;
        const rc = (building._recoil || 0);
        building._recoil = rc * 0.8;
        const ra = building.turretAngle ?? 0;
        const rx = -Math.cos(ra) * rc * 0.04, ry = -Math.sin(ra) * rc * 0.04;
        const tp = worldToScreen(building.x + rx, building.y + ry);
        ctx.drawImage(tur,
            tp.x - tur.anchorX * zoom, tp.y - (mz + tur.anchorY) * zoom,
            tur.logicalWidth * zoom, tur.logicalHeight * zoom);
    }

    // heavily damaged: darker, smouldering
    if (building.hp < type.hp * 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.restore();
    }

    if (isSelected && type.range) drawRangeRing(building.x, building.y, rangeT(type), 'rgba(255,150,80,0.6)');
    if (isSelected && type.repairRadius) drawRangeRing(building.x, building.y, type.repairRadius, 'rgba(100,255,170,0.5)');
}

function drawFootprint(building, color) {
    const half = BUILDING_TYPES[building.type].size / 2 + 0.08;
    const c = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => worldToScreen(building.x + x, building.y + y));
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // corner brackets rather than a full outline: reads as "selected"
    for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4], z = c[(i + 3) % 4];
        ctx.beginPath();
        ctx.moveTo(a.x + (z.x - a.x) * 0.22, a.y + (z.y - a.y) * 0.22);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(a.x + (b.x - a.x) * 0.22, a.y + (b.y - a.y) * 0.22);
        ctx.stroke();
    }
    ctx.restore();
}

// World-space circle of `r` tiles, as it appears in the iso view
function drawRangeRing(x, y, r, color, dashed = true) {
    const zoom = getZoom();
    const s = worldToScreen(x, y);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (dashed) ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -(Date.now() / 60) % 14;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, r * (TILE_WIDTH / 2) * Math.SQRT2 * zoom, r * (TILE_HEIGHT / 2) * Math.SQRT2 * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

// ============================================
// UNITS
// ============================================

function drawUnit(unit) {
    const type = UNIT_TYPES[unit.type];
    const s = worldToScreen(unit.x, unit.y);
    const zoom = getZoom();
    const faction = getFaction(unit.playerId);
    const team = teamColor(unit.playerId);
    const own = unit.playerId === 0;
    const isSelected = game.selection.includes(unit);
    const hovered = game.hover === unit;

    const dir = IsoSprites.dirFromAngle(unit.angle || 0);
    const moving = unit._moving;
    const frames = IsoSprites.animatedFrames(unit.type, faction);
    let frame = 0;
    if (moving && frames > 1) {
        const rate = type.category === 'infantry' ? 7 : 9;
        const f = Math.floor((game.tick + unit.id * 3) / rate) % 4;
        frame = frames === 5 ? 1 + f : f;
    }
    const spr = IsoSprites.unitSprite(unit.type, faction, dir, frame, team);

    // team ring on the ground: friend/foe at a glance
    const rx = (type.size * 1.3 + 5) * zoom, ry = rx * 0.5;
    if (isSelected) {
        ctx.save();
        ctx.strokeStyle = own ? '#5dff7a' : '#ff5544';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 1, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = own ? '#5dff7a' : '#ff5544';
        ctx.fill();
        ctx.restore();
    } else {
        ctx.strokeStyle = IsoSprites.withAlpha(team, hovered ? 0.95 : 0.5);
        ctx.lineWidth = hovered ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 1, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (unit._targetFlash > 0) {
        unit._targetFlash--;
        if (Math.floor(unit._targetFlash / 5) % 2 === 0) {
            ctx.strokeStyle = '#ff3322';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y + 1, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // recoil: the hull rocks back for a moment when firing
    const rc = unit._recoil || 0;
    unit._recoil = rc * 0.78;
    const kick = type.turret ? 0 : rc * 0.35;
    const ang = unit.angle || 0;
    const kx = -Math.cos(ang) * kick, ky = -Math.sin(ang) * kick;
    const ox = (kx - ky) * zoom, oy = ((kx + ky) / 2) * zoom;

    const vz = zoom * unitVisScale(type);
    const dx = s.x - spr.anchorX * vz + ox, dy = s.y - spr.anchorY * vz + oy;
    const dw = spr.logicalWidth * vz, dh = spr.logicalHeight * vz;
    ctx.drawImage(spr, dx, dy, dw, dh);

    let tur = null, tdx = 0, tdy = 0;
    if (type.turret) {
        const ta = unit.turretAngle ?? ang;
        const tdir = IsoSprites.dirFromAngle(ta);
        tur = IsoSprites.turretSprite(unit.type, faction, tdir, team);
        const m = IsoSprites.turretMount(unit.type, faction);
        const mx = m.ox * Math.cos(ang), my = m.ox * Math.sin(ang);
        const tk = rc * 0.5;
        const tkx = -Math.cos(ta) * tk, tky = -Math.sin(ta) * tk;
        tdx = s.x + (mx - my + tkx - tky) * vz - tur.anchorX * vz;
        tdy = s.y + ((mx + my) / 2 - m.z + (tkx + tky) / 2) * vz - tur.anchorY * vz;
        ctx.drawImage(tur, tdx, tdy, tur.logicalWidth * vz, tur.logicalHeight * vz);
    }

    // hit flash
    if (unit._hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = unit._hitFlash / 10;
        ctx.drawImage(spr, dx, dy, dw, dh);
        if (tur) ctx.drawImage(tur, tdx, tdy, tur.logicalWidth * vz, tur.logicalHeight * vz);
        ctx.restore();
        unit._hitFlash--;
    }

    if (isSelected && game.selection.length === 1 && own) {
        drawRangeRing(unit.x, unit.y, rangeT(type), 'rgba(255,170,90,0.45)');
    }
}

// Health bar, veterancy chevrons and control-group tag
function drawEntityOverlay(e) {
    const isUnit = !!UNIT_TYPES[e.type];
    const type = UNIT_TYPES[e.type] || BUILDING_TYPES[e.type];
    if (!type) return;
    const selected = game.selection.includes(e);
    const hovered = game.hover === e;
    const damaged = e.hp < type.hp;
    const showAll = keys['Alt'];
    if (!(selected || hovered || damaged || showAll || e.isUnderConstruction)) return;
    if (e.playerId !== 0 && !isVisible(e.x, e.y)) return;

    const zoom = getZoom();
    const s = worldToScreen(e.x, e.y);
    const k = Math.max(0.85, Math.min(1.3, zoom));
    let w, y;
    if (isUnit) {
        w = (type.category === 'infantry' ? 20 : 14 + type.size * 1.3) * k;
        y = s.y - (type.category === 'infantry' ? 32 : 18 + type.size * 1.25) * zoom - 6;
    } else {
        w = (24 + type.size * 14) * k;
        y = s.y - (26 + type.size * 16) * zoom;
    }
    const h = Math.max(3, 4 * k);
    const x = s.x - w / 2;
    const pct = e.isUnderConstruction ? e.buildProgress / e.buildTime : Math.max(0, e.hp / type.hp);

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#1b1d1f';
    ctx.fillRect(x, y, w, h);
    let col;
    if (e.isUnderConstruction) col = '#ffb030';
    else if (e.playerId !== 0) col = pct > 0.5 ? '#ff4a3a' : '#ff8a3a';
    else col = pct > 0.6 ? '#4ee06a' : pct > 0.3 ? '#ffc93a' : '#ff4a4a';
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * pct, h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x, y, w * pct, Math.max(1, h * 0.35));
    // segment ticks: one per 100 hp (readable unit "weight")
    const seg = isUnit ? 50 : 250;
    if (type.hp / seg <= 16) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        for (let i = 1; i < type.hp / seg; i++) ctx.fillRect(x + w * (i * seg / type.hp), y, 1, h);
    }

    // production / research progress under the building's bar
    if (!isUnit && e.playerId === 0) {
        let p = -1, c = '#3fa9ff';
        if (e.productionQueue && e.productionQueue.length) p = e.produceProgress / Math.max(1, e.produceTime);
        else if (e.researching) { p = e.researching.progress / e.researching.time; c = '#c58bff'; }
        if (p >= 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(x - 1, y + h + 2, w + 2, 4);
            ctx.fillStyle = e.capBlocked ? '#ff4a4a' : c;
            ctx.fillRect(x, y + h + 3, w * p, 2);
        }
        if (e.type === 'derrick' && e.oilStart) {
            const left = Math.max(0, (e.oilLeft || 0) / e.oilStart);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(x - 1, y + h + 2, w + 2, 4);
            ctx.fillStyle = left > 0 ? '#e8c45a' : '#5a4628';
            ctx.fillRect(x, y + h + 3, w * left, 2);
        }
    }

    if (isUnit) {
        const rank = veterancyRank(e.kills);
        if (rank > 0) {
            ctx.fillStyle = '#ffd14a';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            for (let i = 0; i < rank; i++) {
                const cx = x + w + 5 + i * 5, cy = y + h / 2;
                ctx.beginPath();
                ctx.moveTo(cx - 3, cy + 2); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx + 3, cy + 2); ctx.lineTo(cx, cy);
                ctx.closePath();
                ctx.stroke(); ctx.fill();
            }
        }
        if (e.group && e.playerId === 0 && (selected || showAll)) {
            ctx.font = `bold ${Math.round(10 * k)}px Bahnschrift, Arial`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText(e.group, x - 3 + 1, y + h / 2 + 1);
            ctx.fillStyle = '#e9e4da';
            ctx.fillText(e.group, x - 3, y + h / 2);
        }
    }
}

// Rally lines for the selected producer and order paths for selected units
function drawRallyAndPaths() {
    const zoom = getZoom();
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -(Date.now() / 50) % 10;
    ctx.lineWidth = 1.2;
    for (const e of game.selection) {
        if (e.playerId !== 0) continue;
        if (BUILDING_TYPES[e.type] && e.rallyX !== undefined) {
            const a = worldToScreen(e.x, e.y), b = worldToScreen(e.rallyX, e.rallyY);
            ctx.strokeStyle = 'rgba(93,255,122,0.55)';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#d8d8cc'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - 16 * zoom); ctx.stroke();
            ctx.fillStyle = '#5dff7a';
            ctx.beginPath(); ctx.moveTo(b.x, b.y - 16 * zoom); ctx.lineTo(b.x + 10 * zoom, b.y - 12.5 * zoom); ctx.lineTo(b.x, b.y - 9 * zoom); ctx.closePath(); ctx.fill();
            ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
        } else if (UNIT_TYPES[e.type]) {
            const pts = [];
            if (e.attackTarget && isAlive(e.attackTarget)) pts.push([e.attackTarget.x, e.attackTarget.y, '#ff5544']);
            else if (e.targetX !== undefined) pts.push([e.targetX, e.targetY, e.attackMove ? '#ffaa33' : '#5dff7a']);
            for (const wp of e.waypoints || []) pts.push([wp.x, wp.y, wp.attackMove ? '#ffaa33' : '#5dff7a']);
            let a = worldToScreen(e.x, e.y);
            for (const [x, y, c] of pts) {
                const b = worldToScreen(x, y);
                ctx.strokeStyle = IsoSprites.withAlpha(c, 0.4);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                a = b;
            }
        }
    }
    ctx.restore();
}

// ============================================
// PROJECTILES
// ============================================

function drawProjectile(proj) {
    if (!isVisible(proj.x, proj.y) && !isVisible(proj.aimX, proj.aimY)) return;
    const zoom = getZoom();
    const s = worldToScreen(proj.x, proj.y);
    const faction = proj.faction || 'survivors';
    const energy = faction === 'series9';
    const glowCol = energy ? '#4dffa6' : (faction === 'evolved' ? '#b8ff7a' : '#ffcc66');
    const z = (proj.z || 0) * zoom;
    // screen-space velocity direction
    const v = worldToScreen(proj.x + (proj.vx || 0), proj.y + (proj.vy || 0));
    let vx = v.x - s.x, vy = v.y - s.y;
    const vl = Math.hypot(vx, vy) || 1;
    vx /= vl; vy /= vl;
    const sx = s.x, sy = s.y - z;

    ctx.save();
    switch (proj.weapon) {
        case 'flame': {
            const cols = energy ? ['#c4ffda', '#7dffb0', '#2fbf7a'] : ['#fff1b8', '#ffab3a', '#ff5a14'];
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 4; i++) {
                const r = (6 + i * 2.5) * zoom;
                const tx = sx - vx * i * 7 * zoom + (Math.random() - 0.5) * 4 * zoom;
                const ty = sy - vy * i * 7 * zoom + (Math.random() - 0.5) * 4 * zoom;
                ctx.globalAlpha = 0.75 - i * 0.15;
                ctx.drawImage(FxTex.glow(cols[Math.min(2, i)]), tx - r, ty - r, r * 2, r * 2);
            }
            break;
        }
        case 'rocket': {
            ctx.strokeStyle = faction === 'evolved' ? '#d8cfae' : '#4a4d44';
            ctx.lineWidth = 2.6 * zoom;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - vx * 7 * zoom, sy - vy * 7 * zoom); ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            const r = 7 * zoom;
            ctx.drawImage(FxTex.glow('#ff9a3a'), sx - vx * 8 * zoom - r, sy - vy * 8 * zoom - r, r * 2, r * 2);
            // smoke trail puffs
            if (Math.random() < 0.7) {
                game.particles.push({
                    x: proj.x - (proj.vx || 0) * 1.5, y: proj.y - (proj.vy || 0) * 1.5, z: proj.z || 8,
                    vx: 0, vy: 0, vz: 0.05, color: '#9a9488', size: 3 + Math.random() * 2, life: 0.8, decay: 0.03,
                    type: 'smoke', grow: 2
                });
            }
            break;
        }
        case 'cannon': {
            if (energy) {
                ctx.globalCompositeOperation = 'lighter';
                const len = 22 * zoom;
                const g = ctx.createLinearGradient(sx, sy, sx - vx * len, sy - vy * len);
                g.addColorStop(0, '#eafff4');
                g.addColorStop(0.3, glowCol);
                g.addColorStop(1, 'rgba(77,255,166,0)');
                ctx.strokeStyle = g;
                ctx.lineWidth = 3.5 * zoom;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - vx * len, sy - vy * len); ctx.stroke();
                const r = 8 * zoom;
                ctx.drawImage(FxTex.glow(glowCol), sx - r, sy - r, r * 2, r * 2);
            } else {
                ctx.globalCompositeOperation = 'lighter';
                const len = 16 * zoom;
                const g = ctx.createLinearGradient(sx, sy, sx - vx * len, sy - vy * len);
                g.addColorStop(0, 'rgba(255,230,160,0.95)');
                g.addColorStop(1, 'rgba(255,140,40,0)');
                ctx.strokeStyle = g;
                ctx.lineWidth = 2.6 * zoom;
                ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - vx * len, sy - vy * len); ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = faction === 'evolved' ? '#e4dcc0' : '#fff6d8';
                ctx.beginPath(); ctx.arc(sx, sy, 1.8 * zoom, 0, Math.PI * 2); ctx.fill();
            }
            break;
        }
        case 'arty': {
            // ground marker: where it will land (only for the player's own view)
            const tgt = worldToScreen(proj.aimX, proj.aimY);
            if (isVisible(proj.aimX, proj.aimY)) {
                const p = proj.progress || 0;
                ctx.strokeStyle = `rgba(255,80,50,${0.25 + p * 0.5})`;
                ctx.lineWidth = 1.2;
                const rr = (proj.splash || 1) * 32 * Math.SQRT2 * zoom * (1.3 - p * 0.3);
                ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y, rr, rr * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
            }
            // shell shadow on the ground
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(s.x, s.y, 3 * zoom, 1.5 * zoom, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'lighter';
            const shellCol = energy ? glowCol : (faction === 'evolved' ? '#c8f07a' : '#ffaa44');
            const r = 9 * zoom;
            ctx.drawImage(FxTex.glow(shellCol), sx - r, sy - r, r * 2, r * 2);
            if (Math.random() < 0.6) {
                game.particles.push({
                    x: proj.x, y: proj.y, z: proj.z || 0, vx: 0, vy: 0, vz: 0.02,
                    color: faction === 'evolved' ? '#7a8a5a' : '#8a8478', size: 3, life: 0.7, decay: 0.03, type: 'smoke', grow: 1.8
                });
            }
            break;
        }
        default: {
            // tracer: bright streak; bone needles for Evolved, energy dashes for Series 9
            const len = (proj.weapon === 'hmg' ? 15 : 11) * zoom;
            const col = energy ? glowCol : (faction === 'evolved' ? '#efe4c0' : '#ffe39a');
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(sx, sy, sx - vx * len, sy - vy * len);
            g.addColorStop(0, col);
            g.addColorStop(1, 'rgba(255,200,100,0)');
            ctx.strokeStyle = g;
            ctx.lineWidth = (proj.weapon === 'hmg' ? 2.2 : 1.6) * zoom;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - vx * len, sy - vy * len); ctx.stroke();
        }
    }
    ctx.restore();
}

// ============================================
// PARTICLES
// ============================================

function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        if (p.grav) p.vz -= p.grav;
        if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
        p.life -= p.decay || 0.02;
        if (p.life <= 0 || (p.grav && p.z < 0)) {
            if (p.grav && p.z < 0 && p.splat) {
                addDecal({ type: 'splat', x: p.x, y: p.y, life: 14, size: 1.4, color: p.splat, drops: [] });
            }
            game.particles.splice(i, 1);
        }
    }
    if (game.particles.length > 650) game.particles.splice(0, game.particles.length - 650);
}

function drawParticles() {
    const zoom = getZoom();
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    // two passes: soft (normal blending) then glowing (additive)
    for (const additive of [false, true]) {
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
        for (const p of game.particles) {
            if (p.type === 'light') continue;
            if (ADDITIVE_FX.has(p.type) !== additive) continue;
            const s = worldToScreen(p.x, p.y);
            const sy = s.y - p.z * zoom;
            if (s.x < -60 || s.x > cw + 60 || sy < -80 || sy > ch + 60) continue;
            if (!isVisible(p.x, p.y)) continue;
            const life = Math.max(0, Math.min(1, p.life));
            switch (p.type) {
                case 'smoke':
                case 'dust': {
                    const r = p.size * zoom * (1 + (1 - life) * (p.grow || 1.2));
                    ctx.globalAlpha = life * (p.type === 'dust' ? 0.45 : 0.6);
                    ctx.drawImage(FxTex.puff(p.color), s.x - r, sy - r, r * 2, r * 2);
                    break;
                }
                case 'fire':
                case 'explosion': {
                    const r = p.size * zoom * (0.6 + (1 - life) * (p.grow || 0.8));
                    ctx.globalAlpha = Math.min(1, life * 1.4);
                    ctx.drawImage(FxTex.glow(life > 0.55 ? '#ffd27a' : p.color), s.x - r, sy - r, r * 2, r * 2);
                    break;
                }
                case 'flash':
                case 'muzzle': {
                    const r = p.size * zoom * (1 + (1 - life) * 0.6);
                    ctx.globalAlpha = life;
                    ctx.drawImage(FxTex.glow(p.color), s.x - r, sy - r, r * 2, r * 2);
                    break;
                }
                case 'spark': {
                    ctx.globalAlpha = life;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = Math.max(1, p.size * zoom * 0.7);
                    const v = worldToScreen(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
                    ctx.beginPath();
                    ctx.moveTo(s.x, sy);
                    ctx.lineTo(v.x, v.y - (p.z - p.vz * 2.5) * zoom);
                    ctx.stroke();
                    break;
                }
                case 'debris': {
                    ctx.globalAlpha = Math.min(1, life * 2);
                    ctx.fillStyle = p.color;
                    ctx.save();
                    ctx.translate(s.x, sy);
                    ctx.rotate(p.life * 12 + p.x);
                    ctx.fillRect(-p.size * zoom / 2, -p.size * zoom / 2, p.size * zoom, p.size * zoom * 0.7);
                    ctx.restore();
                    break;
                }
                case 'shockwave': {
                    const r = ((1 - life) * (p.maxR || 30) + 4) * zoom;
                    ctx.globalAlpha = life * 0.55;
                    ctx.strokeStyle = p.color || '#ffd8a0';
                    ctx.lineWidth = 2.5 * zoom * life + 0.5;
                    ctx.beginPath();
                    ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                }
                default: {
                    ctx.globalAlpha = Math.min(1, life * 1.5);
                    ctx.fillStyle = p.color;
                    const r = p.size * zoom;
                    ctx.fillRect(s.x - r / 2, sy - r / 2, r, r);
                }
            }
        }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
}

// Explosion: flash, fireball, smoke column, sparks, debris, shockwave,
// ground light and screen shake. big = vehicle/building scale.
function createExplosion(x, y, big = false) {
    if (canvas) {
        const s = worldToScreen(x, y);
        if (s.x > -60 && s.x < canvas.offsetWidth + 60 && s.y > -60 && s.y < canvas.offsetHeight + 60) {
            game.shake = Math.min(10, (game.shake || 0) + (big ? 5 : 1.6));
        }
    }
    const P = game.particles;
    const k = big ? 1.6 : 1;
    P.push({ x, y, z: 6, vx: 0, vy: 0, vz: 0, color: '#fff2c0', size: 26 * k, life: 1, decay: 0.12, type: 'flash' });
    P.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, color: '#ff8a2a', size: 60 * k, life: 1, decay: 0.05, type: 'light' });
    const fireCols = ['#ff5a14', '#ff7a1e', '#ffa02e', '#ff6418'];
    for (let i = 0; i < (big ? 16 : 9); i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.004 + Math.random() * 0.018) * k;
        P.push({
            x: x + Math.cos(a) * 0.1, y: y + Math.sin(a) * 0.1, z: 3 + Math.random() * 6,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.3 + Math.random() * 0.7,
            color: fireCols[i % 4], size: (7 + Math.random() * 7) * k,
            life: 1, decay: 0.03 + Math.random() * 0.02, type: 'fire', grow: 0.9, drag: 0.94
        });
    }
    for (let i = 0; i < (big ? 12 : 6); i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.002 + Math.random() * 0.008) * k;
        P.push({
            x: x + (Math.random() - 0.5) * 0.4, y: y + (Math.random() - 0.5) * 0.4, z: 6 + Math.random() * 8,
            vx: Math.cos(a) * sp + 0.002, vy: Math.sin(a) * sp - 0.001, vz: 0.25 + Math.random() * 0.35,
            color: i % 3 ? '#2e2a26' : '#4a4540', size: (7 + Math.random() * 6) * k,
            life: 1, decay: 0.008 + Math.random() * 0.006, type: 'smoke', grow: 1.8, drag: 0.985
        });
    }
    for (let i = 0; i < (big ? 22 : 10); i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.025 + Math.random() * 0.06;
        P.push({
            x, y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1.2 + Math.random() * 2.4,
            color: ['#fff2a0', '#ffd060', '#ffa030'][i % 3], size: 1.2 + Math.random(),
            life: 1, decay: 0.035, type: 'spark', grav: 0.14
        });
    }
    if (big) {
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2, sp = 0.015 + Math.random() * 0.04;
            P.push({
                x, y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1.5 + Math.random() * 2.5,
                color: ['#3a2e24', '#4c4036', '#2a2420'][i % 3], size: 2 + Math.random() * 2.5,
                life: 1, decay: 0.02, type: 'debris', grav: 0.16
            });
        }
    }
    P.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, color: '#ffd8a0', maxR: big ? 64 : 32, life: 1, decay: 0.05, type: 'shockwave' });
    addDecal({ type: 'crater', x, y, life: 45, size: big ? 22 : 13 });
}

// Bullet/shell strike on hard targets
function createImpact(x, y, weapon) {
    const P = game.particles;
    const heavy = weapon === 'cannon' || weapon === 'rocket' || weapon === 'arty';
    if (heavy) {
        P.push({ x, y, z: 6, vx: 0, vy: 0, vz: 0, color: '#ffe0a0', size: 16, life: 1, decay: 0.14, type: 'flash' });
        P.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, color: '#ff8a2a', size: 30, life: 1, decay: 0.08, type: 'light' });
        for (let i = 0; i < 4; i++) {
            P.push({
                x, y, z: 6, vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.01, vz: 0.3 + Math.random() * 0.4,
                color: '#3a3632', size: 5 + Math.random() * 3, life: 1, decay: 0.02, type: 'smoke', grow: 1.5
            });
        }
        if (canvas) game.shake = Math.min(10, (game.shake || 0) + 0.6);
    }
    const n = heavy ? 8 : 4;
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.01 + Math.random() * 0.03;
        P.push({
            x, y, z: 5 + Math.random() * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.6 + Math.random() * 1.4,
            color: ['#fff2a0', '#ffd060', '#ffb040'][i % 3], size: 1, life: 1, decay: 0.06, type: 'spark', grav: 0.12
        });
    }
}

// Flesh hit: blood droplets (Series 9 leak dark hydraulic oil); big =
// kill burst with a lasting pool
function createBloodSpray(x, y, faction, big = false) {
    const oil = faction === 'series9';
    const colors = oil ? ['#20242c', '#2c313c', '#161a20'] : ['#8a1810', '#6e120c', '#a3251a'];
    const stain = oil ? 'rgba(30,34,40,0.45)' : 'rgba(96,20,14,0.42)';
    const n = big ? 14 : 5;
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.006 + Math.random() * (big ? 0.03 : 0.018);
        game.particles.push({
            x, y, z: 6 + Math.random() * 4,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.4 + Math.random() * (big ? 1.4 : 0.9),
            color: colors[i % 3], size: 1.4 + Math.random() * 1.4, life: 1, decay: 0.03,
            grav: 0.12, splat: Math.random() < 0.3 ? stain : null
        });
    }
    if (big) {
        addDecal({
            type: 'splat', x, y, life: 45, size: 8,
            color: oil ? 'rgba(30,34,40,0.7)' : 'rgba(96,20,14,0.7)',
            drops: Array.from({ length: 5 }, () => [(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 13, 1.5 + Math.random() * 2.5])
        });
    }
}

function createDustPuff(x, y) {
    for (let i = 0; i < 3; i++) {
        game.particles.push({
            x: x + (Math.random() - 0.5) * 0.2, y: y + (Math.random() - 0.5) * 0.2, z: 1,
            vx: (Math.random() - 0.5) * 0.006, vy: (Math.random() - 0.5) * 0.006, vz: 0.25 + Math.random() * 0.3,
            color: '#a8946e', size: 2.5 + Math.random() * 2, life: 1, decay: 0.04, type: 'dust', grow: 1.4
        });
    }
}

// ============================================
// DAMAGE NUMBERS
// ============================================

function drawDamageNumbers() {
    const zoom = getZoom();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const dmg of game.damageNumbers) {
        const s = worldToScreen(dmg.x, dmg.y);
        const y = s.y - 18 * zoom - dmg.offsetY;
        ctx.globalAlpha = Math.min(1, dmg.life * 2);
        const size = dmg.isCritical ? 15 : dmg.isWeak ? 10 : 12;
        ctx.font = `bold ${size}px Bahnschrift, 'Segoe UI', Arial`;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 3;
        const text = dmg.damage + (dmg.isCritical ? '!' : '');
        ctx.strokeText(text, s.x, y);
        ctx.fillStyle = dmg.isCritical ? '#ffe14a' : dmg.isWeak ? '#a8a8a0' : '#ff6a5a';
        ctx.fillText(text, s.x, y);
    }
    ctx.restore();
}

// ============================================
// MAP OBJECTS & OVERLAYS
// ============================================

function drawBunkers() {
    if (!game.bunkers) return;
    const zoom = getZoom();
    for (const b of game.bunkers) {
        if (tileFog(b.x, b.y) === 0) continue;
        const s = worldToScreen(b.x, b.y);
        if (s.x < -120 || s.x > canvas.offsetWidth + 120 || s.y < -140 || s.y > canvas.offsetHeight + 80) continue;
        const spr = IsoSprites.buildingSprite('bunker', 'survivors', b.claimed ? 1 : 0, '#66e0ff');
        ctx.drawImage(spr, s.x - spr.anchorX * zoom, s.y - spr.anchorY * zoom, spr.logicalWidth * zoom, spr.logicalHeight * zoom);
        if (!b.claimed) {
            const pulse = (Date.now() / 1200 + b.x) % 1;
            ctx.strokeStyle = `rgba(102,224,255,${0.75 * (1 - pulse)})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, (10 + pulse * 26) * zoom, (5 + pulse * 13) * zoom, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Order confirmation: chevrons converging on the click point
function drawOrderMarkers() {
    if (!game.orderMarkers) return;
    const zoom = getZoom();
    for (const m of game.orderMarkers) {
        const s = worldToScreen(m.x, m.y);
        const t = 1 - m.life;
        const col = m.kind === 'attack' ? '#ff5533' : m.kind === 'rally' ? '#5dff7a' : '#5dff7a';
        ctx.save();
        ctx.globalAlpha = Math.min(1, m.life * 1.4);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        const r = (16 - t * 10) * zoom;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            const d = (10 + (1 - t) * 10) * zoom;
            const px = s.x + Math.cos(a) * d, py = s.y + Math.sin(a) * d * 0.5;
            ctx.beginPath();
            ctx.moveTo(px - Math.cos(a - 0.6) * 5 * zoom, py - Math.sin(a - 0.6) * 2.5 * zoom);
            ctx.lineTo(px, py);
            ctx.lineTo(px - Math.cos(a + 0.6) * 5 * zoom, py - Math.sin(a + 0.6) * 2.5 * zoom);
            ctx.stroke();
        }
        ctx.restore();
    }
}

function addOrderMarker(x, y, kind) {
    if (!game.orderMarkers) game.orderMarkers = [];
    game.orderMarkers.push({ x, y, kind, life: 1 });
}

// Placement ghost: per-tile footprint (green = ok, red = blocked), the
// structure itself, its weapon range, and the reason when it can't go
function drawBuildingPreview(role) {
    const type = BUILDING_TYPES[role];
    if (!type) return;
    const zoom = getZoom();
    const w = screenToWorld(game.mouse.x, game.mouse.y);
    const t = placementTile(role, w.x, w.y);
    const reason = buildBlockReason(role, t.x, t.y, 0) || (game.players[0].oil < type.cost ? 'Not enough oil' : null);
    const ok = !reason;
    const r = footprintRect(role, t.x, t.y);

    for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) {
            const tile = game.map[y]?.[x];
            const bad = !tile || tile.type !== 'grass' || isTileBlocked(x, y) ||
                (!type.needsOil && tile.oil && (tile.oilAmount ?? 1) > 0);
            const c = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([a, b]) => worldToScreen(a, b));
            ctx.beginPath();
            c.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.closePath();
            ctx.fillStyle = (ok && !bad) ? 'rgba(80,255,120,0.22)' : 'rgba(255,70,60,0.3)';
            ctx.fill();
            ctx.strokeStyle = (ok && !bad) ? 'rgba(120,255,150,0.6)' : 'rgba(255,90,80,0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    const s = worldToScreen(r.cx, r.cy);
    const spr = IsoSprites.buildingSprite(role, getFaction(0), 0, teamColor(0));
    ctx.globalAlpha = ok ? 0.75 : 0.4;
    ctx.drawImage(spr, s.x - spr.anchorX * zoom, s.y - spr.anchorY * zoom, spr.logicalWidth * zoom, spr.logicalHeight * zoom);
    ctx.globalAlpha = 1;

    if (type.range) drawRangeRing(r.cx, r.cy, rangeT(type), ok ? 'rgba(120,255,150,0.6)' : 'rgba(255,90,80,0.6)');
    if (type.repairRadius) drawRangeRing(r.cx, r.cy, type.repairRadius, 'rgba(100,255,170,0.45)');

    if (reason) {
        ctx.save();
        ctx.font = 'bold 12px Bahnschrift, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(reason).width + 16;
        const ty = s.y + (type.size * 16 + 18) * zoom;
        ctx.fillStyle = 'rgba(20,6,4,0.85)';
        ctx.fillRect(s.x - tw / 2, ty - 10, tw, 20);
        ctx.fillStyle = '#ff8a7a';
        ctx.fillText(reason, s.x, ty);
        ctx.restore();
    }
}

// ---------- HUD text panels (canvas) ----------
function hudPanel(x, y, w, h, border) {
    ctx.fillStyle = 'rgba(12,13,16,0.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
}

function drawObjectives() {
    const obj = currentObjective();
    const flash = game.objectiveFlash && Date.now() < game.objectiveFlash.until ? game.objectiveFlash : null;
    if (!obj && !flash) return;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let y = 12;
    if (flash) {
        ctx.font = 'bold 13px Bahnschrift, Arial';
        const text = '✔  ' + flash.text;
        const w = ctx.measureText(text).width + 24;
        ctx.globalAlpha = Math.min(1, (flash.until - Date.now()) / 600);
        hudPanel(10, y, w, 26, 'rgba(78,224,106,0.8)');
        ctx.fillStyle = '#7cf094';
        ctx.fillText(text, 22, y + 13);
        ctx.globalAlpha = 1;
        y += 34;
    }
    if (obj) {
        ctx.font = 'bold 13px Bahnschrift, Arial';
        const w = ctx.measureText(obj.text).width + 26;
        hudPanel(10, y, w, 40, 'rgba(242,162,58,0.7)');
        ctx.fillStyle = '#f2a23a';
        ctx.font = 'bold 10px Bahnschrift, Arial';
        ctx.fillText('OBJECTIVE', 22, y + 11);
        ctx.font = 'bold 13px Bahnschrift, Arial';
        ctx.fillStyle = '#f3e6c8';
        ctx.fillText(obj.text, 22, y + 27);
    }
    ctx.restore();
}

function drawGuideArrow(wx, wy) {
    const zoom = getZoom();
    const s = worldToScreen(wx, wy);
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    const bob = Math.sin(Date.now() / 240) * 5;
    const onScreen = s.x > 30 && s.x < cw - 30 && s.y > 70 && s.y < ch - 40;
    let x = s.x, y = s.y, angle = Math.PI / 2;
    if (!onScreen) {
        angle = Math.atan2(s.y - ch / 2, s.x - cw / 2);
        x = Math.max(44, Math.min(cw - 44, s.x));
        y = Math.max(80, Math.min(ch - 50, s.y));
    }
    ctx.save();
    ctx.translate(x, y - (onScreen ? 36 * zoom + bob : 0));
    ctx.rotate(angle);
    ctx.fillStyle = '#ffcc44';
    ctx.strokeStyle = '#5a3e08';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 0); ctx.lineTo(-6, -10); ctx.lineTo(-2, 0); ctx.lineTo(-6, 10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (onScreen) {
        const pulse = (Date.now() / 900) % 1;
        ctx.strokeStyle = `rgba(255,204,68,${0.8 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, (10 + pulse * 18) * zoom, (5 + pulse * 9) * zoom, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawModeHint(text, color) {
    ctx.save();
    ctx.font = 'bold 13px Bahnschrift, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 32;
    const cx = canvas.offsetWidth / 2, cy = canvas.offsetHeight - 30;
    hudPanel(cx - w / 2, cy - 13, w, 26, color);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy + 1);
    ctx.restore();
}

function setBanner(text, seconds = 4, color = '#ffcc44') {
    game.banner = { text, color, until: Date.now() + seconds * 1000, start: Date.now() };
}

function drawBanner() {
    if (!game.banner || Date.now() > game.banner.until) return;
    const left = game.banner.until - Date.now();
    const age = Date.now() - (game.banner.start || 0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, left / 600, age / 150);
    ctx.font = 'bold 16px Bahnschrift, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(game.banner.text).width + 48;
    const cx = canvas.offsetWidth / 2;
    // sit below the objective panel when it shares the top edge
    const top = (currentObjective() && cx - w / 2 < 430) ? (game.objectiveFlash && Date.now() < game.objectiveFlash.until ? 100 : 62) : 14;
    const y = top + Math.max(0, 1 - age / 150) * -10;
    hudPanel(cx - w / 2, y, w, 32, game.banner.color);
    ctx.fillStyle = game.banner.color;
    ctx.fillRect(cx - w / 2, y, 3, 32);
    ctx.fillRect(cx + w / 2 - 3, y, 3, 32);
    ctx.fillText(game.banner.text, cx, y + 16);
    ctx.restore();
}

function drawHelpOverlay() {
    const sections = [
        ['ORDERS', [
            ['Left-click / drag', 'Select / box-select units'],
            ['Double-click', 'Select all of that type on screen'],
            ['Right-click', 'Move · attack target · set rally point'],
            ['Shift + right-click', 'Queue a waypoint'],
            ['A, then left-click', 'Attack-move (engage everything on the way)'],
            ['S / X', 'Stop'],
            ['Q  ·  F2 / Ctrl+A', 'Select idle army  ·  whole army']
        ]],
        ['CAMERA & GROUPS', [
            ['Ctrl+1-9 / 1-9', 'Assign / recall group (double-tap: center)'],
            ['Shift+1-9', 'Add selection to a group'],
            ['Wheel  ·  +/-', 'Zoom toward the cursor'],
            ['Arrows / edge / middle-drag', 'Scroll the map'],
            ['Minimap: left / right', 'Jump camera / send selected units'],
            ['H  ·  Space', 'Go to HQ  ·  go to last attack'],
            ['Alt (hold)', 'Show all health bars']
        ]],
        ['BASE', [
            ['Sidebar tabs (Tab)', 'Base · Infantry · Vehicles · Research'],
            ['W E R T D F G C V', 'Sidebar button hotkeys'],
            ['Right-click unit button', 'Cancel one queued unit (refund)'],
            ['Shift + place', 'Place several structures'],
            ['P / Esc', 'Pause  ·  F1 closes this help']
        ]]
    ];
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    const rowH = 21;
    const rows = sections.reduce((n, s) => n + s[1].length + 1.6, 0);
    const w = Math.min(620, cw - 30), h = rows * rowH + 50;
    const x = (cw - w) / 2, y = Math.max(10, (ch - h) / 2);
    ctx.save();
    hudPanel(x, y, w, h, 'rgba(242,162,58,0.7)');
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Bahnschrift, Arial';
    ctx.fillStyle = '#f2a23a';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', cw / 2, y + 22);
    let ly = y + 46;
    const split = x + w * 0.42;
    for (const [title, lines] of sections) {
        ctx.textAlign = 'left';
        ctx.font = 'bold 11px Bahnschrift, Arial';
        ctx.fillStyle = '#8a857a';
        ctx.fillText(title, x + 18, ly);
        ly += rowH * 0.9;
        for (const [k, v] of lines) {
            ctx.textAlign = 'right';
            ctx.font = 'bold 13px Bahnschrift, Arial';
            ctx.fillStyle = '#ffd890';
            ctx.fillText(k, split, ly);
            ctx.textAlign = 'left';
            ctx.font = '13px Bahnschrift, Arial';
            ctx.fillStyle = '#d8d4cc';
            ctx.fillText(v, split + 14, ly);
            ly += rowH;
        }
        ly += rowH * 0.6;
    }
    ctx.restore();
}

// ============================================
// HOVER INFO (desktop): German description of the unit / building
// under the mouse - what it is, what it brings, strengths, weaknesses.
// Appears after a short delay so it never flickers during play.
// ============================================
const HoverTip = { el: null, target: null, since: 0, key: '' };

function hoverTipTarget() {
    if (document.body.classList.contains('touch-device')) return null;
    if (!game.mouse.inside || game.status !== 'PLAYING' || game.placingBuilding || game.selectionBox || game.showHelp) return null;
    if (game.hover && isAlive(game.hover)) return game.hover;
    // tech bunkers aren't entities - test them by distance
    const w = screenToWorld(game.mouse.x, game.mouse.y);
    const b = (game.bunkers || []).find(b => tileFog(b.x, b.y) !== 0 && Math.hypot(b.x - w.x, b.y - w.y) < 1.1);
    return b ? { bunker: b } : null;
}

function hoverTipHTML(e) {
    if (e.bunker) {
        return `<div class="ht-title">Tech-Bunker <span class="ht-tag neutral">neutral</span></div>` +
            `<div class="ht-role">Kartenobjekt</div>` +
            (e.bunker.claimed
                ? `<div class="ht-desc">Bereits geplündert.</div>`
                : `<div class="ht-desc">Schicke eine beliebige Einheit hierher.</div><div class="ht-use">Belohnung: Öl, gestrandete Einheiten oder Kampfdaten, die Einheiten in der Nähe befördern. Die KI will ihn auch!</div>`);
    }
    const isUnit = !!UNIT_TYPES[e.type];
    const type = UNIT_TYPES[e.type] || BUILDING_TYPES[e.type];
    const info = (isUnit ? UNIT_INFO_DE : BUILDING_INFO_DE)[e.type] || { role: '', desc: '', use: '' };
    const faction = getFaction(e.playerId);
    const name = isUnit ? unitDisplayName(e.type, faction) : buildingDisplayName(e.type, faction);
    const tag = e.playerId === 0 ? '<span class="ht-tag own">eigene</span>'
        : e.playerId === 1 ? '<span class="ht-tag enemy">Feind</span>'
        : '<span class="ht-tag neutral">Plünderer</span>';
    let html = `<div class="ht-title">${name} ${tag}</div><div class="ht-role">${info.role}</div>`;
    html += `<div class="ht-desc">${info.desc}</div><div class="ht-use">${info.use}</div>`;

    const hp = e.isUnderConstruction ? null : `${Math.ceil(Math.max(0, e.hp))}/${type.hp}`;
    const stats = [];
    if (hp) stats.push(`Leben <b>${hp}</b>`);
    if (type.damage) stats.push(`Schaden <b>${type.damage}</b>`);
    if (type.range) stats.push(`Reichweite <b>${(type.range / 24).toFixed(1)}</b>`);
    if (isUnit) stats.push(`Tempo <b>${(type.speed * 60).toFixed(1)}</b>`);
    if (stats.length) html += `<div class="ht-stats">${stats.join(' · ')}</div>`;

    const weapon = WEAPON_CLASS[e.type];
    if (weapon && WEAPON_VS[weapon]) {
        const row = WEAPON_VS[weapon];
        const strong = Object.keys(row).filter(k => row[k] >= 1.2).map(k => ARMOR_DE[k]);
        const weak = Object.keys(row).filter(k => row[k] <= 0.6).map(k => ARMOR_DE[k]);
        if (strong.length) html += `<div class="ht-good">▲ Stark gegen ${strong.join(', ')}</div>`;
        if (weak.length) html += `<div class="ht-bad">▼ Schwach gegen ${weak.join(', ')}</div>`;
    }
    if (type.overWalls) html += `<div class="ht-good">▲ Schießt über Felswände</div>`;

    // live status for own structures and units
    if (e.playerId === 0) {
        if (e.isUnderConstruction) html += `<div class="ht-status">Im Bau: ${Math.round(e.buildProgress / e.buildTime * 100)} %</div>`;
        else if (e.productionQueue && e.productionQueue.length) {
            html += `<div class="ht-status">Produziert: ${unitDisplayName(e.productionQueue[0].type, faction)} (${Math.round(e.produceProgress / Math.max(1, e.produceTime) * 100)} %)` +
                (e.productionQueue.length > 1 ? ` · +${e.productionQueue.length - 1} in der Warteschlange` : '') + `</div>`;
        } else if (e.researching) {
            html += `<div class="ht-status">Forscht: Tech-Stufe ${e.researching.level} (${Math.round(e.researching.progress / e.researching.time * 100)} %)</div>`;
        }
        if (e.type === 'derrick' && e.oilLeft !== undefined) html += `<div class="ht-status">Ölreserve: ${Math.floor(e.oilLeft)}</div>`;
        const rank = isUnit ? veterancyRank(e.kills) : 0;
        if (rank) html += `<div class="ht-status">${'★'.repeat(rank)} Veteran · +${rank * 15} % Schaden</div>`;
        if (!isUnit && type.produces && type.produces.length) html += `<div class="ht-hint">Klick: auswählen · Einheiten über die Seitenleiste ausbilden</div>`;
        else if (isUnit) html += `<div class="ht-hint">Klick: auswählen · Doppelklick: alle dieses Typs</div>`;
    } else if (game.selection.some(s => s.playerId === 0 && UNIT_TYPES[s.type])) {
        html += `<div class="ht-hint">Rechtsklick: ausgewählte Einheiten greifen an</div>`;
    }
    return html;
}

function updateHoverTip() {
    if (!HoverTip.el) {
        HoverTip.el = document.createElement('div');
        HoverTip.el.className = 'hover-tip';
        document.body.appendChild(HoverTip.el);
    }
    const t = hoverTipTarget();
    const id = t ? (t.bunker ? 'b' + t.bunker.x + ',' + t.bunker.y : t.id) : null;
    const now = performance.now();
    if (id !== HoverTip.target) {
        HoverTip.target = id;
        HoverTip.since = now;
        HoverTip.el.style.display = 'none';
        return;
    }
    if (!t || now - HoverTip.since < 450) return;
    // refresh contents a few times per second (live HP / progress)
    if (now - (HoverTip.lastFill || 0) > 250 || HoverTip.el.style.display === 'none') {
        HoverTip.lastFill = now;
        const html = hoverTipHTML(t);
        if (html !== HoverTip.key) { HoverTip.key = html; HoverTip.el.innerHTML = html; }
    }
    HoverTip.el.style.display = 'block';
    const rect = canvas.getBoundingClientRect();
    const tw = HoverTip.el.offsetWidth, th = HoverTip.el.offsetHeight;
    let x = rect.left + game.mouse.x + 18, y = rect.top + game.mouse.y + 20;
    if (x + tw > rect.right - 6) x = rect.left + game.mouse.x - tw - 14;
    if (y + th > rect.bottom - 6) y = rect.top + game.mouse.y - th - 12;
    HoverTip.el.style.left = Math.max(4, x) + 'px';
    HoverTip.el.style.top = Math.max(4, y) + 'px';
}
