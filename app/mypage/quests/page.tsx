import type { Metadata } from "next";
import Link from "next/link";
import HomeCarousel from "@/components/home/HomeCarousel";

export const metadata: Metadata = { title: "내 퀘스트 | PIXEL MART" };

export default function QuestsPage() {
  return <>
    <div className="mx-auto max-w-6xl px-4 pt-8"><Link href="/mypage" className="text-sm text-mint">← 마이페이지</Link></div>
    <HomeCarousel questOnly />
  </>;
}
