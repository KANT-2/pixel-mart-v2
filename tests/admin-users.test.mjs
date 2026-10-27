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
  parseAdminUserQuery, adminUsersHref, adminUsersApiPath, userState, userActions, confirmText, doneText, emptyMessage, signupLabel,
} = await import(await moduleUrl("../app/admin/users/adminUsers.ts", { "@/lib/api": apiModule }));

const base = { id: 7, role: "user", suspended: false, withdrawn: false, avatarUrl: "/uploads/a.png" };

test("주소창 쿼리 — 기본은 전체 · 역할 없음 · 1쪽, 이상한 값은 기본값", () => {
  assert.deepEqual(parseAdminUserQuery({}), { status: "all", role: null, q: "", page: 1 });
  assert.deepEqual(parseAdminUserQuery({ status: "suspended", role: "admin", q: " yj ", page: "2" }), { status: "suspended", role: "admin", q: "yj", page: 2 });
  for (const status of ["banned", "ACTIVE", ""]) assert.equal(parseAdminUserQuery({ status }).status, "all");
  for (const role of ["owner", "Admin", ""]) assert.equal(parseAdminUserQuery({ role }).role, null);
  for (const page of ["0", "-1", "1.5", "abc"]) assert.equal(parseAdminUserQuery({ page }).page, 1);
});

test("화면 주소 · 서버 주소 — 정상/정지는 suspended=false/true", () => {
  assert.equal(adminUsersHref({}), "/admin/users");
  assert.equal(adminUsersHref({ status: "suspended", role: "user", page: 2 }), "/admin/users?status=suspended&role=user&page=2");
  assert.equal(adminUsersApiPath({ status: "all", role: null, q: "", page: 1 }), "/admin/users?page=1&size=20");
  assert.equal(adminUsersApiPath({ status: "active", role: null, q: "", page: 1 }), "/admin/users?suspended=false&page=1&size=20");
  assert.equal(adminUsersApiPath({ status: "suspended", role: "admin", q: "a", page: 3 }), "/admin/users?suspended=true&role=admin&q=a&page=3&size=20");
});

test("상태 표시 — 탈퇴 > 정지 > 관리자 > 정상", () => {
  assert.equal(userState(base).label, "정상");
  assert.equal(userState({ ...base, role: "admin" }).label, "관리자");
  assert.equal(userState({ ...base, suspended: true }).label, "정지");
  assert.equal(userState({ ...base, suspended: true, withdrawn: true }).label, "탈퇴");
});

test("할 수 있는 처리 — 서버 규칙과 같다 (나 · 관리자 · 탈퇴는 정지 버튼 없음, 해제는 언제나)", () => {
  assert.deepEqual(userActions(base, 1), ["avatar", "suspend"]);
  assert.deepEqual(userActions({ ...base, avatarUrl: null }, 1), ["suspend"]);
  assert.deepEqual(userActions({ ...base, suspended: true }, 1), ["avatar", "unsuspend"]);
  assert.deepEqual(userActions({ ...base, role: "admin" }, 1), ["avatar"]);
  assert.deepEqual(userActions(base, 7), ["avatar"]); // 나 자신
  assert.deepEqual(userActions({ ...base, withdrawn: true }, 1), []);
  assert.deepEqual(userActions({ ...base, withdrawn: true, suspended: true, avatarUrl: null }, 1), ["unsuspend"]);
});

test("문구 — 확인 창 · 처리 뒤 · 빈 목록 · 가입 방법", () => {
  assert.equal(confirmText({ nickname: "yj" }, "suspend").title, "yj 님을 정지할까요?");
  assert.equal(confirmText({ nickname: "yj" }, "suspend").danger, true);
  assert.equal(confirmText({ nickname: "yj" }, "unsuspend").danger, false);
  assert.ok(confirmText({ nickname: "yj" }, "avatar").description.includes("알림"));
  assert.equal(doneText({ nickname: "yj" }, "avatar"), "yj 님의 아바타를 기본 모습으로 바꿨어요.");
  assert.equal(emptyMessage({ status: "suspended", role: null, q: "" }), "정지된 회원이 없어요.");
  assert.equal(signupLabel("google"), "구글");
  assert.equal(signupLabel("email"), "이메일");
});
