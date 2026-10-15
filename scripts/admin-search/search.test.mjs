import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fields } from "@keystatic/core";
import { matchesCollectionSearch } from "../../src/admin/collection-search.js";
import { collectionSearch } from "./vite-plugin.mjs";

const photo = { name: "Sanxingdui-Bronze-Mask", data: { alt: "三星堆青铜面具" } };

test("photo search matches Chinese descriptions and permanent slugs", () => {
  for (const query of ["三星堆青铜面具", "青铜", "  三星堆  ", "BRONZE", "Sanxingdui-Bronze-Mask"]) {
    assert.equal(matchesCollectionSearch(photo, query, "alt"), true, query);
  }
  assert.equal(matchesCollectionSearch(photo, "河边", "alt"), false);
});

test("empty queries restore all entries and unloaded names remain searchable", () => {
  for (const query of ["", "  ", "　"]) assert.equal(matchesCollectionSearch(photo, query, "alt"), true);
  assert.equal(matchesCollectionSearch({ name: "Photo-ABC" }, "abc", "alt"), true);
  assert.equal(matchesCollectionSearch({ name: "Photo-ABC" }, "画面", "alt"), false);
});

test("search reads native slug-field names without changing stable identifiers", () => {
  const field = fields.slug({ name: { label: "画面描述" } });
  const item = { name: photo.name, data: { alt: field.reader.parseWithSlug(photo.data.alt, { slug: photo.name, glob: "*" }) } };
  assert.equal(matchesCollectionSearch(item, "青铜", "alt"), true);
  assert.equal(item.name, photo.name);
  assert.equal(matchesCollectionSearch({ name: "project", data: { title: "中文项目标题" } }, "项目", "title"), true);
  assert.equal(matchesCollectionSearch({ name: "article", data: { title: "ＡＳＴＲＯ 写作" } }, "astro", "title"), true);
});

test("adapter patches the installed Keystatic filter and rejects incompatible updates", async () => {
  const require = createRequire(import.meta.url);
  const id = require.resolve("@keystatic/core/ui").replace("keystatic-core-ui.node.js", "keystatic-core-ui.js");
  const source = await readFile(id, "utf8");
  const plugin = collectionSearch();
  const patched = plugin.transform(source, id);
  assert.match(patched.code, /import \{ matchesCollectionSearch \} from "\/src\/admin\/collection-search.js"/);
  assert.match(patched.code, /matchesCollectionSearch\(item, searchTerm, collection.slugField\)/);
  assert.ok(!patched.code.includes("item.name.toLowerCase().includes(searchTerm.toLowerCase())"));
  let load;
  plugin.config().optimizeDeps.esbuildOptions.plugins[0].setup({
    onLoad(options, callback) { assert.ok(options.filter.test(id)); load = callback; },
  });
  const optimized = await load({ path: id });
  assert.match(optimized.contents, /matchesCollectionSearch\(item, searchTerm, collection.slugField\)/);
  assert.match(optimized.contents, /from ".*\/src\/admin\/collection-search.js"/);
  assert.equal(plugin.transform(source, "/unrelated.js"), undefined);
  assert.throws(() => plugin.transform("upstream changed", id), /搜索实现已变化/);
});
