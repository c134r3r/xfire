# XFire Assets Directory

This directory contains sprite graphics for the XFire RTS game.

## Directory Organization

```
assets/
├── units/          # Sprite files for game units
├── buildings/      # Sprite files for buildings
├── terrain/        # Sprite files for terrain tiles
└── effects/        # Sprite files for visual effects
```

## Getting Started

### Option 1: Use Placeholder Graphics (Default)

The game automatically generates colored placeholders for testing. No files needed!

### Option 2: Add Custom Sprites

1. **Create PNG files** with your sprite graphics
2. **Place them in appropriate subdirectories**:
   - `units/infantry.png`, `units/tank.png`, etc.
   - `buildings/hq.png`, `buildings/barracks.png`, etc.

3. **Supported unit sprite names**:
   - `infantry.png`
   - `tank.png`
   - `harvester.png`
   - `artillery.png`
   - `scout.png`
   - `rocketSoldier.png`

4. **Supported building sprite names**:
   - `hq.png`
   - `barracks.png`
   - `factory.png`
   - `derrick.png`
   - `turret.png`
   - `powerPlant.png`

## Free Asset Sources

### PixVoxel Wargame Sprites (Recommended)
- **Best match for XFire**
- URL: https://opengameart.org/content/pixvoxel-colorful-isometric-wargame-sprites
- Download isometric sprites and extract PNG files
- Color code: Name files `unitname_blue.png` and `unitname_red.png` for teams

### OpenGameArt.org
- Huge collection of free game assets
- Search for "isometric", "tanks", "buildings"
- Most assets are CC-licensed (check individual licenses)

### Itch.io
- Many free game asset packs
- Filter by "free", "isometric", and "game assets"
- Various licenses - check before use

### Game Art Guppy
- Free Isometric Army pack
- Includes tanks, soldiers, explosions
- Good starting point for beginners

## Implementation Steps

### Step 1: Download Assets
Choose one of the sources above and download sprite graphics.

### Step 2: Extract and Organize
```bash
# Example directory structure after adding assets
assets/
├── units/
│   ├── infantry.png      (64x64 pixels recommended)
│   ├── tank.png
│   ├── harvester.png
│   ├── artillery.png
│   ├── scout.png
│   └── rocketSoldier.png
└── buildings/
    ├── hq.png            (96x96 pixels recommended)
    ├── barracks.png
    ├── factory.png
    ├── derrick.png
    ├── turret.png
    └── powerPlant.png
```

### Step 3: Update Asset Loader
In `game-engine.js`, create a function to load your assets:

```javascript
async function loadCustomAssets() {
    const assetList = [
        // Units
        { path: 'assets/units/infantry.png', category: 'units', name: 'infantry' },
        { path: 'assets/units/tank.png', category: 'units', name: 'tank' },
        { path: 'assets/units/harvester.png', category: 'units', name: 'harvester' },
        { path: 'assets/units/artillery.png', category: 'units', name: 'artillery' },
        { path: 'assets/units/scout.png', category: 'units', name: 'scout' },
        { path: 'assets/units/rocketSoldier.png', category: 'units', name: 'rocketSoldier' },

        // Buildings
        { path: 'assets/buildings/hq.png', category: 'buildings', name: 'hq' },
        { path: 'assets/buildings/barracks.png', category: 'buildings', name: 'barracks' },
        { path: 'assets/buildings/factory.png', category: 'buildings', name: 'factory' },
        { path: 'assets/buildings/derrick.png', category: 'buildings', name: 'derrick' },
        { path: 'assets/buildings/turret.png', category: 'buildings', name: 'turret' },
        { path: 'assets/buildings/powerPlant.png', category: 'buildings', name: 'powerPlant' },
    ];

    if (assetLoader) {
        const result = await assetLoader.loadAssets(assetList);
        console.log(`Successfully loaded ${result.loaded} assets`);
        if (result.failed > 0) {
            console.warn(`Failed to load ${result.failed} assets`);
        }
    }
}

// Call this after game initialization
loadCustomAssets();
```

### Step 4: Test
- Run the game
- Check browser console (F12) for asset loading messages
- Sprites should appear instead of colored placeholders

## Sprite Specifications

### File Format
- **PNG** (with alpha transparency support)
- **WebP** (if browsers are modern enough)
- **JPEG** (if no transparency needed)

### Resolution Recommendations
- **Unit sprites**: 48x48 to 64x64 pixels
- **Building sprites**: 64x64 to 128x128 pixels
- **Keep consistent scale** across all sprites

### Transparency
- PNG with transparency strongly recommended
- Allows sprites to overlay correctly over terrain
- Use appropriate background: no background or checkerboard pattern

### Coloring
Two approaches:

1. **Team-specific sprites** (simplest):
   - Create blue and red versions
   - Name them `unitname_blue.png` and `unitname_red.png`

2. **Neutral sprites** (more flexible):
   - Create neutral-colored sprites
   - Game can apply team colors via canvas filters

## Testing Placeholders

To verify your sprite setup without replacing placeholders:

```javascript
// Check what assets are loaded
console.log(assetLoader.getCategory('units'));
console.log(assetLoader.getCategory('buildings'));

// Test if specific asset exists
if (assetLoader.hasAsset('units', 'tank')) {
    console.log('Tank sprite loaded successfully!');
}
```

## Performance Tips

1. **Optimize PNG files**:
   - Use PNG compression (https://tinypng.com/)
   - Removes unused data without losing quality

2. **Consider sprite atlasing**:
   - Combine multiple sprites into one image
   - Improves loading performance

3. **Use appropriate resolutions**:
   - Don't use unnecessarily large sprites
   - Balance quality with file size

## License Notes

When using downloaded assets, ensure:
- ✓ Check the asset's license
- ✓ Provide attribution if required
- ✓ Verify it allows derivative works
- ✓ Check if it allows commercial use (if needed)

**Recommended licenses** (permissive):
- CC0 (Public Domain)
- CC-BY (requires attribution)
- CC-BY-SA (requires attribution and same license)
- MIT, Apache 2.0

## Troubleshooting

### Assets not appearing
1. Check file paths match exactly
2. Verify PNG files are valid
3. Check browser console for errors
4. Inspect Network tab in DevTools

### Wrong colors or appearance
1. Sprites may need different placement/offset
2. Resolution might be too small/large
3. Try adjusting scale in `drawUnitSprite()` / `drawBuildingSprite()`

### Game runs slowly
1. Reduce sprite file sizes
2. Check number of active units on screen
3. Use browser profiler to identify bottleneck

## Next Steps

1. Choose an asset source from the list above
2. Download and extract PNG files
3. Place them in appropriate subdirectories
4. Update the asset loader code
5. Test and enjoy improved graphics!

For detailed implementation guide, see `../GRAPHICS_ASSETS.md`
