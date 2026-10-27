import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { validateNoticeForm, isRecentNotice, formatNoticeDate, sortNotices, adjacentNotices } =
  await import(await moduleUrl("../utils/notices.ts"));

test("폼 검증: 제목·내용이 비어 있으면 에러", () => {
  assert.equal(validateNoticeForm({ title: "", content: "내용" }).valid, false);
  assert.equal(validateNoticeForm({ title: "제목", content: "" }).valid, false);
  assert.equal(validateNoticeForm({ title: "제목", content: "내용" }).valid, true);
});

test("폼 검증: 제목 100자 넘으면 에러", () => {
  const longTitle = "가".repeat(101);
  const result = validateNoticeForm({ title: longTitle, content: "내용" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.title);
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

const NOTICES = [
  { id: 1, title: "A", content: "", isPinned: false, isPublished: true, createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" },
  { id: 2, title: "B", content: "", isPinned: true, isPublished: true, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z" },
  { id: 3, title: "C", content: "", isPinned: false, isPublished: true, createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z" },
];

test("정렬: 고정 공지가 맨 위, 나머지는 최신순으로 정렬된다", () => {
  const sorted = sortNotices(NOTICES);
  assert.deepEqual(sorted.map((n) => n.id), [2, 3, 1]); // 고정(2) → 10/25(3) → 10/20(1)
});

test("이전/다음 글: sortNotices 결과 기준으로 앞뒤를 찾는다", () => {
  const sorted = sortNotices(NOTICES); // [2, 3, 1]
  assert.deepEqual(adjacentNotices(sorted, 3), { older: sorted[2], newer: sorted[0] });
  assert.deepEqual(adjacentNotices(sorted, 2), { older: sorted[1], newer: null });
  assert.deepEqual(adjacentNotices(sorted, 1), { older: null, newer: sorted[1] });
  assert.deepEqual(adjacentNotices(sorted, 999), { older: null, newer: null });
});
