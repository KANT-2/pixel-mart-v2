// types/admin.ts — 관리자 화면 전용 타입. 공용 types/api.ts는 고치지 않고 가져다 쓰기만 한다.
import type { Page } from "@/types/api"; // 기존 타입을 읽기만 한다
import type { Rarity } from "@/utils/gameItem"; // 등급 값 — 기존 유틸 타입을 그대로 쓴다

// 목록 응답 모양({ items, total, page, size, totalPages })은 기존 Page<T>를 그대로 다시 내보낸다.
export type { Page }; // 관리자 화면은 "@/types/admin" 한 곳에서만 타입을 가져다 쓰게 한다.

// 주문 상태 6종 — 서버(orders.status)와 똑같은 영어 값이다.
export type AdminOrderStatus = "paid" | "preparing" | "shipping" | "delivered" | "cancel_requested" | "cancelled";

// 취소 요청 상태 3종 — 서버(cancel_requests.status)와 똑같은 영어 값이다.
export type AdminCancelStatus = "requested" | "approved" | "rejected";

// 관리자 주문 목록의 한 줄 — #22 백엔드 응답과 이름을 똑같이 맞춘다 (손님용 ApiOrderSummary와는 모양이 달라서 따로 정의한다)
export interface AdminOrderSummary {
  id: number; // 주문번호
  status: AdminOrderStatus; // 6종 중 하나
  statusLabel: string; // 화면에 그대로 쓰는 한글 상태 글자 (API가 주는 값)
  buyerNickname: string; // 주문자 닉네임
  buyerEmail: string; // 주문자 이메일 (관리자 화면에서만 보인다)
  title: string; // "하트 키캡 외 1개" 같은 한 줄 상품 요약
  totalPrice: number; // 주문 금액(원)
  createdAt: string; // 주문한 시각
}

// 주문 상품 한 줄 (관리자 상세용 — 상품 객체 대신 이름만 온다)
export interface AdminOrderItem {
  productName: string; // 상품 이름
  quantity: number; // 수량
  unitPrice: number; // 낱개 가격(원)
}

// 상태가 바뀐 기록 한 줄
export interface AdminOrderTimelineEntry {
  status: AdminOrderStatus; // 그때의 상태
  label: string; // 그때의 한글 상태 글자
  changedAt: string; // 바뀐 시각
}

// 관리자 주문 상세 = 목록 한 줄 + 받는 사람·주소·상품 목록·상태 기록
export interface AdminOrderDetail extends AdminOrderSummary {
  recipientName: string; // 받는 사람 이름
  address: string; // 받는 주소
  items: AdminOrderItem[]; // 주문한 상품들
  timeline: AdminOrderTimelineEntry[]; // 상태 기록 (맨 마지막이 지금 상태)
}

// 카드·탭·메뉴 배지가 함께 쓰는 상태별 건수
export interface AdminOrderCounts {
  total: number; // 전체 건수
  paid: number; // 결제완료
  preparing: number; // 상품 준비중
  shipping: number; // 배송중
  delivered: number; // 배송 완료
  cancelRequested: number; // 취소 요청
  cancelled: number; // 취소됨
}

// 관리자 취소 요청 한 장 — #23 백엔드 응답(AdminCancelRequestOut)과 이름을 똑같이 맞춘다
export interface AdminCancelRequest {
  id: number; // 취소 요청 번호
  orderId: number; // 연결된 주문번호
  reason: string; // 취소 사유
  status: AdminCancelStatus; // 3종 중 하나
  statusLabel: string; // 화면에 그대로 쓰는 한글 상태 글자 (API가 주는 값)
  createdAt: string; // 요청 시각
  orderStatus: AdminOrderStatus; // 연결된 주문의 지금 상태
  buyerNickname: string; // 주문자 닉네임
  totalPrice: number; // 주문 금액(원)
}

// 카드·탭에서 쓰는 취소 요청 상태별 건수 (사이드바 배지는 AdminOrderCounts.cancelRequested를 그대로 쓴다)
export interface AdminCancelCounts {
  total: number; // 전체 건수
  requested: number; // 대기 중
  approved: number; // 승인
  rejected: number; // 거절
}

// 주문 목록을 부를 때 보내는 조건 (주소창 ?status=&q=&page= 와 같은 이름)
export interface AdminOrderQuery {
  status?: AdminOrderStatus; // 상태 필터 (없으면 전체)
  q?: string; // 주문번호·닉네임·이메일 검색어
  page?: number; // 몇 쪽 (1부터)
  size?: number; // 한 쪽에 몇 건 (기본 5건)
}

// 취소 요청 목록을 부를 때 보내는 조건
export interface AdminCancelQuery {
  status?: AdminCancelStatus; // 상태 필터 (없으면 전체)
  page?: number; // 몇 쪽 (1부터)
  size?: number; // 한 쪽에 몇 건 (기본 5건)
}

// 주문 단계별 현황 막대가 쓰는 상태 6종 건수 — #113 백엔드 응답과 이름을 똑같이 맞춘다
export interface AdminOrderStatusCounts {
  paid: number; // 주문 완료
  preparing: number; // 상품 준비중
  shipping: number; // 배송중
  delivered: number; // 배송 완료
  cancelRequested: number; // 취소 요청
  cancelled: number; // 취소 완료
}

// 재고 부족 목록 한 줄 — rarity는 utils/gameItem.ts의 Rarity와 같은 값(common/rare/epic/unique)
export interface AdminLowStockProduct {
  id: number; // 상품 번호
  name: string; // 상품 이름
  rarity: string; // 등급
  stock: number; // 남은 재고
}

// 대시보드 숫자 카드 4개 + 주문 단계별 현황 + 재고 부족 목록 — #98·#113 백엔드 응답(AdminSummaryOut)과 이름을 똑같이 맞춘다
export interface AdminSummary {
  ordersToday: number; // 오늘 들어온 주문 수 (상태 무관, 취소 포함)
  preparingOrders: number; // 배송 준비중(preparing) 주문 수
  pendingCancelRequests: number; // 취소 요청 대기(requested) 수
  unansweredQuestions: number; // 미답변 문의 수
  orderStatusCounts: AdminOrderStatusCounts; // 주문 상태 6종 건수
  lowStockProducts: AdminLowStockProduct[]; // 재고 10개 이하 상품(숨김 제외, 재고순 최대 20개)
}

// 관리자 상품 목록·폼의 한 줄 — #93/#94 백엔드 응답(AdminProductOut)과 이름을 똑같이 맞춘다
export interface AdminProduct {
  id: number;
  name: string;
  price: number;
  category: string; // 분류 이름(한글)
  categorySlug: string;
  imageUrl: string;
  description: string;
  isNew: boolean;
  stock: number;
  rarity: Rarity;
  isHidden: boolean;
}

// 상품 목록을 부를 때 보내는 조건 (주소창 ?q=&status=&rarity=&soldOut= 와 같은 이름)
export interface AdminProductQuery {
  q?: string; // 상품명 검색어
  category?: string; // categorySlug
  rarity?: Rarity;
  hidden?: boolean; // true=숨김만, false=노출만, 없음=전체
  soldOut?: boolean; // true면 품절(재고 0)만
  page?: number;
  size?: number;
}

// 상품 등록 입력 — 서버 ProductCreateIn과 이름을 맞춘다
export interface ProductCreateInput {
  name: string;
  price: number;
  categorySlug: string;
  description: string;
  imageUrl: string;
  isNew?: boolean;
  stock: number; // 등록 시에는 "초기 재고" 그대로
  rarity: Rarity;
}

// 상품 수정 입력(PATCH) — 보낸 필드만 반영된다.
// stock을 보내면 현재 재고에 "더해지고"(덮어쓰기 아님), stockSet을 보내면 그 값으로 "절대 설정"된다(#125).
// 서버가 stock·stockSet을 함께 보내면 422로 거부하므로 둘 중 하나만 넣어야 한다.
export interface ProductUpdateInput {
  name?: string;
  price?: number;
  categorySlug?: string;
  description?: string;
  imageUrl?: string;
  isNew?: boolean;
  stock?: number;
  stockSet?: number;
  rarity?: Rarity;
  isHidden?: boolean;
}
