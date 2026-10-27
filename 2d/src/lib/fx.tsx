import React from 'react';
import { H, W } from '../types';

const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const abs: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

export const Fog: React.FC<{ f: number; amount?: number; y?: number }> = ({ f, amount = 0.5, y = 900 }) => (
  <div style={{ ...abs, overflow: 'hidden' }}>
    {[0, 1, 2, 3, 4].map((i) => {
      const speed = 0.35 + i * 0.12;
      const x = ((f * speed * (i % 2 ? -1 : 1) + i * 520) % 2400) - 700;
      return (
        <div key={i} style={{ position: 'absolute', left: x, top: y + i * 150 - 260, width: 1500, height: 520, opacity: amount * (0.55 + 0.15 * i),
          background: 'radial-gradient(ellipse at center, rgba(190,205,225,.55) 0%, rgba(190,205,225,.22) 40%, rgba(190,205,225,0) 70%)' }} />
      );
    })}
  </div>
);

export const Dust: React.FC<{ f: number; n?: number }> = ({ f, n = 34 }) => (
  <svg width={W} height={H} style={abs}>
    {Array.from({ length: n }).map((_, i) => {
      const x = (hash(i) * W + f * (0.25 + hash(i + 9) * 0.5) * 1.2) % W;
      const y = (hash(i + 3) * H - f * (0.3 + hash(i + 5) * 0.6) + H * 2) % H;
      const r = 1.5 + hash(i + 7) * 3.5;
      const tw = 0.35 + 0.35 * Math.sin(f / 15 + i);
      return <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={tw * 0.6} />;
    })}
  </svg>
);

export const Grain: React.FC<{ f: number }> = ({ f }) => (
  <svg width={W} height={H} style={{ ...abs, mixBlendMode: 'overlay', opacity: 0.16 }}>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={f % 9} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width={W} height={H} filter="url(#grain)" />
  </svg>
);

// pisca de lampada: 1 = luz normal, <1 = escurecido
export const flickerLevel = (f: number) => {
  const k = Math.floor(f / 3);
  const r = hash(k);
  return r > 0.93 ? 0.25 : r > 0.86 ? 0.65 : 1;
};
export const Flicker: React.FC<{ f: number }> = ({ f }) => <div style={{ ...abs, background: '#000', opacity: (1 - flickerLevel(f)) * 0.55 }} />;

export const Vignette: React.FC = () => (
  <div style={{ ...abs, background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 100%)' }} />
);
