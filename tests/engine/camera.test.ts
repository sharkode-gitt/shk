import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraAt } from '../../src/engine/camera.ts';
import type { Shot, Vec3 } from '../../src/types.ts';
import type { BuiltSet } from '../../src/engine/sets/index.ts';

const set = { marks: {}, homes: [], lights: [] } as unknown as BuiltSet;
const heads: Record<string, Vec3> = { mia: [0, 4.5, 0], leo: [3, 4.5, 1] };
const cam = (shot: Shot, u = 0, t = 1, h = heads, speaker = 'mia') => cameraAt(shot, u, 4, t, h, set, 7, speaker);
const near = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The aim point sits 0.5 above the head so the head lands low in the frame, clear of the captions.
test('closeup aims just above the head, and follows it when the head moves', () => {
  const a = cam({ kind: 'closeup', targets: ['mia'] });
  near(a.target[0], heads.mia[0], 0.05);
  near(a.target[1], heads.mia[1] + 0.5, 0.05);
  near(a.target[2], heads.mia[2], 0.05);
  const moved = cam({ kind: 'closeup', targets: ['mia'] }, 0, 1, { ...heads, mia: [2, 4, -3] });
  near(moved.target[0], 2, 0.05);
  near(moved.target[1], 4.5, 0.05);
  near(moved.target[2], -3, 0.05);
  near(Math.hypot(moved.pos[0] - 2, moved.pos[2] + 3), 8.5, 0.1);
  assert.equal(a.fov, 30);
});

test('push_in is closer at u=1 than u=0', () => {
  const s: Shot = { kind: 'push_in', targets: ['mia'] };
  const d0 = dist(cam(s, 0).pos, heads.mia);
  const d1 = dist(cam(s, 1).pos, heads.mia);
  assert.ok(d1 < d0 - 2, `${d1} < ${d0}`);
});

test('orbit sweeps ~40 degrees between u=0 and u=1', () => {
  const s: Shot = { kind: 'orbit', targets: [] };
  const ang = (u: number) => { const c = cam(s, u); return Math.atan2(c.pos[0] - c.target[0], c.target[2] - c.pos[2]); };
  near(Math.abs(ang(1) - ang(0)) * 180 / Math.PI, 40, 1);
});

test('same input gives same output', () => {
  const s: Shot = { kind: 'two_shot', targets: ['mia', 'leo'] };
  assert.deepEqual(cam(s, 0.3, 1.7), cam(s, 0.3, 1.7));
});

test('shake after 0.4 s equals medium; before it differs', () => {
  assert.deepEqual(cam({ kind: 'shake', targets: [] }, 0, 1), cam({ kind: 'medium', targets: [] }, 0, 1));
  const early = cam({ kind: 'shake', targets: [] }, 0, 0.05).pos;
  const med = cam({ kind: 'medium', targets: [] }, 0, 0.05).pos;
  assert.ok(dist(early, med) > 0.05);
});

test('medium frames the speaker, not the first head', () => {
  const c = cam({ kind: 'medium', targets: [] }, 0, 1, heads, 'leo');
  near(c.target[0], 3, 0.1);
  near(dist([c.pos[0], 0, c.pos[2]], [3, 0, 1]), 9, 0.2);
});

test('hand-held noise is small', () => {
  const a = cam({ kind: 'medium', targets: [] }, 0, 0.5).pos;
  const b = cam({ kind: 'medium', targets: [] }, 0, 1.9).pos;
  assert.ok(dist(a, b) <= 0.03 * 2 * Math.sqrt(3) + 1e-9);
});

test('wide with 3 heads spread over 6 studs keeps every head in the horizontal frustum', () => {
  const h: Record<string, Vec3> = { a: [-3, 4.5, 0], b: [0, 4.5, 2], c: [3, 4.5, -1] };
  const c = cam({ kind: 'wide', targets: [] }, 0, 1, h);
  assert.equal(c.fov, 40);
  const halfH = Math.atan(Math.tan((40 / 2) * Math.PI / 180) * 9 / 16);
  const fwd: Vec3 = [c.target[0] - c.pos[0], 0, c.target[2] - c.pos[2]];
  const fl = Math.hypot(fwd[0], fwd[2]);
  for (const p of Object.values(h)) {
    const v = [p[0] - c.pos[0], p[2] - c.pos[2]];
    const along = (v[0] * fwd[0] + v[1] * fwd[2]) / fl;
    const side = (v[0] * fwd[2] - v[1] * fwd[0]) / fl;
    assert.ok(along > 0 && Math.abs(Math.atan2(side, along)) < halfH, `head ${p} outside frustum`);
  }
  assert.ok(c.pos[2] < -9, 'camera on the -Z side');
});

test('over_shoulder looks at X from behind the nearest other', () => {
  const c = cam({ kind: 'over_shoulder', targets: ['mia'] });
  near(c.target[0], 0, 0.05);
  assert.ok(c.pos[0] > heads.leo[0], 'camera is on leo\'s far side');
  assert.ok(dist(c.pos, heads.leo) < 7, 'close enough to read as over the shoulder');
  assert.ok(dist(c.pos, heads.leo) > 4, 'far enough that the shoulder does not fill the lens');
});

test('over_shoulder with a single head falls back to medium', () => {
  const alone = { mia: heads.mia };
  assert.deepEqual(
    cam({ kind: 'over_shoulder', targets: ['mia'] }, 0, 1, alone),
    cam({ kind: 'medium', targets: [] }, 0, 1, alone),
  );
});

test('two_shot targets the midpoint and backs off for wide spreads', () => {
  const narrow = cam({ kind: 'two_shot', targets: ['mia', 'leo'] });
  near(narrow.target[0], 1.5, 0.1);
  const far = cam({ kind: 'two_shot', targets: ['mia', 'leo'] }, 0, 1, { mia: [-8, 4.5, 0], leo: [8, 4.5, 0] });
  assert.ok(far.pos[2] < narrow.pos[2] - 5);
});

test('closeup and push_in shoot from the side the target faces (yaw 0 faces -Z)', () => {
  const yaw = Math.PI / 2;
  const facing = [-Math.sin(yaw), -Math.cos(yaw)]; // yaw toward: atan2(-dx, -dz)
  for (const kind of ['closeup', 'push_in'] as const) {
    for (const u of [0, 1]) {
      const c = cameraAt({ kind, targets: ['mia'] }, u, 4, 1, heads, set, 7, 'mia', { mia: yaw });
      const v = [c.pos[0] - heads.mia[0], c.pos[2] - heads.mia[2]];
      assert.ok(v[0] * facing[0] + v[1] * facing[1] > 2, `${kind} u=${u}: ${c.pos}`);
    }
  }
});

test('closeup and the end of push_in fit the whole head width at 9:16', () => {
  const halfW = (c: { pos: number[]; target: number[]; fov: number }) =>
    Math.hypot(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]) * Math.tan((c.fov / 2) * Math.PI / 180) * (9 / 16);
  assert.ok(halfW(cam({ kind: 'closeup', targets: ['mia'] })) > 0.59 + 0.15);
  assert.ok(halfW(cam({ kind: 'push_in', targets: ['mia'] }, 1)) > 0.59 + 0.15);
});

test('closeup picks the three-quarter side that keeps another head out of the line of sight', () => {
  // mia faces leo, who stands 3 studs straight in front of her: the camera must not look through leo.
  const h: Record<string, Vec3> = { mia: [0, 4.5, 0], leo: [0, 4.5, -3] };
  const c = cameraAt({ kind: 'closeup', targets: ['mia'] }, 0, 4, 1, h, set, 7, 'mia', { mia: 0, leo: Math.PI });
  const [ux, uz] = [c.pos[0], c.pos[2]];
  const k = Math.max(0, Math.min(1, (-3 * uz) / (ux * ux + uz * uz)));
  assert.ok(Math.hypot(ux * k, -3 - uz * k) > 1.2, `leo clearance from ${c.pos}`);
});

test('in a room, no shot puts the camera behind a side wall or the back wall', () => {
  const room = { ...set, bounds: { minX: -11.2, maxX: 11.2, maxZ: 8.2 } } as BuiltSet;
  const byWall: Record<string, Vec3> = { mia: [10.5, 4.5, -2], leo: [9, 4.5, 6] };
  for (const kind of ['wide', 'medium', 'closeup', 'push_in', 'two_shot', 'over_shoulder', 'orbit', 'shake'] as const) {
    const targets = kind === 'two_shot' ? ['mia', 'leo'] : ['closeup', 'push_in', 'over_shoulder'].includes(kind) ? ['mia'] : [];
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      for (const u of [0, 0.5, 1]) {
        const c = cameraAt({ kind, targets }, u, 4, 1, byWall, room, 7, 'mia', { mia: yaw, leo: yaw });
        assert.ok(c.pos[0] <= 11.25 && c.pos[0] >= -11.25 && c.pos[2] <= 8.25, `${kind} yaw ${yaw.toFixed(2)} u ${u}: ${c.pos.map((v) => v.toFixed(2))}`);
      }
    }
  }
});

test('a face-on shot near a wall picks the side that stays inside the room', () => {
  const room = { ...set, bounds: { minX: -11.2, maxX: 11.2, maxZ: 8.2 } } as BuiltSet;
  const c = cameraAt({ kind: 'medium', targets: [] }, 0, 4, 1, { mia: [9, 4.5, -2] }, room, 7, 'mia', { mia: 0 });
  assert.ok(c.pos[0] < 9, `camera should be on the room side of the speaker, got x=${c.pos[0].toFixed(2)}`);
});
