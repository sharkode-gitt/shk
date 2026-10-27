import { inPlace, osc, ramp, type ActionFn } from './util.ts';

/** Snaps both arms up, leans back and recoils a step away (+z, away from the camera) with a tremble. */
export const shocked: ActionFn = (u, t, ctx) => {
  const k = ramp(u, 0.1);
  const pose = inPlace(ctx, {
    RightShoulder: [0, 0, 1.9 * k], LeftShoulder: [0, 0, -1.9 * k],
    RightElbow: [0, 0, 0.9 * k], LeftElbow: [0, 0, -0.9 * k],
    Waist: [0.3 * k, 0, 0], Neck: [0.2 * k + 0.03 * osc(t, 0.12), 0, 0.03 * osc(t, 0.1)],
  }, 0.12 * Math.sin(Math.PI * Math.min(1, u * 6)) * (u < 0.17 ? 1 : 0));
  pose.root.pos = [pose.root.pos[0], pose.root.pos[1], pose.root.pos[2] + 0.45 * k];
  return pose;
};
