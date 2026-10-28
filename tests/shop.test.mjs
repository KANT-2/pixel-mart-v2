import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

// 타입 import만 있어서 그대로 옮겨도 된다
const source = await readFile(new URL("../utils/shop.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const shop = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("연락처는 하이픈을 넣어 맞춘다", () => {
  assert.equal(shop.formatPhone("01012345678"), "010-1234-5678");
  assert.equal(shop.formatPhone("0212345678"), "02-1234-5678");
  assert.equal(shop.formatPhone("010-123"), "010-123");
  assert.equal(shop.isValidPhone("010-1234-5678"), true);
  assert.equal(shop.isValidPhone("1234"), false);
  for (const short of ["02-123-4567", "010-123-4567", "031-1234-5678"]) assert.equal(shop.isValidPhone(short), false); // 휴대폰 11자리만
  assert.equal(shop.phoneHint("010-1234-567"), "휴대폰 번호 11자리 중 10자리 입력했어요.");
  assert.equal(shop.phoneHint("010-1234-5678"), null);
  assert.equal(shop.phoneHint(""), null);
});

test("배송지 검사 — 틀린 칸마다 안내", () => {
  const ok = shop.validateShipping({ recipientName: " 홍길동 ", phone: "01012345678", postalCode: "04001", address: "서울 마포구", addressDetail: "101동 1001호" });
  assert.equal(ok.valid, true);
  assert.equal(ok.values.phone, "010-1234-5678");
  const bad = shop.validateShipping({ recipientName: "", phone: "12", postalCode: "", address: "", addressDetail: "" });
  assert.deepEqual(Object.keys(bad.errors).sort(), ["address", "addressDetail", "phone", "postalCode", "recipientName"]);
});

test("쿠폰 할인 미리보기는 서버 규칙과 같다", () => {
  const percent = { status: "available", discountType: "percent", discountValue: 10, minOrderPrice: 30000, maxDiscount: 5000 };
  assert.deepEqual(shop.couponDiscount(percent, 40000), { discount: 4000 });
  assert.deepEqual(shop.couponDiscount(percent, 90000), { discount: 5000 });
  assert.equal(shop.couponDiscount(percent, 20000).discount, null);
  assert.equal(shop.couponDiscount({ ...percent, status: "used" }, 90000).reason, "사용 완료");
  assert.equal(shop.couponBenefit(percent), "10% 할인 (최대 5,000원)");
  assert.equal(shop.couponBenefit({ discountType: "amount", discountValue: 3000, maxDiscount: null }), "3,000원 할인");
});

test("운송장 조회 링크와 배송 완료 뒤 버튼", () => {
  assert.match(shop.trackingUrl("cj", "123456789012"), /123456789012/);
  assert.equal(shop.trackingUrl("cj", "12"), null);
  assert.equal(shop.trackingUrl(null, "123456789012"), null);
  assert.deepEqual(shop.afterDeliveryActions({ status: "delivered", confirmedAt: null }), { canConfirm: true, canReturn: true });
  assert.deepEqual(shop.afterDeliveryActions({ status: "delivered", confirmedAt: "2026-10-27" }), { canConfirm: false, canReturn: false });
  assert.deepEqual(shop.afterDeliveryActions({ status: "return_requested", confirmedAt: null }), { canConfirm: false, canReturn: false });
});
