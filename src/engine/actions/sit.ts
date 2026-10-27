import { inPlace, ramp, type ActionFn, type ActionPose, type ActionCtx } from './util.ts';

/** Seated pose scaled by k (0 standing, 1 seated): hips drop to ~1.5 studs, thighs forward, knees bent. */
export const seated = (ctx: ActionCtx, k: number): ActionPose =>
  inPlace(ctx, {
    LeftHip: [1.57 * k, 0, 0], RightHip: [1.57 * k, 0, 0],
    LeftKnee: [-1.57 * k, 0, 0], RightKnee: [-1.57 * k, 0, 0],
    LeftShoulder: [0.5 * k, 0, 0], RightShoulder: [0.5 * k, 0, 0],
  }, -0.5 * k);

export const sit: ActionFn = (u, _t, ctx) => seated(ctx, ramp(u, 0.3));
