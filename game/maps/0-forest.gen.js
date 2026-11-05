// builds map 0 (forest quadrant) when packing; world offset x 0, z 64. See lib/world.mjs.
import { buildQuadrant } from '../lib/world.mjs';
export default (map) => buildQuadrant(map, 0, 64);
