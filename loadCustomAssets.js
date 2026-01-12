/**
 * Custom Asset Loader for XFire
 *
 * This file provides helper functions for loading custom sprite graphics
 * Place PNG files in the assets/ directory and call loadCustomAssets()
 *
 * Usage:
 *   1. Add <script src="loadCustomAssets.js"></script> to index.html
 *   2. Place PNG files in assets/units/ and assets/buildings/
 *   3. The custom assets will automatically load on game startup
 */

/**
 * Load all custom sprite assets from the assets directory
 * Falls back to placeholders if files are missing
 */
async function loadCustomAssets() {
    console.log('[XFire Assets] Starting custom asset loading...');

    // Ensure asset loader is available
    if (typeof assetLoader === 'undefined') {
        console.warn('[XFire Assets] AssetLoader not available yet');
        return false;
    }

    // List of asset definitions
    // You can modify this list to match your custom assets
    const assetList = [
        // ===== UNITS =====
        { path: 'assets/units/infantry.png', category: 'units', name: 'infantry' },
        { path: 'assets/units/tank.png', category: 'units', name: 'tank' },
        { path: 'assets/units/harvester.png', category: 'units', name: 'harvester' },
        { path: 'assets/units/artillery.png', category: 'units', name: 'artillery' },
        { path: 'assets/units/scout.png', category: 'units', name: 'scout' },
        { path: 'assets/units/rocketSoldier.png', category: 'units', name: 'rocketSoldier' },

        // ===== BUILDINGS =====
        { path: 'assets/buildings/hq.png', category: 'buildings', name: 'hq' },
        { path: 'assets/buildings/barracks.png', category: 'buildings', name: 'barracks' },
        { path: 'assets/buildings/factory.png', category: 'buildings', name: 'factory' },
        { path: 'assets/buildings/derrick.png', category: 'buildings', name: 'derrick' },
        { path: 'assets/buildings/turret.png', category: 'buildings', name: 'turret' },
        { path: 'assets/buildings/powerPlant.png', category: 'buildings', name: 'powerPlant' },

        // ===== TERRAIN (Optional) =====
        { path: 'assets/terrain/grass.png', category: 'terrain', name: 'grass' },
        { path: 'assets/terrain/sand.png', category: 'terrain', name: 'sand' },
        { path: 'assets/terrain/rock.png', category: 'terrain', name: 'rock' },
        { path: 'assets/terrain/water.png', category: 'terrain', name: 'water' },
        { path: 'assets/terrain/hills.png', category: 'terrain', name: 'hills' },
    ];

    console.log(`[XFire Assets] Loading ${assetList.length} asset definitions...`);

    try {
        // Load all assets (non-blocking - failures don't stop other loads)
        const result = await assetLoader.loadAssets(assetList);

        console.log(`[XFire Assets] ✓ Successfully loaded ${result.loaded} assets`);
        if (result.failed > 0) {
            console.warn(`[XFire Assets] ⚠ ${result.failed} assets failed to load (using placeholders)`);
        }

        return true;
    } catch (error) {
        console.error('[XFire Assets] Error loading assets:', error);
        return false;
    }
}

/**
 * Load assets for a specific team (blue or red)
 * Useful if you have team-specific sprite variants
 */
async function loadTeamAssets(teamColor = 'blue') {
    console.log(`[XFire Assets] Loading team assets for ${teamColor} team...`);

    const teamSuffix = teamColor === 'blue' ? '_blue' : '_red';
    const unitNames = ['infantry', 'tank', 'harvester', 'artillery', 'scout', 'rocketSoldier'];
    const buildingNames = ['hq', 'barracks', 'factory', 'derrick', 'turret', 'powerPlant'];

    const assetList = [
        ...unitNames.map(name => ({
            path: `assets/units/${name}${teamSuffix}.png`,
            category: 'units',
            name: name
        })),
        ...buildingNames.map(name => ({
            path: `assets/buildings/${name}${teamSuffix}.png`,
            category: 'buildings',
            name: name
        }))
    ];

    return await assetLoader.loadAssets(assetList);
}

/**
 * Check if custom assets are loaded
 * Returns object with asset counts per category
 */
function checkLoadedAssets() {
    if (typeof assetLoader === 'undefined') {
        console.warn('[XFire Assets] AssetLoader not available');
        return null;
    }

    const categories = ['units', 'buildings', 'terrain', 'effects'];
    const status = {};

    categories.forEach(category => {
        const assets = assetLoader.getCategory(category);
        status[category] = Object.keys(assets).length;
    });

    console.log('[XFire Assets] Currently loaded:', status);
    return status;
}

/**
 * Print detailed asset information to console
 */
function debugAssets() {
    if (typeof assetLoader === 'undefined') {
        console.warn('[XFire Assets] AssetLoader not available');
        return;
    }

    console.log('=== XFire Asset Loader Debug Info ===');
    console.log('Loaded assets by category:');

    const categories = ['units', 'buildings', 'terrain', 'effects'];
    categories.forEach(category => {
        const assets = assetLoader.getCategory(category);
        const assetNames = Object.keys(assets);
        console.log(`\n${category.toUpperCase()} (${assetNames.length}):`);
        assetNames.forEach(name => {
            const asset = assets[name];
            console.log(`  - ${name}: ${asset.width}x${asset.height}px`);
        });
    });

    console.log('\n=====================================');
}

/**
 * Toggle between sprite and procedural graphics
 */
function toggleGraphicsMode(useSprites = null) {
    if (typeof window.useSprites === 'undefined') {
        console.warn('[XFire Assets] Graphics mode not available yet');
        return;
    }

    if (useSprites === null) {
        // Toggle current mode
        window.useSprites = !window.useSprites;
    } else {
        window.useSprites = useSprites;
    }

    const mode = window.useSprites ? 'sprite-based' : 'procedural';
    console.log(`[XFire Assets] Switched to ${mode} graphics mode`);
    console.log('[XFire Assets] Changes will apply to newly rendered units/buildings');
}

// ===== Auto-load assets when this script loads =====
// Uncomment the line below to automatically load assets on page load

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for game to initialize
    setTimeout(() => {
        if (typeof assetLoader !== 'undefined') {
            console.log('[XFire Assets] Game initialized, loading custom assets...');
            loadCustomAssets().then(success => {
                if (success) {
                    checkLoadedAssets();
                }
            });
        }
    }, 500);
});

// Export for use if this is loaded as a module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadCustomAssets,
        loadTeamAssets,
        checkLoadedAssets,
        debugAssets,
        toggleGraphicsMode
    };
}

// Make functions available globally for console access
window.xfireAssets = {
    loadCustomAssets,
    loadTeamAssets,
    checkLoadedAssets,
    debugAssets,
    toggleGraphicsMode,
    help: () => {
        console.log(`
XFire Asset Loader - Console API
=================================

Functions available as window.xfireAssets.*

loadCustomAssets()
  - Load all custom sprites from assets/ directory

loadTeamAssets(teamColor)
  - Load team-specific sprites (pass 'blue' or 'red')

checkLoadedAssets()
  - Display count of loaded assets per category

debugAssets()
  - Show detailed info about loaded sprites

toggleGraphicsMode(useSprites)
  - Toggle between sprite and procedural graphics
  - Pass true/false or null to toggle

Example usage in console:
  window.xfireAssets.loadCustomAssets()
  window.xfireAssets.debugAssets()
  window.xfireAssets.toggleGraphicsMode(false)  // Use procedural graphics
  window.xfireAssets.toggleGraphicsMode(true)   // Use sprites
        `);
    }
};

console.log('%c[XFire Assets] Custom asset loader ready!', 'color: #0f0; font-weight: bold');
console.log('%cType: window.xfireAssets.help() for available commands', 'color: #0f0');
