"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import CartPriceSummary from "@/components/cart/CartPriceSummary";
import PaymentSheet from "@/components/orders/PaymentSheet";
import ShippingFields from "@/components/orders/ShippingFields";
import { addressesApi } from "@/lib/addresses";
import { ApiError } from "@/lib/api";
import { couponsApi } from "@/lib/coupons";
import { ordersApi, type PaymentMethod } from "@/lib/orders";
import { pointsApi } from "@/lib/points";
import type { ApiAddress, ApiOrder, ApiUserCoupon } from "@/types/api";
import { formatPrice } from "@/utils/formatPrice";
import { clampPoints, maxUsablePoints } from "@/utils/points";
import { couponDiscount, DELIVERY_MEMOS, PAYMENT_METHODS, type ShippingErrors, type ShippingForm, validateShipping } from "@/utils/shop";

export default function CheckoutContents() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  // 완료한 주문을 보관한 화면이 새 체크아웃에서 다시 나타나지 않게 합니다.
  if (pathname !== "/checkout") return null;
  if (loading) return <CheckoutSkeleton />;
  if (!user) return <CheckoutLogin />;
  return <CheckoutForm key={user.id} />;
}

const EMPTY_SHIPPING: ShippingForm = { recipientName: "", phone: "", postalCode: "", address: "", addressDetail: "" };
const fromAddress = (address: ApiAddress): ShippingForm => ({
  recipientName: address.recipientName, phone: address.phone, postalCode: address.postalCode, address: address.address, addressDetail: address.addressDetail,
});
const sameAddress = (form: ShippingForm, address: ApiAddress) =>
  form.postalCode.trim() === address.postalCode && form.address.trim() === address.address && form.addressDetail.trim() === address.addressDetail;
const SHIPPING_FIELDS = ["recipientName", "phone", "postalCode", "address", "addressDetail"] as const;

function CheckoutForm() {
  const { pending: authPending, refresh: refreshAuth } = useAuth();
  const { cart, loading, error: cartError, errorStatus: cartErrorStatus, pendingIds, refresh } = useCart();
  const router = useRouter();
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [fieldErrors, setFieldErrors] = useState<ShippingErrors>({});
  const [addresses, setAddresses] = useState<ApiAddress[] | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [memoChoice, setMemoChoice] = useState("");
  const [memoText, setMemoText] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [coupons, setCoupons] = useState<ApiUserCoupon[] | null>(null);
  const [couponId, setCouponId] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [pointBalance, setPointBalance] = useState<number | null>(null); // 못 불러오면 적립금 칸을 숨긴다
  const [pointsInput, setPointsInput] = useState("");
  const locked = useRef(false);
  const confirmed = useRef(false);
  const sequence = useRef(0);
  const session = useRef<AbortController | null>(null);
  const pendingValues = useRef<ShippingForm | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    if (authPending) controller.abort();
    return () => {
      // Cache Components로 화면이 숨겨져도 이전 요청은 이동·상태 갱신을 하지 않습니다.
      controller.abort();
      if (locked.current && !confirmed.current) setError("주문 요청 확인이 중단됐어요. 다시 주문하기 전에 주문 내역을 확인해 주세요.");
      locked.current = false;
      setBusy(false);
    };
  }, [authPending]);

  // 보유 적립금 · 쿠폰 · 저장한 배송지 — 주문서를 열 때 한 번 (주문하면 서버가 다시 검사)
  useEffect(() => {
    const controller = new AbortController();
    pointsApi.balance(controller.signal).then((points) => setPointBalance(points.balance)).catch(() => {});
    couponsApi.list(controller.signal).then(setCoupons).catch(() => setCoupons([]));
    addressesApi.list(controller.signal).then((rows) => {
      setAddresses(rows);
      const preferred = rows.find((row) => row.isDefault) ?? rows[0];
      // 아직 아무것도 안 썼을 때만 기본 배송지로 채운다
      setShipping((current) => (preferred && current === EMPTY_SHIPPING ? fromAddress(preferred) : current));
      setSaveAddress(rows.length === 0);
    }).catch(() => setAddresses([]));
    return () => controller.abort();
  }, []);

  function isCurrent(controller: AbortController, request: number) {
    return !controller.signal.aborted && sequence.current === request;
  }

  async function syncCartAndOpen(order: ApiOrder, controller: AbortController, request: number) {
    setRefreshError(null);
    try {
      await refresh();
      if (isCurrent(controller, request)) router.replace(`/mypage/orders/${order.id}?placed=1`);
    } catch (cause) {
      if (!isCurrent(controller, request)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUnauthorized(true);
        void refreshAuth();
        return;
      }
      setRefreshError(cause instanceof Error ? cause.message : "장바구니를 다시 확인하지 못했어요.");
    }
  }

  // 결제하기 → 배송지 검사 → 결제창
  function openPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || createdOrder || authPending || loading || pendingIds.length > 0 || !cart?.items.length) return;
    const validation = validateShipping(shipping);
    setShipping(validation.values);
    setFieldErrors(validation.errors);
    setError(null);
    setErrorStatus(null);
    if (!validation.valid) {
      const first = SHIPPING_FIELDS.find((field) => validation.errors[field]);
      document.getElementById(`checkout-${first}`)?.focus();
      return;
    }
    pendingValues.current = validation.values;
    setPayOpen(true);
  }

  async function pay(order: { deliveryMemo: string; pointsUsed: number }) {
    const values = pendingValues.current;
    const controller = session.current;
    if (!values || locked.current || !controller || controller.signal.aborted) return;
    const request = ++sequence.current;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      // 승인 중 화면을 잠깐 보여 준다 (가상 결제)
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (!isCurrent(controller, request)) return;
      const created = await ordersApi.create({
        ...values,
        deliveryMemo: order.deliveryMemo,
        paymentMethod,
        pointsUsed: order.pointsUsed,
        userCouponId: couponId,
        saveAddress,
      }, controller.signal);
      if (!isCurrent(controller, request)) return;
      // 다른 탭에서 장바구니가 바뀌었어도 확정된 품목·금액은 서버 응답만 씁니다.
      confirmed.current = true;
      setCreatedOrder(created);
      setPayOpen(false);
      await syncCartAndOpen(created, controller, request);
    } catch (cause) {
      if (!isCurrent(controller, request)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUnauthorized(true);
        void refreshAuth();
      } else {
        setError(cause instanceof ApiError ? cause.message : "주문 결과를 확인하지 못했어요. 다시 주문하기 전에 주문 내역을 확인해 주세요.");
        setErrorStatus(cause instanceof ApiError ? cause.status : null);
        if (cause instanceof ApiError && cause.status === 409) setPayOpen(false); // 재고 문제는 장바구니에서 고친다
      }
    } finally {
      if (isCurrent(controller, request)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  async function retryCartRefresh() {
    const controller = session.current;
    if (locked.current || authPending || !createdOrder || !controller || controller.signal.aborted) return;
    const request = ++sequence.current;
    locked.current = true;
    setBusy(true);
    try {
      // 이미 생성한 주문은 유지하고 GET /cart만 재시도합니다.
      await syncCartAndOpen(createdOrder, controller, request);
    } finally {
      if (isCurrent(controller, request)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  if (unauthorized) return <CheckoutLogin />;
  if (createdOrder) return <div className="space-y-6">
    <div role="status" className="rounded-2xl border border-mint/30 bg-panel p-6">
      <p className="mb-3 font-pixel text-mint" aria-hidden="true">ORDER COMPLETE</p>
      <h2 className="text-xl font-extrabold">결제가 완료됐어요</h2>
      <p className="mt-2 text-sm text-sub">주문번호 #{createdOrder.id} · {createdOrder.paymentLabel}</p>
      <p className="mt-3 text-sm text-sub">{busy ? "장바구니를 갱신한 뒤 주문 상세로 이동해요." : "아래는 서버에서 확정한 주문 내용이에요."}</p>
    </div>
    <CheckoutSummary items={createdOrder.items} itemsPrice={createdOrder.itemsPrice} shippingFee={createdOrder.shippingFee} totalPrice={createdOrder.totalPrice}
      pointsUsed={createdOrder.pointsUsed} couponDiscount={createdOrder.couponDiscount} confirmed />
    {refreshError && <p role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">주문은 완료됐지만 장바구니 갱신에 실패했어요. {refreshError}</p>}
    {!busy && <div className="flex flex-wrap items-center gap-4">
      <button type="button" disabled={authPending} onClick={() => void retryCartRefresh()}
        className="btn-lime px-5 py-3 font-bold text-lime-ink disabled:opacity-50">장바구니 갱신 후 주문 보기</button>
      <Link href={`/mypage/orders/${createdOrder.id}?placed=1`} className="text-sm text-sub underline underline-offset-4">주문 상세 보기</Link>
    </div>}
  </div>;

  if (!cart && loading) return <CheckoutSkeleton />;
  if (!cart) return <div role="alert" className="pixel-panel p-8 text-center">
    <p className="text-sub">{cartError ?? "장바구니를 불러오지 못했어요."}</p>
    <button type="button" disabled={loading || authPending} onClick={() => void refresh().catch(() => undefined)}
      className="mt-5 rounded-lg border border-line px-5 py-3 font-semibold disabled:opacity-50">다시 불러오기</button>
  </div>;
  if (cart.items.length === 0) return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">EMPTY INVENTORY</p>
    <h2 className="text-xl font-extrabold">주문할 아이템이 없어요</h2>
    <p className="mt-3 text-sm text-sub">마음에 드는 아이템을 장바구니에 담아 보세요.</p>
    <Link href="/products" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">상품 보러가기</Link>
  </div>;

  const disabled = busy || authPending;
  const coupon = coupons?.find((row) => row.id === couponId) ?? null;
  const couponOff = coupon ? couponDiscount(coupon, cart.itemsPrice).discount ?? 0 : 0;
  const payable = cart.totalPrice - couponOff;
  const usablePoints = maxUsablePoints(pointBalance ?? 0, payable);
  const pointsUsed = clampPoints(pointsInput, usablePoints);
  const finalPrice = payable - pointsUsed;
  const deliveryMemo = memoChoice === "custom" ? memoText.trim() : memoChoice;
  const cartPending = loading || pendingIds.length > 0;
  const stockBlocked = errorStatus === 409 || cartErrorStatus === 409;
  const savedMatch = addresses?.find((row) => sameAddress(shipping, row)) ?? null;
  const usableCoupons = (coupons ?? []).filter((row) => row.status === "available");
  const methodLabel = PAYMENT_METHODS.find((method) => method.value === paymentMethod)?.label ?? "";
  const section = "min-w-0 pixel-panel p-5 sm:p-6";
  const field = "w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-50";

  return <form onSubmit={openPayment} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="checkout-shipping" className={section}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="checkout-shipping" className="text-lg font-extrabold">배송지</h2>
          <Link href="/mypage/addresses" className="text-xs text-sub underline-offset-4 hover:text-ink hover:underline">배송지 관리</Link>
        </div>
        {addresses && addresses.length > 0 && <div role="group" aria-label="저장한 배송지" className="mb-4 flex flex-wrap gap-2">
          {addresses.map((row) => <button key={row.id} type="button" disabled={disabled} aria-pressed={savedMatch?.id === row.id}
            onClick={() => { setShipping(fromAddress(row)); setFieldErrors({}); }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-sub hover:text-ink aria-pressed:border-mint/60 aria-pressed:text-mint">
            {row.label}{row.isDefault && <span className="ml-1 text-dim">· 기본</span>}
          </button>)}
        </div>}
        <ShippingFields idPrefix="checkout" value={shipping} errors={fieldErrors} disabled={disabled}
          onChange={(next, changed) => {
            setShipping(next);
            setFieldErrors((current) => (changed === "search" ? { ...current, postalCode: undefined, address: undefined } : { ...current, [changed]: undefined }));
          }} />
        <div className="mt-4">
          <label htmlFor="checkout-memo" className="mb-2 block text-sm font-semibold">배송 메모 <span className="font-normal text-dim">(선택)</span></label>
          <select id="checkout-memo" value={memoChoice} disabled={disabled} onChange={(event) => setMemoChoice(event.target.value)} className={field}>
            <option value="">선택 안 함</option>
            {DELIVERY_MEMOS.map((text) => <option key={text} value={text}>{text}</option>)}
            <option value="custom">직접 입력</option>
          </select>
          {memoChoice === "custom" && <input aria-label="배송 메모 직접 입력" maxLength={100} value={memoText} disabled={disabled}
            onChange={(event) => setMemoText(event.target.value)} placeholder="배송 기사님께 남길 말" className={`${field} mt-2`} />}
        </div>
        {!savedMatch && <label className="mt-4 flex items-center gap-2 text-sm text-sub">
          <input type="checkbox" checked={saveAddress} disabled={disabled} onChange={(event) => setSaveAddress(event.target.checked)} className="size-4 accent-lime" />
          이 배송지를 기본 배송지로 저장
        </label>}
      </section>

      <section aria-labelledby="checkout-benefits" className={section}>
        <h2 id="checkout-benefits" className="mb-4 text-lg font-extrabold">할인 · 적립금</h2>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="checkout-coupon" className="text-sm font-semibold">쿠폰</label>
          <Link href="/mypage/coupons" className="text-xs text-sub underline-offset-4 hover:text-ink hover:underline">쿠폰함 · 코드 등록</Link>
        </div>
        <select id="checkout-coupon" value={couponId ?? ""} disabled={disabled || coupons === null}
          onChange={(event) => { setCouponId(event.target.value ? Number(event.target.value) : null); setPointsInput(""); }} className={field}>
          <option value="">{coupons === null ? "쿠폰 불러오는 중…" : usableCoupons.length ? `쿠폰 선택 (${usableCoupons.length}장 보유)` : "쓸 수 있는 쿠폰이 없어요"}</option>
          {usableCoupons.map((row) => {
            const preview = couponDiscount(row, cart.itemsPrice);
            return <option key={row.id} value={row.id} disabled={preview.discount === null}>
              {row.name} · {preview.discount === null ? preview.reason : `-${formatPrice(preview.discount)}`}
            </option>;
          })}
        </select>
        {pointBalance !== null && <div className="mt-5 border-t border-line pt-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="pointsUsed" className="text-sm font-semibold">적립금 사용</label>
            <span className="text-xs text-sub">보유 <b className="text-lime">{pointBalance.toLocaleString("ko-KR")}P</b></span>
          </div>
          <div className="flex gap-2">
            <input id="pointsUsed" name="pointsUsed" inputMode="numeric" autoComplete="off" value={pointsInput}
              onChange={(event) => setPointsInput(event.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setPointsInput(pointsUsed ? String(pointsUsed) : "")}
              disabled={disabled || usablePoints === 0} placeholder="0" aria-describedby="pointsUsed-help" className={`${field} flex-1 text-right`} />
            <button type="button" disabled={disabled || usablePoints === 0} onClick={() => setPointsInput(pointsUsed === usablePoints ? "" : String(usablePoints))}
              className="btn-pixel shrink-0 px-3 text-sm font-bold disabled:opacity-50">{pointsUsed === usablePoints && usablePoints > 0 ? "사용 취소" : "전액 사용"}</button>
          </div>
          <p id="pointsUsed-help" className="mt-2 text-xs text-dim">
            {usablePoints === 0 ? "쓸 수 있는 적립금이 없어요. 첫 구매를 하면 1,000P를 받아요." : `최대 ${usablePoints.toLocaleString("ko-KR")}P까지 1P = 1원으로 쓸 수 있어요.`}
          </p>
        </div>}
      </section>

      <section aria-labelledby="checkout-payment" className={section}>
        <h2 id="checkout-payment" className="mb-4 text-lg font-extrabold">결제수단</h2>
        <div role="group" aria-labelledby="checkout-payment" className="segmented grid h-11 grid-cols-3 text-xs font-bold sm:text-sm">
          {PAYMENT_METHODS.map((method) => <button key={method.value} type="button" disabled={disabled} aria-pressed={paymentMethod === method.value}
            onClick={() => setPaymentMethod(method.value)}>{method.label}</button>)}
        </div>
      </section>
    </div>

    <div className="min-w-0 space-y-4 lg:sticky lg:top-24">
      <CheckoutSummary items={cart.items.map((item) => ({ ...item, unitPrice: item.product.price }))}
        itemsPrice={cart.itemsPrice} shippingFee={cart.shippingFee} totalPrice={cart.totalPrice} freeShippingLeft={cart.freeShippingLeft} />
      <div className="pixel-panel p-5">
        <dl className="space-y-1.5 text-sm">
          {couponOff > 0 && <div className="flex justify-between text-sub"><dt>쿠폰 할인</dt><dd>-{formatPrice(couponOff)}</dd></div>}
          {pointsUsed > 0 && <div className="flex justify-between text-sub"><dt>적립금 사용</dt><dd>-{formatPrice(pointsUsed)}</dd></div>}
          <div className="flex items-baseline justify-between"><dt className="font-bold">결제 금액</dt><dd className="text-xl font-extrabold text-lime">{formatPrice(finalPrice)}</dd></div>
        </dl>
        {(error || cartError) && !payOpen && <div role="alert" className="mt-4 text-sm text-pink">
          <p>{error ?? cartError}</p>
          {error && errorStatus !== 409 && <Link href="/mypage/orders" className="mt-2 inline-flex text-sub underline underline-offset-4">주문 내역 확인</Link>}
        </div>}
        <button type="submit" disabled={disabled || cartPending || stockBlocked}
          className="mt-4 min-h-12 w-full btn-lime px-4 py-3 text-sm font-bold text-lime-ink disabled:cursor-not-allowed disabled:opacity-50">{stockBlocked ? "재고 확인 필요" : `${formatPrice(finalPrice)} 결제하기`}</button>
        {stockBlocked && <p className="mt-3 text-center text-xs text-pink">장바구니로 돌아가 재고 경고를 확인해 주세요.</p>}
        <p role="status" className="mt-2 min-h-5 text-center text-xs text-sub">{cartPending ? "장바구니 변경 사항을 확인하고 있어요." : ""}</p>
        <Link href="/cart" className="inline-flex py-1 text-sm text-sub hover:text-ink">← 장바구니 수정하기</Link>
      </div>
    </div>
    {payOpen && <PaymentSheet amount={finalPrice} methodLabel={methodLabel} busy={busy} error={error}
      onPay={() => void pay({ deliveryMemo, pointsUsed })} onClose={() => { if (!busy) setPayOpen(false); }} />}
  </form>;
}

interface CheckoutSummaryProps {
  items: ApiOrder["items"];
  itemsPrice: number;
  shippingFee: number;
  totalPrice: number;
  freeShippingLeft?: number;
  pointsUsed?: number; // 확정된 주문에 쓴 적립금 (totalPrice는 이미 뺀 금액)
  couponDiscount?: number; // 확정된 주문의 쿠폰 할인 (totalPrice는 이미 뺀 금액)
  confirmed?: boolean;
}

function CheckoutSummary({ items, itemsPrice, shippingFee, totalPrice, freeShippingLeft, pointsUsed = 0, couponDiscount = 0, confirmed = false }: CheckoutSummaryProps) {
  return <section aria-label={confirmed ? "확정된 주문 내용" : "주문 상품 요약"} className="min-w-0 pixel-panel p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-extrabold">{confirmed ? "확정된 주문 상품" : "주문 상품"}</h2>
      <p className="text-sm text-sub">{items.length}종 · {items.reduce((sum, item) => sum + item.quantity, 0)}개</p>
    </div>
    <ul className="divide-y divide-line">
      {items.map((item) => <li key={item.product.id} className="flex min-w-0 gap-4 py-4 first:pt-0">
        <Link href={`/products/${item.product.id}`} className="size-16 shrink-0 overflow-hidden pixel-input" aria-label={`${item.product.name} 상품 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- API 상품 이미지를 별도 최적화 서버 없이 표시합니다. */}
          <img src={item.product.imageUrl} alt={item.product.name} className="aspect-square h-full w-full object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/products/${item.product.id}`} className="break-words text-sm font-bold leading-relaxed hover:text-lime">{item.product.name}</Link>
          <p className="mt-1 text-xs text-sub">{formatPrice(item.unitPrice)} × {item.quantity}개</p>
          <p className="mt-1 text-sm font-semibold">{formatPrice(item.subtotal)}</p>
        </div>
      </li>)}
    </ul>
    <div className="mt-2 border-t border-line pt-5">
      <CartPriceSummary itemsPrice={itemsPrice} shippingFee={shippingFee} totalPrice={totalPrice + pointsUsed + couponDiscount} freeShippingLeft={freeShippingLeft} totalLabel="총 주문 금액" />
      {(pointsUsed > 0 || couponDiscount > 0) && <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
        {couponDiscount > 0 && <div className="flex justify-between text-sub"><dt>쿠폰 할인</dt><dd>-{formatPrice(couponDiscount)}</dd></div>}
        {pointsUsed > 0 && <div className="flex justify-between text-sub"><dt>적립금 사용</dt><dd>-{formatPrice(pointsUsed)}</dd></div>}
        <div className="flex justify-between font-bold"><dt>결제 금액</dt><dd className="text-lime">{formatPrice(totalPrice)}</dd></div>
      </dl>}
    </div>
  </section>;
}

function CheckoutLogin() {
  return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">PLAYER LOGIN</p>
    <h2 className="text-xl font-extrabold">로그인하고 주문을 시작해 보세요</h2>
    <p className="mt-3 text-sm text-sub">로그인 계정에 담아 둔 장바구니로 주문해요.</p>
    <Link href="/login?next=/checkout" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">로그인하기</Link>
  </div>;
}

export function CheckoutSkeleton() {
  return <div role="status" aria-label="주문 정보 불러오는 중" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <span className="sr-only">주문 정보를 불러오고 있어요.</span>
    <div className="h-80 animate-pulse rounded-2xl bg-panel" /><div className="h-96 animate-pulse rounded-2xl bg-panel" />
  </div>;
}
