import React from 'react';
import { H, W } from '../types';
import { Background as Old } from './Background';
import { flickerLevel } from './fx';

const abs: React.CSSProperties = { position: 'absolute', inset: 0 };
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const Stars: React.FC<{ n: number; maxY: number; seed?: number; f?: number }> = ({ n, maxY, seed = 7, f = 0 }) => {
  const r = rng(seed);
  return <g fill="#fff">{Array.from({ length: n }).map((_, i) => <circle key={i} cx={r() * W} cy={r() * maxY} r={0.8 + r() * 1.8} opacity={0.3 + 0.5 * Math.abs(Math.sin(f / 30 + i))} />)}</g>;
};

const Pine: React.FC<{ x: number; y: number; h: number; c: string }> = ({ x, y, h, c }) => {
  const w = h * 0.4;
  return (
    <g transform={`translate(${x} ${y})`} fill={c}>
      <rect x={-w * 0.06} y={-h * 0.14} width={w * 0.12} height={h * 0.16} />
      {[0, 1, 2, 3, 4].map((k) => {
        const base = -h * (0.1 + k * 0.17);
        return <polygon key={k} points={`0,${base - h * 0.34} ${w * (0.58 - k * 0.09)},${base} ${-w * (0.58 - k * 0.09)},${base}`} />;
      })}
    </g>
  );
};
const Pines: React.FC<{ seed: number; n: number; y: number; h: [number, number]; c: string; dx?: number }> = ({ seed, n, y, h, c, dx = 0 }) => {
  const r = rng(seed);
  return <g transform={`translate(${dx} 0)`}>{Array.from({ length: n }).map((_, i) => <Pine key={i} x={-120 + ((W + 240) * (i + r() * 0.7)) / n} y={y} h={h[0] + r() * (h[1] - h[0])} c={c} />)}</g>;
};

const Moon: React.FC<{ x: number; y: number; r: number; id: string }> = ({ x, y, r, id }) => (
  <g>
    <defs><radialGradient id={id}><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".3" stopColor="#cfdcff" stopOpacity=".18" /><stop offset="1" stopColor="#9fb4ff" stopOpacity="0" /></radialGradient></defs>
    <circle cx={x} cy={y} r={r * 4.5} fill={`url(#${id})`} />
    <circle cx={x} cy={y} r={r} fill="#f1f4ff" />
    <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.22} fill="#d5dcef" /><circle cx={x + r * 0.35} cy={y + r * 0.3} r={r * 0.15} fill="#d5dcef" />
  </g>
);

const NightSky: React.FC<{ id: string; horizon: number; f: number }> = ({ id, horizon, f }) => (
  <>
    <defs>
      <linearGradient id={`${id}sk`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#050812" /><stop offset=".55" stopColor="#12203d" /><stop offset="1" stopColor="#3d5578" />
      </linearGradient>
    </defs>
    <rect width={W} height={horizon + 40} fill={`url(#${id}sk)`} />
    <Stars n={70} maxY={horizon * 0.8} f={f} />
    <Moon x={800} y={300} r={74} id={`${id}mn`} />
  </>
);

const Road: React.FC<{ id: string; horizon: number; f: number; speed?: number }> = ({ id, horizon, f, speed = 0 }) => {
  const dashes = Array.from({ length: 9 }).map((_, k) => {
    const z0 = ((k + (f * speed) % 1) / 9), z1 = z0 + 0.045;
    const y0 = horizon + (H - horizon) * z0 * z0, y1 = horizon + (H - horizon) * z1 * z1;
    const w0 = 2 + 20 * z0 * z0, w1 = 2 + 20 * z1 * z1;
    return <polygon key={k} points={`${540 - w0},${y0} ${540 + w0},${y0} ${540 + w1},${y1} ${540 - w1},${y1}`} fill="#d9d27a" opacity={0.25 + z0 * 0.7} />;
  });
  return (
    <>
      <defs>
        <linearGradient id={`${id}rd`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a3342" /><stop offset=".25" stopColor="#161b25" /><stop offset="1" stopColor="#080a0f" /></linearGradient>
      </defs>
      <rect y={horizon} width={W} height={H - horizon} fill="#070a10" />
      <polygon points={`500,${horizon} 580,${horizon} 1700,${H} -620,${H}`} fill={`url(#${id}rd)`} />
      <polygon points={`500,${horizon} 506,${horizon} -150,${H} -330,${H}`} fill="#9aa4b3" opacity=".35" />
      <polygon points={`574,${horizon} 580,${horizon} 1230,${H} 1410,${H}`} fill="#9aa4b3" opacity=".35" />
      {dashes}
    </>
  );
};

const GlowRect: React.FC<{ x: number; y: number; w: number; h: number; c: string; r?: number }> = ({ x, y, w, h, c, r = 0 }) => (
  <g>
    <rect x={x - 30} y={y - 30} width={w + 60} height={h + 60} rx={r + 30} fill={c} opacity=".12" />
    <rect x={x - 12} y={y - 12} width={w + 24} height={h + 24} rx={r + 12} fill={c} opacity=".18" />
    <rect x={x} y={y} width={w} height={h} rx={r} fill={c} />
  </g>
);

/* ---------------- cenas ---------------- */

const Estrada: React.FC<{ f: number; p: number }> = ({ f, p }) => {
  const px = (k: number) => (p - 0.5) * k;
  return (
    <svg width={W} height={H} style={abs}>
      <NightSky id="es" horizon={900} f={f} />
      <Pines seed={11} n={14} y={915} h={[220, 340]} c="#101a2d" dx={px(-20)} />
      <Pines seed={23} n={10} y={960} h={[360, 560]} c="#0a1120" dx={px(-45)} />
      <Road id="es" horizon={930} f={f} />
      <Pine x={-30 + px(-90)} y={1500} h={1500} c="#03060b" />
      <Pine x={1110 + px(-90)} y={1560} h={1650} c="#03060b" />
    </svg>
  );
};

const Posto: React.FC<{ f: number; p: number }> = ({ f, p }) => {
  const px = (k: number) => (p - 0.5) * k;
  const lv = flickerLevel(f);
  return (
    <svg width={W} height={H} style={abs}>
      <NightSky id="po" horizon={860} f={f} />
      <Pines seed={5} n={14} y={880} h={[240, 380]} c="#0f192b" dx={px(-20)} />
      <defs>
        <linearGradient id="poAsph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b222e" /><stop offset="1" stopColor="#07090e" /></linearGradient>
        <radialGradient id="poLamp"><stop offset="0" stopColor="#ffe9a8" stopOpacity=".55" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
        <linearGradient id="poCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3c4" stopOpacity=".35" /><stop offset="1" stopColor="#fff3c4" stopOpacity="0" /></linearGradient>
      </defs>
      <rect y="880" width={W} height={H - 880} fill="url(#poAsph)" />
      {/* loja */}
      <g transform={`translate(${px(-30)} 0)`}>
        <rect x="640" y="460" width="460" height="460" fill="#252a36" />
        <rect x="640" y="440" width="460" height="30" fill="#161a23" />
        <GlowRect x={690} y={560} w={270} h={200} c={`rgba(255,214,130,${0.85 * lv})`} />
        <rect x="690" y="560" width="270" height="200" fill="none" stroke="#12151c" strokeWidth="8" />
        <line x1="825" y1="560" x2="825" y2="760" stroke="#12151c" strokeWidth="6" />
        <rect x="990" y="620" width="90" height="300" fill="#12151c" />
        {/* canopy */}
        <polygon points="40,330 700,330 760,400 -20,400" fill="#8a1f1f" />
        <polygon points="-20,400 760,400 760,416 -20,416" fill="#3a0c0c" />
        {[120, 330, 540].map((x) => <rect key={x} x={x - 12} y="416" width="24" height="520" fill="#30343f" />)}
        {[170, 400, 620].map((x) => (
          <g key={x}>
            <polygon points={`${x - 70},416 ${x + 70},416 ${x + 250},1100 ${x - 250},1100`} fill="url(#poCone)" opacity={lv} />
            <ellipse cx={x} cy="414" rx="48" ry="8" fill="#fff3c4" opacity={lv} />
          </g>
        ))}
        {/* bombas */}
        {[210, 430].map((x) => (
          <g key={x}>
            <rect x={x - 46} y="660" width="92" height="270" rx="8" fill="#3b4150" />
            <rect x={x - 46} y="640" width="92" height="60" rx="10" fill="#a32626" />
            <rect x={x - 32} y="712" width="64" height="48" fill="#0f1218" />
            <rect x={x - 32} y="712" width="64" height="48" fill="#6cf0a8" opacity=".1" />
            <path d={`M${x + 46} 760 q40 10 30 90`} stroke="#14161c" strokeWidth="10" fill="none" />
          </g>
        ))}
        {/* placa neon */}
        <rect x="206" y="260" width="30" height="680" fill="#1b1f29" />
        <g transform="translate(-40 110)">
          <rect x="120" y="0" width="280" height="150" rx="18" fill="#10131a" stroke="#2b3140" strokeWidth="8" />
          <text x="260" y="78" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="800" fontSize="66" fill="#ff3d6e" opacity={lv < 1 ? 0.2 : 1} style={{ filter: 'drop-shadow(0 0 18px #ff3d6e)' }}>POSTO</text>
          <text x="260" y="128" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="700" fontSize="36" fill="#5ce0ff" opacity={lv < 1 ? 1 : 0.85} style={{ filter: 'drop-shadow(0 0 12px #5ce0ff)' }}>24 HORAS</text>
        </g>
      </g>
      {/* reflexo molhado */}
      <rect x="0" y="940" width={W} height="500" fill="url(#poLamp)" opacity=".18" />
    </svg>
  );
};

const Loja: React.FC<{ f: number; p: number; layer: 'back' | 'front' }> = ({ f, p, layer }) => {
  const px = (k: number) => (p - 0.5) * k;
  const lv = flickerLevel(f);
  const r = rng(99);
  if (layer === 'front')
    return (
      <svg width={W} height={H} style={abs}>
        <defs><linearGradient id="loC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6a4a2e" /><stop offset="1" stopColor="#2f1f12" /></linearGradient></defs>
        <rect x="470" y="1000" width="700" height="560" fill="url(#loC)" />
        <rect x="450" y="984" width="720" height="34" rx="6" fill="#8a6440" />
        <rect x="450" y="1016" width="720" height="8" fill="#000" opacity=".35" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x={500 + i * 160} y="1060" width="130" height="400" rx="6" fill="none" stroke="#1d130b" strokeWidth="5" opacity=".6" />)}
        {/* caixa registradora */}
        <rect x="740" y="900" width="170" height="86" rx="8" fill="#b9b09a" />
        <rect x="760" y="870" width="130" height="40" rx="6" fill="#4a5a44" />
        <rect x="770" y="878" width="110" height="20" fill="#7bd88f" opacity=".5" />
      </svg>
    );
  return (
    <svg width={W} height={H} style={abs}>
      <defs>
        <linearGradient id="loW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d2a1b" /><stop offset="1" stopColor="#1d130c" /></linearGradient>
        <radialGradient id="loB"><stop offset="0" stopColor="#ffe3a0" stopOpacity=".8" /><stop offset="1" stopColor="#ffe3a0" stopOpacity="0" /></radialGradient>
        <linearGradient id="loCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9b0" stopOpacity=".42" /><stop offset="1" stopColor="#ffe9b0" stopOpacity="0" /></linearGradient>
        <linearGradient id="loWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1830" /><stop offset="1" stopColor="#4a6585" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#loW)" />
      {Array.from({ length: 14 }).map((_, i) => <rect key={i} x={i * 80} y="0" width="3" height="1150" fill="#000" opacity=".22" />)}
      {/* janela */}
      <g transform={`translate(${px(-15)} 0)`}>
        <rect x="690" y="330" width="320" height="440" fill="url(#loWin)" stroke="#27190f" strokeWidth="18" />
        <circle cx="900" cy="470" r="34" fill="#eef2ff" opacity=".9" />
        <Pines seed={3} n={6} y={770} h={[120, 200]} c="#0a121f" dx={0} />
        <line x1="850" y1="330" x2="850" y2="770" stroke="#27190f" strokeWidth="12" /><line x1="690" y1="550" x2="1010" y2="550" stroke="#27190f" strokeWidth="12" />
      </g>
      {/* relogio e calendario */}
      <circle cx="560" cy="300" r="62" fill="#e8e0c8" stroke="#2a1a0e" strokeWidth="10" />
      <line x1="560" y1="300" x2="560" y2="254" stroke="#222" strokeWidth="7" strokeLinecap="round" /><line x1="560" y1="300" x2="596" y2="300" stroke="#222" strokeWidth="7" strokeLinecap="round" />
      <g transform="translate(330 250) rotate(-3)"><rect width="150" height="190" fill="#f1ead6" /><rect width="150" height="46" fill="#a02a2a" />
        <text x="75" y="34" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="800" fontSize="28" fill="#fff">1998</text>
        {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={14 + (i % 4) * 32} y={64 + Math.floor(i / 4) * 40} width="22" height="22" fill="#c9c0a6" />)}
      </g>
      {/* prateleiras */}
      {[520, 720, 920].map((y, row) => (
        <g key={y} transform={`translate(${px(10)} 0)`}>
          <rect x="0" y={y} width="330" height="14" fill="#2a190c" />
          {Array.from({ length: 6 }).map((_, i) => {
            const hh = 50 + r() * 70;
            const c = ['#7d3b2e', '#4f6b5a', '#8a7a4a', '#3d4f6b', '#6b4a6b'][Math.floor(r() * 5)];
            return <g key={i}><rect x={14 + i * 52} y={y - hh} width="40" height={hh} rx="5" fill={c} /><rect x={14 + i * 52} y={y - hh} width="40" height="10" fill="#fff" opacity=".15" /></g>;
          })}
        </g>
      ))}
      <rect y="1150" width={W} height={H - 1150} fill="#1c130c" />
      {Array.from({ length: 9 }).map((_, i) => <rect key={i} y={1150 + i * i * 12 + i * 20} width={W} height="4" fill="#000" opacity=".4" />)}
      {/* lampada */}
      <line x1="540" y1="0" x2="540" y2="240" stroke="#0d0906" strokeWidth="6" />
      <polygon points="540,260 150,1300 930,1300" fill="url(#loCone)" opacity={lv} />
      <circle cx="540" cy="262" r="140" fill="url(#loB)" opacity={lv} />
      <path d="M512 232 h56 l-6 22 h-44z" fill="#151008" /><circle cx="540" cy="268" r="20" fill={lv < 1 ? '#8a7a50' : '#fff6d0'} />
    </svg>
  );
};

const Carro: React.FC<{ f: number; layer: 'back' | 'front' }> = ({ f, layer }) => {
  if (layer === 'back') {
    const trees = Array.from({ length: 16 }).map((_, i) => {
      const z = ((i / 16) + f * 0.0055) % 1, zz = Math.pow(z, 2.3), side = i % 2 ? 1 : -1;
      return { z, x: 540 + side * (150 + zz * 1300), y: 900 + zz * 520, h: 70 + zz * 1100 };
    }).sort((a, b) => a.z - b.z);
    return (
      <svg width={W} height={H} style={abs}>
        <NightSky id="ca" horizon={900} f={f} />
        <Pines seed={31} n={12} y={905} h={[160, 260]} c="#0d1627" />
        <Road id="ca" horizon={900} f={f} speed={0.035} />
        {trees.map((t, i) => <Pine key={i} x={t.x} y={t.y} h={t.h} c={`rgb(${4 + t.z * 8},${8 + t.z * 12},${14 + t.z * 20})`} />)}
        <defs><radialGradient id="caHL" cx=".5" cy="1" r=".9"><stop offset="0" stopColor="#fff4c6" stopOpacity=".5" /><stop offset="1" stopColor="#fff4c6" stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="540" cy="1050" rx="700" ry="420" fill="url(#caHL)" />
      </svg>
    );
  }
  const glow = 0.8 + 0.2 * Math.sin(f / 9);
  return (
    <svg width={W} height={H} style={abs}>
      <defs>
        <linearGradient id="caD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#15161c" /><stop offset=".25" stopColor="#0b0b10" /><stop offset="1" stopColor="#050508" /></linearGradient>
        <radialGradient id="caG"><stop offset="0" stopColor="#7dffb0" stopOpacity=".5" /><stop offset="1" stopColor="#7dffb0" stopOpacity="0" /></radialGradient>
      </defs>
      <polygon points="0,0 120,0 40,1100 0,1100" fill="#08080b" />
      <polygon points={`${W},0 ${W - 110},0 ${W - 30},1100 ${W},1100`} fill="#08080b" />
      <rect x="0" y="0" width={W} height="130" fill="#08080b" />
      <rect x="470" y="140" width="150" height="56" rx="14" fill="#0b0b10" stroke="#1e2028" strokeWidth="6" /><rect x="480" y="148" width="130" height="40" rx="9" fill="#1c2a3a" />
      <path d="M0 1050 Q540 970 1080 1050 L1080 1920 L0 1920Z" fill="url(#caD)" />
      <path d="M0 1050 Q540 970 1080 1050" stroke="#2b2d38" strokeWidth="6" fill="none" />
      {/* GPS */}
      <circle cx="640" cy="1150" r="190" fill="url(#caG)" opacity={glow} />
      <rect x="540" y="1090" width="230" height="130" rx="14" fill="#06120c" stroke="#222632" strokeWidth="8" />
      <rect x="548" y="1098" width="214" height="114" rx="9" fill="#0b3a23" opacity=".9" />
      <text x="655" y="1148" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="700" fontSize="28" fill="#9bffc4">VOCÊ</text>
      <text x="655" y="1192" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="700" fontSize="28" fill="#9bffc4">CHEGOU</text>
      {/* volante */}
      <g transform="translate(300 1260) rotate(-8)">
        <ellipse rx="170" ry="130" fill="none" stroke="#0a0a0d" strokeWidth="30" />
        <ellipse rx="170" ry="130" fill="none" stroke="#2b2d38" strokeWidth="4" transform="translate(-6 -6)" />
        <rect x="-150" y="-14" width="300" height="28" fill="#0a0a0d" /><circle r="46" fill="#111218" stroke="#2b2d38" strokeWidth="4" />
      </g>
      {/* painel do motorista */}
      <circle cx="260" cy="1100" r="52" fill="#0d1a24" stroke="#262a35" strokeWidth="6" /><circle cx="260" cy="1100" r="38" fill="#ff9d3c" opacity=".08" />
    </svg>
  );
};

export const Scenery: React.FC<{ id: string; f: number; p: number; layer: 'back' | 'front' }> = ({ id, f, p, layer }) => {
  switch (id) {
    case 'estrada': return layer === 'back' ? <Estrada f={f} p={p} /> : null;
    case 'posto': return layer === 'back' ? <Posto f={f} p={p} /> : null;
    case 'loja': return <Loja f={f} p={p} layer={layer} />;
    case 'carro': return <Carro f={f} layer={layer} />;
    default: return layer === 'back' ? <Old id={id} /> : null;
  }
};
