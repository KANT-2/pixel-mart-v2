import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AddressBook from "@/components/profile/AddressBook";

export const metadata: Metadata = { title: "배송지 관리 | PIXEL MART" };

export default function AddressesPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
    <Link href="/mypage" className="text-sm text-sub hover:text-ink">← 마이페이지</Link>
    <p className="stage-kicker mb-3 mt-4 font-pixel text-sm text-mint">MY ADDRESS</p>
    <h1 className="text-3xl font-extrabold">배송지 관리</h1>
    <p className="mb-8 mt-3 text-sm text-sub">기본 배송지는 주문서에 자동으로 채워져요. 최대 10개까지 저장할 수 있어요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><AddressBook /></Suspense>
  </section>;
}
