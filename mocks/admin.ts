// mocks/admin.ts — 백엔드가 완성되기 전에 쓰는 가짜 서버.
// 진짜 서버처럼 잠깐 기다렸다가 답하고, 바꾼 값(배송 단계·취소 처리)은 기억한다.
import { ApiError } from "@/lib/api"; // 서버 오류와 같은 모양의 오류 (메시지, 상태 번호)
import type {
  AdminCancelQuery,
  AdminCancelRequest,
  AdminCancelStatus,
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

// 상태 영어 값 → 화면 글자 (손님 화면과 같은 글자)
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
  userNickname: string; // 주문자 닉네임
  userEmail: string; // 주문자 이메일
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

const ORDERS: MockOrder[] = [
  { id: 1042, userNickname: "픽셀곰", userEmail: "pixelbear@pixelmart.test", recipientName: "김하늘", address: "서울시 마포구 연남로 12", lines: [{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }], history: history("2026-10-24T01:10:00Z", "paid") },
  { id: 1041, userNickname: "슬라임킹", userEmail: "slimeking@pixelmart.test", recipientName: "이도윤", address: "경기도 성남시 분당구 판교로 5", lines: [{ productId: 5, quantity: 1 }], history: history("2026-10-24T00:40:00Z", "paid") },
  { id: 1040, userNickname: "코인수집가", userEmail: "coinmoa@pixelmart.test", recipientName: "박서연", address: "부산시 해운대구 센텀로 77", lines: [{ productId: 7, quantity: 1 }, { productId: 1, quantity: 1 }], history: history("2026-10-23T23:15:00Z", "paid") },
  { id: 1039, userNickname: "던전마스터", userEmail: "dungeon@pixelmart.test", recipientName: "최민준", address: "대전시 유성구 대학로 99", lines: [{ productId: 3, quantity: 1 }], history: history("2026-10-23T09:00:00Z", "paid", "preparing") },
  { id: 1038, userNickname: "레트로덕", userEmail: "retroduck@pixelmart.test", recipientName: "정유진", address: "인천시 연수구 송도로 3", lines: [{ productId: 1, quantity: 1 }, { productId: 5, quantity: 2 }], history: history("2026-10-23T08:00:00Z", "paid", "preparing", "cancel_requested") },
  { id: 1037, userNickname: "키캡장인", userEmail: "keycraft@pixelmart.test", recipientName: "한지호", address: "광주시 북구 첨단로 20", lines: [{ productId: 1, quantity: 3 }], history: history("2026-10-22T14:00:00Z", "paid", "preparing") },
  { id: 1036, userNickname: "하트러버", userEmail: "heartlover@pixelmart.test", recipientName: "오수빈", address: "대구시 수성구 달구벌대로 8", lines: [{ productId: 7, quantity: 2 }], history: history("2026-10-22T10:00:00Z", "paid", "preparing", "shipping") },
  { id: 1035, userNickname: "별빛냥", userEmail: "starcat@pixelmart.test", recipientName: "윤채원", address: "울산시 남구 삼산로 41", lines: [{ productId: 5, quantity: 1 }], history: history("2026-10-22T07:30:00Z", "paid", "cancel_requested") },
  { id: 1034, userNickname: "모험가K", userEmail: "adventurek@pixelmart.test", recipientName: "강태양", address: "서울시 송파구 올림픽로 300", lines: [{ productId: 3, quantity: 1 }, { productId: 7, quantity: 1 }], history: history("2026-10-20T09:00:00Z", "paid", "preparing", "shipping", "delivered") },
  { id: 1033, userNickname: "도토리", userEmail: "acorn@pixelmart.test", recipientName: "서은우", address: "제주시 노형로 14", lines: [{ productId: 1, quantity: 1 }], history: history("2026-10-20T06:00:00Z", "paid", "cancel_requested", "cancelled") },
  { id: 1032, userNickname: "픽셀토끼", userEmail: "pixelrabbit@pixelmart.test", recipientName: "임가은", address: "수원시 영통구 광교로 55", lines: [{ productId: 3, quantity: 2 }], history: history("2026-10-19T12:00:00Z", "paid", "preparing", "cancel_requested", "preparing") },
  { id: 1031, userNickname: "네온고양이", userEmail: "neoncat@pixelmart.test", recipientName: "조현우", address: "전주시 덕진구 기린대로 9", lines: [{ productId: 1, quantity: 2 }], history: history("2026-10-18T09:00:00Z", "paid", "preparing", "shipping", "delivered") },
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
  { id: 4, orderId: 1038, reason: "색상이 마음에 안 들어서 취소하고 싶어요.", status: "requested", createdAt: "2026-10-23T10:00:00Z", prevStatus: "preparing" },
  { id: 3, orderId: 1035, reason: "실수로 주문했어요.", status: "requested", createdAt: "2026-10-22T08:00:00Z", prevStatus: "paid" },
  { id: 2, orderId: 1033, reason: "배송지를 잘못 입력했어요.", status: "approved", createdAt: "2026-10-20T07:00:00Z", prevStatus: "paid" },
  { id: 1, orderId: 1032, reason: "단순 변심이에요.", status: "rejected", createdAt: "2026-10-19T14:00:00Z", prevStatus: "preparing" },
];

// ---------- 도우미 ----------
const statusOf = (order: MockOrder): AdminOrderStatus => order.history[order.history.length - 1].status; // 지금 상태

function totals(order: MockOrder) {
  const itemsPrice = order.lines.reduce((sum, line) => sum + productOf(line.productId).price * line.quantity, 0); // 상품 합계
  const shippingFee = itemsPrice >= 30000 ? 0 : 3000; // 3만 원 이상 무료, 아니면 3,000원
  return { itemsPrice, shippingFee, totalPrice: itemsPrice + shippingFee }; // 합계·배송비·총액
}

function paginate<T>(rows: T[], page = 1): Page<T> {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); // 전체 쪽 수 (45건÷5 = 9쪽)
  const current = Math.min(Math.max(1, page), totalPages); // 범위 밖 쪽 번호는 끝으로 맞춘다
  return { items: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), total: rows.length, page: current, size: PAGE_SIZE, totalPages };
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
  if (!cancel) throw new ApiError("취소 요청을 찾을 수 없어요.", 404); // 없는 요청
  return cancel;
}

function toSummary(order: MockOrder): AdminOrderSummary {
  const first = productOf(order.lines[0].productId); // 대표 상품 (첫 번째)
  const count = order.lines.reduce((sum, line) => sum + line.quantity, 0); // 전체 수량
  const status = statusOf(order); // 지금 상태
  return {
    id: order.id,
    status,
    statusLabel: ORDER_LABEL[status],
    totalPrice: totals(order).totalPrice,
    createdAt: order.history[0].changedAt, // 주문한 시각 = 첫 기록
    title: order.lines.length > 1 ? `${first.name} 외 ${order.lines.length - 1}개` : first.name, // "하트 키캡 외 1개"
    imageUrl: first.imageUrl,
    itemCount: count,
    userNickname: order.userNickname,
    userEmail: order.userEmail,
  };
}

function toDetail(order: MockOrder): AdminOrderDetail {
  const { itemsPrice, shippingFee, totalPrice } = totals(order); // 금액 계산
  const status = statusOf(order); // 지금 상태
  return {
    id: order.id,
    status,
    statusLabel: ORDER_LABEL[status],
    totalPrice,
    itemsPrice,
    shippingFee,
    recipientName: order.recipientName,
    address: order.address,
    createdAt: order.history[0].changedAt,
    items: order.lines.map((line) => {
      const product = productOf(line.productId); // 상품 정보
      return { product, quantity: line.quantity, unitPrice: product.price, subtotal: product.price * line.quantity };
    }),
    timeline: order.history.map((step) => ({ status: step.status, label: ORDER_LABEL[step.status], changedAt: step.changedAt })),
    userNickname: order.userNickname,
    userEmail: order.userEmail,
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
    userNickname: order.userNickname,
    totalPrice: totals(order).totalPrice,
  };
}

// ---------- 화면이 부르는 함수들 (lib/admin.ts가 연결한다) ----------
export async function orders(q: AdminOrderQuery = {}): Promise<Page<AdminOrderSummary>> {
  await wait(); // 서버처럼 기다린다
  failIfError(q.q); // error 검색이면 일부러 실패
  const keyword = q.q?.trim().toLowerCase(); // 검색어 (소문자)
  const rows = ORDERS.filter((order) => !q.status || statusOf(order) === q.status) // 상태 필터
    .filter((order) => !keyword || String(order.id).includes(keyword) || order.userNickname.toLowerCase().includes(keyword)) // 주문번호·닉네임 검색
    .sort((a, b) => b.id - a.id) // 최신 주문이 위로
    .map(toSummary); // 목록용 모양으로 바꾼다
  return paginate(rows, q.page); // 쪽 나누기
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

export async function cancelRequests(q: AdminCancelQuery = {}): Promise<Page<AdminCancelRequest>> {
  await wait();
  const rows = CANCELS.filter((cancel) => !q.status || cancel.status === q.status) // 상태 필터
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // 최근 요청이 위로
    .map(toCancel); // 화면용 모양으로 바꾼다
  return paginate(rows, q.page);
}

export async function approveCancel(id: number): Promise<AdminCancelRequest> {
  await wait();
  const cancel = findCancel(id); // 없으면 404
  if (cancel.status !== "requested") throw new ApiError("이미 처리된 요청이에요.", 409); // 두 번 처리 금지
  cancel.status = "approved"; // 요청을 승인으로
  findOrder(cancel.orderId).history.push({ status: "cancelled", changedAt: new Date().toISOString() }); // 주문은 취소 완료로
  return toCancel(cancel);
}

export async function rejectCancel(id: number): Promise<AdminCancelRequest> {
  await wait();
  const cancel = findCancel(id); // 없으면 404
  if (cancel.status !== "requested") throw new ApiError("이미 처리된 요청이에요.", 409); // 두 번 처리 금지
  cancel.status = "rejected"; // 요청을 거절로
  findOrder(cancel.orderId).history.push({ status: cancel.prevStatus, changedAt: new Date().toISOString() }); // 주문은 신청 직전 상태로 돌아간다
  return toCancel(cancel);
}