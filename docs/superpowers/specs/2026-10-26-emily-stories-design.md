# Emily Stories: gerador automático de Shorts 3D estilo Roblox

**Data:** 2026-10-26
**Status:** design aprovado em conversa, aguardando revisão desta spec

## 1. Objetivo

Um canal monetizado de Shorts (YouTube Shorts, TikTok, Reels), em **inglês**, com histórias curtas de drama do dia a dia estilo Roblox, protagonizadas sempre pela **Emily** (avatar `emilyrobloxshorts`).

O sistema gera roteiro, voz, cenas 3D, animação, câmera, legendas e áudio, e renderiza o MP4 **inteiramente por código**, sem editor de vídeo. O humano só aprova o roteiro.

**Critério de sucesso:** um comando gera roteiros; você aprova um; minutos depois sai um `final.mp4` pronto para postar, que não parece slide. A meta é sustentar de 1 a 3 vídeos por dia.

### Decisões tomadas

| Tema | Decisão |
|---|---|
| Uso | Canal monetizado |
| Narrativa | Narrador + falas curtas dos personagens |
| Narradora | A própria Emily, em 1ª pessoa |
| Visual v1 | 3D estilo Roblox (o 2D fica para depois, reaproveitando roteiro e pipeline) |
| Idioma | Inglês |
| Voz | ElevenLabs (pago) |
| Participação humana | Aprovar o roteiro; o resto é automático |
| Volume | 1 a 3 vídeos por dia, render local |
| Abordagem | Motor fixo + roteiro estruturado (não um agente escrevendo cada vídeo) |
| Protagonista | Export real do Roblox Studio (malhas + texturas), com expressões desenhadas por código |

### Fora da v1

Upload automático, modo 2D, múltiplos idiomas, interface web, render na nuvem, geração de modelos 3D por IA.

## 2. Formato do vídeo

- 1080×1920 (9:16), 30 fps, H.264 + AAC.
- De 35 a 55 s (o roteiro tem de 110 a 150 palavras); limite rígido de 20 a 60 s.
- Gancho nos 2 primeiros segundos; reviravolta no final.
- Conteúdo seguro para o público do Roblox: sem violência explícita, sem conteúdo sexual, sem marcas reais.
- Sem logo nem nome "Roblox" no vídeo; personagens são "estilo bloco".

## 3. Arquitetura

Projeto Node.js + TypeScript com uma CLI. Cada vídeo é um job numa pasta `jobs/<id>/`. As etapas se comunicam só por arquivos nessa pasta, e cada uma pode ser refeita sozinha.

```
1. write    Claude API → story.json + story.md
2. approve  humano aprova, ou rejeita com nota (gera nova versão)
3. voice    ElevenLabs → audio/<beat>.mp3 + timing.json
4. build    compilador: story.json + timing.json → comp/ (projeto HyperFrames)
5. render   HyperFrames → final.mp4 + checagens
```

**O áudio manda no tempo:** a duração de cada beat sai da duração real do áudio. Por isso a voz é gerada antes da montagem.

### Comandos

| Comando | Faz |
|---|---|
| `story new ["ideia"] [--count N]` | Gera N roteiros (padrão 1). Sem ideia, o Claude escolhe o tema. |
| `story approve <id>` | Marca o job como aprovado. |
| `story reject <id> "nota"` | Gera uma nova versão do roteiro usando a nota. |
| `story make <id>` / `story make --approved` | Roda voice → build → render em um job, ou em todos os aprovados. |
| `story list` | Lista os jobs e seus estados. |
| `story gallery` | Renderiza o vídeo-galeria de controle de qualidade (ver §12). |

### Automação

O Agendador de Tarefas do Windows roda `story new --count 3` toda manhã e `story make --approved` em intervalos. Não é preciso nenhum servidor.

### Estados do job

`drafted → approved → voiced → built → rendered`, além de `rejected`, `failed` e `needs-review`. O estado fica em `jobs/<id>/status.json`. Cada etapa exige a anterior concluída e pula o trabalho que já está feito. Um `make` interrompido continua de onde parou.

## 4. Roteiro (`story.json`)

O Claude preenche um schema fixo via *structured outputs*. O código valida com zod.

- **Modelo padrão:** `claude-opus-5-5` (cerca de US$ 0,05 a 0,08 por roteiro), configurável em `config.json`. Usa structured outputs com `fallbacks: "default"` para recusas.

```json
{
  "title": "My Sister Stole My Birthday",
  "music": "tense",
  "cast": [
    { "id": "emily", "ref": "hero" },
    { "id": "mia", "name": "Mia", "voice": "teen_girl",
      "look": { "skin": "#f2c79b", "shirt": "#7b5cff", "pants": "#2b2b2b", "hair": "long", "hat": "crown" } }
  ],
  "scenes": [
    { "set": "bedroom", "time": "morning", "music": "happy",
      "beats": [
        { "narrate": "[sad] On my 10th birthday, my sister ruined everything.",
          "shot": "wide",
          "do": [{ "who": "emily", "act": "idle", "face": "sad" }] },
        { "say": { "who": "mia", "line": "[smug] Mom said it's MY party now!" },
          "shot": "closeup:mia",
          "do": [{ "who": "mia", "act": "point", "at": "emily", "face": "smug" }] }
      ] }
  ],
  "wants": []
}
```

### Regras

- Cada beat tem exatamente um de `narrate` ou `say`. A narração é sempre da Emily.
- De 2 a 4 personagens, sendo a Emily sempre um deles (`"ref": "hero"`). No máximo 3 cenários.
- As falas podem trazer marcações de emoção do Eleven v3 (`[sad]`, `[whispers]`, `[shouting]`, `[laughs]`). Elas são removidas do texto da legenda.
- `do[].at` e `closeup:<id>` só podem citar ids do `cast` ou marcações do cenário.
- `wants` lista o que a história precisaria e o motor não tem (ex.: `"pool"`). Aparece em destaque no `story.md`. Nunca é inventado na cena.

### Vocabulário v1

| Tipo | Itens |
|---|---|
| `set` | `bedroom`, `living_room`, `kitchen`, `classroom`, `school_hallway`, `park`, `street` |
| `time` | `morning`, `afternoon`, `night` |
| `act` | `idle`, `walk_to`, `run_to`, `sit`, `stand_up`, `talk`, `point`, `wave`, `hug`, `jump`, `fall`, `cry`, `laugh`, `facepalm`, `shocked` |
| `face` | `happy`, `sad`, `angry`, `shocked`, `smug`, `crying`, `scared`, `neutral` |
| `look.hair` | `short`, `long`, `pigtails`, `bun`, `spiky`, `bald` |
| `look.hat` | `null`, `cap`, `crown`, `beanie`, `bow`, `glasses` |
| props | `cake`, `gift`, `phone`, `door`, `bed`, `table`, `chair`, `backpack`, `car`, `dog` |
| `shot` | `wide`, `medium`, `closeup:<id>`, `over_shoulder:<id>`, `two_shot:<id>,<id>`, `push_in:<id>`, `orbit`, `shake` |
| `music` | `sad`, `tense`, `happy`, `funny`, `twist` |
| voz (arquétipo) | `mom`, `dad`, `teen_girl`, `little_brother`, `boy`, `teacher`, `old_lady` |

O vocabulário vive em um único módulo, compartilhado pelo schema, pelo prompt e pelo motor. Adicionar um item novo é mexer em um lugar só.

### Validação

Se o JSON vier inválido, a chamada é repetida com os erros do zod, no máximo 3 vezes. Depois disso, o job vai para `failed` com a mensagem.

### `story.md`

É a versão legível para aprovação: título, gancho, falas em ordem (com quem fala), cenários, duração estimada e a seção **Wants** quando não estiver vazia.

## 5. Personagens

### Emily (protagonista fixa)

- **Fonte:** export do Roblox Studio (`emily.obj` + `.mtl` + 4 texturas). São 15 grupos de corpo (R15), 1 textura de corpo e 3 acessórios (cabelo, coroa, bolsa).
- **Dados de rig:** `reference/hero-rig.json`, lido no Studio, com os 15 pontos de articulação, as peças e os acessórios.
- **Conversão única:** `tools/convert-hero` gera `assets/emily/emily.glb`.
  - Identifica cada grupo `HeroN` pela posição (comparando com `hero-rig.json`) e dá o nome da peça R15.
  - Cria um esqueleto com os pivôs das articulações.
  - Prende cabelo e coroa na `Head` e a bolsa na `UpperTorso`.
- **Expressões:**
  - A textura do corpo tem o rosto num bloco próprio. Em tempo de render, esse bloco é trocado por uma das 8 expressões desenhadas em canvas no mesmo traço (olhos grandes pretos com brilho, cílios, bochechas coradas, boca pequena).
  - A boca tem 3 estados de fala (fechada, meio aberta, aberta), escolhidos pelos tempos das palavras.
  - O rosto original exportado é a referência visual de `sad`/`neutral`.
- **Risco aceito:** cabelo, coroa e bolsa são itens UGC de outros criadores, usados fora do Roblox num canal monetizado. O plano B é recriar essas três peças por código, mantendo o resto.

### Secundários

- Mesmo esqueleto R15 e mesmas proporções da Emily.
- Corpo procedural de blocos com roupa de cor sólida (`look`).
- Cabelos e chapéus vêm de peças procedurais simples (`look.hair`, `look.hat`).
- Rosto no mesmo traço da Emily, mais simples.
- Com o mesmo `look`, o personagem sai sempre idêntico.
- Material liso estilo "SmoothPlastic" para todos.

## 6. Cenários

- Cada `set` é um módulo que monta o ambiente com primitivas e props.
- Cada um expõe **marcações** nomeadas (ex.: `bed`, `door`, `center`, `window`, `desk`) e **posições de câmera sugeridas**.
- Iluminação por `time`: luz hemisférica + luz direcional com sombras suaves, em cores pré-definidas para manhã, tarde e noite.
- Paleta clara e suave, combinando com o visual da referência da Emily.

## 7. Animação e câmera

- **Determinismo obrigatório:** toda pose, posição e câmera é função pura do tempo `t` e de uma semente fixa do job. Sem física e sem `Math.random()` solto. O HyperFrames busca quadros fora de ordem e cada quadro precisa sair sempre igual.
- **Ações:** cada `act` é uma função `(tLocal, params) → rotações das articulações + posição da raiz`.
  - Há uma transição de 0,2 s entre ações.
  - `walk_to`/`run_to` interpolam até a marcação, com ciclo de passos.
  - `idle` tem respiração sutil, para ninguém congelar.
- **Fala:** quem fala tem um leve balanço de cabeça e a boca movida pelos tempos das palavras.
- **Planos de câmera:** cada `shot` calcula a posição a partir das posições atuais dos personagens.
  - O corte padrão acontece na troca de beat.
  - `push_in` e `orbit` se movem durante o beat.
  - `shake` dura cerca de 0,4 s no início do beat.
  - Um tremor leve de "câmera na mão", feito com ruído com semente, fica sempre ligado.
- **Ritmo:**
  - Cada beat dura o áudio mais 0,15 s de pausa.
  - Se uma ação precisar de mais tempo que a fala (ex.: atravessar a sala), o beat estica; a fala nunca é cortada.
  - Não há corte para cena nova no meio de uma fala.

## 8. Voz, legendas e áudio

### Voz

- ElevenLabs, modelo `eleven_v3`, endpoint `POST /v1/text-to-speech/{voice_id}/with-timestamps`.
- Os tempos por caractere viram tempos por palavra em `timing.json`.
- **Vozes:** a Emily tem uma voz fixa e os arquétipos estão em `assets/voices.json` (arquétipo → `voice_id`). A Emily é narradora e também fala as próprias falas.
- **Cache:** fica em `cache/tts/<sha256(texto+voice_id+modelo+configurações)>.mp3` + `.json`, e reaproveita o áudio entre jobs e re-renders.

### Legendas

- Palavra por palavra, em negrito e grandes, com a palavra atual destacada.
- Ficam na faixa do meio-alto da tela, fora da área dos botões do Shorts e do TikTok (parte de baixo e lateral direita).
- Narração em branco; falas na cor do personagem, com o nome pequeno acima.

### Música e efeitos

- `assets/music/<clima>/*.mp3`: faixas livres de direitos por clima. A escolha da faixa é determinística pela semente do job.
- `assets/sfx/*.mp3` + `assets/sfx/map.json` (ação/evento → efeito). Ex.: `fall` → thud, `shocked` → sting, corte de cena → whoosh.
- O acervo inicial é montado uma vez com a skill `media-use` (busca em acervos abertos, sem conta). A licença de cada arquivo é registrada em `assets/LICENSES.md`.

### Mixagem

Feita com o HyperFrames audio:
- A música abaixa automaticamente sob qualquer voz (ducking).
- O mix final é normalizado em −14 LUFS integrado, com true peak ≤ −1 dBTP.

## 9. Render

- O `build` gera `jobs/<id>/comp/`: `index.html` (composição HyperFrames com uma camada Three.js controlada pela linha do tempo), as faixas de áudio, as legendas e `scene.json` (o roteiro já com tempos).
- O motor 3D (`src/engine/`) é empacotado num único bundle, carregado pela composição.
- O render usa o CLI do HyperFrames, já instalado (0.8.184), com Chrome usando a GPU.
- **Checagens depois do render:** resolução 1080×1920, duração entre 20 e 60 s, faixa de áudio presente, −14 LUFS ±1, nenhum trecho preto acima de 0,5 s (`ffmpeg blackdetect`). Se alguma falhar, o job vai para `needs-review`.
- **Tempo de render:** ainda não foi medido. O primeiro protótipo mede quanto leva um vídeo de 45 s no PC atual (Ryzen 9 9900X, 32 GB); a meta é menos de 10 minutos.

## 10. Estrutura do projeto

```
emily-stories/
  src/
    cli.ts
    vocab.ts            vocabulário único (schema, prompt, motor)
    write/              prompt, schema zod, chamada ao Claude, story.md
    voice/              cliente ElevenLabs, cache, timing.json
    build/              compilador story + timing → comp/
    engine/             roda no navegador: characters/ sets/ actions/ camera/ faces/
    render/             chamada ao HyperFrames + checagens
  tools/convert-hero/   OBJ do Studio → emily.glb (roda uma vez)
  assets/
    emily/              emily.glb + texturas
    music/  sfx/        acervo + map.json + LICENSES.md
    voices.json
  reference/            hero-rig.json, hero-reference.png, hero-export/
  jobs/<id>/            story.json, story.md, status.json, audio/, timing.json, comp/, final.mp4, log.txt
  cache/tts/
  config.json           modelos e padrões
  .env                  ANTHROPIC_API_KEY, ELEVENLABS_API_KEY (no .gitignore)
```

`jobs/`, `cache/` e `.env` ficam fora do git.

## 11. Erros

| Falha | Comportamento |
|---|---|
| Roteiro inválido | Repete com os erros, até 3 vezes; depois o job vai para `failed`. |
| ElevenLabs: erro temporário ou limite de taxa | Repete com espera crescente, até 5 vezes. |
| ElevenLabs: créditos esgotados | Para o lote, avisa no terminal e o job continua `approved`. |
| Render falha | O job vai para `failed`, mantendo `comp/` e `log.txt` para diagnóstico. |
| Checagem pós-render falha | O job vai para `needs-review` e a mensagem diz qual checagem falhou. |
| Chave de API ausente | Erro claro antes de qualquer chamada. |

## 12. Testes

- **Unitários** (`node:test`): validação do schema, regras do roteiro, compilador de tempo (story + timing → linha do tempo) e mapeamento de efeitos.
- **Fixture sem créditos:** `fixtures/story.json` + `fixtures/timing.json` com áudio silencioso de duração conhecida. Testa build e render sem chamar Claude nem ElevenLabs.
- **Testes visuais:** quadros fixos do roteiro de teste são renderizados (`hyperframes snapshot`) e comparados com imagens aprovadas (`hyperframes compare`).
- **Vídeo-galeria:** `story gallery` renderiza a Emily fazendo cada ação, expressão e plano de câmera. Serve de controle de qualidade visual a cada mudança no motor.
- **Fumaça de ponta a ponta:** um job real (Claude + ElevenLabs) roda manualmente antes de ligar o agendamento.

## 13. Skills de apoio na implementação

`claude-api`, `hyperframes-core`, `hyperframes-cli`, `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-audio`, `media-use`, `threejs-webgl`.

## 14. Riscos

| Risco | Mitigação |
|---|---|
| Malhas UGC (cabelo, coroa, bolsa) fora do Roblox | Risco aceito; plano B: recriar essas peças por código. |
| Render 3D lento em Chrome headless | Medir no primeiro protótipo; usar GPU; reduzir sombras ou resolução interna se necessário. |
| Histórias repetitivas | O prompt recebe os títulos dos últimos 30 jobs para evitar repetir temas. |
| Vocabulário limitado deixa as cenas iguais | O campo `wants` mostra o que mais falta, e o vocabulário cresce a partir dele. |
| Custo do ElevenLabs | Cache por fala; cerca de 900 caracteres por vídeo. |
