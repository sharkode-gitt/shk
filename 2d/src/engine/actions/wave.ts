import { inPlace, osc, ramp, type ActionFn } from './util.ts';

/** Right arm raised high, forearm swinging side to side. */
export const wave: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.15);
  return inPlace(ctx, { RightShoulder: [0, 0, 2.6 * k], RightElbow: [0, 0, 0.5 * k * osc(t, 0.5)] }, 0, true);
};
