import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CouponBox from "@/components/profile/CouponBox";

export const metadata: Metadata = { title: "쿠폰함 | PIXEL MART" };

export default function CouponsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
    <Link href="/mypage" className="text-sm text-sub hover:text-ink">← 마이페이지</Link>
    <p className="stage-kicker mb-3 mt-4 font-pixel text-sm text-mint">MY COUPONS</p>
    <h1 className="text-3xl font-extrabold">쿠폰함</h1>
    <p className="mb-8 mt-3 text-sm text-sub">주문서에서 쿠폰 하나를 골라 상품 금액을 할인받을 수 있어요. 처음 오면 웰컴 쿠폰을 드려요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><CouponBox /></Suspense>
  </section>;
}
