import type { JointName, Pose, Vec3 } from '../../types.ts';

/**
 * Rotation signs (verified against rig.ts): +X on Shoulder/Hip/Elbow swings the limb forward (toward -Z);
 * -X on Knee bends it backward; +X on Neck/Waist/Root tips back, -X leans forward.
 * RightShoulder +Z raises the arm sideways, -Z swings it across the body; LeftShoulder mirrored.
 */
export type ActionCtx = { from: Vec3; fromYaw: number; to?: Vec3; lookAt?: Vec3; seed: number };
export type ActionPose = Omit<Pose, 'face' | 'mouth'>;
/** `u` is 0..1 within the action, `tAbs` absolute seconds. */
export type ActionFn = (u: number, tAbs: number, ctx: ActionCtx) => ActionPose;
export type Joints = Partial<Record<JointName, Vec3>>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Smoothstep 0→1 over the first `span` of the action. */
export const ramp = (u: number, span: number) => {
  const c = clamp01(u / span);
  return c * c * (3 - 2 * c);
};
export const osc = (t: number, period: number, phase = 0) => Math.sin((2 * Math.PI * t) / period + phase);

/** Yaw that makes a character at `from` face `to` (yaw 0 faces -Z). */
export const yawToward = (from: Vec3, to: Vec3, fallback: number) => {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  return Math.hypot(dx, dz) < 1e-6 ? fallback : Math.atan2(-dx, -dz);
};

/** Pose in place at ctx.from, facing ctx.lookAt when `face` and a target exists. */
export const inPlace = (ctx: ActionCtx, joints: Joints, dy = 0, face = false): ActionPose => ({
  root: { pos: [ctx.from[0], ctx.from[1] + dy, ctx.from[2]], yaw: face && ctx.lookAt ? yawToward(ctx.from, ctx.lookAt, ctx.fromYaw) : ctx.fromYaw },
  joints,
});
