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
  // tower: 6 x 6 core from the plateau to y 50, a 1-wide stair ring around it rising 1 per step
  const tx0 = 106, tz0 = 88, TOP = 50;
  box(tx0, P, tz0, tx0 + 5, TOP - 1, tz0 + 5, T.stone);
  box(tx0 - 1, TOP - 1, tz0 - 1, tx0 + 6, TOP - 1, tz0 + 6, T.stone);                     // top platform
  for (let k = 1; k < 8; k += 2) {                                                        // battlements (the corner where the stair arrives stays open)
    set(tx0 - 1 + k, TOP, tz0 + 6, T.stone); set(tx0 + 6, TOP, tz0 - 1 + k, T.stone);
  }
  const ring = [];
  for (let x = tx0 - 1; x <= tx0 + 6; x++) ring.push([x, tz0 - 1]);          // south side, going +x
  for (let z = tz0; z <= tz0 + 6; z++) ring.push([tx0 + 6, z]);              // east side, going +z
  for (let x = tx0 + 5; x >= tx0 - 1; x--) ring.push([x, tz0 + 6]);          // north side, going -x
  for (let z = tz0 + 5; z >= tz0; z--) ring.push([tx0 - 1, z]);              // west side, going -z
  // two laps: the second lap one block further out
  let y = P;
  for (let lap = 0; lap < 2 && y < TOP - 1; lap++) {
    const o = lap;   // offset outward
    for (const [rx, rz] of ring) {
      if (y >= TOP - 1) break;
      const sx = rx < tx0 ? rx - o : rx > tx0 + 5 ? rx + o : rx;
      const sz = rz < tz0 ? rz - o : rz > tz0 + 5 ? rz + o : rz;
      box(sx, P, sz, sx, y, sz, T.stone);
      y++;
    }
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
  box(48, GROUND, 46, 52, GROUND, 50, T.stone); box(49, GROUND, 47, 51, GROUND, 49, 0);  // well rim
  box(49, GROUND - 6, 47, 51, GROUND - 1, 49, 0);                                          // well shaft (dungeon entrance later)

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

  // ---- hub: a low ring of stone posts, and gold pedestals for platinum tools later
  for (const [x, z] of [[54, 54], [73, 54], [54, 73], [73, 73]]) box(x, GROUND, z, x, GROUND + 1, z, T.stone);
}
