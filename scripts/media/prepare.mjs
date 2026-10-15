import { preparePhotos } from '../photos/prepare.mjs';
import { prepareMediaManifest } from './manifest.mjs';

await preparePhotos();
const manifest = await prepareMediaManifest();
console.log(`已准备 ${Object.keys(manifest.files).length} 个已发布媒体文件。`);
