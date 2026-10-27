"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import QuantityInput from "@/components/QuantityInput";
import { safeNextPath } from "@/utils/safeNextPath";
import { maxAddable, stockStatus } from "@/utils/stock";

interface AddToCartButtonProps {
  productId: number;
  /** 남은 재고 — 없으면(정적 데이터) 장바구니 한도 99만 본다 (#104) */
  stock?: number;
}

export default function AddToCartButton({ productId, stock }: AddToCartButtonProps) {
  const { cart, add, refresh, loading: cartLoading, error: cartError } = useCart();
  const { user, loading: authLoading, pending: authPending } = useAuth();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [quantityValid, setQuantityValid] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const currentQuantity = cart?.items.find((item) => item.product.id === productId)?.quantity ?? 0;
  const soldOut = stockStatus(stock).kind === "soldout";
  // 장바구니 한도 99와 재고 중 작은 쪽까지만 (재고 3개면 수량도 3까지)
  const remaining = maxAddable(stock, currentQuantity);
  const quantity = Math.max(1, Math.min(selectedQuantity, remaining));
  const unavailable = Boolean(user && (!cart || cartLoading));
  const disabled = soldOut || authLoading || authPending || adding || unavailable || remaining <= 0 || !quantityValid;

  async function handleClick() {
    if (disabled) return;
    if (!user) {
      const next = safeNextPath(window.location.pathname + window.location.search + window.location.hash);
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAdding(true);
    setError(null);
    setAdded(false);
    try {
      await add(productId, quantity);
      setAdded(true);
      setSelectedQuantity(1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "장바구니에 담지 못했어요. 다시 시도해 주세요.");
    } finally { setAdding(false); }
  }

  return <div className="min-w-0 flex-1">
    {remaining > 0 && <div className="mb-4 flex flex-wrap items-end gap-3">
      <QuantityInput label="담을 수량" value={quantity} max={remaining} disabled={authLoading || authPending || adding || unavailable}
        onValidityChange={setQuantityValid}
        onChange={(nextQuantity) => { setSelectedQuantity(nextQuantity); setAdded(false); setError(null); }} />
      {currentQuantity > 0 && <p className="pb-2 text-xs text-dim">이미 {currentQuantity}개 담았어요 · {remaining}개 더 담을 수 있어요</p>}
    </div>}
    <button type="button" onClick={() => { void handleClick(); }} disabled={disabled}
      // 품절이면 초록(btn-lime) 대신 회색 픽셀 버튼 — 눌리지 않는 버튼으로 보이게 (#104)
      className={soldOut
        ? "w-full btn-pixel cursor-not-allowed px-6 py-4 font-extrabold text-dim"
        : "w-full btn-lime px-6 py-4 font-extrabold text-lime-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"}>
      {soldOut ? "품절" : adding ? "담는 중…" : "장바구니 담기"}
    </button>
    {soldOut && <p role="status" className="mt-3 text-sm text-sub">지금은 품절이에요. 재고가 채워지면 다시 담을 수 있어요.</p>}
    {!soldOut && remaining <= 0 && <p role="status" className="mt-3 text-sm text-sub">{currentQuantity > 0 && typeof stock === "number" && currentQuantity >= stock ? "남은 재고만큼 모두 담았어요" : "최대 수량을 담았어요"}</p>}
    {user && !cart && cartError && <div role="alert" className="mt-3 text-sm text-pink"><p>{cartError}</p><button type="button" disabled={cartLoading} onClick={() => { void refresh().catch(() => undefined); }} className="mt-2 font-semibold underline underline-offset-4">장바구니 다시 확인</button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
    {added && <p role="status" className="mt-3 text-sm text-mint">담았어요 · <Link href="/cart" className="font-bold underline underline-offset-4">장바구니 보기</Link></p>}
  </div>;
}
