# Jungle Dino Escape — 3D edition

A 3D endless-runner browser game built with Three.js and Vite. The game has a procedural fallback, plus an optional local asset pipeline for a detailed textured dinosaur GLB and photoreal PBR fern model. Runtime gameplay does not stream assets from a remote server.

## Requirements
- Node.js 20.19+ (or a compatible current Node.js release)
- npm

## Run locally
```bash
npm install
npm run assets
npm run dev
```

`npm run assets` downloads two CC0 GLB models into `public/models/`: a textured tyrannosaur and a photoreal fern. Run this command on a computer with internet access. If downloads are unavailable, the game still runs with its procedural fallback models.
Open the local URL printed by Vite (normally `http://localhost:5173`).

## Controls
- Left / Right arrows or A / D: change lanes
- Space / Up / W: jump
- Down / S: slide
- P / Escape: pause or resume
- Mobile: use the on-screen touch buttons

## Production build
```bash
npm run build
npm run preview
```

## Notes
- Best score and collected coin totals are saved in localStorage.
- The game is designed for desktop and mobile browsers. Performance varies by device.
- Fonts are loaded from Google Fonts when internet access is available; system fallbacks are included.


## Cinematic chase update

- The dinosaur stays hidden during the normal run.
- Hitting a vehicle challenge triggers a timed predator encounter.
- The encounter adds cinematic letterbox bars, a warning title, tighter camera framing, increased fog, and stronger chase animation.
- After the encounter timer ends, the dinosaur hides again and the normal camera/atmosphere return.

Note: the dinosaur, runner, jeep, and vegetation are still code-built placeholder models. This update improves the chase presentation and trigger logic; photorealistic graphics require replacing those placeholders with licensed detailed GLB/glTF models and textures.

## Cinematic graphics and real asset integration

The project includes cinematic bloom, deeper jungle fog, improved shadows, a tighter chase camera, letterbox bars, and a timed predator encounter. Hitting a log, rock, or branch triggers the chase; the dinosaur stays hidden during normal running.

Run `npm run assets` to download these CC0 assets locally:

- `public/models/dinosaur.glb` — detailed textured tyrannosaur model from [Innerscene](https://www.innerscene.com/tools/library/3d-parts/tyrannosaur-dinosaur-aba83a56). This model may be static; the code plays a GLB animation if one exists and otherwise adds subtle body motion.
- `public/models/fern.glb` — photoreal fern clump with embedded PBR textures from Poly Haven, hosted in the Innerscene library: [asset page](https://www.innerscene.com/tools/library/3d-parts/fern-clumps-82a87bea). The generated fern props are replaced when the asset loads.

Both asset pages identify the models as CC0. See [Poly Haven license information](https://polyhaven.com/license). The runner and jeep remain stylized placeholders, and the dinosaur will not have true limb animation unless the chosen GLB includes animation clips. This is a practical asset integration pass, not a claim of fully photorealistic AAA graphics.
