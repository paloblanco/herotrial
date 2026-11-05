// HERO TRIAL — milestone 2: the full world (dungeons, giant tree, platinum tools) on top of milestone 1.
// Design: DESIGN.md in the repo root. Section numbers below (§) point into it.

// =================================================================== 1. constants & tables

const DEBUG = true
const WORLD_W = 128, WORLD_H = 64, WORLD_D = 128
const HUB = [64, 20.4, 64]
const TRIAL_FRAMES = 300 * 60

// fixed map tiles (§8.1)
const T = { grass: 1, dirt: 2, rock: 3, stone: 4, brick: 5, log: 6, planks: 7, leaves: 8, bush: 9,
  farmland: 10, sand: 11, snow: 12, roof: 13, bedrock: 14, crystal: 15, lava: 16, gold: 17 }
const OPEN_GROUND = [T.grass, T.dirt, T.rock, T.sand, T.snow, T.farmland]   // props may sit on these

// vox numbers (§12.2)
const V = { head: 0, blink: 1, hurt: 2, hand: 3, foot: 4, heart: 40, flag: 41, chestSpot: 42 }

// sounds
const S = { jump: 0, swing: 1, hit: 2, brk: 3, pow: 4, tool: 5, hurt: 6, ko: 7, clink: 8, pound: 9, chest: 10, step: 11 }

// stats (§6)
const STATS = ['speed', 'strength', 'health', 'defense', 'frequency', 'reach', 'agility', 'jump']
const STAT_ABBR = ['SPD', 'STR', 'HP', 'DEF', 'FRQ', 'RCH', 'AGI', 'JMP']
const STAT_COL = [12, 8, 11, 6, 10, 13, 9, 14]
const POW_VOX = 32                           // powerup icon for stat i is vox 32 + i

// tools (§7.1). dmg, reach (blocks), arc (turns), cd (frames), damage types, stat offsets while held
const TOOLS = [
  { name: 'HAND',   vox: -1, dmg: 2,  reach: 0.9, arc: 0.25, cd: 14, types: ['normal'] },
  { name: 'SWORD',  vox: 16, dmg: 6,  reach: 1.6, arc: 0.33, cd: 22, types: ['cut'] },
  { name: 'HAMMER', vox: 17, dmg: 9,  reach: 1.5, arc: 0.33, cd: 45, types: ['smash'], mods: { speed: -6, agility: -6 } },
  { name: 'AXE',    vox: 18, dmg: 8,  reach: 1.3, arc: 0.33, cd: 40, types: ['chop'], flesh: 1.5 },
  { name: 'SPEAR',  vox: 19, dmg: 6,  reach: 2.6, arc: 0.12, cd: 28, types: ['cut'] },
  { name: 'KNIFE',  vox: 20, dmg: 3,  reach: 0.9, arc: 0.33, cd: 9,  types: ['cut'], mods: { speed: 4, agility: 4 } },
  { name: 'WHIP',   vox: 21, dmg: 2,  reach: 2.6, arc: 0.25, cd: 26, types: ['normal'], collect: 1.5 },
  { name: 'MACE',   vox: 22, dmg: 11, reach: 1.5, arc: 0.25, cd: 50, types: ['smash'] },
  { name: 'SHOVEL', vox: 23, dmg: 7,  reach: 1.3, arc: 0.12, cd: 30, types: ['smash', 'dig'], low: true },
  { name: 'HOE',    vox: 24, dmg: 3,  reach: 1.3, arc: 0.33, cd: 24, types: ['harvest'] },
]
const TOOL_OF_VOX = {}
for (let i = 1; i < TOOLS.length; i++) TOOL_OF_VOX[TOOLS[i].vox] = i

// damage type x material multipliers (§7.2)
const MAT = {
  normal:  { earth: 1,    rock: 0.5,  stone: 0.25, wood: 0.5,  plant: 1,   crop: 1,   flesh: 1 },
  cut:     { earth: 0.5,  rock: 0.25, stone: 0.25, wood: 0.75, plant: 3,   crop: 1.5, flesh: 1.2 },
  smash:   { earth: 1,    rock: 3,    stone: 2.5,  wood: 1,    plant: 0.5, crop: 0.5, flesh: 1.2 },
  chop:    { earth: 0.75, rock: 0.25, stone: 0.25, wood: 3,    plant: 2,   crop: 1,   flesh: 1 },
  dig:     { earth: 4,    rock: 1,    stone: 0.5,  wood: 0.5,  plant: 1,   crop: 1,   flesh: 0.5 },
  harvest: { earth: 0.5,  rock: 0.25, stone: 0.25, wood: 0.5,  plant: 2,   crop: 5,   flesh: 0.5 },
}

// props (§8.2). drop: chance of any drop; n: [min, max] drops; regrow: seconds (0 = never);
// cls: harvest-challenge class; size: cells per side (boulder is 2)
const PROPS = {
  tuft:      { vox: [48, 49], mat: 'plant', hp: 3,  solid: false, drop: 0.10, n: [1, 1], regrow: 30,  cls: '' },
  mound:     { vox: [50],     mat: 'earth', hp: 8,  solid: true,  drop: 0.15, n: [1, 1], regrow: 60,  cls: '' },
  digspot:   { vox: [51],     mat: 'earth', hp: 6,  solid: false, drop: 1.00, n: [2, 3], regrow: 0,   cls: '', onlyDig: true },
  rock:      { vox: [52, 53], mat: 'rock',  hp: 18, solid: true,  drop: 0.40, n: [1, 1], regrow: 60,  cls: 'stone' },
  boulder:   { vox: [54],     mat: 'rock',  hp: 60, solid: true,  drop: 1.00, n: [3, 4], regrow: 120, cls: 'stone', scale: 2, size: 2 },
  stoneblk:  { vox: [55],     mat: 'stone', hp: 35, solid: true,  drop: 0.50, n: [1, 2], regrow: 90,  cls: 'stone' },
  bricks:    { vox: [56],     mat: 'stone', hp: 50, solid: true,  drop: 0.60, n: [2, 2], regrow: 0,   cls: 'stone' },
  tree:      { vox: [57, 58], mat: 'wood',  hp: 20, solid: true,  drop: 0.50, n: [1, 2], regrow: 60,  cls: 'wood', scale: 1.5 },
  log:       { vox: [59],     mat: 'wood',  hp: 16, solid: true,  drop: 0.40, n: [1, 1], regrow: 60,  cls: 'wood' },
  crate:     { vox: [60],     mat: 'wood',  hp: 14, solid: true,  drop: 0.70, n: [1, 2], regrow: 60,  cls: 'wood' },
  leaves:    { vox: [61],     mat: 'plant', hp: 3,  solid: false, drop: 0.15, n: [1, 1], regrow: 30,  cls: '' },
  bush:      { vox: [62],     mat: 'plant', hp: 4,  solid: false, drop: 0.35, n: [1, 1], regrow: 30,  cls: '' },
  corn:      { vox: [63],     mat: 'crop',  hp: 5,  solid: false, drop: 0.70, n: [1, 1], regrow: 45,  cls: 'crop' },
  pumpkin:   { vox: [64],     mat: 'crop',  hp: 8,  solid: true,  drop: 0.85, n: [1, 2], regrow: 45,  cls: 'crop' },
  berry:     { vox: [65],     mat: 'crop',  hp: 4,  solid: false, drop: 0.60, n: [1, 1], regrow: 45,  cls: 'crop' },
  sprout:    { vox: [66],     mat: 'crop',  hp: 2,  solid: false, drop: 0.25, n: [1, 1], regrow: 20,  cls: 'crop' },
  sandpile:  { vox: [67],     mat: 'earth', hp: 6,  solid: true,  drop: 0.15, n: [1, 1], regrow: 60,  cls: '' },
  snowball:  { vox: [68],     mat: 'earth', hp: 5,  solid: true,  drop: 0.30, n: [1, 1], regrow: 60,  cls: '' },
  shingles:  { vox: [69],     mat: 'wood',  hp: 12, solid: true,  drop: 0.40, n: [1, 1], regrow: 60,  cls: 'wood' },
  woodchest: { vox: [70],     mat: 'wood',  hp: 30, solid: true,  drop: 1.00, n: [4, 6], regrow: 0,   cls: '', chest: true },
  stonechest:{ vox: [71],     mat: 'stone', hp: 50, solid: true,  drop: 1.00, n: [6, 8], regrow: 0,   cls: '', chest: true, toolChance: 0.1 },
  mosschest: { vox: [72],     mat: 'earth', hp: 30, solid: true,  drop: 1.00, n: [4, 6], regrow: 0,   cls: '', chest: true },
  crystal:   { vox: [73],     mat: 'rock',  hp: 25, solid: true,  drop: 1.00, n: [2, 2], regrow: 0,   cls: 'stone' },
  goldblk:   { vox: [74],     mat: 'stone', hp: 40, solid: true,  drop: 1.00, n: [3, 3], regrow: 0,   cls: 'stone' },
}
const PROP_OF_VOX = {}                      // vox number -> prop kind (for scene markers)
for (let k in PROPS) for (let v of PROPS[k].vox) PROP_OF_VOX[v] = k

// scatter zones (§8.4): world rectangles [x0, z0, x1, z1], a count and a mix of kinds
const ZONES = [
  { r: [4, 66, 61, 123],   n: 260, mix: { tree: 4, bush: 3, tuft: 4, log: 2, rock: 1, leaves: 2, berry: 2 } },  // forest
  { r: [66, 66, 123, 123], n: 140, mix: { crate: 2, rock: 2, tuft: 3, bush: 1, stoneblk: 2 } },                 // castle
  { r: [4, 4, 61, 61],     n: 140, mix: { tuft: 4, bush: 2, crate: 2, tree: 1, rock: 1, shingles: 1 } },        // village
  { r: [66, 4, 123, 61],   n: 200, mix: { rock: 6, tuft: 2, tree: 1, bush: 1, snowball: 1, mound: 1 } },        // mountains
  { r: [66, 4, 123, 61],   n: 8,   mix: { boulder: 1 } },                                                        // mountain boulders
  { r: [44, 44, 83, 83],   n: 30,  mix: { tuft: 3, bush: 1, crate: 1, sandpile: 1 } },                          // around the hub
]
const EXTRA_TOOLS = 12                      // random loose tools at match start, besides the scene's tool markers

// hero colors: palette color 8 on the head is recolored per hero (§12.4)
const HERO_COLORS = [8, 12, 11, 10]

// movement tuning (§5)
const GRAV = 0.01, TERMINAL = -0.6, R = 0.4
const CHORD = 4                             // frames between O and X that still count as a jump (§4.1)
const PICKUP_HOLD = 24, PICKUP_QUIET = 8    // frames to hold for a tool; after QUIET frames, repeat swings stop

// stat formulas (§6). s = effective stat 0-30
const maxSpeed = (s) => 0.055 + 0.0022 * s
const traction = (a) => 0.08 + 0.006 * a
const jumpVel  = (j) => 0.13 + 0.0045 * j
const glideCap = (j) => 0.11 - 0.0027 * j
const maxHP    = (s) => 20 + 4 * s

// =================================================================== 2. world

let scene, WORLD, QUADS, PROPMAP
let props = []                              // every prop record
let grid = {}                               // spatial grid: bucket key -> props in it (8 x 8 blocks)
let propAt = {}                             // cellKey -> prop (one prop per cell; big props fill several keys)
let spawns = [], chestSpots = []

const cellKey = (x, y, z) => x + WORLD_W * (y + WORLD_H * z)
const bucketKey = (x, z) => (x >> 3) + 16 * (z >> 3)

// which quadrant map covers world (x, z): 0 forest, 1 castle, 2 village, 3 mountains
const quadOf = (x, z) => (x >= 64 ? 1 : 0) + (z < 64 ? 2 : 0)

// the top of the ground at (x, z): [standY, tile], or null over the void
function groundAt(x, z) {
  if (x < 0 || z < 0 || x >= WORLD_W || z >= WORLD_D) return null
  let [t, xi, yi] = mray(QUADS[quadOf(x, z)], x, WORLD_H - 0.01, z, 0, -1, 0, WORLD_H)
  if (!t) return null
  return [yi + 1, t]
}

function solidAt(x, y, z) {
  for (let m of WORLD) if (mgetw(m, x, y, z)[0]) return true
  return false
}

function buildWorld() {
  scene = scene_load(0)
  QUADS = scene.maps
  PROPMAP = map_new(WORLD_W, WORLD_H, WORLD_D)   // invisible: never drawn, only collided with (§8.3)
  WORLD = QUADS.concat([PROPMAP])
  props = []; grid = {}; propAt = {}; spawns = []; chestSpots = []; pickups = []

  // scene markers (§8.4)
  for (let [v, x, y, z, yaw] of scene.things) {
    if (v == V.head) spawns.push([x, y + R, z])
    else if (v == V.chestSpot) chestSpots.push([flr(x), flr(y + 0.01), flr(z)])
    else if (TOOL_OF_VOX[v]) {
      let plat = mgetw(QUADS[quadOf(x, z)], x, y - 0.5, z)[0] == T.gold         // on a gold block: platinum
      addPickup('tool', x, y, z, { t: TOOL_OF_VOX[v], plat })
    }
    else if (PROP_OF_VOX[v]) addProp(PROP_OF_VOX[v], flr(x), flr(y + 0.01), flr(z), v, yaw)
  }

  // tile rule: crops on every farmland tile with air above
  for (let z = 0; z < WORLD_D; z++) for (let x = 0; x < WORLD_W; x++) {
    let g = groundAt(x + 0.5, z + 0.5)
    if (g && g[1] == T.farmland) {
      let r = rnd(1)
      addProp(r < 0.55 ? 'corn' : r < 0.85 ? 'pumpkin' : 'sprout', x, g[0], z)
    }
  }

  // scatter zones
  for (let zn of ZONES) {
    let kinds = [], [x0, z0, x1, z1] = zn.r
    for (let k in zn.mix) for (let i = 0; i < zn.mix[k]; i++) kinds.push(k)
    for (let i = 0, tries = 0; i < zn.n && tries < zn.n * 4; tries++) {
      let spot = randomSpot(x0, z0, x1, z1)
      if (spot && addProp(rnd(kinds), spot[0], spot[1], spot[2])) i++
    }
  }

  // extra tools on random open ground
  for (let i = 0, tries = 0; i < EXTRA_TOOLS && tries < 200; tries++) {
    let s = randomSpot(8, 8, 119, 119)
    if (s) { addPickup('tool', s[0] + 0.5, s[1], s[2] + 0.5, { t: 1 + flr(rnd(9)), plat: false }); i++ }
  }

  // a few chests to start (§8.4)
  for (let i = 0; i < 4; i++) spawnChest(true)

  // ambient powerups at the start (§8.5)
  for (let i = 0; i < 60; i++) spawnAmbientPowerup()
}

// a random free cell on open ground inside a rectangle: [x, standY, z], or null
function randomSpot(x0, z0, x1, z1) {
  let x = flr(x0 + rnd(x1 - x0 + 1)), z = flr(z0 + rnd(z1 - z0 + 1))
  let g = groundAt(x + 0.5, z + 0.5)
  if (!g || OPEN_GROUND.indexOf(g[1]) < 0 || g[1] == T.farmland) return null
  if (abs(x - 63.5) < 3 || abs(z - 63.5) < 3) return null           // keep the main paths clear
  if (propAt[cellKey(x, g[0], z)]) return null
  if (solidAt(x + 0.5, g[0] + 0.5, z + 0.5) || solidAt(x + 0.5, g[0] + 1.5, z + 0.5)) return null
  return [x, g[0], z]
}

// place a prop in cell (x, y, z): y is the height it stands on. Returns the prop or null.
function addProp(kind, x, y, z, vox, yaw) {
  let k = PROPS[kind], n = k.size || 1
  for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) {
    if (propAt[cellKey(x + dx, y, z + dz)]) return null
    if (n > 1) {                            // big props need open ground at the same height under every cell
      let g = groundAt(x + dx + 0.5, z + dz + 0.5)
      if (!g || g[0] != y || OPEN_GROUND.indexOf(g[1]) < 0 || solidAt(x + dx + 0.5, y + 0.5, z + dz + 0.5)) return null
    }
  }
  let p = { kind, x, y, z, vox: vox != null ? vox : rnd(k.vox), yaw: yaw != null ? yaw : flr(rnd(4)) / 4,
    hp: k.hp, alive: true, hitT: 0, growT: 0, regrowAt: 0 }
  props.push(p)
  for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) propAt[cellKey(x + dx, y, z + dz)] = p
  let b = bucketKey(x, z)
  ;(grid[b] = grid[b] || []).push(p)
  setPropSolid(p, true)
  return p
}

function setPropSolid(p, on) {
  let k = PROPS[p.kind], n = k.size || 1
  if (!k.solid) return
  for (let dy = 0; dy < n; dy++) for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++)
    mset(PROPMAP, p.x + dx, p.y + dy, p.z + dz, on ? 1 : 0)
}

// the middle of a prop, for hit tests and effects
function propCenter(p) {
  let n = PROPS[p.kind].size || 1
  return [p.x + n / 2, p.y + 0.5 * n * (PROPS[p.kind].scale || 1) / (PROPS[p.kind].size || 1), p.z + n / 2]
}

// ---- breaking and regrowing (§8.2)

function hitProp(p, dmg, h) {
  p.hp -= dmg
  p.hitT = 6
  let [cx, cy, cz] = propCenter(p)
  debris(cx, cy, cz, 3, propColor(p), 0.06)
  if (p.hp <= 0) breakProp(p, h)
}

function breakProp(p, h) {
  let k = PROPS[p.kind]
  p.alive = false
  p.regrowAt = k.regrow ? frame + k.regrow * 60 : 0
  setPropSolid(p, false)
  let [cx, cy, cz] = propCenter(p)
  debris(cx, cy, cz, 8, propColor(p), 0.12)
  sfx(S.brk)
  if (h) h.broken++
  if (rnd(1) < k.drop) {
    let n = k.n[0] + flr(rnd(k.n[1] - k.n[0] + 1))
    for (let i = 0; i < n; i++) dropPowerup(cx, cy, cz)
  }
  if (k.toolChance && rnd(1) < k.toolChance) addPickup('tool', cx, cy, cz, { t: 1 + flr(rnd(9)), plat: false }, true)
  // anything resting on it falls again
  for (let q of pickups) if (q.rest && abs(q.x - cx) < 1 && abs(q.z - cz) < 1 && q.y > p.y) q.rest = false
}

function regrowProps() {
  for (let p of props) {
    if (p.alive || !p.regrowAt || frame < p.regrowAt) continue
    let [cx, , cz] = propCenter(p), near = false
    for (let h of heroes) if (abs(h.x - cx) < 6 && abs(h.z - cz) < 6) near = true
    if (near) continue
    p.alive = true; p.hp = PROPS[p.kind].hp; p.growT = 20
    setPropSolid(p, true)
  }
}

// the color debris uses: the model's most common color, looked up once
const propColors = {}
function propColor(p) {
  if (propColors[p.kind] == null) {
    let c = { tuft: 11, mound: 4, rock: 5, boulder: 5, stoneblk: 6, bricks: 5, tree: 3, log: 4, crate: 15, leaves: 3,
      bush: 27, corn: 10, pumpkin: 9, berry: 8, sprout: 27, sandpile: 15, snowball: 7, shingles: 8,
      woodchest: 4, stonechest: 6, digspot: 4, mosschest: 27, crystal: 13, goldblk: 10 }
    propColors[p.kind] = c[p.kind] != null ? c[p.kind] : 6
  }
  return propColors[p.kind]
}

// chests appear at chest spots (§8.4)
function spawnChest(quiet) {
  let alive = 0
  for (let p of props) if (p.alive && PROPS[p.kind].chest) alive++
  if (alive >= 8 || chestSpots.length == 0) return
  for (let tries = 0; tries < 10; tries++) {
    let [x, y, z] = rnd(chestSpots)
    let old = propAt[cellKey(x, y, z)]
    if (old && old.alive) continue
    let r = rnd(1), kind = r < 0.6 ? 'woodchest' : r < 0.85 ? 'mosschest' : 'stonechest'
    let p = old
    if (p) { p.kind = kind; p.vox = PROPS[kind].vox[0]; p.alive = true; p.hp = PROPS[kind].hp; p.regrowAt = 0; setPropSolid(p, true) }
    else p = addProp(kind, x, y, z)
    if (!p) continue
    p.growT = 30
    if (!quiet) { sparkle(x + 0.5, y + 0.5, z + 0.5); if (dist([player.x, player.z], [x, z]) < 30) sfx(S.chest) }
    return
  }
}

// =================================================================== 3. heroes

let heroes = [], player

function makeHero(i, pos) {
  return { i, color: HERO_COLORS[i], x: pos[0], y: pos[1], z: pos[2], vx: 0, vy: 0, vz: 0,
    yaw: 0, grounded: false, wasGrounded: false, walk: 0, hop: false,
    flapping: false, pounding: false, poundY: 0, poundMul: 1, landT: 0,
    stats: { speed: 0, strength: 0, health: 0, defense: 0, frequency: 0, reach: 0, agility: 0, jump: 0 },
    hp: maxHP(0), iT: 0, koT: 0, hurtT: 0,
    tools: [null, null],                    // left (O), right (X): null = bare hand, else { t, plat }
    swingT: [99, 99], cd: [0, 0],           // frames since each hand's swing; cooldown left
    swingDir: [1, 1], lunge: 0, twist: 0,   // swing look: which way the arc runs; body lunge and twist
    pressT: [99, 99], chordLock: false,     // frames since each button went down; jump-chord latch
    holdT: [0, 0], near: null,              // tool pickup: frames held near a tool, the tool in range
    gained: [0, 0, 0, 0, 0, 0, 0, 0],       // HUD flash per stat
    broken: 0, collected: 0,
    ctrl: { sx: 0, sy: 0, b: [false, false], bp: [false, false] },
    brain: { goal: null, t: 0 } }
}

// effective stat: the hero's own value plus the held tools' offsets, clamped 0-30 (§6)
function stat(h, s) {
  let v = h.stats[s]
  for (let tl of h.tools) if (tl && TOOLS[tl.t].mods && TOOLS[tl.t].mods[s]) v += TOOLS[tl.t].mods[s]
  return mid(0, v, 30)
}

function totalStats(h) { let n = 0; for (let s of STATS) n += h.stats[s]; return n }

function gainStat(h, i) {
  let s = STATS[i]
  if (h.stats[s] >= 30) return
  h.stats[s]++
  if (s == 'health') h.hp = min(maxHP(h.stats.health), h.hp + 4)
  h.gained[i] = 30
  h.collected++
  if (h === player) popup('+1 ' + STAT_ABBR[i], STAT_COL[i])
}

function heroUpdate(h) {
  if (h.koT > 0) { if (--h.koT == 0) respawnHero(h); return }
  let c = h.ctrl
  let [fx, , fz] = dir3(h === player ? camYaw : h.yaw)

  // ---- tool in pickup range (§4.1)
  h.near = null
  let best = 1.2
  for (let q of pickups) if (q.kind == 'tool' && q.rest !== null) {
    let d = dist([q.x, q.z], [h.x, h.z])
    if (d < best && abs(q.y - (h.y - R)) < 1.2) { best = d; h.near = q }
  }

  // ---- buttons: jump chord, swings, flap, pound (§4)
  for (let k = 0; k < 2; k++) {
    if (c.bp[k]) {
      if (h.grounded && h.pressT[1 - k] <= CHORD && !h.chordLock) {      // second button of a chord: jump
        h.vy = jumpVel(stat(h, 'jump')); h.grounded = false; h.hop = true
        h.chordLock = true; sfx(S.jump)
      }
      h.pressT[k] = 0
    } else h.pressT[k]++
    h.holdT[k] = c.b[k] && h.near && h.grounded ? h.holdT[k] + 1 : 0
    if (h.holdT[k] >= PICKUP_HOLD) { pickUpTool(h, k, h.near); h.holdT[k] = 0; h.near = null }
  }
  if (h.chordLock && !c.b[0] && !c.b[1]) h.chordLock = false
  for (let k = 0; k < 2; k++) {
    h.swingT[k]++
    if (h.swingT[k] == 1) strike(h, k)                                  // frame 0 winds up, frame 1 hits (§7.3)
    if (h.cd[k] > 0) h.cd[k]--
    let quiet = h.holdT[k] > PICKUP_QUIET
    if (h.grounded && !h.chordLock && h.cd[k] == 0 && !quiet && (c.bp[k] || c.b[k])) startSwing(h, k)
  }
  h.flapping = !h.grounded && c.b[0] && !h.chordLock && h.vy < 0
  if (!h.grounded && c.bp[1] && !h.chordLock && !h.pounding) {
    h.pounding = true; h.poundY = h.y; h.vy = -0.45; h.vx *= 0.3; h.vz *= 0.3
  }

  // ---- walking, camera-relative (§5)
  let sx = c.sx, sy = c.sy
  let spd = maxSpeed(stat(h, 'speed'))
  let ax = (fx * -sy - fz * sx) * spd, az = (fz * -sy + fx * sx) * spd
  let tr = traction(stat(h, 'agility')) * (h.grounded ? 1 : 0.35)
  if (h.pounding) tr = 0
  h.vx = lerp(h.vx, ax, tr); h.vz = lerp(h.vz, az, tr)
  let moving = abs(sx) + abs(sy) > 0.2
  if (moving) {
    h.yaw += angdiff(h.yaw, yaw_to(ax, az)) * (0.25 + 0.01 * stat(h, 'agility'))
    h.walk++
    if (h.grounded && h === player && h.walk % 24 == 12) sfx(S.step)
  } else h.walk = 0

  // ---- auto-climb a 1-block step in front (§4.2)
  if (h.grounded && moving) {
    let m = sqrt(ax * ax + az * az) || 1, px = h.x + ax / m * 0.6, pz = h.z + az / m * 0.6
    let footY = flr(h.y - R + 0.05)
    if (solidAt(px, footY + 0.5, pz) && !solidAt(px, footY + 1.5, pz) && !solidAt(h.x, footY + 1.5, h.z)) {
      h.vy = 0.15; h.grounded = false
    }
  }

  // ---- gravity, flap
  h.vy = max(h.vy - GRAV, TERMINAL)
  if (h.flapping) h.vy = max(h.vy, -glideCap(stat(h, 'jump')))

  // ---- move and collide
  h.wasGrounded = h.grounded
  h.x += h.vx; h.y += h.vy; h.z += h.vz
  let [x, y, z, nx, ny, nz, ground] = mpush(WORLD, h.x, h.y, h.z, R)
  h.x = x; h.y = y; h.z = z
  h.grounded = ground >= 0
  if (h.grounded && h.vy < 0) {
    if (h.pounding) poundLand(h)
    h.vy = 0; h.hop = false
  }
  if (ny < -0.5 && h.vy > 0) h.vy = 0

  // ---- ledge hop: walked off a real edge (more than a 1-block step down) (§4.3)
  if (h.wasGrounded && !h.grounded && h.vy <= 0 && !h.hop && moving && !solidAt(h.x, h.y - R - 1.1, h.z)) {
    h.vy = jumpVel(stat(h, 'jump')); h.hop = true
  }

  // ---- lava
  let [t] = mgetw(QUADS[quadOf(h.x, h.z)], h.x, h.y - R - 0.6, h.z)        // within half a block of lava
  if (t == T.lava && h.iT == 0) { hurtHero(h, 4, null); h.vy = 0.24; h.grounded = false; h.hop = true; debris(h.x, h.y - R, h.z, 6, 9, 0.06) }

  // ---- powerups and hearts by touch
  for (let q of pickups) {
    if (q.kind == 'tool' || q.dead) continue
    if (abs(q.x - h.x) < 0.7 && abs(q.z - h.z) < 0.7 && abs(q.y + 0.3 - h.y) < 1) collect(h, q)
  }

  if (h.landT > 0) h.landT--
  if (h.iT > 0) h.iT--
  if (h.hurtT > 0) h.hurtT--
  if (h.lunge > 0) h.lunge *= 0.75
  h.twist *= 0.7
  for (let i = 0; i < 8; i++) if (h.gained[i] > 0) h.gained[i]--
  if (h.y < -4) knockOut(h, true)
}

// ---- swinging (§7.3)

function toolOf(h, k) { return h.tools[k] ? TOOLS[h.tools[k].t] : TOOLS[0] }

function startSwing(h, k) {
  let tl = toolOf(h, k), plat = h.tools[k] && h.tools[k].plat
  h.swingT[k] = 0
  h.swingDir[k] = -h.swingDir[k]            // alternate the arc's direction each swing
  h.cd[k] = max(4, flr(tl.cd * (1 - 0.02 * stat(h, 'frequency')) * (plat ? 0.8 : 1)))
}

// reach and arc for a hand, after stats (§6)
function reachOf(h, k) { let tl = toolOf(h, k); return tl.reach * (1 + 0.02 * stat(h, 'reach')) * (h.tools[k] && h.tools[k].plat ? 1.2 : 1) }
function arcOf(h, k) { return toolOf(h, k).arc + 0.004 * stat(h, 'agility') }

// the strike frame: everything inside the arc is hit once
function strike(h, k, mulIn) {
  let tl = toolOf(h, k), plat = h.tools[k] && h.tools[k].plat
  let reach = reachOf(h, k), half = arcOf(h, k) / 2
  let mul = (1 + 0.1 * stat(h, 'strength')) * (plat ? 1.5 : 1) * (mulIn || 1)
  let lo = tl.low ? -1.6 : -0.6, hits = 0, big = false
  let inArc = (x, y, z, r) => {
    let dx = x - h.x, dz = z - h.z, d = sqrt(dx * dx + dz * dz), dy = y - h.y
    if (d > reach + r || dy < lo || dy > 1.2) return false
    return d < 0.5 || abs(angdiff(h.yaw, yaw_to(dx, dz))) <= half + 0.02
  }
  let mm = (mat) => { let b = 0; for (let ty of tl.types) b = max(b, MAT[ty][mat]); return b }

  h.lunge = 0.32; h.twist = h.swingDir[k] * 0.16
  sfx(S.swing)
  if (h === player) shake = max(shake, 1.5)
  { let [ex, , ez] = dir3(h.yaw + h.swingDir[k] * half); burst(h.x + ex * reach, h.y + 0.05, h.z + ez * reach) }

  // props
  let b0x = max(0, flr((h.x - 4) / 8)), b1x = min(15, flr((h.x + 4) / 8))
  let b0z = max(0, flr((h.z - 4) / 8)), b1z = min(15, flr((h.z + 4) / 8))
  for (let bz = b0z; bz <= b1z; bz++) for (let bx = b0x; bx <= b1x; bx++) {
    for (let p of grid[bx + 16 * bz] || []) {
      if (!p.alive) continue
      let [cx, cy, cz] = propCenter(p), r = 0.45 * (PROPS[p.kind].size || 1)
      if (!inArc(cx, cy, cz, r)) continue
      if (PROPS[p.kind].onlyDig && tl.types.indexOf('dig') < 0) { sfx(S.clink); continue }   // only a shovel digs
      let dmg = tl.dmg * mul * mm(PROPS[p.kind].mat)
      hitProp(p, dmg, h); hits++
      if (dmg >= 15) big = true
    }
  }
  // other heroes
  for (let o of heroes) {
    if (o === h || o.koT > 0 || o.iT > 0) continue
    if (!inArc(o.x, o.y, o.z, R)) continue
    let dmg = tl.dmg * mul * mm('flesh') * (tl.flesh || 1)
    hurtHero(o, dmg, h); hits++
    if (dmg >= 15) big = true
  }
  // powerups inside the arc are collected (the whip reaches further) (§7.3)
  let creach = reach * (tl.collect || 1)
  for (let q of pickups) {
    if (q.kind == 'tool' || q.dead) continue
    let dx = q.x - h.x, dz = q.z - h.z, d = sqrt(dx * dx + dz * dz), dy = q.y - h.y
    if (d <= creach + 0.3 && dy > lo - 0.5 && dy < 1.5 && (d < 0.6 || abs(angdiff(h.yaw, yaw_to(dx, dz))) <= half + 0.05)) collect(h, q)
  }
  if (hits) {
    sfx(S.hit)
    if (h === player) { shake = max(shake, big ? 5 : 2); freeze(big ? 4 : 2) }
  }
}

function poundLand(h) {
  let drop = h.poundY - h.y
  h.pounding = false
  h.landT = 12
  h.poundMul = min(4, 1 + 0.15 * drop)
  // both hands swing at once with the pound bonus, and whatever is right under the feet is hit too (§4.5)
  for (let k = 0; k < 2; k++) { h.swingT[k] = 1; h.swingDir[k] = -h.swingDir[k]; strike(h, k, h.poundMul) }
  let under = propAt[cellKey(flr(h.x), flr(h.y - R - 0.5), flr(h.z))]      // a prop we landed on
  if (under && under.alive) {
    let tl = toolOf(h, 1)
    hitProp(under, tl.dmg * (1 + 0.1 * stat(h, 'strength')) * h.poundMul * 2, h)
  }
  debris(h.x, h.y - R, h.z, 10, 6, 0.1)
  if (h === player) shake = min(10, 3 + drop * 0.3)
  sfx(S.pound)
}

// ---- damage, knockouts (§7.4, §8.8)

function hurtHero(o, raw, from) {
  let d = stat(o, 'defense')
  let dmg = max(0, raw - 0.3 * d) * (1 - 0.01 * d)
  if (dmg <= 0) { sfx(S.clink); return }
  o.hp -= dmg
  o.iT = 30; o.hurtT = 12
  if (from) {
    let dx = o.x - from.x, dz = o.z - from.z, m = sqrt(dx * dx + dz * dz) || 1
    let kb = 0.15 * (1 + dmg / 20)
    o.vx += dx / m * kb; o.vz += dz / m * kb; o.vy = 0.08; o.grounded = false
    spillPowerups(o, 1)                     // City Trial: every hero hit knocks one out (§7.4)
  }
  sfx(S.hurt)
  if (o.hp <= 0) knockOut(o, false)
}

function knockOut(h, fell) {
  if (h.koT > 0) return
  let at = fell ? HUB : [h.x, h.y, h.z]
  let n = ceil(totalStats(h) * 0.3)
  spillPowerups(h, n, at)
  let held = [0, 1].filter((k) => h.tools[k])
  if (held.length) {                        // a random hand drops its tool
    let k = rnd(held)
    addPickup('tool', at[0], at[1], at[2], h.tools[k], true)
    h.tools[k] = null
  }
  debris(h.x, h.y, h.z, 14, h.color, 0.15)
  sfx(S.ko)
  h.koT = 60; h.vx = h.vy = h.vz = 0
  if (h === player) shake = 8
}

function respawnHero(h) {
  h.x = HUB[0] + rnd(2) - 1; h.y = HUB[1] + 1; h.z = HUB[2] + rnd(2) - 1
  h.vx = h.vy = h.vz = 0; h.pounding = false
  h.hp = maxHP(h.stats.health); h.iT = 120
}

// take n random powerups away from a hero and throw them out as loose pickups
function spillPowerups(h, n, at) {
  at = at || [h.x, h.y, h.z]
  for (let i = 0; i < n; i++) {
    let have = []
    for (let s = 0; s < 8; s++) if (h.stats[STATS[s]] > 0) have.push(s)
    if (!have.length) return
    let s = rnd(have)
    h.stats[STATS[s]]--
    if (STATS[s] == 'health') h.hp = min(h.hp, maxHP(h.stats.health))
    let q = addPickup('pow', at[0], at[1] + 0.3, at[2], s, true)
    q.vx *= 2; q.vz *= 2
  }
}

// =================================================================== 6. pickups & particles

let pickups = [], particles = [], popups = []

// kind: 'pow' (data = stat index), 'heart', or 'tool' (data = { t, plat }). pop: thrown up from a break
function addPickup(kind, x, y, z, data, pop) {
  let q = { kind, x, y, z, vx: 0, vy: 0, vz: 0, rest: !pop, life: kind == 'tool' ? -1 : 40 * 60, born: frame }
  if (kind == 'pow') q.stat = data
  if (kind == 'tool') q.tool = data
  if (pop) { let a = rnd(1); q.vx = cos(a) * 0.04; q.vz = sin(a) * 0.04; q.vy = 0.12 + rnd(0.06) }
  pickups.push(q)
  return q
}

function dropPowerup(x, y, z) {
  if (rnd(1) < 0.04) addPickup('heart', x, y, z, null, true)
  else addPickup('pow', x, y, z, flr(rnd(8)), true)
}

function spawnAmbientPowerup() {
  let n = 0
  for (let q of pickups) if (q.kind == 'pow') n++
  if (n >= 120) return
  for (let tries = 0; tries < 10; tries++) {
    let near = rnd(1) < 0.4
    let s = near ? randomSpot(44, 44, 83, 83) : randomSpot(6, 6, 121, 121)
    if (s) { addPickup('pow', s[0] + 0.5, s[1], s[2] + 0.5, flr(rnd(8))); return }
  }
}

function collect(h, q) {
  if (q.dead || frame - q.born < 20 && !q.rest) return    // just popped out: a moment before it can be grabbed
  q.dead = true
  if (q.kind == 'pow') { gainStat(h, q.stat); if (h === player) sfx(S.pow) }
  else if (q.kind == 'heart') {
    h.hp = min(maxHP(h.stats.health), h.hp + maxHP(h.stats.health) * 0.25)
    if (h === player) { sfx(S.pow); popup('+HP', 8) }
  }
}

function pickUpTool(h, k, q) {
  if (!q || q.dead) return
  let old = h.tools[k]
  h.tools[k] = q.tool
  q.dead = true
  if (old) addPickup('tool', q.x, q.y, q.z, old)     // the old tool lands where the new one was
  h.cd[k] = 10
  if (h === player) { sfx(S.tool); popup((q.tool.plat ? 'PLATINUM ' : '') + TOOLS[q.tool.t].name, q.tool.plat ? 10 : 7) }
}

function pickupsUpdate() {
  for (let q of pickups) {
    if (q.dead) continue
    if (q.life > 0 && --q.life == 0) { q.dead = true; continue }
    if (q.rest) continue
    q.vy = max(q.vy - GRAV, TERMINAL)
    q.x += q.vx; q.y += q.vy; q.z += q.vz
    let [x, y, z, nx, ny, nz, g] = mpush(WORLD, q.x, q.y + 0.25, q.z, 0.25)
    q.x = x; q.y = y - 0.25; q.z = z
    if (g >= 0 && q.vy < 0) {
      if (q.vy < -0.06) { q.vy *= -0.35; q.vx *= 0.5; q.vz *= 0.5 } else { q.rest = true; q.vx = q.vz = q.vy = 0 }
    }
    if (q.y < -4) q.dead = true
  }
  if (frame % 60 == 0) pickups = pickups.filter((q) => !q.dead)
}

function debris(x, y, z, n, c, sp) {
  for (let i = 0; i < n && particles.length < 160; i++) {
    let a = rnd(1)
    particles.push({ x, y, z, vx: cos(a) * rnd(sp), vy: 0.04 + rnd(sp * 1.2), vz: sin(a) * rnd(sp), c, life: 24 + flr(rnd(12)), s: 0.08 + rnd(0.1) })
  }
}

// a quick star of white specks where a swing ends
function burst(x, y, z) {
  for (let i = 0; i < 6 && particles.length < 160; i++) {
    let a = i / 6
    particles.push({ x, y, z, vx: cos(a) * 0.07, vy: 0.03 + rnd(0.04), vz: sin(a) * 0.07, c: 7, life: 10, s: 0.09, spark: true })
  }
}

function sparkle(x, y, z) {
  for (let i = 0; i < 12 && particles.length < 160; i++) {
    let a = i / 12
    particles.push({ x, y, z, vx: cos(a) * 0.05, vy: 0.08, vz: sin(a) * 0.05, c: 10, life: 30, s: 0.1, spark: true })
  }
}

function particlesUpdate() {
  for (let p of particles) { p.vy -= GRAV; p.x += p.vx; p.y += p.vy; p.z += p.vz; p.life-- }
  particles = particles.filter((p) => p.life > 0)
  for (let u of popups) u.t--
  popups = popups.filter((u) => u.t > 0)
}

function popup(text, c) { popups.push({ text, c, t: 50 }); if (popups.length > 4) popups.shift() }

// =================================================================== 4. input & brains

function playerInput(h) {
  let [sx, sy] = stick(0)
  h.ctrl.sx = sx; h.ctrl.sy = sy
  h.ctrl.b = [btn(4), btn(5)]
  h.ctrl.bp = [btnp(4), btnp(5)]
}

// placeholder brain until milestone 4: wander to random points in its home quadrant
function wanderBrain(h) {
  let b = h.brain, c = h.ctrl
  if (!b.goal || b.t-- <= 0 || dist([h.x, h.z], b.goal) < 1.5) {
    let q = h.i % 4, ox = (q % 2) * 64, oz = q < 2 ? 64 : 0
    b.goal = [ox + 8 + rnd(48), oz + 8 + rnd(48)]; b.t = 360
  }
  let want = yaw_to(b.goal[0] - h.x, b.goal[1] - h.z)
  c.sx = 0; c.sy = -1
  h.yaw += angdiff(h.yaw, want) * 0.15
  c.b = [false, false]; c.bp = [false, false]
}

// =================================================================== 8. camera (§5.1)

let camYaw = 0, camPitch = 0.08, camDist = 3.8, manualHold = 0, stillT = 0, shake = 0
let camPos = [0, 0, 0]

function cameraUpdate(h) {
  let [mx, my] = mouse_delta(), [rx, ry] = stick(1)
  let look = mx * 0.0012 + rx * 0.014, tilt = my * 0.0012 + ry * 0.01
  if (look || tilt) manualHold = 60
  camYaw -= look
  camPitch = mid(-0.02, camPitch + tilt, 0.22)
  if (manualHold > 0) { manualHold--; return }
  let fwd = max(0, -h.ctrl.sy)
  if (abs(h.ctrl.sx) + abs(h.ctrl.sy) > 0.2) {
    stillT = 0
    camYaw += angdiff(camYaw, h.yaw) * 0.08 * fwd
  } else if (++stillT > 30) camYaw += angdiff(camYaw, h.yaw) * 0.015
}

function cameraDraw(h) {
  let t = [h.x, h.y + 0.6, h.z], [fx, fy, fz] = dir3(camYaw, -camPitch)
  let d = camDist
  for (let m of QUADS) {
    let hit = mray(m, t[0], t[1], t[2], -fx, -fy, -fz, d)
    if (hit[0]) d = max(1.2, hit[7] - 0.3)
  }
  if (shake > 0) { t[0] += (rnd(2) - 1) * shake * 0.02; t[1] += (rnd(2) - 1) * shake * 0.02; shake *= 0.8; if (shake < 0.3) shake = 0 }
  cam_orbit(t, camYaw, -camPitch, d)
  camPos = [t[0] - fx * d, t[1] - fy * d, t[2] - fz * d]
}

// =================================================================== 9. states

let state = 'trial', frame = 0, trialLeft = TRIAL_FRAMES
let drawn = 0, fps = 60, lastMs = 0, fpsAcc = 0, fpsN = 0

function _init() {
  touch_set_mode(1)
  mouse_set_mode(2)
  frame = 0; trialLeft = TRIAL_FRAMES; particles = []; popups = []
  heroes = []
  buildWorld()
  let order = [0, 1, 2, 3].sort(() => rnd(1) - 0.5)          // random quadrant for the player (§3)
  for (let i = 0; i < 4; i++) heroes.push(makeHero(i, spawns[order[i] % spawns.length]))
  player = heroes[0]
  camYaw = yaw_to(64 - player.x, 64 - player.z)               // start looking toward the hub
  player.yaw = camYaw
}

let updMs = 0, drawMs = 0                    // DEBUG: smoothed CPU time of _update and _draw
const now = () => (typeof performance != 'undefined' ? performance.now() : Date.now())

function _update() {
  let t0 = now()
  frame++
  if (trialLeft > 0) trialLeft--
  playerInput(player)
  for (let i = 1; i < heroes.length; i++) wanderBrain(heroes[i])
  for (let h of heroes) heroUpdate(h)
  pickupsUpdate()
  particlesUpdate()
  if (frame % 30 == 0) regrowProps()
  if (frame % 120 == 0) spawnAmbientPowerup()
  if (frame % 1200 == 0) spawnChest(false)
  for (let p of props) { if (p.hitT > 0) p.hitT--; if (p.growT > 0) p.growT-- }
  cameraUpdate(player)
  updMs = lerp(updMs, now() - t0, 0.05)
}

function _draw() {
  let t0 = now()
  bg(12)
  cameraDraw(player)
  outline()                                   // maps without outlines
  for (let m of QUADS) map(m)
  outline(0, false)
  drawProps()
  for (let h of heroes) if (h.koT == 0 && !(h.iT > 0 && h.iT < 100 && frame % 4 < 2 && h.hurtT == 0)) drawHero(h)
  drawPickups()
  outline()
  drawParticles()
  drawMs = lerp(drawMs, now() - t0, 0.05)
  drawHud()
}

// =================================================================== drawing

const DRAW_R = 40, DRAW_SMALL = 26        // draw distances: big props, small props (crops, grass, bushes)

function drawProps() {
  drawn = 0
  let [fx, , fz] = dir3(camYaw)
  let cx = player.x, cz = player.z
  let under = player.y < 14                                    // in a dungeon: surface props are hidden, and the other way round
  let b0x = max(0, flr((cx - DRAW_R) / 8)), b1x = min(15, flr((cx + DRAW_R) / 8))
  let b0z = max(0, flr((cz - DRAW_R) / 8)), b1z = min(15, flr((cz + DRAW_R) / 8))
  for (let bz = b0z; bz <= b1z; bz++) for (let bx = b0x; bx <= b1x; bx++) {
    let list = grid[bx + 16 * bz]
    if (!list) continue
    for (let p of list) {
      if (!p.alive || (p.y < 14) != under) continue
      let k = PROPS[p.kind], n = k.size || 1
      let dx = p.x + n / 2 - camPos[0], dz = p.z + n / 2 - camPos[2]
      if (dx * fx + dz * fz < -2) continue                     // behind the camera
      let lim = k.solid && k.mat != 'crop' ? DRAW_R : DRAW_SMALL                // small props fade out sooner
      if (dx * dx + dz * dz > lim * lim) continue
      let s = k.scale || 1
      if (p.growT > 0) s *= 1 - p.growT / 24
      let sx = s, sy = s, ox = 0, oz = 0
      if (p.hitT > 0) {                                        // hit: flash white and wobble
        sx = s * (1 + p.hitT * 0.03); sy = s * (1 - p.hitT * 0.03)
        ox = (rnd(2) - 1) * 0.04; oz = (rnd(2) - 1) * 0.04
        for (let i = 0; i < 32; i++) pal(i, 7)
      }
      vox(p.vox, p.x + n / 2 + ox, p.y, p.z + n / 2 + oz, 0, p.yaw, 0, sx, sy, sx)
      if (p.hitT > 0) pal()
      drawn++
    }
  }
}

const PLAT_PAL = [[5, 9], [6, 10], [7, 23], [4, 25]]          // platinum tools are drawn gold

function drawTool(tl, x, y, z, pitch, yaw, s) {
  if (!tl) return
  if (tl.plat) for (let [a, b] of PLAT_PAL) pal(a, b)
  vox(TOOLS[tl.t].vox, x, y, z, pitch, yaw, 0, s || 0.8)
  if (tl.plat) pal()
}

// the hero rig: a head, two hands and two feet, animated in code (§12.3)
function drawHero(h) {
  let [fx, , fz] = dir3(h.yaw), [rx, , rz] = dir3(h.yaw - 0.25)   // forward and the hero's right
  let swinging = min(h.swingT[0], h.swingT[1]) < 8
  let jit = swinging && min(h.swingT[0], h.swingT[1]) < 7 ? 0.08 : 0     // shake while the swing lands
  let x = h.x + fx * h.lunge + (rnd(2) - 1) * jit, y = h.y, z = h.z + fz * h.lunge + (rnd(2) - 1) * jit
  let wp = h.walk * 0.125 * (0.6 + maxSpeed(stat(h, 'speed')) * 8)
  let squash = h.landT > 0 ? 1 - h.landT * 0.02 : 1
  if (swinging) squash *= 1 - max(0, 7 - min(h.swingT[0], h.swingT[1])) * 0.045   // squash into the swing
  let byaw = h.yaw + h.twist
  pal(8, h.color)
  if (h.hurtT > 0) for (let i = 0; i < 32; i++) if (i != 0) pal(i, 7)
  let face = h.hurtT > 0 ? V.hurt : (frame + h.i * 37) % 180 < 6 ? V.blink : V.head
  vox(face, x, y + 0.05, z, 0, byaw, 0, 1 / squash, squash, 1 / squash)
  pal()

  // feet
  for (let s = -1; s <= 1; s += 2) {
    let fwd = h.grounded ? sin(wp + (s > 0 ? 0 : 0.5)) * 0.14 : -0.05
    let lift = h.grounded ? max(0, cos(wp + (s > 0 ? 0 : 0.5))) * 0.06 : 0
    vox(V.foot, x + rx * s * 0.16 + fx * fwd, y - R + lift, z + rz * s * 0.16 + fz * fwd, 0, h.yaw)
  }
  // hands: k 0 = left (O), 1 = right (X)
  for (let k = 0; k < 2; k++) {
    let s = k == 0 ? -1 : 1, st = h.swingT[k], tl = h.tools[k]
    let hx, hy, hz
    if (st == 0) {
      // windup: the hand pulls back on its side
      hx = x + rx * s * 0.5 - fx * 0.25; hy = y + 0.15; hz = z + rz * s * 0.5 - fz * 0.25
      drawTool(tl, hx, hy, hz, 0.1, h.yaw + s * 0.2)
    } else if (st < 10) {
      // strike: the hand snaps to the far end of the arc, the tool pointing out along it,
      // with a fat trail sweeping across the whole arc at the tool's reach (§7.3)
      let half = arcOf(h, k) / 2, dirn = h.swingDir[k], reach = reachOf(h, k)
      let endA = h.yaw + dirn * half, [ax, , az] = dir3(endA)
      let arm = st < 4 ? 0.55 : 0.55 - (st - 4) * 0.05
      hx = x + ax * arm; hy = y + 0.05; hz = z + az * arm
      drawTool(tl, hx, hy, hz, -0.25, endA, 0.9)
      let steps = 12, fade = (st - 1) / 9
      for (let j = 0; j < steps; j++) {
        let f = j / (steps - 1)                                // 0 = start of the arc, 1 = end
        if (f < fade * 1.3) continue                            // the trail fades from its start
        let a = h.yaw - dirn * half + dirn * 2 * half * f, [bx, , bz] = dir3(a)
        let rr = reach * (0.85 + 0.15 * f)
        sphere(x + bx * rr, y + 0.05 + (1 - f) * 0.15, z + bz * rr, (0.07 + 0.14 * f) * (1 - fade * 0.6), f > 0.6 ? 7 : 6)
      }
    } else if (h.flapping) {
      hx = x + rx * s * 0.5; hy = y + 0.1 + sin(frame * 0.12) * 0.2; hz = z + rz * s * 0.5
      drawTool(tl, hx, hy, hz, 0.25, h.yaw + s * 0.25, 0.7)
    } else if (!h.grounded) {
      hx = x + rx * s * 0.45; hy = y + 0.25; hz = z + rz * s * 0.45
      drawTool(tl, hx, hy, hz, 0, h.yaw, 0.7)
    } else {
      let sw = h.walk ? sin(wp + (k == 0 ? 0 : 0.5)) * 0.12 : 0
      hx = x + rx * s * 0.45 + fx * (0.08 + sw); hy = y - 0.12; hz = z + rz * s * 0.45 + fz * (0.08 + sw)
      drawTool(tl, hx, hy, hz, 0.12, h.yaw, 0.7)               // carried upright, leaning forward
    }
    vox(V.hand, hx, hy, hz, 0, h.yaw)
  }
}

// powerups, hearts and tools are billboards that face the camera, with flashing outlines (§8.5)
function drawPickups() {
  let [fx, , fz] = dir3(camYaw)
  let flash = [10, 7, 14][flr(frame / 8) % 3]
  for (let q of pickups) {
    if (q.dead) continue
    let dx = q.x - camPos[0], dz = q.z - camPos[2]
    if (dx * fx + dz * fz < -1 || dx * dx + dz * dz > DRAW_R * DRAW_R) continue
    if (q.life > 0 && q.life < 300 && frame % 8 < 4) continue          // blink before vanishing
    let yaw = yaw_to(camPos[0] - q.x, camPos[2] - q.z)
    let bob = q.rest ? 0.12 + sin(frame / 50 + q.x) * 0.06 : 0
    if (q.kind == 'tool') {
      outline(q.tool.plat ? flash : 7, false)
      drawTool(q.tool, q.x, q.y + bob, q.z, 0, yaw, 0.85)
    } else {
      outline(flash, false)
      vox(q.kind == 'heart' ? V.heart : POW_VOX + q.stat, q.x, q.y + bob, q.z, 0, yaw, 0, 0.6)
    }
  }
}

function drawParticles() {
  for (let p of particles) {
    if (p.spark) sphere(p.x, p.y, p.z, p.s * p.life / 30, p.c)
    else cube(p.x, p.y, p.z, p.s * min(1, p.life / 12), p.c)
  }
}

function fmtTime(f) { let s = ceil(f / 60); return flr(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60 }

function drawHud() {
  let ms = Date.now()
  if (lastMs) { fpsAcc += ms - lastMs; fpsN++ }
  lastMs = ms
  if (fpsN >= 30) { fps = flr(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0 }
  let h = player

  // HP bar and timer
  let mhp = maxHP(h.stats.health), w = 80
  rectfill(3, 3, 6 + w, 11, 0)
  rectfill(5, 5, 5 + flr(w * max(0, h.hp) / mhp), 9, h.hp / mhp < 0.3 ? 8 : 11)
  print(flr(max(0, h.hp)) + '/' + mhp, 92, 3, 7, 0)
  let tc = trialLeft < 600 && frame % 30 < 15 ? 8 : 7
  print(trialLeft > 0 ? fmtTime(trialLeft) : 'TIME!', 214, 3, tc, 0)

  // stats: two rows of four
  for (let i = 0; i < 8; i++) {
    let x = 4 + (i % 4) * 46, y = 16 + flr(i / 4) * 11
    let c = h.gained[i] > 0 && frame % 6 < 3 ? 7 : STAT_COL[i]
    print(STAT_ABBR[i], x, y, c, 0)
    print('' + stat(h, STATS[i]), x + textw(STAT_ABBR[i]) + 3, y, 7, 0)
  }

  // popups ("+1 SPD")
  for (let i = 0; i < popups.length; i++) {
    let u = popups[i]
    printc(u.text, 120 - (50 - u.t) * 0.6 - i * 11, u.c, 0)
  }

  // hand slots with cooldown bars (§11)
  for (let k = 0; k < 2; k++) {
    let x = k == 0 ? 4 : 132, tl = h.tools[k], name = (k == 0 ? 'O ' : 'X ') + (tl ? (tl.plat ? '*' : '') + TOOLS[tl.t].name : 'HAND')
    if (h.near && h.grounded) name = (k == 0 ? 'O ' : 'X ') + 'hold: ' + TOOLS[h.near.tool.t].name
    print(name, x, 232, tl && tl.plat ? 10 : 7, 0)
    let full = max(1, flr(toolOf(h, k).cd * (1 - 0.02 * stat(h, 'frequency'))))
    rectfill(x, 244, x + 118, 248, 0)
    if (h.holdT[k] > 0) rectfill(x + 1, 245, x + 1 + flr(116 * h.holdT[k] / PICKUP_HOLD), 247, 10)
    else rectfill(x + 1, 245, x + 1 + flr(116 * (1 - h.cd[k] / full)), 247, h.cd[k] ? 5 : 12)
  }

  if (h.koT > 0) printc('KNOCKED OUT!', 110, 8, 0, 2)
  if (DEBUG) {
    print('fps ' + fps + ' props ' + drawn + ' upd ' + updMs.toFixed(2) + ' drw ' + drawMs.toFixed(2), 4, 40, 5, 0)
  }
}
