import { inPlace, type ActionFn } from './util.ts';

/** Crouch (u<0.25), launch arc peaking 2 studs with arms up (0.25..0.8), landing crouch (0.8..1). */
export const jump: ActionFn = (u, _t, ctx) => {
  const air = u > 0.25 && u < 0.8 ? (u - 0.25) / 0.55 : -1;
  const crouch = air >= 0 ? 0 : Math.sin(Math.PI * (u < 0.25 ? u / 0.25 : (u - 0.8) / 0.2));
  const up = air >= 0 ? Math.sin(Math.PI * air) : 0;
  const dy = air >= 0 ? 2 * 4 * air * (1 - air) : -0.4 * crouch;
  return inPlace(ctx, {
    LeftHip: [0.9 * crouch + 0.4 * up, 0, 0], RightHip: [0.9 * crouch + 0.4 * up, 0, 0],
    LeftKnee: [-1.2 * crouch - 0.6 * up, 0, 0], RightKnee: [-1.2 * crouch - 0.6 * up, 0, 0],
    RightShoulder: [-0.4 * crouch, 0, 2.4 * up], LeftShoulder: [-0.4 * crouch, 0, -2.4 * up],
    Waist: [-0.3 * crouch, 0, 0],
  }, dy);
};
