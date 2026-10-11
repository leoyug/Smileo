import { defineConfig } from "astro/config";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import { preparePhotos } from "./scripts/photos/prepare.mjs";
import { localContentImport } from "./scripts/import/vite-plugin.mjs";
import { localPhotoSlugs } from "./scripts/photo-slug/vite-plugin.mjs";

const require = createRequire(import.meta.url);

const prepareUploadedPhotos = () => ({
  name: "prepare-uploaded-photos",
  configureServer(server) {
    let timer;
    const schedule = (file) => {
      if (!file.includes("/public/media/photos/") && !file.includes("/src/content/photos/")) return;
      clearTimeout(timer);
      timer = setTimeout(() => { preparePhotos().catch((error) => server.config.logger.error(String(error))); }, 800);
    };
    server.watcher.on("add", schedule);
    server.watcher.on("change", schedule);
  },
});

export default defineConfig({
  output: "static",
  site: "https://incessantleo.com",
  redirects: {
    "/photos/the-pier-under-the-blue-night": "/photos/the-pier-under-the-blue-night-sky",
  },
  integrations: process.env.NODE_ENV === "production" ? [] : [react(), keystatic(), localContentImport(), localPhotoSlugs()],
  vite: {
    // Keep check/build from replacing the running dev server's optimized dependencies.
    cacheDir: fileURLToPath(new URL(`./node_modules/.vite/${process.argv[2] ?? "astro"}/`, import.meta.url)),
    plugins: [prepareUploadedPhotos()],
    // Keep CMS adapters live while prebundling their underlying native controls.
    optimizeDeps: {
      exclude: ["@keystar/ui/table", "@keystar/ui/list-view", "@keystar/ui/text-field", "@keystar/ui/number-field", "@keystar/ui/picker", "@keystar/ui/combobox"],
      include: ["@local/keystar-table", "@local/keystar-list-view", "@local/keystar-text-field", "@local/keystar-number-field", "@local/keystar-picker", "@local/keystar-combobox"],
    },
    resolve: {
      alias: [
        { find: /^@keystar\/ui\/table$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-table.js", import.meta.url)) },
        { find: /^@local\/keystar-table$/, replacement: require.resolve("@keystar/ui/table") },
        { find: /^@keystar\/ui\/list-view$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-list-view.js", import.meta.url)) },
        { find: /^@local\/keystar-list-view$/, replacement: require.resolve("@keystar/ui/list-view") },
        { find: /^@keystar\/ui\/text-field$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-text-field.js", import.meta.url)) },
        { find: /^@local\/keystar-text-field$/, replacement: require.resolve("@keystar/ui/text-field") },
        { find: /^@keystar\/ui\/number-field$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-number-field.js", import.meta.url)) },
        { find: /^@local\/keystar-number-field$/, replacement: require.resolve("@keystar/ui/number-field") },
        { find: /^@keystar\/ui\/picker$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-picker.js", import.meta.url)) },
        { find: /^@local\/keystar-picker$/, replacement: require.resolve("@keystar/ui/picker") },
        { find: /^@keystar\/ui\/combobox$/, replacement: fileURLToPath(new URL("./src/admin/keystatic-combobox.js", import.meta.url)) },
        { find: /^@local\/keystar-combobox$/, replacement: require.resolve("@keystar/ui/combobox") },
      ],
    },
  },
});
