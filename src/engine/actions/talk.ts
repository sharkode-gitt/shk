import { inPlace, osc, type ActionFn } from './util.ts';

/** Small hand gestures and a head nod, facing the listener. */
export const talk: ActionFn = (_u, t, ctx) =>
  inPlace(ctx, {
    RightShoulder: [0.5 + 0.25 * osc(t, 0.9), 0, 0.15], RightElbow: [0.9, 0, 0],
    LeftShoulder: [0.3 + 0.2 * osc(t, 1.1, 1), 0, -0.1], LeftElbow: [0.6, 0, 0],
    Neck: [0.08 * osc(t, 0.6), 0, 0],
  }, 0, true);
