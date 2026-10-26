import { api } from "@/lib/api";
import type { ApiQuestion, Page } from "@/types/api";

// 글자 수 제한 — 백엔드 Question 도메인·QuestionIn 스키마와 같다
export const questionLimits = { title: 100, content: 500 } as const;
export const QUESTION_PAGE_SIZE = 20;

export function validateQuestion(title: string, content: string) {
  const values = { title: title.trim(), content: content.trim() };
  const errors: { title?: string; content?: string } = {};
  if (!values.title) errors.title = "질문 제목을 입력해 주세요.";
  else if (Array.from(values.title).length > questionLimits.title) errors.title = `제목은 ${questionLimits.title}자 이내로 입력해 주세요.`;
  if (!values.content) errors.content = "질문 내용을 입력해 주세요.";
  else if (Array.from(values.content).length > questionLimits.content) errors.content = `질문은 ${questionLimits.content}자 이내로 입력해 주세요.`;
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

export interface QuestionInput { title: string; content: string; isSecret: boolean; }
export type QuestionView = ApiQuestion;

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 상품 문의 API (#30) — 로그인 쿠키는 브라우저가 같이 보낸다
export const questionsApi = {
  list: (productId: number, page: number, signal?: AbortSignal) =>
    api.get<Page<ApiQuestion>>(`/products/${productId}/questions?page=${page}&size=${QUESTION_PAGE_SIZE}`, options(signal)),
  create: (productId: number, input: QuestionInput, signal?: AbortSignal) =>
    api.post<ApiQuestion>(`/products/${productId}/questions`, input, options(signal)),
  remove: (questionId: number, signal?: AbortSignal) =>
    api.delete<{ message: string }>(`/questions/${questionId}`, options(signal)),
};

/** 삭제 버튼은 로그인 + 내 문의 + 답변 전일 때만 (서버도 같은 규칙으로 404·409를 낸다) */
export function canDeleteQuestion(question: Pick<ApiQuestion, "isMine" | "answered">, signedIn: boolean) {
  return signedIn && question.isMine === true && question.answered === false;
}

/** 삭제 뒤 이번 페이지가 비면 앞 페이지로 (1보다 작아지지 않게) */
export function questionPageAfterReload(data: Pick<Page<ApiQuestion>, "page" | "totalPages" | "items">) {
  if (data.items.length || data.page <= 1) return data.page;
  return Math.max(1, Math.min(data.page - 1, data.totalPages || 1));
}
