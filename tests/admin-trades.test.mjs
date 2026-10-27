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
  parseAdminTradeQuery, adminTradesHref, adminTradesApiPath, tradeState, tradeAction, contentPreview, confirmText, doneText, emptyMessage, kindLabel,
} = await import(await moduleUrl("../app/admin/trades/adminTrades.ts", { "@/lib/api": apiModule }));

test("주소창 쿼리 — 기본은 전체 · 종류 없음 · 1쪽, 이상한 값은 기본값", () => {
  assert.deepEqual(parseAdminTradeQuery({}), { status: "all", kind: null, q: "", page: 1 });
  assert.deepEqual(parseAdminTradeQuery({ status: "hidden", kind: "sell", q: "  키캡 ", page: "2" }), { status: "hidden", kind: "sell", q: "키캡", page: 2 });
  for (const status of ["HIDDEN", "closed", ""]) assert.equal(parseAdminTradeQuery({ status }).status, "all");
  for (const kind of ["wish", "Have", ""]) assert.equal(parseAdminTradeQuery({ kind }).kind, null);
  for (const page of ["0", "-1", "1.5", "abc"]) assert.equal(parseAdminTradeQuery({ page }).page, 1);
  assert.equal(Array.from(parseAdminTradeQuery({ q: "가".repeat(150) }).q).length, 100);
});

test("화면 주소는 기본값을 빼고, 서버 주소는 전체일 때 status를 안 보낸다", () => {
  assert.equal(adminTradesHref({}), "/admin/trades");
  assert.equal(adminTradesHref({ status: "open", kind: "want", q: "하트", page: 3 }), "/admin/trades?status=open&kind=want&q=%ED%95%98%ED%8A%B8&page=3");
  assert.equal(adminTradesApiPath({ status: "all", kind: null, q: "", page: 1 }), "/admin/trades?page=1&size=20");
  assert.equal(adminTradesApiPath({ status: "hidden", kind: "have", q: "a", page: 2 }), "/admin/trades?status=hidden&kind=have&q=a&page=2&size=20");
});

test("상태 표시 · 동작 — 관리자가 숨긴 글만 다시 보이기, 글쓴이가 숨긴 글은 동작 없음", () => {
  assert.deepEqual(tradeState({ status: "open", hiddenByAdmin: false }), { label: "진행 중", tone: "mint" });
  assert.equal(tradeState({ status: "done", hiddenByAdmin: false }).label, "완료");
  assert.equal(tradeState({ status: "hidden", hiddenByAdmin: true }).label, "숨김(관리자)");
  assert.equal(tradeState({ status: "hidden", hiddenByAdmin: false }).label, "숨김(글쓴이)");
  assert.equal(tradeAction({ status: "open", hiddenByAdmin: false }), "hidden");
  assert.equal(tradeAction({ status: "done", hiddenByAdmin: false }), "hidden");
  assert.equal(tradeAction({ status: "hidden", hiddenByAdmin: true }), "open");
  assert.equal(tradeAction({ status: "hidden", hiddenByAdmin: false }), null);
});

test("본문 앞부분 — 줄바꿈은 띄어쓰기, 40자 넘으면 …", () => {
  assert.equal(contentPreview("상태 좋아요\n\n직거래 원해요"), "상태 좋아요 직거래 원해요");
  const long = contentPreview("가".repeat(50));
  assert.equal(Array.from(long).length, 41);
  assert.ok(long.endsWith("…"));
});

test("문구 — 확인 창 · 처리 뒤 · 빈 목록 · 종류 이름", () => {
  assert.equal(confirmText({ itemName: "하트 키캡" }, "hidden").confirm, "숨기기");
  assert.ok(confirmText({ itemName: "하트 키캡" }, "hidden").description.includes("알림"));
  assert.equal(confirmText({ itemName: "하트 키캡" }, "open").confirm, "다시 보이기");
  assert.equal(doneText({ itemName: "하트 키캡" }, "hidden"), "\"하트 키캡\" 글을 숨겼어요.");
  assert.equal(emptyMessage({ status: "all", kind: null, q: "" }), "아직 거래글이 없어요.");
  assert.ok(emptyMessage({ status: "all", kind: null, q: "x" }).startsWith("검색 결과가 없어요"));
  assert.equal(kindLabel("want"), "WISH");
});
