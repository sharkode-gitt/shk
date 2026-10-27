import { inPlace, ramp, type ActionFn } from './util.ts';

/** Both arms forward and wrapped inward, facing the other character. */
export const hug: ActionFn = (u, _t, ctx) => {
  const k = ramp(u, 0.2);
  return inPlace(ctx, {
    RightShoulder: [1.4 * k, 0, -0.5 * k], LeftShoulder: [1.4 * k, 0, 0.5 * k],
    RightElbow: [0.4 * k, 0, 0], LeftElbow: [0.4 * k, 0, 0],
    Waist: [-0.15 * k, 0, 0],
  }, 0, true);
};
