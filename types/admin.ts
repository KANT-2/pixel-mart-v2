// types/admin.ts — 관리자 화면 전용 타입. 공용 types/api.ts는 고치지 않고 가져다 쓰기만 한다.
import type { ApiCancelRequest, ApiOrderDetail, ApiOrderSummary, Page } from "@/types/api"; // 기존 타입을 읽기만 한다

// 목록 응답 모양({ items, total, page, size, totalPages })은 기존 Page<T>를 그대로 다시 내보낸다.
export type { Page }; // 관리자 화면은 "@/types/admin" 한 곳에서만 타입을 가져다 쓰게 한다.

// 주문 상태 6종 — 서버(orders.status)와 똑같은 영어 값이다.
export type AdminOrderStatus = "paid" | "preparing" | "shipping" | "delivered" | "cancel_requested" | "cancelled";

// 취소 요청 상태 3종 — 서버(cancel_requests.status)와 똑같은 영어 값이다.
export type AdminCancelStatus = "requested" | "approved" | "rejected";

// 관리자 주문 목록의 한 줄 = 손님 주문 요약 + 주문자 정보
export interface AdminOrderSummary extends ApiOrderSummary {
  status: AdminOrderStatus; // 문자열 대신 6종 중 하나로 좁힌다
  userNickname: string; // 주문자 닉네임
  userEmail: string; // 주문자 이메일 (관리자 화면에서만 보인다)
}

// 관리자 주문 상세 = 손님 주문 상세 + 주문자 정보 (받는 사람·주소는 여기서만 보인다)
export interface AdminOrderDetail extends ApiOrderDetail {
  status: AdminOrderStatus; // 6종 중 하나
  userNickname: string; // 주문자 닉네임
  userEmail: string; // 주문자 이메일
  itemsPrice?: number; // 상품 합계 (성용님의 DB 변경이 머지된 뒤에 생긴다)
  shippingFee?: number; // 배송비 (위와 같다)
}

// 관리자 취소 요청 한 장 = 손님 취소 요청 + 주문자 닉네임·주문 금액
export interface AdminCancelRequest extends ApiCancelRequest {
  status: AdminCancelStatus; // 3종 중 하나
  userNickname: string; // 주문자 닉네임
  totalPrice: number; // 주문 금액(원)
}

// 주문 목록을 부를 때 보내는 조건 (주소창 ?status=&q=&page= 와 같은 이름)
export interface AdminOrderQuery {
  status?: AdminOrderStatus; // 상태 필터 (없으면 전체)
  q?: string; // 주문번호·닉네임 검색어
  page?: number; // 몇 쪽 (1부터)
}

// 취소 요청 목록을 부를 때 보내는 조건
export interface AdminCancelQuery {
  status?: AdminCancelStatus; // 상태 필터 (없으면 전체)
  page?: number; // 몇 쪽 (1부터)
}