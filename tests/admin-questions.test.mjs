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
const {
  parseAdminQuestionQuery, adminQuestionsHref, adminQuestionsApiPath, adminQuestionsApi,
  validateAnswer, remainingAnswerChars, emptyMessage,
} = await import(await moduleUrl("../app/admin/questions/adminQuestions.ts", { "@/lib/api": apiModule }));

test("주소창 쿼리 해석 — 기본은 답변 대기 · 1쪽, 이상한 값은 기본값", () => {
  assert.deepEqual(parseAdminQuestionQuery({}), { status: "waiting", q: "", page: 1 });
  assert.deepEqual(parseAdminQuestionQuery({ status: "answered", q: "  키캡 ", page: "3" }), { status: "answered", q: "키캡", page: 3 });
  assert.equal(parseAdminQuestionQuery({ status: "all" }).status, "all");
  for (const status of ["ANSWERED", "done", ""]) assert.equal(parseAdminQuestionQuery({ status }).status, "waiting");
  for (const page of ["0", "-1", "1.5", "abc"]) assert.equal(parseAdminQuestionQuery({ page }).page, 1);
  assert.equal(parseAdminQuestionQuery({ q: ["첫째", "둘째"] }).q, "첫째");
  assert.equal(Array.from(parseAdminQuestionQuery({ q: "가".repeat(150) }).q).length, 100);
});

test("화면 주소는 기본값을 빼고 짧게", () => {
  assert.equal(adminQuestionsHref({}), "/admin/questions");
  assert.equal(adminQuestionsHref({ status: "answered" }), "/admin/questions?status=answered");
  assert.equal(adminQuestionsHref({ status: "waiting", q: " 배송 ", page: 2 }), "/admin/questions?q=%EB%B0%B0%EC%86%A1&page=2");
  assert.equal(adminQuestionsHref({ q: "   ", page: 1 }), "/admin/questions");
});

test("필터 → 서버 answered 값 (대기 false · 완료 true · 전체 없음), 검색어는 인코딩", () => {
  assert.equal(adminQuestionsApiPath({ status: "waiting", q: "", page: 1 }), "/admin/questions?answered=false&page=1&size=20");
  assert.equal(adminQuestionsApiPath({ status: "answered", q: "", page: 2 }), "/admin/questions?answered=true&page=2&size=20");
  assert.equal(adminQuestionsApiPath({ status: "all", q: "100%", page: 1 }), "/admin/questions?q=100%25&page=1&size=20");
});

test("관리자 문의 API — 목록 GET · 답변 POST, 캐시 비활성, 409 메시지 보존", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ id: 5 })); };
  await adminQuestionsApi.list({ status: "waiting", q: "", page: 1 });
  await adminQuestionsApi.answer(5, "내일 도착해요");
  assert.equal(calls[0].url, "/api/admin/questions?answered=false&page=1&size=20");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].url, "/api/admin/questions/5/answer");
  assert.equal(calls[1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body), { answer: "내일 도착해요" });
  for (const call of calls) { assert.equal(call.cache, "no-store"); assert.equal(call.credentials, "same-origin"); }
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "이미 답변한 문의예요." }), { status: 409 });
  await assert.rejects(adminQuestionsApi.answer(5, "두 번째"), { status: 409, message: "이미 답변한 문의예요." });
});

test("답변 검사 — trim 후 1~500자, 남은 글자 수는 글자 단위", () => {
  assert.equal(validateAnswer("   ").error, "답변을 입력해 주세요.");
  assert.equal(validateAnswer("가".repeat(501)).error, "답변은 500자 이내로 입력해 주세요.");
  assert.deepEqual(validateAnswer("  상세 탭을 보세요 \n"), { value: "상세 탭을 보세요", error: null });
  assert.equal(validateAnswer("가".repeat(500)).error, null);
  assert.equal(remainingAnswerChars(""), 500);
  assert.equal(remainingAnswerChars("가나다"), 497);
  assert.equal(remainingAnswerChars("😀"), 499);
});

test("빈 목록 문구는 검색·필터에 맞게", () => {
  assert.equal(emptyMessage({ status: "waiting", q: "" }).title, "답변을 기다리는 문의가 없어요");
  assert.equal(emptyMessage({ status: "answered", q: "" }).title, "답변한 문의가 없어요");
  assert.equal(emptyMessage({ status: "all", q: "" }).title, "아직 문의가 없어요");
  assert.equal(emptyMessage({ status: "waiting", q: "키캡" }).title, "검색 결과가 없어요");
});
