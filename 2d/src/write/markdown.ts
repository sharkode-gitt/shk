import { protagonistOf, rosterIdOf } from '../story/cast.ts';
import { stripTags } from '../story/text.ts';
import type { Story } from '../types.ts';

export const WORDS_PER_SECOND = 2.7;

type Beat = Story['scenes'][number]['beats'][number];
export const beatText = (beat: Beat): string => stripTags(beat.say?.line ?? beat.narrate ?? '');
export const spokenWords = (story: Story): number =>
  story.scenes.flatMap((s) => s.beats).reduce((n, b) => n + beatText(b).split(/\s+/).filter(Boolean).length, 0);
export const estimateSeconds = (story: Story): number => spokenWords(story) / WORDS_PER_SECOND;

/** Human-readable version of a story for approval. Emotion tags are dropped; Wants is shown only when it has items. */
export function storyMarkdown(story: Story, estSeconds: number = estimateSeconds(story), roster: Record<string, { name: string }> = {}): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const name = (id: string) => {
    const member = story.cast.find((c) => c.id === id);
    return member?.name ?? roster[rosterIdOf(member ?? {}) ?? id]?.name ?? cap(id);
  };
  const narrator = protagonistOf(story);
  const lines: string[] = [`# ${story.title}`, '', `Estimated length: ${Math.round(estSeconds)} s (${spokenWords(story)} words)`, ''];
  lines.push('## Scenes', ...story.scenes.map((s, i) => `${i + 1}. ${s.set.replace(/_/g, ' ')}, ${s.time}`), '');
  lines.push('## Script');
  let n = 0;
  for (const scene of story.scenes) {
    for (const beat of scene.beats) {
      n += 1;
      const who = beat.say ? name(beat.say.who) : `${name(narrator)} (narration)`;
      lines.push(`${n}. **${who}:** ${beatText(beat)}`);
    }
  }
  if (story.wants.length) lines.push('', '## ⚠ Wants', ...story.wants.map((w) => `- ${w}`));
  return lines.join('\n') + '\n';
}
