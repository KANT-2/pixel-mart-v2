import type { Metadata } from "next";
import { Suspense } from "react";
import AdminReviewsBoard from "./AdminReviewsBoard";
import { parseAdminReviewQuery } from "./adminReviews";

export const metadata: Metadata = { title: "리뷰 관리 | PIXEL MART 관리자" };

// 주소창 쿼리(?status=&rating=&photo=&q=&page=)는 요청마다 달라서 Suspense 안에서 읽는다 (거래글 관리와 같은 방식)
async function ReviewsContent({ searchParams }: Pick<PageProps<"/admin/reviews">, "searchParams">) {
  const query = parseAdminReviewQuery(await searchParams);
  return <AdminReviewsBoard key={`${query.status}|${query.rating}|${query.photo}|${query.q}|${query.page}`} {...query} />;
}

// 관리자 리뷰 관리 — 상품 리뷰를 살펴보고 숨기거나 다시 보이게 한다
export default function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  return <Suspense fallback={<div role="status" aria-label="리뷰 관리 화면 준비 중" className="space-y-3">
    <div className="h-8 w-40 animate-pulse rounded bg-panel" />
    <div className="h-64 w-full animate-pulse rounded-xl bg-panel" />
  </div>}>
    <ReviewsContent searchParams={searchParams} />
  </Suspense>;
}
