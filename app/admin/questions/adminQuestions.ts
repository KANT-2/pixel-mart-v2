import { api } from "@/lib/api";
import type { ApiQuestion, Page } from "@/types/api";

/** 관리자 문의 목록 한 줄 — 상품 문의(ApiQuestion) + 상품 이름 · 작성자 닉네임 (#31 AdminQuestionOut) */
export interface ApiAdminQuestion extends ApiQuestion { productName: string; authorNickname: string; }

export type AdminQuestionStatus = "waiting" | "answered" | "all";
export interface AdminQuestionQuery { status: AdminQuestionStatus; q: string; page: number; }

export const ADMIN_QUESTIONS_PATH = "/admin/questions";
export const ADMIN_QUESTION_PAGE_SIZE = 20;
export const ANSWER_LIMIT = 500; // 백엔드 AnswerIn·도메인 Question과 같은 500자
export const SEARCH_LIMIT = 100; // 백엔드 q 최대 길이

// 필터 버튼 — 처음 들어오면 "답변 대기"(관리자가 처리할 것부터)
export const statusOptions: { value: AdminQuestionStatus; label: string }[] = [
  { value: "waiting", label: "답변 대기" },
  { value: "answered", label: "답변 완료" },
  { value: "all", label: "전체" },
];

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 주소창 쿼리(?status=&q=&page=)를 안전한 값으로 — 이상한 값은 기본값으로 */
export function parseAdminQuestionQuery(params: RawParams): AdminQuestionQuery {
  const rawStatus = first(params.status);
  const status: AdminQuestionStatus = rawStatus === "answered" || rawStatus === "all" ? rawStatus : "waiting";
  const q = Array.from((first(params.q) ?? "").trim()).slice(0, SEARCH_LIMIT).join("");
  const page = Number(first(params.page));
  return { status, q, page: Number.isInteger(page) && page >= 1 ? page : 1 };
}

/** 화면 주소 — 기본값(답변 대기 · 검색 없음 · 1쪽)은 빼서 짧게 */
export function adminQuestionsHref({ status = "waiting", q = "", page = 1 }: Partial<AdminQuestionQuery>) {
  const params = new URLSearchParams();
  if (status !== "waiting") params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${ADMIN_QUESTIONS_PATH}?${search}` : ADMIN_QUESTIONS_PATH;
}

/** 서버 API 주소 — answered: false(대기) · true(완료) · 없음(전체) */
export function adminQuestionsApiPath({ status, q, page }: AdminQuestionQuery) {
  const params = new URLSearchParams();
  if (status === "waiting") params.set("answered", "false");
  if (status === "answered") params.set("answered", "true");
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("size", String(ADMIN_QUESTION_PAGE_SIZE));
  return `/admin/questions?${params}`;
}

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 문의 API (#31) — 관리자가 아니면 서버가 404, 로그아웃이면 401
export const adminQuestionsApi = {
  list: (query: AdminQuestionQuery, signal?: AbortSignal) => api.get<Page<ApiAdminQuestion>>(adminQuestionsApiPath(query), options(signal)),
  answer: (questionId: number, answer: string, signal?: AbortSignal) =>
    api.post<ApiQuestion>(`/admin/questions/${questionId}/answer`, { answer }, options(signal)),
};

/** 남은 글자 수 — 서버(파이썬 len)처럼 글자 단위로 센다 */
export function remainingAnswerChars(text: string) {
  return ANSWER_LIMIT - Array.from(text).length;
}

/** 답변 검사 — 앞뒤 공백을 빼고 1~500자 */
export function validateAnswer(text: string) {
  const value = text.trim();
  if (!value) return { value, error: "답변을 입력해 주세요." };
  if (Array.from(value).length > ANSWER_LIMIT) return { value, error: `답변은 ${ANSWER_LIMIT}자 이내로 입력해 주세요.` };
  return { value, error: null };
}

/** 빈 목록 안내 문구 — 검색 중인지, 어떤 필터인지에 따라 */
export function emptyMessage({ status, q }: Pick<AdminQuestionQuery, "status" | "q">) {
  if (q) return { title: "검색 결과가 없어요", body: "상품 이름이나 문의 제목을 다르게 입력해 보세요." };
  if (status === "waiting") return { title: "답변을 기다리는 문의가 없어요", body: "새 문의가 오면 여기에 보여요." };
  if (status === "answered") return { title: "답변한 문의가 없어요", body: "답변을 등록하면 여기에 모여요." };
  return { title: "아직 문의가 없어요", body: "손님이 상품 문의를 남기면 여기에 보여요." };
}
