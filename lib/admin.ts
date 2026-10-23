// 진짜 서버 호출 도구(api)를 가져와요. get = 조회, post = 처리 요청이에요.
import { api } from "@/lib/api";
// 가짜 서버(mock) 함수들을 한꺼번에 가져와요. mock.orders(), mock.advanceOrder() 처럼 써요.
import * as mock from "@/mocks/admin";
// 우리가 만든 타입들을 가져와요. (type만 가져오니 실행 코드에는 안 들어가요)
import type {
  AdminCancelQuery,
  AdminCancelRequest,
  AdminOrderDetail,
  AdminOrderQuery,
  AdminOrderSummary,
  Page,
} from "@/types/admin";

// 스위치예요. true = 가짜 서버, false = 진짜 서버. 백엔드가 완성되면 false로 바꿔요.
const USE_MOCK = true;

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

// 화면은 이 admin 객체의 함수만 불러요. mock인지 진짜인지는 화면이 몰라도 돼요.
export const admin = {
  // 주문 목록 (상태 필터, 검색어, 페이지)
  orders(query: AdminOrderQuery = {}): Promise<Page<AdminOrderSummary>> {
    // 스위치가 켜져 있으면 가짜 서버를 불러요.
    if (USE_MOCK) return mock.orders(query);
    // 꺼져 있으면 진짜 서버에 GET 요청을 보내요.
    return api.get(`/admin/orders${toQuery({ ...query })}`);
  },

  // 주문 상세 (주문 번호 하나)
  orderDetail(id: number): Promise<AdminOrderDetail> {
    if (USE_MOCK) return mock.orderDetail(id);
    return api.get(`/admin/orders/${id}`);
  },

  // 배송 단계 한 칸 넘기기 (결제완료 → 준비중 → 배송중 → 배송완료)
  advanceOrder(id: number): Promise<AdminOrderDetail> {
    if (USE_MOCK) return mock.advanceOrder(id);
    // 상태를 바꾸는 일이라 POST를 써요.
    return api.post(`/admin/orders/${id}/advance`);
  },

  // 취소 요청 목록 (상태 필터, 페이지)
  cancelRequests(query: AdminCancelQuery = {}): Promise<Page<AdminCancelRequest>> {
    if (USE_MOCK) return mock.cancelRequests(query);
    return api.get(`/admin/cancel-requests${toQuery({ ...query })}`);
  },

  // 취소 요청 승인 (주문 취소 + 재고 복구 + 알림)
  approveCancel(id: number): Promise<AdminCancelRequest> {
    if (USE_MOCK) return mock.approveCancel(id);
    return api.post(`/admin/cancel-requests/${id}/approve`);
  },

  // 취소 요청 거절 (주문이 요청 전 상태로 돌아가요)
  rejectCancel(id: number): Promise<AdminCancelRequest> {
    if (USE_MOCK) return mock.rejectCancel(id);
    return api.post(`/admin/cancel-requests/${id}/reject`);
  },
};