/**
 * FNV-1a 32-bit hash of an id string. Hashes UTF-16 code units (`charCodeAt`),
 * so ASCII ids match the UTF-8 byte FNV-1a; non-ASCII ids differ from it.
 * Returns an unsigned 32-bit integer.
 */
export const seedFromId = (id: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** mulberry32 PRNG (public domain). Returns a generator of values in [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
