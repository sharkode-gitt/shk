import { inPlace, osc, ramp, type ActionFn } from './util.ts';

/** Head thrown back, hands on belly, torso bouncing. */
export const laugh: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.15);
  const b = osc(t, 0.3);
  return inPlace(ctx, {
    Neck: [0.5 * k, 0, 0], Waist: [(0.25 + 0.08 * b) * k, 0, 0],
    RightShoulder: [0.4 * k, 0, -0.2 * k], LeftShoulder: [0.4 * k, 0, 0.2 * k],
    RightElbow: [1.2 * k, 0, 0], LeftElbow: [1.2 * k, 0, 0],
  }, 0.08 * k * Math.abs(b));
};
