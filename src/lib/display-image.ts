import { mediaUrl } from "./media-url";
import { readingPreviewWidth, thumbPreviewWidth, thumbnailPath } from "../../scripts/media/paths.mjs";

export function displayImage(source: string, width: typeof readingPreviewWidth | typeof thumbPreviewWidth | 222): string {
  if (!source.startsWith("/media/")) return mediaUrl(source);
  return mediaUrl(thumbnailPath(source, width));
}

export const readingImage = (source: string) => displayImage(source, readingPreviewWidth);
export const thumbImage = (source: string) => displayImage(source, thumbPreviewWidth);
