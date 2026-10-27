"use client"; // 입력값·제출 상태를 다루니 클라이언트 컴포넌트로 만든다

import { useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { createAdminProduct, updateAdminProduct } from "@/lib/admin";
import type { AdminProduct } from "@/types/admin";
import type { ApiCategory } from "@/types/api"; // 분류 선택지 — 손님 화면과 같은 공개 타입을 읽기만 한다
import {
  IMAGE_URL_PREFIX,
  PRODUCT_NAME_MAX,
  PRODUCT_PRICE_MAX,
  PRODUCT_PRICE_MIN,
  PRODUCT_STOCK_MAX,
  PRODUCT_STOCK_MIN,
  RESTOCK_MAX,
  RESTOCK_MIN,
  buildProductUpdatePayload,
  validateProductCreate,
  validateProductEdit,
  validateRestockQty,
  type ProductFormErrors,
  type ProductFormValues,
} from "@/utils/adminProducts";
import { RARITY_KEYS, rarityInfo, type Rarity } from "@/utils/gameItem";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: AdminProduct; // edit일 때만 (현재 값으로 폼을 채운다)
  categories: ApiCategory[];
  focusRestock?: boolean; // 목록의 "재입고" 버튼으로 열었을 때, 추가 입고 수량 칸에 바로 초점을 둔다
  onSaved: (product: AdminProduct) => void;
  onCancel: () => void;
}

// 등록 · 수정 공용 폼 — stock 필드가 PATCH에서 "더하기"로 동작하는 서버 규칙 때문에
// 등록 폼은 "초기 재고", 수정 폼은 "현재 재고(읽기 전용) + 추가 입고 수량"으로 문구를 분리한다
export default function ProductForm({ mode, product, categories, focusRestock = false, onSaved, onCancel }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    name: product?.name ?? "",
    price: product ? String(product.price) : "",
    categorySlug: product?.categorySlug ?? categories[0]?.slug ?? "",
    description: product?.description ?? "",
    imageUrl: product?.imageUrl ?? "",
    rarity: product?.rarity ?? "common",
  });
  const [stockText, setStockText] = useState(""); // 등록: 초기 재고
  const [restockText, setRestockText] = useState(""); // 수정: 추가 입고 수량 (비우면 재고 그대로)
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // 중복 클릭 방지
    setServerError(null);

    if (mode === "create") {
      const result = validateProductCreate(values, stockText);
      setErrors(result.errors);
      if (!result.valid) return;
      setSubmitting(true);
      try {
        const saved = await createAdminProduct({
          name: values.name.trim(),
          price: Number(values.price),
          categorySlug: values.categorySlug,
          description: values.description.trim(),
          imageUrl: values.imageUrl.trim(),
          stock: Number(stockText),
          rarity: values.rarity,
        });
        onSaved(saved);
      } catch (cause) {
        setServerError(cause instanceof ApiError ? cause.message : "등록하지 못했어요. 다시 시도해 주세요.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // mode === "edit"
    if (!product) return;
    const formResult = validateProductEdit(values);
    const restockResult = validateRestockQty(restockText);
    setErrors({ ...formResult.errors, ...(restockResult.error ? { stock: restockResult.error } : {}) });
    if (!formResult.valid || !restockResult.valid) return;

    const payload = buildProductUpdatePayload(
      product,
      {
        name: values.name.trim(),
        price: Number(values.price),
        categorySlug: values.categorySlug,
        description: values.description.trim(),
        imageUrl: values.imageUrl.trim(),
        rarity: values.rarity,
      },
      restockResult.qty,
    );
    if (Object.keys(payload).length === 0) {
      setServerError("바뀐 내용이 없어요.");
      return;
    }
    setSubmitting(true);
    try {
      const saved = await updateAdminProduct(product.id, payload);
      onSaved(saved);
    } catch (cause) {
      setServerError(cause instanceof ApiError ? cause.message : "수정하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="pixel-panel space-y-4 p-4">
      <h2 className="text-base font-bold text-ink">{mode === "create" ? "상품 등록" : `#${product?.id} 상품 수정`}</h2>

      {serverError && <p role="alert" className="rounded-lg border border-pink/30 bg-panel-2 p-3 text-sm text-pink">{serverError}</p>}

      <FormField label="상품명" error={errors.name}>
        <input
          type="text"
          value={values.name}
          maxLength={PRODUCT_NAME_MAX}
          onChange={(event) => field("name", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
      </FormField>

      <FormField label="가격 (원)" error={errors.price}>
        <input
          type="number"
          value={values.price}
          min={PRODUCT_PRICE_MIN}
          max={PRODUCT_PRICE_MAX}
          step={1}
          onChange={(event) => field("price", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
      </FormField>

      <FormField label="분류" error={errors.categorySlug}>
        <select
          value={values.categorySlug}
          onChange={(event) => field("categorySlug", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        >
          {categories.length === 0 && <option value="">분류를 불러오지 못했어요</option>}
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>{category.name}</option>
          ))}
        </select>
      </FormField>

      <FormField label="등급" error={undefined}>
        <select
          value={values.rarity}
          onChange={(event) => field("rarity", event.target.value as Rarity)}
          className="pixel-input h-11 w-full px-3 text-sm"
        >
          {RARITY_KEYS.map((key) => (
            <option key={key} value={key}>{rarityInfo(key).label}</option>
          ))}
        </select>
      </FormField>

      <FormField label="상품 설명" error={errors.description}>
        <textarea
          value={values.description}
          onChange={(event) => field("description", event.target.value)}
          rows={3}
          className="pixel-input w-full px-3 py-2 text-sm"
        />
      </FormField>

      <FormField label="이미지 경로" error={errors.imageUrl} hint={`"${IMAGE_URL_PREFIX}"로 시작하는 경로만 쓸 수 있어요. (예: /images/products/heart-keycap.png)`}>
        <input
          type="text"
          value={values.imageUrl}
          placeholder="/images/products/example.png"
          onChange={(event) => field("imageUrl", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
      </FormField>

      {mode === "create" ? (
        <FormField label="초기 재고" error={errors.stock}>
          <input
            type="number"
            value={stockText}
            min={PRODUCT_STOCK_MIN}
            max={PRODUCT_STOCK_MAX}
            step={1}
            onChange={(event) => setStockText(event.target.value)}
            className="pixel-input h-11 w-full px-3 text-sm"
          />
        </FormField>
      ) : (
        <FormField label={`현재 재고 ${product?.stock ?? 0}개`} error={errors.stock} hint="재고를 줄이거나 덮어쓸 수는 없어요. 입고된 만큼만 더해 주세요.">
          <input
            ref={focusRestock ? (el) => { if (el && document.activeElement !== el) el.focus(); } : undefined}
            type="number"
            value={restockText}
            min={RESTOCK_MIN}
            max={RESTOCK_MAX}
            step={1}
            placeholder="추가 입고 수량 (+N)"
            onChange={(event) => setRestockText(event.target.value)}
            className="pixel-input h-11 w-full px-3 text-sm"
          />
        </FormField>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={submitting} className="btn-pixel min-h-11 px-4 text-sm font-bold">
          취소
        </button>
        <button type="submit" disabled={submitting} className="btn-lime min-h-11 px-4 text-sm font-bold">
          {submitting ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}

interface FormFieldProps { label: string; error?: string; hint?: string; children: ReactNode }

function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-bold text-ink">{label}</span>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-dim">{hint}</p>}
      {error && <p className="mt-1 text-xs text-pink">{error}</p>}
    </label>
  );
}
