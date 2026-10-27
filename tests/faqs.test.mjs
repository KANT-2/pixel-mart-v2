import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

const { validateFaqForm, nextSortOrder, faqCategories, reorderFaqs } = await import(await moduleUrl("../utils/faqs.ts"));

const VALUES = { category: "주문", question: "주문은 어떻게 하나요?", answer: "장바구니에서 주문하기를 누르면 돼요." };

test("폼 검증: 분류·질문·답변이 비어 있으면 에러", () => {
  assert.equal(validateFaqForm(VALUES).valid, true);
  assert.equal(validateFaqForm({ ...VALUES, category: "" }).valid, false);
  assert.equal(validateFaqForm({ ...VALUES, question: "" }).valid, false);
  assert.equal(validateFaqForm({ ...VALUES, answer: "" }).valid, false);
});

test("폼 검증: 글자 수 제한(분류 30, 질문 200, 답변 2000)", () => {
  assert.equal(validateFaqForm({ ...VALUES, category: "가".repeat(31) }).valid, false);
  assert.equal(validateFaqForm({ ...VALUES, question: "가".repeat(201) }).valid, false);
  assert.equal(validateFaqForm({ ...VALUES, answer: "가".repeat(2001) }).valid, false);
});

test("다음 sortOrder: 목록이 비면 1, 아니면 최댓값+1", () => {
  assert.equal(nextSortOrder([]), 1);
  assert.equal(nextSortOrder([{ sortOrder: 2 }, { sortOrder: 5 }, { sortOrder: 1 }]), 6);
});

test("분류 추천값: 중복 없이 모은다", () => {
  const faqs = [{ category: "주문" }, { category: "배송" }, { category: "주문" }];
  assert.deepEqual(faqCategories(faqs), ["주문", "배송"]);
});

test("드래그 순서 반영: 이미 1..n이고 안 바뀌었으면 빈 배열", () => {
  const faqs = [{ id: 1, sortOrder: 1 }, { id: 2, sortOrder: 2 }, { id: 3, sortOrder: 3 }];
  assert.deepEqual(reorderFaqs(faqs), []);
});

test("드래그 순서 반영: 값이 이미 1..n일 때 실제로 움직인 항목만 돌려준다", () => {
  // 원래 [1,2,3,4](sortOrder 1,2,3,4)에서 1번을 맨 뒤로 드래그 → [2,3,4,1]
  const dragged = [
    { id: 2, sortOrder: 2 }, { id: 3, sortOrder: 3 }, { id: 4, sortOrder: 4 }, { id: 1, sortOrder: 1 },
  ];
  // 새 위치 기준 1..4로 다시 매기면: 2→1(바뀜), 3→2(바뀜), 4→3(바뀜), 1→4(바뀜) — 이 경우는 전부 한 칸씩 밀려서 전부 바뀐다
  assert.deepEqual(reorderFaqs(dragged), [
    { id: 2, sortOrder: 1 }, { id: 3, sortOrder: 2 }, { id: 4, sortOrder: 3 }, { id: 1, sortOrder: 4 },
  ]);
});

test("드래그 순서 반영: 안 움직인 뒤쪽 항목은 제외된다", () => {
  // [1,2,3,4,5]에서 1번과 2번만 자리를 바꿈 → [2,1,3,4,5] — 3,4,5는 원래 자리(3,4,5) 그대로라 제외
  const dragged = [
    { id: 2, sortOrder: 2 }, { id: 1, sortOrder: 1 }, { id: 3, sortOrder: 3 }, { id: 4, sortOrder: 4 }, { id: 5, sortOrder: 5 },
  ];
  assert.deepEqual(reorderFaqs(dragged), [{ id: 2, sortOrder: 1 }, { id: 1, sortOrder: 2 }]);
});

test("드래그 순서 반영: 기존 sortOrder가 전부 0으로 같아도(중복) 1..n으로 수렴한다", () => {
  const dragged = [{ id: 2, sortOrder: 0 }, { id: 1, sortOrder: 0 }, { id: 3, sortOrder: 0 }];
  assert.deepEqual(reorderFaqs(dragged), [{ id: 2, sortOrder: 1 }, { id: 1, sortOrder: 2 }, { id: 3, sortOrder: 3 }]);
});
