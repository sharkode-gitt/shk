import { mulberry32 } from '../../build/seed.ts';
import { inPlace, osc, type ActionFn } from './util.ts';

/**
 * Standing still but alive: breathing (Waist +-0.03 rad, 3.2 s), a slow look-around of the head (+-0.04 nod, 4.3 s;
 * +-0.06 turn, 6.1 s) and arms hanging slightly away from the body with a small sway. Phases come from the seed, so
 * two characters never move in sync.
 */
export const idle: ActionFn = (_u, t, ctx) => {
  const rnd = mulberry32(ctx.seed);
  const [p1, p2, p3, p4] = [rnd(), rnd(), rnd(), rnd()].map((r) => r * 2 * Math.PI);
  const sway = 0.02 * osc(t, 3.2, p4);
  return inPlace(ctx, {
    Waist: [0.03 * osc(t, 3.2, p1), 0, 0],
    Neck: [0.04 * osc(t, 4.3, p2), 0.06 * osc(t, 6.1, p3), 0],
    RightShoulder: [0, 0, 0.07 + sway], LeftShoulder: [0, 0, -0.07 - sway],
  });
};
