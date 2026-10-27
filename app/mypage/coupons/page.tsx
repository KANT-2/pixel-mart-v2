import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import CouponBox from "@/components/profile/CouponBox";

export const metadata: Metadata = { title: "쿠폰함 | PIXEL MART" };

export default function CouponsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="MY COUPONS" title="쿠폰함" description="주문서에서 쿠폰 하나를 골라 상품 금액을 할인받을 수 있어요. 처음 오면 웰컴 쿠폰을 드려요." />
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><CouponBox /></Suspense>
  </section>;
}
