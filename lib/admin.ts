// 진짜 서버 호출 도구(api)를 가져와요. get = 조회, post = 처리 요청이에요.
import { api } from "@/lib/api";
// 가짜 서버(mock) 함수들을 한꺼번에 가져와요. mock.orders(), mock.advanceOrder() 처럼 써요.
import * as mock from "@/mocks/admin";
// 우리가 만든 타입들을 가져와요. (type만 가져오니 실행 코드에는 안 들어가요)
import type {
  AdminCancelCounts,
  AdminCancelQuery,
  AdminCancelRequest,
  AdminCancelStatus,
  AdminOrderCounts,
  AdminOrderDetail,
  AdminOrderQuery,
  AdminOrderStatus,
  AdminOrderSummary,
  Page,
} from "@/types/admin";

// 스위치예요. true = 가짜 서버, false = 진짜 서버. 주문·취소 요청 API가 머지되어 false로 바꿨어요.
const USE_MOCK = false;

// 주문 건수가 바뀌었을 수도 있다고 알리는 이벤트 이름이에요 (사이드바 배지가 이 소식을 듣고 다시 불러와요).
const COUNTS_CHANGED_EVENT = "admin-order-counts-changed";

// 건수가 바뀌었을 때 이 함수를 불러서 이벤트를 쏴요.
function notifyAdminOrderCountsChanged(): void {
  window.dispatchEvent(new Event(COUNTS_CHANGED_EVENT));
}

// 건수 변경 소식을 듣고 싶은 쪽(AdminNav 등)이 이 함수로 구독해요. 반환값을 부르면 구독을 끊어요.
export function onAdminOrderCountsChanged(listener: () => void): () => void {
  window.addEventListener(COUNTS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(COUNTS_CHANGED_EVENT, listener);
}

// 값이 비어 있는 항목을 빼고 "?status=paid&page=2" 같은 주소 꼬리를 만들어 주는 도우미예요.
function toQuery(params: Record<string, string | number | undefined>): string {
  // 쿼리 문자열을 만드는 브라우저 기본 도구예요.
  const search = new URLSearchParams();
  // 항목을 하나씩 살펴봐요.
  for (const [key, value] of Object.entries(params)) {
    // 값이 없거나 빈 문자열이면 건너뛰어요.
    if (value === undefined || value === "") continue;
    // 값이 있으면 문자열로 바꿔서 추가해요.
    search.set(key, String(value));
  }
  // 완성된 문자열을 꺼내요. 예: "status=paid&page=2"
  const text = search.toString();
  // 내용이 있으면 앞에 ?를 붙이고, 없으면 빈 문자열을 돌려줘요.
  return text ? `?${text}` : "";
}

// 주문 목록 (상태 필터, 검색어, 페이지, 쪽당 건수)
export function getAdminOrders(query: AdminOrderQuery = {}): Promise<Page<AdminOrderSummary>> {
  // 스위치가 켜져 있으면 가짜 서버를 불러요.
  if (USE_MOCK) return mock.orders(query);
  // 꺼져 있으면 진짜 서버에 GET 요청을 보내요.
  return api.get(`/admin/orders${toQuery({ ...query })}`);
}

// 주문 상세 (주문 번호 하나)
export function getAdminOrder(id: number): Promise<AdminOrderDetail> {
  if (USE_MOCK) return mock.orderDetail(id);
  return api.get(`/admin/orders/${id}`);
}

// 배송 단계 한 칸 넘기기 (결제완료 → 준비중 → 배송중 → 배송완료)
export async function advanceAdminOrder(id: number): Promise<AdminOrderDetail> {
  // 가짜 서버든 진짜 서버든 성공하면 건수가 바뀌니, 어디서 넘겼든(목록/상세) 사이드바 배지에 알려 줘요.
  const detail = USE_MOCK ? await mock.advanceOrder(id) : await api.post<AdminOrderDetail>(`/admin/orders/${id}/advance`);
  notifyAdminOrderCountsChanged();
  return detail;
}

// 카드·탭·메뉴 배지가 함께 쓰는 상태별 건수 — #22에 건수 전용 API가 없어서,
// 진짜 서버 모드에서는 상태마다 size=1로만 불러서 Page.total 값만 가볍게 읽어온다.
export async function getAdminOrderCounts(): Promise<AdminOrderCounts> {
  if (USE_MOCK) return mock.orderCounts();
  const statuses: AdminOrderStatus[] = ["paid", "preparing", "shipping", "delivered", "cancel_requested", "cancelled"];
  const [total, ...perStatus] = await Promise.all([
    api.get<Page<AdminOrderSummary>>(`/admin/orders?size=1`), // 전체 건수
    ...statuses.map((status) => api.get<Page<AdminOrderSummary>>(`/admin/orders${toQuery({ status, size: 1 })}`)),
  ]);
  const [paid, preparing, shipping, delivered, cancelRequested, cancelled] = perStatus.map((page) => page.total);
  return { total: total.total, paid, preparing, shipping, delivered, cancelRequested, cancelled };
}

// 취소 요청 목록 (상태 필터, 페이지)
export function getAdminCancelRequests(query: AdminCancelQuery = {}): Promise<Page<AdminCancelRequest>> {
  if (USE_MOCK) return mock.cancelRequests(query);
  return api.get(`/admin/cancel-requests${toQuery({ ...query })}`);
}

// 취소 요청 승인 (주문 취소 + 재고 복구 + 알림) — 백엔드가 Message만 돌려주므로 성공 여부만 본다
export async function approveAdminCancel(id: number): Promise<void> {
  if (USE_MOCK) await mock.approveCancel(id);
  else await api.post(`/admin/cancel-requests/${id}/approve`);
  notifyAdminOrderCountsChanged(); // 승인되면 주문이 cancel_requested를 벗어나니 사이드바 배지도 다시 불러오게 한다
}

// 취소 요청 거절 (주문이 요청 전 상태로 돌아가요)
export async function rejectAdminCancel(id: number): Promise<void> {
  if (USE_MOCK) await mock.rejectCancel(id);
  else await api.post(`/admin/cancel-requests/${id}/reject`);
  notifyAdminOrderCountsChanged(); // 거절되어도 주문이 cancel_requested를 벗어나니 마찬가지로 알려 준다
}

// 카드·탭이 함께 쓰는 취소 요청 상태별 건수 — #25와 같은 방식으로, 진짜 서버 모드에서는 상태마다 size=1 요청의 total만 읽는다
export async function getAdminCancelCounts(): Promise<AdminCancelCounts> {
  if (USE_MOCK) return mock.cancelCounts();
  const statuses: AdminCancelStatus[] = ["requested", "approved", "rejected"];
  const [total, requested, approved, rejected] = await Promise.all([
    api.get<Page<AdminCancelRequest>>(`/admin/cancel-requests?size=1`),
    ...statuses.map((status) => api.get<Page<AdminCancelRequest>>(`/admin/cancel-requests${toQuery({ status, size: 1 })}`)),
  ]);
  return { total: total.total, requested: requested.total, approved: approved.total, rejected: rejected.total };
}