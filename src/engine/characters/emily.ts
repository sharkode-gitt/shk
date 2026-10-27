import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { PartName } from '../../types.ts';
import { EMILY_FACE_RECT, FaceTexture } from '../faces/texture.ts';
import { buildRigFromParts, type Rig } from '../rig.ts';

type PartsJson = {
  offset: [number, number, number];
  groups: Record<string, { part: PartName } | { accessory: string; attach: PartName }>;
};

const SKIN = '#f0cdc4'; // the atlas' skin colour, measured from Hero1_diff.png
/**
 * Accessories whose UVs use the top-left origin (no flipY). Seen on a render: with flipY the crown samples the
 * black top band of Handle2_diff.png and renders black; the hair and bag are correct only with flipY.
 */
const UNFLIPPED = new Set(['crown']);

/**
 * Loads Emily from `${baseUrl}emily.obj/.mtl/parts.json` (baseUrl ends with "/"). Every Hero* group uses the
 * body atlas, which is swapped for a FaceTexture so the face block can be redrawn per expression.
 * Resolves only once every texture is loaded, so the first frame is complete.
 */
export async function loadEmily(baseUrl: string): Promise<{ rig: Rig; face: FaceTexture }> {
  const [map, mtl, obj, atlas] = await Promise.all([
    fetch(`${baseUrl}parts.json`).then((r) => r.json() as Promise<PartsJson>),
    new MTLLoader().setPath(baseUrl).loadAsync('emily.mtl'),
    new OBJLoader().setPath(baseUrl).loadAsync('emily.obj'),
    new THREE.ImageLoader().loadAsync(`${baseUrl}Hero1_diff.png`),
  ]);
  const face = new FaceTexture(atlas, EMILY_FACE_RECT, SKIN);
  face.set('neutral', 0);
  // The MTL is only read for texture names: its Kd tints textures skin-coloured, and MTLLoader's own
  // textures load in the background with no way to await them.
  const textures = new THREE.TextureLoader().setPath(baseUrl);
  const textureOf = async (mesh: THREE.Mesh, accessory: string) => {
    const file = mtl.materialsInfo[(mesh.material as THREE.Material).name]?.map_kd;
    if (!file) return null;
    const t = await textures.loadAsync(file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = !UNFLIPPED.has(accessory);
    return t;
  };

  const parts = {} as Record<PartName, THREE.Object3D>;
  const accessories: { object: THREE.Object3D; attach: PartName }[] = [];
  await Promise.all((obj.children as THREE.Mesh[]).map(async (mesh) => {
    const g = map.groups[mesh.name];
    if (!g) return;
    const tex = 'part' in g ? face.texture : await textureOf(mesh, g.accessory);
    mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.add(new THREE.Vector3(...map.offset));
    if ('part' in g) parts[g.part] = mesh;
    else accessories.push({ object: mesh, attach: g.attach });
  }));
  return { rig: buildRigFromParts(parts, accessories), face };
}
