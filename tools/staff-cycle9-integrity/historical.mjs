// Compatibility exports for unchanged historical negative comparisons.
// New actual bytes must pass the separately pinned composition verifier first.
import * as old from '../staff-host-cycle8/overrides.mjs';
import {cycle8Reader, checkpointReader} from './overrides.mjs';
export const {original, existing, additions, pinnedHelpers} = old;
export const current = cycle8Reader();
export function verifyHostOverrides(bytes, read) {
  const checkpoint = cycle8Reader();
  return old.verifyHostOverrides(bytes, read || checkpoint);
}
export {checkpointReader};
