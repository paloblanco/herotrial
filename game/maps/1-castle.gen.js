// builds map 1 (castle quadrant) when packing; world offset x 64, z 64. See lib/world.mjs.
import { buildQuadrant } from '../lib/world.mjs';
export default (map) => buildQuadrant(map, 64, 64);
