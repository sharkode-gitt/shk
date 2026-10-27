import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { CharacterInfo } from '../../characters/roster.ts';
import type { PartName } from '../../types.ts';
import { FaceTexture } from '../faces/texture.ts';
import { buildRigFromParts, type Rig } from '../rig.ts';

type PartsJson = {
  offset: [number, number, number];
  groups: Record<string, { part: PartName } | { accessory: string; attach: PartName }>;
};

/**
 * Loads a roster character from `${baseUrl}` (ends with "/"): the OBJ and MTL named in `info.model`, plus
 * `parts.json`, which says which OBJ group is which body part or accessory. Every body-part group shares the
 * body atlas, which is swapped for a FaceTexture so the face block can be redrawn per expression.
 * Resolves only once every texture is loaded, so the first frame is complete.
 */
export async function loadCharacter(baseUrl: string, info: CharacterInfo): Promise<{ rig: Rig; face: FaceTexture }> {
  const m = info.model;
  const [map, mtl, obj, atlas] = await Promise.all([
    fetch(`${baseUrl}parts.json`).then((r) => r.json() as Promise<PartsJson>),
    new MTLLoader().setPath(baseUrl).loadAsync(m.mtl),
    new OBJLoader().setPath(baseUrl).loadAsync(m.obj),
    new THREE.ImageLoader().loadAsync(`${baseUrl}${m.atlas}`),
  ]);
  const face = new FaceTexture(atlas, m.face.rect, m.face.skin, m.face.style);
  face.set('neutral', 0);
  // The MTL is only read for texture names (the skin colour is already baked into the textures), and MTLLoader's own
  // textures load in the background with no way to await them.
  const textures = new THREE.TextureLoader().setPath(baseUrl);
  const unflipped = new Set(m.unflipped);
  const textureOf = async (mesh: THREE.Mesh, accessory: string) => {
    const file = mtl.materialsInfo[(mesh.material as THREE.Material).name]?.map_kd;
    if (!file) return null;
    const t = await textures.loadAsync(file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = !unflipped.has(accessory);
    return t;
  };

  // Body parts on the head's atlas share the face texture; a part with a texture of its own (a head or body that is not on
  // the atlas) loads that one.
  const fileOf = (mesh: THREE.Mesh) => mtl.materialsInfo[(mesh.material as THREE.Material).name]?.map_kd;
  const parts = {} as Record<PartName, THREE.Object3D>;
  const accessories: { object: THREE.Object3D; attach: PartName }[] = [];
  await Promise.all((obj.children as THREE.Mesh[]).map(async (mesh) => {
    const g = map.groups[mesh.name];
    if (!g) return;
    const file = fileOf(mesh);
    const tex = 'part' in g ? (!file || file === m.atlas ? face.texture : await textureOf(mesh, 'body')) : await textureOf(mesh, g.accessory);
    mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.add(new THREE.Vector3(...map.offset));
    if ('part' in g) parts[g.part] = mesh;
    else accessories.push({ object: mesh, attach: g.attach });
  }));
  return { rig: buildRigFromParts(parts, accessories), face };
}
