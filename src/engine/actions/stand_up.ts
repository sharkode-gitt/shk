import { seated } from './sit.ts';
import { ramp, type ActionFn } from './util.ts';

/** From seated to standing over the first 70%, leaning forward while rising. */
export const standUp: ActionFn = (u, _t, ctx) => {
  const p = seated(ctx, 1 - ramp(u, 0.7));
  p.joints.Waist = [-0.4 * Math.sin(Math.PI * Math.min(1, u / 0.7)), 0, 0];
  return p;
};
