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

| Input                  | Action                                     |
| ---------------------- | ------------------------------------------ |
| Left click / drag      | Select / box-select                        |
| Double-click           | Select all units of the same type          |
| Right click            | Move / attack / set rally point            |
| **A** + left click     | Attack-move                                |
| **S** or **X**         | Stop                                       |
| **H**                  | Select & center HQ                         |
| **Space**              | Jump to the last attack on your base       |
| **1-9**                | Recall control group (double-tap: center)  |
| **Ctrl/Cmd + 1-9**     | Assign control group                       |
| Arrows / screen edge   | Scroll the map                             |
| Mouse wheel / trackpad | Scroll; Ctrl+wheel or +/- to zoom          |
| Middle-drag            | Pan the camera                             |
| **P**                  | Pause                                      |
| **Esc**                | Cancel placement / clear selection         |
| **F1**                 | Controls overlay                           |
| Right-click unit button | Cancel last queued unit (refund)          |

## Files

- `index.html` / `styles.css` — UI shell, menus, sidebar
- `constants.js` — factions, unit/building stats, tech tree
- `spriteGenerator.js` — procedural isometric sprite factory (16-direction
  units, animated buildings, sidebar icons)
- `game-engine.js` — game loop, rendering, economy, AI, input
