import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import AddressBook from "@/components/profile/AddressBook";

export const metadata: Metadata = { title: "배송지 관리 | PIXEL MART" };

export default function AddressesPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="MY ADDRESS" title="배송지 관리" description="기본 배송지는 주문서에 자동으로 채워져요. 최대 10개까지 저장할 수 있어요." />
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><AddressBook /></Suspense>
  </section>;
}
