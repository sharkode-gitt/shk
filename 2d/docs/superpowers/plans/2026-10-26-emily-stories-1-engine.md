# Emily Stories, Plano 1: Motor 3D + Render — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A partir de um `story.json` + `timing.json` escritos à mão (sem APIs pagas), gerar uma composição HyperFrames com a Emily em 3D, cenários, ações, câmera, legendas e áudio, e renderizar um `final.mp4` aprovado pelas checagens.

**Architecture:** O código Node (TypeScript) valida o roteiro, compila uma linha do tempo absoluta e escreve `comp/` (um `index.html` HyperFrames + `scene.json` + assets). O motor (`src/engine/`) é empacotado com esbuild num único `engine.js`, que roda no Chrome do HyperFrames. Ele monta a cena Three.js e desenha cada quadro a partir do evento `hf-seek`. Legendas são DOM + uma timeline GSAP pausada. O áudio usa elementos `<audio>` do HyperFrames. O loudness final é ajustado com ffmpeg depois do render.

**Tech Stack:** Node 26 (já instalado), TypeScript 5, `tsx` (rodar TS e `tsx --test`), `node:test`, `zod` 4, `three` 0.181.2, `gsap` 3, `esbuild`, `pngjs` + `pixelmatch` (testes visuais), HyperFrames CLI 0.8.184 (global), FFmpeg 9 (global).

**Spec:** `docs/superpowers/specs/2026-10-26-emily-stories-design.md`. O Plano 2 (`2026-10-26-emily-stories-2-pipeline.md`) cobre Claude, ElevenLabs, CLI completa e agendamento.

## Global Constraints

- Vídeo 1080×1920, 30 fps, H.264 + AAC. Duração do vídeo: limite rígido de 20 a 60 s.
- Determinismo: pose, câmera e legenda são funções puras de `t` e da semente do job. Proibidos `Math.random()`, `Date.now()`, `performance.now()` e `requestAnimationFrame` como fonte de estado no motor.
- Nada é carregado da rede durante o render: three e gsap vão dentro de `comp/`.
- Beat = duração do áudio + 0,15 s, esticado se a ação precisar de mais tempo; a fala nunca é cortada.
- Transição entre ações: 0,2 s. `shake` dura 0,4 s no início do beat.
- Mix final: −14 LUFS integrado, true peak ≤ −1 dBTP.
- Legendas na faixa do meio-alto (centro em y = 30% da altura), fora de y > 82% e da lateral direita (x > 88%).
- Sem logo nem a palavra "Roblox" em nenhum asset ou texto gerado.
- Unidades 3D = studs do Roblox (1 unidade = 1 stud); +Y para cima; personagens olham para −Z.

## Review Focus

1. **Beat sem áudio ou com áudio de 0 s** (falha do TTS, linha vazia): o compilador deve recusar com erro claro, não gerar um beat de 0,15 s. Teste na Task 3.
2. **Personagem fora do quadro no `closeup`** quando ele está andando (`walk_to`) no mesmo beat: a câmera precisa seguir a posição no `t` atual, não a inicial. Teste na Task 9.
3. **Corte de cena caindo entre dois quadros** (pop-in de 1 quadro dos props do cenário seguinte): visibilidade e câmera leem os mesmos limites. Teste na Task 10.
4. **Palavra de legenda com marcação de emoção** (`[sad]`) ou pontuação colada: nunca pode aparecer `[sad]` na tela. Teste na Task 11.
5. **Duas ações em sequência para o mesmo personagem no mesmo beat** (`walk_to` depois `sit`): a segunda começa onde a primeira termina, sem teleporte. Teste na Task 7.

---

## Estrutura de arquivos (Plano 1)

```
package.json, tsconfig.json, .gitignore (já existe)
src/
  types.ts                 tipos compartilhados (Story, Timing, Timeline, Pose…)
  vocab.ts                 vocabulário único
  story/schema.ts          schema zod + validateStory()
  story/text.ts            stripTags(), splitWords()
  build/seed.ts            seedFromId(), mulberry32()
  build/timeline.ts        compileTimeline()
  build/captions.ts        captionChunks()
  build/audio.ts           musicClips(), musicAutomation(), sfxEvents()
  build/compose.ts         writeComposition()
  build/bundle.ts          bundleEngine()
  render/render.ts         renderComp(), normalizeLoudness()
  render/checks.ts         runChecks() + parsers
  engine/main.ts           entrada do navegador: carrega scene.json, renderAt(t)
  engine/rig.ts            JOINTS, buildRigFromParts(), applyPose()
  engine/characters/emily.ts     loadEmily()
  engine/characters/block.ts     buildBlockCharacter(look)
  engine/faces/draw.ts     drawFace(ctx, face, mouth, rect)
  engine/faces/texture.ts  FaceTexture (troca o bloco do rosto)
  engine/actions/index.ts  poseAt(), actionDuration()
  engine/actions/*.ts      uma ação por arquivo
  engine/sets/index.ts     buildSet(), SET_MARKS
  engine/sets/*.ts         um cenário por arquivo
  engine/sets/props.ts     buildProp(name)
  engine/camera.ts         cameraAt()
tools/convert-hero.ts      gera assets/emily/parts.json
assets/emily/              emily.obj, emily.mtl, *_diff.png, parts.json
assets/fonts/LilitaOne-Regular.ttf (+ OFL.txt)
fixtures/story.json, fixtures/timing.json, fixtures/audio/*.wav
tests/…                    espelha src/
tests/visual/approved/*.png
scripts/render-fixture.ts
```

---

### Task 1: Projeto base, vocabulário, tipos e schema do roteiro

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/vocab.ts`, `src/types.ts`, `src/story/schema.ts`, `src/story/text.ts`
- Test: `tests/story/schema.test.ts`, `tests/story/text.test.ts`
- Create: `fixtures/story.json` (o exemplo da spec §4, completado para 2 cenas, 6 beats, cast Emily + Mia + Mom, usando `walk_to`, `sit`, `point`, `shocked`, `cry`, e os planos `wide`, `closeup:mia`, `push_in:emily`, `orbit`, `shake`)

**Interfaces:**
- Produces:
  - `vocab.ts`: `SETS`, `TIMES`, `ACTS`, `FACES`, `HAIRS`, `HATS`, `PROPS`, `MUSIC`, `VOICES` (arrays `as const` com os valores exatos da spec §4) e `SHOT_KINDS = ['wide','medium','closeup','over_shoulder','two_shot','push_in','orbit','shake'] as const`.
  - `types.ts`: `type Story = z.infer<typeof StorySchema>`; `type Look = Story['cast'][number]['look']`; `type Shot = { kind: ShotKind; targets: string[] }`; `type JointName` (os 15 nomes de `reference/hero-rig.json` → `joints`); `type PartName` (as 15 chaves de `hero-rig.json` → `parts`); `SetName`, `TimeOfDay`, `Act`, `Face`, `Prop`, `Mood`, `ShotKind` = `(typeof X)[number]` das listas de `vocab.ts`.
  - `story/schema.ts`: `StorySchema` (zod), `validateStory(json: unknown): { ok: true; story: Story } | { ok: false; errors: string[] }`, `parseShot(s: string): Shot` (`"closeup:mia"` → `{kind:'closeup', targets:['mia']}`; `"two_shot:a,b"` → 2 alvos).
  - `story/text.ts`: `stripTags(s: string): string` (remove `[qualquer coisa]` e espaços duplicados); `splitWords(s: string): string[]`.

- [ ] **Step 1: Criar o `package.json`** com `"type": "module"`, scripts `"test": "tsx --test tests/**/*.test.ts"`, `"typecheck": "tsc --noEmit"`. Dependências: `zod@^4`, `three@0.181.2`, `gsap@^3`. Dependências de desenvolvimento: `typescript@^5`, `tsx`, `esbuild`, `@types/three@0.181`, `@types/node`, `pngjs`, `pixelmatch`. No `tsconfig.json`: `"strict": true`, `"module": "NodeNext"`, `"target": "ES2022"`, `"lib": ["ES2022","DOM"]`. Rodar `npm install`.

- [ ] **Step 2: Escrever os testes que falham**

```ts
// tests/story/schema.test.ts
test('fixture is valid', () => assert.equal(validateStory(fixture).ok, true));
test('beat with both narrate and say is rejected', …);        // errors mention "exactly one of narrate or say"
test('cast without emily (ref:"hero") is rejected', …);
test('5 cast members rejected; 1 rejected; 2 and 4 accepted', …);
test('4 distinct sets rejected', …);
test('unknown set "pool" rejected', …);
test('do[].at and shot targets must be cast ids', …);          // "closeup:bob" → error naming "bob"
test('say.who must be a cast id', …);
test('narrate is attributed to emily', …);                       // validate passes; parseBeatSpeaker(beat) === 'emily'
test('parseShot', () => assert.deepEqual(parseShot('two_shot:emily,mia'), { kind: 'two_shot', targets: ['emily','mia'] }));
// tests/story/text.test.ts
test('stripTags', () => assert.equal(stripTags('[sad] On my  [whispers]10th birthday'), 'On my 10th birthday'));
test('splitWords keeps punctuation attached', () => assert.deepEqual(splitWords('Mom said it\'s MY party!'), ['Mom','said',"it's",'MY','party!']));
```

- [ ] **Step 3: Rodar `npm test` e ver os testes falharem** (módulos inexistentes).

- [ ] **Step 4: Implementar `vocab.ts`, `types.ts`, `schema.ts` e `text.ts`.** Regras entre campos via `superRefine`; cada erro em inglês, citando o caminho (`scenes[1].beats[0]`). Exportar também `parseBeatSpeaker(beat): string`.

- [ ] **Step 5: Rodar `npm test` e `npm run typecheck`.** Esperado: PASS, 0 erros.

- [ ] **Step 6: Commit** `feat: vocabulary, story schema and fixture`

---

### Task 2: Semente determinística

**Files:** Create `src/build/seed.ts`; Test `tests/build/seed.test.ts`

**Interfaces:** Produces `seedFromId(id: string): number` (FNV-1a de 32 bits) e `mulberry32(seed: number): () => number` (retorna valores em [0,1)).

- [ ] **Step 1: Testes**: o mesmo id dá a mesma semente; ids diferentes dão sementes diferentes; `mulberry32(42)` produz a mesma sequência de 5 valores em duas instâncias; todos os valores estão em [0,1).
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.** **Step 5: Commit** `feat: deterministic seed`

---

### Task 3: Compilador da linha do tempo

**Files:** Create `src/build/timeline.ts`; Modify `src/types.ts`; Create `fixtures/timing.json`; Test `tests/build/timeline.test.ts`

**Interfaces:**
- Consumes: `Story`, `parseShot`, `parseBeatSpeaker`, `stripTags`.
- Produces (em `types.ts`):
  ```ts
  type WordTiming = { word: string; start: number; end: number };           // segundos
  type LineTiming = { beatId: string; file: string; duration: number; words: WordTiming[] }; // words relativas ao início do áudio
  type Timing = { lines: LineTiming[] };                                       // beatId = `${scene}.${beat}`
  type TimedAction = { who: string; act: Act; face?: Face; at?: string; start: number; end: number };
  type TimedBeat = { id: string; scene: number; start: number; end: number; speaker: string; kind: 'narrate'|'say';
                     text: string; audio: { file: string; start: number; duration: number }; words: WordTiming[]; // absolutas
                     shot: Shot; actions: TimedAction[] };
  type TimedScene = { index: number; set: SetName; time: TimeOfDay; music: Mood; start: number; end: number };
  type Timeline = { duration: number; fps: 30; scenes: TimedScene[]; beats: TimedBeat[] };
  ```
- Produces: `compileTimeline(story: Story, timing: Timing): Timeline`; constantes `BEAT_PAD = 0.15`, `TAIL = 0.5`, `ACTION_MIN = { walk_to: 1.2, run_to: 0.8 }` (as outras ações têm 0).

Regras:
- `beat.start` = `end` do beat anterior (o primeiro começa em 0).
- `end` = `start + max(duration + BEAT_PAD, soma de ACTION_MIN das ações sequenciais do mesmo personagem)`.
- As ações do mesmo personagem num beat rodam em sequência, dividindo o beat. As de personagens diferentes rodam em paralelo.
- `audio.start` = `beat.start`.
- `duration` = fim do último beat + `TAIL`.
- `fixtures/timing.json` traz durações fixas (ex.: 2,4 / 1,8 / 3,1 / 2,0 / 2,6 / 1,9 s) e tempos de palavra distribuídos uniformemente.

- [ ] **Step 1: Testes**
  - Beats contíguos, com 6 beats.
  - `beats[0].end` = 2.4 + 0.15.
  - Um beat de 0,6 s com `walk_to` termina em `start + 1.2`.
  - `words` absolutas = relativas + `audio.start`.
  - `walk_to` e `sit` da mesma pessoa no mesmo beat ficam em sequência (o `start` da segunda = o `end` da primeira).
  - `duration` = último end + 0.5.
  - `scenes[1].start === beats[primeiro da cena 1].start`.
  - **Review Focus 1:** uma linha de timing ausente ou com `duration <= 0` faz `compileTimeline` lançar um erro que cita o beatId.
  - Um timing com beatId sobrando (que não existe no roteiro) lança erro.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: timeline compiler`

---

### Task 4: Mapa de peças da Emily (conversão única do export)

**Files:** Create `tools/convert-hero.ts`, `assets/emily/` (copiar `reference/hero-export/*`); Test `tests/tools/convert-hero.test.ts` + `tests/fixtures/mini.obj`

**Decisão (desvio consciente da spec §5):** o OBJ continua sendo o asset (o `OBJLoader`/`MTLLoader` do three carrega no navegador). A "conversão única" vira um mapa de peças em `parts.json`, em vez de um `.glb`, porque o `GLTFExporter` precisa de APIs de navegador que não existem no Node e o `.glb` não acrescenta nada. A intenção da spec (peças nomeadas, pivôs, acessórios presos) fica preservada.

**Interfaces:**
- Consumes: `reference/hero-rig.json`.
- Produces: `assets/emily/parts.json` no formato `{ offset: [x,y,z], groups: Record<string /* "Hero7" */, { part: PartName } | { accessory: 'hair'|'crown'|'bag', attach: 'Head'|'UpperTorso' }> }`, e a função `mapParts(objText: string, rig: HeroRig): PartsMap`.

Algoritmo:
- Fazer o parse das linhas `g` e `v` e calcular o centro do bounding box de cada grupo.
- `offset` = média de (centro do rig − centro do grupo) para os 15 grupos `Hero*`, depois do casamento. Para casar: primeiro com offset 0; refazer com o offset estimado até estabilizar (2 iterações bastam).
- Cada `Hero*` recebe a peça do rig de centro mais próximo, sem repetir peça.
- Cada `Handle*` vira um acessório pelo tamanho de bounding box mais próximo dos 3 em `hero-rig.json → accessories`. Cabelo e coroa → `Head`; bolsa → `UpperTorso`.

- [ ] **Step 1: Teste com `mini.obj`**: 3 grupos com vértices nos centros de `Head`, `LeftFoot` e `RightFoot` deslocados por (0,−5,0). Esperado: `offset ≈ [0,5,0]` (±0.01) e os nomes certos.
- [ ] **Step 2: Teste com o export real** (`assets/emily/emily.obj`): 15 `Hero*` mapeados para 15 peças distintas; os 3 `Handle*` viram `hair`, `crown` e `bag`, um de cada; a coroa é o acessório com o maior y.
- [ ] **Step 3: Rodar os testes e confirmar a falha.** **Step 4: Implementar** `mapParts` e o CLI `npx tsx tools/convert-hero.ts` (grava `assets/emily/parts.json`).
- [ ] **Step 5: Rodar os testes e o CLI.** Conferir no `parts.json` que `Hero1`…`Hero15` têm peças únicas.
- [ ] **Step 6: Commit** `feat: emily part map from Studio export`

---

### Task 5: Rig R15, aplicação de pose e personagem de blocos

**Files:** Create `src/engine/rig.ts`, `src/engine/characters/block.ts`; Modify `src/types.ts`; Test `tests/engine/rig.test.ts`, `tests/engine/block.test.ts`

**Interfaces:**
- Produces (em `types.ts`): `type Vec3 = [number, number, number]`; `type Pose = { root: { pos: Vec3; yaw: number }; joints: Partial<Record<JointName, Vec3>>; face: Face; mouth: 0|1|2 }` (rotações das juntas em radianos, euler XYZ).
- Produces (em `rig.ts`): `JOINTS: Record<JointName, { parent: PartName|'Root'; child: PartName; pivot: Vec3 }>` (copiado de `hero-rig.json`); `type Rig = { root: THREE.Group; joints: Record<JointName, THREE.Object3D>; parts: Record<PartName, THREE.Object3D> }`; `buildRigFromParts(parts: Record<PartName, THREE.Object3D>, accessories?: { object: THREE.Object3D; attach: PartName }[]): Rig`; `applyPose(rig: Rig, pose: Pose): void`.
  - Cada junta é um `Object3D` posicionado no pivô relativo ao pivô da junta pai; a malha da peça fica com offset para manter a posição de mundo.
  - O `root.position` final = `pose.root.pos`, com o chão em y=0: a raiz é deslocada para que a base dos pés (y≈2.0 no rig) fique em 0.
- Produces (em `block.ts`): `buildBlockCharacter(look: Look): Rig`, com uma `BoxGeometry` por peça usando os tamanhos de `hero-rig.json → parts`, cores de `look` (tronco e braços superiores na cor `shirt`; pernas na cor `pants`; o resto na cor `skin`, padrão `#f0cdc4`), cabelo e chapéu por `buildHair(hair)` / `buildHat(hat)` presos à `Head`, e material `MeshStandardMaterial({ roughness: 0.55, metalness: 0 })`.

- [ ] **Step 1: Testes** (o three roda no Node sem renderer):
  - `applyPose` com `RightShoulder: [0,0,-Math.PI/2]` move o centro de mundo de `RightHand` para cima (y aumenta mais de 0,5).
  - A pose neutra mantém os centros de mundo das peças a menos de 0,01 dos `parts.center` do rig, já com o deslocamento do chão aplicado.
  - Bloco: 15 peças, 15 juntas; `look.hat='crown'` adiciona um filho em `Head`; `hair='bald'` não adiciona nada.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: R15 rig, pose application, block characters`

---

### Task 6: Rostos (desenho e troca na textura)

**Files:** Create `src/engine/faces/draw.ts`, `src/engine/faces/texture.ts`, `scripts/face-sheet.html`; Test: verificação visual (Step 3)

**Interfaces:**
- Produces: `drawFace(ctx: CanvasRenderingContext2D, face: Face, mouth: 0|1|2, rect: {x,y,w,h}, skin: string): void`.
  - Traço da Emily: olhos grandes pretos com 2 brilhos brancos, cílios em cima, bochechas com hachura rosa `#ff9aa8`.
  - Por expressão, sobrancelhas e boca mudam: `sad` = sobrancelhas inclinadas para cima no centro + boca em arco para baixo; `crying` = sad + lágrimas azuis `#7cc8ff`; `angry` = sobrancelhas em V; `shocked` = olhos maiores + boca "O"; `smug` = olhos semicerrados + sorriso torto; `happy` = olhos em arco + sorriso; `scared` = olhos menores + boca ondulada; `neutral` = boca reta.
  - `mouth` 1 e 2 abrem a boca da expressão em 35% e 70%.
- Produces: `class FaceTexture { constructor(atlas: HTMLImageElement, rect: Rect, skin: string); readonly texture: THREE.CanvasTexture; set(face: Face, mouth: 0|1|2): void }`. Copia o atlas inteiro para um canvas, repinta só `rect` com `skin` + `drawFace`, e marca `needsUpdate` apenas quando `face` ou `mouth` mudam.
- `EMILY_FACE_RECT`: medir no Step 1.

- [ ] **Step 1: Medir `EMILY_FACE_RECT`** em `assets/emily/Hero1_diff.png` (916×568): o bloco de pele que contém os olhos (estimativa inicial `{x:132,y:268,w:256,h:300}`). Script descartável: bounding box dos pixels escuros (< 60 de luminância) dentro de x∈[100,400], y∈[250,568], expandido até a borda do bloco de pele. Gravar o valor como constante em `texture.ts`.
- [ ] **Step 2: Implementar `drawFace` e `FaceTexture`.**
- [ ] **Step 3: Verificação visual.** `scripts/face-sheet.html` desenha as 8 expressões × 3 bocas numa grade. Abrir no Chrome (`npx hyperframes preview` não é necessário; um `file://` serve), comparar ao lado de `reference/hero-reference.png` e ajustar até o traço bater (olhos, cílios, bochechas). Salvar o print aprovado em `tests/visual/approved/face-sheet.png`.
- [ ] **Step 4: Commit** `feat: code-drawn faces in Emily's style`

---

### Task 7: Ações

**Files:** Create `src/engine/actions/index.ts` + um arquivo por ação em `src/engine/actions/` (`idle`, `walk`, `sit`, `stand_up`, `talk`, `point`, `wave`, `hug`, `jump`, `fall`, `cry`, `laugh`, `facepalm`, `shocked`); Test `tests/engine/actions.test.ts`

**Interfaces:**
- Consumes: `TimedAction`, `Pose`, `Vec3`.
- Produces: `type ActionFn = (u: number /* 0..1 dentro da ação */, tAbs: number, ctx: ActionCtx) => Omit<Pose,'face'|'mouth'>`, com `ActionCtx = { from: Vec3; fromYaw: number; to?: Vec3; lookAt?: Vec3; seed: number }`. Também `poseAt(who: string, t: number, beats: TimedBeat[], marks: Record<string,Vec3>, home: Vec3, seed: number): Omit<Pose,'face'|'mouth'>`.
- `poseAt` acha a ação ativa do personagem em `t` (fora de qualquer ação: `idle` na última posição alcançada) e mistura com a anterior por `BLEND = 0.2` s (lerp das juntas e da posição, slerp do yaw).
  - A posição inicial de cada ação = posição final da ação anterior do mesmo personagem, dentro da cena. Isso exige percorrer os beats da cena em ordem até `t`.
  - No início de cada cena, cada personagem volta para `home` = `homes[índice no cast]` do cenário novo. Todos os personagens do cast estão em todas as cenas (na v1, quem não age fica em `idle`).
- `walk_to`/`run_to`: movimento linear até `marks[at]` (ou até a posição do personagem `at`, parando a 1,5 stud). O yaw vira na direção do movimento. Ciclo de passos com período de 0,5 s (walk) ou 0,32 s (run): coxas ±0,6 rad, joelhos 0..0,8, braços em oposição ±0,5.
- `idle`: respiração com Waist ±0,03 rad em período de 3,2 s, com fase vinda da semente. Os valores restantes por ação ficam a critério do implementador, desde que sejam legíveis no vídeo-galeria.

- [ ] **Step 1: Testes**
  - O mesmo `t` dá sempre a mesma pose (determinismo).
  - Em `t` = metade de um `walk_to` de (0,0,0) até a marca `door` (5,0,0), a raiz está em x≈2,5.
  - **Review Focus 5:** `walk_to` e depois `sit` no mesmo beat fazem a raiz de `sit` começar na posição final do `walk_to` (erro < 0,01).
  - No meio de uma transição (0,1 s depois da troca), as juntas ficam a 50% ±5% entre as duas ações.
  - Um personagem sem ações no beat continua na última posição.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: deterministic actions with blending`

---

### Task 8: Cenários, props e iluminação

**Files:** Create `src/engine/sets/index.ts`, `src/engine/sets/props.ts`, um arquivo por cenário (`bedroom`, `living_room`, `kitchen`, `classroom`, `school_hallway`, `park`, `street`); Test `tests/engine/sets.test.ts`

**Interfaces:**
- Produces: `buildSet(name: SetName, time: TimeOfDay): BuiltSet`, onde `BuiltSet = { group: THREE.Group; marks: Record<string, Vec3>; homes: Vec3[]; lights: THREE.Light[] }`. `homes` são de 2 a 4 posições iniciais para os personagens, na ordem do cast.
- Produces: `SET_MARKS: Record<SetName, string[]>`. Todo cenário tem `center` e `door`. Além disso: bedroom `bed`, `window`; living_room `sofa`, `tv`; kitchen `table`, `fridge`; classroom `desk`, `board`; school_hallway `lockers`; park `bench`, `tree`; street `car`, `house`.
- Produces: `buildProp(name: Prop): THREE.Object3D`, para os 10 props, só com primitivas.
- Iluminação: `HemisphereLight` + `DirectionalLight` com sombra (mapa de 2048), com presets `morning` `#fff2dc` (sol baixo), `afternoon` `#ffffff` (sol alto), `night` `#9fb4ff` (fraca) + uma luz quente interna nos cenários fechados.
- Paleta clara e pastel; piso com textura de grade sutil gerada em canvas, no estilo baseplate.

- [ ] **Step 1: Testes**: cada `SetName` constrói sem erro e tem todas as marcas de `SET_MARKS[name]`; as marcas ficam dentro do bounding box do chão do cenário; existem pelo menos 2 `homes`, a mais de 1,5 stud uma da outra.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: seven sets, props, time-of-day lighting`

---

### Task 9: Câmera

**Files:** Create `src/engine/camera.ts`; Test `tests/engine/camera.test.ts`

**Interfaces:**
- Produces: `cameraAt(shot: Shot, u: number /* 0..1 no beat */, beatDur: number, tInBeat: number, heads: Record<string, Vec3>, set: BuiltSet, seed: number): { pos: Vec3; target: Vec3; fov: number }`.
  - `heads` = posição de mundo da cabeça de cada personagem **no `t` atual**.
- Enquadramentos (distância até o alvo e altura relativa à cabeça):
  - `wide`: enquadra todos, a 14 studs, fov 40.
  - `medium`: o falante, a 7 studs.
  - `closeup:X`: a 3,2 studs, fov 30.
  - `over_shoulder:X`: câmera atrás do ombro do outro personagem mais próximo, olhando para X.
  - `two_shot:A,B`: o ponto médio entre os dois, recuando até caberem.
  - `push_in:X`: de 7 a 3,5 studs, com easeInOut sobre `u`.
  - `orbit`: 40° em torno do centro dos personagens ao longo do beat.
  - `shake`: o plano `medium` mais tremor de amplitude 0,15 no primeiro 0,4 s, decaindo.
- Câmera na mão (sempre ligada): ruído suave de amplitude 0,03 studs e período de cerca de 2,7 s, em função de `t` e da semente.

- [ ] **Step 1: Testes**
  - O alvo de `closeup:mia` = `heads.mia` (±0,05).
  - **Review Focus 2:** com `heads.mia` diferente em dois `t`, o alvo acompanha.
  - O `push_in` fica mais perto em u=1 do que em u=0.
  - O `orbit` muda o ângulo em ~40° entre u=0 e u=1.
  - O mesmo input dá o mesmo output.
  - O `shake` depois de 0,4 s é igual ao `medium` (fora a câmera na mão).
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: shot-driven camera`

---

### Task 10: Runtime do motor no navegador + bundle

**Files:** Create `src/engine/main.ts`, `src/engine/characters/emily.ts`, `src/build/bundle.ts`; Test `tests/engine/scene-state.test.ts`

**Interfaces:**
- Consumes: Tasks 5–9, `assets/emily/parts.json`.
- Produces: `loadEmily(baseUrl: string): Promise<{ rig: Rig; face: FaceTexture }>` (via `OBJLoader` + `MTLLoader`, aplicando `parts.json`; o atlas do corpo usa `FaceTexture.texture` como `map`).
- Produces: `sceneState(t: number, payload: ScenePayload, layout: SetLayout): { sceneIndex: number; poses: Record<string, Pose>; camera: {pos,target,fov} }`. É uma função pura, testável no Node. `ScenePayload = { story: Story; timeline: Timeline; seed: number }`; `SetLayout = Record<number /* scene index */, BuiltSet>` (o `main.ts` monta isso com `buildSet`; os testes também, já que `buildSet` roda no Node). A posição da cabeça para `cameraAt` sai de aplicar a pose num rig de blocos de referência com as proporções da Emily (`buildBlockCharacter` com o look padrão), feito uma vez.
  - `face` vem da ação ativa ou do último `face` dado ao personagem (padrão `neutral`).
  - `mouth` do falante: palavra ativa em `t` → alterna entre 1 e 2 a cada 0,09 s; fora de palavra → 0.
- Produces: `main.ts`:
  - Lê `scene.json` (embutido como `<script type="application/json" id="scene">`).
  - Cria um `WebGLRenderer` em 1080×1920 com `pixelRatio` 1, sombras ligadas e `toneMapping = ACESFilmic`.
  - Constrói todos os cenários do vídeo (escondidos) e todos os personagens.
  - Registra `window.__hf.buildReady.scene`.
  - Escuta `hf-seek` → `renderAt(t)`: mostra só o cenário de `sceneIndex`, aplica poses, rostos e câmera, e chama `render`.
- Produces: `bundleEngine(outFile: string): Promise<void>` (esbuild, formato `esm`, three incluído no bundle, `minify: true`).

- [ ] **Step 1: Testes de `sceneState`**
  - **Review Focus 3:** no último quadro antes do corte entre cenas (`(Math.ceil(cut*30)-1)/30`), `sceneIndex` é o da cena anterior; no quadro do corte, é o da seguinte.
  - A boca do falante é > 0 no meio de uma palavra e 0 durante a pausa entre beats.
  - Quem não fala tem `mouth` 0.
  - `face` acompanha o `face` da ação ativa.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar `sceneState`, `loadEmily`, `main.ts` e `bundleEngine`.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: browser runtime and engine bundle`

---

### Task 11: Legendas

**Files:** Create `src/build/captions.ts`; Test `tests/build/captions.test.ts`

**Interfaces:**
- Produces: `captionChunks(beats: TimedBeat[]): CaptionChunk[]`, com `CaptionChunk = { start: number; end: number; speaker: string; kind: 'narrate'|'say'; words: WordTiming[] }`.
  - No máximo 3 palavras por bloco; quebra depois de `.`, `,`, `!` e `?`.
  - O bloco começa na primeira palavra e termina no início do próximo bloco do mesmo beat (ou no fim da última palavra + 0,2 s).
- Produces: `captionColor(speaker: string, story: Story): string`. Narração `#ffffff`; Emily `#ff8fb1`; os outros personagens usam o `look.shirt` clareado 35% em direção ao branco.

- [ ] **Step 1: Testes**
  - **Review Focus 4:** um texto com `[sad]` não gera nenhuma palavra com `[`.
  - "Mom said it's MY party now!" → blocos `["Mom","said","it's"]` e `["MY","party","now!"]`.
  - A quebra acontece em vírgula.
  - Os blocos de um beat não se sobrepõem.
  - A cor da narração é branca.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: karaoke caption chunks`

---

### Task 12: Áudio (música, ducking, efeitos)

**Files:** Create `src/build/audio.ts`; Test `tests/build/audio.test.ts`

**Interfaces:**
- Produces: `musicClips(timeline: Timeline, library: Record<Mood, string[]>, seed: number): { file: string; start: number; end: number; mood: Mood }[]`. Cenas consecutivas com o mesmo `music` viram um clipe só; a escolha do arquivo é determinística por `mulberry32(seed)`. Uma biblioteca vazia para um clima → sem música naquele trecho, sem erro.
- Produces: `musicAutomation(clip, beats): { version: 1; lanes: [{ target: 'volume'; points: {t:number; v:number}[] }] }`.
  - Volume base 0,35, que cai para 0,12 de `audio.start − 0,1` até `audio.start + duration + 0,1`, com rampas de 0,15 s.
  - Os `t` são relativos ao início do clipe, e o ponto `t:0` é explícito.
  - Janelas sobrepostas são fundidas. No máximo 512 pontos.
- Produces: `sfxEvents(timeline: Timeline, map: Record<string,string>): { file: string; at: number; id: string }[]`. Eventos `act:<nome>` disparam no `start` da ação; `cut` dispara no início de cada cena depois da primeira.

- [ ] **Step 1: Testes**
  - Duas cenas `happy` seguidas dão 1 clipe; `happy` depois `tense` dão 2.
  - O mesmo seed escolhe o mesmo arquivo.
  - A automação começa em t=0 com v=0,35, chega a 0,12 durante a primeira fala e volta a 0,35 entre falas separadas por mais de 0,5 s.
  - Os ids de sfx são únicos.
  - `cut` aparece uma vez por troca de cena.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: music clips, voice ducking automation, sfx events`

---

### Task 13: Escrever a composição HyperFrames

**Files:** Create `src/build/compose.ts`, `assets/fonts/LilitaOne-Regular.ttf` + `assets/fonts/OFL.txt` (do repositório `google/fonts`, `ofl/lilitaone/`); Test `tests/build/compose.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 10, 11 e 12.
- Produces: `writeComposition(opts: { jobDir: string; story: Story; timeline: Timeline; seed: number; audioDir: string; music: Record<Mood,string[]>; sfxMap: Record<string,string> }): Promise<string /* compDir */>`. Escreve em `jobDir/comp/`:
  - **`index.html`**, com:
    - Raiz `<div id="story" data-composition-id="story" data-width="1080" data-height="1920" data-duration="{timeline.duration}">`.
    - `<canvas id="three-layer">`.
    - `<div id="captions">` com um `.cap` por bloco de legenda e um `<span>` por palavra.
    - `@font-face` da Lilita One.
    - `<script src="gsap.min.js">`.
    - Uma timeline pausada em `window.__timelines["story"]` que, para cada bloco, mostra o `.cap` (opacity 0→1 em `start`, 1→0 em `end`) e aplica a cor de destaque `#ffe14d` + escala 1,12 em cada palavra durante o tempo dela.
    - O `<script type="application/json" id="scene">` com o payload e o `<script type="module" src="engine.js">`.
    - Os `<audio>`:
      - Vozes: `id="vo-{beatId com . trocado por -}"`, `data-start`, `data-duration`, `data-audio-group="voiceover"`.
      - Música: `id="music-{n}"`, com `data-automation` JSON.
      - Efeitos: `id="sfx-{n}"`, `data-volume="0.6"`.
  - **Arquivos copiados:** `engine.js` (via `bundleEngine`), `gsap.min.js` (de `node_modules/gsap/dist/`), `fonts/`, `emily/` (o obj, o mtl, as texturas e `parts.json`), `audio/` (vozes, músicas e efeitos usados).
- Estilo das legendas: centro em `top: 30%`, `left: 6%`, `right: 12%`, texto centralizado, 92 px, contorno preto de 10 px (`paint-order: stroke`), sombra. O nome de quem fala vai acima em 40 px na cor do personagem (só em `say`).

- [ ] **Step 1: Testes** (gerando a partir da fixture numa pasta temporária)
  - `data-duration` = `timeline.duration`.
  - Todo `<audio>` tem um `id` único e `src` existente em `comp/`.
  - O número de `.cap` = o número de blocos de legenda.
  - Não aparece nenhum `[` no texto visível.
  - O HTML não tem nenhuma URL `http`.
  - `npx hyperframes lint <compDir> --json` retorna 0 erros (o teste roda o CLI).
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: HyperFrames composition writer`

---

### Task 14: Render, loudness e checagens

**Files:** Create `src/render/render.ts`, `src/render/checks.ts`; Test `tests/render/checks.test.ts`

**Interfaces:**
- Produces: `renderComp(compDir: string, outFile: string): Promise<{ seconds: number; log: string }>`. Roda `npx hyperframes render <compDir> --quality delivery --fps 30 --output <tmp.mp4>`, guarda a saída e registra a segunda linha do resumo (modo de captura e GPU) no log.
- Produces: `normalizeLoudness(inFile: string, outFile: string): Promise<LoudnessStats>`. É o ffmpeg `loudnorm` em duas passadas (`I=-14:TP=-1:LRA=11`); a primeira com `print_format=json`, e o vídeo copiado (`-c:v copy`).
- Produces: `runChecks(file: string): Promise<{ ok: boolean; failures: string[] }>`. Usa as funções puras `parseProbe(json)`, `parseBlackdetect(stderr)` e `parseLoudness(json)`.
  - Regras: 1080×1920; duração entre 20 e 60 s; existe faixa de áudio; −14 ±1 LUFS (medido com `ebur128` no arquivo final); nenhum `black_duration` > 0,5 s (`blackdetect=d=0.5:pix_th=0.10`).

- [ ] **Step 1: Testes das funções puras** com saídas reais de ffprobe, blackdetect e loudnorm coladas como fixtures de texto em `tests/render/fixtures/`. Casos: arquivo bom (ok); 1920×1080 (falha cita "resolution"); 15 s (falha cita "duration"); sem áudio; trecho preto de 0,8 s; −20 LUFS.
- [ ] **Step 2: Rodar os testes e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar os testes e confirmar que passam.**
- [ ] **Step 5: Commit** `feat: render, loudness normalization, output checks`

---

### Task 15: Render da fixture de ponta a ponta + testes visuais

**Files:** Create `scripts/render-fixture.ts`, `fixtures/audio/*.wav`, `fixtures/sfx-map.json`, `tests/visual/visual.test.ts`, `tests/visual/approved/*.png`; Modify `package.json` (scripts `fixture`, `test:visual`)

**Interfaces:**
- Consumes: todas as tasks anteriores.
- `scripts/render-fixture.ts`:
  - Gera um wav silencioso por linha de `fixtures/timing.json` (`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t {duration}`). O silêncio é proposital e evita gastar créditos. Para o mix ter algo a medir, adiciona um tom de 220 Hz a −30 dBFS.
  - Roda `compileTimeline` → `writeComposition` (sem música; com `fixtures/sfx-map.json` vazio) → `renderComp` → `normalizeLoudness` → `runChecks`.
  - Imprime o tempo de render e o resultado das checagens. Grava em `jobs/fixture/final.mp4`.

- [ ] **Step 1: Rodar `npm run fixture`.** Esperado: `final.mp4` criado e `runChecks.ok === true`. **Anotar o tempo de render** (a meta da spec §9 é menos de 10 min para 45 s). Se passar de 10 min, abrir uma issue no `log.txt` com o modo de GPU informado.
- [ ] **Step 2: Revisão humana do vídeo.** Abrir `final.mp4` e conferir:
  - a Emily é reconhecível e igual à referência;
  - os personagens andam, sentam e apontam;
  - os cortes não pulam;
  - a legenda está legível, longe da faixa de baixo;
  - a boca mexe nas falas.
  Corrigir nas tasks donas do problema antes de seguir.
- [ ] **Step 3: Teste visual.** `tests/visual/visual.test.ts` roda `npx hyperframes snapshot jobs/fixture/comp` em 5 tempos fixos (o meio de cada cena e 2 quadros vizinhos a um corte) e compara cada PNG com `tests/visual/approved/` via `pixelmatch` (threshold 0,1, no máximo 0,5% de pixels diferentes). Na primeira execução, salvar os PNGs aprovados no Step 2.
- [ ] **Step 4: Rodar `npm run test:visual`** e confirmar que passa.
- [ ] **Step 5: Commit** `feat: end-to-end fixture render and visual regression tests`

---

### Task 16: Vídeo-galeria

**Files:** Create `src/build/gallery.ts`, `scripts/gallery.ts`; Test `tests/build/gallery.test.ts`

**Interfaces:**
- Produces: `galleryStory(): { story: Story; timing: Timing }`. Um roteiro válido em que a Emily faz cada uma das 15 ações, mostra as 8 expressões e passa pelos 8 planos de câmera, passando pelos 7 cenários. A regra de no máximo 3 cenários é ignorada só aqui: chamar `compileTimeline` diretamente, sem `validateStory`. As linhas de narração descrevem o que está acontecendo ("walk to the door"), e os tempos são fixos.
- `npm run gallery`: renderiza `jobs/gallery/final.mp4` com o mesmo caminho da Task 15.

- [ ] **Step 1: Teste**: o roteiro da galeria cobre `ACTS`, `FACES`, `SHOT_KINDS` e `SETS` por completo (comparando os conjuntos).
- [ ] **Step 2: Rodar o teste e confirmar a falha.** **Step 3: Implementar.** **Step 4: Rodar o teste e confirmar que passa; depois rodar `npm run gallery` e assistir ao vídeo.**
- [ ] **Step 5: Commit** `feat: QA gallery video`
