import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/badgeBook.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { progressCells, itemProgress, badgeTags, canFeature } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("7 / 19 — 19칸 중 앞 7칸만 채움 (이슈 끝 기준)", () => {
  const cells = progressCells({ earnedCount: 7, total: 19 });
  assert.equal(cells.length, 19);
  assert.equal(cells.filter(Boolean).length, 7);
  assert.deepEqual(cells.slice(5, 9), [true, true, false, false]);
});

test("칸 막대 경계값 — 0개 · 다 받음 · 이상한 값", () => {
  assert.equal(progressCells({ earnedCount: 0, total: 19 }).filter(Boolean).length, 0);
  assert.equal(progressCells({ earnedCount: 19, total: 19 }).every(Boolean), true);
  assert.equal(progressCells({ earnedCount: 25, total: 19 }).filter(Boolean).length, 19);
  assert.deepEqual(progressCells({ earnedCount: -1, total: 0 }), []);
});

test("개별 진행도 — 못 받은 뱃지만, 넘치면 목표에서 멈춤", () => {
  assert.deepEqual(itemProgress({ earned: false, progress: { current: 2, goal: 5 } }), { current: 2, goal: 5, percent: 40 });
  assert.deepEqual(itemProgress({ earned: false, progress: { current: 9, goal: 5 } }), { current: 5, goal: 5, percent: 100 });
  assert.equal(itemProgress({ earned: true, progress: { current: 5, goal: 5 } }), null);
  assert.equal(itemProgress({ earned: false, progress: null }), null);
  assert.equal(itemProgress({ earned: false, progress: { current: 0, goal: 0 } }), null);
});

test("카드 표시 — NEW는 받은 것만, 이번 주는 동네 큰손", () => {
  assert.deepEqual(badgeTags({ earned: true, isNew: true }), ["NEW"]);
  assert.deepEqual(badgeTags({ earned: false, isNew: true }), []);
  assert.deepEqual(badgeTags({ earned: true, isNew: true, isWeekly: true }), ["NEW", "이번 주"]);
  assert.deepEqual(badgeTags({ earned: false, isWeekly: true }), ["이번 주"]);
});

test("'대표로' 버튼 — 받은 뱃지 + 지금 대표가 아닐 때", () => {
  assert.equal(canFeature({ code: "reviewer", earned: true }, "santa"), true);
  assert.equal(canFeature({ code: "reviewer", earned: true }, "reviewer"), false);
  assert.equal(canFeature({ code: "reviewer", earned: false }, null), false);
});
