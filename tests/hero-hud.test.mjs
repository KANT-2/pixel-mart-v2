import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../components/hero/hudNumbers.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { GUEST_HUD, heartText, coinText, hudLabel, hudNumbersFor } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("HUD 숫자 — 로그인 확인 중은 빈칸, 비로그인은 시안 숫자, 로그인은 내 값(받는 중·실패는 빈칸)", () => {
  const mine = { hearts: 5, coins: 12 };
  assert.equal(hudNumbersFor(true, false, null), null);
  assert.equal(hudNumbersFor(true, true, mine), null);
  assert.deepEqual(hudNumbersFor(false, false, null), GUEST_HUD);
  assert.deepEqual(hudNumbersFor(false, false, mine), GUEST_HUD);
  assert.deepEqual(hudNumbersFor(false, true, mine), mine);
  assert.equal(hudNumbersFor(false, true, null), null);
});

test("HUD 표기 — 하트 ×N, 코인(적립금) 세 자리 맞춤 · 천 단위 쉼표, 낭독 문장", () => {
  assert.equal(heartText(0), "×0");
  assert.equal(heartText(99), "×99");
  assert.equal(coinText(0), "× 000");
  assert.equal(coinText(12), "× 012");
  assert.equal(coinText(1000), "× 1,000");
  assert.equal(coinText(12345), "× 12,345");
  assert.equal(hudLabel({ hearts: 5, coins: 1200 }), "내 하트 5개, 적립금 1,200P");
});
