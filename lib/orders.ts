import { api } from "@/lib/api";
import type { ApiCancelRequest, ApiOrder, ApiOrderDetail, ApiOrderSummary, Page } from "@/types/api";

export type PaymentMethod = "card" | "easy_pay" | "transfer";

export interface OrderInput {
  recipientName: string;
  address: string;
  phone?: string;
  postalCode?: string;
  addressDetail?: string;
  deliveryMemo?: string;
  paymentMethod?: PaymentMethod;
  pointsUsed?: number; // 쓸 구매 포인트 (서버가 잔액·주문 금액으로 다시 검사)
  userCouponId?: number | null;
  saveAddress?: boolean; // 이 배송지를 기본 배송지로 저장
}

function requestOptions(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

const OPTIONAL_FIELDS = ["phone", "postalCode", "addressDetail", "deliveryMemo", "paymentMethod", "userCouponId", "saveAddress"] as const;

function orderBody(input: OrderInput) {
  const body: Record<string, unknown> = { recipientName: input.recipientName, address: input.address, pointsUsed: input.pointsUsed ?? 0 };
  for (const field of OPTIONAL_FIELDS) if (input[field] !== undefined && input[field] !== null) body[field] = input[field];
  return body;
}

export const ordersApi = {
  create: (input: OrderInput, signal?: AbortSignal) =>
    // 서버 장바구니 전체로 주문하므로 화면의 상품·금액은 전송하지 않습니다 (아는 칸만 골라 보낸다).
    api.post<ApiOrder>("/orders", orderBody(input), requestOptions(signal)),
  confirm: (id: number, signal?: AbortSignal) =>
    api.post<{ message: string; reward: number }>(`/orders/${id}/confirm`, undefined, requestOptions(signal)),
  requestReturn: (id: number, kind: "return" | "exchange", reason: string, signal?: AbortSignal) =>
    api.post<{ message: string }>(`/orders/${id}/return-requests`, { kind, reason }, requestOptions(signal)),
  list: (page: number, signal?: AbortSignal) =>
    api.get<Page<ApiOrderSummary>>(`/orders?page=${page}&size=10`, requestOptions(signal)),
  detail: (id: number, signal?: AbortSignal) =>
    api.get<ApiOrderDetail>(`/orders/${id}`, requestOptions(signal)),
  cancel: (id: number, reason: string, signal?: AbortSignal) =>
    api.post<ApiCancelRequest>(`/orders/${id}/cancel-requests`, { reason }, requestOptions(signal)),
  advance: (id: number, signal?: AbortSignal) =>
    api.post<ApiOrderDetail>(`/dev/orders/${id}/advance`, undefined, requestOptions(signal)),
};
