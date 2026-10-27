import { api } from "@/lib/api";
import type { ApiAddress } from "@/types/api";

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
  isDefault?: boolean;
}

const options = (signal?: AbortSignal): RequestInit => ({ cache: "no-store", signal });

/** 내 배송지 — 추가·수정은 바뀐 전체 목록을 돌려준다 */
export const addressesApi = {
  list: (signal?: AbortSignal) => api.get<ApiAddress[]>("/users/me/addresses", options(signal)),
  add: (input: AddressInput) => api.post<ApiAddress[]>("/users/me/addresses", input),
  update: (id: number, input: AddressInput) => api.put<ApiAddress[]>(`/users/me/addresses/${id}`, input),
  remove: (id: number) => api.delete<{ message: string }>(`/users/me/addresses/${id}`),
};
