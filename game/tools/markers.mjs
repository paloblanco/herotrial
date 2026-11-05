// Rebuilds scene 0's markers from lib/world.mjs (spawns and hand-placed chests are kept).
// Run: node game/tools/markers.mjs   -- only while the scene is generated; once markers are
// placed by hand in the IDE, stop running this or it will replace them.
import { column, features } from '../lib/world.mjs';
import fs from 'fs';
const p = new URL('../scenes.json', import.meta.url).pathname;
const s = JSON.parse(fs.readFileSync(p));
const keep = s[0].vox.filter(m => m.v == 0 || m.v == 70);
const at = (v, x, z, yaw = 0) => ({ v, pos: [x + 0.5, column(x, z).h, z + 0.5], yaw });
const tools = [  // [vox, x, z]: sword 16 hammer 17 axe 18 spear 19 knife 20 whip 21 mace 22 shovel 23 hoe 24
  [16, 60, 58], [20, 68, 60], [21, 58, 68], [16, 69, 69],          // hub
  [18, 20, 90], [18, 44, 116], [19, 12, 76],                       // forest
  [17, 74, 96], [22, 116, 76],                                     // castle area
  [24, 28, 26], [24, 42, 12], [23, 16, 40],                        // village / farms
  [17, 76, 16], [22, 92, 28],                                      // mountains
];
const chestSpots = [[30, 80], [12, 112], [50, 100], [24, 70], [86, 94], [112, 112], [100, 70], [16, 16],
  [54, 34], [6, 52], [72, 8], [110, 50], [96, 12], [58, 120], [115, 100], [40, 56]];
s[0].vox = keep.concat(tools.map(([v, x, z]) => at(v, x, z)), chestSpots.map(([x, z]) => at(42, x, z)));
// platinum sword on the tower top (gold tile under it, set in world.mjs)
s[0].vox.push({ v: 16, pos: [108.5, 50, 90.5], yaw: 0 });
for (const [v, x, y, z] of features()) s[0].vox.push({ v, pos: [x + 0.5, y, z + 0.5], yaw: [0, 0.25, 0.5, 0.75][(x * 7 + z) % 4] });
fs.writeFileSync(p, JSON.stringify(s, null, 2));
console.log(s[0].vox.length, 'markers');
