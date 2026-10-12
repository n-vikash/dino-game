import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'public', 'models');
await mkdir(outDir, { recursive: true });

// CC0 models. The dinosaur is a detailed textured static GLB; the fern is a
// photoreal Poly Haven scan with embedded PBR maps. Verify license/source links
// in README before redistributing the project.
const assets = [
  {
    name: 'dinosaur.glb',
    url: 'https://www.innerscene.com/api/library/tyrannosaur-dinosaur-aba83a56/download',
    source: 'https://www.innerscene.com/tools/library/3d-parts/tyrannosaur-dinosaur-aba83a56',
  },
  {
    name: 'fern.glb',
    url: 'https://www.innerscene.com/api/library/fern-clumps-82a87bea/download',
    source: 'https://www.innerscene.com/tools/library/3d-parts/fern-clumps-82a87bea',
  },
];

for (const asset of assets) {
  const destination = join(outDir, asset.name);
  console.log(`Downloading ${asset.name} from ${asset.source}`);
  const response = await fetch(asset.url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${asset.name}: download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${asset.name}: response was not a valid binary glTF (GLB). Try opening the source link and downloading it manually.`);
  }
  await writeFile(destination, bytes);
  console.log(`Saved ${asset.name} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
}
console.log('Asset downloads complete. Restart `npm run dev` if it was already running.');
