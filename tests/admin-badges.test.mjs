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
const { validateBadgeInput, badgeChanges, addRecipient, grantResultText, badgeStateLabel, imageName, MAX_GRANT } =
  await import(await moduleUrl("../app/admin/badges/adminBadges.ts", { "@/lib/api": apiModule }));

const IMAGES = ["/images/badges/santa.png", "/images/badges/reviewer.png"];
const OK = { name: "할로윈", description: "10월 이벤트 참여", image: IMAGES[0], isActive: true };

test("이벤트 뱃지 입력 검사 — 이름 1~20자 · 설명 1~60자 · 목록에 있는 그림", () => {
  assert.equal(validateBadgeInput(OK, IMAGES), null);
  assert.equal(validateBadgeInput({ ...OK, name: "  " }, IMAGES), "이름을 입력해 주세요.");
  assert.match(validateBadgeInput({ ...OK, name: "가".repeat(21) }, IMAGES), /20자/);
  assert.equal(validateBadgeInput({ ...OK, name: "가".repeat(20) }, IMAGES), null);
  assert.match(validateBadgeInput({ ...OK, description: "가".repeat(61) }, IMAGES), /60자/);
  assert.equal(validateBadgeInput({ ...OK, image: "" }, IMAGES), "그림을 골라 주세요.");
  assert.equal(validateBadgeInput({ ...OK, image: "/x.png" }, IMAGES), "고를 수 있는 그림이 아니에요.");
  assert.equal(validateBadgeInput({ ...OK, image: "/x.png" }, []), null); // 그림 목록을 못 받았으면 서버가 검사
});

test("고치기는 바뀐 칸만 보낸다", () => {
  assert.equal(badgeChanges(OK, { ...OK }), null);
  assert.deepEqual(badgeChanges(OK, { ...OK, name: " 새 이름 " }), { name: "새 이름" });
  assert.deepEqual(badgeChanges(OK, { ...OK, isActive: false, image: IMAGES[1] }), { image: IMAGES[1], isActive: false });
});

test("받을 사람 — 중복 · 탈퇴는 빼고 50명까지", () => {
  const user = (id, withdrawn = false) => ({ id, nickname: `u${id}`, email: `u${id}@pixelmart.test`, withdrawn });
  let { list, error } = addRecipient([], user(1));
  assert.deepEqual(list.map((u) => u.id), [1]);
  assert.equal(error, null);
  assert.equal(addRecipient(list, user(1)).list.length, 1);
  assert.match(addRecipient(list, user(2, true)).error, /탈퇴/);
  const full = Array.from({ length: MAX_GRANT }, (_, i) => user(i + 1));
  const over = addRecipient(full, user(99));
  assert.equal(over.list.length, MAX_GRANT);
  assert.match(over.error, /50명/);
});

test("문구 — 주기 결과 · 상태 · 그림 이름", () => {
  assert.equal(grantResultText("할로윈", { granted: 3, skipped: 0 }), "'할로윈' 뱃지를 3명에게 줬어요.");
  assert.match(grantResultText("할로윈", { granted: 1, skipped: 2 }), /2명은 이미/);
  assert.match(grantResultText("할로윈", { granted: 0, skipped: 1 }), /새로 받은 사람이 없어요/);
  assert.equal(badgeStateLabel({ kind: "auto", isActive: true }), "자동");
  assert.equal(badgeStateLabel({ kind: "event", isActive: true }), "사용 중");
  assert.equal(badgeStateLabel({ kind: "event", isActive: false }), "꺼짐");
  assert.equal(imageName("/images/badges/hearts_1.png"), "hearts_1");
});
