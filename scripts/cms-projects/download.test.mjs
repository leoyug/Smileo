import test from "node:test";
import assert from "node:assert/strict";
import { projectDownloadSchema } from "../../src/lib/project-download.ts";

test("projects without an attachment remain valid after a CMS save", () => {
  for (const value of [undefined, {}, { href: "", filename: "", label: "" }, { href: "  ", filename: "", label: "" }]) {
    assert.equal(projectDownloadSchema.parse(value), undefined);
  }
});

test("a project download retains its URL, filename and accessible label", () => {
  const download = {
    href: "/downloads/wispora-0.7.3-chrome.zip",
    filename: "wispora-0.7.3-chrome.zip",
    label: "下载 Wispora Chrome 安装包",
  };
  assert.deepEqual(projectDownloadSchema.parse(download), download);
});

test("incomplete downloads and non-local paths fail content validation", () => {
  for (const value of [
    { href: "/downloads/app.zip" },
    { href: "/downloads/app.zip", filename: "app.zip", label: "" },
    { href: "https://example.com/app.zip", filename: "app.zip", label: "下载" },
  ]) {
    assert.equal(projectDownloadSchema.safeParse(value).success, false);
  }
});
