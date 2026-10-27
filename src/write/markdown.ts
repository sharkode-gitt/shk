import { stripTags } from '../story/text.ts';
import type { Story } from '../types.ts';

export const WORDS_PER_SECOND = 2.7;

type Beat = Story['scenes'][number]['beats'][number];
export const beatText = (beat: Beat): string => stripTags(beat.say?.line ?? beat.narrate ?? '');
export const spokenWords = (story: Story): number =>
  story.scenes.flatMap((s) => s.beats).reduce((n, b) => n + beatText(b).split(/\s+/).filter(Boolean).length, 0);
export const estimateSeconds = (story: Story): number => spokenWords(story) / WORDS_PER_SECOND;

/** Human-readable version of a story for approval. Emotion tags are dropped; Wants is shown only when it has items. */
export function storyMarkdown(story: Story, estSeconds: number = estimateSeconds(story)): string {
  const name = (id: string) => story.cast.find((c) => c.id === id)?.name ?? (id === 'emily' ? 'Emily' : id);
  const lines: string[] = [`# ${story.title}`, '', `Estimated length: ${Math.round(estSeconds)} s (${spokenWords(story)} words)`, ''];
  lines.push('## Scenes', ...story.scenes.map((s, i) => `${i + 1}. ${s.set.replace(/_/g, ' ')}, ${s.time}`), '');
  lines.push('## Script');
  let n = 0;
  for (const scene of story.scenes) {
    for (const beat of scene.beats) {
      n += 1;
      const who = beat.say ? name(beat.say.who) : 'Emily (narration)';
      lines.push(`${n}. **${who}:** ${beatText(beat)}`);
    }
  }
  if (story.wants.length) lines.push('', '## ⚠ Wants', ...story.wants.map((w) => `- ${w}`));
  return lines.join('\n') + '\n';
}
