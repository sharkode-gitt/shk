import { inPlace, osc, ramp, type ActionCtx, type ActionFn, type ActionPose } from './util.ts';

/** Lying pose scaled by k (0 standing, 1 flat on the back, arms flung out). */
export const lying = (ctx: ActionCtx, k: number): ActionPose =>
  inPlace(ctx, {
    Root: [1.57 * k, 0, 0],
    RightShoulder: [0, 0, 1.3 * k], LeftShoulder: [0, 0, -1.3 * k],
    LeftHip: [0.3 * k, 0, 0], RightKnee: [-0.5 * k, 0, 0],
  }, -1.35 * k);

/** Topples backward over the first 40%, arms flailing, and ends lying. */
export const fall: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.4);
  const flail = (1 - k) * 0.4 * osc(t, 0.2);
  const p = lying(ctx, k);
  p.joints.RightShoulder![2] += flail;
  p.joints.LeftShoulder![2] -= flail;
  return p;
};
