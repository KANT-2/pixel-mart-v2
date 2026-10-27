import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/heroQuest.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { HERO_QUESTS, currentHeroQuest } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

const book = (earned, progress = {}) => HERO_QUESTS.map(({ code }) => ({ code, earned: earned.includes(code), progress: progress[code] ?? null }));

test("새 플레이어는 첫 구매 퀘스트부터", () => {
  const now = currentHeroQuest(book([]));
  assert.equal(now.step.code, "first_order");
  assert.equal(now.number, 1);
  assert.equal(now.total, HERO_QUESTS.length);
});

test("첫 구매를 하면 클리어 문구에 머물지 않고 다음 퀘스트로", () => {
  assert.equal(currentHeroQuest(book(["first_order"])).step.code, "local");
  assert.equal(currentHeroQuest(book(["first_order", "local", "first_want"])).step.code, "first_trade");
});

test("순서를 건너뛰어 깬 퀘스트는 넘기고, 남은 것 중 가장 앞의 것", () => {
  const now = currentHeroQuest(book(["local", "first_trade"]));
  assert.equal(now.step.code, "first_order");
  assert.equal(currentHeroQuest(book(["first_order", "local", "first_trade"])).step.code, "first_want");
});

test("여러 번 하는 퀘스트는 진행도, 한 번이면 진행도 없음", () => {
  const now = currentHeroQuest(book(["first_order", "local", "first_want", "first_trade"], { reviewer: { current: 1, goal: 3 } }));
  assert.equal(now.step.code, "reviewer");
  assert.deepEqual(now.progress, { current: 1, goal: 3 });
  assert.equal(currentHeroQuest(book([], { first_order: { current: 0, goal: 1 } })).progress, null);
});

test("모두 깨면 카드를 숨긴다 (null)", () => {
  assert.equal(currentHeroQuest(book(HERO_QUESTS.map((q) => q.code))), null);
});
