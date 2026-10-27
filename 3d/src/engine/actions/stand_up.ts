import { lying } from './fall.ts';
import { seated } from './sit.ts';
import { ramp, type ActionFn } from './util.ts';

/** Rises to standing over the first 70%: from lying if ctx.posture is 'lie', else from seated (leaning forward). */
export const standUp: ActionFn = (u, _t, ctx) => {
  const k = 1 - ramp(u, 0.7);
  if (ctx.posture === 'lie') return lying(ctx, k);
  const p = seated(ctx, k);
  p.joints.Waist = [-0.4 * Math.sin(Math.PI * Math.min(1, u / 0.7)), 0, 0];
  return p;
};
