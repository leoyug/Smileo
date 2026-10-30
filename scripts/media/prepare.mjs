import { preparePhotos } from '../photos/prepare.mjs';
import { prepareMediaManifest } from './manifest.mjs';
import { prepareContentPreviews } from './previews.mjs';

await preparePhotos();
await prepareContentPreviews(undefined, { includeDrafts: process.argv.includes('--include-drafts') });
const manifest = await prepareMediaManifest();
console.log(`已准备 ${Object.keys(manifest.files).length} 个已发布媒体文件。`);
