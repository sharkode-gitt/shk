import type { Vec3 } from '../../types.ts';
import { clamp01, lerpAngle, yawToward, type ActionFn } from './util.ts';

/** 0..1 travel progress with soft starts and stops (half linear, half smoothstep, so it never crawls). */
const travel = (u: number) => 0.5 * u + 0.5 * u * u * (3 - 2 * u);
/** Its speed relative to the average, 0.5 at both ends and 1.25 mid-way. */
const speed = (u: number) => 0.5 + 0.5 * 6 * u * (1 - u);

/**
 * Move from ctx.from to ctx.to (facing travel, easing toward the target over the last quarter). The step cycle is driven by
 * the distance covered (one full cycle per `stride` studs), so the feet never slide; the swing shrinks while speeding
 * up or slowing down. Thighs swing `leg`, knees bend on the back swing, arms oppose the legs with a bent elbow, the
 * body bounces twice per cycle and leans `lean` rad into the motion.
 */
const mover = (stride: number, leg: number, arm: number, bounce: number, lean: number): ActionFn => (u, _t, ctx) => {
  const to = ctx.to ?? ctx.from;
  const e = travel(u);
  const travelYaw = yawToward(ctx.from, to, ctx.fromYaw);
  const dist = Math.hypot(to[0] - ctx.from[0], to[2] - ctx.from[2]);
  const phase = (2 * Math.PI * dist * e) / stride;
  const s = Math.sin(phase);
  const amp = Math.min(1, speed(u)) * Math.min(1, dist / 1.5);
  const pos = ctx.from.map((v, i) => v + (to[i] - v) * e) as Vec3;
  pos[1] += bounce * amp * Math.abs(Math.cos(phase));
  return {
    // Face the direction of travel; over the last quarter ease toward whoever (or whatever) the walk was aimed at, never snap
    // to the camera. Without a target the character simply keeps facing where they walked.
    root: { pos, yaw: lerpAngle(travelYaw, ctx.lookAt ? yawToward(to, ctx.lookAt, travelYaw) : travelYaw, (k => k * k * (3 - 2 * k))(clamp01((u - 0.75) / 0.25))) },
    joints: {
      LeftHip: [leg * amp * s, 0, 0], RightHip: [-leg * amp * s, 0, 0],
      // The leg swinging back bends its knee.
      LeftKnee: [-1.0 * amp * Math.max(0, -s), 0, 0], RightKnee: [-1.0 * amp * Math.max(0, s), 0, 0],
      LeftAnkle: [0.25 * amp * Math.max(0, s), 0, 0], RightAnkle: [0.25 * amp * Math.max(0, -s), 0, 0],
      LeftShoulder: [-arm * amp * s, 0, 0], RightShoulder: [arm * amp * s, 0, 0],
      LeftElbow: [0.25 * amp + 0.35 * amp * Math.max(0, s), 0, 0], RightElbow: [0.25 * amp + 0.35 * amp * Math.max(0, -s), 0, 0],
      Waist: [-lean * amp, 0.14 * amp * s, 0],
      Root: [0, 0, 0.03 * amp * s],
      Neck: [lean * 0.6 * amp, 0, 0],
    },
  };
};

export const walk = mover(3.4, 0.6, 0.5, 0.1, 0.05);
export const run = mover(5.2, 0.9, 0.9, 0.25, 0.22);
