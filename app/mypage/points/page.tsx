import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PointsWallet from "@/components/points/PointsWallet";

export const metadata: Metadata = { title: "적립금 | PIXEL MART" };

export default function PointsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
    <Link href="/mypage" className="text-sm text-sub hover:text-ink">← 마이페이지</Link>
    <p className="stage-kicker mb-3 mt-4 font-pixel text-sm text-mint">MY COINS</p>
    <h1 className="text-3xl font-extrabold">적립금</h1>
    <p className="mb-8 mt-3 text-sm text-sub">주문서에서 1P = 1원으로 쓸 수 있어요. 첫 구매를 하면 1,000P를 받아요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><PointsWallet /></Suspense>
  </section>;
}
