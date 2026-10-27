// Usage: npx tsx tools/spacing.ts <job id>...   (needs a built comp)
// Prints, per job: the closest two characters ever get (only characters on screen together), and the biggest camera jump
// between two frames of the same beat (a pop that is not a cut).
import { readFileSync } from 'node:fs';
import { buildSet } from '../src/engine/sets/index.ts';
import { sceneState, type ScenePayload, type SetLayout } from '../src/engine/state.ts';

for (const id of process.argv.slice(2)) {
  const html = readFileSync(`jobs/${id}/comp/index.html`, 'utf8');
  const payload = JSON.parse(html.match(/<script[^>]*id="scene"[^>]*>([\s\S]*?)<\/script>/)![1]) as ScenePayload;
  const layout: SetLayout = {};
  for (const s of payload.timeline.scenes) layout[s.index] = buildSet(s.set, s.time);
  const min = { d: Infinity, t: 0, a: '', b: '' };
  const jump = { d: 0, t: 0 };
  let prev: ReturnType<typeof sceneState> | undefined;
  const beatAt = (t: number) => payload.timeline.beats.filter((b) => Math.ceil(b.start * 30) <= Math.round(t * 30)).at(-1)?.id;
  for (let f = 0; f <= payload.timeline.duration * 30; f++) {
    const t = f / 30, st = sceneState(t, payload, layout), ids = Object.keys(st.poses);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const A = st.poses[ids[i]].root.pos, B = st.poses[ids[j]].root.pos;
      const d = Math.hypot(A[0] - B[0], A[2] - B[2]);
      if (d < min.d) Object.assign(min, { d, t, a: ids[i], b: ids[j] });
    }
    if (prev && beatAt(t) === beatAt(t - 1 / 30) && st.sceneIndex === prev.sceneIndex) {
      const d = Math.hypot(...[0, 1, 2].map((k) => st.camera.pos[k] - prev!.camera.pos[k]));
      if (d > jump.d) Object.assign(jump, { d, t });
    }
    prev = st;
  }
  console.log(id, `closest ${min.d.toFixed(2)} studs (${min.a}/${min.b} at ${min.t.toFixed(2)} s); biggest camera step inside a beat ${jump.d.toFixed(2)} studs at ${jump.t.toFixed(2)} s`);
}
