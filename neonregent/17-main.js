'use strict';
// 17-main.js - Zustandsautomat, fixer 60-Hz-Takt, Testfeld (MS0), Debug-Tasten, Szenen, NR_TEST, Boot (PLAN §4.4, §4.12).
// Exportiert: window.NR_TEST, startGame, SCENES

// ------------------------------------------------------------------
// Testfeld (MS0): kleine Kreuzung mit vier Blöcken, Laternen und Neon. Ersetzt in MS1 durch den Stadtgenerator.
// ------------------------------------------------------------------
function buildArena() {
  const T = C.TILE, cols = C.ARENA_W / T, rows = C.ARENA_H / T;
  const rH = gy => gy >= 12 && gy <= 15, rV = gx => gx >= 18 && gx <= 21;
  const A = {
    w: C.ARENA_W, h: C.ARENA_H, cols, rows,
    tileAt(gx, gy) {                                    // -1 außerhalb, 0 Straße, 1 Gehweg, 2 Grundstück
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
      if (rH(gy) || rV(gx)) return 0;
      if (gy === 11 || gy === 16 || gx === 17 || gx === 22 || gx === 0 || gy === 0 || gx === cols - 1 || gy === rows - 1) return 1;
      return 2;
    },
    laneH(gx, gy) { return (gy === 13 || gy === 14) && !rV(gx); },
    laneV(gx, gy) { return (gx === 19 || gx === 20) && !rH(gy); }
  };
  G.arena = A;
  const cols2 = ['#2b3040', '#303546', '#262b3a', '#34364a'];
  G.solids = [[2, 2, 16, 10], [24, 2, 38, 10], [2, 18, 16, 26], [24, 18, 38, 26]].map(([a, b, c, d], i) => ({ x0: a * T, y0: b * T, x1: c * T, y1: d * T, col: cols2[i] }));
  G.lamps = []; let n = 0;
  const lamp = (x, y, type, pole = true) => G.lamps.push({ x, y, type, pole, ph: n++ * 1.7 });
  for (let gx = 2; gx < cols - 2; gx += 4) if (!(gx >= 16 && gx <= 23)) { lamp(gx * T + 32, 11 * T + 32, n % 2 ? 'sodium' : 'led'); lamp(gx * T + 32, 16 * T + 32, n % 2 ? 'led' : 'sodium'); }
  for (let gy = 2; gy < rows - 2; gy += 4) if (!(gy >= 11 && gy <= 16)) { lamp(17 * T + 32, gy * T + 32, 'sodium'); lamp(22 * T + 32, gy * T + 32, 'led'); }
  lamp(8 * T, 10 * T + 20, 'neonPink', false); lamp(30 * T, 10 * T + 20, 'neonCyan', false);
  lamp(8 * T, 18 * T - 20, 'neonGreen', false); lamp(30 * T, 18 * T - 20, 'neonPink', false);
}

function newPlayer() {
  return { x: 19.5 * C.TILE, y: 11.5 * C.TILE, vx: 0, vy: 0, a: 0, r: C.PED_R, hp: 100, maxHp: 100, walk: 0, stamina: C.STAMINA, dodge: 0, dodgeCd: 0 };
}

// Platzhalter-Spieler zu Fuß (PLAN §4.7: Ironclad-Inertia, Kreis gegen AABBs, Sprint mit Ausdauer, Ausweichrolle)
function updatePlayer() {
  const p = G.player, i = G.in, A = G.arena;
  const ap = aimPoint(); p.a = Math.atan2(ap.y - p.y, ap.x - p.x);
  const sprint = i.sprint && p.stamina > 1 && (i.mx || i.my);
  const sp = sprint ? C.PLAYER_SPRINT : C.PLAYER_WALK;
  p.stamina = clamp(p.stamina + (sprint ? -C.STAMINA_DRAIN : C.STAMINA_REGEN), 0, C.STAMINA);
  if (p.dodgeCd > 0) p.dodgeCd--;
  if (i.dodgeP && p.dodgeCd <= 0 && p.dodge <= 0) { p.dodge = Math.round(C.DODGE_S * 60); p.dodgeCd = Math.round(C.DODGE_CD_S * 60); p.dvx = (i.mx || Math.cos(p.a)) * 5.2; p.dvy = (i.my || Math.sin(p.a)) * 5.2; Bus.emit('dodge', p); }
  if (p.dodge > 0) { p.dodge--; p.vx = p.dvx; p.vy = p.dvy; }
  else { p.vx += (i.mx * sp - p.vx) * 0.2; p.vy += (i.my * sp - p.vy) * 0.2; }
  p.x += p.vx; p.y += p.vy;
  p.walk += Math.hypot(p.vx, p.vy);
  p.x = clamp(p.x, C.TILE, A.w - C.TILE); p.y = clamp(p.y, C.TILE, A.h - C.TILE);
  for (const b of G.solids) {                              // Kreis gegen AABB herausschieben
    const cx = clamp(p.x, b.x0, b.x1), cy = clamp(p.y, b.y0, b.y1), dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d < p.r && d > 0.0001) { p.x = cx + dx / d * p.r; p.y = cy + dy / d * p.r; }
    else if (d <= 0.0001 && p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1) p.y = b.y0 - p.r;
  }
}

// ------------------------------------------------------------------
// Zustand und Schleife
// ------------------------------------------------------------------
function startGame(scene) {
  G.parts.length = 0; G.texts.length = 0; G.decals.length = 0; G.trauma = 0; G.zoomPunch = 0; G.time = 0; G.freeze = 0; G.heat = 0; G.credits = 0;
  G.player = newPlayer(); G.zoomBase = C.ZOOM_FOOT; G.sceneLabel = '';
  if (scene) R.set(7741); else R.fn = Math.random;
  const S = scene && SCENES[scene]; if (S) { S.setup(); G.sceneLabel = STR.banner.scene(scene) + ' · Platzhalter (MS0)'; }
  G.cam.x = G.player.x; G.cam.y = G.player.y; updateCamera(true);
  G.state = 'play'; $('menuScreen').classList.add('hidden'); $('pauseScreen').classList.add('hidden');
  Aud.init(); Aud.setInside(false);
  HUD.banner(STR.banner.start, STR.banner.startSub);
}
function setPaused(on) {
  if (on && G.state === 'play') { G.state = 'paused'; $('pauseScreen').classList.remove('hidden'); }
  else if (!on && G.state === 'paused') { G.state = 'play'; $('pauseScreen').classList.add('hidden'); }
}
function toMenu() { G.state = 'menu'; G.player = null; $('pauseScreen').classList.add('hidden'); $('menuScreen').classList.remove('hidden'); }

// Testszenen (§4.12): fester Seed, feste Kamera. MS0: Platzhalter-Positionen im Testfeld; echte Orte ab MS1.
const T_ = C.TILE;
const SCENES = {
  docks_street:  { setup() { tp(6.5 * T_, 11.5 * T_); } },
  neon_crossing: { setup() { tp(19.5 * T_, 13.5 * T_); } },
  krone_palace:  { setup() { tp(31.5 * T_, 16.5 * T_); } },
  police_l3:     { setup() { tp(19.5 * T_, 20.5 * T_); } },
  police_l5:     { setup() { tp(19.5 * T_, 5.5 * T_); } },
  mandat_call:   { setup() { tp(10.5 * T_, 16.5 * T_); } },
  execution:     { setup() { tp(28.5 * T_, 11.5 * T_); } },
  dawn:          { setup() { tp(19.5 * T_, 11.5 * T_); } },
  runover:       { setup() { tp(19.5 * T_, 13.5 * T_); } },
  interior:      { setup() { tp(8.5 * T_, 11.5 * T_); } },
  explosion:     { setup() { tp(19.5 * T_, 11.5 * T_); G.sceneEvents = [[40, () => explosion(19.5 * T_ + 150, 13 * T_, 1.8)], [58, () => explosion(19.5 * T_ - 120, 14 * T_, 1.0)]]; } }
};
function tp(x, y) { G.player.x = x; G.player.y = y; G.cam.x = x; G.cam.y = y; }

function step() {
  G.time++;
  G.trauma = Math.max(0, G.trauma - 0.024); G.hurtFlash *= 0.9; G.zoomPunch *= 0.9; G.kickX *= 0.75; G.kickY *= 0.75;
  if (G.freeze > 0) { G.freeze--; return; }
  Input.poll();
  if (G.sceneEvents) for (const e of G.sceneEvents) if (e[0] === G.time) e[1]();
  updatePlayer();
  updateParticles();
  updateCamera();
  HUD.tick();
}

// Globale Tasten einmal pro Frame (Pause, Ton, Vollbild, Debug)
let dbgSize = 0, dbgVoice = 0, dbgOver = 0;
function globalKeys() {
  if (Input.took('Fullscreen')) toggleFullscreen();
  if (Input.took('KeyM')) { Aud.init(); Aud.toggleMute(); HUD.banner(Aud.muted ? 'TON AUS' : 'TON AN', '', 900); }
  if (Input.took('KeyP') || Input.took('Escape')) { if (G.state === 'play') setPaused(true); else if (G.state === 'paused') setPaused(false); }
  if (G.state !== 'play' || !(DEBUG || G.scene)) return;
  if (Input.took('KeyB')) { const a = aimPoint(), s = [0.8, 1.5, 3.0][dbgSize++ % 3]; Aud.init(); explosion(a.x, a.y, s); }
  if (Input.took('KeyV')) { Aud.init(); const v = STR.voices[dbgVoice++ % 4]; Aud.scream(v, G.player.x, G.player.y); floatText(G.player.x, G.player.y - 26, 'Schrei · ' + v, '#ff9ad0'); }
  if (Input.took('KeyN')) { Aud.init(); Aud.play(dbgOver++ % 2 ? 'ueberfahren_verletzt' : 'ueberfahren_toedlich', { cat: 'schrei' }); }
  if (Input.took('KeyZ')) { Aud.init(); Aud.play('panik_menge', { bus: 'stimmen' }); }
  if (Input.took('KeyX')) { Aud.init(); Aud.play('vollstreckung'); Aud.duck(); }
  if (Input.took('KeyK')) { Aud.init(); Aud.play('mandat_anruf', { bus: 'stimmen' }); Aud.duck(); HUD.say('MANDAT', 'Nummer 7741. Ein neues Mandat liegt vor.'); }
}
function toggleFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
}

let acc = 0, lastT = 0, hudT = 0, fastFrames = 0, rafEma = 0;
// Adaptive Qualität (PLAN §10.3): EMA des rAF-Intervalls; > 18 ms senken, < 16.9 ms für 3 s anheben
function adaptQuality(ms) {
  if (ms > 60 || G.state !== 'play' || !Aud.bakeLog.done) return;   // Lade-Ruckler (Klangbank-Baking, Tab-Wechsel) und Menü nicht mitzählen
  rafEma = rafEma ? rafEma * 0.95 + ms * 0.05 : ms; G.rafMs = rafEma;
  if (rafEma > 18) { G.quality = Math.max(0.35, G.quality - 0.004); fastFrames = 0; }
  else if (rafEma < 16.9) { if (++fastFrames > 180) G.quality = Math.min(1, G.quality + 0.004); } else fastFrames = 0;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000; adaptQuality(now - lastT); lastT = now;
  if (dt > 0.25) dt = 0.25;
  document.body.classList.toggle('ingame', G.state === 'play' || G.state === 'paused');
  globalKeys();
  if (G.state === 'play') {
    acc += dt; let n = 0;
    while (acc >= TICK && n < 4) { step(); acc -= TICK; n++; }
    if (n >= 4) acc = 0;
    render(); if (++hudT % 3 === 0) HUD.update();
  } else if (G.state === 'menu' || G.state === 'boot') {
    G.time++; const t = now * 0.00005;                             // langsamer Überflug hinter dem Menü
    G.cam.x = G.arena.w / 2 + Math.sin(t * 1.3) * 700; G.cam.y = G.arena.h / 2 + Math.sin(t * 0.9 + 1) * 300; G.zoomBase = 1.0;
    updateParticles(); render();
  } else if (G.state === 'paused') render();
}

// ------------------------------------------------------------------
// Test- und Debughaken (PLAN §4.12). Weitere (give, setHeat, completeStep, mission, enter, interiorCheck) folgen mit ihren Meilensteinen.
// ------------------------------------------------------------------
function wavBase64(buf) {
  const nc = buf.numberOfChannels, n = buf.length, ab = new ArrayBuffer(44 + n * nc * 2), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nc, true); v.setUint32(24, SR, true); v.setUint32(28, SR * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * nc * 2, true);
  const ch = []; for (let c = 0; c < nc; c++) ch.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { v.setInt16(o, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true); o += 2; }
  const bytes = new Uint8Array(ab); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
window.NR_TEST = {
  state: () => ({ state: G.state, time: G.time, player: G.player && { x: G.player.x, y: G.player.y, hp: G.player.hp }, parts: G.parts.length, lights: Lights.list.length,
    quality: G.quality, rafMs: G.rafMs, recs: recSummary(), bank: Object.keys(Aud.bank).length, bake: Aud.bakeLog, audio: Aud.ac ? Aud.ac.state : null }),
  setIntent(o) { Input.forced = o ? Object.assign({}, o) : null; },
  frames(n = 1) { for (let i = 0; i < n; i++) step(); render(); },
  teleport(x, y) { tp(x, y); },
  explosion(x, y, s) { explosion(x, y, s); },
  perf() { return { rafMs: G.rafMs, quality: G.quality }; },
  scenes: () => Object.keys(SCENES),
  // Rendert einen Klang aus der Klangbank-Definition offline (Pegelprüfung + WAV für den Nutzer, PLAN R15)
  async audioWav(id, variant = 0) {
    const d = SOUND_DEFS[id]; if (!d) throw new Error('unbekannter Klang ' + id);
    const buf = await Aud.render(d, 1000 + variant * 77 + id.length * 13, variant);
    const x = buf.getChannelData(0); let sum = 0; for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
    return { id, seconds: buf.duration, rawPeak: buf.rawPeak, nan: buf.hadNaN, rms: Math.sqrt(sum / x.length), b64: wavBase64(buf) };
  },
  ids: () => Object.keys(SOUND_DEFS)
};

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
(function boot() {
  fitCanvas(); addEventListener('resize', fitCanvas); addEventListener('orientationchange', () => setTimeout(fitCanvas, 150));
  Input.init(canvas); buildArena(); HUD.init();
  Lightmap.build(G.ambient, C.LIGHTMAP_SCALE); G.rafMs = 16.7;
  G.state = 'menu';
  $('startBtn').addEventListener('click', () => startGame());
  $('resumeBtn').addEventListener('click', () => setPaused(false));
  $('quitBtn').addEventListener('click', toMenu);
  $('touchPause').addEventListener('click', () => setPaused(G.state === 'play'));
  $('touchFullscreen').addEventListener('click', toggleFullscreen);
  addEventListener('pointerdown', () => { if (Aud.ac) Aud.init(); }, { passive: true });   // Audio nach Geste wecken
  requestAnimationFrame(frame);

  // Klangbank im Hintergrund: erst Aufnahmen dekodieren, dann Explosion/Schreie, danach der Rest
  (async () => {
    const st = $('status'); st.textContent = STR.status.baking;
    try {
      await loadBundle();
      await Aud.bake(SOUND_DEFS, () => { st.textContent = STR.status.ready(Object.keys(Aud.bank).length) + ' · ' + (recSummary() ? STR.status.recs(recSummary()) : STR.status.norecs); });
      st.textContent = STR.status.ready(Aud.bakeLog.n) + ' · ' + Aud.bakeLog.ms.toFixed(0) + ' ms · ' + (recSummary() ? STR.status.recs(recSummary()) : STR.status.norecs);
    } catch (e) { st.textContent = 'Klangbank-Fehler: ' + e.message; console.error(e); }
  })();

  const sc = Q.get('scene');
  if (sc && SCENES[sc]) { G.scene = sc; startGame(sc); }
  else if (Q.get('autostart') === '1') startGame();
})();
