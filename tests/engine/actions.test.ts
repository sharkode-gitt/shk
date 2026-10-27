import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, BLEND, poseAt, type ActionCtx } from '../../src/engine/actions/index.ts';
import { ACTS } from '../../src/vocab.ts';
import type { JointName, TimedAction, TimedBeat, Vec3 } from '../../src/types.ts';

const beat = (actions: TimedAction[], start = 0, end = 10): TimedBeat => ({
  id: '0.0', scene: 0, start, end, speaker: 'narrator', kind: 'narrate', text: '',
  audio: { file: '', start, duration: end - start }, words: [], shot: { kind: 'wide', targets: [] }, actions,
});
const marks: Record<string, Vec3> = { door: [5, 0, 0] };
const home: Vec3 = [0, 0, 0];
const ZERO: Vec3 = [0, 0, 0];
const joint = (p: { joints: Partial<Record<JointName, Vec3>> }, j: JointName) => p.joints[j] ?? ZERO;

test('same t gives the same pose (determinism)', () => {
  const beats = [beat([{ who: 'emily', act: 'walk_to', at: 'door', start: 0, end: 2 }, { who: 'emily', act: 'wave', start: 2, end: 4 }])];
  for (const t of [0, 0.37, 1, 2.05, 3.3, 7]) {
    assert.deepEqual(poseAt('emily', t, beats, marks, home, 42), poseAt('emily', t, beats, marks, home, 42));
  }
});

test('walk_to door: root at x~2.5 at the midpoint', () => {
  const beats = [beat([{ who: 'emily', act: 'walk_to', at: 'door', start: 0, end: 2 }])];
  const p = poseAt('emily', 1, beats, marks, home, 1);
  assert.ok(Math.abs(p.root.pos[0] - 2.5) < 0.05, `x=${p.root.pos[0]}`);
  assert.ok(Math.abs(p.root.yaw - -Math.PI / 2) < 1e-6, 'faces +X while walking toward the door');
});

test('Review Focus 5: sit after walk_to starts at the walk end position', () => {
  const beats = [beat([{ who: 'emily', act: 'walk_to', at: 'door', start: 0, end: 2 }, { who: 'emily', act: 'sit', start: 2, end: 4 }])];
  for (const t of [2, 2.001, 2.1, 3]) {
    const p = poseAt('emily', t, beats, marks, home, 1);
    assert.ok(Math.hypot(p.root.pos[0] - 5, p.root.pos[2]) < 0.01, `t=${t} pos=${p.root.pos}`);
  }
});

test('mid transition (0.1 s after a switch) joints sit at 50% +-5%', () => {
  const beats = [beat([{ who: 'emily', act: 'point', start: 0, end: 2 }, { who: 'emily', act: 'wave', start: 2, end: 4 }])];
  const t = 2 + BLEND / 2;
  const p = poseAt('emily', t, beats, marks, home, 1);
  const ctx: ActionCtx = { from: home, fromYaw: 0, seed: 1 };
  const a = ACTIONS.point(1, t, ctx);
  const b = ACTIONS.wave((t - 2) / 2, t, ctx);
  let checked = 0;
  for (const j of ['RightShoulder', 'RightElbow'] as JointName[]) {
    for (let k = 0; k < 3; k++) {
      const d = joint(b, j)[k] - joint(a, j)[k];
      if (Math.abs(d) < 0.1) continue;
      const f = (joint(p, j)[k] - joint(a, j)[k]) / d;
      assert.ok(Math.abs(f - 0.5) <= 0.05, `${j}[${k}] f=${f}`);
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test('a character with no actions stays at its last position', () => {
  const beats = [beat([{ who: 'emily', act: 'walk_to', at: 'door', start: 0, end: 2 }]), beat([], 2, 6)];
  for (const t of [3, 5.9]) {
    const p = poseAt('emily', t, beats, marks, home, 1);
    assert.ok(Math.hypot(p.root.pos[0] - 5, p.root.pos[2]) < 1e-9, `t=${t}`);
  }
  const bob = poseAt('bob', 3, beats, marks, [2, 0, -1], 1);
  assert.deepEqual(bob.root, { pos: [2, 0, -1], yaw: 0 });
});

test('walk_to a cast id stops 1.5 studs short and point turns toward them', () => {
  const others = (who: string): Vec3 => (who === 'mom' ? [0, 0, -6] : [0, 0, 0]);
  const beats = [beat([{ who: 'emily', act: 'walk_to', at: 'mom', start: 0, end: 2 }, { who: 'emily', act: 'point', at: 'mom', start: 2, end: 3 }])];
  const p = poseAt('emily', 2.5, beats, marks, home, 1, others);
  assert.ok(Math.hypot(p.root.pos[0], p.root.pos[2] + 4.5) < 1e-6, `pos=${p.root.pos}`);
  assert.ok(Math.abs(p.root.yaw) < 1e-6, 'faces -Z toward mom');
});

const idle = ACTIONS.idle(0.5, 1.37, { from: home, fromYaw: 0, seed: 7 });
for (const act of ACTS.filter((a) => a !== 'idle')) {
  test(`${act} at u=0.5 differs from idle`, () => {
    const ctx: ActionCtx = { from: home, fromYaw: 0, seed: 7, to: [5, 0, 0], lookAt: [3, 0, -3] };
    const p = ACTIONS[act](0.5, 1.37, ctx);
    const names = new Set([...Object.keys(p.joints), ...Object.keys(idle.joints)] as JointName[]);
    const diff = Math.max(...[...names].flatMap((j) => [0, 1, 2].map((k) => Math.abs(joint(p, j)[k] - joint(idle, j)[k]))));
    assert.ok(diff > 0.2, `max joint diff ${diff}`);
  });
}
