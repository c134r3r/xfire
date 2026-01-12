# XFire Graphics Assets Guide

This document explains how to use and customize graphics assets in the XFire RTS game.

## Current Implementation

XFire now features a flexible sprite-based graphics system that supports both:
- **Procedural Graphics**: Dynamically generated shapes (current default for backward compatibility)
- **Sprite Graphics**: High-quality pre-rendered or pixel art sprites

The system automatically tries to load sprite graphics and gracefully falls back to procedural rendering if sprites are not available.

## Asset System Architecture

### Directory Structure
```
xfire/
├── assets/
│   ├── units/           # Unit sprites (Infantry, Tank, Harvester, etc.)
│   ├── buildings/       # Building sprites (HQ, Barracks, Factory, etc.)
│   ├── terrain/         # Terrain tile sprites
│   └── effects/         # Particle and explosion effects
├── assetLoader.js       # Asset management system
└── game-engine.js       # Game with integrated sprite rendering
```

### Asset Loader Features

The `AssetLoader` class (`assetLoader.js`) provides:

```javascript
// Initialize asset loader
const loader = new AssetLoader();

// Load images from files
await loader.loadImage('path/to/sprite.png', 'units', 'tank');

// Get loaded asset
const sprite = loader.getAsset('units', 'tank');

// Create placeholder sprites for testing
loader.createPlaceholders();
```

## Using Custom Sprite Graphics

### Step 1: Find Asset Sources

**Recommended Free Sources:**

1. **OpenGameArt.org - PixVoxel Wargame Sprites** (Best Match)
   - URL: https://opengameart.org/content/pixvoxel-colorful-isometric-wargame-sprites
   - Features: 35+ military units, 7 buildings, 8 directions, multiple color palettes
   - License: Open source (check specific version for license details)
   - Perfect for isometric RTS games

2. **OpenGameArt.org Collections**
   - Isometric Buildings for RTS/RPG
   - URL: https://opengameart.org/content/isometric-buildings-for-rts-or-rpg
   - Isometric Tiles and terrain sets

3. **Itch.io Free Game Assets**
   - Search: "isometric", "tank", "military", "RTS"
   - URL: https://itch.io/game-assets/free/tag-isometric
   - Multiple packs with CC0/public domain licenses

4. **Game Art Guppy - Free Isometric Army**
   - URL: https://www.gameartguppy.com/shop/free-isometric-army/
   - Includes tanks, soldiers, helicopters, explosions

### Step 2: Download and Organize Assets

1. Download your chosen asset pack
2. Extract sprite images
3. Organize into appropriate subdirectories:
   ```
   assets/
   ├── units/
   │   ├── infantry.png
   │   ├── tank.png
   │   ├── harvester.png
   │   ├── artillery.png
   │   ├── scout.png
   │   └── rocketSoldier.png
   └── buildings/
       ├── hq.png
       ├── barracks.png
       ├── factory.png
       ├── derrick.png
       ├── turret.png
       └── powerPlant.png
   ```

### Step 3: Load Custom Sprites

Update the game initialization in `index.html` or `game-engine.js`:

```javascript
// After game starts, load custom assets
async function loadCustomAssets() {
    const assetList = [
        { path: 'assets/units/tank.png', category: 'units', name: 'tank' },
        { path: 'assets/units/infantry.png', category: 'units', name: 'infantry' },
        { path: 'assets/buildings/hq.png', category: 'buildings', name: 'hq' },
        // Add more as needed...
    ];

    await assetLoader.loadAssets(assetList);
    console.log('Custom assets loaded successfully');
}

// Call after game initialization
loadCustomAssets();
```

## Sprite Requirements

### Recommended Specifications

- **Format**: PNG with transparency (recommended)
- **Unit Sprites**:
  - Size: 48x48 to 64x64 pixels
  - Include some padding/margin around the sprite
  - Should face right or be direction-agnostic

- **Building Sprites**:
  - Size: 64x64 to 128x128 pixels
  - Larger sprites for more detail
  - Should be visible from isometric perspective

- **Color Scheme**:
  - The game applies team colors dynamically
  - Consider using neutral colors that can be recolored
  - Or use team-specific blue (#4488ff) and red (#ff4444)

### PixVoxel Wargame Sprites Integration

For best results with PixVoxel sprites:

1. The sprites come pre-colored for teams
2. Download both blue and red versions if available
3. Name them accordingly: `tank_blue.png`, `tank_red.png`
4. Modify the asset loading to handle team colors:

```javascript
// Load team-specific sprites
const playerColor = game.players[playerId].color;
const colorSuffix = playerColor === '#4488ff' ? 'blue' : 'red';
const sprite = assetLoader.getAsset('units', `${unitType}_${colorSuffix}`);
```

## Current Placeholder System

The game currently uses auto-generated placeholder sprites:

- **Colors**: Unit colors match team colors (blue/red)
- **Shapes**: Simple colored squares for quick visual distinction
- **Purpose**: Allows full game testing while waiting for real art assets

Placeholders are generated dynamically and cached for performance.

## Disabling Sprite Graphics

To use only procedural graphics (original style):

```javascript
// In game-engine.js
useSprites = false;  // Disables sprite rendering
```

Or via browser console:
```javascript
useSprites = false;
```

## Asset Loading Configuration

### Automatic Loading

Add this to your HTML before game startup:

```html
<script>
// Configure asset loader after page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for game initialization
    setTimeout(async () => {
        if (assetLoader) {
            const assets = [
                { path: 'assets/units/tank.png', category: 'units', name: 'tank' },
                { path: 'assets/units/infantry.png', category: 'units', name: 'infantry' },
                // More assets...
            ];
            const result = await assetLoader.loadAssets(assets);
            console.log(`Loaded: ${result.loaded}, Failed: ${result.failed}`);
        }
    }, 100);
});
</script>
```

## Performance Considerations

- **Asset Caching**: Loaded sprites are cached in memory
- **Sprite Size**: Larger sprites use more memory but look better
- **File Size**: PNG compression is recommended for web deployment
- **Load Time**: Assets load asynchronously, won't block game startup

## Browser Compatibility

- Requires HTML5 Canvas 2D with `drawImage()` support
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires CORS headers if loading from external servers

## Troubleshooting

### Sprites Not Loading
1. Check browser console for error messages
2. Verify file paths are correct
3. Ensure PNG files are readable
4. Check browser network tab for failed requests

### Sprites Look Pixelated
- Adjust canvas scaling in game-engine.js
- Ensure sprite resolution matches expected scale
- Try different `imageSmoothingQuality` settings

### Performance Issues
- Reduce sprite file sizes with PNG compression
- Consider sprite atlas/sheet instead of individual files
- Profile with browser DevTools Performance tab

## Contributing Custom Assets

If you create or find good free assets for XFire:
1. Ensure proper licensing (CC0, MIT, or compatible)
2. Document the source and license
3. Provide a pull request with assets in correct directories
4. Include attribution in commit message

## References

- **OpenGameArt.org**: https://opengameart.org/
- **Itch.io Game Assets**: https://itch.io/game-assets
- **Canvas drawImage API**: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
- **PNG Optimization**: https://tinypng.com/
