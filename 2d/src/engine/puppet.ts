import * as THREE from 'three';
import type { Face, Pose } from '../types.ts';
import { drawHand, drawHead, drawLimb, drawShoe, drawTorso, HEAD, PX, TORSO, type Art } from './art2d.ts';

/** Measures in studs; the character is about 7 tall, like the 3D rigs, so the cameras frame it the same way. */
const HIP_Y = 2.45, SHOULDER_Y = 4.7, SHOULDER_X = 1.0, HIP_X = 0.55, ARM = 1.0, FOREARM = 0.95, LEG = 2.2;

export type Puppet = {
  /** Add to the scene; set `.position`, and turn it with `faceCamera`. */
  root: THREE.Group;
  /** Where props are held (the right hand, which is on the left of the screen). */
  hand: THREE.Object3D;
  apply(pose: Pose, face: Face, mouth: 0 | 1 | 2, look: number): void;
  faceCamera(camera: THREE.Camera): void;
};

const mat = (tex: THREE.Texture) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, toneMapped: false, side: THREE.DoubleSide });
const texOf = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** A plane `w x h` studs whose pivot is at its top centre (limbs hang from it) or its centre. */
function plane(tex: THREE.Texture, w: number, h: number, hang = false): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h);
  if (hang) g.translate(0, -h / 2, 0);
  return new THREE.Mesh(g, mat(tex));
}

export function buildPuppet(art: Art): Puppet {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  let z = 0;
  const layer = (o: THREE.Object3D) => { o.position.z = (z += 0.02); return o; };

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(1.1, 0.55, 1);
  root.add(shadow);

  const limbTex = { arm: texOf(drawLimb(art.shirt, art.outline)), leg: texOf(drawLimb(art.pants, art.outline)) };
  const handTex = texOf(drawHand(art.skin, art.outline)), shoeTex = texOf(drawShoe('#2b2b33', art.outline));
  const side = (s: 1 | -1) => {
    const hip = new THREE.Group(); hip.position.set(s * HIP_X, HIP_Y, 0);
    const legRod = layer(plane(limbTex.leg, 0.72, LEG, true)) as THREE.Mesh; hip.add(legRod);
    const shoe = layer(plane(shoeTex, 0.9, 0.5)) as THREE.Mesh; shoe.position.z = 0.1; hip.add(shoe);
    const shoulder = new THREE.Group(); shoulder.position.set(s * SHOULDER_X, SHOULDER_Y, 0);
    const upper = layer(plane(limbTex.arm, 0.7, ARM, true)) as THREE.Mesh; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -ARM; shoulder.add(elbow);
    const fore = layer(plane(limbTex.arm, 0.66, FOREARM, true)) as THREE.Mesh; fore.position.z += 0.04; elbow.add(fore);
    const hand = new THREE.Group(); hand.position.set(0, -FOREARM, 0.1); elbow.add(hand);
    const hm = plane(handTex, 0.62, 0.62); hand.add(hm);
    return { hip, legRod, shoe, shoulder, upper, elbow, hand };
  };
  const R = side(-1), L = side(1); // the character's right arm and leg are on the left of the screen

  const torso = layer(plane(texOf(drawTorso(art)), TORSO.w / PX, TORSO.h / PX));
  torso.position.set(0, 3.65, torso.position.z + 0.2);
  const head = new THREE.Group(); head.position.set(0, 5.5 + 0.5 - 0.5, 0); // plane centre; the face sits 0.5 stud above it
  const headMesh = plane(texOf(drawHead(art, 'neutral', 0, 0)), HEAD.w / PX, HEAD.h / PX);
  headMesh.position.z = 0.5;
  head.add(headMesh);
  head.position.set(0, 5.5, 0);
  // Back to front: legs, torso, arms, head.
  body.add(R.hip, L.hip, torso, R.shoulder, L.shoulder, head);
  R.shoulder.position.z = 0.35; L.shoulder.position.z = 0.35;

  const headTex = new Map<string, THREE.Texture>();
  let lastKey = '';
  const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  function arm(a: ReturnType<typeof side>, s: 1 | -1, sh: number[] = [0, 0, 0], el: number[] = [0, 0, 0]) {
    const out = s === 1 ? -sh[2] : sh[2]; // sideways raise, positive = away from the body
    const theta = (out + 0.25 * sh[0]) * s; // +x on the right-hand side of the screen
    const shrink = lim(Math.cos(sh[0] * 0.9), 0.5, 1);
    a.shoulder.rotation.z = theta;
    a.upper.scale.y = shrink;
    a.elbow.position.y = -ARM * shrink;
    a.elbow.rotation.z = -s * lim(el[0], -0.5, 2.2) * 0.8 + el[2] * s;
  }
  function leg(l: ReturnType<typeof side>, s: 1 | -1, hipX = 0, knee = 0) {
    const lift = Math.max(0, -knee) * 0.45;
    const len = LEG * (1 - 0.45 * Math.abs(Math.sin(hipX))) - lift;
    l.legRod.scale.y = len / LEG;
    l.legRod.rotation.z = 0;
    l.shoe.position.set(s * 0.08, -len - 0.1, l.shoe.position.z);
  }

  return {
    root,
    hand: R.hand,
    apply(pose, face, mouth, look) {
      const j = pose.joints;
      arm(R, -1, j.RightShoulder, j.RightElbow);
      arm(L, 1, j.LeftShoulder, j.LeftElbow);
      leg(R, -1, j.RightHip?.[0], j.RightKnee?.[0]);
      leg(L, 1, j.LeftHip?.[0], j.LeftKnee?.[0]);
      const rx = j.Root?.[0] ?? 0;
      const lying = lim(Math.abs(rx) / 1.57, 0, 1);
      body.rotation.z = lying * Math.sign(rx) * (Math.PI / 2) * 0.95;
      body.position.y = lying * 1.1;
      head.rotation.z = -(j.Neck?.[2] ?? 0) * 0.8;
      body.scale.setScalar(1);
      const key = `${face}|${mouth}|${look}`;
      if (key !== lastKey) {
        lastKey = key;
        if (!headTex.has(key)) headTex.set(key, texOf(drawHead(art, face, mouth, look)));
        (headMesh.material as THREE.MeshBasicMaterial).map = headTex.get(key)!;
      }
    },
    faceCamera(camera) {
      root.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z);
    },
  };
}
