import type { Vec3 } from '../../types.ts';
import { clamp01, lerpAngle, osc, yawToward, type ActionFn } from './util.ts';

/** Linear move from ctx.from to ctx.to (facing travel, turning to the camera at the end) with a step cycle: thighs +-0.6, knees 0..0.8, arms opposed +-0.5. */
const mover = (period: number): ActionFn => (u, t, ctx) => {
  const to = ctx.to ?? ctx.from;
  const pos = ctx.from.map((v, i) => v + (to[i] - v) * u) as Vec3;
  const s = osc(t, period);
  return {
    // Face the direction of travel, then turn to the camera (yaw 0) over the last fifth so the arrival reads on screen.
    root: { pos, yaw: lerpAngle(yawToward(ctx.from, to, ctx.fromYaw), 0, (k => k * k * (3 - 2 * k))(clamp01((u - 0.8) / 0.2))) },
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
