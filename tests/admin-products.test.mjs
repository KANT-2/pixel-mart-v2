import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { validateProductCreate, validateProductEdit, validateRestockQty, validateStockSetQty, hasConflictingStockInput, buildProductUpdatePayload, stockStatus } =
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

test("재고 수량(절대값) 검증: 범위 밖·빈 값·소수는 에러", () => {
  assert.equal(validateStockSetQty("").valid, false);
  assert.equal(validateStockSetQty("-1").valid, false);
  assert.equal(validateStockSetQty("10000").valid, false);
  assert.equal(validateStockSetQty("1.5").valid, false);
  assert.deepEqual(validateStockSetQty("0"), { valid: true, qty: 0 });
  assert.deepEqual(validateStockSetQty("20"), { valid: true, qty: 20 });
});

test("재고 동시 입력 충돌: 재고 수량을 바꾸고 추가 입고도 넣으면 충돌", () => {
  assert.equal(hasConflictingStockInput(20, 5, 3), true); // 둘 다 바뀜
  assert.equal(hasConflictingStockInput(5, 5, 3), false); // 재고 수량은 그대로, 추가 입고만
  assert.equal(hasConflictingStockInput(20, 5, 0), false); // 추가 입고를 안 넣음
});

test("PATCH payload: 바뀐 필드만 담고, 재입고 수량이 있을 때만 stock을 더한다(재고 수량은 안 바꾼 경우)", () => {
  const original = {
    id: 1, name: "하트 키캡", price: 15000, category: "키캡", categorySlug: "keycap",
    imageUrl: "/images/a.png", description: "설명", isNew: false, stock: 5, rarity: "rare", isHidden: false,
  };
  const edited = { name: "하트 키캡", price: 16000, categorySlug: "keycap", description: "설명", imageUrl: "/images/a.png", rarity: "rare" };

  assert.deepEqual(buildProductUpdatePayload(original, edited, 0, original.stock), { price: 16000 });
  assert.deepEqual(buildProductUpdatePayload(original, { ...edited, price: original.price }, 3, original.stock), { stock: 3 });
  assert.deepEqual(buildProductUpdatePayload(original, { ...edited, price: original.price }, 0, original.stock), {});
});

test("PATCH payload: 재고 수량을 바꾸면 stockSet으로 절대 설정하고, 안 바꾸면 보내지 않는다", () => {
  const original = {
    id: 1, name: "하트 키캡", price: 15000, category: "키캡", categorySlug: "keycap",
    imageUrl: "/images/a.png", description: "설명", isNew: false, stock: 5, rarity: "rare", isHidden: false,
  };
  const edited = { name: "하트 키캡", price: 15000, categorySlug: "keycap", description: "설명", imageUrl: "/images/a.png", rarity: "rare" };

  assert.deepEqual(buildProductUpdatePayload(original, edited, 0, 20), { stockSet: 20 }); // 재고 수량을 5 → 20으로
  assert.deepEqual(buildProductUpdatePayload(original, edited, 0, 0), { stockSet: 0 }); // 0으로 설정(품절 처리)도 가능
  assert.deepEqual(buildProductUpdatePayload(original, edited, 0, 5), {}); // 원래 값(5)과 같으면 아무것도 안 보냄
  // 재고 수량을 바꾸면 추가 입고 값은 무시한다(폼에서 미리 막지만, 함수 자체는 stockSet을 우선한다)
  assert.deepEqual(buildProductUpdatePayload(original, edited, 3, 20), { stockSet: 20 });
});

test("재고 표시: 0은 품절, 10 이하는 곧 품절, 그 외는 없음", () => {
  assert.deepEqual(stockStatus(0), { label: "품절", className: "text-pink" });
  assert.deepEqual(stockStatus(10), { label: "곧 품절", className: "text-pink" });
  assert.equal(stockStatus(11), null);
});
