import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { validateNoticeForm, isRecentNotice, formatNoticeDate, adjacentNotices, cycleIndex } =
  await import(await moduleUrl("../utils/notices.ts"));

test("폼 검증: 제목·내용이 비어 있으면 에러", () => {
  assert.equal(validateNoticeForm({ title: "", content: "내용" }).valid, false);
  assert.equal(validateNoticeForm({ title: "제목", content: "" }).valid, false);
  assert.equal(validateNoticeForm({ title: "제목", content: "내용" }).valid, true);
});

test("폼 검증: 제목 100자·내용 5,000자 넘으면 에러", () => {
  const longTitle = "가".repeat(101);
  assert.equal(validateNoticeForm({ title: longTitle, content: "내용" }).valid, false);
  const longContent = "가".repeat(5_001);
  assert.equal(validateNoticeForm({ title: "제목", content: longContent }).valid, false);
  assert.equal(validateNoticeForm({ title: "제목", content: "가".repeat(5_000) }).valid, true);
});

test("NEW 판별: 7일 이내면 true, 그 이후는 false, now를 인자로 받아 테스트 가능", () => {
  const now = new Date("2026-10-27T00:00:00Z");
  assert.equal(isRecentNotice("2026-10-26T00:00:00Z", now), true);
  assert.equal(isRecentNotice("2026-10-20T00:00:01Z", now), true); // 7일 경계 바로 안쪽
  assert.equal(isRecentNotice("2026-10-20T00:00:00Z", now), false); // 정확히 7일 지나면 NEW 아님
  assert.equal(isRecentNotice("2026-10-28T00:00:00Z", now), false); // 미래 시각은 NEW 아님
});

test("날짜 포맷: 시·분 없이 YYYY.MM.DD", () => {
  assert.equal(formatNoticeDate("2026-10-26T09:00:00Z"), "2026.10.26");
  assert.equal(formatNoticeDate("invalid"), "-");
});

// 서버가 이미 "고정 먼저 → 최신순"으로 정렬해서 주므로, 여기서는 그 결과를 그대로 흉내만 낸다
const SORTED = [
  { id: 2, title: "B", isPinned: true, createdAt: "2026-10-18T00:00:00Z" },
  { id: 3, title: "C", isPinned: false, createdAt: "2026-10-25T00:00:00Z" },
  { id: 1, title: "A", isPinned: false, createdAt: "2026-10-20T00:00:00Z" },
];

test("이전/다음 글: 서버가 정렬해 준 목록 기준으로 앞뒤를 찾는다", () => {
  assert.deepEqual(adjacentNotices(SORTED, 3), { older: SORTED[2], newer: SORTED[0] });
  assert.deepEqual(adjacentNotices(SORTED, 2), { older: SORTED[1], newer: null });
  assert.deepEqual(adjacentNotices(SORTED, 1), { older: null, newer: SORTED[1] });
  assert.deepEqual(adjacentNotices(SORTED, 999), { older: null, newer: null });
});

test("배너 인덱스 순환: 양 끝에서 반대쪽으로 넘어간다", () => {
  assert.equal(cycleIndex(0, 3, 1), 1);
  assert.equal(cycleIndex(2, 3, 1), 0); // 마지막에서 다음 → 처음
  assert.equal(cycleIndex(0, 3, -1), 2); // 처음에서 이전 → 마지막
  assert.equal(cycleIndex(0, 0, 1), 0); // 대상이 없으면 항상 0
});
