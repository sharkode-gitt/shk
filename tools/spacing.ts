// Usage: npx tsx tools/spacing.ts <job id>...   Prints the closest two characters ever get, per job (needs a built comp).
import { readFileSync } from 'node:fs';
import { buildSet } from '../src/engine/sets/index.ts';
import { sceneState, type ScenePayload, type SetLayout } from '../src/engine/state.ts';

for (const id of process.argv.slice(2)) {
  const html = readFileSync(`jobs/${id}/comp/index.html`, 'utf8');
  const payload = JSON.parse(html.match(/<script[^>]*id="scene"[^>]*>([\s\S]*?)<\/script>/)![1]) as ScenePayload;
  const layout: SetLayout = {};
  for (const s of payload.timeline.scenes) layout[s.index] = buildSet(s.set, s.time);
  const ids = payload.story.cast.map((c) => c.id);
  let min = { d: Infinity, t: 0, a: '', b: '' };
  const end = payload.timeline.duration;
  for (let f = 0; f <= end * 30; f++) {
    const st = sceneState(f / 30, payload, layout);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const A = st.poses[ids[i]].root.pos, B = st.poses[ids[j]].root.pos;
      const d = Math.hypot(A[0] - B[0], A[2] - B[2]);
      if (d < min.d) min = { d, t: f / 30, a: ids[i], b: ids[j] };
    }
  }
  console.log(id, `closest ${min.d.toFixed(2)} studs: ${min.a}/${min.b} at ${min.t.toFixed(2)} s`);
}
