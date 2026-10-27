import { mulberry32 } from '../../build/seed.ts';
import { inPlace, osc, type ActionFn } from './util.ts';

/** Breathing: Waist +-0.03 rad, period 3.2 s, phase from the seed. */
export const idle: ActionFn = (_u, t, ctx) =>
  inPlace(ctx, { Waist: [0.03 * osc(t, 3.2, mulberry32(ctx.seed)() * 2 * Math.PI), 0, 0] });
