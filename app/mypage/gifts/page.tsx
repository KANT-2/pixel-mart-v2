import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import GiftInbox from "@/components/gifts/GiftInbox";

export const metadata: Metadata = { title: "선물함 | PIXEL MART" };

export default function GiftsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="GIFT BOX" title="선물함" description="거래소에서 이웃과 주고받은 선물이에요. 서로 누구인지·주소는 공개되지 않아요." />
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><GiftInbox /></Suspense>
  </section>;
}
