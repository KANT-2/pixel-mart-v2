// mocks/admin.ts — 백엔드가 완성되기 전에 쓰는 가짜 서버.
// 진짜 서버처럼 잠깐 기다렸다가 답하고, 바꾼 값(배송 단계·취소 처리)은 기억한다.
import { ApiError } from "@/lib/api"; // 서버 오류와 같은 모양의 오류 (메시지, 상태 번호)
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
} from "@/types/admin"; // 관리자 화면 타입
import type { ApiProduct } from "@/types/api"; // 기존 상품 타입

// ---------- 기본 설정 ----------
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms)); // 진짜 서버처럼 0.3초 기다린다
const PAGE_SIZE = 5; // 한 쪽에 5건 (페이지 넘김을 눌러 볼 수 있게 일부러 작게)

// 상태 영어 값 → 화면 글자 (#22 백엔드의 STATUS_LABELS와 같은 글자)
const ORDER_LABEL: Record<AdminOrderStatus, string> = {
  paid: "주문 완료", // 결제 후 첫 상태
  preparing: "상품 준비중", // 준비 시작
  shipping: "배송중", // 배송 시작
  delivered: "배송 완료", // 끝
  cancel_requested: "취소 요청", // 손님이 취소를 신청한 상태
  cancelled: "취소 완료", // 관리자가 취소를 승인한 상태
};
const CANCEL_LABEL: Record<AdminCancelStatus, string> = {
  requested: "취소 요청중", // 대기
  approved: "취소 승인", // 승인됨
  rejected: "취소 거절", // 거절됨
};
const FLOW: AdminOrderStatus[] = ["paid", "preparing", "shipping", "delivered"]; // 한 칸씩만 넘어가는 순서

// ---------- 가짜 상품 ----------
const PRODUCTS: ApiProduct[] = [
  { id: 1, name: "HP 하트 키캡", price: 9900, category: "키캡", categorySlug: "keycap", imageUrl: "/images/products/001-heart-keycap.webp", description: "작은 하트가 주는 큰 만족", isNew: false },
  { id: 3, name: "던전 맵 장패드", price: 24900, category: "데스크매트", categorySlug: "deskmat", imageUrl: "/images/products/003-dungeon-deskmat.webp", description: "책상 위, 새로운 모험의 시작", isNew: true },
  { id: 5, name: "슬라임 아크릴 키링", price: 7900, category: "굿즈", categorySlug: "goods", imageUrl: "/images/products/005-slime-keyring.webp", description: "말랑해 보이는 슬라임 키링", isNew: false },
  { id: 7, name: "보물상자 소품함", price: 12900, category: "데스크 소품", categorySlug: "desk", imageUrl: "/images/products/007-treasure-box.webp", description: "작은 소품을 담는 보물상자", isNew: false },
];
const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product])); // 번호로 상품 찾기

function productOf(id: number): ApiProduct {
  const product = PRODUCT_BY_ID.get(id); // 번호로 찾는다
  if (!product) throw new Error(`가짜 상품 ${id}번이 없어요`); // 가짜 데이터 실수를 바로 알아채게
  return product; // 찾은 상품
}

// ---------- 가짜 주문 ----------
interface MockLine { productId: number; quantity: number } // 주문 한 줄 = 상품 번호 + 수량
interface MockStep { status: AdminOrderStatus; changedAt: string } // 상태 기록 한 줄
interface MockOrder {
  id: number; // 주문번호
  buyerNickname: string; // 주문자 닉네임 (#22 응답 필드 이름과 맞춘다)
  buyerEmail: string; // 주문자 이메일
  recipientName: string; // 받는 사람
  address: string; // 받는 주소
  lines: MockLine[]; // 주문한 상품들
  history: MockStep[]; // 상태 기록 (맨 마지막이 지금 상태)
}

// 시작 시각부터 1시간 간격으로 상태 기록을 만든다
function history(start: string, ...statuses: AdminOrderStatus[]): MockStep[] {
  const base = new Date(start).getTime(); // 시작 시각(밀리초)
  return statuses.map((status, index) => ({ status, changedAt: new Date(base + index * 3_600_000).toISOString() }));
}

// 14건 — 6개 상태를 골고루 섞고, 닉네임 몇 개는 여러 주문에 재사용해서 검색을 테스트할 수 있게 한다
const ORDERS: MockOrder[] = [
  { id: 1045, buyerNickname: "픽셀곰", buyerEmail: "pixelbear@pixelmart.test", recipientName: "김하늘", address: "서울시 마포구 연남로 12", lines: [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }], history: history("2026-10-25T01:10:00Z", "paid") },
  { id: 1044, buyerNickname: "슬라임킹", buyerEmail: "slimeking@pixelmart.test", recipientName: "이도윤", address: "경기도 성남시 분당구 판교로 5", lines: [{ productId: 5, quantity: 1 }], history: history("2026-10-25T00:40:00Z", "paid") },
  { id: 1043, buyerNickname: "코인수집가", buyerEmail: "coinmoa@pixelmart.test", recipientName: "박서연", address: "부산시 해운대구 센텀로 77", lines: [{ productId: 7, quantity: 1 }, { productId: 1, quantity: 1 }], history: history("2026-10-24T23:15:00Z", "paid") },
  { id: 1042, buyerNickname: "픽셀곰", buyerEmail: "pixelbear@pixelmart.test", recipientName: "김하늘", address: "서울시 마포구 연남로 12", lines: [{ productId: 1, quantity: 1 }], history: history("2026-10-24T20:00:00Z", "paid") },
  { id: 1041, buyerNickname: "던전마스터", buyerEmail: "dungeon@pixelmart.test", recipientName: "최민준", address: "대전시 유성구 대학로 99", lines: [{ productId: 3, quantity: 1 }], history: history("2026-10-23T09:00:00Z", "paid", "preparing") },
  { id: 1040, buyerNickname: "레트로덕", buyerEmail: "retroduck@pixelmart.test", recipientName: "정유진", address: "인천시 연수구 송도로 3", lines: [{ productId: 1, quantity: 1 }, { productId: 5, quantity: 2 }], history: history("2026-10-23T08:00:00Z", "paid", "preparing") },
  { id: 1039, buyerNickname: "키캡장인", buyerEmail: "keycraft@pixelmart.test", recipientName: "한지호", address: "광주시 북구 첨단로 20", lines: [{ productId: 1, quantity: 3 }], history: history("2026-10-22T14:00:00Z", "paid", "preparing") },
  { id: 1038, buyerNickname: "하트러버", buyerEmail: "heartlover@pixelmart.test", recipientName: "오수빈", address: "대구시 수성구 달구벌대로 8", lines: [{ productId: 7, quantity: 2 }], history: history("2026-10-22T10:00:00Z", "paid", "preparing", "shipping") },
  { id: 1037, buyerNickname: "별빛냥", buyerEmail: "starcat@pixelmart.test", recipientName: "윤채원", address: "울산시 남구 삼산로 41", lines: [{ productId: 5, quantity: 1 }], history: history("2026-10-22T07:30:00Z", "paid", "preparing", "shipping") },
  { id: 1036, buyerNickname: "모험가K", buyerEmail: "adventurek@pixelmart.test", recipientName: "강태양", address: "서울시 송파구 올림픽로 300", lines: [{ productId: 3, quantity: 1 }, { productId: 7, quantity: 1 }], history: history("2026-10-21T09:00:00Z", "paid", "preparing", "shipping") },
  { id: 1035, buyerNickname: "슬라임킹", buyerEmail: "slimeking@pixelmart.test", recipientName: "이도윤", address: "경기도 성남시 분당구 판교로 5", lines: [{ productId: 1, quantity: 1 }], history: history("2026-10-20T09:00:00Z", "paid", "preparing", "shipping", "delivered") },
  { id: 1034, buyerNickname: "도토리", buyerEmail: "acorn@pixelmart.test", recipientName: "서은우", address: "제주시 노형로 14", lines: [{ productId: 3, quantity: 1 }, { productId: 7, quantity: 1 }], history: history("2026-10-19T09:00:00Z", "paid", "preparing", "shipping", "delivered") },
  { id: 1033, buyerNickname: "픽셀토끼", buyerEmail: "pixelrabbit@pixelmart.test", recipientName: "임가은", address: "수원시 영통구 광교로 55", lines: [{ productId: 1, quantity: 2 }], history: history("2026-10-24T08:00:00Z", "paid", "preparing", "cancel_requested") },
  { id: 1032, buyerNickname: "네온고양이", buyerEmail: "neoncat@pixelmart.test", recipientName: "조현우", address: "전주시 덕진구 기린대로 9", lines: [{ productId: 5, quantity: 1 }], history: history("2026-10-18T09:00:00Z", "paid", "cancel_requested", "cancelled") },
  // 1046~1049는 취소 요청 화면(#26) 전용 — 대기 중 2건, 승인 1건, 거절 1건을 더 채운다 (위 14건 분포는 그대로 둔다)
  { id: 1049, buyerNickname: "별자리술사", buyerEmail: "starmage@pixelmart.test", recipientName: "백도현", address: "청주시 흥덕구 사직대로 2", lines: [{ productId: 1, quantity: 1 }], history: history("2026-10-23T11:00:00Z", "paid", "preparing", "cancel_requested", "preparing") },
  { id: 1048, buyerNickname: "구름여행자", buyerEmail: "cloudtrip@pixelmart.test", recipientName: "민서아", address: "강릉시 교동로 6", lines: [{ productId: 3, quantity: 1 }], history: history("2026-10-22T13:00:00Z", "paid", "cancel_requested", "cancelled") },
  { id: 1047, buyerNickname: "달빛나비", buyerEmail: "moonmoth@pixelmart.test", recipientName: "정하람", address: "창원시 성산구 중앙대로 30", lines: [{ productId: 7, quantity: 1 }], history: history("2026-10-25T15:00:00Z", "paid", "cancel_requested") },
  { id: 1046, buyerNickname: "은빛여우", buyerEmail: "silverfox@pixelmart.test", recipientName: "강지우", address: "포항시 북구 중앙로 18", lines: [{ productId: 5, quantity: 2 }], history: history("2026-10-25T18:00:00Z", "paid", "cancel_requested") },
];

// ---------- 가짜 취소 요청 ----------
interface MockCancel {
  id: number; // 취소 요청 번호
  orderId: number; // 어느 주문의 취소인지
  reason: string; // 취소 사유
  status: AdminCancelStatus; // 지금 상태
  createdAt: string; // 요청 시각
  prevStatus: AdminOrderStatus; // 취소를 신청하기 직전 주문 상태 (거절하면 여기로 돌아간다)
}
const CANCELS: MockCancel[] = [
  { id: 2, orderId: 1033, reason: "색상이 마음에 안 들어서 취소하고 싶어요.", status: "requested", createdAt: "2026-10-24T09:00:00Z", prevStatus: "preparing" },
  { id: 1, orderId: 1032, reason: "실수로 주문했어요.", status: "approved", createdAt: "2026-10-18T10:00:00Z", prevStatus: "paid" },
  { id: 3, orderId: 1046, reason: "다른 색상으로 다시 주문하고 싶어요.", status: "requested", createdAt: "2026-10-25T18:30:00Z", prevStatus: "paid" },
  { id: 4, orderId: 1047, reason: "배송이 너무 늦어질 것 같아요.", status: "requested", createdAt: "2026-10-25T15:30:00Z", prevStatus: "paid" },
  { id: 5, orderId: 1048, reason: "주소를 잘못 입력했어요.", status: "approved", createdAt: "2026-10-22T13:30:00Z", prevStatus: "paid" },
  { id: 6, orderId: 1049, reason: "변심으로 취소를 요청했다가 다시 받기로 했어요.", status: "rejected", createdAt: "2026-10-23T11:30:00Z", prevStatus: "preparing" },
];

// ---------- 도우미 ----------
const statusOf = (order: MockOrder): AdminOrderStatus => order.history[order.history.length - 1].status; // 지금 상태
const totalPriceOf = (order: MockOrder) => order.lines.reduce((sum, line) => sum + productOf(line.productId).price * line.quantity, 0); // 상품 합계 = 주문 금액

function paginate<T>(rows: T[], page = 1, size = PAGE_SIZE): Page<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / size)); // 전체 쪽 수
  const current = Math.min(Math.max(1, page), totalPages); // 범위 밖 쪽 번호는 끝으로 맞춘다
  return { items: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, size, totalPages };
}

// 검색어가 error면 일부러 실패시킨다 (화면의 "실패" 상태를 확인하기 위해)
function failIfError(q?: string) {
  if (q?.trim().toLowerCase() === "error") throw new ApiError("불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 500);
}

function findOrder(id: number): MockOrder {
  const order = ORDERS.find((item) => item.id === id); // 번호로 찾는다
  if (!order) throw new ApiError("주문을 찾을 수 없어요.", 404); // 없는 주문
  return order;
}

function findCancel(id: number): MockCancel {
  const cancel = CANCELS.find((item) => item.id === id); // 번호로 찾는다
  if (!cancel) throw new ApiError("요청을 찾을 수 없어요.", 404); // 없는 요청
  return cancel;
}

function toSummary(order: MockOrder): AdminOrderSummary {
  const first = productOf(order.lines[0].productId); // 대표 상품 (첫 번째)
  const status = statusOf(order); // 지금 상태
  return {
    id: order.id,
    status,
    statusLabel: ORDER_LABEL[status],
    buyerNickname: order.buyerNickname,
    buyerEmail: order.buyerEmail,
    title: order.lines.length > 1 ? `${first.name} 외 ${order.lines.length - 1}개` : first.name, // "하트 키캡 외 1개"
    totalPrice: totalPriceOf(order),
    createdAt: order.history[0].changedAt, // 주문한 시각 = 첫 기록
  };
}

function toDetail(order: MockOrder): AdminOrderDetail {
  return {
    ...toSummary(order),
    recipientName: order.recipientName,
    address: order.address,
    items: order.lines.map((line) => {
      const product = productOf(line.productId); // 상품 정보
      return { productName: product.name, quantity: line.quantity, unitPrice: product.price };
    }),
    timeline: order.history.map((step) => ({ status: step.status, label: ORDER_LABEL[step.status], changedAt: step.changedAt })),
  };
}

function toCancel(cancel: MockCancel): AdminCancelRequest {
  const order = findOrder(cancel.orderId); // 연결된 주문
  return {
    id: cancel.id,
    orderId: cancel.orderId,
    reason: cancel.reason,
    status: cancel.status,
    statusLabel: CANCEL_LABEL[cancel.status],
    createdAt: cancel.createdAt,
    orderStatus: statusOf(order), // 연결된 주문의 지금 상태 (#23 응답과 같은 필드)
    buyerNickname: order.buyerNickname,
    totalPrice: totalPriceOf(order),
  };
}

// ---------- 화면이 부르는 함수들 (lib/admin.ts가 연결한다) ----------
export async function orders(q: AdminOrderQuery = {}): Promise<Page<AdminOrderSummary>> {
  await wait(); // 서버처럼 기다린다
  failIfError(q.q); // error 검색이면 일부러 실패
  const keyword = q.q?.trim().toLowerCase(); // 검색어 (소문자, 양 끝 공백 제거)
  const isOrderNo = !!keyword && /^\d+$/.test(keyword); // 숫자만 입력하면 주문번호로 본다
  const rows = ORDERS.filter((order) => !q.status || statusOf(order) === q.status) // 상태 필터
    .filter((order) => {
      if (!keyword) return true; // 검색어가 없으면 전부 통과
      if (isOrderNo) return order.id === Number(keyword); // 숫자면 주문번호와 정확히 같을 때만
      return order.buyerNickname.toLowerCase().includes(keyword) || order.buyerEmail.toLowerCase().includes(keyword); // 닉네임·이메일 부분 일치
    })
    .sort((a, b) => b.id - a.id) // 최신 주문이 위로
    .map(toSummary); // 목록용 모양으로 바꾼다
  return paginate(rows, q.page, q.size); // 쪽 나누기
}

export async function orderDetail(id: number): Promise<AdminOrderDetail> {
  await wait();
  return toDetail(findOrder(id)); // 없으면 404
}

export async function advanceOrder(id: number): Promise<AdminOrderDetail> {
  await wait();
  const order = findOrder(id); // 없으면 404
  const index = FLOW.indexOf(statusOf(order)); // 지금 상태가 순서의 몇 번째인지 (순서에 없으면 -1)
  if (index === -1 || index === FLOW.length - 1) throw new ApiError("더 넘길 수 없는 상태예요.", 409); // 끝이거나 취소 흐름이면 거부
  order.history.push({ status: FLOW[index + 1], changedAt: new Date().toISOString() }); // 한 칸 앞으로 + 기록 한 줄
  return toDetail(order);
}

// 카드·탭·메뉴 배지가 함께 쓰는 상태별 건수 — 전체 주문을 한 번 돌며 센다
export async function orderCounts(): Promise<AdminOrderCounts> {
  await wait();
  const counts: AdminOrderCounts = { total: ORDERS.length, paid: 0, preparing: 0, shipping: 0, delivered: 0, cancelRequested: 0, cancelled: 0 };
  for (const order of ORDERS) {
    const status = statusOf(order); // 이 주문의 지금 상태
    if (status === "cancel_requested") counts.cancelRequested += 1; // 쿼리 값(cancel_requested)과 필드 이름(camelCase)이 달라서 따로 처리
    else counts[status] += 1; // 나머지는 상태 이름 그대로 키로 쓴다
  }
  return counts;
}

export async function cancelRequests(q: AdminCancelQuery = {}): Promise<Page<AdminCancelRequest>> {
  await wait();
  const rows = CANCELS.filter((cancel) => !q.status || cancel.status === q.status) // 상태 필터
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // 최근 요청이 위로
    .map(toCancel); // 화면용 모양으로 바꾼다
  return paginate(rows, q.page, q.size);
}

// 카드·탭이 함께 쓰는 취소 요청 상태별 건수 — 전체를 한 번 돌며 센다
export async function cancelCounts(): Promise<AdminCancelCounts> {
  await wait();
  const counts: AdminCancelCounts = { total: CANCELS.length, requested: 0, approved: 0, rejected: 0 };
  for (const cancel of CANCELS) counts[cancel.status] += 1;
  return counts;
}

// 승인·거절은 실제 백엔드(#23)도 Message만 돌려주므로, 여기서도 반환값 없이 끝낸다
export async function approveCancel(id: number): Promise<void> {
  await wait();
  const cancel = findCancel(id); // 없으면 404
  if (cancel.status !== "requested") throw new ApiError("이미 처리된 요청이에요.", 409); // 두 번 처리 금지
  cancel.status = "approved"; // 요청을 승인으로
  findOrder(cancel.orderId).history.push({ status: "cancelled", changedAt: new Date().toISOString() }); // 주문은 취소 완료로
}

export async function rejectCancel(id: number): Promise<void> {
  await wait();
  const cancel = findCancel(id); // 없으면 404
  if (cancel.status !== "requested") throw new ApiError("이미 처리된 요청이에요.", 409); // 두 번 처리 금지
  cancel.status = "rejected"; // 요청을 거절로
  findOrder(cancel.orderId).history.push({ status: cancel.prevStatus, changedAt: new Date().toISOString() }); // 주문은 신청 직전 상태로 돌아간다
}
