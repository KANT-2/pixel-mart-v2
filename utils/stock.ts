/** 재고 표시 규칙 (#104) — 0이면 품절, 1~5면 'n개 남음', 그보다 많거나 모르면 표시 없음 */
export const LOW_STOCK = 5;

export type StockStatus =
  | { kind: "soldout" }
  | { kind: "low"; left: number }
  | { kind: "enough" }
  | { kind: "unknown" }; // 서버가 꺼져 정적 데이터로 보여 줄 때처럼 재고 값이 없음

export function stockStatus(stock: number | null | undefined): StockStatus {
  if (typeof stock !== "number" || !Number.isFinite(stock)) return { kind: "unknown" };
  const left = Math.floor(stock);
  if (left <= 0) return { kind: "soldout" };
  if (left <= LOW_STOCK) return { kind: "low", left };
  return { kind: "enough" };
}

/** 화면에 보일 짧은 글자 — 표시할 게 없으면 null */
export function stockLabel(status: StockStatus): string | null {
  if (status.kind === "soldout") return "품절";
  if (status.kind === "low") return `${status.left}개 남음`;
  return null;
}

/**
 * 이번에 더 담을 수 있는 최대 수량
 * 장바구니 한도(99)와 재고 중 작은 쪽에서, 이미 담은 수량을 뺀다 (재고를 모르면 99 기준)
 */
export function maxAddable(stock: number | null | undefined, inCart: number, cartLimit = 99) {
  const status = stockStatus(stock);
  const ceiling = status.kind === "unknown" ? cartLimit : Math.min(cartLimit, Math.max(0, Math.floor(stock as number)));
  return Math.max(0, ceiling - inCart);
}
