import * as THREE from 'three';
import type { TimeOfDay } from '../types.ts';
import { buildBlockCharacter } from './characters/block.ts';
import { loadCharacter } from './characters/model.ts';
import { rosterIdOf } from '../story/cast.ts';
import { FaceTexture } from './faces/texture.ts';
import { applyPose, JOINTS, PARTS, type Rig } from './rig.ts';
import { buildProp } from './sets/props.ts';
import type { Prop } from '../types.ts';
import { buildSet } from './sets/index.ts';
import { sceneState, type ScenePayload, type SetLayout } from './state.ts';

declare global {
  interface Window {
    __hf?: { buildReady?: { scene?: Promise<void> } & Record<string, unknown> } & Record<string, unknown>;
    __hfThreeTime?: number;
  }
}

const W = 1080, H = 1920;
const SKY: Record<TimeOfDay, number> = { morning: 0xcfe6ff, afternoon: 0x9fd0ff, night: 0x141a33 };
const DEFAULT_SKIN = '#f0cdc4';

/** Block characters' face: a skin-filled 256x256 canvas, the whole canvas being the head front. */
function blockFace(skin: string): FaceTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const face = new FaceTexture(c, { x: 0, y: 0, w: 256, h: 256 }, skin);
  face.set('neutral', 0);
  return face;
}

async function build(): Promise<(t: number) => void> {
  const payload = JSON.parse(document.getElementById('scene')!.textContent!) as ScenePayload;
  const { story, timeline } = payload;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  (document.getElementById('stage') ?? document.body).appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 500);

  const layout: SetLayout = {};
  for (const s of timeline.scenes) {
    layout[s.index] = buildSet(s.set, s.time);
    layout[s.index].group.visible = false;
    scene.add(layout[s.index].group);
  }

  // Roster characters are loaded once from characters/<id>/ (each has its own model, textures and face style).
  const loaded: Record<string, { rig: Rig; face: FaceTexture }> = {};
  await Promise.all(Object.entries(payload.roster).map(async ([id, info]) => {
    loaded[id] = await loadCharacter(new URL(`characters/${id}/`, location.href).href, info);
  }));
  const cast: Record<string, { rig: Rig; face: FaceTexture }> = {};
  for (const c of story.cast) {
    const rosterId = rosterIdOf(c);
    if (rosterId) cast[c.id] = loaded[rosterId];
    else {
      const face = blockFace(c.look!.skin ?? DEFAULT_SKIN);
      const rig = buildBlockCharacter(c.look!, { faceMap: face.texture });
      rig.root.traverse((o) => { o.castShadow = o.receiveShadow = true; });
      cast[c.id] = { rig, face };
    }
    scene.add(cast[c.id].rig.root);
  }

  // Held props hang from the right wrist: built once per (character, prop), shown only while held.
  const HELD_SCALE: Partial<Record<Prop, number>> = { backpack: 0.8, gift: 0.7, phone: 1, cake: 0.6 };
  const held: Record<string, Partial<Record<Prop, THREE.Object3D>>> = {};
  const hold = (id: string, item: Prop): THREE.Object3D => {
    const mine = (held[id] ??= {});
    if (!mine[item]) {
      const o = buildProp(item);
      const hand = PARTS.RightHand, wrist = JOINTS.RightWrist.pivot;
      const sc = HELD_SCALE[item] ?? 0.7;
      o.scale.setScalar(sc);
      // hand centre relative to the wrist pivot; the prop sits just under it, as if gripped by the handle
      o.position.set(hand.center[0] - wrist[0], hand.center[1] - wrist[1] - hand.size[1] / 2 - 0.5 * sc, hand.center[2] - wrist[2]);
      o.traverse((m) => { m.castShadow = true; });
      cast[id].rig.joints.RightWrist.add(o);
      mine[item] = o;
    }
    return mine[item]!;
  };

  return (t: number) => {
    const s = sceneState(t, payload, layout);
    for (const [i, set] of Object.entries(layout)) set.group.visible = Number(i) === s.sceneIndex;
    scene.background = new THREE.Color(SKY[timeline.scenes[s.sceneIndex].time]);
    for (const [id, pose] of Object.entries(s.poses)) {
      applyPose(cast[id].rig, pose);
      cast[id].face.set(pose.face, pose.mouth);
    }
    for (const [id, item] of Object.entries(s.items)) {
      for (const o of Object.values(held[id] ?? {})) o!.visible = false;
      if (item) hold(id, item).visible = true;
    }
    camera.position.set(...s.camera.pos);
    camera.fov = s.camera.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...s.camera.target);
    renderer.render(scene, camera);
  };
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
const ready = build();
window.__hf.buildReady.scene = ready.then((renderAt) => {
  window.addEventListener('hf-seek', (e) => renderAt((e as CustomEvent<{ time: number }>).detail.time));
  renderAt(window.__hfThreeTime || 0);
});
