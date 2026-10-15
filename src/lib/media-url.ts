import manifest from '../data/media-manifest.json';
import { resolveMediaUrl } from '../../scripts/media/paths.mjs';

export function mediaUrl(value: string): string {
  return resolveMediaUrl(value, import.meta.env.PUBLIC_MEDIA_BASE, manifest.files);
}
