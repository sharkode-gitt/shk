import type { Face } from '../../types.ts';
import type { Rect } from './draw.ts';

const INK = '#1b1b22';
const MOUTH_IN = '#7a2a35';
const TONGUE = '#f08a96';
const BLUSH = 'rgba(255,120,130,0.45)';
const TEAR = '#8fd3ff';

/**
 * Simple friendly face: round dark eyes with a white sparkle, a small smile and soft cheeks. Brows appear only
 * when the expression needs them. Same geometry (rect-normalized, features placed for the head-front box) as the
 * classic face. `mouth` is 0 closed, 1 half open, 2 open (speech).
 */
export function drawCuteFace(ctx: CanvasRenderingContext2D, face: Face, mouth: 0 | 1 | 2, rect: Rect, skin: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = skin;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w, rect.h);

  const ex = 0.31, ey = 0.45;
  const big = face === 'shocked' || face === 'scared' ? 1.25 : 1;
  const open = (side: number, squash = 1) => {
    const cx = 0.5 + side * (0.5 - ex), ry = 0.1 * big * squash, rx = 0.08 * big;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    if (squash > 0.5) { // sparkle
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx + rx * 0.3, ey - ry * 0.35, rx * 0.32, rx * 0.32 * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
  };
  const closedHappy = (side: number) => { // ^ shaped happy eye
    const cx = 0.5 + side * (0.5 - ex);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 0.08, ey + 0.03); ctx.quadraticCurveTo(cx, ey - 0.1, cx + 0.08, ey + 0.03); ctx.stroke();
  };
  const brow = (side: number, outerY: number, innerY: number) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.5 + side * 0.31, outerY);
    ctx.lineTo(0.5 + side * 0.12, innerY);
    ctx.stroke();
  };
  const cheeks = () => {
    ctx.fillStyle = BLUSH;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.5 + side * 0.33, 0.64, 0.07, 0.04, 0, 0, Math.PI * 2); ctx.fill(); }
  };
  const smile = (w: number, curve: number, talk: number, dy = 0, tilt = 0) => {
    const y = 0.7 + dy;
    if (talk > 0) { // open mouth, a D shape under the smile line
      ctx.fillStyle = MOUTH_IN;
      ctx.beginPath();
      ctx.moveTo(0.5 - w, y - tilt);
      ctx.quadraticCurveTo(0.5, y + curve, 0.5 + w, y + tilt);
      ctx.quadraticCurveTo(0.5, y + curve + talk * 2.6, 0.5 - w, y - tilt);
      ctx.fill();
      if (talk > 0.08) { ctx.fillStyle = TONGUE; ctx.beginPath(); ctx.ellipse(0.5, y + curve + talk * 1.2, w * 0.45, talk * 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0.5 - w, y - tilt); ctx.quadraticCurveTo(0.5, y + curve, 0.5 + w, y + tilt); ctx.stroke();
  };

  const talk = mouth === 2 ? 0.07 : mouth === 1 ? 0.035 : 0;
  switch (face) {
    case 'neutral': open(-1); open(1); cheeks(); smile(0.13, 0.09, talk); break;
    case 'happy': closedHappy(-1); closedHappy(1); cheeks(); smile(0.16, 0.12, Math.max(talk, 0.04)); break;
    case 'sad': open(-1); open(1); brow(-1, 0.3, 0.26); brow(1, 0.3, 0.26); smile(0.09, -0.07, talk, 0.04); break;
    case 'crying':
      open(-1); open(1); brow(-1, 0.3, 0.26); brow(1, 0.3, 0.26); smile(0.1, -0.08, Math.max(talk, 0.04), 0.04);
      ctx.fillStyle = TEAR;
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.5 + side * (0.5 - ex), ey + 0.2, 0.035, 0.09, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'angry': open(-1, 0.75); open(1, 0.75); brow(-1, 0.26, 0.34); brow(1, 0.26, 0.34); smile(0.1, -0.03, talk, 0.03); break;
    case 'shocked':
      open(-1); open(1); brow(-1, 0.25, 0.22); brow(1, 0.25, 0.22);
      ctx.fillStyle = MOUTH_IN; ctx.beginPath(); ctx.ellipse(0.5, 0.74, 0.07, 0.1, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'smug': open(-1, 0.65); open(1, 0.65); brow(-1, 0.3, 0.32); brow(1, 0.24, 0.3); cheeks(); smile(0.11, 0.04, talk, 0, -0.03); break;
    case 'scared': open(-1); open(1); brow(-1, 0.28, 0.22); brow(1, 0.28, 0.22); smile(0.09, -0.02, Math.max(talk, 0.04)); break;
  }
  ctx.restore();
}
