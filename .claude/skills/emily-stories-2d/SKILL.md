---
name: emily-stories-2d
description: Make and continue the 2D Emily and Lokii story videos in the 2d/ folder - flat 2D cartoon characters (Remotion + ffmpeg), stories written as JSON, ElevenLabs voices, rendered to MP4 by code. Use when the user mentions 2D videos, the 2d folder, cartoon characters, Emily/Lokii/Bacon/Lexi in 2D, a new episode, the A/B choice ending, or characters, backgrounds and expressions of the 2D engine.
---

# Emily Stories - 2D

Only for the **`2d/` folder**. The Roblox-style 3D version lives in `3d/` with the `emily-stories` skill; never mix their assets,
stories or output. **Run every command from inside `2d/`.** The user is Brazilian: **answer in Portuguese**; all video text,
captions and voices are **English**. The engine is the user's own `videos-2d-curiosidades` skill (copied into `2d/`); its script
format is in `2d/docs/script-format.md`.

## Flow

1. `cd 2d && npm ci` (once). Remotion downloads its own Chrome on first render.
2. Key: `ELEVENLABS_API_KEY` lives in `2d/.env` (git-ignored). Load it for the command without printing it
   (`set -a; . ./.env; set +a`). **Never ask for the key in chat, never write it into a file, log or commit.** No key = silent render
   with estimated timing: say so.
3. A story is `stories/<slug>/bible.json` (characters + ElevenLabs `voiceId`, `narratorId`) and `ep<N>.json` (scenes -> beats).
   Beats <= 14 words; `[brackets]` highlight a word; 1-2 characters per scene; strong hook in the first 3 s.
4. **Look first, cheap**: `npm run ep -- <slug> <N> --stills=20,160,330`, read the PNGs in `out/`, fix, then render.
5. `npm run ep -- <slug> <N>` renders voice + video to `out/<slug>-ep<N>.mp4` (a couple of minutes for 28 s). Deliver it with
   SendUserFile. Say what was and was not verified (you cannot hear the audio; check frames and `volumedetect`).

## Series: emily-and-lokii

`stories/emily-and-lokii/`: Emily (narrator and protagonist), Lokii (scary-looking, golden skull mask, kind), Bacon, Lexi.
Ep 1 The Kid in the Skull Mask (school hallway), 2 Whose Backpack? (classroom), 3 Bacon Is Angry (hallway), 4 Mask or Friend?
(park). Eps 1-3 end with the "PART N+1 / LIKE AND SUBSCRIBE" card (`nextTitle`); ep 4 ends with the A/B vote (`choice`: should
Emily be Lokii's friend?). After the vote, ep 5 continues from the winning option (`scripts/gen.ts`, memory in
`stories/<slug>/memory.md`; the gen prompt is Portuguese and must be switched to English first).
Voices use the same ElevenLabs ids as `3d/assets/voices.json` (Lokii, Bacon and Lexi are provisional; the user must confirm them).

## Engine facts

- `src/lib/Character.tsx` (SVG puppet: head, hair, outfits, moods, lip-sync from the audio wave), `Scenery.tsx` and
  `Background.tsx` (backgrounds), `Episode.tsx` (scenes, captions, transitions, CTA and choice cards), `scripts/build.ts`
  (voice + timeline + render).
- Added for this series: `hat: crown|fedora|tophat`, `mask: skull`, `fur`, `bag`, `outfit: sweater`; backgrounds `escola`, `aula`,
  `parque`; CTA text in English.
- Moods: neutral angry sad scared happy. Cam: drift none zoom_in zoom_out pan_l pan_r shake. Trans: blur fade whip dip flash.
- The voice cache `public/audio/cache` is git-ignored; re-rendering an unchanged line costs nothing, changing a voice costs credits.
- `typescript` stays on 5.6.x (Remotion's bundler breaks with TS 6). Auto-posting is not implemented.
- A bash command with an apostrophe inside a quoted heredoc failed in this environment: write files with the Write tool.

## State and next steps

Ep 1 is rendered with ElevenLabs voices (27.7 s, checked on frames). Eps 2-4 are written but not rendered. Ideas: walking and
entering animations, props (backpack, gift) drawn for real (today they are only in the text), more background detail.

## Rules

- Report honestly; look at frames before saying a visual fix worked. Do not commit or push unless the user asks.
