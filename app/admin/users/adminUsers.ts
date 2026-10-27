import { api } from "@/lib/api";
import type { Page } from "@/types/api";

/** 관리자 회원 목록 한 줄 — 주소·전화 없음 (#88 AdminUserOut) */
export interface ApiAdminUser {
  id: number;
  /** 탈퇴하면 "탈퇴한 계정" */
  email: string;
  nickname: string;
  role: "user" | "admin";
  signupMethod: "email" | "google";
  createdAt: string;
  avatarUrl: string | null;
  suspended: boolean;
  withdrawn: boolean;
  orderCount: number;
  /** 이 사람이 신고당한 수 */
  reportCount: number;
}

export type AdminUserFilter = "all" | "active" | "suspended";
export type AdminUserRole = "user" | "admin";
export type AdminUserAction = "suspend" | "unsuspend" | "avatar";
export interface AdminUserQuery { status: AdminUserFilter; role: AdminUserRole | null; q: string; page: number; }

export const ADMIN_USERS_PATH = "/admin/users";
export const ADMIN_USER_PAGE_SIZE = 20;
export const SEARCH_LIMIT = 100; // 서버 q 최대 길이

// 상태 탭 — 처음엔 전체
export const statusOptions: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "정상" },
  { value: "suspended", label: "정지" },
];

export const roleOptions: { value: AdminUserRole; label: string }[] = [
  { value: "user", label: "손님" },
  { value: "admin", label: "관리자" },
];

const FILTERS = statusOptions.map((option) => option.value);
const ROLES = roleOptions.map((option) => option.value);

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 주소창 쿼리(?status=&role=&q=&page=)를 안전한 값으로 */
export function parseAdminUserQuery(params: RawParams): AdminUserQuery {
  const rawStatus = first(params.status);
  const rawRole = first(params.role);
  const page = Number(first(params.page));
  return {
    status: FILTERS.find((value) => value === rawStatus) ?? "all",
    role: ROLES.find((value) => value === rawRole) ?? null,
    q: Array.from((first(params.q) ?? "").trim()).slice(0, SEARCH_LIMIT).join(""),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** 화면 주소 — 기본값은 빼서 짧게 */
export function adminUsersHref({ status = "all", role = null, q = "", page = 1 }: Partial<AdminUserQuery>) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (role) params.set("role", role);
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${ADMIN_USERS_PATH}?${search}` : ADMIN_USERS_PATH;
}

/** 서버 API 주소 — 정상/정지는 suspended=false/true로 */
export function adminUsersApiPath({ status, role, q, page }: AdminUserQuery) {
  const params = new URLSearchParams();
  if (status === "active") params.set("suspended", "false");
  if (status === "suspended") params.set("suspended", "true");
  if (role) params.set("role", role);
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("size", String(ADMIN_USER_PAGE_SIZE));
  return `/admin/users?${params}`;
}

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 회원 API (#88 정지 · #90 아바타 초기화) — 정지할 수 없는 계정이면 400
export const adminUsersApi = {
  list: (query: AdminUserQuery, signal?: AbortSignal) => api.get<Page<ApiAdminUser>>(adminUsersApiPath(query), options(signal)),
  setSuspended: (userId: number, suspended: boolean) => api.patch<ApiAdminUser>(`/admin/users/${userId}`, { suspended }, options()),
  resetAvatar: (userId: number) => api.post<ApiAdminUser>(`/admin/users/${userId}/avatar-reset`, undefined, options()),
};

type UserLike = Pick<ApiAdminUser, "id" | "role" | "suspended" | "withdrawn" | "avatarUrl">;

/** 상태 표시 — 탈퇴 > 정지 > 관리자 > 정상 */
export function userState(user: Pick<ApiAdminUser, "role" | "suspended" | "withdrawn">): { label: string; tone: "mint" | "pink" | "dim" | "lime" } {
  if (user.withdrawn) return { label: "탈퇴", tone: "dim" };
  if (user.suspended) return { label: "정지", tone: "pink" };
  if (user.role === "admin") return { label: "관리자", tone: "lime" };
  return { label: "정상", tone: "mint" };
}

/** 할 수 있는 처리 — 서버 규칙과 같게: 나 · 관리자 · 탈퇴는 정지 불가, 해제는 언제나, 아바타가 있을 때만 초기화 */
export function userActions(user: UserLike, meId: number | null | undefined): AdminUserAction[] {
  const actions: AdminUserAction[] = [];
  if (user.avatarUrl && !user.withdrawn) actions.push("avatar");
  if (user.suspended) actions.push("unsuspend");
  else if (!user.withdrawn && user.role !== "admin" && user.id !== meId) actions.push("suspend");
  return actions;
}

export const actionLabel: Record<AdminUserAction, string> = { suspend: "정지", unsuspend: "정지 해제", avatar: "아바타 초기화" };
export const signupLabel = (method: string) => (method === "google" ? "구글" : "이메일");

/** 확인 창 문구 */
export function confirmText(user: Pick<ApiAdminUser, "nickname">, action: AdminUserAction) {
  if (action === "suspend") return { title: `${user.nickname} 님을 정지할까요?`, description: "구경과 로그인은 되지만 리뷰 · 문의 · 거래글 같은 글쓰기가 막혀요. 언제든 해제할 수 있어요.", confirm: "정지하기", danger: true };
  if (action === "unsuspend") return { title: `${user.nickname} 님의 정지를 풀까요?`, description: "다시 글을 쓸 수 있어요.", confirm: "정지 해제", danger: false };
  return { title: `${user.nickname} 님의 아바타를 기본 모습으로 바꿀까요?`, description: "지금 아바타는 되돌릴 수 없고, 본인에게 알림이 가요.", confirm: "초기화하기", danger: true };
}

export function doneText(user: Pick<ApiAdminUser, "nickname">, action: AdminUserAction) {
  if (action === "suspend") return `${user.nickname} 님을 정지했어요.`;
  if (action === "unsuspend") return `${user.nickname} 님의 정지를 풀었어요.`;
  return `${user.nickname} 님의 아바타를 기본 모습으로 바꿨어요.`;
}

export function emptyMessage({ status, role, q }: Pick<AdminUserQuery, "status" | "role" | "q">) {
  if (q) return "검색 결과가 없어요. 닉네임이나 이메일로 찾아보세요.";
  if (status === "suspended") return "정지된 회원이 없어요.";
  if (status !== "all" || role) return "조건에 맞는 회원이 없어요.";
  return "아직 회원이 없어요.";
}
