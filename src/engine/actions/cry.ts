import { inPlace, osc, ramp, type ActionFn } from './util.ts';

/** Hands to face, head down, shoulders shaking with sobs. */
export const cry: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.2);
  const sob = 0.08 * k * osc(t, 0.25);
  return inPlace(ctx, {
    RightShoulder: [1.5 * k, 0, -1.5 * k + sob], LeftShoulder: [1.5 * k, 0, 1.5 * k - sob],
    RightElbow: [1.4 * k, 0, 0], LeftElbow: [1.4 * k, 0, 0],
    Neck: [-0.25 * k, 0, 0],
  });
};
