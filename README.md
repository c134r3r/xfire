# XFire — Krossfire Skirmish

A browser-based isometric RTS skirmish inspired by **KKnD2: Krossfire** (1998).
Pure HTML5 Canvas + vanilla JavaScript — no build step, no external assets.
All unit and building graphics are procedurally rendered isometric sprites.

## Run it

Open `index.html` in a browser, or serve the folder:

```
npx http-server .
```

Designed for laptop/desktop play with mouse and keyboard.

## Factions

Three mirrored sides, KKnD-style — same roles, different flavor:

| Role        | Survivors       | Evolved          | Series 9       |
| ----------- | --------------- | ---------------- | -------------- |
| Infantry    | Machine Gunner  | Berserker        | Seeder         |
| Anti-inf    | Flamer          | Pyromaniac       | Weed Killer    |
| Anti-armor  | Bazooka Trooper | Homing Bazookoid | Sterilizer     |
| Scout       | Dirt Bike       | Dire Wolf        | Probe          |
| Light veh.  | ATV             | Giant Beetle     | Enforcer       |
| Battle tank | Anaconda Tank   | Scorpion         | Sentinel       |
| Heavy       | Juggernaut      | War Mastodon     | Annihilator    |
| Artillery   | Barrage Craft   | Missile Crab     | Tremor         |

## Economy

1. Build a **Power Station** — each one boosts the output of all your
   derricks by 25% (up to two count).
2. Build **Oil Derricks on the dark oil patches** scattered across the map.
   Each derrick pumps funds directly into your treasury until its patch
   runs dry — keep expanding to new fields.

## Map events

- **Tech bunkers** (KKnD-style): neutral bunkers glow across the wasteland.
  The first side to reach one claims a random reward — an oil cache,
  stranded reinforcement units, or combat data that promotes nearby units.
  The AI races you for them.
- **Scavengers**: mutant raider packs periodically emerge from the map
  edges and attack whoever is in their way.
- **Attack warnings**: incoming enemy waves and raids are announced with
  a banner; hits on your base ping the minimap (press **Space** to jump there).
- Artillery, heavy assaults, flamers and heavy towers deal **splash
  damage** — spread your troops. Rank-3 veterans slowly self-repair,
  and burning buildings smoke when heavily damaged.
- Full audio-visual feedback: order acknowledgment blips, unit-ready and
  construction chimes, research/victory/defeat jingles, denied buzz on
  locked buttons, on-screen banners with minimap pings, and one-time
  onboarding tips for the oil economy and tech bunkers.

## Weapons

Every weapon class has its own projectile look and firing sound: MG
tracers, flame gouts, rockets with smoke trails, cannon shells with
muzzle flash, and arcing artillery shells - with faction flavor on top
(Survivors ballistic brass, Evolved bone needles and acid-green fire,
Series 9 glowing energy lances and zap sounds). Defense towers use the
same system.

## Tech tree

Power Station → Derrick / Barracks → Machine Shop → Research Lab.
The Research Lab upgrades your **Tech Level** (1 → 3), unlocking flamers,
rocketeers, battle tanks, heavy assaults, artillery, the Repair Bay and
heavy towers. Units gain **veterancy** (chevrons) from kills: +15% damage
per rank.

## Movement & pathfinding

Units plan routes with A* over the tile grid (binary heap, no corner
cutting) and then **string-pull** the result, so they drive straight
lines instead of tile zig-zags. If a destination is blocked (water, a
cliff, a building) they head for the closest reachable point instead of
refusing the order. Units **slide along walls** instead of freezing on
contact, vehicles swing their hull round before accelerating, busy units
shove idle ones aside, and a progress watchdog re-plans or calls a
crowded formation slot "arrived". Group orders spread into a formation
that faces the direction of travel, with slots assigned so units don't
cross each other's paths. **Shift + right-click** queues waypoints.

The simulation runs on a **fixed 60 Hz timestep**, so fire rates, build
times and movement stay in sync on any monitor (previously a 144 Hz
screen made everything except movement run 2.4x faster).

## Combat model

- **Ranges are measured to the target's hull/footprint**, so short-range
  units (flamers!) can actually hit big buildings.
- Units **chase with pathfinding**: a target behind a wall or around a
  building is approached properly instead of grinding into the obstacle.
- **Rock-paper-scissors damage table** (weapon vs. infantry / vehicles /
  buildings): rifles shred infantry but plink off armor, rockets and
  cannons crack vehicles, artillery levels bases. Damage numbers show it:
  yellow = effective, grey = shrugged off. Tooltips and the selection
  panel list each unit's strong/weak matchups.
- **Ballistics**: rounds that hit track their target; misses land beside
  it and kick up dirt. Small, fast infantry are hard to hit with rockets
  and shells. Artillery shells land where the target *was* - moving units
  can dodge them, and a ground marker shows where a shell will land.
- **Retaliation**: idle units fire back when shot and nearby squad mates
  join in; units on a move order keep moving (a retreat stays a retreat).
- **Attack orders**: every selected unit attacks the clicked target from
  its own range (artillery stays back, flamers close in). On the way they
  shoot whatever comes into range - turrets swing freely, fixed guns take
  shots in their direction of travel - but never stop driving toward the
  clicked target. Once it is destroyed they hunt further enemies (units
  first, then buildings) within 8 tiles of where it stood, then hold.
- **Base defense**: when a building is hit, idle combat units within 16
  tiles move in. Near defense towers they fight only from inside the
  towers' reach (one tile short of tower range), so every raider that
  trades shots with them also takes tower fire; targets that can't be
  hit from there are left to the towers. Without towers they defend
  within 9 tiles of the struck building. Afterwards they return to their
  post. Units on a player order are never pulled away.
- **Repair retreat**: with a Repair Bay, vehicles below 20% HP that are
  defending (fighting without a player order) fall back to the nearest
  bay, get patched up and return to their post (green cross on the
  health bar). Vehicles sent on an attack by the player keep fighting.
  Infantry can't be repaired and never retreat.
- **Target priority**: auto-targeting prefers threats already in range
  and targets the weapon is good against.
- Population cap of 70 (AI cap scales with difficulty).

## Rock walls & line of sight

Long rock-wall ridges cross the wasteland: impassable, and they **block
direct fire** - shells and tracers stop at the cliff face. Only the top
tech-3 units (Heavy Assault and Artillery) lob their shots **over** the
walls, which makes them true siege weapons and turns ridges into
defensive terrain worth fighting for. Towers and regular units must find
a clear line; idle units won't waste shots on targets hidden behind rock.

## Fog of war

The map starts under a black shroud. Your units and buildings reveal
their surroundings; ground you have scouted but no longer watch falls
back under a dark veil, and hostile units or buildings are only shown
(on the map and the minimap) while they are inside your line of sight.

## Sound

All sound effects are synthesized from layered, physically motivated
recipes and baked into a sound bank at load (`sfx.js`, ~1-2 s in the
background via OfflineAudioContext), each in several variations so
repeated shots never sound identical:

- **Weapons**: rifle and heavy-MG reports (supersonic crack, muzzle body,
  low thump, rolling tail, action click), cannon (sub boom, blast, breech
  clank, long rumble), artillery with an incoming shell whistle before
  impact, rocket launch whoosh, flamethrower roar with crackle, and arc /
  plasma discharges for Series 9.
- **Impacts and deaths**: metal pings, dirt and gravel hits, ricochets,
  flesh hits, multi-stage explosions with debris rattle, building
  collapses, human / beast cries and robot power-downs.
- **Spatial mix**: stereo pan from screen position, distance falloff with
  air absorption (far battles sound muffled), an outdoor reverb with rock
  slap-back, per-sound voice limits and a master compressor.
- **Voices**: units answer over a field radio (squelch, band-limited
  speech-like chatter per faction: human, mutant growl, vocoded machine),
  and a spoken announcer reports key events ("Unit ready", "Our base is
  under attack", ...) - toggle in the pause menu.
- **Ambience**: looping desert wind under the battle.

The soundtrack is still the procedural step-sequencer from `audio.js`:
its combat layer (drums, driving bass, lead) crossfades in when battle
heat rises. The pause menu has a mixer for music / effects / voices.

## Atmosphere & battlefield persistence

The wasteland is dressed with smooth tonal terrain patches, scattered
rocks, bleached bones, dead brush and cracked earth; water gets shore
foam, the viewport a soft vignette and drifting dust. Fights leave marks:
destroyed vehicles become smoking charred wrecks, infantry leaves splats,
and razed buildings leave scorch marks with rubble - all fading out over
time. Explosions push shockwave rings, spawn lingering ground fire and
shake the screen.

## Guided start

New players get an on-screen **objective chain** (toggleable in the
settings): build a derrick, barracks, machine shop, train an army,
research, grab a bunker, destroy the enemy. Golden arrows point at the
nearest oil patches and bunkers, every oil patch lights up while you are
placing a derrick, and each sidebar button shows a hover tooltip
explaining what the building or unit is for. The default starting oil is
5000 so you can get going immediately, and the AI plays at a human pace:
it takes a moment to orient itself, issues one build order at a time and
never attacks in the opening minutes.

## Player comforts

- **End-of-match scoreboard**: units built/lost, enemies destroyed,
  buildings razed, oil earned, bunkers claimed and surviving veterans
- **Veteran promotions** celebrate with a golden burst and jingle
- **Right-click a unit button** to cancel the last queued unit (full refund)
- When the enemy is down to its last few stragglers, they are pinged on
  the minimap ("Enemy remnants located") - no end-game hide-and-seek
- A low-funds warning points you back at the oil when you are broke
  without a working derrick
- **F1** opens a full controls reference in-game; your menu settings are
  remembered between sessions

## Controls

| Input                      | Action                                         |
| -------------------------- | ---------------------------------------------- |
| Left click / drag          | Select / box-select (Shift adds)               |
| Double-click               | Select all units of that type on screen        |
| Right click                | Move / attack the target under the cursor / set rally point |
| **Shift** + right click    | Queue a waypoint                               |
| **A** + left click         | Attack-move                                    |
| **S** or **X**             | Stop                                           |
| **Q** / **F2** / Ctrl+A    | Select idle army / whole army                  |
| **Ctrl+1-9** / **1-9**     | Assign / recall group (double-tap: center); Shift+1-9 adds |
| **H** / **Space**          | Go to HQ / to the last attack                  |
| Mouse wheel / pinch, +/-   | Zoom toward the cursor                         |
| Arrows / screen edge / middle-drag | Scroll                              |
| Minimap left / right click | Jump camera / send the selected units there    |
| **Tab**, **W E R T D F G C V** | Sidebar tabs / sidebar button hotkeys      |
| Right-click a unit button  | Cancel one queued unit (refund)                |
| **Shift** while placing    | Place several structures                       |
| **Alt** (hold)             | Show all health bars                           |
| **P** / **Esc**            | Pause / cancel                                 |
| **F1**                     | Controls overlay                               |

The cursor always tells you what a click will do (move, attack, can't
go there, rally point), and the footer spells out the current mouse
actions.

## Graphics

Everything is still procedural (no image assets besides the menu art),
but rebuilt from scratch:

- **Terrain**: a noise-painted wasteland texture (sand, dirt, rust,
  wet shores, rubble around cliffs) with organic water bodies, foam and
  depth, scattered boulders / scrub / bones / scrap / tire tracks, glossy
  oil pools, and rock ridges as depth-sorted 3D outcrops (units behind a
  cliff are hidden by it). Tiles are now drawn exactly where the game
  logic places them (the old renderer was offset by half a tile).
- **Units & buildings**: modelled from lit 3D primitives (sloped armor,
  real wheels and tracks with road wheels, turrets with mantlets and
  muzzle brakes, walk cycles for infantry and beasts), with **team colors**
  painted on every unit and structure so friend and foe read instantly.
  Rendered supersampled and stored at 2x for crisp zoom and HiDPI.
- **Effects**: additive glow sprites instead of slow canvas shadows -
  fireballs, smoke columns, sparks, debris, shockwaves, ground light,
  muzzle flashes, recoil, hit flashes, craters, tracer streaks.
- **HUD**: top bar with oil + income/s, population, tech and time; an
  always-available tabbed build sidebar (units are routed to the least
  busy producer automatically, with progress wipes and queue badges);
  a selection panel with portraits and counter info; an isometric
  minimap that matches the camera orientation.

## 3D asset pack

`assets/sprites/` holds a pre-rendered sprite pack: every unit (16
directions, walk/stride frames), every turret and every building of all
three factions, rendered from real 3D models (three.js, soft shadow-mapped
sun, sky light, PBR materials, edge highlights). Each sheet comes with a
team mask, so one render is tinted for any player color at load time.
The game loads the pack during the loading screen and falls back to the
procedural sprites for anything missing; *Skirmish Setup → Graphics*
switches between the two.

Rebuild the pack after changing a model:

```
cd tools/asset-baker && npm install        # three.js
node tools/asset-baker/bake.mjs            # all sheets (~5 min); --only tank, --faction evolved
python3 tools/asset-baker/pack.py          # WebP sheets + per-faction bundles
```

Models live in `tools/asset-baker/lib/models.js` (same coordinates as the
procedural builders, so mounts and anchors line up), the modelling kit in
`lib/kit.js`, the iso renderer in `lib/iso.js`.

## Hover info

On desktop, resting the mouse on a unit, building or tech bunker shows a
German info card: what it is, what it is good for, strengths and
weaknesses, live HP and production status.

## IRONCLAD - Desert Assault (`ironclad.html`)

A standalone top-down tank shooter, linked from the main menu.

- **Fast**: 60 Hz fixed timestep, ~260 px/s tank with inertia, boost to
  ram and crush light vehicles, camera leads toward the aim.
- **13 enemy types + Warlord boss** (every 5th wave, 4 attack patterns,
  enrages at 50%): buggies, raiders, armored cars, kamikaze bombers,
  chargers, tanks, snipers (laser sight), dozers, mortars, APCs that
  split, mine layers, rocket trucks, gunships (fly over rocks). Waves
  arrive in squads; ground units path around rocks via a flow field.
- **12 power-ups**: Rapid, Spread, Rail, homing Rockets, Laser, gun
  Drones, Shield, Overdrive, Repair, Airstrike, Bullet Time, Nuke.
  Timed ones stack and combine (laser + spread = triple beam).
- **Explosions** are layered (flash, light, fireball, shockwave, sparks,
  burning debris, smoke, embers) and burn scorch marks into the sand;
  wrecks burn out and stay as husks. Red barrels chain-react, crates
  always drop a power-up.
- Combo multiplier up to x8 with callouts, hit-stop and screen shake on
  big hits, off-screen arrows, radar, slow-motion death cam.
- Twin-stick touch controls with aim assist, compact phone HUD, and an
  adaptive particle budget for slow devices.

## IRONCLAD - Underworks (`underworks.html`)

A dark SNES-style run-and-gun platformer set in the same world, linked
from the Ironclad menu. Level 1 "The Pit" has five sections, each with
its own mechanic:

1. **Crash Site** - surface run at dusk. A 5 s intro shows the pilot
   climbing out of the burning Ironclad tank (chiptune jingle, skippable).
2. **The Shaft** - rope descent: swing, shoot in 8 directions, avoid
   blade bars and spiked outcrops in near darkness.
3. **Underworks** - factory run with conveyors, crushers, ceiling
   turrets, a stomp-through floor hatch and two lockdown arenas.
4. **Magma Tunnel** - auto-scrolling hoverbike chase: jump gaps and
   barriers, duck pipes, shoot drones.
5. **The Warden** - two-phase boss (the mech from the XFire menu art);
   in phase 2 the floor melts and it hovers over moving platforms.

- **Shoot, then smash**: enemies reel (★) at low health; a SMASH
  finisher sends them flying (Battletoads-style oversized fist, hit-stop)
  and drops armor. Shield troopers only break to a smash; the boss
  staggers after enough damage.
- Movement: variable jump with coyote time and buffering, wall cling and
  wall jump, dash with i-frames, stomp, drop through platforms.
- Fair difficulty: checkpoints per section, pits and lava cost armor and
  put you back on safe ground.
- 480x270 pixel rendering with a darkness layer lit by muzzle flashes,
  lava, lamps and explosions; synthesized chiptune music and effects.
- Touch: floating stick plus slide-able JUMP / FIRE / SMASH / DASH.

## Releasing

GitHub Pages lets browsers cache files for 10 minutes, so right after a
deploy a browser can combine the new `index.html` with old scripts. Every
local script and stylesheet in `index.html` therefore carries a `?v=`
version: **bump `XFIRE_VERSION` and all `?v=` values together on every
release.** If startup still fails, a boot guard reloads once and then
shows the error on the loading screen.

## Files

- `index.html` / `styles.css` — UI shell, menus, HUD, sidebar
- `constants.js` — factions, unit/building stats, weapon tables, tech tree
- `spriteGenerator.js` — procedural isometric sprite factory (16-direction
  units with team colors, animated buildings, sidebar icons)
- `terrain.js` — terrain painter, water, props, rock-wall sprites
- `render.js` — battlefield renderer, particles and effects, overlays
- `assets/sprites/` — baked 3D sprite pack (WebP sheets + bundles)
- `tools/asset-baker/` — 3D models and the offline renderer for the pack
- `sfx.js` — sound design: baked SFX bank, spatial mix, radio voices, announcer
- `audio.js` — procedural soundtrack
- `game-engine.js` — simulation (fixed timestep), navigation, combat,
  economy, AI, input, HUD logic
