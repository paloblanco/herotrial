# Hero Trial — Design Document

*A 5-minute roguelike for BLOCKO3D 0.1.0-alpha. Draft 1, 2026-11-04.*

This document is written to be built from. Every system has concrete numbers so it can be coded directly; numbers are first guesses for tuning, not promises. Anything I had to invent or interpret is marked **[assumed]**, and the real questions are collected in §15 for the quiz.

---

## 1. One-paragraph pitch

You are a hero dropped into a 128 × 128 × 64 block world with 3 AI rival heroes. For **5 minutes** you run around smashing crops, rocks, trees, chests, minions and each other to collect **stat powerups** and pick up **tools** (one per hand). When the clock runs out, the game offers **3 challenges**; you pick one, or take on more of them as a harder run, and have **90 seconds** to finish. Best times are saved, and a 150-entry **accomplishment board** gives long-term goals. No unlocks gate gameplay.

Inspirations: Kirby Air Riders' City Trial (the loop, patches, machines → tools), Vampire Survivors (stat snowballing), Minecraft (breakable block world).

---

## 2. Engine facts that shape the design

These come from the BLOCKO3D docs and source and drive several decisions below.

| Fact | Consequence for Hero Trial |
|---|---|
| Any `mset` marks the **whole map** dirty and its entire mesh is rebuilt next draw (`js/core.js`). | The world is **not one map**. It is split into **chunk maps** (§9.1) so breaking a block remeshes only one small chunk. |
| `mpush(maps, …)` takes a list of maps. | Collision passes only the 1–4 chunks under an entity. |
| `map_new` maps can be any size; the 524,288-block limit is only the Map tab's. | The world is generated in code at `_init`, not painted in the editor. |
| 64 vox models, 63 tiles, 64 sounds, 32 colors. | Asset budgets in §12. `pal()` recolors are used heavily (platinum tools, hero colors, boss tints). |
| Square 256 × 256 screen, text is 7 × 10 px. | HUD must be compact (§11). |
| Buttons 4 (O) and 5 (X); touch shows a d-pad/analog circle + O + X. | Two hands = two buttons. No jump button (see §4.3). `touch_set_mode(1)` for analog. |
| `mouse_set_mode(2)` gives mouse-look on desktop and finger-drag look on touch; `stick(1)` is the right stick. | Manual camera control on all three input types. |
| `vox(..., sx, sy, sz)` scales per axis. | Minion squash animation and big bosses are free. |
| `freeze(n)` holds the picture for n updates. | Hit-stop on big hits and kills. |
| `save()` holds 64 KB of JSON. | Best times + 150 accomplishment flags + lifetime counters fit easily. |
| One `main.js` per game. | All code lives in one well-sectioned file (§14). |
| `b3d run` is deterministic with `--seed`, `--eval`, `--at`, `--watch`. | Systems are tested headless (§14.3). |

---

## 3. Game flow

```
TITLE ──► SPAWN ──► TRIAL (300 s) ──► CHALLENGE SELECT ──► CHALLENGE (90 s) ──► RESULTS ──► TITLE
  │                                                                                          ▲
  └──► ACCOMPLISHMENT BOARD ─────────────────────────────────────────────────────────────────┘
```

| State | What happens | Exit |
|---|---|---|
| `title` | Logo, "O: play  X: board". Music. | O → `spawn`; X → `board` |
| `spawn` | World generates (seed = random). Player placed at one of **4 spawn points** (one per quadrant) chosen at random; AI heroes take the other three. 2-second "READY / GO". | after 120 frames → `trial` |
| `trial` | The main 5-minute loop. Timer counts down from 300. | timer hits 0 → `select` |
| `select` | World freezes. 3 challenge cards drawn from the pool (§10). Player toggles cards on/off with left/right + O; X confirms. At least one must be on. | confirm → `challenge` |
| `challenge` | 90-second timer counts down. Goal(s) shown on HUD. | all chosen goals done → `results` (win); timer 0 or player dies → `results` (fail) |
| `results` | Win/fail, time, new best?, accomplishments earned this run. | O → `title` |
| `board` | 10 × 15 grid of accomplishments; cursor shows name + description. | X → `title` |

Pause (Enter/P) is handled by the engine.

---

## 4. Player controls

### 4.1 Mapping

| Input | Grounded | Airborne |
|---|---|---|
| Stick / d-pad / arrows | Walk, camera-relative | Air control (reduced, see §5) |
| **O (btn 4) = left hand** | Tap: pick up nearby tool into left hand, **or** swing left tool. Hold: auto-repeat swings at cooldown rate. | Hold: **flap** (slow fall) |
| **X (btn 5) = right hand** | Same, right hand. | Press: **ground pound** |
| Mouse (captured) / finger drag / right stick | Rotate camera | Rotate camera |

Pickup rule: on `btnp(hand)`, if a loose tool is within **1.2 blocks** (horizontal) and ±1 vertical, pick up the nearest one into that hand and drop the old tool where the new one was. Otherwise swing. A small "O/X: take SWORD" prompt shows whenever a tool is in range so the player knows a press will pick up instead of swing. **[assumed]**

### 4.2 Climbing

Walking into a wall that is **exactly 1 block high** climbs it automatically: if `mpush` reports a sideways push while grounded and moving, the block in front at foot level is solid, and the block above it is empty, set `vy = 0.15` (clears one block for a 0.4-radius ball). Two-block walls stop you.

### 4.3 Ledge hop (the "jump")

There is no jump button. When the hero **walks off an edge** (grounded last frame, not grounded now, and not already going up), they automatically hop: `vy = jumpVel(J)` (§6). This lets you clear gaps and reach slightly higher ledges by running off a lip. Higher Jump stat = bigger hop.

### 4.4 Flap (glide)

Holding O in the air caps the fall speed: `vy = max(vy, -glideCap(J))`. Arms flap (hand animation). No stamina limit **[assumed]**.

### 4.5 Ground pound

Pressing X in the air: `vy = -0.45`, horizontal speed × 0.3, `pounding = true`, record `poundStartY = y`. On landing: both hands swing at once with a damage multiplier `1 + 0.15 × (poundStartY − y)`, capped at ×4. Small camera shake and `freeze(4)` if anything was hit.

---

## 5. Movement & physics

All in blocks and frames (60 updates/s). Hero is a ball of radius **0.4**, center at feet + 0.4, collision via `mpush(nearbyChunks, x, y, z, 0.4)`.

- Gravity: `vy -= 0.01` per frame, terminal `vy ≥ -0.6`.
- Ground speed: velocity eases toward `stickDir × maxSpeed(S)` with factor `traction(A)` per frame (`vx = lerp(vx, target, traction)`). Low agility = slidey starts and stops.
- Air control: same but traction × 0.35.
- Facing (`yaw`): turns toward movement direction at `0.08 + 0.004·A` turns per frame (`yaw += angdiff(yaw, want) * k`). Swings go where you face.
- Hit knockback: `v += dir × 0.15 × (1 + dmg/20)`, plus `vy = 0.08`; 30 frames of invulnerability (flicker).
- Out of bounds: `y < -4` → death (§8.5).

### 5.1 Camera

Chase camera, kart-style. State: `camYaw`, `camPitch` (default 0.06), `camDist` (default 5), `idle` counter.

1. **Manual input** (`mouse_delta`, `stick(1)`): rotates `camYaw`/`camPitch` directly; sets `manualHold = 60` frames during which auto-follow is off.
2. **Moving**: `camYaw += angdiff(camYaw, yaw) × 0.08` — aggressive follow, but **driven only by the forward part of the input** so holding sideways doesn't make you circle forever **[assumed — see Q4]**.
3. **Stopped**: wait 30 frames, then `camYaw += angdiff(camYaw, yaw) × 0.015` (slow swing in behind).
4. **Occlusion**: `mray` from hero toward camera on nearby chunks; pull camera in to the hit (min 1.2).
5. `cam_orbit([x, y + 0.8, z], camYaw, -camPitch, camDist)`.

Movement is camera-relative, using the third-person demo's formula.

---

## 6. Stats

Eight stats, each an integer **0–30**, start at 0. Each powerup is +1 to one stat. Formulas (S = stat value):

| Stat | Formula | At 0 | At 30 |
|---|---|---|---|
| **Speed** | `maxSpeed = 0.055 + 0.0022·S` blocks/frame | 3.3 b/s | 7.3 b/s |
| **Strength** | `dmgMul = 1 + 0.1·S` | ×1 | ×4 |
| **Health** | `maxHP = 20 + 4·S` | 20 | 140 |
| **Defense** | `taken = max(0, raw − 0.3·S) × (1 − 0.01·S)` | full | −9 flat, then −30 % |
| **Frequency** | `cooldown = toolCd × (1 − 0.02·S)` | ×1 | ×0.4 |
| **Reach** | `reach = toolReach × (1 + 0.02·S)` | ×1 | ×1.6 |
| **Agility** | `traction = 0.08 + 0.006·S`; `arc = toolArc + 0.004·S` turns | 0.08, +0° | 0.26, +43° |
| **Jump** | `jumpVel = 0.13 + 0.0045·S`; `glideCap = 0.11 − 0.0027·S` | hop ≈ 0.85 b, fall 0.11 | hop ≈ 3.6 b, fall 0.029 |

Raising Health also heals by the same amount. HP does not regenerate otherwise **[assumed]**; a rare **heart** drop restores 25 %.

Tool modifiers (e.g. hammer slows you) are applied as **effective stat offsets** (e.g. Speed −6), clamped to 0–30 after adding. One code path, no special cases.

---

## 7. Tools & combat

### 7.1 Tool table

`dmg` is base damage; `reach` in blocks; `arc` in turns (0.33 = 120°); `cd` in frames.

| # | Tool | dmg | reach | arc | cd | Damage type(s) | Modifiers / special |
|---|---|---|---|---|---|---|---|
| 0 | Bare hand | 2 | 0.9 | 0.25 | 14 | normal | — |
| 1 | Sword | 6 | 1.6 | 0.33 | 22 | cut | — |
| 2 | Hammer | 9 | 1.5 | 0.33 | 45 | smash | Speed −6, Agility −6 |
| 3 | Axe | 8 | 1.3 | 0.33 | 40 | chop | ×1.5 vs minions |
| 4 | Spear | 6 | 2.6 | 0.12 | 28 | cut | — |
| 5 | Pocket knife | 3 | 0.9 | 0.33 | 9 | cut | Speed +4, Agility +4 |
| 6 | Whip | 2 | 2.6 | 0.25 | 26 | normal | Collects powerups at ×1.5 reach |
| 7 | Mace | 11 | 1.5 | 0.25 | 50 | smash | — |
| 8 | Shovel | 7 | 1.3 | 0.12 | 30 | smash + dig | Also hits the block layer below your feet |
| 9 | Hoe | 3 | 1.3 | 0.33 | 24 | harvest | — |

**Platinum** versions (tools 1–9): dmg ×1.5, reach ×1.2, cd ×0.8, drawn with a gold `pal()` swap and a shimmering outline. Only ~6 exist per map, in hard-to-reach places (§9).

When a tool has two damage types, it uses whichever multiplier is better against the target.

### 7.2 Damage vs. materials

Every hittable thing has a **material**. Multiplier = `MAT[type][material]`.

| type \ material | earth | rock | stone | wood | plant | crop | flesh |
|---|---|---|---|---|---|---|---|
| normal | 1 | 0.5 | 0.25 | 0.5 | 1 | 1 | 1 |
| cut | 0.5 | 0.25 | 0.25 | 0.75 | 3 | 1.5 | 1.2 |
| smash | 1 | 3 | 2.5 | 1 | 0.5 | 0.5 | 1.2 |
| chop | 0.75 | 0.25 | 0.25 | 3 | 2 | 1 | 1 |
| dig | 4 | 1 | 0.5 | 0.5 | 1 | 1 | 0.5 |
| harvest | 0.5 | 0.25 | 0.25 | 0.5 | 2 | 5 | 0.5 |

`flesh` = minions and heroes.

**Final damage** = `tool.dmg × dmgMul(Strength) × MAT[type][material] × (pound multiplier)` → then the target's Defense formula (heroes/minions) or block HP (blocks).

### 7.3 The swing

1. **Frame 0 (windup)**: hand pulls back. Nothing is hit.
2. **Frame 1 (strike)**: the tool snaps to the end of its arc. All hits resolve on this frame.
3. **Frames 2–7 (trail)**: 5 fading spheres along the arc, visual only.
4. Cooldown starts at frame 1. Holding the button re-swings as soon as cooldown ends.

**Hit test, entities**: a target is hit if its horizontal distance ≤ `reach + targetRadius`, its vertical offset is between −0.6 and +1.2, and the angle to it is within `arc/2` of `yaw`. Cheap, exact, no spheres needed.

**Hit test, blocks**: sample points along the arc: angles from `yaw − arc/2` to `yaw + arc/2` in steps of 0.04 turns, at radii `0.6` and `reach`, at height `y` (center of hero) — and `y − 1` for the shovel. Collect the distinct block cells (via `mgetw`), sort by distance, and damage the **closest 3** **[assumed]**. Each block gets damage once per swing.

**Hit test, powerups**: any loose powerup within the arc and reach (× 1.5 for whip) is collected. Walking within 0.7 also collects.

Two hands swinging on the same frame is allowed; each hand has its own cooldown.

### 7.4 Block damage & breaking

- Block damage is stored in a `Map` keyed by world cell index → damage taken. Entries **heal fully after 4 s** without being hit **[assumed]**.
- When damage ≥ block HP: `mset(chunk, …, 0)`, spawn 6 debris cubes (tile color, short-lived), roll drops (§8.2), play break sound.
- Hitting but not breaking: 3 debris specks + a short "tick" sound.
- **Bedrock** (y = 0 and the map's outer ring below the surface) is unbreakable.

### 7.5 Combat between characters

- Heroes hit by any hero or minion take damage (§6 Defense), knockback, i-frames.
- When a hero is hit by **another hero**, they spill **1 powerup** (random stat they have > 0) that pops out as a loose pickup, City Trial style **[assumed]**.
- Big hits (final damage ≥ 15) trigger `freeze(3)`.

---

## 8. Things in the world

### 8.1 Tiles and their properties

| id | Tile | Material | HP | Drop chance | Notes |
|---|---|---|---|---|---|
| 1 | grass | earth | 10 | 3 % | top layer |
| 2 | dirt | earth | 10 | 2 % | |
| 3 | rock | rock | 18 | 30 % | scattered boulders, mountain |
| 4 | stone (cut) | stone | 35 | 0 % | castle walls |
| 5 | dungeon brick | stone | 50 | 0 % | |
| 6 | log | wood | 16 | 15 % | tree trunks |
| 7 | planks | wood | 14 | 3 % | village buildings |
| 8 | leaves | plant | 3 | 8 % | |
| 9 | bush | plant | 4 | 30 % | |
| 10 | corn | crop | 5 | 70 % | farms |
| 11 | pumpkin | crop | 8 | 85 %, 1–2 | farms |
| 12 | berry bush | crop | 4 | 60 % | forest edge |
| 13 | farmland | earth | 10 | 0 % | under crops |
| 14 | sand/path | earth | 8 | 0 % | roads |
| 15 | snow | earth | 8 | 5 % | mountain tops |
| 16 | roof | wood | 12 | 0 % | |
| 17 | wood chest | wood | 30 | 100 %, 4–6 | |
| 18 | stone chest | stone | 50 | 100 %, 6–8 | +10 % chance of a tool |
| 19 | mossy chest ("grass") | earth | 30 | 100 %, 4–6 | |
| 20 | bedrock | — | ∞ | — | unbreakable |
| 21 | crystal | rock | 25 | 100 %, 2 | rare, dungeons |
| 22 | lava | — | ∞ | — | dungeons; touching = 10 dmg/s |
| 23 | gold block | stone | 40 | 100 %, 3 | platinum tool pedestals |

Tile data lives in a `TILES` table in code: `{ mat, hp, drop, dropN }`.

### 8.2 Powerups

- A powerup is `{ stat, x, y, z, vx, vy, vz, life }`. It pops out of whatever broke with a random upward velocity, bounces once, then rests on the ground (simple `mpush` with r = 0.25).
- Drawn as a **billboard**: `vox(POW_VOX[stat], x, y, z, 0, yaw_to(camX − x, camZ − z))`, with `outline(c)` where `c` cycles through 3 bright colors every 8 frames so it pops against the world.
- Each stat has its own icon model and color (§12).
- Despawn after 40 s on the ground (blink in the last 5 s).
- **Ambient spawning**: 60 powerups placed at match start; then 1 new powerup every 2 s at a random surface spot (weighted toward the hub and roads), until 120 are on the ground.
- Drop stat choice: uniform random **[assumed]**. A small chance (4 %) of a **heart** instead.

### 8.3 Loose tools

- ~24 normal tools placed at match start on surface spots (spread across quadrants, biased: hoes near farms, axes in forest, hammers/maces near the castle and mountain).
- ~6 platinum tools in hard places: tower top, mountain peak, deep in dungeons, on a gold pedestal.
- Dropped tools are also loose tools. Billboarded like powerups, outline white.

### 8.4 Minions

Single vox, no limbs. Animation is a `sy` squash: `sy = 1 − 0.15·|sin(t·k)|`, with `sx = sz = 1 + 0.07·|sin(t·k)|`.

| Minion | HP | dmg | speed | aggro | scale | Behavior | Where |
|---|---|---|---|---|---|---|---|
| Slime | 10 | 3 | 0.03 | 6 | 0.8 | hops toward target | everywhere |
| Bat | 8 | 4 | 0.05 | 8 | 0.6 | flies, ignores terrain height ±2 | forest, dungeons |
| Goblin | 18 | 5 | 0.045 | 8 | 1.0 | walks at target, swings when adjacent | village, forest |
| Skeleton | 25 | 7 | 0.04 | 10 | 1.0 | walks; tougher | castle, dungeons |
| Golem | 60 | 12 | 0.025 | 6 | 1.5 | slow, hits hard | mountains, dungeons |
| Mushroom | 14 | 4 | 0 | 4 | 0.8 | stationary, puffs when near | forest |

- Contact damage with a 40-frame per-target cooldown; goblins/skeletons/golems instead "swing" (flash white for 10 frames, then hit in a 1.2-block radius).
- **Drops**: slime 1, bat 1, goblin 1–2, mushroom 1, skeleton 2, golem 3–4.
- **Levels**: a minion can spawn at level 1–3; level multiplies HP and dmg by `1 + 0.5·(lvl−1)` and scale by `1 + 0.15·(lvl−1)`. Dungeons spawn level 3.
- **Population**: ~30 alive on the surface at once; when one dies, a new one spawns after 10 s at a spawn point out of the player's view in its zone. Dungeon minions do not respawn.
- Physics: same `mpush` approach as heroes (bats skip gravity). No pathfinding; they steer straight at the target and hop 1-block steps.

### 8.5 Death & respawn

- HP ≤ 0 or `y < −4` → the hero is "knocked out".
- Lose **30 % of collected powerups** (rounded up), chosen at random from stats > 0; they **spill as loose powerups** at the knock-out spot (or at the respawn point, if you fell off the map) **[assumed]**.
- Lose **one tool**: a random non-empty hand drops its tool at the knock-out spot **[assumed]**.
- Respawn at the **hub in the map center** after 60 frames, full HP, 120 frames of i-frames.

---

## 9. The map

### 9.1 Structure and chunks

- World is **128 (x) × 64 (y) × 128 (z)**.
- Built as **8 × 8 = 64 chunk maps**, each **16 × 64 × 16** (`map_new(16, 64, 16)`, `map_set_pos(m, [cx·16, 0, cz·16])`). Chunk size is a tuning knob; milestone 0 benchmarks 16 vs 32.
- Helpers hide chunks from all other code:
  - `wget(x, y, z)` / `wset(x, y, z, t)` — world-cell get/set routed to the right chunk.
  - `chunksNear(x, z, r)` — chunk ids overlapping a circle (for `mpush`, `mray`).
  - `wpush(x, y, z, r)` = `mpush(chunksNear(x, z, r + 1), x, y, z, r)`.
- Draw: all 64 chunks each frame (Three.js frustum-culls off-screen ones) **[benchmark — if slow, skip chunks farther than 56 blocks]**.

### 9.2 Layout

Ground level is **y = 20**, leaving rows 1–19 for dungeons and caves, with bedrock at y = 0. The play plane is a 120 × 120 square with rounded corners (radius 16), surrounded by void — walk off it and you fall.

```
              z = 127
   ┌───────────────┬───────────────┐
   │   FOREST      │   CASTLE      │
   │  trees, bush, │  walls, keep, │
   │  berries,     │  climbable    │
   │  mushrooms    │  tower (y 50) │
   │        ┌──────┴──────┐        │
   ├────────┤  HUB (spawn │────────┤
   │        │   plaza)    │        │
   │        └──────┬──────┘        │
   │  VILLAGE +    │  MOUNTAINS    │
   │  FARMS: crops,│  rock, snow,  │
   │  houses, well │  peaks to y 52│
   └───────────────┴───────────────┘
 x = 0          z = 0            x = 127
```

- **Hub** (center, ~20 × 20): flat stone plaza, the respawn point, 4 paths out to the quadrants. Some starting tools here.
- **Forest** (−x, +z): gentle hills (±3), dense trees (log trunks 4–7 high, leaf blobs), bushes, berry bushes, mushrooms. Bats, slimes, goblins.
- **Castle** (+x, +z): raised ground (y 24), outer walls with gaps, a courtyard, a keep, and a **tower to y ≈ 50** with an outside staircase (1-block steps, so auto-climb works). Platinum tool on top. Skeletons, goblins.
- **Mountains** (+x, −z): noise heightmap to y ≈ 52, rock with snow caps, boulders, caves. Ledges that need Jump stat. Golems, slimes. Platinum tool on the highest peak.
- **Village & farms** (−x, −z): flat, 6–8 plank houses with roofs, a well, fenced farm fields (farmland + corn/pumpkin rows). Lots of crops = lots of powerups. Goblins, slimes.

### 9.3 Dungeons

Four hidden dungeons, one per quadrant, carved into rows y 3–17:

| Dungeon | Entrance | Content |
|---|---|---|
| Forest | hollow tree trunk | bats, mushrooms, 2 chests |
| Castle | cellar hatch in the keep | skeletons, lava, stone chests, platinum tool |
| Mountain | cave mouth on a cliff | golems, crystals, platinum tool |
| Village | bottom of the well | slimes (lvl 3), gold-pedestal platinum tool |

Each is 3–5 rectangular rooms joined by corridors, made of dungeon brick. Monsters are level 3. You can also dig into them with a shovel.

### 9.4 Generation

- One function per region, all called in `_init` with `srand(seed)`; the **layout is fixed** (always the same quadrants, castle and dungeons) and the **details are random** per match (tree positions, boulders, crop rows, tool and powerup spots) **[assumed]**.
- Heightmap: simple value noise (a few octaves) written in plain JS; no library.
- Target: whole world generated in < 1 s.

---

## 10. Challenges

At the end of the trial, 3 different challenges are drawn from the pool. The player picks **1, 2 or all 3** **[assumed — see Q8]**; all chosen goals must be finished inside **one 90-second timer**. Picking all 3 is the **Ultimate Challenge**.

| Challenge | Setup | Goal | Default size |
|---|---|---|---|
| **Boss** | A level-6 version of a random minion type, scale ×3, spawns 12 blocks in front of the player. Card names it ("BIG GOBLIN"). | Defeat it | HP ×8 of base, dmg ×2.5 |
| **Harvest** | Card names one target class: trees (logs), crops, or rocks. | Break X of them | logs 25, crops 20, rocks 15 |
| **Minion battle** | Minions in a 30-block radius are boosted to aggro the player; extra waves spawn. | Defeat X minions | 15 |
| **Battle royale** | The 3 AI heroes, with their current stats and tools, turn hostile and hunt the player. | Knock out each AI hero once | 3 |
| **Race** | Player teleported to a start point; a finish flag placed 70–100 blocks away, visible with an arrow on HUD. | Touch the flag | — |

- The world stays as it is (broken blocks stay broken) **[assumed]**.
- During challenges that aren't Battle royale, AI heroes are removed **[assumed]**.
- Dying during a challenge = **fail** **[assumed]**.
- **Best time** is saved per *combination* of challenge types, keyed like `"boss+race"` (sorted), as the seconds used out of 90.

---

## 11. Screens & HUD

Screen is 256 × 256; 7 × 10 px font. Trial HUD:

```
┌──────────────────────────────────────────┐
│ HP ████████░░ 84/100       4:12          │  top: HP bar, timer (center)
│ SP 7  ST 4  HP 6  DF 3                   │  stats row 1
│ FQ 2  RC 5  AG 1  JP 3                   │  stats row 2 (flash on gain)
│                                          │
│                                          │
│                                          │
│              (3D view)                   │
│                                          │
│                                          │
│ [O: SWORD]              [X: HAMMER]      │  bottom: hand slots + cooldown bars
└──────────────────────────────────────────┘
```

- Gaining a stat: that stat flashes and a small "+1 SPD" floats up.
- Tool-in-range prompt replaces the hand slot label briefly.
- Off-screen arrow to the race flag during Race.
- Last 10 seconds of any timer: timer turns red and ticks.

---

## 12. Art & asset budgets

The cart is built from scratch with its own assets (not the Starter kit), as text files in the project folder (§14).

### 12.1 Vox models (64 max)

| Range | Use |
|---|---|
| 0–2 | Hero head (idle, blink, hurt) — recolored per hero with `pal()` |
| 3 | Hand |
| 4 | Foot |
| 5–10 | Minions: slime, bat, goblin, skeleton, golem, mushroom |
| 11–19 | Tools 1–9 (single layer, flat "sprite" style). Bare hand has no model. |
| 20–27 | Powerup icons, one per stat |
| 28 | Heart |
| 29 | Race flag |
| 30–31 | Spare effects (spark, star) |
| 32–63 | Free |

Platinum tools reuse 11–19 with a gold `pal()` swap.

### 12.2 Character rig

A hero is drawn as: head vox at the ball center, hands at ±0.35 to the side and 0.15 forward (relative to yaw), feet at ±0.15, 0.4 down. Animations are code, not models:

- **Walk**: feet alternate forward/back `±0.12·sin(walkPhase)`; hands swing opposite.
- **Airborne**: feet together and down; hands up. **Flap**: hands flap `±0.2·sin(t·0.4)` vertically.
- **Swing**: the hand moves along the arc on frame 1 and holds for 6 frames, the tool vox drawn at the hand, rotated to point outward.

### 12.3 Hero colors

Player red; AI heroes blue, green, yellow (via `pal()` on the head's main color).

### 12.4 Sounds (first pass)

swing, hit flesh, hit block, block break, pickup powerup, pickup tool, hurt, knock-out, flap, pound land, challenge start, win, fail, tick (last 10 s), menu move, menu select; plus one trial song and one challenge song.

---

## 13. AI heroes

Three AI heroes use the **same hero code** as the player (stats, tools, physics, swing) with a "brain" that writes a virtual stick and buttons instead of reading input.

Brain, run every 15 frames (decisions) with steering every frame:

1. **Goal selection** — score candidate targets within 24 blocks:
   - loose powerup: `10 / dist`
   - crop / bush / rock / chest block: `drop chance × 8 / dist`
   - better loose tool than one in hand: `12 / dist`
   - minion: `6 / dist` if hero is strong enough (total stats ≥ minion level × 4)
   - player / other hero within 6 blocks: `5 / dist` if this hero's total stats ≥ theirs, else flee
   - Pick the highest; if nothing, wander to a random point in its current quadrant.
2. **Steering** — virtual stick points at target. Auto-climb and ledge hop come free from the shared physics.
3. **Acting** — if target in reach and arc, hold the hand with the best multiplier for that material.
4. **Stuck** — if position changes < 1 block in 2 s, pick a new random goal; if stuck 3 times, swing at the block in front (digging through).
5. **Difficulty knob** — reaction delay and goal re-evaluation interval.

---

## 14. Code architecture

### 14.1 Project layout (b3d project folder in this repo)

```
herotrial/
  DESIGN.md            this document
  game/
    cart.json          name, palette, ok-warnings
    main.js            the whole game
    tiles/NN-name.txt  tiles 1–23
    vox/NN-name.txt    models 0–31
    sfx/NN-name.txt    sounds
    music.txt
  dist/                b3d export output (GitHub Pages)
```

### 14.2 `main.js` sections, in order

1. **Constants & tables**: `TILES`, `MAT`, `TOOLS`, `MINIONS`, `STATS`, `CHALLENGES`, `ACCOMPLISHMENTS`, tuning numbers.
2. **World**: chunk creation, `wget`/`wset`/`chunksNear`/`wpush`, generation per region, dungeon carving.
3. **Heroes**: create, stat-derived values (`maxSpeed(h)` etc.), physics step, swing, damage, death/respawn.
4. **Input & brains**: player input → `h.ctrl = {sx, sy, b4, b5, b4p, b5p}`; AI brain writes the same struct.
5. **Minions**: spawn, behavior, damage.
6. **Pickups**: powerups, tools, hearts, debris particles.
7. **Block damage**: damage map, breaking, drops.
8. **Camera**.
9. **States**: `title`, `spawn`, `trial`, `select`, `challenge`, `results`, `board` — each with `update` and `draw`.
10. **HUD & UI drawing**.
11. **Save & accomplishments**: load/save, event counters, checks.
12. `_init`, `_update`, `_draw`: dispatch to the current state.

Rule of thumb: game objects are plain objects in arrays (`heroes`, `minions`, `pickups`, `particles`); no classes.

### 14.3 Testing

- `b3d check game/` after every change.
- `b3d run` with `--eval` hooks for system tests, e.g. place hero next to a rock with a hammer, `--input "o:1-120"`, `--watch "stats.total"`.
- `b3d shot` of key moments (each quadrant, HUD, challenge select) for visual review.
- A `DEBUG` flag: draw hit samples as spheres, show FPS/entity counts, `T` = skip to challenge select, 10× powerups.

### 14.4 Performance budget (to verify in milestone 0)

| Thing | Budget |
|---|---|
| Chunk remesh on block break | < 4 ms |
| Chunks drawn | 64 |
| Heroes | 4 |
| Minions alive | ≤ 40 |
| Loose powerups + tools | ≤ 150 (draw only within 40 blocks) |
| Particles | ≤ 100 |

---

## 15. Open questions (for the quiz)

These are the places where I filled a gap or found two readings. Each has my current assumption in the doc.

1. **No jump button.** Is the ledge hop really the only way up (besides 1-block auto-climb)? It means stairs everywhere and ledges need a run-up.
2. **In-air buttons.** In the air, O = flap and X = pound, so you can't swing while airborne. OK?
3. **Pickup vs swing.** Same button picks up a nearby tool or swings. Is the "in range → pick up" prompt enough, or should pickup need a hold?
4. **Camera with sideways input.** Camera-relative movement + aggressive auto-follow makes "hold left" spin you in circles. I planned to follow only on forward motion. Or should left/right *steer* like a kart?
5. **What counts as "powerups lost" on death** — do they spill on the ground for others to grab, or just vanish?
6. **Which tool is lost on death** — random hand, dropped on the ground?
7. **Hitting a hero** — does it knock powerups out of them (City Trial style)?
8. **Challenge picks** — 1, 2 or 3? The notes say "one … or all three" but also "more than one".
9. **AI heroes during non-royale challenges** — removed, frozen, or still competing?
10. **World during the challenge** — same world as the trial (holes and all), or reset?
11. **Swing hitting blocks** — cap of 3 blocks per swing, and block damage heals after 4 s?
12. **Unbreakable floor** — bedrock at the bottom and map edges, so nobody digs out of the world?
13. **Map randomness** — fixed layout with random details each match, or fully random, or fully fixed?
14. **Spawn** — random quadrant each match, or the player picks?
15. **Negative patches** — City Trial has stat-down patches. Want any?
16. **HP regen** — none (hearts only), or slow regen?
17. **Accomplishments** — want me to draft all 150, or give categories and write them together?
18. **Platinum tools** — just stronger stats, or also a special effect each?
19. **Water** — no water at all, or water as a slowing tile?
20. **Hosting** — export to GitHub Pages from this repo?

---

## 16. Milestones

| # | Milestone | Done when |
|---|---|---|
| 0 | **Spike**: chunked world of test terrain, hero walking/climbing/hop/flap/pound, camera; measure remesh and draw cost. | Hero runs around a 128 × 128 world at 60 fps; breaking a block causes no visible hitch. |
| 1 | **Swinging**: two hands, all 10 tools, block damage/breaking, drops, powerups, all 8 stats wired. | Can farm stats from rocks/crops and feel the stats change. |
| 2 | **World**: the four quadrants, hub, tower, four dungeons, tool and powerup placement. | Every area exists and is reachable. |
| 3 | **Minions**: six types, spawning, levels, drops. | Minions fight back; dungeons are dangerous. |
| 4 | **AI heroes**: brain, hero-vs-hero combat. | Three rivals visibly grow stronger over 5 minutes. |
| 5 | **Match flow**: all states, timer, challenge select, five challenges, results. | A full match plays start to finish. |
| 6 | **Persistence**: best times, accomplishment board and checks. | Times and accomplishments survive a reload. |
| 7 | **Polish**: art pass, sounds, music, HUD, title, export. | Playable on desktop, gamepad and phone. |

## 17. Accomplishment board (structure)

150 entries in a data table: `{ id, name, desc, check }`, where `check(stats)` reads lifetime and per-run counters. Board shows a 10 × 15 grid; done = filled square. Categories, roughly 15–25 each:

- **Firsts** — win your first challenge; break your first chest; pick up a platinum tool.
- **Collecting** — max out a stat; reach 100 total stats in one trial; collect 1,000 powerups lifetime.
- **Tools** — win a challenge with each tool; use two of the same tool; win with bare hands only.
- **Challenges** — win each challenge type; win every pair; win the Ultimate Challenge.
- **Speed** — finish Race under 30 s; beat a boss under 20 s.
- **Exploration** — enter all four dungeons; stand on the tower top; reach the highest peak.
- **Combat** — knock out 3 heroes in one trial; ground-pound a minion from 20 blocks up.
- **Restraint & oddities** — win an Ultimate Challenge with only 1 tool; win without ever being knocked out; finish a trial with 0 Speed.
