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

## Tech tree

Power Station → Derrick / Barracks → Machine Shop → Research Lab.
The Research Lab upgrades your **Tech Level** (1 → 3), unlocking flamers,
rocketeers, battle tanks, heavy assaults, artillery, the Repair Bay and
heavy towers. Units gain **veterancy** (chevrons) from kills: +15% damage
per rank.

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

## Files

- `index.html` / `styles.css` — UI shell, menus, sidebar
- `constants.js` — factions, unit/building stats, tech tree
- `spriteGenerator.js` — procedural isometric sprite factory (16-direction
  units, animated buildings, sidebar icons)
- `game-engine.js` — game loop, rendering, economy, AI, input
