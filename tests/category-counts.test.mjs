import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/categoryCounts.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { categoryCounts } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const categories = [{ slug: "keycap", name: "키캡" }, { slug: "deskmat", name: "데스크매트" }];

test("카테고리 숫자 — 전체 + 카테고리마다 서버 total, 서버 순서 그대로", async () => {
  const totals = { all: 41, keycap: 30, deskmat: 11 };
  const asked = [];
  const rows = await categoryCounts(categories, async (slug) => { asked.push(slug); return totals[slug ?? "all"]; });
  assert.deepEqual(rows, [
    { name: "전체", count: 41 },
    { slug: "keycap", name: "키캡", count: 30 },
    { slug: "deskmat", name: "데스크매트", count: 11 },
  ]);
  assert.deepEqual(asked, [undefined, "keycap", "deskmat"]);
});

test("카테고리 숫자 — 동시에 요청하고, 늦게 온 응답도 제 자리에", async () => {
  let pending = 0, peak = 0;
  const delays = { keycap: 30, deskmat: 0 };
  const rows = await categoryCounts(categories, async (slug) => {
    pending += 1; peak = Math.max(peak, pending);
    await new Promise((resolve) => setTimeout(resolve, delays[slug] ?? 10));
    pending -= 1;
    return slug ? slug.length : 0;
  });
  assert.equal(peak, 3);
  assert.deepEqual(rows.map((row) => row.count), [0, 6, 7]);
});

test("카테고리가 없으면 전체 한 줄", async () => {
  assert.deepEqual(await categoryCounts([], async () => 5), [{ name: "전체", count: 5 }]);
});
