import { inPlace, ramp, type ActionFn } from './util.ts';

/** Snaps both arms up and leans back. */
export const shocked: ActionFn = (u, _t, ctx) => {
  const k = ramp(u, 0.1);
  return inPlace(ctx, {
    RightShoulder: [0, 0, 2.2 * k], LeftShoulder: [0, 0, -2.2 * k],
    RightElbow: [0, 0, 0.5 * k], LeftElbow: [0, 0, -0.5 * k],
    Waist: [0.3 * k, 0, 0], Neck: [0.2 * k, 0, 0],
  });
};
