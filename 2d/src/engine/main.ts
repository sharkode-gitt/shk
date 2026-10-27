import * as THREE from 'three';
import type { TimeOfDay } from '../types.ts';
import { rosterIdOf } from '../story/cast.ts';
import { buildPuppet, type Puppet } from './puppet.ts';
import { buildProp } from './sets/props.ts';
import type { Prop } from '../types.ts';
import { buildSet } from './sets/index.ts';
import { captionColor } from '../build/captions.ts';
import { sceneState, type ScenePayload, type SetLayout } from './state.ts';

declare global {
  interface Window {
    __hf?: { buildReady?: { scene?: Promise<void> } & Record<string, unknown> } & Record<string, unknown>;
    __hfThreeTime?: number;
  }
}

const W = 1080, H = 1920;
const SKY: Record<TimeOfDay, number> = { morning: 0xcfe6ff, afternoon: 0x9fd0ff, night: 0x141a33 };

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

  // Every cast member is a flat cartoon puppet drawn from its art spec (assets/characters/<id>/character.json) in the 3D set.
  const GENERIC_ART = { skin: '#f0cdc4', shirt: '#6b8cff', pants: '#3a3f58', outline: '#1a1a1f', build: 'slim' as const, hair: { style: 'short' as const, color: '#4a3020' }, accessories: [] as string[] };
  const cast: Record<string, Puppet> = {};
  for (const c of story.cast) {
    const rosterId = rosterIdOf(c);
    const art = rosterId ? payload.roster[rosterId].art : { ...GENERIC_ART, skin: c.look?.skin ?? GENERIC_ART.skin, shirt: c.look?.shirt ?? GENERIC_ART.shirt, pants: c.look?.pants ?? GENERIC_ART.pants };
    cast[c.id] = buildPuppet(art);
    scene.add(cast[c.id].root);
  }

  // Name tags: a sprite under each character's feet that always faces the camera and keeps the same size on screen.
  await document.fonts.load('900 64px Rubik').catch(() => []);
  const tags: Record<string, THREE.Sprite> = {};
  const box = new THREE.Box3();
  const ndc = new THREE.Vector3();
  for (const c of story.cast) {
    const rosterId = rosterIdOf(c);
    const name = rosterId ? payload.roster[rosterId].name : c.name ?? c.id;
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d')!;
    g.font = '900 78px Rubik, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 18; g.strokeStyle = '#000'; g.strokeText(name, 256, 68);
    g.fillStyle = captionColor(c.id, story, 'say', payload.roster); g.fillText(name, 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
    sprite.renderOrder = 10;
    scene.add(sprite);
    tags[c.id] = sprite;
  }

  // Held props hang from the right hand: built once per (character, prop), shown only while held.
  const HELD_SCALE: Partial<Record<Prop, number>> = { backpack: 1.1, gift: 0.9, phone: 1.2, cake: 0.7 };
  const held: Record<string, Partial<Record<Prop, THREE.Object3D>>> = {};
  const hold = (id: string, item: Prop): THREE.Object3D => {
    const mine = (held[id] ??= {});
    if (!mine[item]) {
      const o = buildProp(item);
      const sc = HELD_SCALE[item] ?? 0.8;
      o.scale.setScalar(sc);
      o.position.set(0, item === 'backpack' ? 0.15 : -0.5 * sc, 0.25);
      o.traverse((m) => { m.castShadow = true; });
      cast[id].hand.add(o);
      mine[item] = o;
    }
    return mine[item]!;
  };

  const right = new THREE.Vector3(), facing = new THREE.Vector3();
  return (t: number) => {
    const s = sceneState(t, payload, layout);
    for (const [i, set] of Object.entries(layout)) set.group.visible = Number(i) === s.sceneIndex;
    scene.background = new THREE.Color(SKY[timeline.scenes[s.sceneIndex].time]);
    camera.position.set(...s.camera.pos);
    camera.fov = s.camera.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(...s.camera.target);
    camera.updateMatrixWorld(true);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const [id, pose] of Object.entries(s.poses)) {
      const p = cast[id];
      p.root.position.set(...pose.root.pos);
      p.faceCamera(camera);
      // Which way the character looks, as pupils on a front-facing face: along the camera's right vector.
      facing.set(-Math.sin(pose.root.yaw), 0, -Math.cos(pose.root.yaw));
      p.apply(pose, pose.face, pose.mouth, Math.max(-2, Math.min(2, Math.round(facing.dot(right) * 2.4))));
    }
    for (const [id, item] of Object.entries(s.items)) {
      for (const o of Object.values(held[id] ?? {})) o!.visible = false;
      if (item) hold(id, item).visible = true;
    }
    const unit = 2 * Math.tan((camera.fov * Math.PI) / 360); // world height of the frame at distance 1
    for (const [id, tag] of Object.entries(tags)) {
      cast[id].root.updateMatrixWorld(true);
      box.setFromObject(cast[id].root);
      tag.position.set((box.min.x + box.max.x) / 2, box.min.y - 0.7, (box.min.z + box.max.z) / 2);
      const dist = camera.position.distanceTo(tag.position);
      const h = dist * unit * 0.04;
      tag.scale.set(h * 4, h, 1);
      // Only while the whole character is small on screen (close-ups are named by the caption) and the feet are in frame.
      ndc.copy(tag.position).project(camera);
      tag.visible = (box.max.y - box.min.y) / (dist * unit) < 0.65 && Math.abs(ndc.x) < 0.9 && ndc.y > -0.9 && ndc.y < 0.9;
    }
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
