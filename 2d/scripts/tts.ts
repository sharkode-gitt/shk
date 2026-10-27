// Voz: ElevenLabs (ELEVENLABS_API_KEY) -> edge-tts -> null (tempo estimado).
// Tudo em cache por hash: re-render nunca gasta credito de novo.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface Spoken { file: string; secs: number; ws?: number[]; env: number[] }
interface Opts { text: string; voiceId?: string; edgeVoice: string; root: string; fps: number; stability?: number }

const MODEL = process.env.ELEVEN_MODEL ?? 'eleven_multilingual_v2';
// chave: variavel ELEVENLABS_API_KEY, ou segredo de rede (proxy injeta o header xi-api-key no host api.elevenlabs.io)
const hdr = (): Record<string, string> => (process.env.ELEVENLABS_API_KEY ? { 'xi-api-key': process.env.ELEVENLABS_API_KEY } : {});
let resolved: string | undefined;
async function provider(): Promise<string> {
  if (process.env.TTS_PROVIDER) return process.env.TTS_PROVIDER;
  if (resolved) return resolved;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: hdr(), signal: AbortSignal.timeout(8000) });
    resolved = r.ok ? 'eleven' : 'edge';
    if (!r.ok) console.warn(`! ElevenLabs recusou a chave (${r.status}); usando fallback`);
  } catch { resolved = 'edge'; }
  return resolved;
}
const probe = (f: string) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// energia do audio por frame -> abertura da boca
export function envelope(file: string, fps: number): number[] {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1 << 28 });
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
  const n = Math.floor(8000 / fps), out: number[] = [];
  for (let i = 0; i + n <= pcm.length; i += n) {
    let a = 0; for (let k = 0; k < n; k++) a += pcm[i + k] ** 2;
    out.push(Math.sqrt(a / n));
  }
  const sorted = [...out].sort((x, y) => x - y);
  const hi = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const norm = out.map((v) => Math.min(1, v / hi));
  return norm.map((v, i) => +(((norm[i - 1] ?? v) * 0.25 + v * 0.5 + (norm[i + 1] ?? v) * 0.25) ** 0.8).toFixed(2));
}

// alignment por caractere (ElevenLabs) -> inicio de cada palavra em segundos
export function wordStartsFromAlignment(text: string, starts: number[]): number[] {
  const res: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] !== ' ' && (i === 0 || text[i - 1] === ' ')) res.push(starts[i] ?? 0);
  return res;
}

async function elevenlabs(o: Opts, out: string): Promise<number[] | undefined> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${o.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { ...hdr(), 'content-type': 'application/json' },
    body: JSON.stringify({ text: o.text, model_id: MODEL, voice_settings: { stability: o.stability ?? 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json();
  fs.writeFileSync(out, Buffer.from(j.audio_base64, 'base64'));
  const al = j.alignment ?? j.normalized_alignment;
  return al ? wordStartsFromAlignment(o.text, al.character_start_times_seconds) : undefined;
}

// provider de teste: sintetiza "fala" (pulsos de silaba) so p/ validar o pipeline
function mock(o: Opts, out: string): number[] {
  const words = o.text.split(' ');
  const dur = Math.max(1.1, words.length * 0.36);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='sin(2*PI*140*t)*0.5*(0.5+0.5*sin(2*PI*4.3*t))':d=${dur}:s=24000`, '-b:a', '64k', out]);
  return words.map((_, i) => (i * dur) / words.length);
}

export async function speak(o: Opts): Promise<Spoken | null> {
  const prov = await provider();
  const hash = crypto.createHash('sha1').update([prov, prov === 'eleven' ? o.voiceId : o.edgeVoice, MODEL, o.text].join('|')).digest('hex').slice(0, 16);
  const rel = `audio/cache/${hash}.mp3`;
  const abs = path.join(o.root, 'public', rel);
  const meta = abs.replace(/\.mp3$/, '.json');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs) && fs.existsSync(meta)) return { file: rel, ...JSON.parse(fs.readFileSync(meta, 'utf8')) };
  let starts: number[] | undefined;
  try {
    if (prov === 'mock') starts = mock(o, abs);
    else if (prov === 'eleven') {
      if (!o.voiceId) throw new Error('personagem sem voiceId (ElevenLabs)');
      starts = await elevenlabs(o, abs);
    } else execFileSync('edge-tts', ['--voice', o.edgeVoice, '--text', o.text, '--write-media', abs], { stdio: 'pipe', timeout: 30000 });
  } catch (e) {
    console.warn(`! TTS (${prov}) falhou: ${(e as Error).message.split('\n').pop()}`);
    return null;
  }
  const secs = probe(abs);
  const data = { secs, ws: starts?.map((s) => Math.round(s * o.fps)), env: envelope(abs, o.fps) };
  fs.writeFileSync(meta, JSON.stringify(data));
  return { file: rel, ...data };
}
