import type { ApiUserCoupon } from "@/types/api";

/** 결제수단 — 서버 PAYMENT_LABELS와 같은 이름 */
export const PAYMENT_METHODS = [
  { value: "card", label: "신용·체크카드" },
  { value: "easy_pay", label: "간편결제" },
  { value: "transfer", label: "계좌이체" },
] as const;

/** 배송 메모 빠른 선택 — 마지막은 직접 입력 */
export const DELIVERY_MEMOS = [
  "문 앞에 놓아 주세요",
  "경비실에 맡겨 주세요",
  "배송 전에 연락 주세요",
  "택배함에 넣어 주세요",
] as const;

/** 택배사 — 서버 COURIER_LABELS와 같은 코드 */
export const COURIERS = [
  { value: "cj", label: "CJ대한통운" },
  { value: "post", label: "우체국택배" },
  { value: "hanjin", label: "한진택배" },
  { value: "lotte", label: "롯데택배" },
  { value: "logen", label: "로젠택배" },
] as const;

const TRACKING_URLS: Record<string, (number: string) => string> = {
  cj: (n) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${n}`,
  post: (n) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${n}`,
  hanjin: (n) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnum=${n}&schLang=KR`,
  lotte: (n) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`,
  logen: (n) => `https://www.ilogen.com/web/personal/trace/${n}`,
};

/** 택배사 배송 조회 페이지 (모르는 택배사·잘못된 번호면 null) */
export function trackingUrl(courier: string | null, trackingNumber: string | null): string | null {
  if (!courier || !trackingNumber || !/^\d{9,14}$/.test(trackingNumber)) return null;
  return TRACKING_URLS[courier]?.(trackingNumber) ?? null;
}

/** 010-1234-5678 모양으로 (서버도 같은 규칙으로 다시 맞춘다) */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    const middle = digits.length === 10 ? 4 : 3;
    return `${digits.slice(0, 2)}-${digits.slice(2, 2 + middle)}-${digits.slice(2 + middle, 2 + middle + 4)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const middle = digits.length === 11 ? 4 : 3;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middle)}-${digits.slice(3 + middle)}`;
}

export const isValidPhone = (phone: string) => /^0\d{1,2}\d{3,4}\d{4}$/.test(phone.replace(/\D/g, ""));
export const isValidPostalCode = (code: string) => /^\d{5}$/.test(code.trim());

export interface ShippingForm {
  recipientName: string;
  phone: string;
  postalCode: string;
  address: string;
  addressDetail: string;
}

export type ShippingErrors = Partial<Record<keyof ShippingForm, string>>;

/** 주문서·배송지 화면 공통 검사 — 틀린 칸마다 안내 문구 */
export function validateShipping(form: ShippingForm) {
  const values = {
    recipientName: form.recipientName.trim(),
    phone: formatPhone(form.phone),
    postalCode: form.postalCode.trim(),
    address: form.address.trim(),
    addressDetail: form.addressDetail.trim(),
  };
  const errors: ShippingErrors = {};
  if (!values.recipientName) errors.recipientName = "받는 사람을 입력해 주세요.";
  else if (Array.from(values.recipientName).length > 50) errors.recipientName = "받는 사람은 50자 이내로 입력해 주세요.";
  if (!isValidPhone(values.phone)) errors.phone = "연락처를 010-1234-5678처럼 입력해 주세요.";
  if (!isValidPostalCode(values.postalCode)) errors.postalCode = "주소 검색으로 우편번호를 넣어 주세요.";
  if (!values.address) errors.address = "주소를 입력해 주세요.";
  else if (Array.from(values.address).length > 200) errors.address = "주소는 200자 이내로 입력해 주세요.";
  if (Array.from(values.addressDetail).length > 100) errors.addressDetail = "상세 주소는 100자 이내로 입력해 주세요.";
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

/** 쿠폰 할인액 미리보기 — 서버 discount_for와 같은 계산 (쓸 수 없으면 null과 이유) */
export function couponDiscount(coupon: ApiUserCoupon, itemsPrice: number): { discount: number | null; reason?: string } {
  if (coupon.status !== "available") return { discount: null, reason: coupon.status === "used" ? "사용 완료" : "기간 만료" };
  if (itemsPrice < coupon.minOrderPrice) return { discount: null, reason: `${coupon.minOrderPrice.toLocaleString("ko-KR")}원 이상 주문 시` };
  let discount = coupon.discountType === "percent" ? Math.floor((itemsPrice * coupon.discountValue) / 100) : coupon.discountValue;
  if (coupon.discountType === "percent" && coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: Math.min(discount, itemsPrice) };
}

/** 쿠폰 혜택 한 줄 — "3,000원 할인" / "10% 할인 (최대 5,000원)" */
export function couponBenefit(coupon: Pick<ApiUserCoupon, "discountType" | "discountValue" | "maxDiscount">): string {
  if (coupon.discountType === "amount") return `${coupon.discountValue.toLocaleString("ko-KR")}원 할인`;
  return `${coupon.discountValue}% 할인${coupon.maxDiscount !== null ? ` (최대 ${coupon.maxDiscount.toLocaleString("ko-KR")}원)` : ""}`;
}

/** 배송 완료 뒤 할 수 있는 일 — 구매 확정 전, 반품·교환 신청이 없을 때만 */
export function afterDeliveryActions(order: { status: string; confirmedAt: string | null }) {
  const open = order.status === "delivered" && !order.confirmedAt;
  return { canConfirm: open, canReturn: open };
}

export const RETURN_KIND_LABEL = { return: "반품", exchange: "교환" } as const;
export const RETURN_STATUS_LABEL = { requested: "접수됨", approved: "승인됨", rejected: "거절됨" } as const;
