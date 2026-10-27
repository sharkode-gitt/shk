export type Cam = 'drift' | 'none' | 'zoom_in' | 'zoom_out' | 'pan_l' | 'pan_r' | 'shake';
export type Mood = 'neutral' | 'angry' | 'sad' | 'scared' | 'happy';

export interface CharDef {
  name: string;
  skin: string;
  hair: string;
  hairStyle: 'long' | 'short' | 'bun' | 'bald' | 'curly';
  top: string;
  pants: string;
  old?: boolean;
  voice?: string; // edge-tts (fallback)
  voiceId?: string; // ElevenLabs voice_id
  lashes?: boolean;
  build?: number; // largura do corpo (1 = normal)
  outfit?: 'tee' | 'jacket' | 'dress' | 'uniform' | 'coat' | 'turnout' | 'sweater'; // turnout = uniforme de bombeiro (faixas refletivas)
  hat?: 'helmet' | 'crown' | 'fedora' | 'tophat'; // helmet = capacete de bombeiro
  mask?: 'skull'; // mascara de caveira dourada sobre o rosto
  fur?: boolean; // gola de pele no casaco
  bag?: boolean; // bolsa a tiracolo
  badge?: string; // numero no distintivo do capacete
  mustache?: boolean;
  top2?: string; // cor secundaria (camisa sob a jaqueta, listras)
  beard?: boolean;
  glasses?: boolean;
  lips?: string;
}
export interface Bible {
  title: string;
  narrator: string;
  narratorId?: string; // ElevenLabs voice_id do narrador
  characters: Record<string, CharDef>;
}

export interface CastItem {
  id: string;
  pos: 'left' | 'center' | 'right';
  mood?: Mood;
  pose?: 'stand' | 'lying' | 'bust'; // bust = so busto (dentro do carro)
  prop?: 'axe' | 'none';
  tag?: string;
  tagFrames?: number; // quanto tempo o nome fica na tela (padrao 90 = 3 s)
}
// text: [colchetes] = palavra destacada
export type TextMode = 'pop' | 'slide' | 'type' | 'shake' | 'glitch' | 'wave';
export type Trans = 'blur' | 'fade' | 'whip' | 'dip' | 'flash';
export interface Beat {
  who: string;
  anim?: TextMode; // animacao da legenda (padrao: slide) // 'narr' ou id de personagem
  t: string;
  kinetic?: string; // texto grande tipo "TOC TOC TOC"
  sfx?: string | { name: string; at?: number; vol?: number }; // efeito sonoro no inicio da fala (at = segundos)
  audio?: string; // preenchido pelo build
  ws?: number[]; // inicio de cada palavra em frames (build, vem do TTS)
  env?: number[]; // abertura da boca 0..1 por frame (build, vem do audio)
  from?: number; // frames, relativo a cena (build)
  frames?: number; // (build)
}
export interface Scene {
  bg: string;
  title?: string;
  plate?: string;
  note?: string;
  cam?: Cam;
  amb?: 'car' | 'wind' | 'store' | 'dark'; // som ambiente em loop da cena
  trans?: Trans; // transicao de ENTRADA desta cena
  fx?: ('fog' | 'fog2' | 'dust' | 'flicker')[];
  cast?: CastItem[];
  beats: Beat[];
  from?: number; // (build)
  frames?: number; // (build)
}
export interface Choice {
  prompt: string;
  a: string;
  b: string;
}
export interface EpisodeScript {
  story: string;
  ep: number;
  title: string;
  nextTitle?: string;
  ambient?: 'dark';
  choice?: Choice; // no episodio 4 de cada arco
  scenes: Scene[];
}
export interface Timeline extends EpisodeScript {
  fps: number;
  totalFrames: number;
  ctaFrames: number;
}
export const FPS = 30;
export const W = 1080;
export const H = 1920;
