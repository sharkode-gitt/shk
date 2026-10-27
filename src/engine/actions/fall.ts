import { inPlace, osc, ramp, type ActionFn } from './util.ts';

/** Topples backward over the first 40% and ends lying on the back, arms flung out. */
export const fall: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.4);
  const flail = (1 - k) * 0.4 * osc(t, 0.2);
  return inPlace(ctx, {
    Root: [1.57 * k, 0, 0],
    RightShoulder: [0, 0, 1.3 * k + flail], LeftShoulder: [0, 0, -1.3 * k - flail],
    LeftHip: [0.3 * k, 0, 0], RightKnee: [-0.5 * k, 0, 0],
  }, -1.35 * k);
};
