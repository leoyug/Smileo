import test from "node:test";
import assert from "node:assert/strict";
import { cssTimeToMilliseconds } from "../../src/lib/css-time.ts";

test("production CSS time minification preserves animation durations and delays", () => {
  for (const [source, minified, expected] of [
    ["600ms", ".6s", 600],
    ["200ms", ".2s", 200],
    ["420ms", ".42s", 420],
    ["250ms", ".25s", 250],
    ["560ms", ".56s", 560],
    ["1500ms", "1.5s", 1500],
  ]) {
    assert.equal(cssTimeToMilliseconds(source), expected);
    assert.equal(cssTimeToMilliseconds(minified), expected);
  }
});

test("zero duration stays zero, while missing or invalid tokens use the fallback", () => {
  assert.equal(cssTimeToMilliseconds("0s", 560), 0);
  assert.equal(cssTimeToMilliseconds(" 0ms ", 560), 0);
  assert.equal(cssTimeToMilliseconds("", 560), 560);
  assert.equal(cssTimeToMilliseconds("initial", 560), 560);
  assert.equal(cssTimeToMilliseconds("250px", 560), 560);
});
