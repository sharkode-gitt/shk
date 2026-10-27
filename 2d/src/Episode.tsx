import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Bible, Beat, Cam, CastItem, Scene, TextMode, Timeline, Trans, W, H } from './types';
import { Scenery } from './lib/Scenery';
import { Character, shade } from './lib/Character';
import { Dust, Flicker, Fog, Grain, Vignette } from './lib/fx';
import { AnimWords, parse, wordStarts } from './lib/text';

import { FONT } from './lib/fonts';
const GOLD = '#f2b233';
const RED = '#ff5a3c';
const SFX_VOL: Record<string, number> = { knock: 0.9, buzz: 0.5, boom: 0.65, impact: 0.65, heartbeat: 0.75, glitch: 0.5, stinger: 0.55, static: 0.6, ding: 0.45, creak: 0.8, whoosh: 0.6, swish: 0.4, swell: 0.55 };
const TRANS_SFX: Partial<Record<Trans, string>> = { blur: 'swish', whip: 'whoosh', dip: 'boom', flash: 'impact' };
const AMB_VOL = { car: 0.3, wind: 0.28, store: 0.35, dark: 0.22 };
const Sfx: React.FC<{ beat: Beat }> = ({ beat }) => {
  const { fps } = useVideoConfig();
  if (!beat.sfx) return null;
  const e = typeof beat.sfx === 'string' ? { name: beat.sfx, at: 0, vol: 1 } : { at: 0, vol: 1, ...beat.sfx };
  return <Sequence from={Math.round((e.at ?? 0) * fps)}><Audio src={staticFile(`sfx/${e.name}.mp3`)} volume={(SFX_VOL[e.name] ?? 0.6) * (e.vol ?? 1)} /></Sequence>;
};
const AmbBed: React.FC<{ kind: keyof typeof AMB_VOL }> = ({ kind }) => {
  const { durationInFrames } = useVideoConfig();
  return <Audio src={staticFile(`sfx/amb_${kind}.mp3`)} loop volume={(fr) => AMB_VOL[kind] * Math.min(1, fr / 20, (durationInFrames - fr) / 20)} />;
};
const TR: Record<Trans, number> = { blur: 16, fade: 12, whip: 10, dip: 18, flash: 8 };
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (q: number) => 1 - Math.pow(1 - clamp(q), 3);
const abs: React.CSSProperties = { position: 'absolute', inset: 0 };

const camTransform = (cam: Cam, p: number, f: number) => {
  switch (cam) {
    case 'zoom_in': return `scale(${1 + 0.16 * p})`;
    case 'zoom_out': return `scale(${1.16 - 0.16 * p})`;
    case 'pan_l': return `scale(1.12) translateX(${40 - 80 * p}px)`;
    case 'pan_r': return `scale(1.12) translateX(${-40 + 80 * p}px)`;
    case 'shake': return `scale(1.06) translate(${Math.sin(f * 2.1) * 9}px, ${Math.cos(f * 2.7) * 9}px)`;
    case 'none': return 'none';
    default: return `scale(${1.03 + 0.04 * p}) translate(${Math.sin(f / 50) * 8}px, ${Math.cos(f / 61) * 6}px)`; // drift: respiracao de camera
  }
};

const Title: React.FC<{ text: string }> = ({ text }) => {
  const words = parse(text);
  return (
    <div style={{ position: 'absolute', top: 140, width: W, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 84, textShadow: '0 8px 0 rgba(0,0,0,.35), 0 0 40px rgba(0,0,0,.5)' }}>
      <AnimWords words={words} starts={words.map((_, i) => 4 + i * 5)} mode="slide" accent={GOLD} gap={26} />
    </div>
  );
};

const Plate: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12 } });
  return <div style={{ position: 'absolute', top: 330, left: 340, width: 400, textAlign: 'center', background: GOLD, color: '#222', fontFamily: FONT, fontWeight: 800, fontSize: 96, borderRadius: 10, padding: '6px 0', boxShadow: '0 10px 0 rgba(0,0,0,.3)', transform: `scale(${s})` }}>{text}</div>;
};

const Note: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14 } });
  return (
    <div style={{ position: 'absolute', top: 170, left: 200, width: 680, transform: `rotate(${-2 + Math.sin(f / 30)}deg) scale(${s})`, background: '#fbf6e9', padding: '44px 30px', textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 74, lineHeight: 1.15, color: '#2a2a2a', boxShadow: '0 24px 50px rgba(0,0,0,.5)', whiteSpace: 'pre-line' }}>
      <div style={{ position: 'absolute', top: -26, left: 280, width: 140, height: 44, background: '#d9c9a0aa' }} />{text.split('\n').map((ln, i) => <div key={i}>{parse(ln).map((x, j) => <span key={j} style={{ color: x.e ? '#c2371f' : '#2a2a2a' }}>{x.w} </span>)}</div>)}
    </div>
  );
};

// texto grande de efeito (TOC TOC, BZZZ...) com "slam": entra gigante, desfocado, e treme
const Kinetic: React.FC<{ text: string; mode?: TextMode }> = ({ text }) => {
  const f = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ position: 'absolute', top: 760, width: W, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 28, fontFamily: FONT, fontWeight: 900, fontSize: 150, color: '#e8c27a' }}>
      {words.map((w, i) => {
        const lf = f - i * 9; const q = ease(lf / 7);
        const hit = lf >= 7 && lf < 16 ? Math.sin(lf * 3) * 8 : 0;
        return <span key={i} style={{ opacity: lf < 0 ? 0 : 0.95, transform: `scale(${2.6 - 1.6 * q}) rotate(${(i - 1) * 5}deg) translate(${hit}px,0)`, filter: `blur(${(1 - q) * 16}px)`, textShadow: '0 8px 0 rgba(0,0,0,.4), 0 0 60px rgba(255,190,90,.5)' }}>{w}</span>;
      })}
    </div>
  );
};

const Caption: React.FC<{ beat: Beat }> = ({ beat }) => {
  const words = parse(beat.t);
  const quote = beat.who !== 'narr';
  const starts = beat.ws && beat.ws.length === words.length ? beat.ws : wordStarts(words, beat.frames ?? 60);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, height: 620, background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.55))' }} />
      <div style={{ position: 'absolute', top: 1400, width: W, padding: '0 70px', boxSizing: 'border-box', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 70, lineHeight: 1.18, textShadow: '0 6px 0 rgba(0,0,0,.45)' }}>
        <AnimWords words={words} starts={starts} mode={beat.anim ?? 'slide'} accent={quote ? RED : GOLD} />
      </div>
    </>
  );
};

// nome do personagem: aparece, fica alguns segundos e some
const Tag: React.FC<{ text: string; color: string; x: number; y: number; life: number }> = ({ text, color, x, y, life }) => {
  const f = useCurrentFrame();
  const inQ = ease((f - 10) / 10);
  const outQ = ease((f - (10 + life)) / 12);
  const op = inQ * (1 - outQ);
  if (op <= 0.01) return null;
  return <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, ${(1 - inQ) * 16 + outQ * 10}px)`, opacity: op, background: shade(color, -0.1), color: '#fff3d6', fontFamily: FONT, fontWeight: 700, fontSize: 30, padding: '8px 24px', borderRadius: 10, whiteSpace: 'nowrap', letterSpacing: 1.5, boxShadow: '0 6px 0 rgba(0,0,0,.3)' }}>{text}</div>;
};

const SPOT = { left: 270, center: 540, right: 810 };
const BUST = { left: 330, center: 555, right: 790 };

const SceneView: React.FC<{ scene: Scene; bible: Bible; tr: number; trans: Trans; outDip: number }> = ({ scene, bible, tr, trans, outDip }) => {
  const f = useCurrentFrame();
  const total = scene.frames ?? 1;
  const p = clamp(f / total);
  const active = scene.beats.find((b) => f >= (b.from ?? 0) && f < (b.from ?? 0) + (b.frames ?? 0));
  const fx = scene.fx ?? [];
  const q = ease(f / tr);
  const w = (1 - q);
  const wrap: React.CSSProperties = { ...abs, background: '#000' };
  if (trans === 'blur') Object.assign(wrap, { opacity: q, filter: `blur(${w * 30}px)`, transform: `scale(${1 + w * 0.07})` });
  if (trans === 'fade') Object.assign(wrap, { opacity: q });
  if (trans === 'whip') Object.assign(wrap, { transform: `translateX(${w * W}px)`, filter: `blur(${w * 45}px)` });
  const veil = trans === 'dip' ? 1 - clamp((f - 2) / tr) : trans === 'flash' ? 1 - clamp(f / tr) : 0;
  const dipOut = outDip ? clamp((f - (total - outDip)) / outDip) : 0;
  const cast = scene.cast ?? [];
  const cam = scene.cam ?? 'drift';
  return (
    <AbsoluteFill style={wrap}>
      <AbsoluteFill style={{ transform: camTransform(cam, p, f), transformOrigin: '50% 60%' }}>
        <div style={{ ...abs, filter: cast.length ? 'blur(2.5px)' : 'none' }}><Scenery id={scene.bg} f={f} p={p} layer="back" /></div>
        {fx.includes('fog') || fx.includes('fog2') ? <Fog f={f} amount={fx.includes('fog2') ? 0.95 : 0.5} y={scene.bg === 'loja' ? 1000 : 880} /> : null}
        <svg width={W} height={H} style={abs}>
          {cast.map((c: CastItem) => {
            const def = bible.characters[c.id];
            if (!def) return null;
            const bust = c.pose === 'bust';
            const x = (bust ? BUST : SPOT)[c.pos];
            const lying = c.pose === 'lying';
            const look = c.pos === 'left' ? 0.8 : c.pos === 'right' ? -0.8 : 0;
            return (
              <g key={c.id} transform={`translate(${x} ${bust ? 1345 : lying ? 1300 : 1250}) scale(${bust ? 1.5 : 1.55})`}>
                <Character def={def} mood={c.mood} talking={active?.who === c.id} mouth={active?.who === c.id ? active.env?.[f - (active.from ?? 0)] : undefined} frame={f} pose={c.pose} prop={c.prop} look={look} />
              </g>
            );
          })}
        </svg>
        <Scenery id={scene.bg} f={f} p={p} layer="front" />
        {fx.includes('flicker') && <Flicker f={f} />}
        {fx.includes('dust') && <Dust f={f} />}
        {cast.map((c) => c.tag && <Tag key={c.id} life={c.tagFrames ?? 90} text={c.tag} color={bible.characters[c.id]?.top ?? '#444'} x={(c.pose === 'bust' ? BUST : SPOT)[c.pos]} y={c.pose === 'bust' ? 1010 : 1262} />)}
      </AbsoluteFill>
      <Grain f={f} />
      <Vignette />
      {scene.title && <Title text={scene.title} />}
      {scene.plate && <Plate text={scene.plate} />}
      {scene.note && <Note text={scene.note} />}
      {scene.beats.map((b, i) => (
        <Sequence key={i} from={b.from ?? 0} durationInFrames={b.frames ?? 1}>
          {b.audio && <Audio src={staticFile(b.audio)} />}
          <Sfx beat={b} />
          {b.kinetic && <Kinetic text={b.kinetic} />}
          <Caption beat={b} />
        </Sequence>
      ))}
      {scene.amb && <AmbBed kind={scene.amb} />}
      {TRANS_SFX[trans] && <Audio src={staticFile(`sfx/${TRANS_SFX[trans]}.mp3`)} volume={SFX_VOL[TRANS_SFX[trans]!]} />}
      {veil > 0 && <div style={{ ...abs, background: trans === 'flash' ? '#fff' : '#000', opacity: veil }} />}
      {dipOut > 0 && <div style={{ ...abs, background: '#000', opacity: dipOut }} />}
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(f / 6) * 0.03;
  const box = (bg: string, d: number): React.CSSProperties => ({ background: bg, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 70, padding: '34px 40px', borderRadius: 24, margin: '0 60px 36px', textAlign: 'center', boxShadow: '0 10px 0 rgba(0,0,0,.35)', transform: `scale(${spring({ frame: f - d, fps, config: { damping: 11 } })})` });
  const t = parse(tl.choice ? tl.choice.prompt : tl.nextTitle ?? '');
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 35%, #2a3350, #0a0d18)', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Audio src={staticFile('sfx/ding.mp3')} volume={0.45} />
      <Fog f={f} amount={0.7} y={700} />
      <Dust f={f} />
      {tl.choice ? (
        <>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 80, color: GOLD, padding: '0 60px', marginBottom: 70, transform: `scale(${s})` }}>{tl.choice.prompt}</div>
          <div style={box('#2f6fdd', 10)}>A · {tl.choice.a}</div>
          <div style={box('#d9432b', 22)}>B · {tl.choice.b}</div>
          <div style={{ fontFamily: FONT, fontSize: 56, color: '#fff', marginTop: 50 }}>Vote in the comments!</div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 64, color: '#fff', opacity: 0.8, letterSpacing: 6 }}>PART {tl.ep + 1}</div>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 98, padding: '0 60px', lineHeight: 1.1 }}>
            <AnimWords words={t} starts={t.map((_, i) => 6 + i * 4)} mode="pop" accent={RED} color={GOLD} gap={22} />
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: '#fff', marginTop: 70, background: RED, padding: '24px 56px', borderRadius: 999, transform: `scale(${pulse})`, boxShadow: '0 0 60px rgba(255,90,60,.5)' }}>LIKE AND SUBSCRIBE</div>
        </>
      )}
      <Grain f={f} /><Vignette />
    </AbsoluteFill>
  );
};

export const Episode: React.FC<{ timeline: Timeline; bible: Bible }> = ({ timeline, bible }) => {
  const scenesEnd = timeline.totalFrames - timeline.ctaFrames;
  const sc = timeline.scenes;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {timeline.ambient && <Audio src={staticFile(`audio/ambient-${timeline.ambient}.mp3`)} volume={0.1} loop />}
      {sc.map((s, i) => {
        const trans = s.trans ?? (i === 0 ? 'fade' : 'blur');
        const tr = TR[trans];
        const next = sc[i + 1];
        const nextTrans = next ? next.trans ?? 'blur' : 'blur';
        const nextTr = next ? TR[nextTrans] : TR.blur;
        return (
          <Sequence key={i} from={s.from ?? 0} durationInFrames={(s.frames ?? 1) + nextTr}>
            <SceneView scene={s} bible={bible} tr={tr} trans={trans} outDip={next && nextTrans === 'dip' ? TR.dip : 0} />
          </Sequence>
        );
      })}
      <Sequence from={scenesEnd} durationInFrames={timeline.ctaFrames}>
        <Cta tl={timeline} />
      </Sequence>
    </AbsoluteFill>
  );
};
