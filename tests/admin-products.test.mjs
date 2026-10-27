import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { validateProductCreate, validateProductEdit, validateRestockQty, buildProductUpdatePayload, stockStatus } =
  await import(await moduleUrl("../utils/adminProducts.ts"));

const VALUES = { name: "하트 키캡", price: "15000", categorySlug: "keycap", description: "설명", imageUrl: "/images/a.png", rarity: "rare" };

test("등록 폼: 정상 값은 통과", () => {
  assert.equal(validateProductCreate(VALUES, "10").valid, true);
});

test("등록 폼: 이미지 경로가 /images/로 시작 안 하면 에러", () => {
  const result = validateProductCreate({ ...VALUES, imageUrl: "http://x.com/a.png" }, "10");
  assert.equal(result.valid, false);
  assert.ok(result.errors.imageUrl);
});

test("등록 폼: 가격·초기 재고가 범위 밖이면 에러", () => {
  assert.equal(validateProductCreate({ ...VALUES, price: "50" }, "10").valid, false);
  assert.equal(validateProductCreate(VALUES, "-1").valid, false);
  assert.equal(validateProductCreate(VALUES, "10000").valid, false);
});

test("수정 폼: 재고 필드 없이 공통 항목만 검증한다", () => {
  assert.equal(validateProductEdit(VALUES).valid, true);
  assert.equal(validateProductEdit({ ...VALUES, name: "" }).valid, false);
});

test("추가 입고 수량: 비어 있으면 0으로 통과(재입고 없음)", () => {
  assert.deepEqual(validateRestockQty(""), { valid: true, qty: 0 });
});

test("추가 입고 수량: 0 이하·소수는 에러", () => {
  assert.equal(validateRestockQty("0").valid, false);
  assert.equal(validateRestockQty("1.5").valid, false);
  assert.equal(validateRestockQty("3").valid, true);
});

test("PATCH payload: 바뀐 필드만 담고, 재입고 수량이 있을 때만 stock을 더한다", () => {
  const original = {
    id: 1, name: "하트 키캡", price: 15000, category: "키캡", categorySlug: "keycap",
    imageUrl: "/images/a.png", description: "설명", isNew: false, stock: 5, rarity: "rare", isHidden: false,
  };
  const edited = { name: "하트 키캡", price: 16000, categorySlug: "keycap", description: "설명", imageUrl: "/images/a.png", rarity: "rare" };

  assert.deepEqual(buildProductUpdatePayload(original, edited, 0), { price: 16000 });
  assert.deepEqual(buildProductUpdatePayload(original, { ...edited, price: original.price }, 3), { stock: 3 });
  assert.deepEqual(buildProductUpdatePayload(original, { ...edited, price: original.price }, 0), {});
});

test("재고 표시: 0은 품절, 10 이하는 곧 품절, 그 외는 없음", () => {
  assert.deepEqual(stockStatus(0), { label: "품절", className: "text-pink" });
  assert.deepEqual(stockStatus(10), { label: "곧 품절", className: "text-pink" });
  assert.equal(stockStatus(11), null);
});
