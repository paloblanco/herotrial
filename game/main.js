// HERO TRIAL — milestone 0: the world, props, hero movement and the camera.
// Design: DESIGN.md in the repo root. Section numbers below (§) point into it.

// =================================================================== 1. constants & tables

const DEBUG = true
const WORLD_W = 128, WORLD_H = 64, WORLD_D = 128
const HUB = [64, 20.4, 64]

// fixed map tiles (§8.1)
const T = { grass: 1, dirt: 2, rock: 3, stone: 4, brick: 5, log: 6, planks: 7, leaves: 8, bush: 9,
  farmland: 10, sand: 11, snow: 12, roof: 13, bedrock: 14, crystal: 15, lava: 16, gold: 17 }
const OPEN_GROUND = [T.grass, T.dirt, T.rock, T.sand, T.snow, T.farmland]   // props may sit on these

// vox numbers (§12.2)
const V = { head: 0, blink: 1, hurt: 2, hand: 3, foot: 4, flag: 41, chestSpot: 42 }

// props (§8.2). vox: the models of that kind (variants); scale: draw scale; solid: in PROPMAP
const PROPS = {
  tuft:     { vox: [48],     mat: 'plant', hp: 3,  solid: false, scale: 1 },
  rock:     { vox: [52, 53], mat: 'rock',  hp: 18, solid: true,  scale: 1 },
  tree:     { vox: [57, 58], mat: 'wood',  hp: 20, solid: true,  scale: 1.5 },
  log:      { vox: [59],     mat: 'wood',  hp: 16, solid: true,  scale: 1 },
  crate:    { vox: [60],     mat: 'wood',  hp: 14, solid: true,  scale: 1 },
  bush:     { vox: [62],     mat: 'plant', hp: 4,  solid: false, scale: 1 },
  corn:     { vox: [63],     mat: 'crop',  hp: 5,  solid: false, scale: 1 },
  pumpkin:  { vox: [64],     mat: 'crop',  hp: 8,  solid: true,  scale: 1 },
  woodchest:{ vox: [70],     mat: 'wood',  hp: 30, solid: true,  scale: 1 },
}
const PROP_OF_VOX = {}                      // vox number -> prop kind (for scene markers)
for (let k in PROPS) for (let v of PROPS[k].vox) PROP_OF_VOX[v] = k

// scatter zones (§8.4): world rectangles [x0, z0, x1, z1], a count and a mix of kinds
const ZONES = [
  { r: [4, 66, 61, 123],  n: 260, mix: { tree: 4, bush: 3, tuft: 4, log: 2, rock: 1 } },     // forest
  { r: [66, 66, 123, 123], n: 140, mix: { crate: 2, rock: 2, tuft: 3, bush: 1 } },           // castle
  { r: [4, 4, 61, 61],    n: 140, mix: { tuft: 4, bush: 2, crate: 2, tree: 1, rock: 1 } },   // village
  { r: [66, 4, 123, 61],  n: 200, mix: { rock: 6, tuft: 2, tree: 1, bush: 1 } },             // mountains
  { r: [44, 44, 83, 83],  n: 30,  mix: { tuft: 3, bush: 1, crate: 1 } },                     // around the hub
]

// hero colors: palette color 8 on the head is recolored per hero (§12.4)
const HERO_COLORS = [8, 12, 11, 10]

// movement tuning (§5)
const GRAV = 0.01, TERMINAL = -0.6, R = 0.4
const CHORD = 4                             // frames between O and X that still count as a jump (§4.1)

// stat formulas (§6). s = effective stat 0-30
const maxSpeed = (s) => 0.055 + 0.0022 * s
const traction = (a) => 0.08 + 0.006 * a
const jumpVel  = (j) => 0.13 + 0.0045 * j
const glideCap = (j) => 0.11 - 0.0027 * j

// =================================================================== 2. world

let scene, WORLD, QUADS, PROPMAP
let props = []                              // every prop record
let grid = {}                               // spatial grid: bucket key -> props in it (8 x 8 blocks)
let spawns = []                             // [x, y, z] hero starting points

const cellKey = (x, y, z) => x + WORLD_W * (y + WORLD_H * z)
const bucketKey = (x, z) => (x >> 3) + 16 * (z >> 3)
let propAt = {}                             // cellKey -> prop (one prop per cell)

// which quadrant map covers world (x, z): 0 forest, 1 castle, 2 village, 3 mountains
const quadOf = (x, z) => (x >= 64 ? 1 : 0) + (z < 64 ? 2 : 0)

// the top of the ground at (x, z): [standY, tile], or null over the void
function groundAt(x, z) {
  if (x < 0 || z < 0 || x >= WORLD_W || z >= WORLD_D) return null
  let [t, xi, yi, zi, nx, ny, nz, d] = mray(QUADS[quadOf(x, z)], x, WORLD_H - 0.01, z, 0, -1, 0, WORLD_H)
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
  props = []; grid = {}; propAt = {}; spawns = []

  // scene markers (§8.4)
  for (let [v, x, y, z, yaw] of scene.things) {
    if (v == V.head) spawns.push([x, y + R, z])
    else if (PROP_OF_VOX[v]) addProp(PROP_OF_VOX[v], flr(x), flr(y + 0.01), flr(z), v, yaw)
  }
  if (spawns.length == 0) spawns = [[32.5, 0, 96.5], [96.5, 0, 72.5], [24.5, 0, 56.5], [80.5, 0, 40.5]]
  for (let s of spawns) if (s[1] == 0) { let g = groundAt(s[0], s[2]); s[1] = (g ? g[0] : 20) + R }

  // tile rule: crops on every farmland tile with air above
  for (let z = 0; z < WORLD_D; z++) for (let x = 0; x < WORLD_W; x++) {
    let g = groundAt(x + 0.5, z + 0.5)
    if (g && g[1] == T.farmland) {
      let r = rnd(1)
      addProp(r < 0.6 ? 'corn' : 'pumpkin', x, g[0], z)
    }
  }

  // scatter zones
  for (let zn of ZONES) {
    let kinds = [], [x0, z0, x1, z1] = zn.r
    for (let k in zn.mix) for (let i = 0; i < zn.mix[k]; i++) kinds.push(k)
    for (let i = 0, tries = 0; i < zn.n && tries < zn.n * 4; tries++) {
      let x = flr(x0 + rnd(x1 - x0 + 1)), z = flr(z0 + rnd(z1 - z0 + 1))
      let g = groundAt(x + 0.5, z + 0.5)
      if (!g || OPEN_GROUND.indexOf(g[1]) < 0 || g[1] == T.farmland) continue
      if (abs(x - 63.5) < 3 || abs(z - 63.5) < 3) continue           // keep the main paths clear
      if (solidAt(x + 0.5, g[0] + 0.5, z + 0.5) || solidAt(x + 0.5, g[0] + 1.5, z + 0.5)) continue
      if (addProp(rnd(kinds), x, g[0], z)) i++
    }
  }
}

// place a prop in cell (x, y, z): y is the height it stands on. Returns the prop or null.
function addProp(kind, x, y, z, vox, yaw) {
  let key = cellKey(x, y, z)
  if (propAt[key]) return null
  let k = PROPS[kind]
  let p = { kind, x, y, z, vox: vox != null ? vox : rnd(k.vox), yaw: yaw != null ? yaw : flr(rnd(4)) / 4,
    hp: k.hp, alive: true, hitT: 0 }
  props.push(p)
  propAt[key] = p
  let b = bucketKey(x, z)
  ;(grid[b] = grid[b] || []).push(p)
  if (k.solid) mset(PROPMAP, x, y, z, 1)
  return p
}

// =================================================================== 3. heroes

let heroes = [], player

function makeHero(i, pos) {
  return { i, color: HERO_COLORS[i], x: pos[0], y: pos[1], z: pos[2], vx: 0, vy: 0, vz: 0,
    yaw: 0, grounded: false, wasGrounded: false, walk: 0, hop: false,
    flapping: false, pounding: false, poundY: 0, landT: 0,
    stats: { speed: 0, strength: 0, health: 0, defense: 0, frequency: 0, reach: 0, agility: 0, jump: 0 },
    tools: [0, 0],                          // left (O), right (X): 0 = bare hand
    swingT: [99, 99], cd: [0, 0],           // frames since each hand's swing; cooldown left
    pressT: [99, 99], chordLock: false,     // frames since each button went down; jump-chord latch
    ctrl: { sx: 0, sy: 0, b: [false, false], bp: [false, false] },
    brain: { goal: null, t: 0 } }
}

function stat(h, s) { return mid(0, h.stats[s], 30) }

function heroUpdate(h) {
  let c = h.ctrl
  let [fx, , fz] = dir3(h === player ? camYaw : h.yaw)

  // ---- buttons: jump chord, swings, flap, pound (§4)
  for (let k = 0; k < 2; k++) {
    if (c.bp[k]) {
      if (h.grounded && h.pressT[1 - k] <= CHORD && !h.chordLock) {      // second button of a chord: jump
        h.vy = jumpVel(stat(h, 'jump')); h.grounded = false; h.hop = true
        h.chordLock = true; sfx(0)
      }
      h.pressT[k] = 0
    } else h.pressT[k]++
  }
  if (h.chordLock && !c.b[0] && !c.b[1]) h.chordLock = false
  for (let k = 0; k < 2; k++) {
    h.swingT[k]++
    if (h.cd[k] > 0) h.cd[k]--
    if (h.grounded && !h.chordLock && c.b[k] && h.cd[k] == 0) { h.swingT[k] = 0; h.cd[k] = 14 }  // bare-hand swing (no hits yet)
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
  } else h.walk = 0

  // ---- auto-climb a 1-block step in front (§4.2)
  if (h.grounded && moving) {
    let m = sqrt(ax * ax + az * az) || 1, px = h.x + ax / m * 0.6, pz = h.z + az / m * 0.6
    let footY = flr(h.y - R + 0.05)
    if (solidAt(px, footY + 0.5, pz) && !solidAt(px, footY + 1.5, pz) && !solidAt(h.x, footY + 2.5, h.z)) {
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

  if (h.landT > 0) h.landT--
  if (h.y < -4) respawnHero(h)
}

function poundLand(h) {
  let drop = h.poundY - h.y
  h.pounding = false
  h.swingT = [0, 0]                       // both hands swing at once (hits come in milestone 1)
  h.landT = 12
  h.poundMul = min(4, 1 + 0.15 * drop)
  if (h === player) shake = min(10, 3 + drop * 0.3)
  sfx(0)
}

function respawnHero(h) {
  h.x = HUB[0] + rnd(2) - 1; h.y = HUB[1] + 1; h.z = HUB[2] + rnd(2) - 1
  h.vx = h.vy = h.vz = 0; h.pounding = false
}

// =================================================================== 4. input & brains

function playerInput(h) {
  let [sx, sy] = stick(0)
  h.ctrl.sx = sx; h.ctrl.sy = sy
  h.ctrl.b = [btn(4), btn(5)]
  h.ctrl.bp = [btnp(4), btnp(5)]
}

// milestone 0 brain: wander to random points in its home quadrant, using the same controls a player has
function wanderBrain(h) {
  let b = h.brain, c = h.ctrl
  if (!b.goal || b.t-- <= 0 || dist([h.x, h.z], b.goal) < 1.5) {
    let q = h.i % 4, ox = (q % 2) * 64, oz = q < 2 ? 64 : 0
    b.goal = [ox + 8 + rnd(48), oz + 8 + rnd(48)]; b.t = 360
  }
  // a virtual stick, relative to the hero's own facing (its "camera" is its yaw)
  let want = yaw_to(b.goal[0] - h.x, b.goal[1] - h.z)
  let d = angdiff(h.yaw, want)
  c.sx = 0; c.sy = -1
  h.yaw += d * 0.15
  c.b = [false, false]; c.bp = [false, false]
}

// =================================================================== 8. camera (§5.1)

let camYaw = 0, camPitch = 0.07, camDist = 5, manualHold = 0, stillT = 0, shake = 0
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
  let t = [h.x, h.y + 0.8, h.z], [fx, fy, fz] = dir3(camYaw, -camPitch)
  let d = camDist
  for (let m of QUADS) {
    let hit = mray(m, t[0], t[1], t[2], -fx, -fy, -fz, d)
    if (hit[0]) d = max(1.2, hit[7] - 0.3)
  }
  if (shake > 0) { t[0] += rnd(0.2) - 0.1; t[1] += rnd(0.2) - 0.1; shake *= 0.8; if (shake < 0.3) shake = 0 }
  cam_orbit(t, camYaw, -camPitch, d)
  camPos = [t[0] - fx * d, t[1] - fy * d, t[2] - fz * d]
}

// =================================================================== 9. states

let state = 'trial', frame = 0
let drawn = 0, fps = 60, lastMs = 0, fpsAcc = 0, fpsN = 0

function _init() {
  touch_set_mode(1)
  mouse_set_mode(2)
  buildWorld()
  heroes = []
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
  playerInput(player)
  for (let i = 1; i < heroes.length; i++) wanderBrain(heroes[i])
  for (let h of heroes) heroUpdate(h)
  cameraUpdate(player)
  updMs = lerp(updMs, now() - t0, 0.05)
}

function _draw() {
  let t0 = now()
  bg(12)
  cameraDraw(player)
  outline(0)
  for (let m of QUADS) map(m)
  outline(0, false)
  drawProps()
  for (let h of heroes) drawHero(h)
  outline()
  drawMs = lerp(drawMs, now() - t0, 0.05)
  drawHud()
}

// =================================================================== drawing

const DRAW_R = 40

function drawProps() {
  drawn = 0
  let [fx, , fz] = dir3(camYaw)
  let cx = player.x, cz = player.z
  let b0x = max(0, flr((cx - DRAW_R) / 8)), b1x = min(15, flr((cx + DRAW_R) / 8))
  let b0z = max(0, flr((cz - DRAW_R) / 8)), b1z = min(15, flr((cz + DRAW_R) / 8))
  for (let bz = b0z; bz <= b1z; bz++) for (let bx = b0x; bx <= b1x; bx++) {
    let list = grid[bx + 16 * bz]
    if (!list) continue
    for (let p of list) {
      if (!p.alive) continue
      let dx = p.x + 0.5 - camPos[0], dz = p.z + 0.5 - camPos[2]
      if (dx * fx + dz * fz < -2) continue                     // behind the camera
      if (dx * dx + dz * dz > DRAW_R * DRAW_R) continue
      let s = PROPS[p.kind].scale
      vox(p.vox, p.x + 0.5, p.y, p.z + 0.5, 0, p.yaw, 0, s)
      drawn++
    }
  }
}

// the hero rig: a head, two hands and two feet, animated in code (§12.3)
function drawHero(h) {
  let [fx, , fz] = dir3(h.yaw), [rx, , rz] = dir3(h.yaw - 0.25)   // forward and the hero's right
  let x = h.x, y = h.y, z = h.z
  let wp = h.walk * 0.25 * (0.6 + maxSpeed(stat(h, 'speed')) * 8)
  let squash = h.landT > 0 ? 1 - h.landT * 0.02 : 1
  pal(8, h.color)
  let face = (frame + h.i * 37) % 180 < 6 ? V.blink : V.head
  vox(face, x, y + 0.05, z, 0, h.yaw, 0, 1 / squash, squash, 1 / squash)
  pal()

  // feet
  for (let s = -1; s <= 1; s += 2) {
    let fwd = h.grounded ? sin(wp + (s > 0 ? 0 : 0.5)) * 0.14 : -0.05
    let lift = h.grounded ? max(0, cos(wp + (s > 0 ? 0 : 0.5))) * 0.06 : 0
    vox(V.foot, x + rx * s * 0.16 + fx * fwd, y - R + lift, z + rz * s * 0.16 + fz * fwd, 0, h.yaw)
  }
  // hands: k 0 = left (O), 1 = right (X)
  for (let k = 0; k < 2; k++) {
    let s = k == 0 ? -1 : 1
    let hx, hy, hz
    if (h.swingT[k] < 8) {
      // swing: the hand snaps to the far end of a 120° arc in front (§7.3); a fading trail follows
      let a = h.yaw + s * -0.12, [ax, , az] = dir3(a)
      hx = x + ax * 0.7; hy = y; hz = z + az * 0.7
      if (h.swingT[k] >= 1) for (let j = 0; j < 5; j++) {
        let aj = h.yaw + s * (0.17 - j * 0.07), [bx, , bz] = dir3(aj)
        if (j > 6 - h.swingT[k]) continue
        sphere(x + bx * 0.75, y, z + bz * 0.75, 0.06 + 0.02 * (5 - j), 7)
      }
    } else if (h.flapping) {
      hx = x + rx * s * 0.5; hy = y + 0.1 + sin(frame * 0.12) * 0.2; hz = z + rz * s * 0.5
    } else if (!h.grounded) {
      hx = x + rx * s * 0.45; hy = y + 0.25; hz = z + rz * s * 0.45
    } else {
      let sw = h.walk ? sin(wp + (k == 0 ? 0 : 0.5)) * 0.12 : 0
      hx = x + rx * s * 0.45 + fx * (0.08 + sw); hy = y - 0.12; hz = z + rz * s * 0.45 + fz * (0.08 + sw)
    }
    vox(V.hand, hx, hy, hz, 0, h.yaw)
  }
}

function drawHud() {
  let ms = Date.now()
  if (lastMs) { fpsAcc += ms - lastMs; fpsN++ }
  lastMs = ms
  if (fpsN >= 30) { fps = flr(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0 }
  print('HERO TRIAL  milestone 0', 4, 4, 7, 0)
  if (DEBUG) {
    print('fps ' + fps + '  props ' + drawn + '/' + props.length, 4, 16, 10, 0)
    print('upd ' + updMs.toFixed(2) + 'ms  draw ' + drawMs.toFixed(2) + 'ms', 4, 40, 10, 0)
    print(flr(player.x) + ',' + flr(player.y) + ',' + flr(player.z), 4, 28, 6, 0)
  }
  print('O+X jump  O flap  X pound', 4, 244, 6, 0)
}
