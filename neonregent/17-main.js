'use strict';
// 17-main.js - Zustandsautomat, fixer 60-Hz-Takt, Stadt-Start, Distrikte, Debug-Tasten, Szenen, NR_TEST, Boot (PLAN §4.4, §4.12).
// Exportiert: window.NR_TEST, startGame, SCENES

// ------------------------------------------------------------------
// Zustand und Schleife
// ------------------------------------------------------------------
// Spielstart: Stadt steht (Boot), Spieler auf dem Terminalplatz (Landmarke t)
function startGame(scene) {
  G.parts.length = 0; G.texts.length = 0; G.trauma = 0; G.zoomPunch = 0; G.time = 0; G.freeze = 0; G.heat = 0; G.credits = 0; G.sceneEvents = null; G.mapOpen = false;
  const c = G.city.landmarks.t.center, f = World.freeSpot(c.x, c.y);
  G.player = newPlayer(f.x, f.y); G.zoomBase = C.ZOOM_FOOT; G.sceneLabel = '';
  if (scene) R.set(7741); else R.fn = Math.random;
  const S = scene && SCENES[scene]; if (S) { S.setup(); G.sceneLabel = STR.banner.scene(scene) + ' · Platzhalter (MS1)'; }
  G.cam.x = G.player.x; G.cam.y = G.player.y; updateCamera(true);
  G.district = null; updateDistrict(true);
  G.state = 'play'; $('menuScreen').classList.add('hidden'); $('pauseScreen').classList.add('hidden'); $('mapScreen').classList.add('hidden');
  Aud.init(); Aud.setInside(false);
}
function setPaused(on) {
  if (on && G.state === 'play') { G.state = 'paused'; $('pauseScreen').classList.remove('hidden'); }
  else if (!on && G.state === 'paused' && !G.mapOpen) { G.state = 'play'; $('pauseScreen').classList.add('hidden'); }
}
function setMap(on) {
  if (on && G.state === 'play') { G.mapOpen = true; G.state = 'paused'; HUD.map(); $('mapScreen').classList.remove('hidden'); }
  else if (!on && G.mapOpen) { G.mapOpen = false; G.state = 'play'; $('mapScreen').classList.add('hidden'); }
}
function toMenu() { G.state = 'menu'; G.player = null; G.mapOpen = false; $('pauseScreen').classList.add('hidden'); $('mapScreen').classList.add('hidden'); $('menuScreen').classList.remove('hidden'); }

// Distrikt wechseln: Banner + Umgebungsfarbe der Lightmap (weich übergeblendet, WORLD.md §12)
function hexLerp(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); }
function updateDistrict(snap) {
  const p = G.player, d = districtAt(p.x / C.TILE);
  if (d !== G.district) { const first = !G.district; G.district = d; if (snap) G.ambient = d.ambient; if (!first && !snap) HUD.banner(d.name, 'HALOGEN', 2200); }
  if (G.ambient !== d.ambient) G.ambient = hexLerp(G.ambient, d.ambient, 0.06) === G.ambient ? d.ambient : hexLerp(G.ambient, d.ambient, 0.06);
}

// Testszenen (§4.12): fester Seed, feste Kamera. Orte: Straßenkachel (Zelle c, r) bzw. Landmarke.
const tileXY = (tx, ty) => ({ x: (tx + 0.5) * C.TILE, y: (ty + 0.5) * C.TILE });
const at = (tx, ty) => () => tp(tileXY(tx, ty));
const SCENES = {
  docks_street:  { setup: at(74, 27) },                  // Gehweg am Terminalplatz (Zelle 9,3), Docks
  neon_crossing: { setup: at(161, 17) },                 // Kreuzung in der Neonmeile (Zelle 20,2)
  krone_palace:  { setup: at(250, 36) },                 // Gehweg vor dem Regentenpalast (Zelle 31,3), Krone
  police_l3:     { setup: at(152, 76) },
  police_l5:     { setup: at(120, 52) },
  mandat_call:   { setup: at(112, 20) },
  execution:     { setup: at(168, 52) },
  dawn:          { setup: at(74, 27) },
  runover:       { setup: at(160, 44) },
  interior:      { setup: at(60, 44) },
  gate_tor1:     { setup: at(99, 17) },                  // Brücke Docks <-> Neonmeile (Tor 1)
  explosion:     { setup() { tp(tileXY(74, 27)); const p = G.player; G.sceneEvents = [[40, () => explosion(p.x + 150, p.y + 60, 1.8)], [58, () => explosion(p.x - 120, p.y + 90, 1.0)]]; } }
};
function tp(pt) { const f = World.freeSpot(pt.x, pt.y); G.player.x = f.x; G.player.y = f.y; G.cam.x = f.x; G.cam.y = f.y; }

let gateMsgT = 0;
function step() {
  G.time++;
  G.trauma = Math.max(0, G.trauma - 0.024); G.hurtFlash *= 0.9; G.zoomPunch *= 0.9; G.kickX *= 0.75; G.kickY *= 0.75;
  if (G.freeze > 0) { G.freeze--; return; }
  Input.poll();
  if (G.in.mapP) { setMap(true); return; }
  if (G.sceneEvents) for (const e of G.sceneEvents) if (e[0] === G.time) e[1]();
  updatePlayer();
  updateParticles();
  updateCamera();
  updateDistrict(false);
  if (G.time % 6 === 0) Amb.update(G.player.x, G.player.y);
  if (G.time % 15 === 0) for (const gr in G.gates) if (!World.gateOpen(gr)) for (const r of G.gates[gr]) {      // geschlossenes Tor: Hinweis in der Nähe
    const p = G.player; if (Math.hypot((r.x0 + r.x1) / 2 - p.x, (r.y0 + r.y1) / 2 - p.y) < 130 && G.time - gateMsgT > 240) { gateMsgT = G.time; floatText((r.x0 + r.x1) / 2, r.y0 - 20, STR.gate, '#ff3b4a', 12); }
  }
  HUD.tick();
}

// Globale Tasten einmal pro Frame (Pause, Ton, Vollbild, Debug)
let dbgSize = 0, dbgVoice = 0, dbgOver = 0;
function globalKeys() {
  if (Input.took('Fullscreen')) toggleFullscreen();
  if (Input.took('KeyM')) { Aud.init(); Aud.toggleMute(); HUD.banner(Aud.muted ? 'TON AUS' : 'TON AN', '', 900); }
  if (G.mapOpen && (Input.took('Tab') || Input.took('Escape') || Input.took('KeyP'))) setMap(false);
  else if (Input.took('KeyP') || Input.took('Escape')) { if (G.state === 'play') setPaused(true); else if (G.state === 'paused') setPaused(false); }
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
    G.cam.x = 175 * C.TILE + Math.sin(t * 1.3) * 900; G.cam.y = 38 * C.TILE + Math.sin(t * 0.9 + 1) * 400; G.zoomBase = 1.1; G.ambient = DISTRICTS[1].ambient;
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
    quality: G.quality, rafMs: G.rafMs, recs: recSummary(), bank: Object.keys(Aud.bank).length, bake: Aud.bakeLog, audio: Aud.ac ? Aud.ac.state : null, amb: !!Amb.L }),
  setIntent(o) { Input.forced = o ? Object.assign({}, o) : null; },
  frames(n = 1) { for (let i = 0; i < n; i++) step(); render(); },
  teleport(x, y) { tp({ x, y }); },
  city: () => ({ ms: G.cityMs, buildings: G.buildings.length, lamps: G.lamps.length, services: G.city.services.length, landmarks: Object.keys(G.city.landmarks), tex: Tex.cache.size, texMpx: Tex.px / 1e6, chunks: Ground.cache.size }),
  // Erreichbarkeit: Flutfüllung über begehbare Kacheln ab dem Spieler (Gebäude/Tore/Wasser blockieren). gatesOpen steuert tor1/tor2.
  reach(gatesOpen) {
    const W = World.W, H = World.H, T = C.TILE; World.override = !!gatesOpen;
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !World.blocked((x + 0.5) * T, (y + 0.5) * T, C.PED_R);
    const seen = new Uint8Array(W * H), q = [], sx = Math.floor(G.player.x / T), sy = Math.floor(G.player.y / T), n = { docks: 0, neon: 0, krone: 0 };
    q.push(sx, sy); seen[sy * W + sx] = 1;
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1]; n[districtAt(x).id]++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (ok(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push(nx, ny); } }
    }
    World.override = null; return n;
  },
  zone: (c, r) => ZONE_ROWS[r][c],
  blockedAt: (x, y) => World.blocked(x, y, C.PED_R),
  tileAt: (x, y) => World.tile(x, y),
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
  Input.init(canvas);
  const t0 = performance.now(); World.init(genCity(+Q.get('seed') || C.CITY_SEED)); G.cityMs = performance.now() - t0; HUD.init();
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
