import { getComponentPhotos } from "./photo-components";
import { mediaUrl } from "./media-url";
import { thumbnailPath } from "../../scripts/media/paths.mjs";
import type { PhotoStackPhoto } from "./photo-stack-types";

export async function getPhotoStackPhotos(): Promise<PhotoStackPhoto[]> {
  const photos = await getComponentPhotos("textHover");
  if (photos.length < 6) return [];
  return photos.map((photo, index) => ({
    id: photo.slug,
    src: mediaUrl(photo.src),
    previewSrc: mediaUrl(thumbnailPath(photo.src, 480)),
    stackSrc: mediaUrl(thumbnailPath(photo.src, index < 3 ? 222 : 480)),
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
  }));
}
