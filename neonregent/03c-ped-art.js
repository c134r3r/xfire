'use strict';
// 03c-ped-art.js - Menschen von oben (PLAN R11, Fallback-Art): Rig mit Beinen, Armen, Torso, Kopf, 8 Laufphasen, Varianten
// (Mantel, Hose, Haar, Hauttyp, Kapuze/Mütze/Visier, Rucksack, leuchtende Sohlen, Regenschirm). Wird in MS3 durch das gebackene Rig ersetzt.
// Blick nach +x. Exportiert: PED_DESIGNS, PLAYER_DESIGN, personFrame, corpseSprite, umbrellaSprite, drawPerson, pickDesign

const PD = 3;                                                    // Sprite-Auflösung
const PED_COATS = ['#7a5a9c', '#3f7a8f', '#9a4a4a', '#6a6a78', '#a08a50', '#4c4c5c', '#b05a80', '#2f6a4a', '#a05a2a', '#3a4a7a', '#c9c9d2', '#5a3a6a'];
const PED_PANTS = ['#1c2030', '#2a2a34', '#3a3226', '#202a3a', '#2e2230'];
const PED_SKIN = ['#e6c3a0', '#c9966c', '#8d5a3b', '#5e3b2a', '#f1d5b8'];
const PED_HAIR = ['#151824', '#3a2a20', '#8a6a3a', '#b8b8c4', '#ff3fa4', '#3fe8ff', '#6a3a2a'];
const PED_UMB = ['#ff3fa4', '#3fe8ff', '#ffd84a', '#9dff4a', '#a66bff', '#ff6a3a'];
const PED_TRIM = ['#ff3fa4', '#3fe8ff', '#9dff4a', '#ffd84a', null, null];

// 48 feste Entwürfe (deterministisch). voice = Stimmtyp für die Aufnahmen (mann/frau/alt/jung)
const PED_DESIGNS = (() => {
  const r = rng(4711), pk = a => a[Math.floor(r() * a.length)], out = [];
  for (let i = 0; i < 48; i++) {
    const vt = r(), voice = vt < 0.36 ? 'mann' : vt < 0.68 ? 'frau' : vt < 0.84 ? 'alt' : 'jung', ht = r();
    out.push({ id: i, voice, coat: pk(PED_COATS), pants: pk(PED_PANTS), skin: pk(PED_SKIN), hair: voice === 'alt' ? '#b8b8c4' : pk(PED_HAIR), shoe: r() < 0.5 ? '#14161e' : '#2a2a36',
      hat: ht < 0.42 ? 'none' : ht < 0.68 ? 'hood' : ht < 0.84 ? 'cap' : 'visor', pack: r() < 0.25, umb: r() < 0.4 ? pk(PED_UMB) : null, glow: r() < 0.25 ? pk(['#3fe8ff', '#ff3fa4', '#9dff4a']) : null,
      trim: pk(PED_TRIM), scale: 0.95 + r() * 0.12, wide: 0.9 + r() * 0.25 });
  }
  return out;
})();
const PLAYER_DESIGN = { id: 'p', gun: false, voice: 'mann', coat: '#34455f', pants: '#1a2230', skin: '#d9b08a', hair: '#0c0e14', shoe: '#0a0c12', hat: 'visor', pack: false, umb: null, glow: '#3fe8ff', trim: '#3fe8ff', scale: 1.08, wide: 1.1 };
const PLAYER_ARMED = Object.assign({}, PLAYER_DESIGN, { id: 'pg', gun: true });     // Pistole in der rechten Hand
function pickDesign(rnd) { return PED_DESIGNS[Math.floor(rnd() * PED_DESIGNS.length)]; }

function pRect(g, x, y, w, h, c, r = 1.2) { g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); }
// Rig zeichnen: s = Laufphase sin (−1..1), Mitte des Körpers bei (0,0)
function pRig(g, d, s, mode) {
  const sc = d.scale, wd = d.wide;
  g.save(); g.scale(sc, sc);
  if (mode === 'dead') { pRigDead(g, d); g.restore(); return; }
  for (const sg of [-1, 1]) {                                                                                    // Beine (hinter dem Torso)
    const lx = sg * s * 5.2 - 1;
    pRect(g, lx - 4.5, sg * 2.7 * wd - 1.8, 9, 3.6, d.pants, 1.6);                                               // Hose
    pRect(g, lx + 1.2, sg * 2.7 * wd - 1.6, 4.4, 3.2, shade(d.pants, 18), 1.4);                                  // Knie/Schienbein heller
    g.fillStyle = d.shoe; g.beginPath(); g.ellipse(lx + 4.6, sg * 2.7 * wd, 3.1, 2.3, 0, 0, TAU); g.fill();       // Schuh
    if (d.glow) { g.fillStyle = d.glow; g.fillRect(lx + 6.6, sg * 2.7 * wd - 1.3, 1.5, 2.6); }                                              // leuchtende Sohle (Spitze)
  }
  if (d.pack) { pRect(g, -7.4, -3.6, 4.6, 7.2, '#15171f', 1.8); g.fillStyle = d.trim || '#ffb35c'; g.fillRect(-6.8, -0.5, 1.6, 1); }          // Rucksack
  for (const sg of [-1, 1]) {                                                                                     // Arme
    const gun = d.gun && sg === 1, ax = gun ? 3.6 : -sg * s * 3.6;
    pRect(g, ax - 3.6, sg * 6.5 * wd - 1.7, gun ? 9.2 : 7.2, 3.4, shade(d.coat, -22), 1.6);
    g.fillStyle = d.skin; g.beginPath(); g.arc(ax + (gun ? 5.9 : 3.7), sg * 6.5 * wd, 1.7, 0, TAU); g.fill();    // Hand
    if (gun) { pRect(g, ax + 5.6, sg * 6.5 * wd - 1.3, 6.2, 2.6, '#101218', 0.8); g.fillStyle = '#3fe8ff'; g.fillRect(ax + 10.6, sg * 6.5 * wd - 0.5, 1.2, 1); }   // Pistole mit Visier-LED
  }
  g.fillStyle = shade(d.coat, -30); g.beginPath(); g.ellipse(0, 0, 4.2, 7.9 * wd, 0, 0, TAU); g.fill();         // Torso
  g.fillStyle = d.coat; g.beginPath(); g.ellipse(-0.3, 0, 3.6, 7.2 * wd, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.ellipse(0.6, -1.5, 2, 4 * wd, 0, 0, TAU); g.fill();
  if (d.trim) { g.strokeStyle = d.trim; g.lineWidth = 1; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(-3.6, -5 * wd); g.lineTo(-3.8, 5 * wd); g.stroke(); g.globalAlpha = 1; }   // Neon-Naht am Rücken
  g.fillStyle = shade(d.coat, -45); g.fillRect(2.6, -1, 1.2, 2);                                                  // Kragen
  // Kopf
  const hx = 0.9;
  if (d.hat === 'hood') { g.fillStyle = shade(d.coat, -25); g.beginPath(); g.arc(hx - 0.6, 0, 4.7, 0, TAU); g.fill(); g.fillStyle = d.coat; g.beginPath(); g.arc(hx - 0.8, 0, 4.1, 0, TAU); g.fill(); g.fillStyle = d.skin; g.beginPath(); g.ellipse(hx + 2.6, 0, 1.5, 2.3, 0, 0, TAU); g.fill(); }
  else {
    g.fillStyle = d.skin; g.beginPath(); g.arc(hx, 0, 3.7, 0, TAU); g.fill();
    g.fillStyle = d.hair; g.beginPath(); g.arc(hx - 0.7, 0, 3.6, Math.PI * 0.42, Math.PI * 1.58); g.fill(); g.beginPath(); g.arc(hx - 0.2, 0, 3.2, 0, TAU); g.fill();
    if (d.hat === 'cap') { g.fillStyle = shade(d.coat, -10); g.beginPath(); g.arc(hx - 0.2, 0, 3.8, 0, TAU); g.fill(); pRect(g, hx + 2.4, -2.6, 3.6, 5.2, shade(d.coat, -35), 1.6); }
    if (d.hat === 'visor') { g.fillStyle = '#05070c'; g.fillRect(hx + 1.8, -3.5, 2.2, 7); g.fillStyle = d.id === 'p' ? '#3fe8ff' : d.trim || '#3fe8ff'; g.fillRect(hx + 2.4, -3.1, 1, 6.2); }       // Neon-Visier
  }
  g.restore();
}
function pRigDead(g, d) {                                         // liegend: Arme und Beine gespreizt
  for (const sg of [-1, 1]) { pRect(g, -2, sg * 4.2 - 1.8, 11, 3.6, d.pants, 1.6); g.fillStyle = d.shoe; g.beginPath(); g.ellipse(9.4, sg * 4.6, 2.6, 2, 0, 0, TAU); g.fill(); }
  for (const sg of [-1, 1]) { g.save(); g.translate(-1, sg * 5); g.rotate(sg * 0.9); pRect(g, -1, -1.7, 8, 3.4, shade(d.coat, -22), 1.6); g.fillStyle = d.skin; g.beginPath(); g.arc(7.4, 0, 1.7, 0, TAU); g.fill(); g.restore(); }
  g.fillStyle = shade(d.coat, -30); g.beginPath(); g.ellipse(-4, 0, 4.4, 7.3, 0, 0, TAU); g.fill(); g.fillStyle = d.coat; g.beginPath(); g.ellipse(-4.2, 0, 3.8, 6.6, 0, 0, TAU); g.fill();
  g.fillStyle = d.skin; g.beginPath(); g.arc(-10, 0.5, 3.5, 0, TAU); g.fill(); g.fillStyle = d.hair; g.beginPath(); g.arc(-10.6, 0.5, 3.2, 0, TAU); g.fill();
}
// Gecachtes Laufphasen-Sprite (0..7). Rückgabe: Canvas, Mitte = Körpermitte
function personFrame(d, f) {
  return sprite('person|' + d.id + '|' + f, 44 * PD, 44 * PD, g => { g.scale(PD, PD); pRig(g, d, Math.sin(f / 8 * TAU), 'walk'); });
}
function corpseSprite(d) { return sprite('corpse|' + d.id, 44 * PD, 44 * PD, g => { g.scale(PD, PD); pRig(g, d, 0, 'dead'); g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fillRect(-14, -9, 28, 18); }); }
function umbrellaSprite(color) {
  return sprite('umb|' + color, 40 * PD, 40 * PD, g => {
    g.scale(PD, PD); const R0 = 11;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(1.2, 1.6, R0, 0, TAU); g.fill();
    g.fillStyle = color; g.globalAlpha = 0.8; g.beginPath(); g.arc(0, 0, R0, 0, TAU); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 8; i++) { g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i / 8 * TAU) * R0, Math.sin(i / 8 * TAU) * R0); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, R0 - 0.6, 0, TAU); g.stroke();
    g.fillStyle = '#12141a'; g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill();
  });
}
// Mensch an (x,y), Blickrichtung a, Phase f. o: { alpha, scale, umbrella, tint }
function drawPerson(x, y, a, d, f, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); if (o.scale) ctx.scale(o.scale, o.scale); if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  const img = o.dead ? corpseSprite(d) : personFrame(d, f & 7); ctx.drawImage(img, -22, -22, 44, 44); ctx.restore(); ctx.globalAlpha = 1;
}

// Splat auf dem Boden (stilisiert, PLAN D10): dunkle Lache mit Spritzern. Einstellung "Blut aus" -> Ölfleck
function splatSprite(v) {
  const blood = Settings.d.blood;
  return sprite('splat|' + v + '|' + blood, 96, 96, g => withSeed(300 + v, () => {
    const c = blood ? '70,10,20' : '18,20,28';
    for (let i = 0; i < 6; i++) { const a = rand(0, TAU), d = rand(0, 14), r = rand(8, 16), x = Math.cos(a) * d, y = Math.sin(a) * d, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},0.85)`); gr.addColorStop(0.7, `rgba(${c},0.55)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    for (let i = 0; i < 14; i++) { const a = rand(0, TAU), d = rand(16, 40); g.fillStyle = `rgba(${c},${rand(0.4, 0.8)})`; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, rand(1, 3.2), rand(0.8, 2), a, 0, TAU); g.fill(); }
  }));
}
