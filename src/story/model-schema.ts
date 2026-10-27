import { z } from 'zod';
import { SETS, TIMES, ACTS, FACES, HAIRS, HATS, MUSIC, VOICES } from '../vocab.ts';

/**
 * The shape the model is constrained to (structured outputs): the same fields as StorySchema, but only
 * plain types and enums. Structured outputs can't express regexes, length limits or rules that span fields,
 * so those run afterwards in validateStory().
 */
export const StorySchemaForModel = z.object({
  title: z.string(),
  music: z.enum(MUSIC),
  cast: z.array(z.object({
    id: z.string(),
    ref: z.literal('hero').optional(),
    name: z.string().optional(),
    voice: z.enum(VOICES).optional(),
    look: z.object({
      skin: z.string().optional(),
      shirt: z.string(),
      pants: z.string(),
      hair: z.enum(HAIRS),
      hat: z.literal([...HATS]),
    }).optional(),
  })),
  scenes: z.array(z.object({
    set: z.enum(SETS),
    time: z.enum(TIMES),
    music: z.enum(MUSIC).optional(),
    beats: z.array(z.object({
      narrate: z.string().optional(),
      say: z.object({ who: z.string(), line: z.string() }).optional(),
      shot: z.string(),
      do: z.array(z.object({
        who: z.string(),
        act: z.enum(ACTS),
        face: z.enum(FACES).optional(),
        at: z.string().optional(),
      })),
    })),
  })),
  wants: z.array(z.string()),
});
