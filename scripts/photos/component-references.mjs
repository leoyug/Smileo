import { readFile } from "node:fs/promises";
import path from "node:path";

const photoId = file => file.match(/^src\/content\/photos\/([^/]+)\.json$/)?.[1];
const componentPaths = ["home-fan", "home-drag", "text-hover"]
  .map(name => `src/data/photo-components/${name}.json`);

// A native photo editor saves one record. Changing its slug submits one old
// record deletion and one new record addition (plus any moved image assets).
// Include dependent selections in that same save and its returned file tree.
export async function renamedPhotoReferences(root, updates, originals) {
  const additions = new Map(updates.additions.map(file => [file.path, file]));
  const deletions = new Set(updates.deletions.map(file => file.path));
  const removed = [...deletions].filter(file => photoId(file) && originals.has(file) && !additions.has(file));
  const added = [...additions.keys()].filter(file => photoId(file) && !originals.has(file) && !deletions.has(file));
  if (removed.length !== 1 || added.length !== 1) return [];
  const oldId = photoId(removed[0]), newId = photoId(added[0]);
  const changes = [];
  for (const file of componentPaths) {
    if (deletions.has(file)) continue;
    let raw;
    try {
      raw = additions.has(file) ? Buffer.from(additions.get(file).contents, "base64url").toString("utf8")
        : await readFile(path.join(root, file), "utf8");
    } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    const data = JSON.parse(raw);
    if (!Array.isArray(data.photos) || !data.photos.includes(oldId)) continue;
    data.photos = data.photos.map(id => id === oldId ? newId : id);
    changes.push({ path: file, contents: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString("base64url") });
  }
  return changes;
}
