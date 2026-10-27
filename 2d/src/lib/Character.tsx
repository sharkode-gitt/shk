import React, { useId } from 'react';
import { CharDef, Mood } from '../types';

interface P {
  def: CharDef;
  mood?: Mood;
  talking?: boolean;
  mouth?: number; // 0..1 vindo do audio (sincronia labial)
  frame: number;
  pose?: 'stand' | 'lying' | 'bust';
  prop?: 'axe' | 'none';
  look?: number;
}

export const shade = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(a < 0 ? c * (1 + a) : c + (255 - c) * a)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
};

const YEL = '#f2c21b';

// Estilo flat (sem contorno): cabeca redonda, olhos de bolinha, sobrancelha grossa, nariz redondo.
export const Character: React.FC<P> = ({ def, mood = 'neutral', talking, mouth, frame, pose = 'stand', prop = 'none', look = 0 }) => {
  const uid = useId().replace(/:/g, '');
  const bw = def.build ?? 1;
  const { skin, hair, top, pants } = def;
  const skinD = shade(skin, -0.14), skinDD = shade(skin, -0.3);
  const topD = shade(top, -0.2), top2 = def.top2 ?? shade(top, 0.3);
  const pantsD = shade(pants, -0.22);
  const outfit = def.outfit ?? 'tee';
  const turnout = outfit === 'turnout';
  const long = outfit === 'coat' || turnout;
  const longSleeve = outfit !== 'tee' && outfit !== 'dress';
  const fem = !!def.lashes;
  const w = 60 * bw; // meia largura do tronco
  const helmet = def.hat === 'helmet';

  const breathe = Math.sin(frame / 17) * 2.5;
  const o = !talking ? 0 : mouth !== undefined ? Math.min(1, mouth * 1.1) : Math.max(0, Math.min(1, 0.55 + 0.45 * Math.sin(frame / 1.7) * Math.cos(frame / 4.3)));
  const tilt = Math.sin(frame / 41) * 1.2 + (talking ? (o - 0.4) * 2.4 + Math.sin(frame / 9) : 0) + (mood === 'sad' ? -5 : 0);
  const blink = frame % 118 > 113;
  const sx = (((Math.floor(frame / 38) * 7919) % 11) - 5) * 0.3;

  const lid = blink ? 1.05 : { neutral: 0.05, angry: 0.35, sad: 0.4, scared: -0.4, happy: 0.3 }[mood];
  const lidRot = mood === 'angry' ? 14 : mood === 'sad' ? -14 : 0;
  const bd = { neutral: 0, angry: 11, sad: -10, scared: -9, happy: -3 }[mood];
  const by = (mood === 'scared' ? -8 : mood === 'happy' ? -4 : 0) - (talking ? o * 3 : 0);
  const lipCol = def.lips ?? (fem ? '#c24a5c' : '#7a3a34');

  const Eye = ({ x, s }: { x: number; s: 1 | -1 }) => (
    <g transform={`translate(${x} -426)`}>
      <clipPath id={`${uid}e${s}`}><circle r="17" /></clipPath>
      {mood === 'scared' && <circle r="15" fill="#fff" />}
      <g clipPath={`url(#${uid}e${s})`}>
        <ellipse cx={look * 3 + sx} cy="0" rx={mood === 'scared' ? 5.5 : 8} ry={mood === 'scared' ? 6.5 : 10.5} fill="#1d1618" />
        <circle cx={look * 3 + sx - 2.5} cy="-3.5" r="2.5" fill="#fff" />
        <g transform={`rotate(${lidRot * s})`}><rect x="-22" y={-12 + lid * 24 - 30} width="44" height="30" fill={skin} /></g>
      </g>
      {fem && <path d={`M${-s * 9} -9 l${-s * 9} -5 M${-s * 6} -12 l${-s * 5} -9`} stroke="#1d1618" strokeWidth="3" strokeLinecap="round" fill="none" />}
    </g>
  );

  const mouthEl = () => {
    if (o > 0.12)
      return (
        <g>
          <clipPath id={`${uid}m`}><ellipse cx="0" cy="-380" rx={9 + o * 8} ry={3 + o * 12} /></clipPath>
          <ellipse cx="0" cy="-380" rx={9 + o * 8} ry={3 + o * 12} fill="#4a1a1f" />
          <g clipPath={`url(#${uid}m)`}><ellipse cx="0" cy={-370 + (1 - o) * 4} rx="9" ry="7" fill="#d9626f" /></g>
        </g>
      );
    const d = mood === 'happy' ? 'M-18 -384 Q0 -362 18 -384' : mood === 'sad' ? 'M-13 -374 Q0 -386 13 -374' : mood === 'angry' ? 'M-13 -376 Q0 -382 13 -376' : 'M-12 -379 Q0 -373 12 -379';
    if (mood === 'scared') return <ellipse cx="0" cy="-378" rx="8" ry="6" fill="#4a1a1f" />;
    return <path d={d} stroke={lipCol} strokeWidth={fem ? 6 : 5} strokeLinecap="round" fill="none" />;
  };

  const talkArm = talking ? Math.sin(frame / 8) * (0.4 + o * 0.6) : 0;
  const armR = prop === 'axe' ? [-18, -50] : [-8 + talkArm * -14, talking ? -38 + talkArm * 14 : -6];
  const armL = [8 + Math.sin(frame / 23) * 1.5, 6 + (talking ? Math.sin(frame / 11) * 4 : 0)];
  const sleeve = longSleeve ? top : top;
  const Arm = ({ x, a, s }: { x: number; a: number[]; s: 1 | -1 }) => (
    <g transform={`translate(${x} -334) rotate(${a[0]})`}>
      <rect x="-15" y="-8" width="30" height="86" rx="15" fill={sleeve} />
      {s === 1 && <rect x="2" y="-6" width="13" height="82" rx="7" fill={topD} opacity=".45" />}
      {turnout && <><rect x="-15" y="44" width="30" height="13" fill={YEL} /><rect x="-15" y="49" width="30" height="3" fill="#e8e8e8" /></>}
      <g transform={`translate(0 74) rotate(${a[1]})`}>
        <rect x="-13" y="-6" width="26" height="74" rx="13" fill={longSleeve ? sleeve : skin} />
        {turnout && <><rect x="-13" y="26" width="26" height="13" fill={YEL} /><rect x="-13" y="31" width="26" height="3" fill="#e8e8e8" /></>}
        {longSleeve && <rect x="-13" y="52" width="26" height="12" rx="5" fill={topD} />}
        <circle cx="0" cy="70" r="14.5" fill={skin} />
        <circle cx="0" cy="70" r="14.5" fill={skinD} opacity=".25" clipPath="inset(0 0 0 50%)" />
        {prop === 'axe' && s === 1 && (
          <g transform="translate(0 70) rotate(35)">
            <rect x="-6" y="-210" width="12" height="300" rx="5" fill="#8a5a2b" />
            <path d="M6 -210 L104 -190 Q112 -150 104 -112 L6 -132Z" fill="#c5ccd6" />
            <path d="M6 -210 L104 -190 L104 -176 L6 -196Z" fill="#fff" opacity=".55" />
            <circle cx="0" cy="-6" r="15" fill={skin} />
          </g>
        )}
      </g>
    </g>
  );

  const bust = pose === 'bust';
  const rot = pose === 'lying' ? 90 : 0;
  const legTop = long ? -90 : -170;

  return (
    <g transform={`rotate(${rot})`}>
      {!bust && <ellipse cx="0" cy="6" rx="118" ry="15" fill="#000" opacity=".3" />}
      <g transform={`translate(0 ${breathe * 0.4})`}>
        {/* pernas + botas */}
        {outfit === 'dress' ? (
          <><rect x="-36" y="-90" width="26" height="90" fill={skin} /><rect x="10" y="-90" width="26" height="90" fill={skin} /></>
        ) : (
          <>
            <rect x="-48" y={legTop} width="38" height={-legTop} rx="14" fill={turnout ? shade(top, -0.1) : pants} />
            <rect x="10" y={legTop} width="38" height={-legTop} rx="14" fill={turnout ? shade(top, -0.1) : pants} />
            <rect x="10" y={legTop} width="38" height={-legTop} rx="14" fill={pantsD} opacity={turnout ? 0.2 : 0.45} />
            {turnout && [0, 1].map((i) => <rect key={i} x={i ? 10 : -48} y="-48" width="38" height="12" fill={YEL} />)}
          </>
        )}
        <rect x="-58" y="-34" width="52" height="34" rx="12" fill="#26262d" />
        <rect x="6" y="-34" width="52" height="34" rx="12" fill="#26262d" />
        <rect x="-58" y="-8" width="52" height="8" rx="4" fill="#111116" /><rect x="6" y="-8" width="52" height="8" rx="4" fill="#111116" />

        {/* tronco */}
        <g transform={`translate(0 ${breathe})`}>
          {outfit === 'dress' && <path d={`M${-w - 6} -168 L${w + 6} -168 L${w + 40} -66 L${-w - 40} -66Z`} fill={top} />}
          {(() => {
            const bottom = long ? -64 : -150;
            const hgt = bottom + 352;
            return (
              <>
                <clipPath id={`${uid}t`}><rect x={-w} y="-352" width={w * 2} height={hgt} rx="32" /></clipPath>
                <rect x={-w} y="-352" width={w * 2} height={hgt} rx="32" fill={top} />
                <g clipPath={`url(#${uid}t)`}>
                  <rect x={w * 0.3} y="-360" width={w} height="320" fill={topD} opacity=".4" />
                  {turnout && (
                    <>
                      <rect x={-w} y="-258" width={w * 2} height="22" fill={YEL} /><rect x={-w} y="-250" width={w * 2} height="4" fill="#e8e8e8" />
                      <rect x={-w} y="-132" width={w * 2} height="22" fill={YEL} /><rect x={-w} y="-124" width={w * 2} height="4" fill="#e8e8e8" />
                      <rect x="-2" y="-340" width="4" height="280" fill={topD} />
                      {[-300, -190, -90].map((y) => <circle key={y} cx="-14" cy={y} r="4.5" fill={shade(top, -0.35)} />)}
                      <rect x={-w + 8} y="-104" width="36" height="34" rx="4" fill={topD} /><rect x={w - 44} y="-104" width="36" height="34" rx="4" fill={topD} />
                    </>
                  )}
                  {def.bag && (
                    <>
                      <line x1={w - 6} y1="-352" x2={-w + 14} y2="-120" stroke="#1b1b20" strokeWidth="10" />
                      <rect x={-w - 2} y="-150" width="54" height="46" rx="9" fill="#1b1b20" /><rect x={-w + 4} y="-142" width="42" height="8" rx="4" fill="#3a3a44" />
                    </>
                  )}
                  {(outfit === 'jacket' || outfit === 'coat') && (
                    <>
                      <path d="M-20 -352 L0 -230 L20 -352Z" fill={top2} />
                      <line x1="0" y1="-230" x2="0" y2={bottom} stroke={topD} strokeWidth="4" />
                      <rect x={-w + 8} y="-212" width="34" height="30" rx="4" fill={topD} opacity=".55" />
                      {outfit === 'coat' && [-280, -240, -200].map((y) => <circle key={y} cx="-8" cy={y} r="4.5" fill={shade(top, -0.4)} />)}
                    </>
                  )}
                  {outfit === 'uniform' && (
                    <>
                      <rect x={-w} y="-236" width={w * 2} height="16" fill="#f2b705" />
                      <rect x={-w + 12} y="-322" width="26" height="18" rx="3" fill={top2} />
                    </>
                  )}
                </g>
              </>
            );
          })()}
          {turnout && <><rect x="12" y="-322" width="24" height="38" rx="5" fill="#15151a" /><circle cx="24" cy="-302" r="5" fill="#3ddc84" /></>}
          {/* gola */}
          {turnout || outfit === 'jacket' || outfit === 'coat' || outfit === 'uniform' ? (
            <rect x="-44" y="-368" width="88" height="26" rx="12" fill={topD} />
          ) : (
            <path d="M-28 -352 Q0 -322 28 -352Z" fill={skinD} />
          )}
        </g>
        {def.fur && <g fill="#2b2622">{[-46, -30, -14, 2, 18, 34, 50].map((x, i) => <circle key={i} cx={x} cy={-352 + (i % 2) * 6} r="19" />)}</g>}
        <Arm x={-w + 4} a={armL} s={-1} />
        <Arm x={w - 4} a={armR} s={1} />

        {/* cabeca */}
        <g transform={`translate(0 ${breathe})`}>
          <g transform={`rotate(${tilt} 0 -350)`}>
            {helmet && <path d="M-72 -470 C-116 -450 -130 -360 -98 -296 C-80 -310 -64 -332 -58 -356 Z" fill="#e9e4d8" />}
            {def.hairStyle === 'long' && !helmet && <path d="M-84 -440 C-100 -350 -92 -300 -70 -280 L70 -280 C92 -300 100 -350 84 -440 C60 -530 -60 -530 -84 -440Z" fill={hair} />}
            {def.hairStyle === 'bun' && !helmet && <circle cx="0" cy="-522" r="34" fill={hair} />}
            <rect x="-20" y="-372" width="40" height="34" rx="12" fill={skinD} />
            <circle cx="-74" cy="-418" r="15" fill={skin} /><circle cx="74" cy="-418" r="15" fill={skinD} />
            <circle cx="-74" cy="-418" r="7" fill={skinD} opacity=".7" /><circle cx="74" cy="-418" r="7" fill={skinDD} opacity=".6" />
            <clipPath id={`${uid}h`}><ellipse cx="0" cy="-425" rx="77" ry="75" /></clipPath>
            <ellipse cx="0" cy="-425" rx="77" ry="75" fill={skin} />
            <g clipPath={`url(#${uid}h)`}><ellipse cx="68" cy="-420" rx="44" ry="100" fill={skinD} opacity=".4" /></g>
            {def.beard && <path d="M-72 -420 C-76 -360 -36 -340 0 -340 C36 -340 76 -360 72 -420 C58 -388 36 -384 0 -388 C-36 -384 -58 -388 -72 -420Z" fill={hair} />}
            <circle cx="-46" cy="-398" r="12" fill="#ff6b6b" opacity={mood === 'happy' ? 0.35 : 0.2} />
            <circle cx="46" cy="-398" r="12" fill="#ff6b6b" opacity={mood === 'happy' ? 0.35 : 0.2} />
            <Eye x={-27} s={1} />
            <Eye x={27} s={-1} />
            <g stroke={shade(hair, -0.12)} strokeWidth="10" strokeLinecap="round" fill="none">
              <line x1="-46" y1={-458 + by - bd * 0.5} x2="-10" y2={-458 + by + bd} />
              <line x1="10" y1={-458 + by + bd} x2="46" y2={-458 + by - bd * 0.5} />
            </g>
            <circle cx="0" cy="-405" r="12" fill={skinD} /><circle cx="-3" cy="-409" r="4" fill={skin} opacity=".6" />
            {def.old && <g stroke={skinD} strokeWidth="3" fill="none" opacity=".8" strokeLinecap="round"><path d="M-40 -440 q-6 14 0 26" /><path d="M40 -440 q6 14 0 26" /></g>}
            {mouthEl()}
            {(def.mustache || def.beard) && <path d="M-36 -392 Q-18 -414 0 -399 Q18 -414 36 -392 Q24 -378 0 -386 Q-24 -378 -36 -392Z" fill={hair === '#e6e6ee' ? '#d6d6df' : hair} />}
            {def.glasses && (
              <g stroke="#2b2b33" strokeWidth="5" fill="#cfe6ff" fillOpacity=".12">
                <circle cx="-27" cy="-426" r="22" /><circle cx="27" cy="-426" r="22" />
                <line x1="-5" y1="-428" x2="5" y2="-428" />
              </g>
            )}
            {/* cabelo / capacete */}
            {!helmet && def.hairStyle !== 'bald' && def.hairStyle !== 'curly' && <path d="M-78 -436 C-86 -540 86 -540 78 -436 C66 -468 34 -484 0 -482 C-34 -484 -66 -468 -78 -436Z" fill={hair} />}
            {!helmet && def.hairStyle === 'curly' && (
              <g fill={hair}>{[-60, -36, -12, 12, 36, 60].map((x, i) => <circle key={i} cx={x} cy={-484 + Math.abs(x) * 0.25} r="28" />)}<circle cx="-76" cy="-446" r="20" /><circle cx="76" cy="-446" r="20" /></g>
            )}
            {helmet && (
              <g>
                <path d="M-90 -466 C-96 -566 96 -566 90 -466Z" fill="#f4f1ea" />
                <path d="M30 -540 C60 -520 80 -500 90 -466 L50 -466 C50 -490 44 -515 30 -540Z" fill="#d8d3c6" opacity=".7" />
                <rect x="-96" y="-482" width="192" height="20" rx="10" fill="#e8dfc8" />
                <rect x="-96" y="-468" width="192" height="6" rx="3" fill="#c9bea2" />
                <rect x="-16" y="-558" width="32" height="14" rx="6" fill="#1b1b20" />
                <path d="M28 -540 h40 v34 q0 14 -20 22 q-20 -8 -20 -22Z" fill="#23407a" />
                <text x="48" y="-506" textAnchor="middle" fontFamily="Rubik, sans-serif" fontWeight="900" fontSize="30" fill="#fff">{def.badge ?? '8'}</text>
              </g>
            )}
            {def.mask === 'skull' && (
              <g>
                <path d="M-72 -432 C-76 -498 76 -498 72 -432 L58 -372 Q0 -358 -58 -372Z" fill="#e8b93a" stroke="#9a7416" strokeWidth="4" />
                <ellipse cx="-27" cy="-428" rx="21" ry="25" fill="#0b0b0e" transform={`rotate(${mood === 'angry' ? 12 : 0} -27 -428)`} />
                <ellipse cx="27" cy="-428" rx="21" ry="25" fill="#0b0b0e" transform={`rotate(${mood === 'angry' ? -12 : 0} 27 -428)`} />
                <circle cx="-22" cy="-435" r="5" fill="#fff" /><circle cx="32" cy="-435" r="5" fill="#fff" />
                <path d="M0 -408 l-11 26 h22Z" fill="#0b0b0e" />
                <rect x="-46" y={-380 + o * 8} width="92" height={22 + o * 14} rx="8" fill="#e8b93a" stroke="#9a7416" strokeWidth="4" />
                {[-34, -22, -10, 2, 14, 26].map((x) => <rect key={x} x={x} y={-376 + o * 8} width="9" height="14" rx="2" fill="#fff6d6" />)}
              </g>
            )}
            {def.hat === 'crown' && (
              <g transform="translate(44 -490) rotate(14)">
                <path d="M-46 4 L-46 -40 L-24 -16 L0 -52 L24 -16 L46 -40 L46 4Z" fill="#ffcf3a" stroke="#b98a12" strokeWidth="4" strokeLinejoin="round" />
                <circle cx="0" cy="-12" r="6" fill="#ff5a6e" />
              </g>
            )}
            {def.hat === 'fedora' && (
              <g>
                <ellipse cx="0" cy="-478" rx="124" ry="22" fill="#17171b" />
                <path d="M-66 -480 C-70 -560 70 -560 66 -480Z" fill="#17171b" />
                <rect x="-66" y="-500" width="132" height="14" fill="#3a3a44" />
              </g>
            )}
            {def.hat === 'tophat' && (
              <g>
                <ellipse cx="0" cy="-482" rx="100" ry="18" fill="#d63a3a" />
                <rect x="-62" y="-610" width="124" height="130" rx="10" fill="#d63a3a" />
                <rect x="-62" y="-506" width="124" height="18" fill="#17171b" />
              </g>
            )}
          </g>
        </g>
      </g>
    </g>
  );
};
