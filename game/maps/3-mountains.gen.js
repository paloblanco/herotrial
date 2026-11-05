// builds map 3 (mountains quadrant) when packing; world offset x 64, z 0. See lib/world.mjs.
import { buildQuadrant } from '../lib/world.mjs';
export default (map) => buildQuadrant(map, 64, 0);
