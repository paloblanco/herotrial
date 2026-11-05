// builds map 2 (village quadrant) when packing; world offset x 0, z 0. See lib/world.mjs.
import { buildQuadrant } from '../lib/world.mjs';
export default (map) => buildQuadrant(map, 0, 0);
