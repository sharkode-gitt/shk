import * as THREE from 'three';
import { buildRigFromParts, JOINTS, PARTS, type Rig } from '../rig.ts';
import type { JointName, Look, PartName } from '../../types.ts';

const SKIN = '#f0cdc4';
const HAIR_COLOR = '#4a3222';
const HEAD = PARTS.Head;
const TOP = HEAD.center[1] + HEAD.size[1] / 2; // y of the top of the head
const [HX, , HZ] = HEAD.center;

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });

// Boxes in rig (world) coordinates; characters face -Z, so the back of the head is +Z.
function group(color: string, boxes: [size: Vec, at: Vec][]): THREE.Group {
  const g = new THREE.Group();
  const m = mat(color);
  for (const [size, at] of boxes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(...size), m);
    b.position.set(...at);
    g.add(b);
  }
  return g;
}
type Vec = [number, number, number];

const W = HEAD.size[0];
const D = HEAD.size[2];
const cap = (h: number): [Vec, Vec] => [[W + 0.1, h, D + 0.1], [HX, TOP + h / 2 - 0.02, HZ]];

export function buildHair(hair: Look['hair']): THREE.Object3D | null {
  switch (hair) {
    case 'bald': return null;
    case 'short': return group(HAIR_COLOR, [cap(0.25)]);
    case 'long': return group(HAIR_COLOR, [cap(0.25), [[W + 0.1, 1.5, 0.3], [HX, TOP - 0.7, HZ + D / 2 + 0.1]]]);
    case 'pigtails': return group(HAIR_COLOR, [cap(0.25), [[0.3, 1, 0.3], [HX - W / 2 - 0.25, TOP - 0.6, HZ]], [[0.3, 1, 0.3], [HX + W / 2 + 0.25, TOP - 0.6, HZ]]]);
    case 'bun': return group(HAIR_COLOR, [cap(0.25), [[0.5, 0.5, 0.5], [HX, TOP + 0.5, HZ]]]);
    case 'spiky': return group(HAIR_COLOR, [cap(0.2), ...[-0.35, 0, 0.35].map((x): [Vec, Vec] => [[0.25, 0.45, 0.25], [HX + x, TOP + 0.35, HZ]])]);
  }
}

export function buildHat(hat: Look['hat']): THREE.Object3D | null {
  switch (hat) {
    case null: return null;
    case 'cap': return group('#2f5fb3', [[[W + 0.2, 0.3, D + 0.2], [HX, TOP + 0.1, HZ]], [[W + 0.2, 0.08, 0.5], [HX, TOP - 0.05, HZ - D / 2 - 0.3]]]);
    case 'crown': return group('#f5c518', [[[W, 0.25, D], [HX, TOP + 0.12, HZ]], ...[-0.4, 0, 0.4].map((x): [Vec, Vec] => [[0.18, 0.28, 0.18], [HX + x, TOP + 0.38, HZ]])]);
    case 'beanie': return group('#c0392b', [[[W + 0.2, 0.45, D + 0.2], [HX, TOP + 0.15, HZ]]]);
    case 'bow': return group('#e84393', [[[0.3, 0.3, 0.2], [HX - 0.25, TOP + 0.2, HZ - 0.3]], [[0.3, 0.3, 0.2], [HX + 0.25, TOP + 0.2, HZ - 0.3]], [[0.15, 0.15, 0.2], [HX, TOP + 0.2, HZ - 0.3]]]);
    case 'glasses': return group('#222222', [[[0.4, 0.3, 0.06], [HX - 0.28, HEAD.center[1] + 0.1, HZ - D / 2 - 0.03]], [[0.4, 0.3, 0.06], [HX + 0.28, HEAD.center[1] + 0.1, HZ - D / 2 - 0.03]]]);
  }
}

const SHIRT: PartName[] = ['UpperTorso', 'LowerTorso', 'LeftUpperArm', 'RightUpperArm'];
const PANTS: PartName[] = ['LeftUpperLeg', 'RightUpperLeg', 'LeftLowerLeg', 'RightLowerLeg'];

const GROUND_Y = Math.min(...Object.values(PARTS).map((p) => p.center[1] - p.size[1] / 2));
const pivot = (j: JointName) => new THREE.Vector3(...JOINTS[j].pivot);
const UP = new THREE.Vector3(0, 1, 0);

/** Box of cross-section w x d whose Y axis runs from `a` to `b` (rig world coordinates). */
function limb(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, material: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, dir.length(), d), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

/**
 * Limbs are built from the joint pivots (Emily's mesh boxes are A-posed and would leave stubs and gaps):
 * each segment runs pivot to pivot, hands continue 0.5 past the wrist, feet go from the ankle to the ground
 * and reach further toward -Z (the front). Head and torso keep Emily's boxes.
 */
function limbs(side: 'Left' | 'Right', m: (part: PartName) => THREE.Material): Partial<Record<PartName, THREE.Mesh>> {
  const [sh, el, wr, hip, kn, an] = (['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle'] as const).map((j) => pivot(`${side}${j}`));
  const hand = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.5));
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.65, an.y - GROUND_Y, 1.0), m(`${side}Foot`));
  foot.position.set(an.x, (an.y + GROUND_Y) / 2, an.z - 0.15);
  return {
    [`${side}UpperArm`]: limb(sh, el, 0.6, 0.6, m(`${side}UpperArm`)),
    [`${side}LowerArm`]: limb(el, wr, 0.6, 0.6, m(`${side}LowerArm`)),
    [`${side}Hand`]: limb(wr, hand, 0.55, 0.55, m(`${side}Hand`)),
    [`${side}UpperLeg`]: limb(hip, kn, 0.65, 0.65, m(`${side}UpperLeg`)),
    [`${side}LowerLeg`]: limb(kn, an, 0.65, 0.65, m(`${side}LowerLeg`)),
    [`${side}Foot`]: foot,
  };
}

/** With `faceMap`, only the head's front (-Z, BoxGeometry index 5) gets the texture; the rest stay skin. */
export function buildBlockCharacter(look: Look, opts: { faceMap?: THREE.Texture } = {}): Rig {
  const skin = look.skin ?? SKIN;
  const colorOf = (name: PartName) => (SHIRT.includes(name) ? look.shirt : PANTS.includes(name) ? look.pants : skin);
  const m = (name: PartName) => mat(colorOf(name));
  const parts = { ...limbs('Left', m), ...limbs('Right', m) } as Record<PartName, THREE.Object3D>;
  for (const name of ['Head', 'UpperTorso', 'LowerTorso'] as const) {
    const p = PARTS[name];
    let material: THREE.Material | THREE.Material[] = m(name);
    if (name === 'Head' && opts.faceMap) {
      const face = mat('#ffffff');
      face.map = opts.faceMap;
      material = [0, 1, 2, 3, 4].map(() => mat(skin)).concat(face);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), material);
    mesh.position.set(...p.center);
    parts[name] = mesh;
  }
  const accessories = [buildHair(look.hair), buildHat(look.hat)]
    .filter((object): object is THREE.Object3D => object !== null)
    .map((object) => ({ object, attach: 'Head' as const }));
  return buildRigFromParts(parts, accessories);
}
