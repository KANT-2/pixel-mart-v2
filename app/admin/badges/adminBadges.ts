import { api } from "@/lib/api";
import type { Page } from "@/types/api";

/** 관리자 뱃지 한 칸 (#91 BadgeAdminOut) */
export interface ApiAdminBadge {
  code: string;
  name: string;
  description: string;
  image: string;
  kind: "auto" | "event";
  isActive: boolean;
  /** 받은 사람 수 */
  holderCount: number;
}

export interface ApiAdminBadgeList { auto: ApiAdminBadge[]; event: ApiAdminBadge[]; }

/** 뱃지 받은 사람 한 줄 (#91 HolderOut) */
export interface ApiBadgeHolder {
  userId: number;
  nickname: string;
  earnedAt: string;
  /** 관리자가 줬으면 그 관리자 닉네임, 자동이면 null */
  grantedByNickname: string | null;
  memo: string | null;
}

/** 주기 대상 후보 — 사용자 관리 목록(#88)에서 필요한 칸만 */
export interface BadgeGrantCandidate { id: number; nickname: string; email: string; withdrawn: boolean; }

export interface EventBadgeInput { name: string; description: string; image: string; isActive: boolean; }

export const NAME_LIMIT = 20; // 서버 Name
export const DESCRIPTION_LIMIT = 60; // 서버 Description
export const MEMO_LIMIT = 200; // 서버 GrantIn.memo
export const MAX_GRANT = 50; // 서버 MAX_GRANT
export const HOLDER_PAGE_SIZE = 20;

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 뱃지 API (#91) — 자동 뱃지를 고치거나 주면 400, 관리자가 아니면 404
export const adminBadgesApi = {
  list: (signal?: AbortSignal) => api.get<ApiAdminBadgeList>("/admin/badges", options(signal)),
  images: (signal?: AbortSignal) => api.get<string[]>("/admin/badge-images", options(signal)),
  create: (input: EventBadgeInput) => api.post<ApiAdminBadge>("/admin/badges", input, options()),
  update: (code: string, input: Partial<EventBadgeInput>) => api.patch<ApiAdminBadge>(`/admin/badges/${encodeURIComponent(code)}`, input, options()),
  grant: (code: string, userIds: number[], memo: string) =>
    api.post<{ granted: number; skipped: number }>(`/admin/badges/${encodeURIComponent(code)}/grant`, { userIds, memo: memo.trim() || null }, options()),
  holders: (code: string, page: number, signal?: AbortSignal) =>
    api.get<Page<ApiBadgeHolder>>(`/admin/badges/${encodeURIComponent(code)}/holders?page=${page}&size=${HOLDER_PAGE_SIZE}`, options(signal)),
  remove: (code: string) => api.delete<{ message: string }>(`/admin/badges/${encodeURIComponent(code)}`, options()),
  revoke: (code: string, userId: number) => api.delete<{ message: string }>(`/admin/badges/${encodeURIComponent(code)}/holders/${userId}`, options()),
  searchUsers: (q: string, signal?: AbortSignal) =>
    api.get<Page<BadgeGrantCandidate>>(`/admin/users?${new URLSearchParams({ q, size: "10" })}`, options(signal)),
};

const chars = (text: string) => Array.from(text.trim()).length;

/** 이벤트 뱃지 입력 검사 — 서버와 같은 글자 수 (앞뒤 공백 제외) */
export function validateBadgeInput(input: EventBadgeInput, images: string[]): string | null {
  if (!chars(input.name)) return "이름을 입력해 주세요.";
  if (chars(input.name) > NAME_LIMIT) return `이름은 ${NAME_LIMIT}자 이내로 입력해 주세요.`;
  if (!chars(input.description)) return "설명을 입력해 주세요.";
  if (chars(input.description) > DESCRIPTION_LIMIT) return `설명은 ${DESCRIPTION_LIMIT}자 이내로 입력해 주세요.`;
  if (!input.image) return "그림을 골라 주세요.";
  if (images.length && !images.includes(input.image)) return "고를 수 있는 그림이 아니에요.";
  return null;
}

/** 고치기 — 바뀐 칸만 보낸다 (아무것도 안 바뀌면 null) */
export function badgeChanges(before: EventBadgeInput, after: EventBadgeInput): Partial<EventBadgeInput> | null {
  const changes: Partial<EventBadgeInput> = {};
  if (after.name.trim() !== before.name) changes.name = after.name.trim();
  if (after.description.trim() !== before.description) changes.description = after.description.trim();
  if (after.image !== before.image) changes.image = after.image;
  if (after.isActive !== before.isActive) changes.isActive = after.isActive;
  return Object.keys(changes).length ? changes : null;
}

/** 받을 사람 고르기 — 이미 고른 사람 · 탈퇴 계정은 빼고, 50명까지 */
export function addRecipient(list: BadgeGrantCandidate[], user: BadgeGrantCandidate): { list: BadgeGrantCandidate[]; error: string | null } {
  if (user.withdrawn) return { list, error: "탈퇴한 계정에는 줄 수 없어요." };
  if (list.some((item) => item.id === user.id)) return { list, error: null };
  if (list.length >= MAX_GRANT) return { list, error: `한 번에 ${MAX_GRANT}명까지 줄 수 있어요.` };
  return { list: [...list, user], error: null };
}

/** 주기 결과 문구 */
export function grantResultText(badgeName: string, { granted, skipped }: { granted: number; skipped: number }) {
  const base = granted ? `'${badgeName}' 뱃지를 ${granted}명에게 줬어요.` : `'${badgeName}' 뱃지를 새로 받은 사람이 없어요.`;
  return skipped ? `${base} ${skipped}명은 이미 가지고 있거나 줄 수 없는 계정이라 건너뛰었어요.` : base;
}

export const badgeStateLabel = (badge: Pick<ApiAdminBadge, "kind" | "isActive">) =>
  badge.kind === "auto" ? "자동" : badge.isActive ? "사용 중" : "꺼짐";

/** 그림 파일 이름 → 고르기 칸의 읽을 이름 (예: /images/badges/hearts_1.png → hearts_1) */
export const imageName = (path: string) => path.split("/").pop()?.replace(/\.png$/, "") ?? path;
