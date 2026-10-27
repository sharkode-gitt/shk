# Emily Stories

Generates short 3D "blocky" story videos (1080x1920, 20-60 s) with Emily as the protagonist, entirely from code:
Claude writes the script, ElevenLabs voices it, and the engine (Three.js + HyperFrames) renders the MP4. No video editor.

```
story new  ->  you read story.md  ->  story approve  ->  story make  ->  jobs/<id>/final.mp4
```

## Requirements

- Node 22+, FFmpeg and FFprobe on the PATH.
- **Writing the scripts** uses one of these (`writer.provider` in `config.json`):
  - `claude-code` (default): the Claude Code CLI (`claude`) logged in to your Claude plan. No API key, no per-token bill;
    it counts against your plan's usage limits. Run `claude` once in a terminal and log in.
  - `api`: the Claude API with `ANTHROPIC_API_KEY` (billed per token; credits needed in the Anthropic Console).
- **Voices** use ElevenLabs and always need `ELEVENLABS_API_KEY` (billed in ElevenLabs credits).
- A GPU makes rendering much faster. On a machine with no GPU a 35 s video took about 15 minutes.

## Setup

```
npm install
copy .env.example .env      # then fill in ELEVENLABS_API_KEY (and ANTHROPIC_API_KEY if provider is "api")
```

`.env` is ignored by git. Never paste keys into chats or commit them; if one leaks, revoke it and create a new one.

Voices: `assets/voices.json` maps each speaker to an ElevenLabs **voice id** (Voice Library -> the voice -> "Copy voice ID").
Fill in `emily` (narration and Emily's lines), then `mom`, `dad`, `teen_girl`, `little_brother`, `boy`, `teacher`, `old_lady`.
To let the program suggest them: `npm run story -- voices` lists the voices of your ElevenLabs account, and `npm run story -- voices --fill`
puts a suggested voice into every empty slot (it never overwrites one you filled in). Listen to them in ElevenLabs and swap any you dislike.
`make` stops with a clear message naming the voice if one it needs is empty.

## Everyday use

```
npm run story -- new "Emily's crush finds her diary"   # or just: new   (Claude picks the idea); --count 3 for three
npm run story -- list
# open jobs/<id>/story.md and read it
npm run story -- approve <id>
npm run story -- reject <id> "too sad, make the twist funnier"     # writes a new draft that follows the note
npm run story -- make <id>          # or: make --approved
```

`make` voices, builds and renders, and **resumes** where it stopped: running it again never repeats a finished stage
or re-buys a voice line (voices are cached by text and voice in `cache/`). States: `drafted -> approved -> voiced -> built -> rendered`,
plus `rejected`, `failed` (fix the cause, then `approve` again) and `needs-review` (the render exists but failed a check,
see `status.json`).

If ElevenLabs credits run out, `make --approved` stops, leaves the remaining jobs `approved` and exits with code 2. Add credits and run it again.

A job folder (`jobs/<id>/`) holds `story.json`, `story.md`, `audio/`, `timing.json`, `comp/` (the HyperFrames project),
`final.mp4`, `log.txt` and `status.json`.

`npm run story -- gallery` renders a QA video in which Emily performs every action, face and camera shot.

## Music and sound effects

Optional and off until you add files. Put `.mp3` tracks in `assets/music/<mood>/` (`sad`, `tense`, `happy`, `funny`, `twist`);
the engine picks one per mood and lowers it under the voice. Sound effects go in `assets/sfx/` with a `map.json`
(keys `cut`, `act:fall`, `act:jump`, ...). Keep a licence note for every file in `assets/LICENSES.md`.

## Scheduling on Windows

```
powershell -ExecutionPolicy Bypass -File scripts\schedule.ps1 -Install     # -Remove to undo
```

Creates `EmilyStories-New` (daily 08:00, three drafts) and `EmilyStories-Make` (every 2 h, 09:00-23:00, renders what you approved).
Output goes to `logs\schedule-YYYY-MM-DD.log`. Install it only after a manual run worked. With `claude-code` as the writer,
the PC must be logged in to Claude Code, and each scheduled draft uses some of your plan's limit.

## Development

```
npm test              # unit tests (about 230)
npm run typecheck
npm run test:visual   # compares fixture frames with tests/visual/approved (needs Chrome; about 20 s)
npm run fixture       # renders fixtures/e2e end to end into jobs/fixture/final.mp4
```

Design: `docs/superpowers/specs/2026-10-26-emily-stories-design.md`. Plans: `docs/superpowers/plans/`.

## Measured so far

| What | Result |
| --- | --- |
| Render, 25.8 s video, 3 workers, no GPU (cloud container) | 512 s |
| Render, 34.9 s gallery, 3 workers, no GPU | 14.5 min |
| One script written through `claude -p` (Sonnet 5.5) | 19 s, 123 words, valid first try |
| Full run with real ElevenLabs voices | not measured yet |
| Render time and ElevenLabs cost on your PC | add here after the first real run |
