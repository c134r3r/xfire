# Tripo3D Asset Generation Prompts for XFire RTS

## Important Notes for All Assets

**Style consistency:** All assets should follow a **stylized low-poly military** aesthetic — clean geometric shapes, flat or lightly shaded surfaces, no photorealism. Think "Command & Conquer meets low-poly art."

**Rotation handling:** The game engine rotates unit sprites at runtime using `ctx.rotate(angle)`. This means:
- **Units** need a single **top-down view** (bird's eye / directly from above) so rotation looks correct in all directions
- **Buildings** are NOT rotated — they use an **isometric 3/4 view** (45-degree angle, viewed from above-front)

**Export settings:**
- Render to PNG with transparent background
- Units: 64x64 px (centered in frame)
- Buildings: 96x96 px or 128x128 px (centered in frame)
- Use neutral gray/green base colors (team colors blue/red are applied at runtime)

---

## UNIT PROMPTS (Top-Down View)

All units must be rendered from a **direct top-down / bird's eye view** so they look correct when the engine rotates them to face any direction. The "front" of the unit should point **to the right** in the exported image.

---

### 1. Infantry
```
A single soldier seen from directly above (top-down bird's eye view), low-poly stylized military style. The soldier wears a helmet and carries an assault rifle pointing to the right. Visible details: helmet, shoulders, backpack, rifle barrel extending forward. Muted olive-green uniform. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 2. Scout
```
A lightweight recon soldier seen from directly above (top-down bird's eye view), low-poly stylized military style. Slim figure, light armor, wearing a beret or light helmet, carrying a small submachine gun pointing to the right. Has binoculars strapped to chest. Faster/lighter appearance than standard infantry. Muted olive-green uniform. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 3. Rocket Soldier
```
A heavy infantry soldier seen from directly above (top-down bird's eye view), low-poly stylized military style. Bulkier than standard infantry, carrying a large rocket launcher / RPG tube on the right shoulder, pointing to the right. Visible ammo pack on back. Muted olive-green with orange-tipped rocket warhead. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 4. Light Tank
```
A small fast attack tank seen from directly above (top-down bird's eye view), low-poly stylized military style. Compact hull with a small rotating turret, short cannon barrel pointing to the right. Visible tank treads on both sides. Sleek and nimble-looking design. Muted military green-gray color. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 5. Battle Tank (Medium Tank)
```
A medium main battle tank seen from directly above (top-down bird's eye view), low-poly stylized military style. Solid rectangular hull, medium-sized turret with a long cannon barrel pointing to the right. Clearly visible tank treads. Thicker armor plating than the light tank. Muted military olive-green color. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 6. Heavy Tank
```
A massive heavy assault tank seen from directly above (top-down bird's eye view), low-poly stylized military style. Wide imposing hull, large heavily-armored turret with a thick long cannon barrel pointing to the right. Thick visible tank treads. Extra armor plates and reinforced design. Muted dark military green. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 7. Harvester
```
A large industrial resource harvester vehicle seen from directly above (top-down bird's eye view), low-poly stylized military style. Wide oval/rectangular body with a front-mounted mining scoop or drill arm pointing to the right. Visible storage container on top, heavy treads or wheels. Yellow-green industrial color with hazard striping. Unarmed utility vehicle. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 8. Artillery
```
A self-propelled artillery vehicle seen from directly above (top-down bird's eye view), low-poly stylized military style. Tracked vehicle base with a long-barreled artillery cannon pointing to the right. The barrel should be noticeably longer than any tank. Visible stabilizer legs/outriggers on the sides. Muted military green-gray. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

### 9. Flak Cannon
```
A mobile anti-aircraft vehicle seen from directly above (top-down bird's eye view), low-poly stylized military style. Tracked or wheeled vehicle with a rapid-fire quad-barrel flak gun turret on top, barrels pointing to the right. The four barrels are the distinctive feature. Muted military green. Clean geometric shapes, no background, transparent background, game asset sprite, 64x64 pixels.
```

---

## BUILDING PROMPTS (Isometric 3/4 View)

All buildings should be rendered from an **isometric 3/4 perspective** (camera at ~45 degrees above, looking down at ~30-degree angle). Buildings do NOT rotate in-game, so the view angle is fixed.

---

### 1. HQ (Headquarters)
```
A military headquarters command building, isometric 3/4 view from above, low-poly stylized military style. Large fortified structure with a command tower, radar dish on the roof, antenna, and a flag pole. Reinforced concrete walls with armored doors. The most important-looking building on the base. Muted military gray-green. Clean geometric shapes, no background, transparent background, game asset sprite, 128x128 pixels.
```

### 2. Barracks
```
A military barracks training facility, isometric 3/4 view from above, low-poly stylized military style. Long rectangular building with a corrugated metal roof, multiple small windows, front entrance with double doors, and a training dummy or shooting target visible nearby. Muted military green with tan accents. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 3. Factory (Vehicle Factory)
```
A military vehicle factory, isometric 3/4 view from above, low-poly stylized military style. Large industrial building with a tall smokestack, large garage door opening at the front, assembly crane visible on the roof, and industrial details like pipes and vents. Heavy reinforced walls. Muted industrial gray-green. Clean geometric shapes, no background, transparent background, game asset sprite, 128x128 pixels.
```

### 4. Derrick (Oil Pump)
```
A military oil derrick / pump jack, isometric 3/4 view from above, low-poly stylized military style. Classic oil pumpjack with a triangular support frame, rocking beam on top, counterweight, and a small concrete base pad. Oil barrel or pipe visible at ground level. Dark metallic gray with yellow-orange hazard markings. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 5. Turret (Cannon Turret)
```
A defensive gun turret emplacement, isometric 3/4 view from above, low-poly stylized military style. Round or octagonal concrete bunker base with a rotating gun turret on top featuring a medium cannon barrel. Sandbags around the base. Armored and compact. Muted military green-gray. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 6. Rifle Turret
```
A light defensive machine gun turret, isometric 3/4 view from above, low-poly stylized military style. Smaller than the cannon turret, with a twin machine gun / gatling gun mounted on a rotating platform atop a small bunker. Red targeting light visible. Anti-infantry purpose clear from the rapid-fire weapon design. Muted military green-gray. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 7. Missile Turret
```
A heavy anti-vehicle missile turret, isometric 3/4 view from above, low-poly stylized military style. Fortified platform base with twin missile launcher tubes angled upward, each with a visible missile warhead (orange-tipped). Larger and more imposing than the cannon turret. Muted military green with orange missile tips. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 8. Research Lab
```
A military research laboratory building, isometric 3/4 view from above, low-poly stylized military style. Modern-looking facility with a flat roof, satellite dishes, glowing computer screens visible through windows (blue/green glow), and scientific antenna equipment on the roof. Sterile white-gray walls with green accent lights. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 9. Power Plant
```
A military power generation facility, isometric 3/4 view from above, low-poly stylized military style. Industrial building with two cooling towers or exhaust stacks, visible power cables or transformer box, and a glowing yellow lightning bolt symbol on the front. Generator equipment on the roof. Gray concrete with yellow energy accents. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 10. Academy
```
A military training academy building, isometric 3/4 view from above, low-poly stylized military style. Classical-looking military structure with a columned entrance, triangular pediment roof, a star or shield emblem on the front, and a parade ground feel. Training flags or banners. Muted tan-gray stone with blue accent trim. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

### 11. Tech Lab
```
A military technology laboratory, isometric 3/4 view from above, low-poly stylized military style. High-tech facility with a dome or curved roof section, radar arrays, glowing cyan/teal energy conduits visible on the exterior, and an advanced futuristic look compared to other buildings. Represents advanced vehicle research. Dark gray with glowing cyan tech accents. Clean geometric shapes, no background, transparent background, game asset sprite, 96x96 pixels.
```

---

## FILE NAMING & PLACEMENT

After generating and downloading assets from Tripo3D, render/screenshot them and save as:

```
assets/
├── units/
│   ├── infantry.png         (64x64, top-down, facing right)
│   ├── scout.png            (64x64, top-down, facing right)
│   ├── rocketSoldier.png    (64x64, top-down, facing right)
│   ├── lightTank.png        (64x64, top-down, facing right)
│   ├── mediumTank.png       (64x64, top-down, facing right)
│   ├── heavyTank.png        (64x64, top-down, facing right)
│   ├── harvester.png        (64x64, top-down, facing right)
│   ├── artillery.png        (64x64, top-down, facing right)
│   └── flak.png             (64x64, top-down, facing right)
└── buildings/
    ├── hq.png               (128x128, isometric 3/4)
    ├── barracks.png          (96x96, isometric 3/4)
    ├── factory.png           (128x128, isometric 3/4)
    ├── derrick.png           (96x96, isometric 3/4)
    ├── turret.png            (96x96, isometric 3/4)
    ├── rifleTurret.png       (96x96, isometric 3/4)
    ├── missileTurret.png     (96x96, isometric 3/4)
    ├── researchLab.png       (96x96, isometric 3/4)
    ├── powerPlant.png        (96x96, isometric 3/4)
    ├── academy.png           (96x96, isometric 3/4)
    └── techLab.png           (96x96, isometric 3/4)
```

## TIPS FOR TRIPO3D

1. **Generate the 3D model** using the prompts above
2. **Position the camera** correctly before exporting:
   - **Units:** Set camera directly above looking straight down (top-down orthographic)
   - **Buildings:** Set camera at ~45-degree elevation, ~30-degree depression (isometric)
3. **Export/screenshot** with transparent background
4. **Resize** to the specified pixel dimensions
5. **Team colors:** Keep assets in neutral gray/green — the game engine tints them blue or red automatically. Alternatively, create `_blue` and `_red` variants for each asset.
6. **Consistency:** Generate all assets in one session or with the same style seed to maintain visual consistency across the set.
