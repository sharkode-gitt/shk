import * as THREE from 'three';
import type { Face } from '../../types.ts';
import { drawClassicFace } from './classic.ts';
import { drawFace, type Rect } from './draw.ts';

export type FaceStyle = 'emily' | 'classic' | 'none';

/**
 * Head-front UV box of the Head mesh (Hero10) in assets/emily/Hero1_diff.png (916×568).
 * It holds every pixel of the original face (161..358 × 362..495) and lies inside the skin block.
 */
export const EMILY_FACE_RECT: Rect = { x: 147, y: 293, w: 226, h: 247 };

/** The atlas on a canvas whose face block is redrawn when the expression changes. */
export class FaceTexture {
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly rect: Rect;
  private readonly skin: string;
  private readonly style: FaceStyle;
  private current = '';

  constructor(atlas: HTMLImageElement | HTMLCanvasElement, rect: Rect, skin: string, style: FaceStyle = 'emily') {
    const canvas = document.createElement('canvas');
    canvas.width = atlas.width;
    canvas.height = atlas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('FaceTexture: no 2d context');
    // A face that is a decal on a coloured head has a transparent background: paint the skin first.
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(atlas, 0, 0);
    this.ctx = ctx;
    this.rect = rect;
    this.skin = skin;
    this.style = style;
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  set(face: Face, mouth: 0 | 1 | 2): void {
    if (this.style === 'none') return; // the model's own face stays as it is
    const key = `${face}/${mouth}`;
    if (key === this.current) return;
    this.current = key;
    (this.style === 'classic' ? drawClassicFace : drawFace)(this.ctx, face, mouth, this.rect, this.skin);
    this.texture.needsUpdate = true;
  }
}
