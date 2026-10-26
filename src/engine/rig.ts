import * as THREE from 'three';
import heroRig from '../../reference/hero-rig.json' with { type: 'json' };
import type { JointName, PartName, Pose, Vec3 } from '../types.ts';

export const JOINTS = heroRig.joints as Record<JointName, { parent: PartName | 'Root'; child: PartName; pivot: Vec3 }>;
export const PARTS = heroRig.parts as Record<PartName, { center: Vec3; size: Vec3 }>;

export type Rig = {
  root: THREE.Group;
  joints: Record<JointName, THREE.Object3D>;
  parts: Record<PartName, THREE.Object3D>;
};

const jointNames = Object.keys(JOINTS) as JointName[];
// Lowest foot bottom in rig space; subtracted so feet rest on y=0.
const GROUND = Math.min(...Object.values(PARTS).map((p) => p.center[1] - p.size[1] / 2));

/**
 * `parts` and accessory objects must already sit at their neutral-pose position in rig (Studio world)
 * coordinates, either through object.position or through baked vertices. They are re-parented under their
 * joint with the world transform preserved, so the neutral pose looks exactly like the source rig.
 * The rig owns them afterwards (their position.y is shifted down by the ground offset).
 */
export function buildRigFromParts(
  parts: Record<PartName, THREE.Object3D>,
  accessories: { object: THREE.Object3D; attach: PartName }[] = [],
): Rig {
  const root = new THREE.Group();
  const joints = {} as Record<JointName, THREE.Object3D>;
  const pivotOf = (j: JointName) => new THREE.Vector3(...JOINTS[j].pivot).setY(JOINTS[j].pivot[1] - GROUND);

  // Parents are listed before children in the table, but resolve by part name to avoid depending on order.
  const built = new Set<JointName>();
  const build = (name: JointName) => {
    if (built.has(name)) return;
    built.add(name);
    const { parent } = JOINTS[name];
    const parentName = parent === 'Root' ? undefined : jointNames.find((j) => JOINTS[j].child === parent);
    if (parentName) build(parentName);
    const o = new THREE.Object3D();
    o.name = name;
    o.position.copy(pivotOf(name));
    if (parentName) o.position.sub(pivotOf(parentName));
    (parentName ? joints[parentName] : root).add(o);
    joints[name] = o;
  };
  jointNames.forEach(build);
  root.updateMatrixWorld(true);

  for (const j of jointNames) {
    const part = parts[JOINTS[j].child];
    part.name = JOINTS[j].child;
    part.position.y -= GROUND;
    part.updateMatrixWorld(true);
    joints[j].attach(part);
  }
  for (const { object, attach } of accessories) {
    object.position.y -= GROUND;
    object.updateMatrixWorld(true);
    parts[attach].attach(object);
  }
  return { root, joints, parts };
}

export function applyPose(rig: Rig, pose: Pose): void {
  rig.root.position.set(...pose.root.pos);
  rig.root.rotation.set(0, pose.root.yaw, 0);
  for (const j of jointNames) rig.joints[j].rotation.set(...(pose.joints[j] ?? [0, 0, 0]));
}
