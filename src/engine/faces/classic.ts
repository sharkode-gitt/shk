import type { Face } from '../../types.ts';
import type { Rect } from './draw.ts';

const INK = '#1a1a1a';
const MOUTH_IN = '#5a1e26';
const TEAR = '#7cc8ff';

/**
 * The simple Roblox "classic" face: two dot eyes and a line smile, with brows, tears and an open mouth for the
 * eight expressions. Everything is in rect-normalized units (0..1 across the head front). `mouth` is 0 closed,
 * 1 half open, 2 open (speech).
 */
export function drawClassicFace(ctx: CanvasRenderingContext2D, face: Face, mouth: 0 | 1 | 2, rect: Rect, skin: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = skin;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w, rect.h);

  const ex = 0.3, ey = 0.46;
  const big = face === 'shocked' || face === 'scared' ? 1.35 : 1;
  const eye = (side: number, squint = 1) => {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0.5 + side * (0.5 - ex), ey, 0.05 * big, 0.075 * big * squint, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const brow = (side: number, outerY: number, innerY: number) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.5 + side * 0.28, outerY);
    ctx.lineTo(0.5 + side * 0.09, innerY);
    ctx.stroke();
  };
  const smile = (w: number, curve: number, open: number, dy = 0, tilt = 0) => {
    const y = 0.74 + dy;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.5 - w, y - tilt);
    ctx.quadraticCurveTo(0.5, y + curve, 0.5 + w, y + tilt);
    ctx.stroke();
    if (open > 0) { // open mouth: the area under the curve
      ctx.fillStyle = MOUTH_IN;
      ctx.beginPath();
      ctx.moveTo(0.5 - w, y - tilt);
      ctx.quadraticCurveTo(0.5, y + curve, 0.5 + w, y + tilt);
      ctx.quadraticCurveTo(0.5, y + curve + open, 0.5 - w, y - tilt);
      ctx.fill();
    }
  };

  const talk = mouth === 2 ? 0.1 : mouth === 1 ? 0.05 : 0;
  switch (face) {
    case 'neutral': eye(-1); eye(1); smile(0.12, 0.0, talk); break;
    case 'happy': eye(-1, 0.8); eye(1, 0.8); smile(0.2, 0.14, Math.max(talk, 0.06)); break;
    case 'sad': eye(-1); eye(1); brow(-1, 0.3, 0.37); brow(1, 0.3, 0.37); smile(0.12, -0.08, talk, 0.04); break;
    case 'crying':
      eye(-1); eye(1); brow(-1, 0.3, 0.37); brow(1, 0.3, 0.37); smile(0.13, -0.09, Math.max(talk, 0.05), 0.04);
      ctx.fillStyle = TEAR;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.5 + side * (0.5 - ex), ey + 0.17, 0.028, 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'angry': eye(-1, 0.75); eye(1, 0.75); brow(-1, 0.28, 0.36); brow(1, 0.28, 0.36); smile(0.13, -0.03, talk, 0.03); break;
    case 'shocked': eye(-1); eye(1); brow(-1, 0.25, 0.22); brow(1, 0.25, 0.22);
      ctx.fillStyle = MOUTH_IN; ctx.beginPath(); ctx.ellipse(0.5, 0.76, 0.07, 0.1, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'smug': eye(-1, 0.7); eye(1, 0.7); brow(-1, 0.3, 0.33); brow(1, 0.24, 0.3); smile(0.13, 0.05, talk, 0, -0.03); break;
    case 'scared': eye(-1); eye(1); brow(-1, 0.28, 0.22); brow(1, 0.28, 0.22); smile(0.13, 0.0, Math.max(talk, 0.05)); break;
  }
  ctx.restore();
}
