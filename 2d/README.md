# Emily Stories - 2D

Short story videos (1080x1920) where **flat 2D cartoon characters** (thick outline, big expressive faces) walk and talk inside
the same **3D sets** as the 3D project. Same pipeline: `series import -> make -> jobs/<id>/final.mp4`.
Commands, setup and `.env` are the same as in the root README; run them from this folder.

## How the characters work

- Every character is a puppet drawn by code (`src/engine/art2d.ts`: head, hair, hat, mask, torso, limbs) and animated
  (`src/engine/puppet.ts`) from the same pose system as the 3D project (walk, run, wave, sit, talk...). It always faces the camera
  (billboard); pupils look toward whoever they talk to.
- A character is only a JSON file: `assets/characters/<id>/character.json` -> `art` (skin, shirt, pants, outline, hair style and
  colour, accessories: crown, fedora, tophat, skullmask, bunnymask, furcollar, jacket, glasses, bow, catears, bag).
  Edit it and re-render; no models or textures to export.
- Held props (backpack, gift...) are the 3D prop blocks, held in the puppet's hand.
- 12 expressions come from 8 faces x 3 mouth shapes (closed, half, open), redrawn on a canvas and cached.

## Series

`series/emily-and-lokii/` is a copy of the 3D series so the two looks can be compared; change it freely here, it does not touch 3d/.
Voices and music are cached/generated per project (`cache/`, `assets/music/`).

## Checks

`npm test`, `npm run typecheck`. Look at frames before judging a change:
`npx hyperframes snapshot jobs/<id>/comp --at 3,9,15 --no-end -o out`.
