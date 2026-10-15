import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createOrderStore } from "./store.mjs";

const addition = (collection, slug, raw) => ({ path: `src/content/${collection}/${slug}.${collection === "photos" ? "json" : "md"}`, contents: Buffer.from(raw).toString("base64url") });
const document = (collection, order, title) => collection === "photos"
  ? JSON.stringify({ order, alt: title, draft: true })
  : `---\norder: ${order}\ntitle: ${title}\npublishedAt: 2026-10-10\ndraft: true\n---\n正文不变。\n`;

function writer(folder) {
  const root = path.resolve(folder, "../../..");
  return async updates => {
    for (const file of updates.additions) await writeFile(path.join(root, file.path), Buffer.from(file.contents, "base64url"));
    for (const file of updates.deletions) await rm(path.join(root, file.path), { force: true });
  };
}

for (const collection of ["projects", "photos", "articles"]) {
  test(`${collection}: edits insert at a position; stale new-item defaults append; deletion closes gaps`, async t => {
    const extension = collection === "photos" ? "json" : "md";
    const { store, folder } = await fixture(t, collection, {
      [`a.${extension}`]: document(collection, 1, "A"),
      [`b.${extension}`]: document(collection, 2, "B"),
      [`c.${extension}`]: document(collection, 3, "C"),
    });
    const save = writer(folder);
    await store.update({ additions: [addition(collection, "c", document(collection, 1, "C 改名"))], deletions: [] }, save);
    assert.deepEqual((await store.snapshot(collection)).entries.map(entry => [entry.slug, entry.order]), [["c", 1], ["a", 2], ["b", 3]]);
    assert.match(await readFile(path.join(folder, `c.${extension}`), "utf8"), /C 改名/);
    // Both create forms opened when position 4 was the end; the second must append at 5.
    for (const slug of ["d", "e"]) await store.update({ additions: [addition(collection, slug, document(collection, 4, slug))], deletions: [] }, save);
    assert.deepEqual((await store.snapshot(collection)).entries.map(entry => [entry.slug, entry.order]), [["c", 1], ["a", 2], ["b", 3], ["d", 4], ["e", 5]]);
    await store.update({ additions: [], deletions: [{ path: `src/content/${collection}/a.${extension}` }] }, save);
    assert.deepEqual((await store.snapshot(collection)).entries.map(entry => [entry.slug, entry.order]), [["c", 1], ["b", 2], ["d", 3], ["e", 4]]);
  });
}

test("legacy article numbering preserves date order and original text; normalization is idempotent", async t => {
  const old = "---\r\ntitle: 较早\r\npublishedAt: 2025-01-01\r\n---\r\n\r\n正文 order: 88\r\n";
  const recent = "---\ntitle: 较新\npublishedAt: 2026-01-01\n---\n\n# 原文\n";
  const { store, folder } = await fixture(t, "articles", { "old.md": old, "recent.md": recent });
  const snapshot = await store.normalize("articles");
  assert.deepEqual(snapshot.entries.map(entry => [entry.slug, entry.order]), [["recent", 1], ["old", 2]]);
  assert.equal(await readFile(path.join(folder, "old.md"), "utf8"), old.replace("---\r\n", "---\r\norder: 2\r\n"));
  assert.deepEqual(await store.normalize("articles"), snapshot);
});

test("native CMS save returns hashes for the final shifted files", async t => {
  const { makeGenericAPIRouteHandler } = await import("@keystatic/core/api/generic");
  const { fields } = await import("@keystatic/core");
  const { store, folder } = await fixture(t, "projects", {
    "a.md": document("projects", 1, "A"), "b.md": document("projects", 2, "B"),
  });
  const root = path.resolve(folder, "../../..");
  const handler = makeGenericAPIRouteHandler({ localBaseDirectory: root, config: {
    storage: { kind: "local" }, collections: { projects: {
      path: "src/content/projects/*", schema: { order: fields.integer({ label: "顺序" }) },
    } },
  } });
  const response = await store.update({ additions: [addition("projects", "b", document("projects", 1, "B"))], deletions: [] }, updates => handler(new Request("http://localhost/api/keystatic/update", {
    method: "POST", headers: { "content-type": "application/json", "no-cors": "1" }, body: JSON.stringify(updates),
  })));
  assert.equal(response.status, 200);
  assert.deepEqual((await store.snapshot("projects")).entries.map(entry => [entry.slug, entry.order]), [["b", 1], ["a", 2]]);
  const tree = await handler(new Request("http://localhost/api/keystatic/tree", { headers: { "no-cors": "1" } }));
  assert.equal(response.body, tree.body);
});

test("native photo rename keeps all component selections and their returned file hashes", async t => {
  const { makeGenericAPIRouteHandler } = await import("@keystatic/core/api/generic");
  const { fields } = await import("@keystatic/core");
  const { store, folder } = await fixture(t, "photos", {
    "old.json": document("photos", 1, "林间小路慢慢走"),
    "keep.json": document("photos", 2, "保留照片"),
  });
  const root = path.resolve(folder, "../../..");
  const components = ["home-fan", "home-drag", "text-hover"];
  const config = { storage: { kind: "local" }, collections: { photos: {
    path: "src/content/photos/*", format: "json", schema: { order: fields.integer({ label: "顺序" }) },
  } }, singletons: Object.fromEntries(components.map(name => [name, {
    path: `src/data/photo-components/${name}`, format: "json",
    schema: { photos: fields.array(fields.relationship({ label: "照片", collection: "photos" }), { label: "选图" }) },
  }])) };
  await mkdir(path.join(root, "src/data/photo-components"), { recursive: true });
  for (const name of components) await writeFile(path.join(root, `src/data/photo-components/${name}.json`),
    JSON.stringify({ photos: ["keep", "old"] }));
  const handler = makeGenericAPIRouteHandler({ localBaseDirectory: root, config });
  const updates = { additions: [addition("photos", "new", document("photos", 1, "林间小路慢慢走"))],
    deletions: [{ path: "src/content/photos/old.json" }] };
  // Preparing dependent updates must not write anything before the native save.
  await assert.rejects(store.update(updates, async () => { throw new Error("保存失败"); }), /保存失败/);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "src/data/photo-components/home-drag.json"), "utf8")).photos, ["keep", "old"]);
  const response = await store.update(updates, changes => handler(new Request("http://localhost/api/keystatic/update", {
    method: "POST", headers: { "content-type": "application/json", "no-cors": "1" }, body: JSON.stringify(changes),
  })));
  assert.equal(response.status, 200);
  for (const name of components) {
    const data = JSON.parse(await readFile(path.join(root, `src/data/photo-components/${name}.json`), "utf8"));
    assert.deepEqual(data.photos, ["keep", "new"]);
  }
  await assert.rejects(readFile(path.join(folder, "old.json")), { code: "ENOENT" });
  const tree = await handler(new Request("http://localhost/api/keystatic/tree", { headers: { "no-cors": "1" } }));
  assert.equal(response.body, tree.body);
});

test("photo selection saves and photo renames share a lock", async t => {
  const { store, folder } = await fixture(t, "photos", { "old.json": document("photos", 1, "旧照片") });
  const root = path.resolve(folder, "../../..");
  const { withContentLock } = await import("./lock.mjs");
  await withContentLock(root, "photo-components", async () => {
    const save = () => { throw new Error("不应调用保存"); };
    await assert.rejects(store.update({ additions: [addition("photos", "new", document("photos", 1, "旧照片"))],
      deletions: [{ path: "src/content/photos/old.json" }] }, save), { status: 409 });
    await assert.rejects(store.update({ additions: [{ path: "src/data/photo-components/home-drag.json", contents: "e30" }], deletions: [] }, save), { status: 409 });
  });
});

test("ordinary photo edits and deletion do not rewrite component selections", async t => {
  const { store, folder } = await fixture(t, "photos", { "old.json": document("photos", 1, "旧照片") });
  const raw = '{ "photos": ["old"] }\n';
  const selection = path.resolve(folder, "../../data/photo-components/home-drag.json");
  await mkdir(path.dirname(selection), { recursive: true });
  await writeFile(selection, raw);
  const save = writer(folder);
  await store.update({ additions: [addition("photos", "old", document("photos", 1, "新描述"))], deletions: [] }, save);
  assert.equal(await readFile(selection, "utf8"), raw);
  await store.update({ additions: [], deletions: [{ path: "src/content/photos/old.json" }] }, save);
  assert.equal(await readFile(selection, "utf8"), raw);
});

async function fixture(t, collection, documents) {
  const root = await mkdtemp(path.join(tmpdir(), "content-order-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const folder = path.join(root, "src/content", collection);
  await mkdir(folder, { recursive: true });
  for (const [name, raw] of Object.entries(documents)) await writeFile(path.join(folder, name), raw);
  return { store: createOrderStore(root), folder };
}

test("photo reorder persists unique positions across store restarts", async (t) => {
  const docs = {
    "a.json": '{\n  "order": 1,\n  "draft": false,\n  "alt": "真实描述"\n}\n',
    "b.json": '{\n  "order": 1,\n  "draft": true,\n  "alt": "草稿"\n}\n',
    "c.json": '{\n  "order": 12,\n  "draft": false,\n  "alt": "另一张照片"\n}\n',
  };
  const { store, folder } = await fixture(t, "photos", docs);
  const before = await store.snapshot("photos");
  const saved = await store.reorder("photos", { version: before.version, keys: ["c"], target: { key: "a", dropPosition: "before" } });
  assert.deepEqual(saved.entries.map((entry) => [entry.slug, entry.order]), [["c", 1], ["a", 2], ["b", 3]]);
  assert.deepEqual(await store.snapshot("photos"), saved);
  const restarted = createOrderStore(path.resolve(folder, "../../.."));
  assert.deepEqual(await restarted.snapshot("photos"), saved);
  for (const [name, raw] of Object.entries(docs)) {
    const current = await readFile(path.join(folder, name), "utf8");
    assert.equal(current.replace(/("order": )\d+/, "$1N"), raw.replace(/("order": )\d+/, "$1N"));
  }
});

test("project reorder preserves frontmatter comments, dates, CRLF and body order text", async (t) => {
  const docs = {
    "a.md": "---\r\ntitle: 项目 A\r\norder: 0 # 保留注释\r\npublishedAt: 2026-10-09\r\n---\r\n\r\n正文\r\norder: 88\r\n",
    "b.md": "---\ntitle: 项目 B\norder: 4\npublishedAt: 2025-10-09\n---\n\n# 真实正文\n",
  };
  const { store, folder } = await fixture(t, "projects", docs);
  const before = await store.snapshot("projects");
  const saved = await store.reorder("projects", { version: before.version, keys: ["a"], target: { key: "b", dropPosition: "after" } });
  assert.equal(await readFile(path.join(folder, "a.md"), "utf8"), docs["a.md"].replace("order: 0 #", "order: 2 #"));
  assert.equal(await readFile(path.join(folder, "b.md"), "utf8"), docs["b.md"].replace("order: 4", "order: 1"));
  assert.deepEqual(await store.snapshot("projects"), saved);
});

test("stale saves refuse to overwrite newer content", async (t) => {
  const { store, folder } = await fixture(t, "photos", {
    "a.json": '{\n "order": 1, "alt": "A"\n}', "b.json": '{\n "order": 2, "alt": "B"\n}',
  });
  const before = await store.snapshot("photos");
  const request = { version: before.version, keys: ["b"], target: { key: "a", dropPosition: "before" } };
  await store.reorder("photos", request);
  const latest = (await readFile(path.join(folder, "a.json"), "utf8")).replace('"A"', '"新描述"');
  await writeFile(path.join(folder, "a.json"), latest);
  await assert.rejects(store.reorder("photos", request), { status: 409 });
  assert.equal(await readFile(path.join(folder, "a.json"), "utf8"), latest);
});

test("invalid IDs and unsupported collections never write content", async (t) => {
  const { store, folder } = await fixture(t, "photos", {
    "a.json": '{\n "order": 1\n}', "b.json": '{\n "order": 2\n}',
  });
  const before = await store.snapshot("photos");
  for (const keys of [["../a"], ["a", "a"], ["missing"]]) {
    await assert.rejects(store.reorder("photos", { version: before.version, keys, target: { key: "b", dropPosition: "after" } }));
  }
  await assert.rejects(store.snapshot("resume"));
  assert.equal((await store.snapshot("photos")).version, before.version);
  assert.equal(await readFile(path.join(folder, "a.json"), "utf8"), '{\n "order": 1\n}');
});
