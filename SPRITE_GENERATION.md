# XFire Procedural Sprite Generation

## Overview

XFire now includes a **procedural sprite generation system** that creates detailed, team-colored graphics for all units and buildings directly in JavaScript using Canvas 2D.

### Key Features

✅ **No External Files Needed** - All sprites generated programmatically
✅ **Detailed Graphics** - Tanks with turrets, soldiers with helmets, buildings with textures
✅ **Team Colors** - Blue and red team sprites automatically generated
✅ **Customizable** - Easy to modify colors, sizes, and details
✅ **Fallback System** - Gracefully handles missing files
✅ **Performance** - Sprites cached after generation
✅ **Hybrid Support** - Works alongside custom file-based assets

## How It Works

### System Architecture

```
Game Start
    ↓
AssetLoader initialized
    ↓
SpriteGenerator creates sprites
    ├─ Generates all 6 unit types
    ├─ Generates all 6 building types
    └─ Creates Canvas Images
    ↓
Sprites cached in AssetLoader
    ↓
Game rendering uses sprites
    ↓
Optional: Load custom assets (override generated)
```

### Sprite Types Generated

#### Units (6 types)

1. **Infantry**
   - Circular body with helmet
   - Rifle drawn as diagonal line
   - Skin-tone head
   - Team-colored uniform

2. **Tank**
   - Rectangular body with tracks
   - Circular turret with shadow
   - Long gun barrel
   - Detailed armor

3. **Harvester**
   - Large oval body
   - Cargo container on top
   - Wheels for mobility
   - Storage indicator

4. **Artillery**
   - Small circular base
   - Very long barrel
   - Elevation mechanism
   - Camouflage coloring

5. **Scout**
   - Sleek, pointed design
   - Speed lines for velocity
   - Cockpit detail
   - Lightweight appearance

6. **Rocket Soldier**
   - Infantry base
   - Helmet with antenna
   - Rocket launcher tubes
   - Ordnance equipment

#### Buildings (6 types)

1. **HQ (Headquarters)**
   - Large command building
   - Tall antenna with light
   - Windows and door
   - Yellow command beacon

2. **Barracks**
   - Training facility design
   - Multiple entrance doors
   - Training yard markings
   - Large gates

3. **Factory**
   - Industrial complex
   - Smokestack
   - Production line details
   - Conveyor markings

4. **Derrick (Oil Pump)**
   - Tall oil pump structure
   - Diagonal support beams
   - Pump head detail
   - Oil tank base

5. **Turret**
   - Defensive gun emplacement
   - Circular base
   - Gun barrel
   - Targeting antenna

6. **Power Plant**
   - Power generation facility
   - Power distribution panels
   - Electrical lines
   - Status lights

## Usage

### Automatic Generation (Default)

Sprites are automatically generated when the game starts:

1. Page loads
2. AssetLoader initialized with placeholders
3. SpriteGenerator creates detailed sprites
4. Game renders with sprite graphics

**No code needed!** Everything happens automatically.

### Manual Generation

Generate sprites on demand via browser console:

```javascript
// In browser console (F12):
window.xfireAssets.loadGeneratedSprites()

// Check what was generated
window.xfireAssets.checkLoadedAssets()

// View detailed info
window.xfireAssets.debugAssets()
```

### Regenerate with Different Color

```javascript
// Create a new generator with custom color
const gen = new SpriteGenerator();
gen.generateAllSprites(assetLoader, '#ff00ff');  // Magenta units
```

### Regenerating Team-Specific Sprites

```javascript
// Generate both blue and red team sprites
const gen = new SpriteGenerator();
gen.generateTeamSprites(assetLoader);
```

## Sprite Customization

### Modifying Sprite Properties

Edit `spriteGenerator.js` to customize sprites:

```javascript
// Example: Make tanks larger
generateTank(color = '#4488ff') {
    const size = 64;  // ← Change this
    // ... rest of code
}

// Example: Change color scheme
generateInfantry(color = '#4488ff') {
    // Change default color parameter
}

// Example: Modify details
// Tank barrel length
ctx.lineTo(cx + 20, cy - 5);  // ← Adjust coordinates
```

### Adding New Unit Type

```javascript
generateNewUnit(color = '#4488ff') {
    const size = 52;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;

    // Draw your sprite here
    ctx.fillStyle = color;
    ctx.fillRect(cx - 10, cy - 10, 20, 20);

    return this.canvasToImage(canvas);
}

// Then add to generation function:
// assetLoader.assets.units.newUnitType = this.generateNewUnit(color);
```

## Technical Details

### Canvas Drawing Approach

All sprites are drawn using HTML5 Canvas 2D API:

- **Shapes**: Rectangles, circles, ellipses, paths
- **Colors**: Shading applied via `shadeColor()` function
- **Layering**: Draw order creates depth
- **Details**: Highlights, shadows, and textures
- **Conversion**: Canvas converted to Image for rendering

### Performance

- **Generation Time**: ~100-200ms for all sprites
- **Cache**: Sprites cached after generation (no regeneration)
- **Rendering**: Efficient Canvas drawImage() calls
- **Memory**: ~100KB for all sprite images

### Browser Compatibility

Works on all modern browsers:
- Chrome/Chromium ✓
- Firefox ✓
- Safari ✓
- Edge ✓
- Mobile browsers ✓

## Hybrid Mode: Generated + Custom

You can use both generated and custom sprites:

1. **Start**: Generated sprites load (automatic)
2. **Override**: Add custom PNG files to `assets/` directory
3. **Load**: Custom sprites override generated ones
4. **Result**: Mix of generated and custom graphics

Example flow:
```javascript
// Load generated sprites (automatic)
assetLoader.createPlaceholders();

// Generate quality sprites
const gen = new SpriteGenerator();
gen.generateAllSprites(assetLoader, '#4488ff');

// Then load custom tank only (overrides generated)
await assetLoader.loadImage('assets/units/tank.png', 'units', 'tank');
```

## Color System

### Adjusting Colors

Sprites use team colors that can be modified:

```javascript
// Player team (blue)
const blueColor = '#4488ff';

// Enemy team (red)
const redColor = '#ff4444';

// Custom colors
const purpleColor = '#aa44ff';
const greenColor = '#44ff44';

// Generate with custom color
const gen = new SpriteGenerator();
gen.generateAllSprites(assetLoader, purpleColor);
```

### Color Shading

The `shadeColor()` method creates depth:

```javascript
// Original color
#4488ff

// Darkened (more intense)
shadeColor(color, -30);  // Darker version

// Lightened (less intense)
shadeColor(color, 30);   // Lighter version
```

## Debugging

### Check Generated Sprites

```javascript
// List all loaded assets
window.xfireAssets.debugAssets()

// Count assets
window.xfireAssets.checkLoadedAssets()

// Check specific sprite
const tankSprite = assetLoader.getAsset('units', 'tank');
console.log('Tank sprite:', tankSprite);
console.log('Size:', tankSprite.width, 'x', tankSprite.height);
```

### Browser Console Commands

```javascript
// Generate new sprites
window.xfireAssets.loadGeneratedSprites()

// Load custom assets
window.xfireAssets.loadCustomAssets()

// Toggle graphics mode
window.xfireAssets.toggleGraphicsMode(false)  // Procedural
window.xfireAssets.toggleGraphicsMode(true)   // Sprites

// Show help
window.xfireAssets.help()
```

## Comparison: Generated vs Custom

| Aspect | Generated | Custom |
|--------|-----------|--------|
| Setup Time | Instant | Download + organize |
| File Size | 0 bytes | 50-500KB per sprite |
| Customization | Code edits | Image editing |
| Quality | Good | Excellent |
| Loading | Cached | Loaded on demand |
| Team Colors | Automatic | Manual versions |

## Advanced: Modifying SpriteGenerator

### Adding Custom Shading

```javascript
// In SpriteGenerator class
drawCustomShadow(ctx, x, y, w, h, color) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}
```

### Creating Gradients

```javascript
// Add gradient to tanks
const gradient = ctx.createLinearGradient(0, 0, size, size);
gradient.addColorStop(0, color);
gradient.addColorStop(1, this.shadeColor(color, -30));
ctx.fillStyle = gradient;
```

### Animation Support

```javascript
// Sprites currently static, but could add:
// - Turret rotation angles
// - Walking frames for infantry
// - Blinking lights for buildings
// - Animated smoke effects
```

## Troubleshooting

### Sprites Not Appearing

1. Check browser console for errors
2. Verify spriteGenerator.js is loaded
3. Check if `useSprites = true` in game-engine.js
4. Test with: `window.xfireAssets.debugAssets()`

### Wrong Colors

```javascript
// Regenerate with correct color
const gen = new SpriteGenerator();
gen.generateAllSprites(assetLoader, '#4488ff');
```

### Performance Issues

1. Check browser DevTools Performance tab
2. Look for Canvas rendering bottlenecks
3. Reduce sprite count in viewport
4. Try disabling sprites: `window.xfireAssets.toggleGraphicsMode(false)`

## Future Improvements

Possible enhancements:

- [ ] Animation frames (turret rotation, unit walking)
- [ ] Sprite atlasing for batch rendering
- [ ] SVG sprite export functionality
- [ ] Dynamic sprite customization UI
- [ ] Particle effects (explosions, dust)
- [ ] Ambient animations (smoke, lights)
- [ ] Multi-directional sprites (8-angle isometric)

## Summary

The SpriteGenerator system provides:
- **Easy Setup**: Works out-of-the-box
- **Quality Graphics**: Better than simple shapes
- **Customizable**: Change colors and details easily
- **Hybrid Support**: Works with custom files too
- **No Dependencies**: Pure Canvas 2D API
- **Extendable**: Easy to add new sprites

Simply run the game and enjoy enhanced graphics with no setup needed!
