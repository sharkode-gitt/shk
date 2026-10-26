/** Removes Eleven v3 emotion tags like `[sad]` and collapses extra whitespace. */
export const stripTags = (s: string): string => s.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();

export const splitWords = (s: string): string[] => s.split(/\s+/).filter(Boolean);
