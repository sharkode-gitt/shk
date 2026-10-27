---
name: emily-stories-2d
description: Continue the 2D Emily Stories project in the 2d/ folder - automated short story videos with flat 2D cartoon characters (thick outline, drawn by code) standing in 3D worlds, like Toonz Craft style videos. Use when the user mentions 2D videos, cartoon/2D characters in a 3D world, the 2d folder, or art/expressions of the 2D puppets.
---

# Emily Stories - 2D project handoff

Only for the **`2d/` folder**. The Roblox-style 3D version lives in `3d/` with the `emily-stories` skill; never mix their assets,
series, jobs or cache. **Run every command from inside `2d/`.** The user is Brazilian: answer in Portuguese; video text and voices are English.

## What it is

Same pipeline as 3D (`series import -> make -> jobs/<id>/final.mp4`, ElevenLabs voices, Rubik captions, music, HyperFrames render), but the
characters are **flat cartoon puppets** in the 3D sets (reference look: thick coloured outline, big face, hands as circles, hard shadow blob):

- `src/engine/art2d.ts` draws parts on canvases (head with hair/hat/mask and 8 faces x 3 mouth shapes, torso, limbs, hands, shoes).
- `src/engine/puppet.ts` assembles the billboard puppet and maps the shared pose joints (walk, run, wave, sit...) to 2D arms/legs/head.
- `src/engine/main.ts` builds sets, puppets, name tags and held 3D props; `state.ts` and `actions/` are shared with 3D by copy.
- 2D cameras ignore yaw (`yaws[id] = 0`) and sit farther than in 3D (closeup 12.5, medium 11.5, push_in 15 to 11).
- A character = `assets/characters/<id>/character.json` with `art` (skin, shirt, pants, outline, hair style/colour, accessories). No models.
  Accessories: crown, fedora, tophat, skullmask, bunnymask, furcollar, jacket, glasses, bow, catears, bag.

## Commands (from 2d/)

```
npm run story -- series import series/emily-and-lokii
npm run story -- make emily-and-lokii-ep1
npm test ; npm run typecheck
```

`.env` needs `ELEVENLABS_API_KEY` (git-ignored). Voices are cached per text+voice in `2d/cache`. To re-render a finished job set its
`status.json` state back to `approved`.

## State and next steps

Ep1 renders end to end (checked frame by frame). Still crude: stick-like arms and legs, no wrist/neck blending, long hair is a flat block
(Emily), Lokii's body is plain black, lying/falling is approximate, held props are 3D blocks, no per-character expression style, eps 2-4 not
rendered. Ideas: rounder bodies (`build: round`), shading, hand-drawn style textures, walk squash and stretch, speech bubbles.

## Rules

- Never write API keys into files, commits, logs or chat. Report honestly; look at frames before saying a visual fix worked.
- Do not commit or push unless the user asks.
