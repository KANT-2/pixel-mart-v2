// utils/faqs.ts — FAQ 등록·수정 폼 검증과 순서 바꾸기 계산. 서버(admin_content) 규칙과 값을 맞춘다.
import type { Faq } from "@/types/faq";

export const FAQ_CATEGORY_MAX = 30;
export const FAQ_QUESTION_MAX = 200;
export const FAQ_ANSWER_MAX = 2_000;

export interface FaqFormValues {
  category: string;
  question: string;
  answer: string;
}

export interface FaqFormErrors {
  category?: string;
  question?: string;
  answer?: string;
}

export function validateFaqForm(values: FaqFormValues): { valid: boolean; errors: FaqFormErrors } {
  const errors: FaqFormErrors = {};
  const category = values.category.trim();
  if (!category || category.length > FAQ_CATEGORY_MAX) errors.category = `분류는 1~${FAQ_CATEGORY_MAX}자로 입력해 주세요.`;
  const question = values.question.trim();
  if (!question || question.length > FAQ_QUESTION_MAX) errors.question = `질문은 1~${FAQ_QUESTION_MAX}자로 입력해 주세요.`;
  const answer = values.answer.trim();
  if (!answer || answer.length > FAQ_ANSWER_MAX) errors.answer = `답변은 1~${FAQ_ANSWER_MAX}자로 입력해 주세요.`;
  return { valid: Object.keys(errors).length === 0, errors };
}

// 새 FAQ의 기본 sortOrder — 현재 목록 최댓값 + 1 (비어 있으면 1)
export function nextSortOrder(faqs: Faq[]): number {
  if (faqs.length === 0) return 1;
  return Math.max(...faqs.map((faq) => faq.sortOrder)) + 1;
}

// 등록 폼의 "분류" datalist 추천값 — 목록에 이미 쓰인 분류를 중복 없이 모은다
export function faqCategories(faqs: Faq[]): string[] {
  return [...new Set(faqs.map((faq) => faq.category))];
}

export interface SortOrderPatch {
  id: number;
  sortOrder: number;
}

// 드래그로 새로 정해진 순서(newOrder, dnd-kit의 arrayMove 결과) 기준으로 전체를 1..n으로 다시 매기고,
// 실제로 값이 바뀌는 항목만 돌려준다(그대로인 항목은 PATCH 안 보내도 되니 제외).
// 매번 전체를 기준으로 다시 매기므로, 기존 sortOrder가 0으로 전부 같거나 듬성듬성 떨어져 있어도
// (서버 응답이 꼬여 있어도) 항상 올바른 1..n 순서로 수렴한다.
export function reorderFaqs(newOrder: Faq[]): SortOrderPatch[] {
  return newOrder
    .map((faq, index) => ({ faq, sortOrder: index + 1 }))
    .filter(({ faq, sortOrder }) => faq.sortOrder !== sortOrder)
    .map(({ faq, sortOrder }) => ({ id: faq.id, sortOrder }));
}
