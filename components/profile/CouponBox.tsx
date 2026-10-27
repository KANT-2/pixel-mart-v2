"use client"; // 로그인 사용자 쿠폰을 불러오고 코드를 등록한다

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import { ApiError } from "@/lib/api";
import { couponsApi } from "@/lib/coupons";
import type { ApiUserCoupon } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import { couponBenefit } from "@/utils/shop";

type Tab = "available" | "past";

/** 쿠폰함 — 쓸 수 있는 쿠폰 | 지난 쿠폰, 위에서 코드 등록 */
export default function CouponBox() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<{ userId: number; items: ApiUserCoupon[] } | null>(null);
  const [tab, setTab] = useState<Tab>("available");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    couponsApi.list(controller.signal).then((items) => setRows({ userId, items }))
      .catch((cause) => { if (!controller.signal.aborted) setMessage({ ok: false, text: cause instanceof Error ? cause.message : "쿠폰을 불러오지 못했어요." }); });
    return () => controller.abort();
  }, [userId]);

  if (loading) return <div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />;
  if (!user) return <LoginRequiredNotice message="로그인하면 내 쿠폰을 볼 수 있어요." next="/mypage/coupons" />;
  const items = rows?.userId === userId ? rows.items : null;

  async function register(event: React.FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await couponsApi.register(value);
      setRows({ userId: userId as number, items: next });
      setCode("");
      setTab("available");
      setMessage({ ok: true, text: "쿠폰을 받았어요. 주문서에서 바로 쓸 수 있어요." });
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof ApiError ? cause.message : "등록하지 못했어요." });
    } finally {
      setBusy(false);
    }
  }

  const available = items?.filter((row) => row.status === "available") ?? [];
  const past = items?.filter((row) => row.status !== "available") ?? [];
  const shown = tab === "available" ? available : past;

  return <div className="space-y-5">
    <form onSubmit={register} className="pixel-panel p-5">
      <label htmlFor="coupon-code" className="mb-2 block text-sm font-semibold">쿠폰 코드 등록</label>
      <div className="flex gap-2">
        <input id="coupon-code" value={code} maxLength={30} autoComplete="off" disabled={busy} onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="코드를 입력하세요" className="min-w-0 flex-1 pixel-input px-3 py-3 font-mono text-ink focus-visible:outline-2 focus-visible:outline-violet" />
        <button type="submit" disabled={busy || !code.trim()} className="btn-lime shrink-0 px-5 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "등록 중…" : "등록"}</button>
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm ${message.ok ? "text-mint" : "text-pink"}`}>{message.text}</p>}
    </form>

    <div role="group" aria-label="쿠폰 보기" className="segmented h-10 w-full text-sm font-bold sm:w-auto">
      <button type="button" aria-pressed={tab === "available"} onClick={() => setTab("available")}>쓸 수 있는 쿠폰 {available.length}</button>
      <button type="button" aria-pressed={tab === "past"} onClick={() => setTab("past")}>지난 쿠폰 {past.length}</button>
    </div>

    {!items ? <div role="status" aria-label="불러오는 중" className="h-40 animate-pulse rounded-md bg-panel" />
      : shown.length === 0 ? <p className="pixel-panel px-5 py-10 text-center text-sm text-sub">{tab === "available" ? "쓸 수 있는 쿠폰이 없어요." : "사용했거나 기간이 지난 쿠폰이 없어요."}</p>
      : <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((row) => <li key={row.id} className={`relative overflow-hidden pixel-panel p-5 ${row.status === "available" ? "" : "opacity-60"}`}>
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-lime" />
          <p className="text-xl font-extrabold text-lime">{couponBenefit(row)}</p>
          <p className="mt-1 font-bold">{row.name}</p>
          <p className="mt-2 text-xs text-sub">{row.minOrderPrice > 0 ? `${row.minOrderPrice.toLocaleString("ko-KR")}원 이상 주문 시` : "금액 제한 없음"}</p>
          <p className="mt-1 text-xs text-dim">
            {row.status === "used" ? <>사용 완료{row.usedOrderId && <> · <Link href={`/mypage/orders/${row.usedOrderId}`} className="underline underline-offset-2">주문 #{row.usedOrderId}</Link></>}</>
              : row.status === "expired" ? `${formatDate(row.expiresAt)} 만료` : `${formatDate(row.expiresAt)}까지`}
          </p>
        </li>)}
      </ul>}
    <Link href="/products" className="inline-flex btn-pixel px-5 py-3 text-sm font-bold">쿠폰 쓰러 가기</Link>
  </div>;
}
