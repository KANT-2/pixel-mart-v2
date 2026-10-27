/** 적립금(구매 포인트) 계산 — DB 없이 테스트하는 순수 함수 */

/** 기록 종류 → 화면 문구 */
export const POINT_KIND_LABEL: Record<string, string> = {
  first_purchase: "첫 구매 보너스",
  order_spend: "주문에 사용",
  order_refund: "취소·반품으로 돌려받음",
  purchase_reward: "구매 확정 적립",
};

/** 주문서에서 쓸 수 있는 최대 적립금 — 보유 적립금과 주문 금액 중 작은 쪽 */
export function maxUsablePoints(balance: number, orderTotal: number): number {
  return Math.max(0, Math.min(balance, orderTotal));
}

/** 입력값을 0 ~ 최대 사이 정수로 맞춘다 (숫자가 아니면 0) */
export function clampPoints(input: string, max: number): number {
  const value = Number.parseInt(input.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(value) ? Math.min(Math.max(0, value), max) : 0;
}

/** "+1,000P" · "-500P" */
export const formatPointAmount = (amount: number) => `${amount > 0 ? "+" : ""}${amount.toLocaleString("ko-KR")}P`;
