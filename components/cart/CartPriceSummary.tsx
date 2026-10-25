import { formatPrice } from "@/utils/formatPrice";

interface CartPriceSummaryProps {
  itemsPrice: number;
  shippingFee: number;
  totalPrice: number;
  freeShippingLeft?: number;
  totalLabel?: string;
}

export default function CartPriceSummary({
  itemsPrice,
  shippingFee,
  totalPrice,
  freeShippingLeft,
  totalLabel = "총액",
}: CartPriceSummaryProps) {
  const freeShipping = shippingFee === 0;

  return <div>
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-sub">상품 합계</dt><dd className="font-semibold">{formatPrice(itemsPrice)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-sub">배송비</dt><dd className={freeShipping ? "font-semibold text-lime" : "font-semibold"}>{freeShipping ? "무료 배송" : formatPrice(shippingFee)}</dd></div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4"><dt className="font-semibold">{totalLabel}</dt><dd className="text-2xl font-extrabold text-lime">{formatPrice(totalPrice)}</dd></div>
    </dl>
    {freeShippingLeft !== undefined && <p className={`mt-4 text-center text-xs ${freeShipping ? "font-semibold text-lime" : "text-sub"}`}>
      {freeShipping ? "무료 배송" : `${formatPrice(freeShippingLeft)} 더 담으면 무료 배송`}
    </p>}
  </div>;
}
