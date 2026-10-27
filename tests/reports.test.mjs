import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}
const apiModule = await moduleUrl("../lib/api.ts");
const { reportsApi, canReport, withdrawConfirmed, validateReportMemo, REPORT_REASONS } = await import(await moduleUrl("../lib/reports.ts", { "@/lib/api": apiModule }));

test("신고 버튼 — 로그인 + 남의 글 + 보이는 글 + 샘플 아님", () => {
  assert.equal(canReport({ isMine: false }, true), true);
  assert.equal(canReport({ isMine: false }, false), false);
  assert.equal(canReport({ isMine: true }, true), false);
  assert.equal(canReport({ isMine: false, hidden: true }, true), false);
  assert.equal(canReport({ isMine: false, isSample: true }, true), false);
});

test("사유는 서버 값 5가지 (spam · abuse · privacy · inappropriate · etc)", () => {
  assert.deepEqual(REPORT_REASONS.map((reason) => reason.value), ["spam", "abuse", "privacy", "inappropriate", "etc"]);
});

test("탈퇴 확인은 정확히 '탈퇴' (앞뒤 공백만 무시)", () => {
  assert.equal(withdrawConfirmed("탈퇴"), true);
  assert.equal(withdrawConfirmed("  탈퇴 "), true);
  for (const text of ["", "탈 퇴", "탈퇴할게요", "withdraw"]) assert.equal(withdrawConfirmed(text), false);
});

test("메모는 200자까지", () => {
  assert.equal(validateReportMemo("가".repeat(200)), null);
  assert.match(validateReportMemo("가".repeat(201)), /200자/);
});

test("신고·탈퇴 API — 주소 · 본문, 메모 앞뒤 공백 제거, 400 메시지 보존", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ id: 1, status: "open" }), { status: 201 }); };
  await reportsApi.create({ targetType: "question", targetId: 7, reason: "spam", memo: "  광고예요 " });
  await reportsApi.withdraw();
  assert.equal(calls[0].url, "/api/reports");
  assert.deepEqual(JSON.parse(calls[0].body), { targetType: "question", targetId: 7, reason: "spam", memo: "광고예요" });
  assert.equal(calls[1].url, "/api/users/me/withdraw");
  assert.deepEqual(JSON.parse(calls[1].body), { confirm: "탈퇴" });
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "진행 중인 주문이 있어 탈퇴할 수 없어요. 배송 완료 후 다시 시도해 주세요." }), { status: 400 });
  await assert.rejects(reportsApi.withdraw(), { status: 400, message: /진행 중인 주문/ });
});
