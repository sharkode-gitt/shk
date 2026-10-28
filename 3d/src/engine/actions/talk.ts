import { mulberry32 } from '../../build/seed.ts';
import { inPlace, osc, type ActionFn, type Joints } from './util.ts';

/** How long one gesture style lasts, seconds; styles cross-fade over STYLE_FADE. */
const STYLE_LEN = 1.7, STYLE_FADE = 0.4;

/**
 * Talking with the whole body, in several styles that follow one another so the same gesture never loops: alternating hands,
 * both hands opening (explaining), one hand pointing out, and a small shrug with the head tilted. The head nods on a syllable
 * rhythm, the torso leans in and the body bobs.
 */
const STYLES: ((t: number, p1: number, p2: number) => Joints)[] = [
  (t, _p1, p2) => { // alternating hands
    const gR = Math.max(0, osc(t, 1.7, p2)) ** 1.5, gL = Math.max(0, osc(t, 1.7, p2 + Math.PI)) ** 1.5;
    return { RightShoulder: [0.35 + 0.65 * gR, 0, 0.18 + 0.25 * gR], RightElbow: [0.7 + 0.6 * gR, 0, 0], LeftShoulder: [0.25 + 0.55 * gL, 0, -0.14 - 0.2 * gL], LeftElbow: [0.6 + 0.5 * gL, 0, 0] };
  },
  (t) => { // both hands open, explaining
    const o = 0.5 + 0.5 * osc(t, 1.4);
    return { RightShoulder: [0.55, 0, 0.35 + 0.3 * o], RightElbow: [1.0, 0, 0.2 * o], LeftShoulder: [0.55, 0, -0.35 - 0.3 * o], LeftElbow: [1.0, 0, -0.2 * o] };
  },
  (t) => { // one hand points out and taps the air
    const tap = 0.5 + 0.5 * osc(t, 0.8);
    return { RightShoulder: [1.0 + 0.15 * tap, 0, 0.12], RightElbow: [0.35 + 0.2 * tap, 0, 0], LeftShoulder: [0.15, 0, -0.1], LeftElbow: [0.4, 0, 0] };
  },
  (t) => { // shrug
    const s = 0.5 + 0.5 * osc(t, 1.6);
    return { RightShoulder: [0.3, 0, 0.45 + 0.15 * s], RightElbow: [1.1, 0, 0.3], LeftShoulder: [0.3, 0, -0.45 - 0.15 * s], LeftElbow: [1.1, 0, -0.3], Neck: [0.05, 0, 0.1 * s] };
  },
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const mixJoints = (a: Joints, b: Joints, w: number): Joints => {
  const out: Joints = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Joints>) {
    const x = a[k] ?? [0, 0, 0], y = b[k] ?? [0, 0, 0];
    out[k] = [x[0] + (y[0] - x[0]) * w, x[1] + (y[1] - x[1]) * w, x[2] + (y[2] - x[2]) * w];
  }
  return out;
};

export const talk: ActionFn = (_u, t, ctx) => {
  const rnd = mulberry32(ctx.seed);
  const [p1, p2, p3] = [rnd(), rnd(), rnd()].map((r) => r * 2 * Math.PI);
  const beat = Math.abs(osc(t, 0.9, p1)); // 0..1 pulse about every 0.45 s
  const phase = t / STYLE_LEN + p3, k = Math.floor(phase), f = phase - k;
  const a = STYLES[((k % 4) + 4) % 4](t, p1, p2), b = STYLES[(((k + 1) % 4) + 4) % 4](t, p1, p2);
  const w = f > 1 - STYLE_FADE / STYLE_LEN ? smooth((f - (1 - STYLE_FADE / STYLE_LEN)) / (STYLE_FADE / STYLE_LEN)) : 0;
  const joints = mixJoints(a, b, w);
  const neck = joints.Neck ?? [0, 0, 0];
  joints.Neck = [0.05 + 0.1 * beat + neck[0], 0.07 * osc(t, 2.3, p2), 0.04 * osc(t, 3.1, p1) + neck[2]];
  joints.Waist = [-0.06 - 0.03 * beat, 0.04 * osc(t, 2.3, p1), 0];
  return inPlace(ctx, joints, 0.05 * beat, true);
};
