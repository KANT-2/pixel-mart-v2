import { api } from "@/lib/api";
import type { ApiPointBalance, ApiPointTransaction, Page } from "@/types/api";

const options = (signal?: AbortSignal): RequestInit => ({ cache: "no-store", signal });

/** 적립금(구매 포인트, #97) — 로그인 사용자 것만 */
export const pointsApi = {
  balance: (signal?: AbortSignal) => api.get<ApiPointBalance>("/users/me/points", options(signal)),
  history: (page: number, signal?: AbortSignal) => api.get<Page<ApiPointTransaction>>(`/users/me/points/history?page=${page}&size=20`, options(signal)),
};
