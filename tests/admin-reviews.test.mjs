import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const apiModule = await moduleUrl("../lib/api.ts");
const { parseAdminReviewQuery, adminReviewsHref, adminReviewsApiPath, adminReviewsApi, contentPreview, confirmText, doneText, emptyMessage } = await import(
  await moduleUrl("../app/admin/reviews/adminReviews.ts", { "@/lib/api": apiModule })
);

test("주소창 쿼리 — 기본은 전체 · 별점 없음 · 사진 아님 · 1쪽, 이상한 값은 기본값", () => {
  assert.deepEqual(parseAdminReviewQuery({}), { status: "all", rating: null, photo: false, q: "", page: 1 });
  assert.deepEqual(parseAdminReviewQuery({ status: "hidden", rating: "2", photo: "1", q: "  키캡 ", page: "3" }), { status: "hidden", rating: 2, photo: true, q: "키캡", page: 3 });
  for (const status of ["HIDDEN", "open", ""]) assert.equal(parseAdminReviewQuery({ status }).status, "all");
  for (const rating of ["0", "6", "4.5", "abc"]) assert.equal(parseAdminReviewQuery({ rating }).rating, null);
  for (const photo of ["true", "0", ""]) assert.equal(parseAdminReviewQuery({ photo }).photo, false);
  assert.equal(Array.from(parseAdminReviewQuery({ q: "가".repeat(150) }).q).length, 100);
});

test("화면 주소는 기본값을 빼고, 서버 주소는 상태를 hidden=true/false로 보낸다", () => {
  assert.equal(adminReviewsHref({}), "/admin/reviews");
  assert.equal(adminReviewsHref({ status: "shown", rating: 1, photo: true, q: "a", page: 2 }), "/admin/reviews?status=shown&rating=1&photo=1&q=a&page=2");
  assert.equal(adminReviewsApiPath({ status: "all", rating: null, photo: false, q: "", page: 1 }), "/admin/reviews?page=1&size=20");
  assert.equal(adminReviewsApiPath({ status: "hidden", rating: 5, photo: true, q: "a", page: 2 }), "/admin/reviews?hidden=true&rating=5&photo=true&q=a&page=2&size=20");
  assert.equal(adminReviewsApiPath({ status: "shown", rating: null, photo: false, q: "", page: 1 }), "/admin/reviews?hidden=false&page=1&size=20");
});

test("문구 — 미리보기 자르기 · 확인 창 · 완료 · 빈 목록", () => {
  assert.equal(contentPreview("좋아요\n\n  최고"), "좋아요 최고");
  assert.equal(Array.from(contentPreview("가".repeat(80))).length, 61);
  const review = { nickname: "픽셀", productName: "하트 키캡" };
  assert.equal(confirmText(review, true).confirm, "숨기기");
  assert.match(confirmText(review, true).description, /알림/);
  assert.equal(confirmText(review, false).confirm, "다시 보이기");
  assert.equal(doneText(review, true), "픽셀 님의 리뷰를 숨겼어요.");
  assert.equal(emptyMessage({ status: "all", rating: null, photo: false, q: "" }), "아직 리뷰가 없어요.");
  assert.equal(emptyMessage({ status: "all", rating: 3, photo: false, q: "" }), "조건에 맞는 리뷰가 없어요.");
  assert.match(emptyMessage({ status: "all", rating: null, photo: false, q: "x" }), /검색 결과가 없어요/);
});

test("답글 등록·삭제는 관리자 PATCH에 값과 null을 구분해 보낸다", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init });
    return new Response(JSON.stringify({ id: 8 }), { headers: { "Content-Type": "application/json" } });
  };
  await adminReviewsApi.setReply(8, "감사합니다");
  await adminReviewsApi.setReply(8, null);
  assert.ok(calls.every((call) => call.url === "/api/admin/reviews/8/reply" && call.method === "PATCH"));
  assert.deepEqual(calls.map((call) => JSON.parse(call.body)), [{ reply: "감사합니다" }, { reply: null }]);
  assert.ok(calls.every((call) => call.credentials === "same-origin" && call.cache === "no-store"));
});
