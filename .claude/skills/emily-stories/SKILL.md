---
name: emily-stories
description: Continue the 3D (Roblox-style) Emily Stories project in the 3d/ folder - automated 3D Roblox-style short story videos (HyperFrames + Three.js, ElevenLabs voices, rendered to MP4 by code). Use when the user mentions Emily, Lokii, Bacon, the "Emily and Lokii" series, episodes, the A/B choice ending, rendering/making videos, voices, music, characters from Roblox Studio, or continuing this project on their own PC.
---

# Emily Stories - 3D project handoff

This skill is only for the **`3d/` folder** (Roblox R15 characters). The 2D cartoon version is a separate project in `2d/` with its own
skill, `emily-stories-2d`; never mix their assets, series or jobs. **Run every command from inside `3d/`.**

The user is Brazilian: **answer in Portuguese**; all video dialogue, captions and voices are **English**.
They want a fully automated, all-code pipeline (no video editor) that turns a Claude-written script into a 1080x1920,
30 fps MP4 short (20-60 s) with a 3D Roblox-style scene, ElevenLabs voices, Rubik captions with smooth in/out,
background music and sfx. Read `3d/README.md` for the commands and `3d/docs/RODAR-NO-PC.md` for the Windows run guide.

## Pipeline

`story new|series import -> approve -> make` => `jobs/<id>/final.mp4`.
States: drafted -> approved -> voiced -> built -> rendered (+ rejected, failed, needs-review). `make` resumes where it stopped.
Voices are cached in `cache/` by text+voice. Job ids are `YYYY-MM-DD-NNN` or `<series>-ep<N>`.

```
npm run story -- series import series/emily-and-lokii   # 4 approved jobs: emily-and-lokii-ep1..ep4
npm run music                                           # generates missing music moods with ElevenLabs Music
npm run story -- make emily-and-lokii-ep1               # voices + render (do ep1, review, then ep2..ep4)
npm test ; npm run typecheck ; npm run test:visual      # visual baselines live in tests/visual/approved
```

Needs Node 22+, FFmpeg/FFprobe, Chrome (HyperFrames). `ELEVENLABS_API_KEY` goes in the git-ignored `.env`.
Writer provider defaults to `claude-code` (`claude -p`, the user's plan); `api` needs `ANTHROPIC_API_KEY`.
`WORKERS=auto` speeds up rendering. Cloud container had no GPU (about 1 fps); the user's PC is untested.

## The series (decided with the user)

4 short episodes (~25 s, 1 set, <=3 characters, <=1 key prop) in `series/emily-and-lokii/ep1..4.json`
(+ `ROTEIRO.md`, `ASSETS.md`). Emily is the narrator/protagonist; Lokii is the scary-looking (golden skull mask) new kid.
Eps 1-3 end with the narrator asking to like and subscribe for the next part (end card: PART N + LIKE + SUBSCRIBE).
Ep 4 ends with an **A/B audience choice** ("Should Emily be Lokii's friend?" A yes / B no) as a comment-to-vote test.
Music moods: ep1 tense, ep2/ep3 funny, ep4 sad. Missing tracks (tense, sad) must be generated: `npm run music`.

## Characters

Roster in `assets/characters/<id>/` (character.json + parts.json + OBJ/MTL/textures): emily, bacon, ben, fzk, lexi, lokii, sammy
(Roblox R15 exports). Voices are in `assets/voices.json` (emily, mom, dad, ... plus provisional ones for bacon, ben, fzk, lexi,
lokii, sammy - Lokii's demon voice and the others are to be confirmed by the user). Add characters with
`npm run story -- character add <folder> --id ... --name ...`.
Face styles: `emily` (Emily only), `cute` (simple round eyes + smile: Bacon, Ben, Sammy - the user approved it),
`classic`, `none` (fixed model faces: Fzk, Lexi, Lokii). A model's own painted face is hidden with `face.clear` rects.
The user disliked the old `classic` face as "scary" and rejected the Emily face on Bacon; keep `cute`.

## What is implemented (all committed on branch `feat/engine`)

Roster-based rendering, held props (`do[].item`: backpack, gift... in the right hand), end cards from `story.cta`,
distance-driven walk/run cycle, bigger rooms/ground (no void in wide shots), camera bounds, Rubik captions with per-speaker
colors, music ducking, sfx map, series import, ElevenLabs voice cache and quota handling.

## Done since the first handoff (all committed)

First real run on the user's PC: music generated (tense, sad, happy), ep1 voiced and rendered (about 35 s). Fixed for Windows:
`src/jobs/store.ts` was never in git (the `jobs/` ignore rule matched `src/jobs/`; rules are now `/*/jobs/`), and the hyperframes CLI is
run through `node` (`HYPERFRAMES` in `src/render/render.ts`) because `npx` cannot be spawned. Ep1 polish: one-line captions, name tags under
characters in wide shots, hanging schoolbag prop, 2.4-stud personal space (the walker steers around), speaker and addressee turn to face
each other (eased), Lokii `lift` light. `tools/spacing.ts <job>` prints the closest approach of any two characters.
To re-render a finished job, set its `status.json` state back to `approved` (voices come from the cache, no credits spent).

## Series format since the redo (3D)

Each scene lists `cast` (1 or 2 ids; the first stands on the left): only those characters are on screen, so **never more than 2
characters per scene**. **A narrator (Emily's voice-over) line comes before every character line**, then the character speaks.
Episodes are 2 or 3 scenes (ep1 hallway: Lokii+Bacon, then Emily+Lokii; ep2 classroom: Emily+Lokii, then Lexi+Lokii; ep3 hallway: Bacon+Emily,
then Lokii+Bacon; ep4 park: Lokii+Bacon, Emily+Bacon, Emily+Lokii), 27-35 s each, all four rendered. Hallway has the rebuilt painted-wall set;
the classroom and the park are still plain (next job: bring them to the hallway's level, see `src/engine/sets/textures.ts`).

## Known issues / next steps

- Final voices, music and renders for the 4 episodes have **not been produced yet** (the cloud server could not use the
  ElevenLabs key; on the user's PC it works). First job: run the 4 steps above and review `final.mp4` of ep1.
- Background quality is still plain: add floor/wall textures, fill light, contact shadows, background blur in close-ups.
- Walking was rewritten but not judged in motion yet; check it in the first real render.
- Lokii/Lexi/Fzk have fixed faces (no expressions); some accessories (Lokii's coat) may follow the head instead of the torso.
- Claude-written choreography is simplistic; hand-tune `do[]` in the ep JSON if a beat looks flat.
- Held props are code-drawn boxes; the user may later supply nicer models in `assets/props/`.
- Windows scheduler (`scripts/schedule.ps1`) is untested.

## Rules

- **Never write API keys into files, commits, logs or chat output.** The user pasted keys in chat before; they were told to revoke
  them. Keys only live in `.env` (git-ignored) or as a per-command env var.
- Report results honestly; never claim a render/voice worked without checking the file.
- After engine changes run `npm test`, `npm run typecheck`, `npm run test:visual`; re-approve baselines only after looking at the frames
  (`UPDATE_VISUAL=1`).
- Look at frames before claiming visual fixes: `npx hyperframes snapshot jobs/<id>/comp --at 3,9,15 --no-end -o out`.
- Do not make commits or push unless the user asks (in the cloud session they did ask; locally ask first).
