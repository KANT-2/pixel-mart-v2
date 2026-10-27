import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/points.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { POINT_KIND_LABEL, clampPoints, formatPointAmount, maxUsablePoints } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("쓸 수 있는 적립금은 보유 적립금과 주문 금액 중 작은 쪽", () => {
  assert.equal(maxUsablePoints(1000, 25800), 1000);
  assert.equal(maxUsablePoints(1000, 700), 700); // 주문 금액보다 많이는 못 씀
  assert.equal(maxUsablePoints(0, 5000), 0);
  assert.equal(maxUsablePoints(-5, 5000), 0);
});

test("입력한 적립금은 0 ~ 최대 사이 정수로 맞춘다", () => {
  assert.equal(clampPoints("500", 1000), 500);
  assert.equal(clampPoints("1,200", 1000), 1000);
  assert.equal(clampPoints("abc", 1000), 0);
  assert.equal(clampPoints("", 1000), 0);
  assert.equal(clampPoints("-300", 1000), 300); // 부호는 숫자가 아니라 지운다
});

test("적립금 기록 표기", () => {
  assert.equal(formatPointAmount(1000), "+1,000P");
  assert.equal(formatPointAmount(-500), "-500P");
  assert.equal(POINT_KIND_LABEL.first_purchase, "첫 구매 보너스");
  assert.equal(POINT_KIND_LABEL.order_refund, "주문 취소로 돌려받음");
});
