import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/recentlyViewed.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const r = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const item = (id) => ({ id, name: `상품 ${id}`, price: id * 1000, imageUrl: `/img/${id}.webp` });

test("최근 본 상품은 맨 앞으로, 중복 없이, 최대 개수 유지", () => {
  let list = [];
  for (const id of [1, 2, 3]) list = r.addRecent(list, item(id));
  assert.deepEqual(list.map((x) => x.id), [3, 2, 1]);
  list = r.addRecent(list, item(1));
  assert.deepEqual(list.map((x) => x.id), [1, 3, 2]);
  assert.equal(Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc, id) => r.addRecent(acc, item(id)), []).length, r.RECENT_MAX);
});

test("깨진 저장값은 버리고 하나씩 지울 수 있다", () => {
  assert.deepEqual(r.parseRecent("not json"), []);
  assert.deepEqual(r.parseRecent('{"a":1}'), []);
  assert.deepEqual(r.parseRecent(JSON.stringify([item(1), { id: "x" }, null])).map((x) => x.id), [1]);
  assert.deepEqual(r.removeRecent([item(1), item(2)], 1).map((x) => x.id), [2]);
});

test("viewedAt 없는 옛 데이터도 버리지 않고 읽되, viewedAt은 undefined로 남는다(1970년 방지)", () => {
  const legacy = { id: 9, name: "옛 상품", price: 9000, imageUrl: "/img/9.webp" };
  const parsed = r.parseRecent(JSON.stringify([legacy]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].viewedAt, undefined);
});

test("groupByDay: 오늘/어제/그 이전 날짜로 묶고, viewedAt 없으면 '이전 기록'으로 맨 아래에 둔다", () => {
  const now = new Date("2026-10-27T10:00:00+09:00"); // KST 기준 2026-10-27
  const todayItem = { ...item(1), viewedAt: new Date("2026-10-27T08:00:00+09:00").getTime() };
  const yesterdayItem = { ...item(2), viewedAt: new Date("2026-10-26T09:00:00+09:00").getTime() };
  const olderItem = { ...item(3), viewedAt: new Date("2026-10-20T00:00:00+09:00").getTime() };
  const legacyItem = item(4); // viewedAt 없음
  const groups = r.groupByDay([todayItem, yesterdayItem, olderItem, legacyItem], now);
  assert.deepEqual(groups.map((g) => g.label), ["오늘", "어제", "26.10.20", "이전 기록"]);
  assert.deepEqual(groups[0].items.map((x) => x.id), [1]);
  assert.deepEqual(groups[3].items.map((x) => x.id), [4]);
});

test("groupByDay: KST 자정 경계 — 23:59와 00:01은 서로 다른 날로 묶인다", () => {
  const now = new Date("2026-10-27T00:30:00+09:00"); // KST 2026-10-27 00:30 → "오늘"
  const lateLastNight = { ...item(5), viewedAt: new Date("2026-10-26T23:59:00+09:00").getTime() }; // KST 전날 23:59 → "어제"
  const justAfterMidnight = { ...item(6), viewedAt: new Date("2026-10-27T00:01:00+09:00").getTime() }; // KST 당일 00:01 → "오늘"
  const groups = r.groupByDay([justAfterMidnight, lateLastNight], now);
  assert.deepEqual(groups.map((g) => g.label), ["오늘", "어제"]);
  assert.deepEqual(groups[0].items.map((x) => x.id), [6]);
  assert.deepEqual(groups[1].items.map((x) => x.id), [5]);
});
