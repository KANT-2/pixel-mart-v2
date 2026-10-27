import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../utils/gameItem.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { productRarity, isRarity, rarityOf } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);

test("서버 등급이 있으면 가격과 상관없이 서버 값 (관리자가 바꾼 등급)", () => {
  assert.equal(productRarity({ price: 9_900, rarity: "unique" }).key, "unique");
  assert.equal(productRarity({ price: 45_000, rarity: "common" }).key, "common");
  assert.equal(productRarity({ price: 12_900, rarity: "epic" }).label, "EPIC");
});

test("서버 등급이 없거나 이상한 값이면 가격으로 계산 (정적 데이터 대체)", () => {
  for (const rarity of [undefined, null, "", "legendary", "RARE"]) {
    assert.equal(productRarity({ price: 12_900, rarity }).key, rarityOf(12_900).key);
  }
  assert.equal(productRarity(undefined).key, "common");
  assert.equal(productRarity(null).key, "common");
});

test("등급 키 확인", () => {
  for (const key of ["common", "rare", "epic", "unique"]) assert.equal(isRarity(key), true);
  for (const value of ["Common", "mythic", 1, null, undefined]) assert.equal(isRarity(value), false);
});
