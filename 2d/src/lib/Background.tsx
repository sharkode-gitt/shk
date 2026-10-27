import React from 'react';
import { W, H } from '../types';

const Rays: React.FC<{ x?: number }> = ({ x = 700 }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
    <defs>
      <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <polygon points={`${x - 120},0 ${x + 40},0 ${x - 280},${H} ${x - 620},${H}`} fill="url(#ray)" />
  </svg>
);

const Floor: React.FC<{ c1: string; c2: string; y?: number }> = ({ c1, c2, y = 1250 }) => (
  <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
    <rect y={y} width={W} height={H - y} fill={c1} />
    {Array.from({ length: 9 }).map((_, i) => (
      <rect key={i} y={y + i * 90} width={W} height="6" fill={c2} opacity="0.5" />
    ))}
  </svg>
);

export const Background: React.FC<{ id: string }> = ({ id }) => {
  const base: React.CSSProperties = { position: 'absolute', inset: 0 };
  if (id === 'escola')
    return (
      <div style={{ ...base, background: 'linear-gradient(#f3e3b0, #e2c98a)' }}>
        <svg width={W} height={H} style={base}>
          <rect x="300" y="250" width="480" height="70" rx="10" fill="#e2574c" />
          {['#6ec1e4', '#f28ab2', '#8fdc8f', '#f2c14e', '#b39ddb', '#f4a259', '#6ec1e4', '#f28ab2'].map((c, i) => (
            <g key={i}>
              <rect x={-40 + i * 150} y={420} width="140" height="800" fill={c} stroke="#00000030" strokeWidth="6" />
              <rect x={-20 + i * 150} y={520} width="100" height="10" fill="#00000033" />
              <rect x={90 + i * 150} y={760} width="14" height="70" rx="6" fill="#ffffffcc" />
            </g>
          ))}
        </svg>
        <Floor c1="#cfc9bd" c2="#aaa392" />
      </div>
    );
  if (id === 'aula')
    return (
      <div style={{ ...base, background: 'linear-gradient(#f6ecc9, #e3d3a2)' }}>
        <svg width={W} height={H} style={base}>
          <rect x="120" y="260" width="840" height="470" rx="14" fill="#2f5d50" stroke="#8a5a2b" strokeWidth="18" />
          <text x="540" y="520" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="800" fontSize="110" fill="#ffffffcc">ABC 123</text>
          <rect x="60" y="960" width="300" height="20" fill="#b9854a" /><rect x="720" y="960" width="300" height="20" fill="#b9854a" />
        </svg>
        <Floor c1="#c99f6a" c2="#a07a48" />
      </div>
    );
  if (id === 'parque')
    return (
      <div style={{ ...base, background: 'linear-gradient(#8fd3ff, #d9f2ff)' }}>
        <svg width={W} height={H} style={base}>
          <circle cx="880" cy="260" r="90" fill="#ffe27a" />
          <ellipse cx="260" cy="320" rx="150" ry="46" fill="#fff" /><ellipse cx="400" cy="300" rx="110" ry="40" fill="#fff" />
          <rect x="120" y="760" width="40" height="500" fill="#8a5a2b" /><circle cx="140" cy="700" r="150" fill="#4caf50" /><circle cx="60" cy="780" r="110" fill="#66bb6a" />
          <rect x="900" y="800" width="40" height="460" fill="#8a5a2b" /><circle cx="920" cy="740" r="140" fill="#43a047" />
          <rect x="360" y="1080" width="360" height="24" rx="8" fill="#b9854a" /><rect x="380" y="1104" width="20" height="80" fill="#8a5a2b" /><rect x="680" y="1104" width="20" height="80" fill="#8a5a2b" />
        </svg>
        <Floor c1="#6fbf5a" c2="#5aa84a" />
      </div>
    );
  if (id === 'porta')
    return (
      <div style={{ ...base, background: 'radial-gradient(ellipse at 50% 35%, #6b4a38 0%, #3b261b 70%, #21150f 100%)' }}>
        <svg width={W} height={H} style={base}>
          <rect x="300" y="380" width="480" height="880" fill="#4a2f21" stroke="#2b1a12" strokeWidth="14" />
          <rect x="340" y="430" width="400" height="360" fill="#573726" />
          <rect x="340" y="830" width="400" height="360" fill="#573726" />
          <circle cx="710" cy="860" r="18" fill="#d9a441" />
        </svg>
        <Floor c1="#2a1a12" c2="#120a06" />
        <Rays />
      </div>
    );
  if (id === 'sala')
    return (
      <div style={{ ...base, background: 'linear-gradient(#cdb79a, #a98f6c)' }}>
        <svg width={W} height={H} style={base}>
          <rect x="650" y="300" width="300" height="420" fill="#f4f8ff" stroke="#6a4a30" strokeWidth="16" />
          <rect x="60" y="860" width="460" height="260" rx="40" fill="#7b5a82" />
          <rect x="40" y="800" width="500" height="120" rx="40" fill="#6a4c70" />
        </svg>
        <Floor c1="#8a6a43" c2="#5f4529" y={1200} />
        <Rays x={820} />
      </div>
    );
  if (id === 'corredor')
    return (
      <div style={{ ...base, background: 'linear-gradient(#2e3340, #14161d)' }}>
        <svg width={W} height={H} style={base}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={120 + i * 300} y={500} width="180" height="760" fill="#3a2d28" stroke="#1d1512" strokeWidth="10" />
          ))}
        </svg>
        <Floor c1="#1c1e26" c2="#0c0d12" />
      </div>
    );
  // fallback generico: cor derivada do id
  const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ ...base, background: `linear-gradient(hsl(${h} 30% 28%), hsl(${h} 35% 12%))` }}>
      <Floor c1={`hsl(${h} 30% 10%)`} c2="#000" />
      <Rays />
    </div>
  );
};
