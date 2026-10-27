import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import PointsWallet from "@/components/points/PointsWallet";

export const metadata: Metadata = { title: "적립금 | PIXEL MART" };

export default function PointsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="MY COINS" title="적립금" description="주문서에서 1P = 1원으로 쓸 수 있어요. 첫 구매를 하면 1,000P, 구매 확정하면 결제 금액의 1%를 받아요." />
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><PointsWallet /></Suspense>
  </section>;
}
