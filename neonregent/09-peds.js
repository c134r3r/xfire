'use strict';
// 09-peds.js - Spieler zu Fuß (PLAN §4.7: Ironclad-Inertia, Kreis gegen Welt, Sprint mit Ausdauer, Ausweichrolle, Schritte je Untergrund).
// Passanten-KI und Fuß-KI für OD/Erben folgen mit MS4/MS6. Exportiert: newPlayer, updatePlayer

function newPlayer(x, y) {
  return { x, y, vx: 0, vy: 0, a: 0, r: C.PED_R, hp: 100, maxHp: 100, walk: 0, stride: 0, veh: null, stamina: C.STAMINA, dodge: 0, dodgeCd: 0, surface: 'beton' };
}

function updatePlayer() {
  const p = G.player, i = G.in;
  if (p.veh) { p.a = p.veh.a; return; }                // im Fahrzeug: Position/Blick setzt updateVehicles()
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

// Tod (MS2-Minimalfassung: Respawn am Terminalplatz; Verhaften/Klinik-Respawn und Strafen folgen mit MS6, WORLD.md §4.3)
function killPlayer() {
  const p = G.player; if (!p || p.dead) return;
  if (p.veh) exitVehicle(p, true);
  const c = G.city.landmarks.t.center, f = World.freeSpot(c.x, c.y);
  p.x = f.x; p.y = f.y; p.vx = p.vy = 0; p.hp = p.maxHp; G.credits = Math.floor((G.credits || 0) * 0.9);
  G.cam.x = p.x; G.cam.y = p.y; G.hurtFlash = 1; G.trauma = 0.6;
  HUD.banner('AUSGELÖSCHT', 'Neustart am Terminalplatz', 2400);
}
