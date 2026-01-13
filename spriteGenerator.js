/**
 * Sprite Generator for XFire
 *
 * Programmatically generates detailed isometric sprites for units and buildings
 * No external assets needed - all graphics created with Canvas 2D
 */

class SpriteGenerator {
    constructor(scale = 1) {
        this.scale = scale;
        this.colorCache = new Map();
    }

    /**
     * Create canvas with specified dimensions
     */
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    /**
     * Convert canvas to Image object
     */
    canvasToImage(canvas) {
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    }

    /**
     * Shade a color (lighten/darken)
     */
    shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R < 255) ? R : 255;
        G = (G < 255) ? G : 255;
        B = (B < 255) ? B : 255;

        const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
        const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
        const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));

        return '#' + RR + GG + BB;
    }

    /**
     * Generate Tank Sprite
     */
    generateTank(color = '#4488ff') {
        const size = 64;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 8, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tank body (isometric rectangle)
        const bodyColor = color;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(cx - 14, cy - 4, 28, 14);

        // Tank body shading
        ctx.fillStyle = this.shadeColor(bodyColor, -20);
        ctx.fillRect(cx - 14, cy - 4, 28, 5);
        ctx.fillStyle = this.shadeColor(bodyColor, 15);
        ctx.fillRect(cx - 14, cy + 5, 28, 4);

        // Tank tracks
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 2);
        ctx.lineTo(cx - 14, cy + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 14, cy - 2);
        ctx.lineTo(cx + 14, cy + 8);
        ctx.stroke();

        // Turret (circular)
        ctx.fillStyle = this.shadeColor(bodyColor, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 6, 0, Math.PI * 2);
        ctx.fill();

        // Turret shading
        ctx.fillStyle = this.shadeColor(bodyColor, 20);
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Gun barrel
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 3);
        ctx.lineTo(cx + 16, cy - 5);
        ctx.stroke();

        // Gun barrel tip
        ctx.fillStyle = this.shadeColor(bodyColor, -50);
        ctx.beginPath();
        ctx.arc(cx + 16, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    generateLightTank(color = '#4488ff') {
        const size = 56;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.ellipse(cx, cy + 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lighter tank body
        const bodyColor = color;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(cx - 10, cy - 3, 20, 10);

        // Tank body shading
        ctx.fillStyle = this.shadeColor(bodyColor, -20);
        ctx.fillRect(cx - 10, cy - 3, 20, 4);
        ctx.fillStyle = this.shadeColor(bodyColor, 15);
        ctx.fillRect(cx - 10, cy + 4, 20, 3);

        // Tank tracks
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 1);
        ctx.lineTo(cx - 10, cy + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 10, cy - 1);
        ctx.lineTo(cx + 10, cy + 6);
        ctx.stroke();

        // Smaller turret
        ctx.fillStyle = this.shadeColor(bodyColor, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Short gun barrel
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 2);
        ctx.lineTo(cx + 11, cy - 3);
        ctx.stroke();

        return this.canvasToImage(canvas);
    }

    generateMediumTank(color = '#4488ff') {
        const size = 64;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 8, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Standard tank body
        const bodyColor = color;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(cx - 14, cy - 4, 28, 14);

        // Tank body shading
        ctx.fillStyle = this.shadeColor(bodyColor, -20);
        ctx.fillRect(cx - 14, cy - 4, 28, 5);
        ctx.fillStyle = this.shadeColor(bodyColor, 15);
        ctx.fillRect(cx - 14, cy + 5, 28, 4);

        // Tank tracks
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 2);
        ctx.lineTo(cx - 14, cy + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 14, cy - 2);
        ctx.lineTo(cx + 14, cy + 8);
        ctx.stroke();

        // Turret
        ctx.fillStyle = this.shadeColor(bodyColor, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 6, 0, Math.PI * 2);
        ctx.fill();

        // Turret shading
        ctx.fillStyle = this.shadeColor(bodyColor, 20);
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Gun barrel
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 3);
        ctx.lineTo(cx + 16, cy - 5);
        ctx.stroke();

        // Gun barrel tip
        ctx.fillStyle = this.shadeColor(bodyColor, -50);
        ctx.beginPath();
        ctx.arc(cx + 16, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    generateHeavyTank(color = '#4488ff') {
        const size = 72;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.ellipse(cx, cy + 10, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Heavy tank body - wider and taller
        const bodyColor = color;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(cx - 18, cy - 5, 36, 16);

        // Tank body shading
        ctx.fillStyle = this.shadeColor(bodyColor, -20);
        ctx.fillRect(cx - 18, cy - 5, 36, 6);
        ctx.fillStyle = this.shadeColor(bodyColor, 15);
        ctx.fillRect(cx - 18, cy + 6, 36, 5);

        // Heavy tracks
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy - 2);
        ctx.lineTo(cx - 18, cy + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 18, cy - 2);
        ctx.lineTo(cx + 18, cy + 10);
        ctx.stroke();

        // Large turret
        ctx.fillStyle = this.shadeColor(bodyColor, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 7.5, 0, Math.PI * 2);
        ctx.fill();

        // Turret shading
        ctx.fillStyle = this.shadeColor(bodyColor, 20);
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 7, 4, 0, Math.PI * 2);
        ctx.fill();

        // Long gun barrel
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy - 4);
        ctx.lineTo(cx + 20, cy - 6);
        ctx.stroke();

        // Gun barrel tip
        ctx.fillStyle = this.shadeColor(bodyColor, -50);
        ctx.beginPath();
        ctx.arc(cx + 20, cy - 6, 2, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    generateFlak(color = '#4488ff') {
        const size = 56;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.ellipse(cx, cy + 7, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flak body
        const bodyColor = color;
        ctx.fillStyle = bodyColor;
        ctx.fillRect(cx - 11, cy - 3, 22, 11);

        // Body shading
        ctx.fillStyle = this.shadeColor(bodyColor, -20);
        ctx.fillRect(cx - 11, cy - 3, 22, 4);
        ctx.fillStyle = this.shadeColor(bodyColor, 15);
        ctx.fillRect(cx - 11, cy + 4, 22, 3);

        // Tracks
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 11, cy - 1);
        ctx.lineTo(cx - 11, cy + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 11, cy - 1);
        ctx.lineTo(cx + 11, cy + 6);
        ctx.stroke();

        // AA Turret (rotating)
        ctx.fillStyle = this.shadeColor(bodyColor, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Dual guns (simulated)
        ctx.strokeStyle = this.shadeColor(bodyColor, -40);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 5);
        ctx.lineTo(cx + 10, cy - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy + 1);
        ctx.lineTo(cx + 10, cy + 4);
        ctx.stroke();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Infantry Sprite
     */
    generateInfantry(color = '#4488ff') {
        const size = 48;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 6, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(cx - 5, cy + 2, 10, 10);

        // Body shading
        ctx.fillStyle = this.shadeColor(color, -20);
        ctx.fillRect(cx - 5, cy + 2, 10, 3);

        // Head
        ctx.fillStyle = '#d4a574';  // Skin tone
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = this.shadeColor(color, -30);
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 5, Math.PI, 0);
        ctx.fill();

        // Rifle
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + 5, cy);
        ctx.lineTo(cx + 12, cy - 3);
        ctx.stroke();

        // Rifle butt
        ctx.fillStyle = '#333';
        ctx.fillRect(cx + 11, cy - 4, 2, 2);

        // Highlight
        ctx.fillStyle = this.shadeColor(color, 30);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - 3, cy + 3, 4, 2);
        ctx.globalAlpha = 1;

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Harvester Sprite
     */
    generateHarvester(color = '#4488ff') {
        const size = 56;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 6, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body (oval/ellipse)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 1, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body highlight
        ctx.fillStyle = this.shadeColor(color, 20);
        ctx.beginPath();
        ctx.ellipse(cx - 3, cy - 3, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cargo container on top
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.fillRect(cx - 8, cy - 8, 16, 6);

        // Cargo container front
        ctx.fillStyle = color;
        ctx.fillRect(cx - 8, cy - 6, 16, 5);

        // Cargo container shading
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 8, cy - 6, 16, 5);

        // Wheels
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx - 8, cy + 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 8, cy + 8, 2, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Artillery Sprite
     */
    generateArtillery(color = '#4488ff') {
        const size = 52;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 10, 0, Math.PI * 2);
        ctx.fill();

        // Base shading
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 10, 0, Math.PI);
        ctx.fill();

        // Long barrel
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy + 2);
        ctx.lineTo(cx + 20, cy - 8);
        ctx.stroke();

        // Barrel joint
        ctx.fillStyle = this.shadeColor(color, -50);
        ctx.beginPath();
        ctx.arc(cx + 8, cy + 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Elevation mechanism
        ctx.strokeStyle = this.shadeColor(color, -30);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy + 5);
        ctx.lineTo(cx + 16, cy - 6);
        ctx.stroke();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Scout Sprite
     */
    generateScout(color = '#4488ff') {
        const size = 44;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 5, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sleek body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy);
        ctx.lineTo(cx + 8, cy - 2);
        ctx.lineTo(cx + 8, cy + 4);
        ctx.lineTo(cx - 6, cy + 6);
        ctx.closePath();
        ctx.fill();

        // Body highlight
        ctx.fillStyle = this.shadeColor(color, 25);
        ctx.fillRect(cx - 4, cy + 1, 6, 2);

        // Cockpit
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(cx - 2, cy + 1, 2, 0, Math.PI * 2);
        ctx.fill();

        // Speed lines
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i += 1) {
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy + 1 + i);
            ctx.lineTo(cx - 14, cy + i);
            ctx.stroke();
        }

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Rocket Soldier Sprite
     */
    generateRocketSoldier(color = '#4488ff') {
        const size = 48;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 6, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = color;
        ctx.fillRect(cx - 5, cy + 2, 10, 10);

        // Body shading
        ctx.fillStyle = this.shadeColor(color, -20);
        ctx.fillRect(cx - 5, cy + 2, 10, 3);

        // Head
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Helmet with antenna
        ctx.fillStyle = this.shadeColor(color, -35);
        ctx.beginPath();
        ctx.arc(cx, cy - 3, 5, Math.PI, 0);
        ctx.fill();

        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 6);
        ctx.lineTo(cx + 3, cy - 10);
        ctx.stroke();

        // Rocket launcher
        ctx.fillStyle = '#555';
        ctx.fillRect(cx + 4, cy - 2, 2, 10);
        ctx.fillRect(cx + 6, cy, 2, 7);

        // Rockets (tubes)
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy - 1);
        ctx.lineTo(cx + 13, cy - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy + 3);
        ctx.lineTo(cx + 13, cy);
        ctx.stroke();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate HQ Building Sprite
     */
    generateHQ(color = '#4488ff') {
        const size = 72;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 12, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main structure
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.fillRect(cx - 16, cy - 8, 32, 22);

        ctx.fillStyle = color;
        ctx.fillRect(cx - 14, cy - 6, 28, 20);

        // Roof
        ctx.fillStyle = this.shadeColor(color, -35);
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 6);
        ctx.lineTo(cx, cy - 12);
        ctx.lineTo(cx + 14, cy - 6);
        ctx.closePath();
        ctx.fill();

        // Roof highlight
        ctx.fillStyle = this.shadeColor(color, 20);
        ctx.fillRect(cx - 12, cy - 7, 24, 2);

        // Command antenna
        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy - 10);
        ctx.lineTo(cx + 8, cy - 20);
        ctx.stroke();

        // Antenna tip (command light)
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 20, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Command light glow
        ctx.fillStyle = '#ffff88';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 20, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Windows
        ctx.fillStyle = '#88ccff';
        ctx.fillRect(cx - 10, cy - 2, 3, 3);
        ctx.fillRect(cx - 1, cy - 2, 3, 3);
        ctx.fillRect(cx + 8, cy - 2, 3, 3);

        // Door
        ctx.fillStyle = this.shadeColor(color, -40);
        ctx.fillRect(cx - 3, cy + 8, 6, 8);

        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 3, cy + 8, 6, 8);

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Barracks Building Sprite
     */
    generateBarracks(color = '#4488ff') {
        const size = 68;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 11, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main structure
        ctx.fillStyle = this.shadeColor(color, -20);
        ctx.fillRect(cx - 14, cy - 4, 28, 20);

        ctx.fillStyle = color;
        ctx.fillRect(cx - 12, cy - 2, 24, 18);

        // Roof
        ctx.fillStyle = this.shadeColor(color, -30);
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 2);
        ctx.lineTo(cx, cy - 8);
        ctx.lineTo(cx + 12, cy - 2);
        ctx.closePath();
        ctx.fill();

        // Training yard (lines)
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(cx - 8, cy + 2 + i * 3);
            ctx.lineTo(cx + 8, cy + 2 + i * 3);
            ctx.stroke();
        }

        // Large entrance
        ctx.fillStyle = this.shadeColor(color, -45);
        ctx.fillRect(cx - 8, cy + 10, 16, 6);

        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 8, cy + 10, 16, 6);

        // Flag pole
        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 12, cy - 4);
        ctx.lineTo(cx + 12, cy - 10);
        ctx.stroke();

        // Flag
        ctx.fillStyle = this.shadeColor(color, 30);
        ctx.fillRect(cx + 12, cy - 10, 5, 3);

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Factory Building Sprite
     */
    generateFactory(color = '#4488ff') {
        const size = 68;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 11, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main structure
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.fillRect(cx - 14, cy - 4, 28, 20);

        ctx.fillStyle = color;
        ctx.fillRect(cx - 12, cy - 2, 24, 18);

        // Production lines
        ctx.strokeStyle = this.shadeColor(color, -45);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy + 2 + i * 4);
            ctx.lineTo(cx + 10, cy + 2 + i * 4);
            ctx.stroke();
        }

        // Smokestack
        ctx.fillStyle = this.shadeColor(color, -40);
        ctx.fillRect(cx + 10, cy - 10, 4, 12);

        // Smoke effect
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(cx + 12, cy - 12, 3, 0, Math.PI * 2);
        ctx.fill();

        // Windows
        ctx.fillStyle = '#88ccff';
        ctx.fillRect(cx - 8, cy + 2, 2, 2);
        ctx.fillRect(cx - 2, cy + 2, 2, 2);
        ctx.fillRect(cx + 4, cy + 2, 2, 2);

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Derrick (Oil Pump) Sprite
     */
    generateDerrick(color = '#4488ff') {
        const size = 64;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2 + 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 10, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Oil tank base
        ctx.fillStyle = this.shadeColor(color, -30);
        ctx.beginPath();
        ctx.ellipse(cx, cy + 8, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pump tower structure
        ctx.strokeStyle = this.shadeColor(color, -35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy + 6);
        ctx.lineTo(cx - 6, cy - 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 6);
        ctx.lineTo(cx + 6, cy - 12);
        ctx.stroke();

        // Pump head structure
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.fillRect(cx - 4, cy - 12, 8, 4);

        ctx.fillStyle = color;
        ctx.fillRect(cx - 3, cy - 10, 6, 2);

        // Pump arm
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 2, cy - 16);
        ctx.stroke();

        // Pump counterweight
        ctx.fillStyle = this.shadeColor(color, -50);
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 14, 2, 0, Math.PI * 2);
        ctx.fill();

        // Resource indicator
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(cx - 8, cy + 8, 16, 2);

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Turret Building Sprite
     */
    generateTurret(color = '#4488ff') {
        const size = 60;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 8, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Base structure
        ctx.fillStyle = this.shadeColor(color, -30);
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 12, 0, Math.PI * 2);
        ctx.fill();

        // Gun turret
        ctx.fillStyle = this.shadeColor(color, -35);
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.shadeColor(color, -15);
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Gun barrel
        ctx.strokeStyle = this.shadeColor(color, -50);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 2);
        ctx.lineTo(cx - 18, cy);
        ctx.stroke();

        // Gun barrel joint
        ctx.fillStyle = this.shadeColor(color, -50);
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Targeting antenna
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy - 4);
        ctx.lineTo(cx + 8, cy - 10);
        ctx.stroke();

        ctx.fillStyle = this.shadeColor(color, -50);
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 10, 1, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate Power Plant Building Sprite
     */
    generatePowerPlant(color = '#4488ff') {
        const size = 68;
        const canvas = this.createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.ellipse(cx, cy + 11, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main building
        ctx.fillStyle = this.shadeColor(color, -25);
        ctx.fillRect(cx - 14, cy - 4, 28, 20);

        ctx.fillStyle = color;
        ctx.fillRect(cx - 12, cy - 2, 24, 18);

        // Power distribution panels
        ctx.strokeStyle = this.shadeColor(color, -40);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                ctx.strokeRect(cx - 8 + i * 7, cy + j * 7, 5, 5);
            }
        }

        // Power lines on roof
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 2);
        ctx.lineTo(cx - 18, cy - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 12, cy - 2);
        ctx.lineTo(cx + 18, cy - 6);
        ctx.stroke();

        // Power indicator lights
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(cx - 6, cy + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6, cy + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();

        return this.canvasToImage(canvas);
    }

    /**
     * Generate all sprites and add to asset loader
     */
    generateAllSprites(assetLoader, color = '#4488ff') {
        console.log('[SpriteGenerator] Generating sprites with color:', color);

        // Generate all units
        assetLoader.assets.units.infantry = this.generateInfantry(color);
        assetLoader.assets.units.lightTank = this.generateLightTank(color);
        assetLoader.assets.units.mediumTank = this.generateMediumTank(color);
        assetLoader.assets.units.heavyTank = this.generateHeavyTank(color);
        assetLoader.assets.units.tank = this.generateMediumTank(color); // Fallback for old 'tank' references
        assetLoader.assets.units.harvester = this.generateHarvester(color);
        assetLoader.assets.units.artillery = this.generateArtillery(color);
        assetLoader.assets.units.flak = this.generateFlak(color);
        assetLoader.assets.units.scout = this.generateScout(color);
        assetLoader.assets.units.rocketSoldier = this.generateRocketSoldier(color);

        // Generate all buildings
        assetLoader.assets.buildings.hq = this.generateHQ(color);
        assetLoader.assets.buildings.barracks = this.generateBarracks(color);
        assetLoader.assets.buildings.factory = this.generateFactory(color);
        assetLoader.assets.buildings.derrick = this.generateDerrick(color);
        assetLoader.assets.buildings.turret = this.generateTurret(color);
        assetLoader.assets.buildings.powerPlant = this.generatePowerPlant(color);

        console.log('[SpriteGenerator] ✓ All sprites generated successfully');
        return true;
    }

    /**
     * Generate team-specific sprites (blue and red)
     */
    generateTeamSprites(assetLoader) {
        const blueColor = '#4488ff';
        const redColor = '#ff4444';

        // Generate blue team sprites
        console.log('[SpriteGenerator] Generating blue team sprites...');
        this.generateAllSprites(assetLoader, blueColor);

        // Store references for red team sprites
        const blueUnits = { ...assetLoader.assets.units };
        const blueBuildings = { ...assetLoader.assets.buildings };

        // Generate red team sprites
        console.log('[SpriteGenerator] Generating red team sprites...');
        this.generateAllSprites(assetLoader, redColor);

        // Store red sprites with suffix
        Object.entries(blueUnits).forEach(([name, img]) => {
            assetLoader.assets.units[name + '_red'] = assetLoader.assets.units[name];
        });

        Object.entries(blueBuildings).forEach(([name, img]) => {
            assetLoader.assets.buildings[name + '_red'] = assetLoader.assets.buildings[name];
        });

        // Restore blue sprites
        Object.assign(assetLoader.assets.units, blueUnits);
        Object.assign(assetLoader.assets.buildings, blueBuildings);

        console.log('[SpriteGenerator] ✓ Team sprites generated');
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpriteGenerator;
}

console.log('%c[SpriteGenerator] Sprite generation system loaded', 'color: #0f0; font-weight: bold');
