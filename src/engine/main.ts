import * as THREE from 'three';
import type { TimeOfDay } from '../types.ts';
import { buildBlockCharacter } from './characters/block.ts';
import { loadEmily } from './characters/emily.ts';
import { FaceTexture } from './faces/texture.ts';
import { applyPose, type Rig } from './rig.ts';
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

  const emily = await loadEmily(new URL('emily/', location.href).href);
  const cast: Record<string, { rig: Rig; face: FaceTexture }> = {};
  for (const c of story.cast) {
    if (c.ref === 'hero') cast[c.id] = emily;
    else {
      const face = blockFace(c.look!.skin ?? DEFAULT_SKIN);
      const rig = buildBlockCharacter(c.look!, { faceMap: face.texture });
      rig.root.traverse((o) => { o.castShadow = o.receiveShadow = true; });
      cast[c.id] = { rig, face };
    }
    scene.add(cast[c.id].rig.root);
  }

  return (t: number) => {
    const s = sceneState(t, payload, layout);
    for (const [i, set] of Object.entries(layout)) set.group.visible = Number(i) === s.sceneIndex;
    scene.background = new THREE.Color(SKY[timeline.scenes[s.sceneIndex].time]);
    for (const [id, pose] of Object.entries(s.poses)) {
      applyPose(cast[id].rig, pose);
      cast[id].face.set(pose.face, pose.mouth);
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
