import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import WishlistContents, { WishlistSkeleton } from "@/components/wishlist/WishlistContents";

export const metadata: Metadata = { title: "찜한 아이템 | PIXEL MART" };

export default function WishlistPage({ searchParams }: PageProps<"/mypage/wishlist">) {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="MY FAVORITES" title="찜한 아이템" description="마음에 든 아이템을 모아 두고 천천히 골라 보세요." />
    <Suspense fallback={<WishlistSkeleton />}>
      <WishlistQuery searchParams={searchParams} />
    </Suspense>
  </section>;
}

interface WishlistQueryProps {
  searchParams: PageProps<"/mypage/wishlist">["searchParams"];
}

async function WishlistQuery({ searchParams }: WishlistQueryProps) {
  const { page } = await searchParams;
  const requestedPage = typeof page === "string" && /^[1-9]\d*$/.test(page) ? Number(page) : 1;
  return <WishlistContents page={Number.isSafeInteger(requestedPage) ? requestedPage : 1} />;
}
