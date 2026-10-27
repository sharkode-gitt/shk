// uso: ANTHROPIC_API_KEY=... npx tsx scripts/gen.ts <story> <ep> ["tema (so no ep 1)"] ["escolha: A|B (so ep 5, 9...)"]
// Custo minimo: modelo pequeno, bíblia em prompt cacheado, so o resumo do ep anterior vai junto.
import fs from 'node:fs';
import path from 'node:path';

const [story, epArg, theme = '', picked = ''] = process.argv.slice(2);
const ep = Number(epArg);
const dir = path.resolve(import.meta.dirname, '..', 'stories', story);
fs.mkdirSync(dir, { recursive: true });
const arcPos = ((ep - 1) % 4) + 1; // 1..4 dentro do arco
const bible = fs.existsSync(`${dir}/bible.json`) ? fs.readFileSync(`${dir}/bible.json`, 'utf8') : '(crie uma bible nova no campo "bible")';
const memPath = `${dir}/memory.md`;
const memory = fs.existsSync(memPath) ? fs.readFileSync(memPath, 'utf8') : '';

const SYSTEM = `Voce escreve roteiros de videos curtos 2D (9:16) em portugues do Brasil, historias de suspense/misterio em episodios de 60-120s (~14-22 beats curtos).
Responda SOMENTE JSON valido: {"episode":<EpisodeScript>,"summary":"<=80 palavras do que aconteceu","bible":<so se nova>}.
EpisodeScript: {story,ep,title,nextTitle,choice?,scenes:[{bg,title?,plate?,note?,cam,cast?:[{id,pos:left|center|right,mood:neutral|angry|sad|scared|happy,pose?,prop?,tag?}],beats:[{who:"narr"|idPersonagem,t,kinetic?}]}]}.
Regras: [colchetes] destacam palavra no texto e no titulo; beats com no maximo 14 palavras; cam em {none,zoom_in,zoom_out,pan_l,pan_r,shake}; bg em {porta,sala,corredor} ou id novo.
Gancho forte nos 3 primeiros segundos. Termine cada episodio em cliffhanger e defina nextTitle. Se for o ultimo do arco (4o), NAO use nextTitle: defina choice {prompt,a,b} com dois caminhos claros.
Bible dos personagens (cacheada):\n${bible}`;

const user = [
  `Historia: ${story}. Episodio ${ep} (posicao ${arcPos}/4 do arco).`,
  theme && `Tema: ${theme}.`,
  memory && `Resumo ate aqui:\n${memory}`,
  picked && `O publico escolheu: ${picked}. Continue por esse caminho.`,
].filter(Boolean).join('\n');

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: process.env.MODEL ?? 'claude-haiku-5-5',
    max_tokens: 3500,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  }),
});
const data: any = await res.json();
if (!res.ok) throw new Error(JSON.stringify(data));
const txt: string = data.content[0].text;
const out = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
if (out.bible) fs.writeFileSync(`${dir}/bible.json`, JSON.stringify(out.bible, null, 1));
fs.writeFileSync(`${dir}/ep${ep}.json`, JSON.stringify({ story, ep, ...out.episode }, null, 1));
fs.appendFileSync(memPath, `\nEp${ep}: ${out.summary}`);
console.log(`ep${ep} ok · tokens in/out: ${data.usage.input_tokens}/${data.usage.output_tokens} (cache read ${data.usage.cache_read_input_tokens ?? 0})`);
