import { inPlace, ramp, type ActionFn } from './util.ts';

/** Right hand slaps the forehead, head drops into it. */
export const facepalm: ActionFn = (u, _t, ctx) => {
  const k = ramp(u, 0.15);
  return inPlace(ctx, {
    RightShoulder: [1.9 * k, 0, -1.1 * k], RightElbow: [0.8 * k, 0, 0],
    Neck: [-0.25 * k, 0, 0], Waist: [-0.1 * k, 0, 0],
  });
};
