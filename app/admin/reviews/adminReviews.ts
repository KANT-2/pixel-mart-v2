import { api } from "@/lib/api";
import type { Page } from "@/types/api";

/** 관리자 리뷰 한 줄 (AdminReviewOut) */
export interface ApiAdminReview {
  id: number;
  productId: number;
  productName: string;
  rating: number;
  content: string;
  imageUrls: string[];
  nickname: string;
  /** 관리자만 보는 작성자 이메일 (탈퇴하면 "탈퇴한 계정") */
  authorEmail: string;
  isHidden: boolean;
  createdAt: string;
  reply: string | null;
  repliedAt: string | null;
}

export type AdminReviewFilter = "all" | "shown" | "hidden";
export interface AdminReviewQuery { status: AdminReviewFilter; rating: number | null; photo: boolean; q: string; page: number; }

export const ADMIN_REVIEWS_PATH = "/admin/reviews";
export const ADMIN_REVIEW_PAGE_SIZE = 20;
export const SEARCH_LIMIT = 100; // 서버 q 최대 길이
export const PREVIEW_LENGTH = 60; // 본문 앞부분

// 상태 탭 — 처음엔 전체
export const statusOptions: { value: AdminReviewFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "shown", label: "공개" },
  { value: "hidden", label: "숨김" },
];
export const RATINGS = [5, 4, 3, 2, 1] as const;

const FILTERS = statusOptions.map((option) => option.value);

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 주소창 쿼리(?status=&rating=&photo=&q=&page=)를 안전한 값으로 */
export function parseAdminReviewQuery(params: RawParams): AdminReviewQuery {
  const rawStatus = first(params.status);
  const rating = Number(first(params.rating));
  const page = Number(first(params.page));
  return {
    status: FILTERS.find((value) => value === rawStatus) ?? "all",
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    photo: first(params.photo) === "1",
    q: Array.from((first(params.q) ?? "").trim()).slice(0, SEARCH_LIMIT).join(""),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** 화면 주소 — 기본값은 빼서 짧게 */
export function adminReviewsHref({ status = "all", rating = null, photo = false, q = "", page = 1 }: Partial<AdminReviewQuery>) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (rating) params.set("rating", String(rating));
  if (photo) params.set("photo", "1");
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${ADMIN_REVIEWS_PATH}?${search}` : ADMIN_REVIEWS_PATH;
}

/** 서버 API 주소 — 전체면 hidden을 보내지 않는다 */
export function adminReviewsApiPath({ status, rating, photo, q, page }: AdminReviewQuery) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("hidden", String(status === "hidden"));
  if (rating) params.set("rating", String(rating));
  if (photo) params.set("photo", "true");
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("size", String(ADMIN_REVIEW_PAGE_SIZE));
  return `/admin/reviews?${params}`;
}

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 리뷰 API — 관리자가 아니면 404
export const adminReviewsApi = {
  list: (query: AdminReviewQuery, signal?: AbortSignal) => api.get<Page<ApiAdminReview>>(adminReviewsApiPath(query), options(signal)),
  setHidden: (reviewId: number, hidden: boolean) => api.patch<ApiAdminReview>(`/admin/reviews/${reviewId}`, { hidden }, options()),
  setReply: (reviewId: number, reply: string | null) => api.patch<ApiAdminReview>(`/admin/reviews/${reviewId}/reply`, { reply }, options()),
};

/** 본문 앞부분 — 줄바꿈은 띄어쓰기로 */
export function contentPreview(content: string) {
  const line = content.replace(/\s+/g, " ").trim();
  const chars = Array.from(line);
  return chars.length > PREVIEW_LENGTH ? `${chars.slice(0, PREVIEW_LENGTH).join("")}…` : line;
}

/** 확인 창 문구 */
export function confirmText(review: Pick<ApiAdminReview, "nickname" | "productName">, hide: boolean) {
  const who = `${review.nickname} 님의 "${review.productName}" 리뷰`;
  if (hide) return { title: `${who}를 숨길까요?`, description: "상품 페이지와 평균 별점에서 바로 빠지고, 작성자에게 알림이 가요.", confirm: "숨기기" };
  return { title: `${who}를 다시 보이게 할까요?`, description: "상품 페이지와 평균 별점에 다시 들어가요.", confirm: "다시 보이기" };
}

export const doneText = (review: Pick<ApiAdminReview, "nickname">, hide: boolean) =>
  hide ? `${review.nickname} 님의 리뷰를 숨겼어요.` : `${review.nickname} 님의 리뷰를 다시 보이게 했어요.`;

/** 빈 목록 안내 */
export function emptyMessage({ status, rating, photo, q }: Pick<AdminReviewQuery, "status" | "rating" | "photo" | "q">) {
  if (q) return "검색 결과가 없어요. 상품 이름 · 내용 · 닉네임 · 이메일로 찾아보세요.";
  if (status !== "all" || rating || photo) return "조건에 맞는 리뷰가 없어요.";
  return "아직 리뷰가 없어요.";
}
