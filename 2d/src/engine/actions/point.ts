import { inPlace, ramp, type ActionFn } from './util.ts';

/** Right arm snaps straight out ahead, body turned toward the target. */
export const point: ActionFn = (u, _t, ctx) => {
  const k = ramp(u, 0.15);
  return inPlace(ctx, { RightShoulder: [1.57 * k, 0, 0.1 * k], Waist: [0, 0.15 * k, 0] }, 0, true);
};
