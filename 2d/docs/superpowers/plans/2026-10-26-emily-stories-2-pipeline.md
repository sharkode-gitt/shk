# Emily Stories, Plano 2: Pipeline automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o motor do Plano 1 a um pipeline automático: o Claude escreve o roteiro, você aprova pela CLI, o ElevenLabs gera as vozes com tempos de palavra, e `story make` entrega o `final.mp4`. Agendado no Windows.

**Architecture:** Uma CLI (`src/cli.ts`) sobre um armazenamento de jobs em arquivos (`jobs/<id>/`, com `status.json` controlando a máquina de estados). Cada etapa (`write`, `voice`, `make`) é um módulo com dependências injetadas (cliente Claude, `fetch` do ElevenLabs), testável com fakes e sem gastar créditos.

**Tech Stack:** O do Plano 1, mais `@anthropic-ai/sdk` (structured outputs com `zodOutputFormat`), `fetch` nativo do Node para o ElevenLabs e `dotenv`.

**Spec:** `docs/superpowers/specs/2026-10-26-emily-stories-design.md`. **Pré-requisito:** o Plano 1 concluído (`compileTimeline`, `writeComposition`, `renderComp`, `normalizeLoudness`, `runChecks`, `validateStory`).

## Global Constraints

- O modelo padrão do roteiro é `claude-opus-5-5`, com `output_config.effort: "high"`; o `thinking` não é enviado. Configurável em `config.json` (`writer.model`).
- Recusas: beta `server-side-fallback-2026-07-01` + `fallbacks: "default"`. Sempre checar `stop_reason === "refusal"` antes de ler o conteúdo.
- ElevenLabs: modelo `eleven_v3`, endpoint `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`, formato de saída `mp3_44100_128`.
- O roteiro tem de 110 a 150 palavras, de 2 a 4 personagens (sempre com a Emily) e no máximo 3 cenários. Precisa ter gancho nos 2 primeiros segundos, reviravolta no final e conteúdo seguro, sem marcas.
- Novas tentativas: roteiro inválido até 3 vezes; erro temporário do ElevenLabs até 5 vezes com espera crescente (1, 2, 4, 8, 16 s).
- Segredos só em `.env` (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`), que nunca são logados nem commitados.
- Estados do job: `drafted → approved → voiced → built → rendered`, além de `rejected`, `failed` e `needs-review`.

## Review Focus

1. **`story make` rodado duas vezes no mesmo job** (ou depois de uma queda no meio): não pode gastar créditos de novo nem duplicar arquivos. Deve retomar da primeira etapa incompleta. Teste na Task 2 e na Task 6.
2. **Créditos do ElevenLabs esgotados no meio de um lote**: os jobs já renderizados ficam como estão; o atual e os próximos continuam `approved`, com aviso claro. Nenhum vira `failed`. Teste na Task 4.
3. **Falas com marcações de emoção**: a marcação vai para o TTS, mas não pode aparecer nos tempos de palavra usados na legenda. Teste na Task 4.
4. **Roteiro repetido**: o prompt precisa incluir os títulos dos últimos 30 jobs, inclusive os rejeitados. Teste na Task 3.
5. **`.env` sem chave**: o erro aparece antes de qualquer chamada, citando o nome da variável, e não depois de um render parcial. Teste na Task 1.

---

## Estrutura de arquivos (Plano 2)

```
src/config.ts            loadConfig(), requireEnv()
src/jobs/store.ts        createJob(), readStatus(), setStatus(), listJobs(), jobPath()
src/write/prompt.ts      buildPrompt()
src/write/write.ts       writeStory(), rejectStory()
src/write/markdown.ts    storyMarkdown()
src/voice/eleven.ts      synthesize() (cliente + cache + retentativas)
src/voice/timing.ts      wordsFromAlignment()
src/voice/voice.ts       voiceJob()
src/make.ts              makeJob()
src/cli.ts               comandos
config.json, .env.example
assets/voices.json, assets/music/<clima>/, assets/sfx/, assets/sfx/map.json, assets/LICENSES.md
scripts/schedule.ps1
```

---

### Task 1: Config e segredos

**Files:** Create `src/config.ts`, `config.json`, `.env.example`; Test `tests/config.test.ts`

**Interfaces:**
- Produces: `type Config = { writer: { model: string; effort: 'low'|'medium'|'high'|'xhigh'|'max' }; voice: { model: 'eleven_v3'; format: 'mp3_44100_128' }; paths: { jobs: string; cache: string; assets: string } }`; `loadConfig(path = 'config.json'): Config` (validada com zod); `requireEnv(name: 'ANTHROPIC_API_KEY'|'ELEVENLABS_API_KEY'): string`.
- O `config.json` inicial traz `writer.model: "claude-opus-5-5"`, `effort: "high"`, os paths `jobs`, `cache` e `assets`.

- [ ] **Step 1: Testes**
  - O config válido carrega.
  - Um `effort` inválido falha citando o campo.
  - **Review Focus 5:** `requireEnv('ELEVENLABS_API_KEY')` sem a variável lança um erro com o nome dela e a dica "add it to .env".
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar** (carregar `dotenv` uma vez no `cli.ts`, não no `config.ts`). **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: config and env loading`

---

### Task 2: Armazenamento de jobs e máquina de estados

**Files:** Create `src/jobs/store.ts`; Test `tests/jobs/store.test.ts`

**Interfaces:**
- Produces: `type JobState = 'drafted'|'approved'|'voiced'|'built'|'rendered'|'rejected'|'failed'|'needs-review'`; `type JobStatus = { id: string; state: JobState; title?: string; history: { state: JobState; at: string; note?: string }[]; error?: string }`.
- Produces: `newJobId(now: Date, existing: string[]): string` (formato `YYYY-MM-DD-NNN`), `createJob(root, id): string`, `readStatus(root, id): JobStatus`, `setStatus(root, id, state, note?)`, `listJobs(root): JobStatus[]` (os mais recentes primeiro), `jobPath(root, id, ...parts)`.
- Transições permitidas:
  - `drafted→approved|rejected|failed`
  - `approved→voiced|failed`
  - `voiced→built|failed`
  - `built→rendered|failed|needs-review`
  - `failed→approved` (tentar de novo)
  - `needs-review→approved|rendered`
  - Qualquer outra transição lança erro.
- `setStatus` grava o arquivo de forma atômica (escreve `status.json.tmp` e renomeia).

- [ ] **Step 1: Testes**
  - Os ids são sequenciais no mesmo dia (`-001`, `-002`).
  - Uma transição inválida (`drafted→rendered`) lança erro.
  - O histórico acumula as entradas.
  - `listJobs` ordena por id em ordem decrescente.
  - **Review Focus 1:** um `status.json.tmp` órfão é ignorado na leitura.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: file-based job store`

---

### Task 3: Escrita do roteiro com o Claude

**Files:** Create `src/write/prompt.ts`, `src/write/write.ts`, `src/write/markdown.ts`, `assets/hero.json`; Test `tests/write/prompt.test.ts`, `tests/write/write.test.ts`, `tests/write/markdown.test.ts`

**Interfaces:**
- Consumes: `StorySchema`, `validateStory`, `vocab.ts`, o job store.
- Produces: `assets/hero.json` = `{ "name": "Emily", "age": 12, "personality": "kind, a little shy, underestimated, gets the last word", "look": "long black hair, tilted gold crown, coral sweater, grey denim shorts, black crossbody bag" }`. Ajustar o texto com o usuário no Step 1.
- Produces: `type Hero = { name: string; age: number; personality: string; look: string }` (o formato de `assets/hero.json`).
- Produces: `buildPrompt(opts: { hero: Hero; recentTitles: string[]; idea?: string; rejectNote?: string; previous?: Story }): { system: string; user: string }`. O `system` é estável (persona, regras da spec §2 e §4, o vocabulário inteiro, como usar `wants`, as marcações do Eleven v3); o `user` é variável (ideia, títulos recentes, nota de rejeição + roteiro anterior). Separar assim mantém o cache de prompt.
- Produces: `writeStory(deps: { client: StoryClient; root: string; config: Config }, opts: { idea?: string }): Promise<string /* jobId */>` e `rejectStory(deps, id: string, note: string): Promise<string /* novo jobId */>`. O job antigo vira `rejected`; o novo nasce `drafted`.
- `StoryClient` = `{ generate(system: string, user: string): Promise<{ kind: 'ok'; json: unknown } | { kind: 'refusal'; category: string | null }> }`. A implementação real (`anthropicStoryClient(config)`) usa `client.beta.messages.parse` com:
  - `model: config.writer.model`, `max_tokens: 16000`;
  - `output_config: { effort, format: zodOutputFormat(StorySchemaForModel) }`;
  - `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`;
  - `system` com `cache_control: { type: 'ephemeral' }`.
  - Se `beta.messages.parse` não existir na versão instalada do SDK, usar `client.messages.parse` sem `fallbacks` e registrar isso num comentário.
  - `StorySchemaForModel` é o schema sem os `superRefine` (structured outputs não leva regras entre campos). As regras rodam depois, em `validateStory`.
- Fluxo:
  - `generate` → `validateStory`. Se der erro, chamar `generate` de novo com o `user` + "Your previous output failed validation: <erros>". **No máximo 3 tentativas**; depois disso, o job fica `failed` com os erros.
  - Uma recusa encerra direto em `failed` com a categoria.
  - Em caso de sucesso, gravar `story.json`, `story.md` e o estado `drafted` com o título.
- Produces: `storyMarkdown(story: Story, estSeconds: number): string`. Traz o título, a duração estimada (palavras / 2,7 palavras por segundo), a lista de cenários, as falas numeradas (`**Emily (narration):** …` / `**Mia:** …`) sem as marcações de emoção, e uma seção `## ⚠ Wants` só quando `wants` não está vazio.

- [ ] **Step 1: Testes do prompt**
  - O `system` contém todo item de `SETS`, `ACTS`, `FACES` e `VOICES`.
  - O `system` é idêntico entre duas chamadas com ideias diferentes (cache).
  - **Review Focus 4:** o `user` lista os 30 títulos recentes passados e só eles (31 passados → 30 usados).
  - A nota de rejeição e o roteiro anterior aparecem no `user`.
- [ ] **Step 2: Testes de `writeStory` com um client falso**
  - Primeira resposta inválida e segunda válida: o job fica `drafted` e o client foi chamado 2 vezes com o erro de validação no segundo `user`.
  - 3 respostas inválidas: o job fica `failed`.
  - Recusa: o job fica `failed` e o erro cita a categoria.
  - `rejectStory` marca o antigo como `rejected` e cria um novo.
- [ ] **Step 3: Testes do markdown**: não aparece nenhum `[` de marcação; a seção Wants só aparece quando não está vazia; a duração estimada é calculada pelas palavras.
- [ ] **Step 4: Rodar os testes e confirmar a falha.** **Step 5: Implementar.** **Step 6: Rodar os testes e confirmar que passam.**
- [ ] **Step 7: Commit** `feat: Claude story writer with validation retries`

---

### Task 4: Vozes com o ElevenLabs

**Files:** Create `src/voice/eleven.ts`, `src/voice/timing.ts`, `src/voice/voice.ts`, `assets/voices.json`; Test `tests/voice/timing.test.ts`, `tests/voice/eleven.test.ts`, `tests/voice/voice.test.ts`

**Interfaces:**
- Produces: `assets/voices.json` = `{ "emily": "<voice_id>", "mom": "…", "dad": "…", "teen_girl": "…", "little_brother": "…", "boy": "…", "teacher": "…", "old_lady": "…" }`.
  - **Passo manual:** o usuário escolhe as vozes na Voice Library do ElevenLabs. A da Emily tem que soar como uma menina de cerca de 12 anos.
  - O teste falha se algum valor estiver vazio.
- Produces: `wordsFromAlignment(text: string, alignment: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): WordTiming[]`.
  - Agrupa os caracteres em palavras pelos espaços.
  - **Pula os caracteres que estão dentro de `[...]`**, que viram tempo morto e não geram palavra.
  - Uma palavra começa no primeiro caractere e termina no último.
- Produces: `synthesize(deps: { fetch: typeof fetch; apiKey: string; cacheDir: string; sleep?: (ms) => Promise<void> }, req: { text: string; voiceId: string; model: string; format: string }): Promise<{ mp3: string /* caminho */; words: WordTiming[]; duration: number; cached: boolean }>`.
  - A chave do cache é o sha256 de `text|voiceId|model|format`. Grava `<hash>.mp3` e `<hash>.json`.
  - Request: `POST` com o header `xi-api-key` e corpo `{ text, model_id, output_format }`. A resposta traz `{ audio_base64, alignment }`.
  - Erros:
    - 429 ou 5xx: até 5 novas tentativas com espera de 1, 2, 4, 8 e 16 s (via `deps.sleep`).
    - 401 com `detail.status === 'quota_exceeded'`: lança `QuotaExceededError`.
    - Outros 4xx: lança `ElevenError` com o corpo da resposta.
  - `duration` = o último `end` do alinhamento.
- Produces: `voiceJob(deps, root, id): Promise<void>`.
  - Para cada beat, sintetiza `narrate` com a voz da Emily, ou `say.line` com a voz do `cast[who].voice` (`emily` para `ref:'hero'`).
  - Copia o mp3 para `jobs/<id>/audio/<scene>.<beat>.mp3`.
  - Grava `timing.json` no formato `Timing` do Plano 1 e marca o job como `voiced`.
  - `QuotaExceededError` sobe sem mudar o estado do job, que continua `approved`.

- [ ] **Step 1: Testes de timing**
  - "Hi mom" com os tempos dos caracteres dá 2 palavras com os inícios e fins corretos.
  - **Review Focus 3:** "[sad] Hi" dá 1 palavra ("Hi"), e nenhuma palavra contém `[`.
- [ ] **Step 2: Testes de `synthesize` com `fetch` falso**
  - Na segunda chamada idêntica, `cached: true` e o fetch é chamado 1 vez só.
  - 429, 429 e depois 200: dá certo, e o `sleep` foi chamado com 1000 e 2000.
  - 6 respostas 500: lança erro.
  - 401 com quota esgotada: lança `QuotaExceededError`.
- [ ] **Step 3: Testes de `voiceJob`**
  - Gera um mp3 por beat e o `timing.json` passa no `compileTimeline` do Plano 1.
  - Rodar 2 vezes não faz nenhuma chamada nova (cache).
  - **Review Focus 2:** uma quota esgotada no terceiro beat deixa o job `approved`.
- [ ] **Step 4: Rodar os testes e confirmar a falha.** **Step 5: Implementar.** **Step 6: Rodar os testes e confirmar que passam.**
- [ ] **Step 7: Commit** `feat: ElevenLabs voices with word timings and cache`

---

### Task 5: Acervo de música e efeitos

**Files:** Create `assets/music/{sad,tense,happy,funny,twist}/*.mp3`, `assets/sfx/*.mp3`, `assets/sfx/map.json`, `assets/LICENSES.md`; Test `tests/assets.test.ts`

**Interfaces:**
- Produces: `assets/sfx/map.json` com as chaves `cut`, `act:fall`, `act:shocked`, `act:jump`, `act:cry`, `act:laugh`, `act:hug`, `act:wave` → nome de arquivo em `assets/sfx/`.
- Produces: pelo menos 2 faixas por clima, com 60 s ou mais cada (ou feitas para loop), em mp3 44,1 kHz.
- Fonte: a skill `media-use` (`resolve --type sfx` não precisa de conta; para música, `resolve --type bgm` precisa da CLI da HeyGen). Se `bgm` não estiver disponível, usar faixas CC0 ou CC-BY baixadas manualmente. Cada arquivo ganha uma linha em `LICENSES.md` (arquivo, fonte, licença, autor).

- [ ] **Step 1: Teste**
  - Todo arquivo citado no `map.json` existe.
  - Cada clima tem 2 faixas ou mais.
  - Todo arquivo em `assets/music` e `assets/sfx` aparece em `LICENSES.md`.
- [ ] **Step 2: Rodar o teste e confirmar a falha.** **Step 3: Montar o acervo com a `media-use`.** **Step 4: Rodar o teste e confirmar que passa.**
- [ ] **Step 5: Commit** `chore: music and sfx library with licenses`

---

### Task 6: `make` (voz → build → render) com retomada

**Files:** Create `src/make.ts`; Test `tests/make.test.ts`

**Interfaces:**
- Consumes: `voiceJob`; do Plano 1, `compileTimeline`, `writeComposition`, `renderComp`, `normalizeLoudness`, `runChecks`; `seedFromId`.
- Produces: `type BuildFn = (root: string, id: string) => Promise<void>` (lê `story.json` + `timing.json` e escreve `comp/`); `type RenderFn = (root: string, id: string) => Promise<{ checks: { ok: boolean; failures: string[] }; renderSeconds: number }>`. As implementações reais (`realBuild`, `realRender`) ficam em `make.ts`, usando as funções do Plano 1.
- Produces: `makeJob(deps: { voice: typeof voiceJob; build: BuildFn; render: RenderFn }, root, id): Promise<JobState>`. Por estado:
  - `approved` → voz → `voiced`.
  - `voiced` → `compileTimeline` + `writeComposition` (música vinda de `assets/music`, `map.json` de efeitos) → `built`.
  - `built` → `renderComp` → `normalizeLoudness` → `final.mp4` → `runChecks` → `rendered` ou `needs-review` (com as falhas em `status.error`).
  - Todo passo anexa o que fez em `jobs/<id>/log.txt`, com o tempo de render.
  - Uma exceção que não seja de quota → `failed`, com a mensagem; `comp/` e `log.txt` ficam.
- Produces: `makeApproved(deps, root): Promise<{ id: string; state: JobState }[]>`. Processa em ordem e para no primeiro `QuotaExceededError`, deixando os restantes intocados.

- [ ] **Step 1: Testes com deps falsas**
  - De `approved` até `rendered`, a voz, o build e o render são chamados 1 vez cada.
  - **Review Focus 1:** com o job já em `built`, rodar `make` não chama a voz nem o build, só o render.
  - Uma checagem falhando deixa o job `needs-review` com a falha registrada.
  - Uma exceção no build deixa o job `failed` e o `comp/` continua lá.
  - **Review Focus 2:** com 3 aprovados e quota esgotada no segundo, o primeiro fica `rendered` e o segundo e o terceiro continuam `approved`.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: resumable make pipeline`

---

### Task 7: CLI

**Files:** Create `src/cli.ts`; Modify `package.json` (`"bin": { "story": "src/cli.ts" }` rodando via `tsx`, e o script `"story": "tsx src/cli.ts"`); Test `tests/cli.test.ts`

**Interfaces:**
- Consumes: as Tasks 1–6 e o `galleryStory` do Plano 1.
- Comandos (parsing com `node:util` `parseArgs`):
  - `new ["idea"] [--count N]`: imprime um id por linha e o caminho do `story.md`.
  - `approve <id>`.
  - `reject <id> "<note>"`: imprime o id novo.
  - `make <id>` / `make --approved`.
  - `list`: tabela com id, estado e título.
  - `gallery`.
- Antes de comandos que chamam APIs, roda `requireEnv` para as chaves necessárias.
- Códigos de saída: 0 = ok, 1 = erro, 2 = créditos esgotados.

- [ ] **Step 1: Testes** (chamando `main(argv, deps)` com deps falsas)
  - `new --count 2` cria 2 jobs.
  - `approve` em um job `drafted` funciona; em um job `rendered`, sai com código 1 e uma mensagem clara.
  - `list` mostra os estados.
  - `make --approved` com quota esgotada sai com código 2.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: story CLI`

---

### Task 8: Agendamento no Windows + teste real de ponta a ponta

**Files:** Create `scripts/schedule.ps1`, `README.md` (como instalar, configurar o `.env`, escolher as vozes e usar o dia a dia)

**Interfaces:**
- `scripts/schedule.ps1 -Install | -Remove` cria ou remove 2 tarefas no Agendador de Tarefas do Windows (`Register-ScheduledTask`, para o usuário atual):
  - `EmilyStories-New`: todo dia às 08:00, roda `npm run story -- new --count 3`.
  - `EmilyStories-Make`: a cada 2 horas, das 09:00 às 23:00, roda `npm run story -- make --approved`.
  - As duas rodam na pasta do projeto e gravam a saída em `logs/schedule-YYYY-MM-DD.log`.

- [ ] **Step 1: Fumaça manual com APIs reais** (gasta créditos; confirmar com o usuário antes)
  1. Rodar `npm run story -- new "Emily's crush finds her diary"` e conferir o `story.md`.
  2. Rodar `approve`, depois `make`.
  3. Assistir ao `final.mp4` e conferir: as vozes combinam com os personagens, a boca acompanha a fala, a legenda bate com o áudio, a música abaixa sob a voz e o vídeo tem entre 35 e 55 s.
  4. Registrar no `README.md` o tempo total e o custo observado.
- [ ] **Step 2: Instalar o agendamento** com `scripts/schedule.ps1 -Install`, só depois que o usuário aprovar o resultado do Step 1. Rodar `Get-ScheduledTask -TaskName EmilyStories-*` e conferir as 2 tarefas.
- [ ] **Step 3: Commit** `feat: Windows scheduling and README`
