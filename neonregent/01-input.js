'use strict';
// 01-input.js - Tastatur/Maus -> Intent-Objekt G.in (PLAN §4.9). Spiellogik liest nur G.in.
// Gamepad (Underworks-Port) und Touch folgen in MS12; die Abstraktion steht schon.
// Exportiert: Input, aimPoint

const Input = {
  keys: {}, edge: {}, debugEdge: {}, mouse: { x: VIEW_W / 2, y: VIEW_H / 2, down: false, right: false, in: false }, wheel: 0, set: false,
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
    canvasEl.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  isGameKey(e) { return /^(Key[A-Z]|Digit\d|Arrow|Space|Tab|F\d+|Escape|Enter)/.test(e.code) && !e.ctrlKey && !e.metaKey; },
  moveMouse(e, c) {
    const r = c.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left) / r.width * VIEW_W; this.mouse.y = (e.clientY - r.top) / r.height * VIEW_H; this.mouse.in = true;
  },
  // Flanke einmal abholen
  took(code) { if (this.edge[code]) { this.edge[code] = false; return true; } return false; },
  // Intent fuer einen Tick bilden. NR_TEST.setIntent ueberschreibt Felder (this.forced).
  poll() {
    const k = this.keys, m = this.mouse, o = {};
    const dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    const n = Math.hypot(dx, dy) || 1;
    o.mx = dx / n; o.my = dy / n;                                   // Laufen, bildschirmrelativ
    o.throttle = k.KeyW || k.ArrowUp ? 1 : 0; o.brake = k.KeyS || k.ArrowDown ? 1 : 0; o.steer = dx;   // Auto "Klassisch" (MS2)
    o.aimMode = 'mouse'; o.ax = m.x; o.ay = m.y;                   // Bildschirmpunkt; aimPoint() macht Welt daraus
    o.fire = m.down; o.alt = m.right;
    o.sprint = !!(k.ShiftLeft || k.ShiftRight); o.boost = o.sprint; o.handbrake = !!k.Space; o.horn = !!k.KeyH;
    o.enterP = this.took('KeyF'); o.interactP = this.took('KeyE') || this.took('Enter'); o.dodgeP = this.took('Space');
    o.weaponNextP = this.wheel > 0; o.weaponPrevP = this.wheel < 0; this.wheel = 0;
    o.mapP = this.took('Tab'); o.pauseP = this.took('KeyP') || this.took('Escape');
    o.weaponSlot = 0; for (let i = 1; i <= 8; i++) if (this.took('Digit' + i)) o.weaponSlot = i;
    if (this.forced) Object.assign(o, this.forced);
    G.in = o; return o;
  }
};

// Zielpunkt in Weltkoordinaten (Maus-Bildschirmpunkt -> Welt)
function aimPoint() {
  const i = G.in, z = G.zoom || 1;
  return { x: G.cam.x + ((i.ax === undefined ? VIEW_W / 2 : i.ax) - VIEW_W / 2) / z, y: G.cam.y + ((i.ay === undefined ? VIEW_H / 2 : i.ay) - VIEW_H / 2) / z };
}
