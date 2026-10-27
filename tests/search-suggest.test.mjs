import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const apiModule = await moduleUrl("../lib/api.ts");
const { suggestQuery, suggestProducts, highlightParts, nextActive, SUGGEST_LIMIT } = await import(await moduleUrl("../lib/searchSuggest.ts", { "@/lib/api": apiModule }));

test("후보 검색어 — 앞뒤 공백 제거, 비면 null, 50자까지", () => {
  assert.equal(suggestQuery("  코인 "), "코인");
  assert.equal(suggestQuery("   "), null);
  assert.equal(suggestQuery(""), null);
  assert.equal(Array.from(suggestQuery("가".repeat(80))).length, 50);
});

test("후보 API — /api/products?q=&size=6, 캐시 없이, 6개까지만", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  const items = Array.from({ length: 9 }, (_, index) => ({ id: index + 1, name: `코인 ${index}` }));
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ items, total: 9, page: 1, size: 6, totalPages: 2 })); };
  const result = await suggestProducts("코인 & 키캡");
  assert.equal(calls[0].url, "/api/products?q=%EC%BD%94%EC%9D%B8+%26+%ED%82%A4%EC%BA%A1&size=6");
  assert.equal(calls[0].cache, "no-store");
  assert.equal(result.length, SUGGEST_LIMIT);
});

test("검색어와 같은 부분만 굵게 — 대소문자 무시, 없으면 통째로", () => {
  assert.deepEqual(highlightParts("골드 코인 스페이스바", "코인"), [
    { text: "골드 ", match: false }, { text: "코인", match: true }, { text: " 스페이스바", match: false },
  ]);
  assert.deepEqual(highlightParts("ESC Key", "esc"), [{ text: "ESC", match: true }, { text: " Key", match: false }]);
  assert.deepEqual(highlightParts("하트 키캡", "슬라임"), [{ text: "하트 키캡", match: false }]);
});

test("↑↓ 이동 — 끝에서 처음으로, 후보가 없으면 -1", () => {
  assert.equal(nextActive(-1, 3, "ArrowDown"), 0);
  assert.equal(nextActive(2, 3, "ArrowDown"), 0);
  assert.equal(nextActive(0, 3, "ArrowUp"), 2);
  assert.equal(nextActive(-1, 3, "ArrowUp"), 2);
  assert.equal(nextActive(0, 0, "ArrowDown"), -1);
});
