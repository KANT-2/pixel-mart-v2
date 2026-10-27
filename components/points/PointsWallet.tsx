"use client"; // 로그인 사용자 적립금은 브라우저에서 불러온다

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import PixelIcon from "@/components/PixelIcon";
import { pointsApi } from "@/lib/points";
import type { ApiPointTransaction } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import { formatPointAmount, POINT_KIND_LABEL } from "@/utils/points";

interface WalletState {
  userId: number;
  balance: number;
  items: ApiPointTransaction[];
  page: number;
  totalPages: number;
}

/** 적립금 잔액 + 적립·사용 기록 (20개씩 더 보기) */
export default function PointsWallet() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    Promise.all([pointsApi.balance(controller.signal), pointsApi.history(1, controller.signal)])
      .then(([points, history]) => setWallet({ userId, balance: points.balance, items: history.items, page: 1, totalPages: history.totalPages }))
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "적립금을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [userId]);

  if (loading) return <div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />;
  if (!user) return <LoginRequiredNotice message="로그인하면 내 적립금을 볼 수 있어요." next="/mypage/points" />;
  if (error) return <p role="alert" className="pixel-panel p-6 text-sm text-pink">{error}</p>;
  const mine = wallet?.userId === userId ? wallet : null;
  if (!mine) return <div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />;

  async function loadMore() {
    if (!mine || more) return;
    setMore(true);
    try {
      const next = await pointsApi.history(mine.page + 1);
      setWallet({ ...mine, items: [...mine.items, ...next.items], page: next.page, totalPages: next.totalPages });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기록을 더 불러오지 못했어요.");
    } finally {
      setMore(false);
    }
  }

  return <div className="space-y-6">
    <section aria-label="보유 적립금" className="pixel-panel flex flex-wrap items-center justify-between gap-4 p-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-lg bg-panel-2"><PixelIcon name="coin" className="size-8" /></span>
        <div>
          <p className="text-sm text-sub">보유 적립금</p>
          <p className="text-3xl font-extrabold text-lime">{mine.balance.toLocaleString("ko-KR")}P</p>
        </div>
      </div>
      <Link href="/products" className="btn-lime px-5 py-3 text-sm font-bold text-lime-ink">적립금으로 쇼핑하기</Link>
    </section>

    <section aria-labelledby="point-history" className="pixel-panel p-5 sm:p-6">
      <h2 id="point-history" className="mb-4 text-lg font-extrabold">적립·사용 기록</h2>
      {mine.items.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-sub">아직 기록이 없어요. 첫 구매를 하면 1,000P가 쌓여요.</p>
          <Link href="/products" className="mt-4 inline-flex btn-pixel px-4 py-2 text-sm font-bold">상품 보러가기</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {mine.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">{POINT_KIND_LABEL[item.kind] ?? item.kind}</p>
              <p className="mt-1 text-xs text-dim">
                {formatDate(item.createdAt)} · <Link href={`/mypage/orders/${item.orderId}`} className="underline underline-offset-2 hover:text-ink">주문 #{item.orderId}</Link>
              </p>
            </div>
            <span className={`shrink-0 font-bold ${item.amount > 0 ? "text-lime" : "text-sub"}`}>{formatPointAmount(item.amount)}</span>
          </li>)}
        </ul>
      )}
      {mine.page < mine.totalPages && <button type="button" disabled={more} onClick={() => void loadMore()}
        className="mt-4 w-full btn-pixel py-2.5 text-sm font-bold disabled:opacity-50">{more ? "불러오는 중…" : "기록 더 보기"}</button>}
    </section>
  </div>;
}
