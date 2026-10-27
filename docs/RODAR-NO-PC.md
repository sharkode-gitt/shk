# Rodar a série no seu PC (Windows)

A ElevenLabs recusa a chave quando o pedido sai do servidor da nuvem; no seu PC ela funciona. Por isso as vozes, a música e o render rodam aí.

## 1. Uma vez só

Instale: **Node 22+** (nodejs.org), **FFmpeg** (`winget install Gyan.FFmpeg`) e **Git** (`winget install Git.Git`). Feche e abra o PowerShell depois.

```powershell
git clone https://github.com/sharkode-gitt/shk.git
cd shk
git checkout feat/engine
npm install
copy .env.example .env
notepad .env        # preencha ELEVENLABS_API_KEY=sk_...   (ANTHROPIC_API_KEY só se usar provider "api")
```

## 2. Gerar música que falta, importar e renderizar

```powershell
npm run music                                        # cria as músicas "tense" e "sad" (gasta créditos de música)
npm run story -- series import series/emily-and-lokii
npm run story -- list                                # emily-and-lokii-ep1..ep4 aprovados
npm run story -- make emily-and-lokii-ep1            # vozes + render; retoma de onde parou
```

O vídeo fica em `jobs\emily-and-lokii-ep1\final.mp4`. Faça o ep1 primeiro, assista, e só então rode os outros:

```powershell
npm run story -- make emily-and-lokii-ep2
npm run story -- make emily-and-lokii-ep3
npm run story -- make emily-and-lokii-ep4
```

Com placa de vídeo cada episódio deve levar poucos minutos (sem GPU, uns 15–20). Para usar mais núcleos: `$env:WORKERS="auto"` antes do comando.

## Se algo falhar

- `make` diz qual voz está vazia: preencha o voice id em `assets\voices.json` (ou `npm run story -- voices --fill`).
- Créditos acabaram: o `make` para sem perder nada; recarregue e rode de novo.
- Nunca cole a chave em chat nem faça commit do `.env` (já é ignorado pelo git).
