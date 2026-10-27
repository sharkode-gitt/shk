import test from 'node:test';
import assert from 'node:assert/strict';
import storyJson from '../../fixtures/story.json' with { type: 'json' };
import timingJson from '../../fixtures/timing.json' with { type: 'json' };
import { compileTimeline } from '../../src/build/timeline.ts';
import { buildSet } from '../../src/engine/sets/index.ts';
import { sceneState, type ScenePayload, type SetLayout } from '../../src/engine/state.ts';
import type { Story, Timing } from '../../src/types.ts';

const story = storyJson as Story;
const timeline = compileTimeline(story, timingJson as Timing);
const payload: ScenePayload = { story, timeline, seed: 42, roster: {} };
const layout: SetLayout = Object.fromEntries(timeline.scenes.map((s) => [s.index, buildSet(s.set, s.time)]));
const at = (t: number) => sceneState(t, payload, layout);
const beat = (id: string) => timeline.beats.find((b) => b.id === id)!;
const midWord = (id: string, i: number) => { const w = beat(id).words[i]; return (w.start + w.end) / 2; };

test('Review Focus 3: the last frame before a cut is the previous scene, the cut frame is the next', () => {
  const cut = timeline.scenes[1].start;
  const before = at((Math.ceil(cut * 30) - 1) / 30);
  const on = at(Math.ceil(cut * 30) / 30);
  assert.equal(before.sceneIndex, 0);
  assert.equal(on.sceneIndex, 1);
  // The camera reads the same boundary: push_in (fov 35) closes scene 0, orbit (fov 40) opens scene 1.
  assert.equal(before.camera.fov, 35);
  assert.equal(on.camera.fov, 40);
});

test("the speaker's mouth moves mid-word and is closed in the pause between beats", () => {
  const b = beat('0.1'); // mia says
  assert.ok(at(midWord('0.1', 1)).poses.mia.mouth > 0);
  const pause = b.audio.start + b.audio.duration + (b.end - b.audio.start - b.audio.duration) / 2;
  assert.ok(pause < b.end);
  assert.equal(at(pause).poses.mia.mouth, 0);
});

test('characters who are not speaking have mouth 0', () => {
  const s = at(midWord('0.1', 1));
  assert.equal(s.poses.emily.mouth, 0);
  assert.equal(s.poses.mom.mouth, 0);
});

test("face follows the active action's face, then the last one given, default neutral", () => {
  const t = midWord('0.1', 1);
  assert.equal(at(t).poses.mia.face, 'smug');
  assert.equal(at(midWord('0.2', 1)).poses.emily.face, 'shocked');
  assert.equal(at(midWord('0.0', 1)).poses.mia.face, 'neutral');
  // Scene 1, beat 0: emily sits (no face) -> keeps "shocked" from scene 0; mom walks with "neutral".
  const s = at(midWord('1.0', 1));
  assert.equal(s.poses.emily.face, 'shocked');
  assert.equal(s.poses.mom.face, 'neutral');
  assert.equal(at(midWord('1.1', 1)).poses.emily.face, 'crying');
});

test('every cast member gets a pose and the state is deterministic', () => {
  const t = midWord('1.0', 0);
  const s = at(t);
  assert.deepEqual(Object.keys(s.poses).sort(), ['emily', 'mia', 'mom']);
  assert.deepEqual(at(t), s);
  // Cast members stand at distinct homes before they move.
  const [e, m] = [at(0.1).poses.emily.root.pos, at(0.1).poses.mia.root.pos];
  assert.ok(Math.hypot(e[0] - m[0], e[2] - m[2]) > 0.5);
});

test('narration is voice-over: the narrator mouth stays closed mid-word', () => {
  assert.equal(beat('0.0').kind, 'narrate');
  assert.equal(at(midWord('0.0', 1)).poses.emily.mouth, 0);
  assert.equal(beat('1.1').kind, 'say');
  assert.ok(at(midWord('1.1', 1)).poses.emily.mouth > 0);
});

test('t is snapped to its frame, so off-grid times give the frame state', () => {
  const b = beat('0.2');
  const f = Math.ceil(b.start * 30);
  assert.deepEqual(at(f / 30 - 0.012), at(f / 30));
  assert.deepEqual(at(1.01), at(1));
});

test('closeup follows the target when it turns toward someone', () => {
  // Beat 0.1: mia points at emily, so she turns; the closeup camera must be on her facing side.
  const s = at(midWord('0.1', 3));
  const p = s.poses.mia;
  const head = s.camera.target;
  const facing = [-Math.sin(p.root.yaw), -Math.cos(p.root.yaw)];
  assert.ok(Math.abs(p.root.yaw) > 0.3, `mia turned (${p.root.yaw})`);
  assert.ok((s.camera.pos[0] - head[0]) * facing[0] + (s.camera.pos[2] - head[2]) * facing[1] > 2);
});
