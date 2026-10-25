import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

async function moduleUrl(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let output = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(dependencies)) output = output.replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const formatPriceUrl = await moduleUrl("../utils/formatPrice.ts");
const { default: CartPriceSummary } = await import(await moduleUrl("../components/cart/CartPriceSummary.tsx", {
  "@/utils/formatPrice": formatPriceUrl,
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
}));

function renderPriceSummary(props) {
  return renderToStaticMarkup(createElement(CartPriceSummary, props));
}

test("29,000원 장바구니는 서버 금액과 무료배송까지 남은 1,000원을 표시한다", () => {
  const html = renderPriceSummary({ itemsPrice: 29_000, shippingFee: 3_000, freeShippingLeft: 1_000, totalPrice: 32_000 });
  for (const text of ["상품 합계", "29,000원", "배송비", "3,000원", "총액", "32,000원", "1,000원 더 담으면 무료 배송"]) {
    assert.ok(html.includes(text), text);
  }
});

test("무료 배송 응답은 배송비를 다시 계산하지 않고 lime 문구로 표시한다", () => {
  const html = renderPriceSummary({ itemsPrice: 30_000, shippingFee: 0, freeShippingLeft: 0, totalPrice: 30_000 });
  assert.equal((html.match(/무료 배송/g) ?? []).length, 2);
  assert.match(html, /text-lime[^>]*>무료 배송/);
  assert.doesNotMatch(html, />0원</);
});
