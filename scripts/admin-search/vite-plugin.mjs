import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const nativeSearch = `return entriesWithData.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [entriesWithData, searchTerm]);`;
const uiModule = /\/node_modules\/@keystatic\/core\/dist\/keystatic-core-ui\.js(?:\?|$)/;
const helperPath = fileURLToPath(new URL("../../src/admin/collection-search.js", import.meta.url));

function extendSearch(code, helper) {
  if (code.split(nativeSearch).length !== 2) {
    throw new Error("Keystatic 列表搜索实现已变化，请更新中文搜索适配。");
  }
  return `import { matchesCollectionSearch } from ${JSON.stringify(helper)};\n${code.replace(nativeSearch,
    `return entriesWithData.filter(item => matchesCollectionSearch(item, searchTerm, collection.slugField));
  }, [entriesWithData, searchTerm, collection.slugField]);`)}`;
}

// The table adapter receives already-filtered items, so extend the native
// filter before that point. Keep this dev-only and fail explicitly on upstream
// changes instead of silently reverting to slug-only search after an upgrade.
export function collectionSearch() {
  return {
    name: "local-collection-search",
    apply: "serve",
    enforce: "pre",
    config() {
      return { optimizeDeps: { esbuildOptions: { plugins: [{
        name: "local-collection-search",
        setup(build) {
          build.onLoad({ filter: uiModule }, async ({ path }) => ({
            contents: extendSearch(await readFile(path, "utf8"), helperPath), loader: "js",
          }));
        },
      }] } } };
    },
    transform(code, id) {
      if (!uiModule.test(id)) return;
      return { code: extendSearch(code, "/src/admin/collection-search.js"), map: null };
    },
  };
}
