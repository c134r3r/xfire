// Weathering styles per faction (see kit.js for what the fields do).
// camo / camo2 = [r, g, b multiplier, amount] for the two darker tones.
const dustSand = '#a08660';
export const STYLES = {
    survivors: {
        // olive drab with dark-green and earth-brown disruptive blotches
        unit: { camo: [0.6, 0.66, 0.52, 0.85], camo2: [1.05, 0.8, 0.55, 0.7], dust: dustSand, dustAmt: 0.75, dustH: 5, grunge: 0.34, streaks: 0.7, chips: 0.7, seed: 3 },
        trooper: { camo: [0.62, 0.68, 0.54, 0.6], camo2: [1.0, 0.8, 0.6, 0.4], dust: dustSand, dustAmt: 0.45, dustH: 3, grunge: 0.25, streaks: 0, chips: 0 },
        building: { camo: [0.7, 0.74, 0.6, 0.55], camo2: [1.02, 0.84, 0.62, 0.35], dust: dustSand, dustAmt: 0.6, dustH: 4.5, grunge: 0.36, streaks: 1.0, chips: 0.45, seed: 9 }
    },
    evolved: {
        // hide and chitin: mottled, blotchy, dusty feet
        unit: { camo: [0.55, 0.5, 0.48, 0.8], camo2: [1.2, 1.08, 0.86, 0.6], dust: '#94765a', dustAmt: 0.65, dustH: 4, grunge: 0.62, film: 0.25, streaks: 0.3, chips: 0, seed: 5 },
        building: { camo: [0.58, 0.52, 0.5, 0.7], camo2: [1.18, 1.06, 0.86, 0.5], dust: '#8a6c50', dustAmt: 0.65, dustH: 6, grunge: 0.62, streaks: 0.8, chips: 0, seed: 12 }
    },
    series9: {
        // machined alloy: clean panels, light soot, almost no dust
        unit: { camo: [0.8, 0.82, 0.86, 0.35], camo2: [1, 1, 1, 0], dust: '#7a7468', dustAmt: 0.3, dustH: 2.5, grunge: 0.2, streaks: 0.45, chips: 0.35, seed: 7, panel: 5.5, film: 0.15 },
        building: { camo: [0.84, 0.86, 0.9, 0.3], camo2: [1, 1, 1, 0], dust: '#7a7468', dustAmt: 0.4, dustH: 3.5, grunge: 0.24, streaks: 0.8, chips: 0.3, seed: 14, panel: 9, film: 0.2 }
    }
};
for (const f of Object.values(STYLES)) { f.flamer = f.flamer || f.trooper; f.rocketeer = f.rocketeer || f.trooper; }
