import type { Vec3 } from '../../types.ts';
import { osc, yawToward, type ActionFn } from './util.ts';

/** Linear move from ctx.from to ctx.to with a step cycle: thighs +-0.6, knees 0..0.8, arms opposed +-0.5. */
const mover = (period: number): ActionFn => (u, t, ctx) => {
  const to = ctx.to ?? ctx.from;
  const pos = ctx.from.map((v, i) => v + (to[i] - v) * u) as Vec3;
  const s = osc(t, period);
  return {
    root: { pos, yaw: yawToward(ctx.from, to, ctx.fromYaw) },
    joints: {
      LeftHip: [0.6 * s, 0, 0], RightHip: [-0.6 * s, 0, 0],
      // The leg swinging back bends its knee.
      LeftKnee: [-0.8 * Math.max(0, -s), 0, 0], RightKnee: [-0.8 * Math.max(0, s), 0, 0],
      LeftShoulder: [-0.5 * s, 0, 0], RightShoulder: [0.5 * s, 0, 0],
    },
  };
};

export const walk = mover(0.5);
export const run = mover(0.32);
