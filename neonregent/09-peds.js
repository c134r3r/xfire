'use strict';
// 09-peds.js - Spieler zu Fuß (PLAN §4.7: Ironclad-Inertia, Kreis gegen Welt, Sprint mit Ausdauer, Ausweichrolle, Schritte je Untergrund).
// Passanten-KI und Fuß-KI für OD/Erben folgen mit MS4/MS6. Exportiert: newPlayer, updatePlayer

function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, a: 0, r: C.PED_R, hp: 100, maxHp: 100, walk: 0, stride: 0, stamina: C.STAMINA, dodge: 0, dodgeCd: 0, surface: 'beton' };
}

function updatePlayer() {
  const p = G.player, i = G.in;
  const ap = aimPoint(); p.a = Math.atan2(ap.y - p.y, ap.x - p.x);
  const moving = !!(i.mx || i.my), sprint = i.sprint && p.stamina > 1 && moving;
  const sp = sprint ? C.PLAYER_SPRINT : C.PLAYER_WALK;
  p.stamina = clamp(p.stamina + (sprint ? -C.STAMINA_DRAIN : C.STAMINA_REGEN), 0, C.STAMINA);
  if (p.dodgeCd > 0) p.dodgeCd--;
  if (i.dodgeP && p.dodgeCd <= 0 && p.dodge <= 0) { p.dodge = Math.round(C.DODGE_S * 60); p.dodgeCd = Math.round(C.DODGE_CD_S * 60); p.dvx = (i.mx || Math.cos(p.a)) * 5.2; p.dvy = (i.my || Math.sin(p.a)) * 5.2; Bus.emit('dodge', p); }
  if (p.dodge > 0) { p.dodge--; p.vx = p.dvx; p.vy = p.dvy; }
  else { p.vx += (i.mx * sp - p.vx) * 0.2; p.vy += (i.my * sp - p.vy) * 0.2; }
  const x0 = p.x, y0 = p.y;
  World.move(p, p.vx, p.vy);
  const v = Math.hypot(p.x - x0, p.y - y0);
  p.walk += v;
  // Schritte: eine Schrittlänge je Untergrund-Klang (Sprint kürzer getaktet)
  p.stride += v;
  if (p.stride > (sprint ? 15 : 19) && v > 0.5 && p.dodge <= 0) { p.stride = 0; p.surface = World.surface(p.x, p.y); Aud.step(p.surface, sprint); }
}
