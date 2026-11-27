'use strict';
// 06c-rooms.js - Raumtypen der begehbaren Gebäude (WORLD.md §14): Boden, Möbel (solid = Collider), Beute-Behälter, Lichter, Bewohner.
// Jeder Maler bekommt K (Zeichen-/Sammelhilfen aus 06b-interiors.js) und den Raum r { x0,y0,x1,y1,w,h,cx,cy }. Helle Albedo - die Lightmap macht
// die Stimmung. Reihenfolge der Zufallsaufrufe muss deterministisch bleiben (Repaint nach Cache-Verdrängung).
// Exportiert: ROOM_PAINT

const ROOM_PAINT = {
  bar(K, r) {                                                              // Schachbrettfliesen, Theke, Hocker, Tische, rosa Neon
    K.checker(r, '#7a4a58', '#4a2c36'); K.box(r.x0 + 16, r.y0 + 18, r.w - 36, 16, '#8a6a52', '#d8a070');
    for (let x = r.x0 + 30; x < r.x1 - 24; x += 24) K.disc(x, r.y0 + 44, 6, '#2e2e34', '#8a8f99');
    for (const [fx, fy, an] of [[0.28, 0.7, 0], [0.72, 0.7, 2]]) { const tx = r.x0 + r.w * fx, ty = r.y0 + r.h * fy; K.disc(tx, ty, 14, '#6a5040', '#c09070', true); for (const a of [0, 2.1, 4.2]) K.box(tx + Math.cos(a) * 23 - 4, ty + Math.sin(a) * 23 - 4, 8, 8, '#3a3a44', '#6a6a78', false); K.light(tx, ty, 80, '#ffb070', 0.8); K.npc('gast', tx + 24, ty - 6, Math.PI * (an ? 0 : 1), true); }
    K.light(r.cx, r.y0 + 34, 120, '#ff3fa4', 0.85); K.loot('kasse', r.x1 - 36, r.y0 + 19, 16, 12); K.npc('wirt', r.cx - 16, r.y0 + 11, Math.PI / 2);
    K.g.fillStyle = 'rgba(255,63,164,0.25)'; K.g.fillRect(r.x0 + 4, r.y0 + 4, r.w - 8, 3);
  },
  imbiss(K, r) {
    K.checker(r, '#c8c4b8', '#a8a498', 12); K.box(r.x0 + 14, r.y0 + 16, r.w - 28, 14, '#d84a3a', '#ffb3a0'); K.disc(r.x0 + 30, r.y0 + 44, 5, '#2e2e34', '#8a8f99');
    for (const fx of [0.3, 0.7]) { const tx = r.x0 + r.w * fx, ty = r.y0 + r.h * 0.7; K.box(tx - 12, ty - 9, 24, 18, '#e8e0d0', '#9a9488'); K.light(tx, ty, 70, '#ffe8b0', 0.8); }
    K.light(r.cx, r.y0 + 30, 100, '#ffb070', 0.85); K.loot('kasse', r.x1 - 34, r.y0 + 17, 16, 12); K.npc('wirt', r.cx - 10, r.y0 + 10, Math.PI / 2); K.npc('gast', r.x0 + r.w * 0.7 + 18, r.y0 + r.h * 0.7, Math.PI, true);
  },
  kueche(K, r) {                                                           // Stahlboden, Arbeitsflächen, Herd, Kühlschrank
    K.rect(r.x0, r.y0, r.w, r.h, '#8a9098'); K.g.strokeStyle = 'rgba(0,0,0,0.18)'; K.g.lineWidth = 1; for (let x = r.x0; x < r.x1; x += 8) { K.g.beginPath(); K.g.moveTo(x, r.y0); K.g.lineTo(x, r.y1); K.g.stroke(); }
    K.box(r.x0 + 8, r.y0 + 8, r.w - 40, 18, '#b8bec6', '#e0e6ee'); K.box(r.x0 + 8, r.y0 + 26, 18, Math.max(20, r.h - 60), '#b8bec6', '#e0e6ee');
    for (const [dx, dy] of [[48, 17], [64, 17]]) K.disc(r.x0 + dx, r.y0 + dy, 5, '#1a1a1e', '#5a5f66');
    K.loot('kuehlschrank', r.x1 - 32, r.y1 - 36, 22, 26); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.7, '#d8ecff', 0.9); K.npc('koch', r.x0 + 58, r.y0 + 40, -Math.PI / 2);
  },
  lager(K, r) {                                                            // Beton, Kisten (teils Beute), Fässer
    K.rect(r.x0, r.y0, r.w, r.h, '#6a6a70'); K.noise(r);
    for (let i = 0; i < 4; i++) { const x = K.R(r.x0 + 12, r.x1 - 40), y = K.R(r.y0 + 12, r.y1 - 40); if (i < 2) K.loot('kiste', x, y, 24, 22); else K.box(x, y, 24, 24, '#9a7a4a', '#5a4020'); }
    K.disc(r.x1 - 22, r.y0 + 22, 10, '#a03a2a', '#e06a50', true); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.6, '#ffcf8a', 0.6);
  },
  wc(K, r) {
    for (let y = r.y0; y < r.y1; y += 8) for (let x = r.x0; x < r.x1; x += 8) { K.g.fillStyle = ((x + y) / 8) % 2 ? '#c8ccd4' : '#b4b8c0'; K.g.fillRect(x, y, 8, 8); }
    K.disc(r.cx, r.y0 + 20, 8, '#f4f6fa', '#9aa0aa', true); K.box(r.x0 + 10, r.cy - 8, 14, 16, '#e8ecf2', '#9aa0aa'); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.7, '#cfe6ff', 0.65);
  },
  hinterzimmer(K, r) {                                                     // Teppich, Sofa, Tisch mit Geld, Safe
    K.rect(r.x0, r.y0, r.w, r.h, '#5a4a72'); K.box(r.x0 + 12, r.y0 + 12, Math.min(70, r.w - 24), 22, '#8a3a52', '#c06a82');
    K.box(r.cx - 22, r.cy - 6, 44, 28, '#5a4030', '#a07050'); for (let i = 0; i < 5; i++) K.rect(r.cx - 16 + i * 7, r.cy + 2, 6, 10, '#3f9a5a');
    K.loot('safe', r.x1 - 30, r.y0 + 12, 18, 16); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.6, '#ffd08a', 0.75); K.npc('schieber', r.cx + 32, r.cy + 6, Math.PI);
  },
  spiel(K, r) {                                                            // Automatenreihen mit Bildschirm-Licht
    K.rect(r.x0, r.y0, r.w, r.h, '#2a2440'); K.noise(r, 0.05);
    const cols = ['#3fe8ff', '#ff3fa4', '#9dff4a', '#ffd84a']; let i = 0;
    for (let x = r.x0 + 14; x < r.x1 - 30; x += 28) for (const y of [r.y0 + 12, r.y1 - 40]) { const c = cols[i++ % 4]; K.box(x, y, 20, 26, '#1a1c26', '#4a4f66'); K.rect(x + 3, y + 3, 14, 10, c); K.light(x + 10, y + 13, 46, c, 0.55); }
    K.loot('kasse', r.cx - 10, r.cy - 6, 20, 12); K.npc('gast', r.x0 + 40, r.cy + 4, 0); K.npc('gast', r.x1 - 50, r.cy + 4, Math.PI);
  },
  pfand(K, r) {                                                            // Regale voller Ramsch, Theke, Safe
    K.rect(r.x0, r.y0, r.w, r.h, '#6a5a44'); K.noise(r);
    for (let x = r.x0 + 12; x < r.x1 - 30; x += 40) { K.box(x, r.y0 + 10, 30, 12, '#4a3a2a', '#8a6a4a'); K.loot('schublade', x + 6, r.y1 - 26, 18, 14); }
    K.box(r.x0 + 16, r.cy - 6, r.w - 40, 14, '#8a6a52', '#d8a070'); K.loot('safe', r.x1 - 30, r.y0 + 26, 18, 16); K.light(r.cx, r.cy, 110, '#ffcf8a', 0.8); K.npc('pfandleiher', r.cx, r.cy - 16, Math.PI / 2);
  },
  wohnzimmer(K, r) {                                                       // Holzboden, Sofa, Fernseher (flackerndes Blau), Teppich
    K.rect(r.x0, r.y0, r.w, r.h, '#8a6a4a'); K.g.strokeStyle = 'rgba(0,0,0,0.15)'; for (let y = r.y0; y < r.y1; y += 10) { K.g.beginPath(); K.g.moveTo(r.x0, y); K.g.lineTo(r.x1, y); K.g.stroke(); }
    K.rect(r.cx - 34, r.cy - 20, 68, 44, '#5a3a4a'); K.box(r.x0 + 12, r.y1 - 36, Math.min(80, r.w - 24), 22, '#3a4a6a', '#6a7a9a');
    K.box(r.x0 + 12, r.y0 + 10, 30, 12, '#1a1c22', '#3a3f4a'); K.rect(r.x0 + 15, r.y0 + 12, 24, 7, '#3fa8ff'); K.light(r.x0 + 28, r.y0 + 22, 90, '#3f9fff', 0.8);
    K.loot('schublade', r.x1 - 30, r.y0 + 10, 18, 14); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.6, '#ffc98a', 0.6); K.npc('bewohner', r.cx + 10, r.y1 - 46, -Math.PI / 2);
  },
  schlaf(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#6a5a7a'); K.box(r.x0 + 12, r.y0 + 12, 44, Math.min(70, r.h - 24), '#c8c0d8', '#8a82a0'); K.rect(r.x0 + 14, r.y0 + 14, 40, 14, '#e8e4f0');
    K.loot('schublade', r.x0 + 60, r.y0 + 14, 14, 14); K.loot('spind', r.x1 - 30, r.y0 + 10, 20, 24); K.light(r.x0 + 40, r.y0 + 40, 90, '#ffb98a', 0.6); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.55, '#c8a0ff', 0.4);
  },
  bad(K, r) {
    for (let y = r.y0; y < r.y1; y += 8) for (let x = r.x0; x < r.x1; x += 8) { K.g.fillStyle = ((x + y) / 8) % 2 ? '#bfe0e8' : '#a8ccd8'; K.g.fillRect(x, y, 8, 8); }
    K.box(r.x0 + 10, r.y0 + 10, 28, Math.min(60, r.h - 20), '#f4f6fa', '#9aa0aa'); K.disc(r.x1 - 24, r.y0 + 22, 8, '#f4f6fa', '#9aa0aa', true); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.7, '#cfe6ff', 0.7);
  },
  halle(K, r) {                                                            // Beton, Maschinen, Kisten, rote Fässer, Gabelstapler
    K.rect(r.x0, r.y0, r.w, r.h, '#62646c'); K.noise(r, 0.07); K.g.strokeStyle = 'rgba(255,214,60,0.5)'; K.g.setLineDash([10, 8]); K.g.strokeRect(r.x0 + 14, r.y0 + 14, r.w - 28, r.h - 28); K.g.setLineDash([]);
    for (let i = 0; i < 3; i++) { const x = r.x0 + 24 + i * Math.max(50, (r.w - 80) / 3), y = r.y0 + 20; K.box(x, y, 40, 28, '#3a4252', '#7a8aa8'); K.rect(x + 5, y + 5, 10, 6, ['#ff3b4a', '#9dff4a', '#ffd84a'][i]); K.light(x + 10, y + 12, 50, ['#ff3b4a', '#9dff4a', '#ffd84a'][i], 0.5); }
    K.loot('kiste', r.x0 + 28, r.y1 - 50, 24, 22); K.loot('kiste', r.x1 - 56, r.y1 - 44, 24, 22); K.disc(r.x1 - 24, r.cy, 9, '#a03a2a', '#e06a50', true); K.disc(r.x1 - 24, r.cy + 20, 9, '#a03a2a', '#e06a50', true);
    K.box(r.cx - 20, r.cy + 4, 40, 20, '#d8a82a', '#8a6a10'); for (const [dx, dy] of [[-0.5, 0.4], [0.5, 0.2]]) K.light(r.cx + dx * r.w * 0.5, r.cy + dy * r.h * 0.4, Math.max(r.w, r.h) * 0.6, '#cfe6ff', 0.55); K.npc('arbeiter', r.cx - 40, r.cy - 14, 0);
  },
  buero(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#7a7c86'); K.box(r.x0 + 14, r.y0 + 14, Math.min(60, r.w - 28), 26, '#6a5238', '#a88858'); K.box(r.x0 + 30, r.y0 + 44, 14, 12, '#3a3a44', '#6a6a78', false);
    K.loot('safe', r.x1 - 30, r.y1 - 32, 18, 16); K.loot('schublade', r.x1 - 30, r.y0 + 12, 16, 14); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.6, '#ffe8b0', 0.7);
  },
  huette(K, r) {                                                           // Bretter, Matratze, Feuertonne, Kisten
    K.rect(r.x0, r.y0, r.w, r.h, '#6a5a44'); K.g.strokeStyle = 'rgba(0,0,0,0.2)'; for (let y = r.y0; y < r.y1; y += 9) { K.g.beginPath(); K.g.moveTo(r.x0, y); K.g.lineTo(r.x1, y); K.g.stroke(); } K.noise(r);
    K.box(r.x0 + 10, r.y1 - 36, 40, 24, '#8a7a9a', '#5a4a6a'); K.disc(r.x1 - 22, r.y0 + 24, 10, '#2a2218', '#c8a060', true); K.light(r.x1 - 22, r.y0 + 24, 120, '#ff8a30', 0.9);
    K.loot('kiste', r.x0 + 12, r.y0 + 12, 22, 20); K.loot('schublade', r.cx, r.y0 + 10, 16, 14); K.npc('bewohner', r.cx - 6, r.cy + 8, 0);
  },
  salon(K, r) {                                                            // Marmor, Flügel, Sofas, Statuen, Kronleuchter
    K.checker(r, '#d8d4de', '#b8b4c0', 20); K.rect(r.cx - 40, r.cy - 28, 80, 56, '#5a2a3a');
    K.g.fillStyle = 'rgba(0,0,0,0.4)'; K.g.beginPath(); K.g.ellipse(r.x0 + 40, r.y0 + 34, 28, 20, 0.3, 0, TAU); K.g.fill(); K.g.fillStyle = '#14141a'; K.g.beginPath(); K.g.ellipse(r.x0 + 38, r.y0 + 32, 28, 20, 0.3, 0, TAU); K.g.fill(); K.box(r.x0 + 22, r.y0 + 24, 30, 16, 'rgba(0,0,0,0)', null, true);
    K.box(r.x1 - 70, r.y1 - 34, 56, 20, '#7a3a52', '#c06a82'); K.disc(r.x1 - 20, r.y0 + 22, 8, '#e8e4f0', '#9a96a8', true);
    K.loot('truhe', r.x0 + 14, r.y1 - 34, 24, 18); K.loot('schublade', r.x1 - 34, r.y0 + 42, 18, 14); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.9, '#ffd8a0', 0.95); K.npc('diener', r.cx + 30, r.y1 - 46, Math.PI);
  },
  arbeit(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#6a4a34'); K.box(r.x0 + 12, r.y0 + 10, r.w - 24, 12, '#3a2a1e', '#8a6a4a'); K.box(r.cx - 22, r.cy - 4, 44, 22, '#4a3224', '#a88858');
    K.loot('safe', r.x1 - 30, r.y1 - 32, 18, 16); K.loot('truhe', r.x0 + 12, r.y1 - 32, 22, 18); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.65, '#ffc98a', 0.7);
  },
  empfang(K, r) {                                                          // Fliesen, Tresen mit Terminal, Pflanzen
    K.checker(r, '#aab2bc', '#98a0aa', 16); K.box(r.x0 + 16, r.y0 + 18, r.w - 36, 16, '#2a3040', '#3fe8ff'); K.rect(r.cx - 12, r.y0 + 20, 24, 8, '#3fe8ff');
    K.disc(r.x0 + 18, r.y1 - 20, 9, '#2f6a4a', '#7dffd8'); K.disc(r.x1 - 18, r.y1 - 20, 9, '#2f6a4a', '#7dffd8'); K.loot('kasse', r.x1 - 34, r.y0 + 19, 16, 12);
    K.light(r.cx, r.y0 + 30, 110, '#3fe8ff', 0.8); K.light(r.cx, r.cy + 20, 120, '#d8ecff', 0.7); K.npc('empfang', r.cx + 14, r.y0 + 10, Math.PI / 2);
  },
  kapseln(K, r) {                                                          // Schlafkapseln 64 x 32 in Reihen, Cyan-Licht
    K.rect(r.x0, r.y0, r.w, r.h, '#4a5260'); K.noise(r, 0.05);
    for (const y of [r.y0 + 10, r.y1 - 42]) for (let x = r.x0 + 12; x + 64 < r.x1 - 6; x += 70) { K.box(x, y, 64, 32, '#d8dce4', '#8a92a0'); K.rect(x + 4, y + 4, 56, 24, '#1a2230'); K.rect(x + 6, y + 6, 20, 20, '#3fe8ff'); K.light(x + 32, y + 16, 54, '#3fe8ff', 0.6); }
    K.loot('spind', r.cx - 10, r.cy - 12, 20, 24); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.6, '#9fe8ff', 0.5); K.npc('schnarcher', r.x0 + 44, r.y0 + 26, 0, true);
  },
  waesche(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#6a8a96'); for (let x = r.x0 + 12; x + 36 < r.x1 - 8; x += 44) { K.box(x, r.y0 + 12, 36, 40, '#dfe8ee', '#7ab0c0'); K.rect(x + 6, r.y0 + 18, 24, 12, '#3fe8ff'); K.light(x + 18, r.y0 + 30, 56, '#3fe8ff', 0.6); }
    K.loot('spind', r.x1 - 30, r.y1 - 34, 20, 24); K.light(r.cx, r.cy, 120, '#cfe6ff', 0.7);
  },
  waffenladen(K, r) {                                                      // Theke, Wandregale mit Waffen
    K.rect(r.x0, r.y0, r.w, r.h, '#5a5e68'); K.noise(r); K.box(r.x0 + 14, r.cy, r.w - 28, 14, '#2a2e38', '#c8452f');
    for (let x = r.x0 + 12; x + 28 < r.x1 - 8; x += 34) { K.box(x, r.y0 + 8, 28, 10, '#1c1e26', '#6a6e7a'); K.rect(x + 3, r.y0 + 11, 22, 3, '#8a8f99'); }
    K.loot('kiste', r.x1 - 32, r.y1 - 32, 22, 20); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.7, '#ffb98a', 0.85); K.npc('haendler', r.cx, r.cy - 14, Math.PI / 2);
  },
  wache(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#6a7280'); K.noise(r, 0.05); K.box(r.x0 + 14, r.y0 + 14, 60, 22, '#4a5260', '#8a92a0'); K.box(r.x1 - 74, r.y0 + 14, 60, 22, '#4a5260', '#8a92a0');
    for (let x = r.x0 + 12; x + 20 < r.x1 - 10; x += 24) K.loot('spind', x, r.y1 - 36, 20, 24); K.light(r.cx, r.cy, 130, '#cfe6ff', 0.75); K.npc('od', r.x0 + 44, r.y0 + 46, Math.PI / 2);
  },
  zellen(K, r) {                                                           // Zellen mit Gitterstäben
    K.rect(r.x0, r.y0, r.w, r.h, '#4a4e5a'); const n = Math.max(2, Math.floor(r.w / 46));
    for (let i = 0; i < n; i++) { const x = r.x0 + 8 + i * ((r.w - 16) / n), w = (r.w - 16) / n - 4; K.box(x, r.y0 + 8, w, r.h * 0.55, 'rgba(0,0,0,0.2)', '#8a92a0', true); K.g.strokeStyle = '#aab2c0'; for (let b = 0; b < w; b += 6) { K.g.beginPath(); K.g.moveTo(x + b, r.y0 + 8); K.g.lineTo(x + b, r.y0 + 8 + r.h * 0.55); K.g.stroke(); } K.box(x + 4, r.y0 + 12, 14, 24, '#8a8f99', '#5a5f66', false); }
    K.light(r.cx, r.cy, 110, '#c8d8ff', 0.6); K.npc('gefangener', r.x0 + 30, r.y0 + 40, 0, true);
  },
  behandlung(K, r) {                                                       // Liege, Geräte, Instrumente
    K.rect(r.x0, r.y0, r.w, r.h, '#c8d8e0'); K.noise(r, 0.04); K.box(r.cx - 22, r.cy - 12, 44, 30, '#e8f0f4', '#8ab0c0'); K.rect(r.cx - 20, r.cy - 10, 14, 26, '#3fe8ff');
    K.box(r.x0 + 12, r.y0 + 10, 26, 14, '#2a3a4a', '#3fe8ff'); K.loot('spind', r.x1 - 30, r.y0 + 10, 20, 24); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.8, '#e8f8ff', 0.95); K.npc('aerztin', r.cx + 30, r.cy, Math.PI);
  },
  betten(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#b8c8d0'); for (let x = r.x0 + 12; x + 40 < r.x1 - 6; x += 52) for (const y of [r.y0 + 10, r.y1 - 52]) { K.box(x, y, 40, 40, '#e8f0f4', '#8ab0c0'); K.rect(x + 3, y + 3, 34, 12, '#cfe6ff'); }
    K.loot('schublade', r.cx - 8, r.cy - 7, 16, 14); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.8, '#e8f8ff', 0.85); K.npc('patient', r.x0 + 32, r.y0 + 30, 0, true);
  },
  labor(K, r) {
    K.rect(r.x0, r.y0, r.w, r.h, '#c8d4dc'); K.noise(r, 0.04); for (let x = r.x0 + 14; x + 40 < r.x1 - 8; x += 52) { K.box(x, r.y0 + 14, 40, 18, '#e8f0f4', '#8ab0c0'); K.rect(x + 6, r.y0 + 18, 4, 10, '#ff3fa4'); K.rect(x + 14, r.y0 + 18, 4, 10, '#9dff4a'); K.rect(x + 22, r.y0 + 18, 4, 10, '#3fe8ff'); }
    K.box(r.cx - 26, r.cy, 52, 22, '#dfe8ee', '#7ab0c0'); K.loot('spind', r.x1 - 30, r.y1 - 34, 20, 24); K.light(r.cx, r.cy, Math.max(r.w, r.h) * 0.8, '#e8f8ff', 0.95); K.npc('forscher', r.cx - 40, r.cy - 12, 0);
  },
  terminalraum(K, r) {                                                     // MANDAT-Magenta: Terminalwand, Stühle
    K.rect(r.x0, r.y0, r.w, r.h, '#3a2a44'); for (let x = r.x0 + 12; x + 28 < r.x1 - 8; x += 36) { K.box(x, r.y0 + 10, 28, 20, '#1a1220', '#ff3fa4'); K.rect(x + 4, r.y0 + 14, 20, 10, '#ff3fa4'); K.light(x + 14, r.y0 + 22, 60, '#ff3fa4', 0.6); K.box(x + 8, r.y0 + 40, 12, 12, '#5a4a6a', '#8a7a9a', false); }
    K.loot('schublade', r.x1 - 30, r.y1 - 30, 18, 14); K.light(r.cx, r.cy, 120, '#ff3fa4', 0.7); K.npc('schreiber', r.cx, r.cy + 14, Math.PI * 1.5);
  }
};
