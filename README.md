# Emily Stories

Automated short story videos (1080x1920, 20-60 s) made entirely from code: Claude writes the script, ElevenLabs voices it,
and a Three.js + HyperFrames engine renders the MP4. Two separate projects, two separate looks:

| Folder | Look | Characters |
| --- | --- | --- |
| [`3d/`](3d/README.md) | Roblox-style 3D | Roblox R15 exports (.obj) in a 3D set |
| [`2d/`](2d/README.md) | 2D cartoon in a 3D world | Flat outlined puppets drawn by code, standing in the same 3D sets |

Each folder is self-contained: its own `package.json`, `assets/`, `series/`, `jobs/`, `cache/`, `.env`, tests and CLI.
Run everything from inside the folder you want:

```
cd 3d   (or 2d)
npm install
copy .env.example .env     # add ELEVENLABS_API_KEY
npm run story -- series import series/emily-and-lokii
npm run story -- make emily-and-lokii-ep1
```

Never put API keys in files or commits (`.env` is git-ignored).
