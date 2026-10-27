// utils/adminProducts.ts — 상품 등록·수정 폼의 검증과 PATCH payload 계산. 서버(admin_products) 규칙과 값을 맞춘다.
import type { AdminProduct, ProductUpdateInput } from "@/types/admin";
import type { Rarity } from "@/utils/gameItem";

export const PRODUCT_NAME_MAX = 60;
export const PRODUCT_PRICE_MIN = 100;
export const PRODUCT_PRICE_MAX = 1_000_000;
export const PRODUCT_STOCK_MIN = 0;
export const PRODUCT_STOCK_MAX = 9_999;
export const RESTOCK_MIN = 1;
export const RESTOCK_MAX = 9_999;
export const IMAGE_URL_PREFIX = "/images/";

// 폼에 입력 중인 값 — price·stock도 입력 중엔 문자열이라 숫자 검증을 여기서 같이 한다
export interface ProductFormValues {
  name: string;
  price: string;
  categorySlug: string;
  description: string;
  imageUrl: string;
  rarity: Rarity;
}

export interface ProductFormErrors {
  name?: string;
  price?: string;
  categorySlug?: string;
  description?: string;
  imageUrl?: string;
  stock?: string; // 등록 폼의 초기 재고 / 수정 폼의 "추가 입고(+N)" 에러
  stockQty?: string; // 수정 폼의 "재고 수량"(절대값 설정) 에러
}

function validateCommonFields(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const name = values.name.trim();
  if (!name || name.length > PRODUCT_NAME_MAX) errors.name = `상품명은 1~${PRODUCT_NAME_MAX}자로 입력해 주세요.`;
  const price = Number(values.price);
  if (values.price.trim() === "" || !Number.isInteger(price) || price < PRODUCT_PRICE_MIN || price > PRODUCT_PRICE_MAX) {
    errors.price = `가격은 ${PRODUCT_PRICE_MIN.toLocaleString()}~${PRODUCT_PRICE_MAX.toLocaleString()}원 사이 정수로 입력해 주세요.`;
  }
  if (!values.categorySlug) errors.categorySlug = "분류를 선택해 주세요.";
  if (!values.description.trim()) errors.description = "상품 설명을 입력해 주세요.";
  if (!values.imageUrl.trim().startsWith(IMAGE_URL_PREFIX)) errors.imageUrl = `이미지 경로는 "${IMAGE_URL_PREFIX}"로 시작해야 해요. (예: /images/products/foo.png)`;
  return errors;
}

// 등록 폼 검증 — "초기 재고"까지 포함, 서버 ProductCreateIn과 같은 범위
export function validateProductCreate(values: ProductFormValues, stockText: string): { valid: boolean; errors: ProductFormErrors } {
  const errors = validateCommonFields(values);
  const stock = Number(stockText);
  if (stockText.trim() === "" || !Number.isInteger(stock) || stock < PRODUCT_STOCK_MIN || stock > PRODUCT_STOCK_MAX) {
    errors.stock = `초기 재고는 ${PRODUCT_STOCK_MIN}~${PRODUCT_STOCK_MAX} 사이 정수로 입력해 주세요.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// 수정 폼 검증 — 재고는 별도의 "추가 입고 수량"(validateRestockQty)으로 검증한다
export function validateProductEdit(values: ProductFormValues): { valid: boolean; errors: ProductFormErrors } {
  const errors = validateCommonFields(values);
  return { valid: Object.keys(errors).length === 0, errors };
}

// 추가 입고 수량 검증 — 비워 두면(0) 이번 저장에서 재고를 건드리지 않는다
export function validateRestockQty(restockText: string): { valid: boolean; qty: number; error?: string } {
  const text = restockText.trim();
  if (text === "") return { valid: true, qty: 0 };
  const qty = Number(text);
  if (!Number.isInteger(qty) || qty < RESTOCK_MIN || qty > RESTOCK_MAX) {
    return { valid: false, qty: 0, error: `추가 입고 수량은 ${RESTOCK_MIN}~${RESTOCK_MAX} 사이 정수로 입력해 주세요.` };
  }
  return { valid: true, qty };
}

// "재고 수량"(절대값 설정) 검증 — 항상 값이 채워져 있어야 한다(비워두는 건 허용 안 함)
export function validateStockSetQty(stockText: string): { valid: boolean; qty: number; error?: string } {
  const qty = Number(stockText);
  if (stockText.trim() === "" || !Number.isInteger(qty) || qty < PRODUCT_STOCK_MIN || qty > PRODUCT_STOCK_MAX) {
    return { valid: false, qty: 0, error: `재고 수량은 ${PRODUCT_STOCK_MIN}~${PRODUCT_STOCK_MAX} 사이 정수로 입력해 주세요.` };
  }
  return { valid: true, qty };
}

// "재고 수량"(절대값)과 "추가 입고(+N)"를 동시에 바꾸면 서버가 422로 거부하므로, 저장 전에 미리 막는다
export function hasConflictingStockInput(stockQty: number, originalStock: number, restockQty: number): boolean {
  return stockQty !== originalStock && restockQty >= RESTOCK_MIN;
}

// 수정 PATCH payload — 바뀐 필드만 담는다.
// stockQty(재고 수량 칸의 현재 값)가 원래 재고와 다를 때만 "stockSet"(절대값 설정)을 넣고,
// 그렇지 않을 때만 기존처럼 restockQty(1 이상)를 "stock"(더하기)으로 넣는다 — 안 바꾸면 둘 다 안 보낸다.
export function buildProductUpdatePayload(
  original: AdminProduct,
  edited: { name: string; price: number; categorySlug: string; description: string; imageUrl: string; rarity: Rarity },
  restockQty: number,
  stockQty: number,
): ProductUpdateInput {
  const changes: ProductUpdateInput = {};
  if (edited.name !== original.name) changes.name = edited.name;
  if (edited.price !== original.price) changes.price = edited.price;
  if (edited.categorySlug !== original.categorySlug) changes.categorySlug = edited.categorySlug;
  if (edited.description !== original.description) changes.description = edited.description;
  if (edited.imageUrl !== original.imageUrl) changes.imageUrl = edited.imageUrl;
  if (edited.rarity !== original.rarity) changes.rarity = edited.rarity;
  if (stockQty !== original.stock) changes.stockSet = stockQty;
  else if (restockQty >= RESTOCK_MIN) changes.stock = restockQty;
  return changes;
}

// 목록·카드의 재고 표시 — 0개 "품절", 10개 이하 "곧 품절", 그 외에는 표시 안 함(null)
export function stockStatus(stock: number): { label: string; className: string } | null {
  if (stock === 0) return { label: "품절", className: "text-pink" };
  if (stock <= 10) return { label: "곧 품절", className: "text-pink" };
  return null;
}
