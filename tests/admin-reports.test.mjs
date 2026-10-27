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
const reportsModule = await moduleUrl("../lib/reports.ts", { "@/lib/api": apiModule });
const {
  parseAdminReportQuery, adminReportsHref, adminReportsApiPath, confirmText, doneText, emptyMessage, reasonLabel, typeOptions,
} = await import(await moduleUrl("../app/admin/reports/adminReports.ts", { "@/lib/api": apiModule, "@/lib/reports": reportsModule }));

test("주소창 쿼리 — 기본은 처리 대기 · 전체 종류 · 1쪽, 이상한 값은 기본값", () => {
  assert.deepEqual(parseAdminReportQuery({}), { status: "open", type: null, page: 1 });
  assert.deepEqual(parseAdminReportQuery({ status: "resolved", type: "review", page: "2" }), { status: "resolved", type: "review", page: 2 });
  assert.equal(parseAdminReportQuery({ status: "dismissed" }).status, "dismissed");
  for (const status of ["OPEN", "done", ""]) assert.equal(parseAdminReportQuery({ status }).status, "open");
  for (const type of ["user", "Review", ""]) assert.equal(parseAdminReportQuery({ type }).type, null);
  for (const page of ["0", "-1", "1.5", "abc"]) assert.equal(parseAdminReportQuery({ page }).page, 1);
  assert.equal(parseAdminReportQuery({ type: ["trade", "review"] }).type, "trade");
});

test("화면 주소는 기본값을 빼고, 서버 주소는 status · targetType · size를 넣는다", () => {
  assert.equal(adminReportsHref({}), "/admin/reports");
  assert.equal(adminReportsHref({ status: "open", type: "trade", page: 1 }), "/admin/reports?type=trade");
  assert.equal(adminReportsHref({ status: "dismissed", page: 3 }), "/admin/reports?status=dismissed&page=3");
  assert.equal(adminReportsApiPath({ status: "open", type: null, page: 1 }), "/admin/reports?status=open&page=1&size=20");
  assert.equal(adminReportsApiPath({ status: "resolved", type: "avatar", page: 2 }), "/admin/reports?status=resolved&targetType=avatar&page=2&size=20");
});

test("종류 칩 순서와 사유 이름 — 서버 값과 같다", () => {
  assert.deepEqual(typeOptions.map((o) => o.value), ["question", "review", "trade", "avatar"]);
  assert.equal(reasonLabel("spam"), "광고 · 도배");
  assert.equal(reasonLabel("unknown"), "기타");
});

test("확인 창 문구 — 숨기기는 알림 안내, 여러 건이면 함께 처리된다고 알려 줌", () => {
  const one = confirmText({ targetType: "question", reportCount: 1 }, "hide");
  assert.equal(one.title, "이 문의을(를) 숨길까요?");
  assert.equal(one.confirm, "숨기기");
  assert.ok(!one.description.includes("함께"));
  assert.ok(confirmText({ targetType: "review", reportCount: 3 }, "hide").description.includes("신고 3건이 함께"));
  const avatar = confirmText({ targetType: "avatar", reportCount: 1 }, "hide");
  assert.equal(avatar.confirm, "기본으로 바꾸기");
  const keep = confirmText({ targetType: "trade", reportCount: 2 }, "dismiss");
  assert.equal(keep.confirm, "그대로 두기");
  assert.ok(keep.description.includes("그대로 보이고"));
});

test("처리 뒤 문구 · 빈 목록 문구", () => {
  assert.equal(doneText({ targetType: "trade" }, "hide"), "거래글을(를) 숨겼어요.");
  assert.equal(doneText({ targetType: "avatar" }, "hide"), "아바타를 기본 모습으로 바꿨어요.");
  assert.equal(doneText({ targetType: "review" }, "dismiss"), "신고를 그대로 두었어요.");
  assert.equal(emptyMessage({ status: "open", type: null }).title, "처리할 신고가 없어요");
  assert.equal(emptyMessage({ status: "resolved", type: "review" }).title, "숨김 처리한 리뷰 신고가 없어요");
});
