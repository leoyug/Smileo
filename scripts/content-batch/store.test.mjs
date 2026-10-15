import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBatchStore } from "./store.mjs";
import { createOrderStore } from "../content-order/store.mjs";
import { withContentLock } from "../content-order/lock.mjs";

async function fixture(t, documents) {
  const root = await mkdtemp(path.join(tmpdir(), "content-batch-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const collection of ["photos", "projects", "articles"]) await mkdir(path.join(root, "src/content", collection), { recursive: true });
  for (const [relative, raw] of Object.entries(documents)) {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, raw);
  }
  return { root, store: createBatchStore(root), read: relative => readFile(path.join(root, relative), "utf8") };
}

test("upload order survives edits, saved display reorders and restarts; new uploads append", async t => {
  const { root, store } = await fixture(t, {});
  const folder = path.join(root, "src/content/photos");
  await writeFile(path.join(folder, "z-first.json"), JSON.stringify({ order: 1, draft: true, alt: "First" }, null, 2));
  await new Promise(resolve => setTimeout(resolve, 15));
  await writeFile(path.join(folder, "a-second.json"), JSON.stringify({ order: 2, draft: true, alt: "Second" }, null, 2));
  const before = await store.snapshot("photos");
  const positions = entries => new Map(entries.map(entry => [entry.slug, entry.uploadOrder]));
  assert(positions(before.entries).get("z-first") < positions(before.entries).get("a-second"));
  const order = createOrderStore(root);
  const initial = await order.snapshot("photos");
  await order.reorder("photos", { version: initial.version, keys: ["a-second"], target: { key: "z-first", dropPosition: "before" } });
  const edited = await store.snapshot("photos");
  await store.apply("photos", { version: edited.version, action: "publish", keys: ["z-first"] });
  assert.deepEqual(positions((await createBatchStore(root).snapshot("photos")).entries), positions(before.entries));
  await writeFile(path.join(folder, "b-new.json"), '{"order":3,"draft":true,"alt":"New"}');
  const uploaded = await store.snapshot("photos");
  assert(positions(uploaded.entries).get("b-new") > Math.max(...positions(before.entries).values()));
  const deleted = await store.apply("photos", { version: uploaded.version, action: "delete", keys: ["a-second"] });
  assert(!positions(deleted.entries).has("a-second"));
  await writeFile(path.join(folder, "a-second.json"), '{"order":4,"draft":true,"alt":"Uploaded again"}');
  assert(positions((await store.snapshot("photos")).entries).get("a-second") > positions(uploaded.entries).get("b-new"));
});

test("concurrent list reads share upload positions and atomic record replacements keep them", async t => {
  const { root, store } = await fixture(t, {
    "src/content/articles/a.md": "---\ntitle: A\ndraft: true\n---\nA",
    "src/content/articles/b.md": "---\ntitle: B\ndraft: true\n---\nB",
  });
  const snapshots = await Promise.all([store.snapshot("articles"), store.snapshot("articles")]);
  assert.deepEqual(snapshots[0], snapshots[1]);
  const file = path.join(root, "src/content/articles/a.md");
  await writeFile(`${file}.tmp`, "---\ntitle: Changed\ndraft: true\n---\nChanged");
  await rename(`${file}.tmp`, file);
  const after = await createBatchStore(root).snapshot("articles");
  assert.deepEqual(after.entries, snapshots[0].entries);
});

test("batch status changes only selected records and persists after restart", async t => {
  const a = '{\n  "draft": true,\n  "alt": "A",\n  "order": 1\n}\n';
  const b = '{\n  "draft": true,\n  "alt": "B",\n  "order": 2\n}\n';
  const { root, store, read } = await fixture(t, { "src/content/photos/a.json": a, "src/content/photos/b.json": b });
  const before = await store.snapshot("photos");
  const saved = await store.apply("photos", { action: "publish", keys: ["a"], version: before.version });
  assert.equal(await read("src/content/photos/a.json"), a.replace('"draft": true', '"draft": false'));
  assert.equal(await read("src/content/photos/b.json"), b);
  const restarted = createBatchStore(root);
  assert.deepEqual(await restarted.snapshot("photos"), { version: saved.version, entries: saved.entries });
  const drafted = await restarted.apply("photos", { action: "draft", keys: ["a", "b"], version: saved.version });
  assert.equal(drafted.affected, 2);
  assert(drafted.entries.every(entry => entry.draft));
});

test("project and article state preserves frontmatter comments, CRLF and body", async t => {
  const raw = "---\r\ntitle: 标题\r\ndraft: false # 状态\r\n---\r\n\r\n正文\r\ndraft: false\r\n";
  const { store, read } = await fixture(t, { "src/content/projects/a.md": raw, "src/content/articles/a.md": raw });
  for (const collection of ["projects", "articles"]) {
    const before = await store.snapshot(collection);
    await store.apply(collection, { action: "draft", keys: ["a"], version: before.version });
    assert.equal(await read(`src/content/${collection}/a.md`), raw.replace("draft: false #", "draft: true #"));
  }
});

test("invalid requests and stale versions leave every record intact", async t => {
  const raw = '{"draft": true, "alt": "A"}\n';
  const { store, root, read } = await fixture(t, { "src/content/photos/a.json": raw });
  const before = await store.snapshot("photos");
  for (const keys of [[], ["a", "a"], ["../a"], ["missing"]]) {
    await assert.rejects(store.apply("photos", { action: "delete", keys, version: before.version }));
  }
  await assert.rejects(store.apply("photos", { action: "invalid", keys: ["a"], version: before.version }));
  await writeFile(path.join(root, "src/content/photos/a.json"), raw.replace('"A"', '"新描述"'));
  await assert.rejects(store.apply("photos", { action: "publish", keys: ["a"], version: before.version }), { status: 409 });
  assert.equal(await read("src/content/photos/a.json"), raw.replace('"A"', '"新描述"'));
});

test("photo deletion moves records and unshared assets out of public and retains shared assets", async t => {
  const { store, root, read } = await fixture(t, {
    "src/content/photos/a.json": '{"order":1,"draft": false,"src":"/media/photos/a/src.jpg"}',
    "src/content/photos/b.json": '{"order":2,"draft": false,"src":"/media/photos/shared/src.jpg"}',
    "src/content/photos/c.json": '{"order":3,"draft": false,"src":"/media/photos/shared/src.jpg"}',
    "public/media/photos/a/src.jpg": "A image",
    "public/media/photos/a/src-preview-480.webp": "A preview",
    "public/media/photos/a/src-preview-222.webp": "A compact preview",
    "public/media/photos/shared/src.jpg": "shared image",
    "public/media/photos/shared/src-preview-480.webp": "shared preview",
  });
  const before = await store.snapshot("photos");
  await store.apply("photos", { action: "delete", keys: ["a", "b"], version: before.version });
  await assert.rejects(read("src/content/photos/a.json"), { code: "ENOENT" });
  await assert.rejects(read("public/media/photos/a/src.jpg"), { code: "ENOENT" });
  assert.equal(await read("public/media/photos/shared/src.jpg"), "shared image");
  await assert.rejects(read("public/media/photos/a/src-preview-480.webp"), { code: "ENOENT" });
  await assert.rejects(read("public/media/photos/a/src-preview-222.webp"), { code: "ENOENT" });
  assert.equal(await read("public/media/photos/shared/src-preview-480.webp"), "shared preview");
  assert.deepEqual((await store.snapshot("photos")).entries.map(entry => entry.slug), ["c"]);
  assert.equal(JSON.parse(await read("src/content/photos/c.json")).order, 1);
  const [backup] = await readdir(path.join(root, "private/content-trash"));
  assert.equal(await read(`private/content-trash/${backup}/public/media/photos/a/src.jpg`), "A image");
  assert.equal(await read(`private/content-trash/${backup}/public/media/photos/a/src-preview-480.webp`), "A preview");
});

test("deletion refuses linked content without removing any selected record", async t => {
  const { store, read } = await fixture(t, {
    "src/content/projects/a.md": "---\ntitle: A\n---\n正文",
    "src/content/projects/b.md": "---\ntitle: B\n---\n正文",
    "src/content/articles/link.md": "---\ntitle: 关联文章\nrelatedProjects: [a]\n---\n正文",
  });
  const before = await store.snapshot("projects");
  await assert.rejects(store.apply("projects", { action: "delete", keys: ["a", "b"], version: before.version }), /仍引用/);
  assert.equal(await read("src/content/projects/b.md"), "---\ntitle: B\n---\n正文");
});

test("batch operations and drag sorting share the same collection lock", async t => {
  const { root, store } = await fixture(t, { "src/content/photos/a.json": '{"draft":true,"order":1}' });
  const before = await store.snapshot("photos");
  await withContentLock(root, "photos", async () => {
    await assert.rejects(store.apply("photos", { action: "draft", keys: ["a"], version: before.version }), { status: 409 });
    const order = createOrderStore(root);
    const snapshot = await order.snapshot("photos");
    await assert.rejects(order.reorder("photos", { version: snapshot.version, keys: ["a"], target: { key: "a", dropPosition: "before" } }), { status: 409 });
  });
});

test("photo deletion rejects escaped asset paths before touching any file", async t => {
  const raw = '{"draft":false,"src":"/media/photos/../../secret.jpg"}';
  const { store, read } = await fixture(t, { "src/content/photos/a.json": raw, "public/secret.jpg": "keep" });
  const before = await store.snapshot("photos");
  await assert.rejects(store.apply("photos", { action: "delete", keys: ["a"], version: before.version }), /超出摄影目录/);
  assert.equal(await read("src/content/photos/a.json"), raw);
  assert.equal(await read("public/secret.jpg"), "keep");
});
