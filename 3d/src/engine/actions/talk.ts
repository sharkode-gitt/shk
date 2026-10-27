import { mulberry32 } from '../../build/seed.ts';
import { inPlace, osc, type ActionFn } from './util.ts';

/**
 * Talking with the whole body: the head nods on a syllable rhythm and turns a little, the torso leans in, the body bobs, and
 * the hands make gestures that alternate (one arm lifts and drops, then the other) instead of swinging forever in sync.
 */
export const talk: ActionFn = (_u, t, ctx) => {
  const rnd = mulberry32(ctx.seed);
  const [p1, p2] = [rnd(), rnd()].map((r) => r * 2 * Math.PI);
  const beat = Math.abs(osc(t, 0.9, p1)); // 0..1 pulse about every 0.45 s
  const gR = Math.max(0, osc(t, 1.7, p2)) ** 1.5, gL = Math.max(0, osc(t, 1.7, p2 + Math.PI)) ** 1.5; // alternating gestures
  return inPlace(ctx, {
    RightShoulder: [0.35 + 0.65 * gR, 0, 0.18 + 0.25 * gR], RightElbow: [0.7 + 0.6 * gR, 0, 0],
    LeftShoulder: [0.25 + 0.55 * gL, 0, -0.14 - 0.2 * gL], LeftElbow: [0.6 + 0.5 * gL, 0, 0],
    Neck: [0.05 + 0.1 * beat, 0.07 * osc(t, 2.3, p2), 0.04 * osc(t, 3.1, p1)],
    Waist: [-0.06 - 0.03 * beat, 0.04 * osc(t, 2.3, p1), 0],
  }, 0.05 * beat, true);
};
