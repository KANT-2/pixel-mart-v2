import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/stock.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { stockStatus, stockLabel, maxAddable, LOW_STOCK } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("재고 0 · 3 · 30 — 품절 / 3개 남음 / 표시 없음 (이슈 끝 기준)", () => {
  assert.equal(stockLabel(stockStatus(0)), "품절");
  assert.equal(stockLabel(stockStatus(3)), "3개 남음");
  assert.equal(stockLabel(stockStatus(30)), null);
});

test("경계값 — 1과 5는 'n개 남음', 6부터 표시 없음, 음수는 품절", () => {
  assert.equal(LOW_STOCK, 5);
  assert.deepEqual(stockStatus(1), { kind: "low", left: 1 });
  assert.deepEqual(stockStatus(5), { kind: "low", left: 5 });
  assert.deepEqual(stockStatus(6), { kind: "enough" });
  assert.deepEqual(stockStatus(-2), { kind: "soldout" });
});

test("재고를 모르면(정적 데이터) 아무것도 표시하지 않음", () => {
  for (const value of [undefined, null, Number.NaN, Infinity]) {
    assert.deepEqual(stockStatus(value), { kind: "unknown" });
    assert.equal(stockLabel(stockStatus(value)), null);
  }
});

test("더 담을 수 있는 수량 — 재고와 장바구니 한도 99 중 작은 쪽에서 이미 담은 만큼 뺌", () => {
  assert.equal(maxAddable(3, 0), 3);
  assert.equal(maxAddable(3, 2), 1);
  assert.equal(maxAddable(3, 3), 0);
  assert.equal(maxAddable(0, 0), 0);
  assert.equal(maxAddable(500, 10), 89);
  assert.equal(maxAddable(undefined, 10), 89);
  assert.equal(maxAddable(2, 5), 0); // 담은 뒤 재고가 줄어도 음수가 되지 않음
});
