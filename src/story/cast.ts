// Cast helpers with no dependencies, so the browser engine can use them without bundling the schema (zod).
export const DEFAULT_PROTAGONIST = 'emily';

/** The roster character a cast entry stands for (`ref: "hero"` is the old spelling of Emily). */
export const rosterIdOf = (member: { ref?: string }): string | undefined => (member.ref === 'hero' ? 'emily' : member.ref);

/** The cast id of the story's protagonist: the named one, else the first roster character. */
export const protagonistOf = (story: { protagonist?: string; cast: { id: string; ref?: string }[] }): string =>
  story.protagonist ?? story.cast.find((c) => c.ref)?.id ?? DEFAULT_PROTAGONIST;
