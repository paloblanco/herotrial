// Hero Trial world generator: the FIRST DRAFT of the four quadrant maps.
// Each maps/N-*.gen.js calls buildQuadrant with its world offset. Once a quadrant is hand-edited
// in the IDE, delete its .gen.js and the .bin becomes the source (b3d pack tells you which).
//
// World: 128 (x) x 64 (y) x 128 (z). Ground stands at y = 20 (blocks 0..19 solid).
//   forest    x 0-63,   z 64-127   map 0
//   castle    x 64-127, z 64-127   map 1
//   village   x 0-63,   z 0-63     map 2
//   mountains x 64-127, z 0-63     map 3

export const T = {
  grass: 1, dirt: 2, rock: 3, stone: 4, brick: 5, log: 6, planks: 7, leaves: 8, bush: 9,
  farmland: 10, sand: 11, snow: 12, roof: 13, bedrock: 14, crystal: 15, lava: 16, gold: 17,
};
export const GROUND = 20;

// ---------------------------------------------------------------- noise
function hash(x, z, s) {
  let h = (x * 374761393 + z * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;   // 0..1
}
function fbm(x, z, s) { return vnoise(x, z, s) * 0.6 + vnoise(x * 2, z * 2, s + 1) * 0.3 + vnoise(x * 4, z * 4, s + 2) * 0.1; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- shape
// The play plane: 120 x 120 (x and z 4..123) with corners rounded at radius 16.
export function inside(x, z) {
  const lo = 4, hi = 123, r = 16;
  const cx = Math.min(Math.max(x, lo + r), hi - r), cz = Math.min(Math.max(z, lo + r), hi - r);
  if (x < lo || x > hi || z < lo || z > hi) return false;
  return (x - cx) ** 2 + (z - cz) ** 2 <= r * r;
}
const inHub = (x, z) => Math.abs(x - 63.5) < 10 && Math.abs(z - 63.5) < 10;
const onPath = (x, z) => (x >= 62 && x <= 65) || (z >= 62 && z <= 65);
export function region(x, z) { return (x >= 64 ? 1 : 0) + (z < 64 ? 2 : 0); }  // 0 forest 1 castle 2 village 3 mountains

// Column height (the y you stand at) and the top tile.
export function column(x, z) {
  if (!inside(x, z)) return null;
  const q = region(x, z);
  let h = GROUND, top = T.grass;
  if (inHub(x, z)) return { h: GROUND, top: T.stone };
  if (q == 0) {                                         // forest: gentle hills
    h = GROUND + Math.round((fbm(x / 16, z / 16, 11) - 0.5) * 7 * smooth(10, 20, Math.abs(z - 64) + Math.abs(x - 64) - 10));
  } else if (q == 1) {                                  // castle: a plateau at 24, reached by 1-block terraces
    const d = Math.min(x - 64, z - 64);
    h = GROUND + Math.min(4, Math.max(0, Math.floor((d - 10) / 2)));
  } else if (q == 3) {                                  // mountains: peaks rising toward the far corner
    const far = smooth(8, 50, Math.min(x - 64, 63 - z) + 4);
    const n = fbm(x / 13, z / 13, 31);
    h = GROUND + Math.round(Math.max(0, n - 0.25) * 48 * far);
    h = Math.min(h, 58);
    top = h >= 42 ? T.snow : h >= 26 ? T.rock : T.grass;
  }
  if (onPath(x, z) && q != 3) top = T.sand;
  if (onPath(x, z) && q == 3 && h <= GROUND + 1) top = T.sand;
  return { h, top };
}

// ---------------------------------------------------------------- building
// A ring stair cell (x, z) around a core x0..x1, z0..z1, plus the cells just outside it (2-wide stairs;
// corners also get the diagonal cell).
function widen(x, z, x0, z0, x1, z1) {
  const ox = x < x0 ? -1 : x > x1 ? 1 : 0, oz = z < z0 ? -1 : z > z1 ? 1 : 0;
  const out = [[x, z]];
  if (ox) out.push([x + ox, z]);
  if (oz) out.push([x, z + oz]);
  if (ox && oz) out.push([x + ox, z + oz]);
  return out;
}

export function buildQuadrant(map, ox, oz) {
  const set = (wx, y, wz, t) => {
    const x = wx - ox, z = wz - oz;
    if (x >= 0 && x < map.w && z >= 0 && z < map.d && y >= 0 && y < map.h) map.set(x, y, z, t);
  };
  const box = (x0, y0, z0, x1, y1, z1, t) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, z, t);
  };

  // terrain
  for (let wz = oz; wz < oz + map.d; wz++) for (let wx = ox; wx < ox + map.w; wx++) {
    const c = column(wx, wz);
    if (!c) continue;
    set(wx, 0, wz, T.bedrock);
    for (let y = 1; y < c.h - 1; y++) set(wx, y, wz, y < c.h - 4 ? T.rock : T.dirt);
    set(wx, c.h - 1, wz, c.top);
  }

  // ---- castle: outer wall with two gates, a keep, and a tower with an outside staircase
  const P = GROUND + 4;                                 // plateau height
  box(82, P, 82, 120, P + 5, 82, T.stone); box(82, P, 120, 120, P + 5, 120, T.stone);
  box(82, P, 82, 82, P + 5, 120, T.stone); box(120, P, 82, 120, P + 5, 120, T.stone);
  box(99, P, 82, 102, P + 3, 82, 0); box(82, P, 99, 82, P + 3, 102, 0);                 // gates
  for (let i = 82; i <= 120; i += 2) { set(i, P + 6, 82, T.stone); set(i, P + 6, 120, T.stone); set(82, P + 6, i, T.stone); set(120, P + 6, i, T.stone); }
  box(90, P, 104, 101, P + 7, 114, T.stone); box(91, P, 105, 100, P + 6, 113, 0);        // keep, hollow
  box(95, P, 104, 96, P + 2, 104, 0);                                                     // keep door
  box(90, P + 8, 104, 101, P + 8, 114, T.roof);
  // tower: 6 x 6 core from the plateau to y 50, a 2-wide stair ring around it rising 1 per step
  const tx0 = 106, tz0 = 88, TOP = 50;
  box(tx0, P, tz0, tx0 + 5, TOP - 1, tz0 + 5, T.stone);
  box(tx0 - 1, TOP - 1, tz0 - 1, tx0 + 6, TOP - 1, tz0 + 6, T.stone);                     // top platform
  set(tx0 + 2, TOP - 1, tz0 + 2, T.gold);                                                 // gold pedestal: platinum tool
  for (let k = 1; k < 8; k += 2) {                                                        // battlements (the corner where the stair arrives stays open)
    set(tx0 - 1 + k, TOP, tz0 + 6, T.stone); set(tx0 + 6, TOP, tz0 - 1 + k, T.stone);
  }
  const ring = [];
  for (let x = tx0 - 1; x <= tx0 + 6; x++) ring.push([x, tz0 - 1]);          // south side, going +x
  for (let z = tz0; z <= tz0 + 6; z++) ring.push([tx0 + 6, z]);              // east side, going +z
  for (let x = tx0 + 5; x >= tx0 - 1; x--) ring.push([x, tz0 + 6]);          // north side, going -x
  for (let z = tz0 + 5; z >= tz0; z--) ring.push([tx0 - 1, z]);              // west side, going -z
  // one lap, 2 blocks wide: each step also fills the cell(s) just outside it
  let y = P;
  for (const [rx, rz] of ring) {
    if (y >= TOP - 1) break;
    for (const [sx, sz] of widen(rx, rz, tx0, tz0, tx0 + 5, tz0 + 5)) box(sx, P, sz, sx, y, sz, T.stone);
    y++;
  }

  // ---- village: houses, farm fields and a well
  const house = (x0, z0, w, d, door) => {
    const h0 = GROUND;
    box(x0, h0, z0, x0 + w - 1, h0 + 3, z0 + d - 1, T.planks);
    box(x0 + 1, h0, z0 + 1, x0 + w - 2, h0 + 3, z0 + d - 2, 0);
    const dx = x0 + (w >> 1);
    if (door == 'n') box(dx, h0, z0 + d - 1, dx, h0 + 1, z0 + d - 1, 0); else box(dx, h0, z0, dx, h0 + 1, z0, 0);
    for (let k = 0; k < 3; k++) box(x0 - 1 + k, h0 + 4 + k, z0 - 1 + k, x0 + w - k, h0 + 4 + k, z0 + d - k, T.roof);
  };
  house(10, 46, 7, 6, 's'); house(22, 48, 6, 6, 's'); house(34, 46, 7, 7, 's');
  house(44, 30, 6, 6, 'n'); house(46, 14, 7, 6, 'n'); house(8, 28, 6, 7, 'n');
  const field = (x0, z0, x1, z1) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, GROUND - 1, z, (z - z0) % 3 == 2 ? T.dirt : T.farmland);
  };
  field(10, 10, 26, 22); field(30, 8, 40, 20); field(20, 30, 38, 40);
  box(48, GROUND, 46, 52, GROUND, 50, T.stone); box(49, GROUND, 47, 51, GROUND, 49, 0);  // well rim (the shaft is carved with the dungeon)

  // ---- forest: big fixed trees on a jittered grid (keeps clear of paths and the hub)
  for (let gz = 66; gz < 124; gz += 9) for (let gx = 4; gx < 60; gx += 9) {
    const x = gx + Math.floor(hash(gx, gz, 5) * 6), z = gz + Math.floor(hash(gx, gz, 6) * 6);
    if (!inside(x, z) || onPath(x, z) || inHub(x, z) || hash(gx, gz, 7) < 0.3) continue;
    const c = column(x, z); if (!c) continue;
    const th = 4 + Math.floor(hash(x, z, 8) * 3);
    box(x, c.h, z, x, c.h + th - 1, z, T.log);
    const cy = c.h + th, r = 2.6;
    for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
      if (dx * dx + dy * dy * 1.6 + dz * dz <= r * r && !(dx == 0 && dz == 0 && dy < 0)) set(x + dx, cy + dy, z + dz, T.leaves);
  }
  // hedges in the forest
  for (let i = 0; i < 6; i++) {
    const x = 8 + Math.floor(hash(i, 1, 9) * 48), z = 70 + Math.floor(hash(i, 2, 9) * 48), len = 3 + Math.floor(hash(i, 3, 9) * 5);
    for (let k = 0; k < len; k++) { const c = column(x + k, z); if (c && !onPath(x + k, z)) set(x + k, c.h, z, T.bush); }
  }

  // ---- hub: a low ring of stone posts
  for (const [x, z] of [[54, 54], [73, 54], [54, 73], [73, 73]]) box(x, GROUND, z, x, GROUND + 1, z, T.stone);

  // ---- dungeons (§9.3). Shells (brick lining where there was ground) first, then all the carving,
  //      so rooms and halls that touch open into each other.
  const shells = [], carves = [], after = [];
  const get = (wx, y, wz) => {
    const x = wx - ox, z = wz - oz;
    return x >= 0 && x < map.w && z >= 0 && z < map.d && y >= 0 && y < map.h ? map.get(x, y, z) : 0;
  };
  const line = (x0, y0, z0, x1, y1, z1, t) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (get(x, y, z)) set(x, y, z, t);
  };
  const room = (x0, z0, x1, z1, h = 5) => {
    shells.push(() => { line(x0 - 1, F - 1, z0 - 1, x1 + 1, F + h, z1 + 1, T.brick); box(x0, F - 1, z0, x1, F - 1, z1, T.brick); });
    carves.push(() => box(x0, F, z0, x1, F + h - 1, z1, 0));
  };
  const hall = (x0, z0, x1, z1) => room(x0, z0, x1, z1, 3);
  // stairs from standing height yTop down to the dungeon floor, along x or z, `step` +1/-1, a0..a1 across
  const stairs = (axis, start, step, a0, a1, yTop) => {
    const n = yTop - F;
    for (let i = 0; i <= n; i++) {
      const c = start + step * i, fy = yTop - 1 - i;
      const B = (lo, y0, hi, y1, t, lined) => axis == 'x'
        ? (lined ? line : box)(c, y0, lo, c, y1, hi, t) : (lined ? line : box)(lo, y0, c, hi, y1, c, t);
      shells.push(() => { B(a0 - 1, fy, a1 + 1, fy + 4, T.brick, true); B(a0, fy, a1, fy, T.brick, false); });
      carves.push(() => B(a0, fy + 1, a1, fy + 3, 0, false));
    }
    return start + step * n;
  };
  const pedestal = (x, z) => after.push(() => set(x, F - 1, z, T.gold));
  const lavaPit = (x0, z0, x1, z1) => after.push(() => { box(x0, F - 2, z0, x1, F - 2, z1, T.lava); box(x0, F - 1, z0, x1, F - 1, z1, 0); });
  const floorAt = (x0, z0, x1, z1, t) => after.push(() => box(x0, F - 1, z0, x1, F - 1, z1, t));

  for (const d of DUNGEONS) {
    if (d.name == 'forest') {
      const g = GIANT, end = stairs('z', g.z + 1, -1, g.x - 1, g.x + 1, g.base);
      room(g.x - 6, end - 11, g.x + 6, end);                        // A: under the tree
      hall(g.x + 7, end - 7, g.x + 13, end - 5);                    // A -> B
      room(g.x + 14, end - 14, g.x + 24, end - 2);                  // B
      hall(g.x - 1, end - 19, g.x + 1, end - 12);                   // A -> C
      room(g.x - 5, end - 30, g.x + 7, end - 20);                   // C
    } else if (d.name == 'castle') {
      const end = stairs('x', 99, -1, 106, 108, GROUND + 4);        // from the keep floor, going west
      room(70, 100, end, 112);                                       // A
      hall(74, 86, 76, 99); hall(77, 90, 83, 92);                    // A -> B
      room(84, 86, 100, 98);                                         // B: the lava room
      lavaPit(86, 88, 98, 96);                                       // a pit one block deep...
      floorAt(91, 91, 93, 93, T.brick);                                // ...an island in the middle,
      for (const x of [87, 89, 95, 97]) floorAt(x, 92, x, 92, T.brick);   // stepping stones: every gap is 1 block
      pedestal(92, 92);
      hall(101, 96, 103, 100);                                       // B -> C
      room(104, 98, 114, 110);                                       // C
    } else if (d.name == 'mountain') {
      const end = stairs('x', MOUTH.x, 1, MOUTH.z - 1, MOUTH.z + 1, MOUTH.h);   // the cave mouth, going east into the mountain
      room(end, 32, end + 11, 44);                                   // A
      hall(104, 27, 106, 31);                                        // A -> B
      room(98, 12, 116, 26, 7);                                      // B: crystal cavern, taller
      pedestal(114, 14);
      hall(95, 18, 97, 20);                                          // B -> C
      room(84, 14, 94, 24);                                          // C
    } else if (d.name == 'village') {
      carves.push(() => box(49, F, 47, 51, GROUND - 1, 49, 0));     // the well: a drop straight down
      room(44, 38, 56, 52);                                          // A: under the well
      const end = stairs('z', 33, -1, 45, 47, GROUND);              // the way out: stairs up into the house at (44, 30)
      room(40, 8, 52, end);                                          // B: at the bottom of those stairs
      hall(50, end + 1, 52, 37);                                     // B -> A
      hall(31, 44, 43, 46);                                          // A -> C
      room(18, 40, 30, 50);                                          // C
      pedestal(24, 45);
    }
  }
  for (const f of shells) f();
  for (const f of carves) f();
  for (const f of after) f();

  // ---- the giant hollow tree (forest): a stair winds up the outside to a platform with a platinum tool;
  //      inside, stairs lead down to the forest dungeon
  {
    const { x: cx, z: cz, base } = GIANT;
    for (let y = base; y < base + 18; y++) for (let z = cz - 6; z <= cz + 6; z++) for (let x = cx - 6; x <= cx + 6; x++) set(x, y, z, 0);
    box(cx - 2, base, cz - 2, cx + 2, base + 11, cz + 2, T.log);                           // trunk 5 x 5
    box(cx - 1, base, cz - 1, cx + 1, base + 10, cz + 1, 0);                               // hollow
    box(cx, base, cz + 2, cx, base + 1, cz + 2, 0);                                         // door on the north side
    // outside stair: half a lap, from the south-east corner around the south and west sides
    const ring = [];
    for (let x = cx + 3; x >= cx - 3; x--) ring.push([x, cz - 3]);
    for (let z = cz - 2; z <= cz + 2; z++) ring.push([cx - 3, z]);
    ring.forEach(([x, z], i) => { for (const [sx, sz] of widen(x, z, cx - 2, cz - 2, cx + 2, cz + 2)) box(sx, base - 1, sz, sx, base + i, sz, T.log); });
    box(cx - 2, base + 11, cz - 2, cx + 2, base + 11, cz + 2, T.planks);                   // platform: the trunk's top, level with the last step
    set(cx, base + 11, cz, T.gold);                                                         // pedestal
    for (let y = base + 10; y <= base + 16; y++) for (let z = cz - 7; z <= cz + 7; z++) for (let x = cx - 7; x <= cx + 7; x++) {
      const d = Math.hypot(x - cx, z - cz, (y - base - 12) * 1.4);
      if (d > 4.4 && d < 7 && Math.max(Math.abs(x - cx), Math.abs(z - cz)) >= 5) set(x, y, z, T.leaves);  // a leafy ring, clear of the stair
    }
  }

  // ---- mountain peak: a gold pedestal on the highest column
  set(PEAK.x, PEAK.h - 1, PEAK.z, T.gold);
}

// ---------------------------------------------------------------- features shared with the marker script
export const F = 6;                                     // dungeon floor: the height you stand at
const minH = (x0, z0, x1, z1) => {
  let m = 99;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = column(x, z); if (c) m = Math.min(m, c.h); }
  return m;
};
export const GIANT = { x: 16, z: 106, base: minH(14, 104, 18, 108) };
export const MOUTH = { x: 78, z: 39, h: column(78, 39).h };
export const PEAK = (() => {
  let best = { x: 0, z: 0, h: 0 };
  for (let z = 4; z < 60; z++) for (let x = 68; x < 124; x++) {
    const c = column(x, z);
    if (c && c.h > best.h && Math.abs(x - MOUTH.x) > 4) best = { x, z, h: c.h };
  }
  return best;
})();
export const DUNGEONS = [{ name: 'forest' }, { name: 'castle' }, { name: 'mountain' }, { name: 'village' }];

// Where things go, for the scene's markers: [vox, x, standY, z]. Vox: 16-24 tools (platinum on gold),
// 42 chest spot, 51 dig spot, 56 brick pile, 71 stone chest, 72 mossy chest, 73 crystal, 74 gold block.
export function features() {
  const g = GIANT, fz = g.z + 1 - (g.base - F);        // forest stairs' last step
  const list = [
    // platinum tools (the tower's is placed by the marker script already)
    [18, g.x, g.base + 12, g.z],                       // axe on the giant tree
    [22, PEAK.x, PEAK.h, PEAK.z],                      // mace on the mountain peak
    [19, 92, F, 92],                                   // spear on the lava island
    [17, 114, F, 14],                                  // hammer in the crystal cavern
    [23, 24, F, 45],                                   // shovel in the village dungeon
    // forest dungeon
    [72, g.x - 5, F, fz - 10], [72, g.x + 23, F, fz - 13], [42, g.x + 6, F, fz - 29],
    [56, g.x + 15, F, fz - 3], [56, g.x - 4, F, fz - 21], [73, g.x + 20, F, fz - 8],
    // castle dungeon
    [71, 113, F, 109], [71, 105, F, 99], [42, 110, F, 104], [73, 71, F, 101], [73, 72, F, 111],
    [56, 78, F, 102], [56, 85, F, 87], [56, 107, F, 108], [74, 99, F, 97],
    // mountain dungeon
    [73, 100, F, 13], [73, 102, F, 24], [73, 108, F, 18], [73, 115, F, 22], [73, 111, F, 25], [73, 99, F, 19],
    [74, 115, F, 13], [42, 89, F, 19], [56, 85, F, 15], [56, 93, F, 23],
    // village dungeon
    [51, 20, F, 42], [51, 28, F, 48], [51, 22, F, 49], [51, 29, F, 41], [42, 46, F, 10],
    [56, 41, F, 9], [56, 55, F, 39], [71, 54, F, 51],
    // dungeon minions (level 3, never respawn): 5 slime, 6 bat, 7 goblin, 8 skeleton, 9 golem, 10 mushroom
    [6, g.x - 3, F + 2, fz - 5], [6, g.x + 3, F + 2, fz - 8], [6, g.x + 20, F + 2, fz - 5],
    [10, g.x + 33 - 10, F, fz - 11], [10, g.x + 2, F, fz - 25],
    [8, 75, F, 105], [8, 95, F, 87], [8, 109, F, 102], [8, 112, F, 107],
    [9, 100, F, 38], [9, 106, F, 16], [9, 112, F, 20], [6, 104, F + 2, 24], [6, 90, F + 2, 20],
    [5, 50, F, 44], [5, 46, F, 12], [5, 22, F, 44], [5, 27, F, 47],
    // race flags (vox 41): start and finish points for the Race challenge
    ...[[10, 72], [30, 118], [54, 96], [74, 78], [116, 72], [100, 100], [118, 112], [20, 8], [56, 10], [6, 40],
      [70, 10], [100, 55], [121, 40], [40, 58]].map(([x, z]) => [41, x, column(x, z).h, z]),
    // dig spots hidden on the surface
    [51, 34, 20, 26], [51, 12, column(12, 84).h, 84], [51, 90, column(90, 52).h, 52], [51, 60, 20, 36],
  ];
  return list;
}

// Surface minion spawn points: [vox, x, standY, z], on a jittered grid per region, away from paths,
// the hub and buildings. Region mixes: forest goblin/slime/bat/mushroom, castle skeleton/goblin,
// village goblin/slime, mountains golem/slime.
const MIX = [[7, 5, 6, 10, 5, 7], [8, 7, 8, 7], [7, 5, 5, 7], [9, 5, 5, 9]];
const BLOCKED = [[89, 103, 102, 115], [102, 84, 115, 97], [7, 99, 25, 113], [7, 25, 18, 37], [9, 45, 41, 55],
  [43, 13, 54, 21], [43, 29, 51, 37], [47, 45, 53, 51], [9, 9, 41, 23], [19, 29, 39, 41]];
export function minionSpots() {
  const out = [];
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 64, oz = q < 2 ? 64 : 0;
    let i = 0;
    for (let gz = 6; gz < 60; gz += 11) for (let gx = 6; gx < 60; gx += 11) {
      const x = ox + gx + Math.floor(hash(gx, gz, 40 + q) * 7), z = oz + gz + Math.floor(hash(gx, gz, 50 + q) * 7);
      const c = column(x, z);
      if (!c || onPath(x, z) || Math.abs(x - 63.5) < 14 && Math.abs(z - 63.5) < 14) continue;
      if (BLOCKED.some(([a, b, c2, d]) => x >= a && x <= c2 && z >= b && z <= d)) continue;
      if (q == 1 && (x == 82 || x == 120 || z == 82 || z == 120)) continue;
      out.push([MIX[q][i++ % MIX[q].length], x, c.h, z]);
    }
  }
  return out;
}
