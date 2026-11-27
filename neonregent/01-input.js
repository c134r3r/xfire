'use strict';
// 01-input.js - Tastatur/Maus -> Intent-Objekt G.in (PLAN §4.9). Spiellogik liest nur G.in.
// Gamepad (Underworks-Port) und Touch folgen in MS12; die Abstraktion steht schon.
// Exportiert: Input, aimPoint

const Input = {
  keys: {}, edge: {}, debugEdge: {}, touch: { on: false, move: { id: null, ox: 0, oy: 0, x: 0, y: 0 }, aim: { id: null, ox: 0, oy: 0, x: 0, y: 0, ang: 0 }, btn: {} }, STICK_R: 72, mouse: { x: VIEW_W / 2, y: VIEW_H / 2, down: false, right: false, in: false }, wheel: 0, set: false,
  init(canvas) {
    const canvasEl = canvas;
    addEventListener('keydown', e => {
      if (e.repeat) { if (this.isGameKey(e)) e.preventDefault(); return; }
      this.keys[e.code] = true; this.edge[e.code] = true;
      if (e.altKey && e.code === 'Enter') { this.edge.Fullscreen = true; e.preventDefault(); }
      if (this.isGameKey(e)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; this.mouse.right = false; });
    canvasEl.addEventListener('mousemove', e => this.moveMouse(e, canvasEl));
    canvasEl.addEventListener('mousedown', e => { this.moveMouse(e, canvasEl); if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.mouse.right = true; });
    addEventListener('mouseup', e => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    canvasEl.addEventListener('contextmenu', e => e.preventDefault());
    this.initTouch(canvasEl);
    canvasEl.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  // Touch: zwei schwebende Sticks (links bewegen/fahren, rechts zielen, feuert beim Halten) wie Ironclad + DOM-Kontextknöpfe
  initTouch(c) {
    const T = this.touch, toCanvas = t => { const r = c.getBoundingClientRect(); return { x: (t.clientX - r.left) * (VIEW_W / r.width), y: (t.clientY - r.top) * (VIEW_H / r.height) }; };
    c.addEventListener('touchstart', e => {
      e.preventDefault(); T.on = true; if (typeof Aud !== 'undefined') Aud.init();
      for (const t of e.changedTouches) { const p = toCanvas(t), s = p.x < VIEW_W / 2 ? T.move : T.aim; if (s.id === null) { s.id = t.identifier; s.ox = s.x = p.x; s.oy = s.y = p.y; } }
    }, { passive: false });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) { const p = toCanvas(t); for (const s of [T.move, T.aim]) if (s.id === t.identifier) {
        s.x = p.x; s.y = p.y; const dx = s.x - s.ox, dy = s.y - s.oy, m = Math.hypot(dx, dy);
        if (m > this.STICK_R * 1.6) { s.ox = s.x - dx / m * this.STICK_R * 1.6; s.oy = s.y - dy / m * this.STICK_R * 1.6; }          // Basis folgt einem weit gezogenen Daumen
      } }
    }, { passive: false });
    const up = e => { e.preventDefault(); for (const t of e.changedTouches) for (const s of [T.move, T.aim]) if (s.id === t.identifier) s.id = null; };
    c.addEventListener('touchend', up, { passive: false }); c.addEventListener('touchcancel', up, { passive: false });
    // Kontextknöpfe (DOM): halten = Zustand, Antippen = Flanke
    for (const [id, name] of [['tbEnter', 'enter'], ['tbAct', 'act'], ['tbSprint', 'sprint'], ['tbHorn', 'horn'], ['tbMap', 'map'], ['tbUse', 'use'], ['tbFire', 'fire'], ['tbSwap', 'swap']]) {
      const el = document.getElementById(id); if (!el) continue;
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); T.on = true; T.btn[name] = true; if (name === 'enter') this.edge.KeyF = true; if (name === 'map') this.edge.Tab = true; if (name === 'act') this.edge.Space = true; if (name === 'use') this.edge.KeyE = true; if (name === 'swap') this.edge.KeyQ = true; if (typeof Aud !== 'undefined') Aud.init(); }, { passive: false });
      const end = e => { e.preventDefault(); T.btn[name] = false; };
      el.addEventListener('touchend', end, { passive: false }); el.addEventListener('touchcancel', end, { passive: false });
    }
  },
  stickVec(s) { let dx = (s.x - s.ox) / this.STICK_R, dy = (s.y - s.oy) / this.STICK_R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } return { x: dx, y: dy, mag: Math.min(1, m) }; },
  isGameKey(e) { return /^(Key[A-Z]|Digit\d|Arrow|Space|Tab|F\d+|Escape|Enter)/.test(e.code) && !e.ctrlKey && !e.metaKey; },
  moveMouse(e, c) {
    const r = c.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width * VIEW_W; this.mouse.y = (e.clientY - r.top) / r.height * VIEW_H; this.mouse.in = true;
  },
  // Neutrale Eingabe (Verhaftet/Ausgelöscht: Steuerung gesperrt)
  neutral(o) { return { mx: 0, my: 0, throttle: 0, brake: 0, steer: 0, aimMode: o.aimMode, ax: o.ax, ay: o.ay, fire: false, alt: false, sprint: false, boost: false, handbrake: false, horn: false, enterP: false, interactP: false, dodgeP: false, weaponNextP: false, weaponPrevP: false, swapP: false, mapP: false, pauseP: false, weaponSlot: 0, touchDrive: o.touchDrive }; },
  // Flanke einmal abholen
  took(code) { if (this.edge[code]) { this.edge[code] = false; return true; } return false; },
  // Intent fuer einen Tick bilden. NR_TEST.setIntent ueberschreibt Felder (this.forced).
  poll() {
    const k = this.keys, m = this.mouse, o = {};
    const dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const n = Math.hypot(dx, dy) || 1;
    o.mx = dx / n; o.my = dy / n;                                   // bildschirmrelativ (Fahrzeug Direktmodus, Touch)
    o.kfw = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); o.kst = dx;   // zu Fuß: W/S vor/zurück entlang des Blicks, A/D seitwärts (Diagonalen aus beidem)
    o.throttle = k.KeyW || k.ArrowUp ? 1 : 0; o.brake = k.KeyS || k.ArrowDown ? 1 : 0; o.steer = dx;   // Auto "Klassisch" (MS2)
    o.aimMode = 'mouse'; o.ax = m.x; o.ay = m.y;                   // Bildschirmpunkt; aimPoint() macht Welt daraus
    o.fire = m.down || !!k.KeyJ; o.alt = m.right; o.swapP = this.took('KeyQ');
    o.sprint = !!(k.ShiftLeft || k.ShiftRight); o.boost = o.sprint; o.handbrake = !!k.Space; o.horn = !!k.KeyH;
    o.enterP = this.took('KeyF'); o.interactP = this.took('KeyE') || this.took('Enter'); o.dodgeP = this.took('Space');
    o.weaponNextP = this.wheel > 0; o.weaponPrevP = this.wheel < 0; this.wheel = 0;
    o.mapP = this.took('Tab'); o.pauseP = this.took('KeyP') || this.took('Escape');
    o.weaponSlot = 0; for (let i = 1; i <= 8; i++) if (this.took('Digit' + i)) o.weaponSlot = i;
    const T = this.touch;
    if (T.on) {                                                       // Touch überschreibt: linker Stick = Bewegung/Lenkung (bildschirmrelativ), rechter = Zielen
      const mv = T.move.id !== null ? this.stickVec(T.move) : { x: 0, y: 0, mag: 0 }, am = T.aim.id !== null ? this.stickVec(T.aim) : null, dead = 0.12;
      o.mx = mv.mag > dead ? mv.x : 0; o.my = mv.mag > dead ? mv.y : 0; o.touchDrive = true;
      if (am && am.mag > 0.2) { T.aim.ang = Math.atan2(am.y, am.x); o.fire = am.mag > 0.35; } else if (mv.mag > dead) T.aim.ang = Math.atan2(mv.y, mv.x);
      o.aimMode = 'stick'; o.ax = VIEW_W / 2 + Math.cos(T.aim.ang) * 220; o.ay = VIEW_H / 2 + Math.sin(T.aim.ang) * 220;
      o.sprint = o.boost = !!T.btn.sprint || mv.mag > 0.96; if (T.btn.fire) o.fire = true; o.handbrake = !!T.btn.act; o.horn = !!T.btn.horn; o.alt = false;
      o.throttle = o.brake = o.steer = 0; o.swapP = o.swapP || this.took('KeyQ');
    }
    if (this.forced) Object.assign(o, this.forced);
    G.in = o; return o;
  }
};

// Zielpunkt in Weltkoordinaten (Maus-Bildschirmpunkt -> Welt)
function aimPoint() {
  const i = G.in, z = G.zoom || 1;
  return { x: G.cam.x + ((i.ax === undefined ? VIEW_W / 2 : i.ax) - VIEW_W / 2) / z, y: G.cam.y + ((i.ay === undefined ? VIEW_H / 2 : i.ay) - VIEW_H / 2) / z };
}
