/**
 * Asset Loader Module
 * Handles loading and caching of sprite assets for units, buildings, terrain, and effects
 */

class AssetLoader {
  constructor() {
    this.assets = {
      units: {},
      buildings: {},
      terrain: {},
      effects: {}
    };
    this.loadedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Load an image and cache it
   * @param {string} path - Path to the image file
   * @param {string} category - Category (units, buildings, terrain, effects)
   * @param {string} name - Name to store the asset under
   */
  async loadImage(path, category, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.assets[category][name] = img;
        this.loadedCount++;
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load asset: ${path}`);
        this.failedCount++;
        reject(new Error(`Failed to load: ${path}`));
      };
      img.src = path;
    });
  }

  /**
   * Load multiple images in parallel
   * @param {Array} assetList - Array of {path, category, name} objects
   */
  async loadAssets(assetList) {
    const promises = assetList.map(asset =>
      this.loadImage(asset.path, asset.category, asset.name)
        .catch(err => console.error(err))
    );
    await Promise.all(promises);
    return {
      loaded: this.loadedCount,
      failed: this.failedCount
    };
  }

  /**
   * Get an asset
   * @param {string} category - Asset category
   * @param {string} name - Asset name
   * @returns {Image|null}
   */
  getAsset(category, name) {
    return this.assets[category]?.[name] || null;
  }

  /**
   * Get all assets in a category
   * @param {string} category
   * @returns {Object}
   */
  getCategory(category) {
    return this.assets[category] || {};
  }

  /**
   * Check if an asset exists
   * @param {string} category
   * @param {string} name
   * @returns {boolean}
   */
  hasAsset(category, name) {
    return !!this.assets[category]?.[name];
  }

  /**
   * Create a simple placeholder sprite (colored square)
   * Used for testing and as fallback
   * @param {string} color - Color in hex or CSS format
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @returns {HTMLCanvasElement}
   */
  static createPlaceholderSprite(color = '#4488ff', width = 32, height = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
  }

  /**
   * Create placeholder sprites for all asset types
   * Useful for testing the rendering system
   */
  createPlaceholders() {
    // Units
    const unitColors = {
      infantry: '#4488ff',
      tank: '#2255dd',
      harvester: '#66aaff',
      artillery: '#1133bb',
      scout: '#88ccff',
      rocketSoldier: '#0099ff'
    };

    // Buildings
    const buildingColors = {
      hq: '#4488ff',
      barracks: '#2255dd',
      factory: '#1133bb',
      derrick: '#66aaff',
      turret: '#88ccff',
      powerPlant: '#0099ff'
    };

    // Create unit placeholders
    Object.entries(unitColors).forEach(([name, color]) => {
      const img = AssetLoader.createPlaceholderSprite(color, 48, 48);
      this.assets.units[name] = img;
    });

    // Create building placeholders
    Object.entries(buildingColors).forEach(([name, color]) => {
      const img = AssetLoader.createPlaceholderSprite(color, 64, 64);
      this.assets.buildings[name] = img;
    });

    // Create terrain placeholders
    const terrainColors = {
      grass: '#3d5c3d',
      sand: '#a08050',
      rock: '#606060',
      water: '#304060',
      hills: '#5d7c4d'
    };

    Object.entries(terrainColors).forEach(([name, color]) => {
      const img = AssetLoader.createPlaceholderSprite(color, 64, 64);
      this.assets.terrain[name] = img;
    });

    console.log('Placeholder assets created successfully');
  }
}

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetLoader;
}
