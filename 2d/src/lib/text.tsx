import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TextMode } from '../types';

export interface Word { w: string; e: boolean }
// "A [BOMBEIRA] chegou" -> palavras, [..] = destaque
export const parse = (t: string): Word[] => {
  const out: Word[] = [];
  for (const p of t.split(/(\[[^\]]+\])/g).filter(Boolean)) {
    const isE = p.startsWith('[');
    const txt = isE ? p.slice(1, -1) : p;
    let rest = txt;
    if (!isE) {
      const m = rest.match(/^[.,!?…;:]+/);
      if (m && out.length) { out[out.length - 1].w += m[0]; rest = rest.slice(m[0].length); }
    }
    for (const w of rest.split(' ').filter(Boolean)) out.push({ w, e: isE });
  }
  return out;
};

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export const AnimWords: React.FC<{ words: Word[]; starts: number[]; mode: TextMode; accent: string; color?: string; gap?: number }> = ({ words, starts, mode, accent, color = '#fff', gap = 18 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {words.map((x, i) => {
        const lf = f - starts[i];
        const q = clamp(lf / 9);
        const ease = 1 - Math.pow(1 - q, 3);
        const col = x.e ? accent : color;
        const st: React.CSSProperties = { display: 'inline-block', marginRight: gap, color: col, opacity: lf < 0 ? 0 : 1 };
        let txt: React.ReactNode = x.w;
        if (lf >= 0) {
          if (mode === 'slide') Object.assign(st, { opacity: q, transform: `translateY(${(1 - ease) * 46}px)`, filter: `blur(${(1 - ease) * 14}px)` });
          if (mode === 'pop') {
            const s = spring({ frame: lf, fps, config: { damping: 9, stiffness: 190 } });
            Object.assign(st, { opacity: clamp(lf / 3), transform: `scale(${s})` });
          }
          if (mode === 'type') {
            const n = Math.floor(lf * 1.4) + 1;
            txt = <>{x.w.slice(0, n)}<span style={{ opacity: 0 }}>{x.w.slice(n)}</span></>;
          }
          if (mode === 'shake') {
            Object.assign(st, { opacity: q, transform: `translate(${Math.sin(f * 7.3 + i * 2) * 3.5}px, ${Math.cos(f * 6.1 + i) * 3.5}px) scale(${1 + (1 - ease) * 0.4})`, filter: `blur(${(1 - ease) * 8}px)` });
          }
          if (mode === 'glitch') {
            const g = lf < 8 || f % 23 < 2;
            const dx = g ? 7 : 2;
            Object.assign(st, { opacity: lf < 8 && lf % 2 ? 0.3 : 1, transform: g ? `skewX(${Math.sin(f * 3) * 10}deg) translateX(${Math.sin(f * 5) * 5}px)` : 'none', textShadow: `${dx}px 0 #ff2d55, ${-dx}px 0 #00e5ff` });
          }
          if (mode === 'wave') Object.assign(st, { opacity: q, transform: `translateY(${(1 - ease) * 40 + Math.sin(f / 5 + i) * 9}px)` });
        }
        return <span key={i} style={st}>{txt}</span>;
      })}
    </>
  );
};

// instantes de entrada de cada palavra, proporcional ao tamanho
export const wordStarts = (words: Word[], frames: number, lead = 0.0, tail = 0.15) => {
  const total = words.reduce((a, x) => a + x.w.length + 1, 0);
  let acc = 0;
  return words.map((x) => { const s = lead * frames + (acc / total) * frames * (1 - tail - lead); acc += x.w.length + 1; return s; });
};
