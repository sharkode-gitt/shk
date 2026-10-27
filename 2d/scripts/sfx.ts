// Biblioteca de efeitos sonoros gerada por codigo (ffmpeg), gratis e offline.
// Opcional: SFX_PROVIDER=eleven gera os mesmos nomes pela API de efeitos da ElevenLabs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ae = (expr: string, d: number) => `aevalsrc='${expr}':d=${d}:s=44100`;
const noise = (c: string, d: number) => `anoisesrc=d=${d}:c=${c}:a=0.8:r=44100`;

interface Def { inputs: string[]; filter?: string; prompt: string }
// [0], [1]... = inputs; ultimo no do filtro deve se chamar [out]
const DEFS: Record<string, Def> = {
  knock: { prompt: 'three heavy knocks on a wooden door, close mic', inputs: [ae('sin(2*PI*85*t)*exp(-28*t)+0.35*sin(2*PI*900*t)*exp(-110*t)', 0.3)],
    filter: '[0]asplit=3[a][b][c];[b]adelay=230|230[b2];[c]adelay=470|470[c2];[a][b2][c2]amix=inputs=3:normalize=0,volume=1.6[out]' },
  buzz: { prompt: 'flickering neon sign electric buzz and crackle', inputs: [ae('(sin(2*PI*100*t)*0.5+sin(2*PI*220*t)*0.25+(random(0)*2-1)*0.3)*(0.5+0.5*sin(2*PI*17*t))*gt(sin(2*PI*5*t),-0.35)', 1.0)],
    filter: '[0]lowpass=f=3500,highpass=f=70,volume=0.9[out]' },
  whoosh: { prompt: 'fast cinematic whoosh transition', inputs: [noise('white', 0.7)],
    filter: '[0]highpass=f=400,lowpass=f=5500,afade=t=in:d=0.32,afade=t=out:st=0.32:d=0.38,volume=0.9[out]' },
  swish: { prompt: 'soft airy swish', inputs: [noise('pink', 0.55)],
    filter: '[0]highpass=f=600,lowpass=f=3500,afade=t=in:d=0.28,afade=t=out:st=0.28:d=0.27,volume=0.55[out]' },
  boom: { prompt: 'deep cinematic boom with long tail', inputs: [ae('sin(2*PI*(70-45*t)*t)*exp(-3*t)', 1.8), noise('brown', 1.8)],
    filter: '[1]lowpass=f=170,afade=t=out:st=0:d=1.8,volume=0.7[n];[0][n]amix=inputs=2:normalize=0,volume=1.5[out]' },
  impact: { prompt: 'sharp horror impact hit', inputs: [ae('sin(2*PI*(120-95*t)*t)*exp(-9*t)+(random(0)*2-1)*exp(-35*t)*0.55', 0.8)],
    filter: '[0]volume=1.4[out]' },
  heartbeat: { prompt: 'slow tense heartbeat', inputs: [ae('sin(2*PI*55*t)*exp(-16*t)', 0.4)],
    filter: '[0]asplit=4[a][b][c][d];[b]adelay=280|280,volume=0.8[b2];[c]adelay=1100|1100[c2];[d]adelay=1380|1380,volume=0.8[d2];[a][b2][c2][d2]amix=inputs=4:normalize=0,apad=pad_dur=0.3,volume=1.8[out]' },
  swell: { prompt: 'dark rising tension riser', inputs: [ae('sin(2*PI*(80+70*t)*t)*0.4*t/2.5', 2.5), noise('pink', 2.5)],
    filter: '[1]lowpass=f=1400,afade=t=in:d=2.3,afade=t=out:st=2.3:d=0.2,volume=0.5[n];[0][n]amix=inputs=2:normalize=0[out]' },
  glitch: { prompt: 'digital glitch stutter', inputs: [ae('(random(0)*2-1)*gt(sin(2*PI*23*t),0.45)*0.7', 0.5)],
    filter: '[0]acrusher=bits=5:mode=log:aa=1,highpass=f=200[out]' },
  stinger: { prompt: 'dissonant horror violin stinger', inputs: [ae('(sin(2*PI*466*t)+sin(2*PI*493*t)+0.5*sin(2*PI*698*t))*exp(-2*t)*0.3*(0.7+0.3*sin(2*PI*6*t))', 2.0)],
    filter: '[0]volume=1.3[out]' },
  static: { prompt: 'radio static with faint whispers', inputs: [noise('white', 1.6)],
    filter: '[0]bandpass=f=1800:width_type=h:w=1400,tremolo=f=9:d=0.7,afade=t=in:d=0.1,afade=t=out:st=1.3:d=0.3,volume=0.6[out]' },
  ding: { prompt: 'soft notification chime', inputs: [ae('0.6*sin(2*PI*880*t)*exp(-5*t)+0.3*sin(2*PI*1320*t)*exp(-7*t)', 1.2)] },
  creak: { prompt: 'slow creaking wooden door', inputs: [ae('0.3*sin(2*PI*(180+60*sin(2*PI*3*t))*t)*(0.5+0.5*sin(2*PI*1.3*t))', 1.6)],
    filter: '[0]lowpass=f=1500,afade=t=out:st=1.2:d=0.4[out]' },
  // ambientes (loop de 20s)
  amb_car: { prompt: 'car interior engine hum at night, loop', inputs: [noise('brown', 20), ae('0.25*sin(2*PI*62*t)*(0.8+0.2*sin(2*PI*7*t))', 20)],
    filter: '[0]lowpass=f=260,volume=1.6[n];[n][1]amix=inputs=2:normalize=0,afade=t=in:d=1,afade=t=out:st=19:d=1[out]' },
  amb_wind: { prompt: 'cold night wind through pine forest, loop', inputs: [noise('pink', 20)],
    filter: '[0]lowpass=f=700,tremolo=f=0.2:d=0.7,volume=1.4,afade=t=in:d=1.5,afade=t=out:st=18.5:d=1.5[out]' },
  amb_store: { prompt: 'old store electric hum and fridge buzz, loop', inputs: [ae('0.2*sin(2*PI*60*t)+0.12*sin(2*PI*120*t)+0.07*sin(2*PI*180*t)', 20), noise('pink', 20)],
    filter: '[1]lowpass=f=300,volume=0.25[n];[0][n]amix=inputs=2:normalize=0,afade=t=in:d=1,afade=t=out:st=19:d=1[out]' },
  amb_dark: { prompt: 'low dark drone, ominous, loop', inputs: ['sine=f=52:d=20', 'sine=f=55.5:d=20', noise('brown', 20)],
    filter: '[0][1]amix=inputs=2[d];[2]lowpass=f=500[n];[d][n]amix=inputs=2,tremolo=f=0.12:d=0.5,volume=2.2,afade=t=in:d=1,afade=t=out:st=19:d=1[out]' },
};

async function eleven(name: string, d: Def, out: string) {
  const loop = name.startsWith('amb_');
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { ...(process.env.ELEVENLABS_API_KEY ? { 'xi-api-key': process.env.ELEVENLABS_API_KEY } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ text: d.prompt, duration_seconds: loop ? 20 : undefined, loop, prompt_influence: 0.4 }),
  });
  if (!r.ok) throw new Error(`ElevenLabs SFX ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
}

export function ensureSfx(root: string) {
  const dir = path.join(root, 'public', 'sfx');
  fs.mkdirSync(dir, { recursive: true });
  const useEleven = process.env.SFX_PROVIDER === 'eleven';
  for (const [name, d] of Object.entries(DEFS)) {
    const out = path.join(dir, `${name}.mp3`);
    if (fs.existsSync(out)) continue;
    if (useEleven) { eleven(name, d, out).catch((e) => console.warn(`! sfx ${name}: ${e.message}`)); continue; }
    const args = ['-y', '-v', 'error'];
    for (const i of d.inputs) args.push('-f', 'lavfi', '-i', i);
    if (d.filter) args.push('-filter_complex', d.filter, '-map', '[out]');
    args.push('-ac', '2', '-ar', '44100', '-b:a', '128k', out);
    execFileSync('ffmpeg', args);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) ensureSfx(path.resolve(import.meta.dirname, '..'));
