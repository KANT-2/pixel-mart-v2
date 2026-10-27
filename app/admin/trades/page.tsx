import type { Metadata } from "next";
import { Suspense } from "react";
import AdminTradesBoard from "./AdminTradesBoard";
import { parseAdminTradeQuery } from "./adminTrades";

export const metadata: Metadata = { title: "거래글 관리 | PIXEL MART 관리자" };

// 주소창 쿼리(?status=&kind=&q=&page=)는 요청마다 달라서 Suspense 안에서 읽는다 (신고함과 같은 방식)
async function TradesContent({ searchParams }: Pick<PageProps<"/admin/trades">, "searchParams">) {
  const query = parseAdminTradeQuery(await searchParams);
  return <AdminTradesBoard key={`${query.status}|${query.kind}|${query.q}|${query.page}`} {...query} />;
}

// 관리자 거래글 관리 (#103)
export default function AdminTradesPage({ searchParams }: PageProps<"/admin/trades">) {
  return <Suspense fallback={<div role="status" aria-label="거래글 관리 화면 준비 중" className="space-y-3">
    <div className="h-8 w-40 animate-pulse rounded bg-panel" />
    <div className="h-64 w-full animate-pulse rounded-xl bg-panel" />
  </div>}>
    <TradesContent searchParams={searchParams} />
  </Suspense>;
}
