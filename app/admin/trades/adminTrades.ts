import { api } from "@/lib/api";
import type { ApiTradePost, Page, TradeKind } from "@/types/api";

/** 관리자 거래글 한 줄 — 거래글 + 작성자 닉네임 · 이메일 · 관리자가 숨겼는지 (#89 AdminTradeOut) */
export interface ApiAdminTrade extends ApiTradePost {
  authorNickname: string;
  /** 관리자만 보는 작성자 이메일 (탈퇴하면 "탈퇴한 계정") */
  authorEmail: string;
  hiddenByAdmin: boolean;
}

export type AdminTradeFilter = "all" | "open" | "done" | "hidden";
export type AdminTradeTarget = "hidden" | "open"; // 숨김 · 다시 보이기
export interface AdminTradeQuery { status: AdminTradeFilter; kind: TradeKind | null; q: string; page: number; }

export const ADMIN_TRADES_PATH = "/admin/trades";
export const ADMIN_TRADE_PAGE_SIZE = 20;
export const SEARCH_LIMIT = 100; // 서버 q 최대 길이
export const PREVIEW_LENGTH = 40; // 본문 앞부분 한 줄

// 상태 탭 — 처음엔 전체
export const statusOptions: { value: AdminTradeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "open", label: "진행 중" },
  { value: "done", label: "완료" },
  { value: "hidden", label: "숨김" },
];

// 종류 칩 — 표에서도 짧게 쓴다
export const kindOptions: { value: TradeKind; label: string }[] = [
  { value: "have", label: "HAVE" },
  { value: "want", label: "WISH" },
  { value: "sell", label: "SELL" },
];

const FILTERS = statusOptions.map((option) => option.value);
const KINDS = kindOptions.map((option) => option.value);

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 주소창 쿼리(?status=&kind=&q=&page=)를 안전한 값으로 */
export function parseAdminTradeQuery(params: RawParams): AdminTradeQuery {
  const rawStatus = first(params.status);
  const rawKind = first(params.kind);
  const page = Number(first(params.page));
  return {
    status: FILTERS.find((value) => value === rawStatus) ?? "all",
    kind: KINDS.find((value) => value === rawKind) ?? null,
    q: Array.from((first(params.q) ?? "").trim()).slice(0, SEARCH_LIMIT).join(""),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** 화면 주소 — 기본값(전체 · 종류 없음 · 검색 없음 · 1쪽)은 빼서 짧게 */
export function adminTradesHref({ status = "all", kind = null, q = "", page = 1 }: Partial<AdminTradeQuery>) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (kind) params.set("kind", kind);
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${ADMIN_TRADES_PATH}?${search}` : ADMIN_TRADES_PATH;
}

/** 서버 API 주소 — 전체면 status를 보내지 않는다 */
export function adminTradesApiPath({ status, kind, q, page }: AdminTradeQuery) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (kind) params.set("kind", kind);
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("size", String(ADMIN_TRADE_PAGE_SIZE));
  return `/admin/trades?${params}`;
}

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 거래글 API (#89) — 관리자가 아니면 404, 글쓴이가 숨긴 글을 다시 보이게 하면 400
export const adminTradesApi = {
  list: (query: AdminTradeQuery, signal?: AbortSignal) => api.get<Page<ApiAdminTrade>>(adminTradesApiPath(query), options(signal)),
  change: (postId: number, status: AdminTradeTarget) => api.patch<ApiAdminTrade>(`/admin/trades/${postId}`, { status }, options()),
};

export const kindLabel = (kind: string) => kindOptions.find((option) => option.value === kind)?.label ?? kind;

/** 상태 표시 — 숨김은 누가 숨겼는지 나눠서 (글쓴이가 숨긴 글은 관리자가 다시 열 수 없다) */
export function tradeState(post: Pick<ApiAdminTrade, "status" | "hiddenByAdmin">): { label: string; tone: "mint" | "dim" | "pink" } {
  if (post.status === "hidden") return post.hiddenByAdmin ? { label: "숨김(관리자)", tone: "pink" } : { label: "숨김(글쓴이)", tone: "dim" };
  if (post.status === "done") return { label: "완료", tone: "dim" };
  return { label: "진행 중", tone: "mint" };
}

/** 이 글에 할 수 있는 처리 — 숨김 아니면 [숨김], 관리자가 숨긴 글만 [다시 보이기], 글쓴이가 숨긴 글은 없음 */
export function tradeAction(post: Pick<ApiAdminTrade, "status" | "hiddenByAdmin">): AdminTradeTarget | null {
  if (post.status !== "hidden") return "hidden";
  return post.hiddenByAdmin ? "open" : null;
}

/** 본문 앞부분 한 줄 — 줄바꿈은 띄어쓰기로 */
export function contentPreview(content: string) {
  const line = content.replace(/\s+/g, " ").trim();
  const chars = Array.from(line);
  return chars.length > PREVIEW_LENGTH ? `${chars.slice(0, PREVIEW_LENGTH).join("")}…` : line;
}

/** 확인 창 문구 */
export function confirmText(post: Pick<ApiAdminTrade, "itemName">, target: AdminTradeTarget) {
  if (target === "hidden") return { title: `"${post.itemName}" 글을 숨길까요?`, description: "거래·교환 게시판에서 바로 사라지고, 글쓴이에게 알림이 가요.", confirm: "숨기기" };
  return { title: `"${post.itemName}" 글을 다시 보이게 할까요?`, description: "게시판에 다시 보이고, 진행 중 상태로 돌아가요.", confirm: "다시 보이기" };
}

export const doneText = (post: Pick<ApiAdminTrade, "itemName">, target: AdminTradeTarget) =>
  target === "hidden" ? `"${post.itemName}" 글을 숨겼어요.` : `"${post.itemName}" 글을 다시 보이게 했어요.`;

/** 빈 목록 안내 */
export function emptyMessage({ status, kind, q }: Pick<AdminTradeQuery, "status" | "kind" | "q">) {
  if (q) return "검색 결과가 없어요. 물건 이름 · 내용 · 닉네임 · 이메일로 찾아보세요.";
  if (status !== "all" || kind) return "조건에 맞는 거래글이 없어요.";
  return "아직 거래글이 없어요.";
}
