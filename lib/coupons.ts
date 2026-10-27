import { api } from "@/lib/api";
import type { ApiUserCoupon } from "@/types/api";

const options = (signal?: AbortSignal): RequestInit => ({ cache: "no-store", signal });

/** 내 쿠폰 — 처음 열면 웰컴 쿠폰이 들어온다 */
export const couponsApi = {
  list: (signal?: AbortSignal) => api.get<ApiUserCoupon[]>("/users/me/coupons", options(signal)),
  register: (code: string) => api.post<ApiUserCoupon[]>("/users/me/coupons", { code }),
};
