# Hero Trial — Design Document

*A 5-minute roguelike for BLOCKO3D 0.1.0-alpha (with 255 tiles / 256 vox models). Draft 3, 2026-11-05.*

This document is written to be built from. Every system has concrete numbers so it can be coded directly; numbers are first guesses for tuning, not promises. Design questions were settled in the quiz; the answers are recorded in §15.

**Changes in draft 3 (quiz answers)**
- **Jump** added: press O + X together (§4.3). Walking off a ledge still hops.
- **Tool pickup** is a hold, not a tap (§4.1).
- Challenge select: **exactly 1, or all 3** (§10).
- Fixed **chest and crop tiles removed**; chests and crops exist only as props (§8.1).
- **Small breakable tree** prop added (§8.2).
- Hosting on **GitHub Pages** from this repo (§14.1).

**Changes in draft 2**
- **The map is fixed.** Map tiles are never broken or changed during play. Everything you smash is a **prop**: a breakable vox object that sits on the map (§8).
- Every tile from the old tile table still exists as a fixed map tile, and gets a **breakable vox twin** (a vox log, a vox pumpkin, a vox chest…).
- The chunk system, block damage map and "shovel digs the block below" are gone. The world is now **4 quadrant maps** that can be edited in the IDE's Map tab and placed by a **scene** (§9).
- Asset budgets use the new limits: tiles 1–255, vox models 0–255 (§12).

---

## 1. One-paragraph pitch

You are a hero dropped into a 128 × 128 × 64 block world with 3 AI rival heroes. For **5 minutes** you run around smashing crops, rocks, logs, chests, minions and each other to collect **stat powerups** and pick up **tools** (one per hand). When the clock runs out, the game offers **3 challenges**; you pick one, or take on more of them as a harder run, and have **90 seconds** to finish. Best times are saved, and a 150-entry **accomplishment board** gives long-term goals. No unlocks gate gameplay.

Inspirations: Kirby Air Riders' City Trial (the loop, patches, machines → tools), Vampire Survivors (stat snowballing), Minecraft (block world).

---

## 2. Engine facts that shape the design

| Fact | Consequence for Hero Trial |
|---|---|
| The Map tab edits maps up to 128 per side and **524,288 blocks**. 128 × 64 × 128 is 1,048,576. | The world is **4 quadrant maps of 64 × 64 × 64** (262,144 each), so every part of it can be hand-edited in the IDE (§9.1). |
| A scene places map copies and **vox markers** (`scene_load(n).things` → `[v, x, y, z, yaw]`). | Scene 0 is the world: it places the 4 quadrants and holds hand-placed markers for props, tools, spawn points and dungeon content. |
| A map's mesh is rebuilt only when it's **drawn** after an `mset`. `mpush` reads the block grid directly. | Prop collision uses an **invisible collision map** that is never drawn, so adding and removing props there costs nothing (§8.3). |
| `mpush(maps, …)` takes a list of maps and returns which map you stand on. | Heroes collide with `[quadrants…, PROPMAP]` in one call and can stand on props. |
| Each `vox()` is one draw. | Props are culled by distance and direction before drawing (§14.4). |
| 255 tiles, 256 vox models, 32 colors, 64 sounds. | Plenty of room: every fixed tile has a prop twin, plus variants. `pal()` recolors platinum tools, heroes and bosses. |
| Square 256 × 256 screen, text is 7 × 10 px. | Compact HUD (§11). |
| Buttons 4 (O) and 5 (X); touch shows a d-pad/analog circle + O + X. | Two hands = two buttons; jump is both at once (§4.3). `touch_set_mode(1)` for analog. |
| `mouse_set_mode(2)`: mouse-look on desktop, finger-drag look on touch; `stick(1)` is the right stick. | Manual camera on every input type. |
| `vox(..., sx, sy, sz)` scales per axis. | Minion squash animation, prop hit-wobble and big bosses are free. |
| `freeze(n)` holds the picture for n updates. | Hit-stop on big hits and kills. |
| `save()` holds 64 KB of JSON. | Best times + 150 accomplishment flags + lifetime counters fit easily. |
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
| `spawn` | `scene_load(0)`, props placed (§8.4). Player placed at one of **4 spawn points** (one per quadrant) chosen at random; AI heroes take the other three. 2-second "READY / GO". | after 120 frames → `trial` |
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
| **O (btn 4) = left hand** | Tap: swing left tool. Hold: auto-repeat swings at cooldown rate. Hold near a loose tool: **pick it up**. | Hold: **flap** (slow fall) |
| **X (btn 5) = right hand** | Same, right hand. | Press: **ground pound** |
| **O + X together** | **Jump** | — |
| Mouse (captured) / finger drag / right stick | Rotate camera | Rotate camera |

**Pickup rule**: if a loose tool is within **1.2 blocks** (horizontal) and ±1 vertical, a prompt shows ("hold O/X: take SWORD") with a fill bar. Holding a hand's button for **24 frames** while the tool is still in range picks up the nearest one into that hand, and the old tool drops where the new one was. The first press still swings as usual; once the hold passes 8 frames near a tool, auto-repeat swings stop so the pickup reads clearly.

**Jump chord**: if the second button goes down within **4 frames** of the first, it's a jump (§4.3). The first button's swing still happens (swings are instant, so there is no input delay on normal swings); the second button does not swing.

### 4.2 Climbing

Walking into a wall that is **exactly 1 block high** climbs it automatically: if `mpush` reports a sideways push while grounded and moving, the cell in front at foot level is solid, and the cell above it is empty, set `vy = 0.15`. Two-block walls stop you. This works on solid props too (you can climb onto a crate), because props live in the collision map.

### 4.3 Jump and ledge hop

- **Jump**: O + X together while grounded (§4.1) → `vy = jumpVel(J)` (§6).
- **Ledge hop**: when the hero **walks off an edge** (grounded last frame, not grounded now, not already going up), they hop automatically with the same `vy = jumpVel(J)`.
- Both get bigger with the Jump stat. After either, O and X switch to their air roles (flap, pound).

### 4.4 Flap (glide)

Holding O in the air caps the fall speed: `vy = max(vy, -glideCap(J))`. Arms flap. No stamina limit.

### 4.5 Ground pound

Pressing X in the air: `vy = -0.45`, horizontal speed × 0.3, `pounding = true`, record `poundStartY = y`. On landing: both hands swing at once with a damage multiplier `1 + 0.15 × (poundStartY − y)`, capped at ×4. Small camera shake and `freeze(4)` if anything was hit. Landing on a prop hits that prop too.

---

## 5. Movement & physics

All in blocks and frames (60 updates/s). Hero is a ball of radius **0.4**, center at feet + 0.4, collision via `mpush(WORLD, x, y, z, 0.4)` where `WORLD = [q0, q1, q2, q3, PROPMAP]`.

- Gravity: `vy -= 0.01` per frame, terminal `vy ≥ -0.6`.
- Ground speed: velocity eases toward `stickDir × maxSpeed(S)` with factor `traction(A)` per frame (`vx = lerp(vx, target, traction)`). Low agility = slidey starts and stops.
- Air control: same but traction × 0.35.
- Facing (`yaw`): turns toward movement direction at `0.08 + 0.004·A` of the remaining angle per frame. Swings go where you face.
- Hit knockback: `v += dir × 0.15 × (1 + dmg/20)`, plus `vy = 0.08`; 30 frames of invulnerability (flicker).
- Out of bounds: `y < -4` → knocked out (§8.7).

### 5.1 Camera

Chase camera, kart-style. State: `camYaw`, `camPitch` (default 0.08), `camDist` (default 3.8), `idle` counter.

1. **Manual input** (`mouse_delta`, `stick(1)`): rotates `camYaw`/`camPitch` directly; sets `manualHold = 60` frames during which auto-follow is off.
2. **Moving**: `camYaw += angdiff(camYaw, yaw) × 0.08 × fwd`, where `fwd = max(0, −sy)` is the forward part of the stick. Aggressive follow while running forward; strafing or backing up doesn't swing the camera, so holding sideways never walks you in circles.
3. **Stopped**: wait 30 frames, then `camYaw += angdiff(camYaw, yaw) × 0.015` (slow swing in behind).
4. **Occlusion**: `mray` from hero toward camera on the quadrant maps (not props); pull the camera in to the hit (min 1.2).
5. `cam_orbit([x, y + 0.6, z], camYaw, -camPitch, camDist)`.

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

Raising Health also heals by the same amount. HP does not regenerate otherwise; a rare **heart** drop restores 25 %. Every powerup is positive (no stat-down patches).

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
| 8 | Shovel | 7 | 1.3 | 0.12 | 30 | smash + dig | Its arc also reaches one cell **below** your feet, so it can hit flush-to-the-ground props like dig spots (§8.2) |
| 9 | Hoe | 3 | 1.3 | 0.33 | 24 | harvest | — |

**Platinum** versions (tools 1–9): dmg ×1.5, reach ×1.2, cd ×0.8, drawn with a gold `pal()` swap and a shimmering outline. No special effects, just better numbers. Only ~6 per match, in hard-to-reach places (§9).

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

`flesh` = minions and heroes. Fixed map tiles have no material for combat; swings pass harmlessly into them (a "clink" spark and sound).

**Final damage** = `tool.dmg × dmgMul(Strength) × MAT[type][material] × (pound multiplier)` → then the target's Defense (heroes/minions) or straight off the prop's HP.

### 7.3 The swing

1. **Frame 0 (windup)**: hand pulls back. Nothing is hit.
2. **Frame 1 (strike)**: the tool snaps to the end of its arc. All hits resolve on this frame.
3. **Frames 2–7 (trail)**: 5 fading spheres along the arc, visual only.
4. Cooldown starts at frame 1. Holding the button re-swings as soon as cooldown ends.

**One hit test for everything.** Heroes, minions, props and powerups are all "hittables" with a position and radius. A target is hit if:
- horizontal distance ≤ `reach + target.r`,
- vertical offset from the hero's center is between **−0.6 and +1.2** (shovel: **−1.6** to +1.2),
- the angle to it is within `arc/2` of `yaw`.

Candidates come from a **spatial grid** (4 × 4-block buckets), so only nearby things are tested. A swing hits **every** target in its arc, each once per swing, so big reach and arc builds can mow a whole field. No `mray`/`mgetw` sampling needed.

**Powerups**: any loose powerup in the arc and reach (× 1.5 for whip) is collected. Walking within 0.7 also collects.

Two hands swinging on the same frame is allowed; each hand has its own cooldown.

### 7.4 Combat between characters

- Heroes hit by any hero or minion take damage (§6 Defense), knockback, i-frames.
- Each time a hero is hit by **another hero**, they spill **1 powerup** (random stat they have > 0) that pops out as a loose pickup, City Trial style. The stat drops by 1.
- Big hits (final damage ≥ 15) trigger `freeze(3)`.

---

## 8. Things in the world

### 8.1 Fixed map tiles

The map is built from **unbreakable** tiles. They are scenery and ground; the only gameplay properties left are hazards and a footstep sound group. Chest and crop tiles were dropped (they'd look breakable but aren't); chests and crops exist only as props.

| id | Tile | Notes |
|---|---|---|
| 1 | grass | top layer |
| 2 | dirt | |
| 3 | rock | mountain faces, boulders that are scenery |
| 4 | stone (cut) | castle walls |
| 5 | dungeon brick | |
| 6 | log | big fixed tree trunks |
| 7 | planks | village buildings |
| 8 | leaves | big fixed tree crowns |
| 9 | bush | hedges |
| 10 | farmland | **auto-sprouts crop props on top** (§8.4) |
| 11 | sand/path | roads |
| 12 | snow | mountain tops |
| 13 | roof | |
| 14 | bedrock | map floor |
| 15 | crystal | dungeon walls |
| 16 | lava | hazard: touching = 10 dmg/s |
| 17 | gold block | pedestals under platinum tools |
| 18–255 | free | more tiles as the art grows |

Tile data lives in a small `TILES` table: `{ name, hazard?, sound }`.

### 8.2 Props (the breakable things)

A **prop** is a vox model sitting on the map, occupying one block cell (or a 2 × 2 × 2 space for big props). Props are what you smash for powerups. Most fixed tiles have a **breakable twin** prop; chests, crops and small trees are props only.

| Prop (vox) | Twin of tile | Material | HP | Solid? | Drops | Regrows | Where |
|---|---|---|---|---|---|---|---|
| Grass tuft | grass | plant | 3 | no | 10 %, 1 | 30 s | meadows, everywhere |
| Dirt mound | dirt | earth | 8 | yes | 15 %, 1 | 60 s | paths, farms |
| **Dig spot** | dirt | earth | 6 | no (flush) | 100 %, 2–3 | never | hidden; only the shovel's low reach hits it |
| Rock | rock | rock | 18 | yes | 40 %, 1 | 60 s | mountains, everywhere |
| Big boulder (2³) | rock | rock | 60 | yes | 100 %, 3–4 | 120 s | mountains |
| Stone block | stone | stone | 35 | yes | 50 %, 1–2 | 90 s | castle rubble |
| Brick pile | dungeon brick | stone | 50 | yes | 60 %, 2 | never | dungeons |
| **Small tree** | — | wood | 20 | yes | 50 %, 1–2 | 60 s | forest, village edges; 1 cell, drawn at scale 1.5 so it stands ~1.5 tall; 2–3 looks |
| Log | log | wood | 16 | yes | 40 %, 1 | 60 s | forest floor, woodpiles |
| Crate | planks | wood | 14 | yes | 70 %, 1–2 | 60 s | village, castle |
| Leaf pile | leaves | plant | 3 | no | 15 %, 1 | 30 s | forest |
| Bush | bush | plant | 4 | no | 35 %, 1 | 30 s | everywhere |
| Corn | — | crop | 5 | no | 70 %, 1 | 45 s | farmland |
| Pumpkin | — | crop | 8 | yes | 85 %, 1–2 | 45 s | farmland |
| Berry bush | — | crop | 4 | no | 60 %, 1 | 45 s | forest edge |
| Sprout | farmland | crop | 2 | no | 25 %, 1 | 20 s | farmland (young crop) |
| Sand pile | sand/path | earth | 6 | yes | 15 %, 1 | 60 s | paths |
| Snowball | snow | earth | 5 | yes | 30 %, 1 | 60 s | mountain tops |
| Shingle stack | roof | wood | 12 | yes | 40 %, 1 | 60 s | village |
| Wood chest | — | wood | 30 | yes | 100 %, 4–6 | never* | everywhere, few |
| Stone chest | — | stone | 50 | yes | 100 %, 6–8, +10 % tool | never* | castle, dungeons |
| Mossy chest | — | earth | 30 | yes | 100 %, 4–6 | never* | forest, hidden spots |
| Crystal | crystal | rock | 25 | yes | 100 %, 2 | never | dungeons |
| Gold block | gold block | stone | 40 | yes | 100 %, 3 | never | rare, hard places |
| *(no twin)* | bedrock | — | — | — | — | — | — |
| *(no twin)* | lava | — | — | — | — | — | — |

\* Chests don't regrow in place; instead, **new chests appear** at random chest spots during the trial (§8.4).

- **Prop record**: `{ kind, x, y, z, yaw, hp, alive, regrowAt, hitT, size }`. `PROPS` table holds `{ vox, mat, hp, solid, drop, dropN, regrow, size }` per kind.
- **Regrowing**: a broken prop comes back after its regrow time, but only if no hero is within 6 blocks (so it doesn't pop up in your face). It grows in with a quick scale-up.
- **Damage persists** on a prop until it breaks or regrows (no healing).
- **Hit feedback**: prop flashes white (`pal` all → 7) for 4 frames and wobbles (`sx/sz` 1.15 → 1), plus 3 debris specks.
- **Break**: 6 debris cubes in the prop's main color, break sound, roll drops (§8.5), remove from collision map.
- Variants: there's room in the vox budget for 2–3 looks of common props (two rock shapes, three bush shapes), chosen at random.

### 8.3 Prop collision

- `PROPMAP = map_new(128, 64, 128)`: an **invisible** map that is never drawn. A solid prop writes tile 1 into each cell it occupies (`mset`); breaking it writes 0. Because the map is never drawn, these writes cost nothing.
- Heroes and minions collide with `[q0, q1, q2, q3, PROPMAP]` in one `mpush`; standing on a pumpkin or crate just works, and so does auto-climbing onto one.
- Non-solid props (grass, bushes, corn, leaf piles…) are walk-through.
- The camera ignores props for occlusion.

### 8.4 Where props come from

Three sources, so props can be placed by hand **or** fill an area without hand-placing hundreds of things:

| Source | How | Used for |
|---|---|---|
| **Scene markers** | In scene 0, put a vox marker using the prop's model. At spawn, each marker becomes that prop. Markers of non-prop models mean other things (table below). | Chests, gold blocks, crystals, dig spots, anything placed on purpose |
| **Tile rules** | At spawn, scan the maps once: on top of every **farmland** tile with air above, place a crop (corn 50 %, pumpkin 30 %, sprout 20 %). | Farms: paint farmland in the Map tab, crops appear |
| **Scatter zones** | A small table of rectangles in code, each with a prop mix and a count. Spots are chosen at random; the top surface is found with `mray` straight down, and spots on hazards, roofs or too-steep ground are skipped. | Rocks across the mountains, logs and bushes in the forest, grass tufts everywhere |

Special marker models (not props):

| Marker | Meaning |
|---|---|
| Hero head | spawn point (4, one per quadrant) |
| Each tool model | loose tool at match start (platinum if placed on a gold tile) |
| Each minion model | minion spawn point (its type) |
| Chest-spot marker | a place where a chest may appear later in the trial |
| Flag | candidate race start / finish point |

Chest top-ups: every **20 s**, if fewer than 8 chests exist, a random chest spot without a chest gets one (wood 60 %, mossy 25 %, stone 15 %), with a sparkle so heroes can spot it.

Budget: roughly **600–900 props** in the world at once.

### 8.5 Powerups

- A powerup is `{ stat, x, y, z, vx, vy, vz, life }`. It pops out of whatever broke with a random upward velocity, bounces once, then rests on the ground (`mpush` with r = 0.25).
- Drawn as a **billboard**: `vox(POW_VOX[stat], x, y, z, 0, yaw_to(camX − x, camZ − z))`, with `outline(c)` where `c` cycles through 3 bright colors every 8 frames.
- Each stat has its own icon model and color (§12).
- Despawn after 40 s on the ground (blink in the last 5 s).
- **Ambient spawning**: 60 powerups placed at match start; then 1 new powerup every 2 s at a random surface spot (weighted toward the hub and roads), until 120 are on the ground.
- Drop stat choice: uniform random. 4 % of drops are a **heart** instead.

### 8.6 Loose tools

- Tools at match start come from **tool markers** in scene 0, plus ~12 random extras on scatter-zone spots (hoes near farms, axes in the forest, hammers/maces near castle and mountain).
- ~6 platinum tools: markers on gold-block pedestals (tower top, mountain peak, deep in dungeons).
- Dropped tools are also loose tools. Billboarded like powerups, outline white.

### 8.7 Minions

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
- Minions don't attack props.
- **Drops**: slime 1, bat 1, goblin 1–2, mushroom 1, skeleton 2, golem 3–4, plus 1 per level above 1.
- **Levels**: level 1–3; level multiplies HP and dmg by `1 + 0.5·(lvl−1)` and scale by `1 + 0.15·(lvl−1)`. Dungeons spawn level 3. Surface: level 2 at 35 %, and a further +1 at 25 % more than 40 blocks from the hub. Level 3 minions have a red outline.
- **Population**: ~30 alive on the surface at once; when one dies, a new one spawns after 10 s at a minion marker of its zone that is out of the player's view. Dungeon minions do not respawn.
- Physics: same `mpush` as heroes (bats skip gravity). No pathfinding; they steer straight at the target and hop 1-block steps.

### 8.8 Death & respawn

- HP ≤ 0 or `y < −4` → the hero is "knocked out".
- Lose **30 % of collected powerups** (rounded up), chosen at random from stats > 0; they **spill as loose powerups** at the knock-out spot for anyone to grab (or at the hub, if you fell off the map).
- Lose **one tool**: a random non-empty hand drops its tool on the ground at the knock-out spot (or at the hub, if you fell off).
- Respawn at the **hub in the map center** after 60 frames, full HP, 120 frames of i-frames.

---

## 9. The map

### 9.1 Structure

- World is **128 (x) × 64 (y) × 128 (z)**, made of **4 quadrant maps, each 64 × 64 × 64**, all fixed.
- **Scene 0** places them at `[0,0,0]`, `[64,0,0]`, `[0,0,64]`, `[64,0,64]` and holds all the markers (§8.4).
- Since nothing breaks, maps are drawn with `map(m)` and **never remeshed during play**.
- Collision: `WORLD = [...scene.maps, PROPMAP]`.

**Authoring workflow**
1. I write a `.gen.js` script per quadrant (heightmap, trees, castle, houses, dungeons) to make a first version.
2. You open the cart in the IDE and hand-edit any quadrant in the Map tab, and place markers in the Scene tab.
3. Once a quadrant has been hand-edited, its `.gen.js` is deleted and the `.bin` becomes the source (b3d `pack` enforces this, so edits are never lost).

### 9.2 Layout

Ground level is **y = 20**, leaving rows 1–19 for dungeons, with bedrock at y = 0. The play plane is a 120 × 120 square with rounded corners (radius 16), surrounded by void — walk off it and you fall.

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

Each region is one quadrant map, which makes editing one region independent of the others. The hub sits across all four corners where they meet.

- **Hub** (center, ~20 × 20): flat stone plaza, the respawn point, 4 paths out to the quadrants. Some starting tools here.
- **Forest** (−x, +z): gentle hills (±3), big fixed trees (log trunks, leaf crowns) mixed with many small breakable trees, plus log, bush, berry-bush and leaf-pile props. Bats, slimes, goblins, mushrooms.
- **Castle** (+x, +z): raised ground (y 24), outer walls with gaps, a courtyard, a keep, and a **tower to y ≈ 50** with an outside staircase (1-block steps, so auto-climb works). Crates and stone-block rubble props. Platinum tool on top. Skeletons, goblins.
- **Mountains** (+x, −z): heightmap to y ≈ 52, rock with snow caps, caves. Rock, boulder and snowball props. Ledges that need Jump stat. Golems, slimes. Platinum tool on the highest peak.
- **Village & farms** (−x, −z): flat, 6–8 plank houses with roofs, a well, fenced farmland fields (crops sprout automatically). Crates and shingle stacks. Goblins, slimes.

### 9.3 Dungeons

Four hidden dungeons, one per quadrant, in rows y 3–17. Entrances are fixed openings (no digging in).

| Dungeon | Way in / out | Content |
|---|---|---|
| Forest | stairs down inside the giant hollow tree | 3 rooms; 2 mossy chests, a chest spot, crystal, brick piles; bats, mushrooms |
| Castle | stairs down from the keep floor | 3 rooms; a lava room (1-deep pit, stepping stones, island with the platinum spear), 2 stone chests, crystals, a gold block |
| Mountain | a cave mouth on the mountainside, stairs down into the mountain | 3 rooms; a tall crystal cavern (6 crystals, gold block, platinum hammer) |
| Village | drop down the well; walk out up stairs that come up inside a house | 3 rooms; 4 dig spots and the platinum shovel; slimes (lvl 3) |

All stairs are 3 wide, 1 block per step (auto-climb works both ways). Rooms are dungeon brick, 5 high (the crystal cavern 7), joined by 3-wide halls. Dungeon floors stand at y = 6. Monsters (milestone 3) are level 3.

**Platinum tools (6):** sword on the castle tower, axe on top of the giant tree (a 2-wide stair winds up its trunk), mace on the mountain's highest peak, spear on the lava island, hammer in the crystal cavern, shovel in the village dungeon. Each sits on a gold block; a tool marker on gold is platinum.

**Lava**: anything within half a block of lava takes 4 damage and is bounced up (with i-frames), so crossing the pit costs HP unless every gap is jumped.

### 9.4 What changes from match to match

The **map is always the same**. What varies (with a random seed per match): which quadrant you spawn in, the scatter-zone props, crop types on farmland, which chest spots get chests, extra tools, minion types and levels at each spawn point, and the three challenges offered.

---

## 10. Challenges

At the end of the trial, 3 different challenges are drawn from the pool. The player picks **exactly one**, or **all three** (the **Ultimate Challenge**). With all three, every goal must be finished inside **one 90-second timer**.

Select screen: three cards side by side plus a fourth **ULTIMATE** card; left/right moves, O confirms.

| Challenge | Setup | Goal | Default size |
|---|---|---|---|
| **Boss** | A level-6 version of a random minion type, scale ×3, spawns 12 blocks in front of the player. Card names it ("BIG GOBLIN"). | Defeat it | HP ×8 of base, dmg ×2.5 |
| **Harvest** | Card names one prop class: wood (small trees, logs, crates), crops, or stone (rocks, boulders, stone blocks). All props of that class regrow instantly when the challenge starts. | Break X of them | wood 25, crops 20, stone 15 |
| **Minion battle** | Minions in a 30-block radius are boosted to aggro the player; extra waves spawn. | Defeat X minions | 15 |
| **Battle royale** | The 3 AI heroes, with their current stats and tools, turn hostile and hunt the player. | Knock out each AI hero once | 3 |
| **Race** | Player teleported to a flag marker; a finish flag is placed at another flag marker 70–100 blocks away, with an arrow on the HUD. | Touch the flag | — |

- During challenges that aren't Battle royale, AI heroes are removed.
- Dying during a challenge = **fail**.
- **Best time** is saved per challenge type (`"boss"`, `"race"`, …) and per Ultimate combination, keyed like `"ult:boss+harvest+race"` (sorted), as the seconds used out of 90.

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

### 12.1 Tiles (1–255)

| Range | Use |
|---|---|
| 1–23 | The fixed tiles in §8.1 |
| 24–63 | Variants and detail (cracked stone, mossy brick, flowers-in-grass, fence, window, door, water) |
| 64–255 | Free |

### 12.2 Vox models (0–255)

| Range | Use |
|---|---|
| 0–2 | Hero head (idle, blink, hurt) — recolored per hero with `pal()` |
| 3 | Hand |
| 4 | Foot |
| 5–15 | Minions (6 types, room for 5 more) |
| 16–31 | Tools 1–9 as 16 sword, 17 hammer, 18 axe, 19 spear, 20 pocket knife, 21 whip, 22 mace, 23 shovel, 24 hoe (flat sprites pointing along +y, pivot at the grip). Bare hand has no model. |
| 32–39 | Powerup icons, in stat order: speed, strength, health, defense, frequency, reach, agility, jump |
| 40 | Heart |
| 41 | Race flag |
| 42 | Chest-spot marker (editor only, never drawn) |
| 43–47 | Effects (spark, star, debris) |
| 48–127 | **Props** (assigned: 48–49 grass tufts, 50 dirt mound, 51 dig spot, 52–53 rocks, 54 boulder, 55 stone block, 56 brick pile, 57–58 small trees, 59 log, 60 crate, 61 leaf pile, 62 bush, 63 corn, 64 pumpkin, 65 berry bush, 66 sprout, 67 sand pile, 68 snowball, 69 shingle stack, 70 wood chest, 71 stone chest, 72 mossy chest, 73 crystal, 74 gold block): each kind from §8.2 plus variants (e.g. 48 grass tuft a, 49 grass tuft b, 50 rock a, 51 rock b, …). The `PROPS` table maps vox number → kind, so a marker of any variant is understood. Small trees are 8³ models drawn at scale 1.5. |
| 128–255 | Free |

Platinum tools reuse the tool models with a gold `pal()` swap. Big props (boulder) are drawn from an 8³ model at scale 2.

### 12.3 Character rig

A hero is drawn as: head vox at the ball center, hands at ±0.35 to the side and 0.15 forward (relative to yaw), feet at ±0.15, 0.4 down. Animations are code, not models:

- **Walk**: feet alternate forward/back `±0.12·sin(walkPhase)`; hands swing opposite.
- **Airborne**: feet together and down; hands up. **Flap**: hands flap `±0.2·sin(t·0.4)` vertically.
- **Swing**: the hand moves along the arc on frame 1 and holds for 6 frames, the tool vox drawn at the hand, rotated to point outward.

### 12.4 Hero colors

Player red; AI heroes blue, green, yellow (via `pal()` on the head's main color).

### 12.5 Sounds (first pass)

swing, hit flesh, hit prop, prop break, clink (hit fixed tile), pickup powerup, pickup tool, hurt, knock-out, flap, pound land, chest appears, challenge start, win, fail, tick (last 10 s), menu move, menu select; plus one trial song and one challenge song.

---

## 13. AI heroes

Three AI heroes use the **same hero code** as the player (stats, tools, physics, swing) with a "brain" that writes a virtual stick and buttons instead of reading input.

Brain, run every 15 frames (decisions) with steering every frame:

1. **Goal selection** — score candidate targets within 24 blocks:
   - loose powerup: `10 / dist`
   - prop: `drop chance × dropN × 8 / dist` (chests score high)
   - better loose tool than one in hand: `12 / dist`
   - minion: `6 / dist` if hero is strong enough (total stats ≥ minion level × 4)
   - player / other hero within 6 blocks: `5 / dist` if this hero's total stats ≥ theirs, else flee
   - Pick the highest; if nothing, wander to a random point in its current quadrant.
2. **Steering** — virtual stick points at target. Auto-climb and ledge hop come free from the shared physics.
3. **Acting** — if target in reach and arc, hold the hand with the best multiplier for that material.
4. **Stuck** — if position changes < 1 block in 2 s, pick a new random goal and blacklist the old one for 10 s.
5. **Difficulty knob** — reaction delay and goal re-evaluation interval.

---

## 14. Code architecture

### 14.1 Project layout (b3d project folder in this repo)

```
herotrial/
  DESIGN.md              this document
  game/
    cart.json            name, map sizes, palette, ok-warnings
    main.js              the whole game
    tiles/NNN-name.txt   tiles
    vox/NNN-name.txt     models
    sfx/NN-name.txt      sounds
    music.txt
    maps/0-forest.gen.js   (then .bin once hand-edited)
    maps/1-castle.gen.js
    maps/2-village.gen.js
    maps/3-mountains.gen.js
    scenes.json          scene 0: quadrant placements + markers
  docs/                  b3d export output, served by GitHub Pages (main branch, /docs folder)
  ACCOMPLISHMENTS.md     the 150 drafted accomplishments, for review
```

Publishing: `b3d export game/ --out docs/`, commit, push. The game is then live at `https://paloblanco.github.io/herotrial/` once Pages is turned on for `/docs`.

### 14.2 `main.js` sections, in order

1. **Constants & tables**: `TILES`, `PROPS`, `MAT`, `TOOLS`, `MINIONS`, `STATS`, `CHALLENGES`, `ACCOMPLISHMENTS`, `ZONES`, tuning numbers.
2. **World**: `scene_load(0)`, `PROPMAP`, reading markers, tile rules, scatter zones, chest top-ups, spatial grid.
3. **Heroes**: create, stat-derived values (`maxSpeed(h)` etc.), physics step, swing, damage, death/respawn.
4. **Input & brains**: player input → `h.ctrl = {sx, sy, b4, b5, b4p, b5p}`; AI brain writes the same struct.
5. **Minions**: spawn, behavior, damage.
6. **Props**: hit, break, drops, regrow.
7. **Pickups & particles**: powerups, tools, hearts, debris.
8. **Camera**.
9. **States**: `title`, `spawn`, `trial`, `select`, `challenge`, `results`, `board` — each with `update` and `draw`.
10. **HUD & UI drawing**.
11. **Save & accomplishments**: load/save, event counters, checks.
12. `_init`, `_update`, `_draw`: dispatch to the current state.

Rule of thumb: game objects are plain objects in arrays (`heroes`, `minions`, `props`, `pickups`, `particles`); no classes.

### 14.3 Testing

- `b3d check game/` after every change (markers buried in or floating over the map get flagged for free).
- `b3d run` with `--eval` hooks for system tests, e.g. place a hero next to a rock prop with a hammer, `--input "o:1-120"`, `--watch "props.filter(p=>!p.alive).length"`.
- `b3d shot` of key moments (each quadrant, HUD, challenge select) for visual review.
- `b3d map --at x,z --scene 0` to check heights when placing things.
- A `DEBUG` flag: draw hit areas, show FPS/entity counts, skip to challenge select, 10× powerups.

### 14.4 Performance budget (to verify in milestone 0)

| Thing | Budget |
|---|---|
| Quadrant maps drawn | 4 (static meshes, built once) |
| Props alive | ≤ 900; **drawn** only within 40 blocks and not behind the camera, target ≤ 300 draws |
| Heroes | 4 |
| Minions alive | ≤ 40 |
| Loose powerups + tools | ≤ 150 (drawn within 40 blocks) |
| Particles | ≤ 100 |

---

## 15. Decisions (from the quiz, 2026-11-05)

| # | Topic | Decision |
|---|---|---|
| 1 | Jump | Jump button added: **O + X together**. Ledge hop on walking off an edge stays. |
| 2 | Air buttons | O = flap, X = ground pound. No swings in the air. |
| 3 | Tool pickup | **Hold** the hand's button near a loose tool. Taps always swing. |
| 4 | Camera | Auto-follow only from the forward part of the stick; strafing doesn't spin the camera. |
| 5 | Powerups lost on knockout | 30 %, **spilled** on the ground for anyone. |
| 6 | Tool lost on knockout | Random hand, **dropped** on the ground. |
| 7 | Hero-on-hero hits | Each hit knocks **1 powerup** out. |
| 8 | Challenge picks | **Exactly 1, or all 3** (Ultimate). |
| 9 | AI heroes in challenges | Removed, except in Battle royale. |
| 10 | Prop regrowth | Yes, timed per kind; chests don't regrow, new chests appear instead. |
| 11 | Multi-hit | A swing hits **everything** in its arc. |
| 12 | Fixed chest / crop tiles | **Dropped.** Chests and crops are props only. |
| 13 | Map authoring | Claude generates drafts in code; Rocco hand-edits in the IDE. |
| 14 | Trees | Big fixed trees plus **small breakable tree props** (1 cell, drawn ~1.5 tall). |
| 15 | Prop solidity | Hard things solid (rocks, logs, trees, crates, chests, pumpkins); soft things walk-through. |
| 16 | Spawn | Random quadrant each match. |
| 17 | Negative patches | None. |
| 18 | HP regen | Hearts only (plus the heal from raising Health). |
| 19 | Accomplishments | Claude drafts all 150 in `ACCOMPLISHMENTS.md`; Rocco edits. |
| 20 | Platinum tools | Better stats only, no special effects. |
| 21 | Hosting | GitHub Pages from this repo (`/docs`). |

## 16. Milestones

| # | Milestone | Done when |
|---|---|---|
| 0 | **Spike**: 4 placeholder quadrant maps in a scene, `PROPMAP`, ~800 placeholder props, hero walking/climbing/hop/flap/pound, camera. | Hero runs around the whole world at 60 fps with props drawn and collidable.  **Done 2026-11-05** (see §18). |
| 1 | **Swinging**: two hands, all 10 tools, unified hit test, prop damage/breaking/regrow, drops, powerups, all 8 stats wired. | Can farm stats from props and feel the stats change. **Done 2026-11-05** (see §18). |
| 2 | **World**: generated drafts of the four quadrants, hub, tower, four dungeons; markers, tile rules, scatter zones, chest top-ups. | Every area exists, is reachable, and is full of props. **Done 2026-11-05** (see §18). |
| 3 | **Minions**: six types, spawning, levels, drops. | Minions fight back; dungeons are dangerous. **Done 2026-11-05** (see §18). |
| 4 | **AI heroes**: brain, hero-vs-hero combat. | Three rivals visibly grow stronger over 5 minutes. |
| 5 | **Match flow**: all states, timer, challenge select, five challenges, results. | A full match plays start to finish. |
| 6 | **Persistence**: best times, accomplishment board and checks. | Times and accomplishments survive a reload. |
| 7 | **Polish**: art pass, sounds, music, HUD, title, export. | Playable on desktop, gamepad and phone. |

---

## 17. Accomplishment board (structure)

150 entries in a data table: `{ id, name, desc, check }`, where `check(stats)` reads lifetime and per-run counters. Board shows a 10 × 15 grid; done = filled square. Categories, roughly 15–25 each:

- **Firsts** — win your first challenge; break your first chest; pick up a platinum tool.
- **Collecting** — max out a stat; reach 100 total stats in one trial; collect 1,000 powerups lifetime.
- **Tools** — win a challenge with each tool; use two of the same tool; win with bare hands only.
- **Challenges** — win each challenge type; win every pair; win the Ultimate Challenge.
- **Speed** — finish Race under 30 s; beat a boss under 20 s.
- **Exploration** — enter all four dungeons; stand on the tower top; reach the highest peak; find a dig spot.
- **Combat** — knock out 3 heroes in one trial; ground-pound a minion from 20 blocks up.
- **Restraint & oddities** — win an Ultimate Challenge with only 1 tool; win without ever being knocked out; finish a trial with 0 Speed.

---

## 18. Build status

### Milestone 0 (2026-11-05)

Built in `game/`, playable from `docs/` (GitHub Pages) or by opening `herotrial.b3d.json` in the IDE.

- 4 quadrant maps generated by `game/lib/world.mjs` (forest, castle with tower and spiral stair, village with houses, farm fields and well, mountains), placed by scene 0 with 4 spawn markers and 4 chest markers.
- ~1,180 props: scene markers, farmland crops (tile rule) and scatter zones. Solid props collide through the invisible `PROPMAP`.
- Hero: camera-relative walking, auto-climb, O+X jump chord, ledge hop, flap, ground pound (×4 cap reached from the tower), bare-hand swing animation (no hits yet), knock-out off the map → hub.
- 3 AI heroes wander their home quadrants with the same movement code and a virtual stick.
- Chase camera with forward-only follow, slow swing-in when stopped, mouse/finger/right-stick look, wall pull-in.

Measured (headless, software rendering): game logic ~0.05–0.15 ms per update, draw-call setup ~0.2–0.8 ms per frame with 130–180 props drawn. Real fps depends on the GPU and must be checked on a real device; the HUD shows fps, props drawn, and CPU times while `DEBUG` is on.

Known issues:
- **Map seams**: `outline(0)` draws a line where two quadrant maps meet, so the hub and the paths along x = 64 and z = 64 show a straight black line. Options: an engine change so maps can share one outline group, drawing maps without outlines, or hiding the seams under walls/paths.
- Movement at 0 Speed feels slow (3.3 blocks/s); tune after stats are collectable.
- Assets are placeholders.

### Milestone 1 (2026-11-05)

Feedback from milestone 0 applied: camera closer (distance 3.8, aimed lower), walk cycle 50 % slower, maps drawn **without outlines** (props, heroes and pickups keep their outer outline), and a much bigger swing: windup pose, body lunge and twist, head squash, a hero shake while the swing lands, a fat trail across the whole arc at the tool's real reach, an impact burst at the arc's end, a small camera kick, and hit-stop (`freeze`) when something is hit.

New:
- All 10 tools with the §7.1 numbers, platinum versions (gold palette, ×1.5 dmg, ×1.2 reach, ×0.8 cooldown); tools carried, swung and lying on the ground as billboards.
- The unified arc hit test (§7.3) against props, heroes and powerups; damage types × materials (§7.2); stat effects on damage, cooldown, reach and arc.
- Props: hit flash and wobble, debris, breaking, drops, regrowth when no hero is near, chests appearing at 16 chest-spot markers every 20 s (max 8). All prop kinds from §8.2 have models; boulders are 2 × 2 × 2.
- Powerups: 60 at the start plus 1 every 2 s (max 120), pop out of broken props, bounce, rest, blink, vanish after 40 s; hearts (4 %).
- Tools: 14 tool markers + 12 random + a platinum sword on a gold pedestal at the tower top; hold O/X 24 frames to pick up (fill bar), taps always swing.
- HP and Defense; hero hits knock one powerup out; knockouts spill 30 % of powerups and drop a random tool; respawn at the hub after 1 s with 2 s of blinking i-frames. Lava hurts.
- Ground pound strikes with both hands and also hits the prop it lands on.
- HUD: HP bar, 5:00 timer, 8 stats (flash on gain), "+1 STR" popups, hand slots with tool names and cooldown/pickup bars.
- 12 sounds: jump, swing, hit, break, powerup, tool, hurt, knockout, clink, pound, chest, step.
- Small props (crops, grass, bushes) are drawn out to 26 blocks, big ones to 40: at most ~300 prop draws, in the farm fields.

Tested headless: bare hands break a rock in ~4.5 s, a hammer in one hit; hold-to-pickup and tap-to-swing; walking into powerups; regrowth after 30 s; a sword hit knocks a powerup out of a rival; a knockout spills 30 % and drops the rival's tool; an 11-block pound smashes the pumpkin it lands on.

Not yet: AI heroes still only wander (milestone 4), so they never fight back; the timer reaches 0:00 and shows TIME! but the challenge select is milestone 5.

### Milestone 2 (2026-11-05)

- Four dungeons (§9.3), each with 3 rooms, halls, and a way in and out; the giant hollow tree in the forest; a gold pedestal on the highest mountain peak. All 6 platinum tools placed.
- Tower stair widened to 2 blocks (the 1-wide one was easy to fall off at corners); the giant tree's stair is 2 wide too.
- Dig spots (8: 4 in the village dungeon, 4 hidden outside) can only be broken by a shovel; they drop 2–3 powerups.
- Big props (boulders) check the ground under all four cells (one was sitting half over the cave mouth).
- Auto-climb needs 1 block of headroom, not 2.
- Lava fixed: it now hurts and bounces you (a hero could hover over a 1-wide pit without touching it).
- Props on the far side of the ground line aren't drawn (underground: 213 → 4 prop draws).
- `game/tools/markers.mjs` rebuilds scene 0's markers from `lib/world.mjs`. Stop using it once markers are placed by hand in the IDE.

Tested headless with a waypoint walker: every dungeon walked room to room; all four stairs climbed from the bottom to the surface; the well drop; the giant tree stair to its platform; the tower stair to the top; the lava crossing, walking and jumping; a one-minute soak run with no errors.

### Milestone 3 (2026-11-05)

- Six minion types with models (vox 5–10) and the §8.7 numbers: slimes hop at you, bats fly and bob toward you (both hurt on touch), goblins/skeletons/golems walk up, flash during a 16-frame windup and swing, mushrooms stay put and puff spores within 2.4 blocks.
- 18 level-3 garrison minions in the dungeons (never respawn); 75 surface spawn points (from `minionSpots()` in `lib/world.mjs`), 30 surface minions alive at once; a dead one comes back after 10 s at a spawn point outside the player's view.
- Minions chase the nearest hero in aggro range, keep chasing out to 1.5× that range, and give up 16 blocks from home. A hit interrupts their windup and knocks them back (big ones less). They don't stack.
- Minion hits don't knock powerups out of heroes (only hero hits do); knockouts from minions spill 30 % as usual.
- Squash animation per type: chase speed, slime landing squash, bat wing flutter, windup stretch.

Tested headless: each type hurts an idle hero (or knocks it out); each dies to a sword; the castle dungeon's level-3 skeletons knock out a 0-stat hero twice in 30 s, trade evenly at 5 in every stat, and lose at 10 in every stat with no knockouts.
