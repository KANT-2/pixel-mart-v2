import type { Metadata } from "next";
import { Suspense } from "react";
import AdminReportsBoard from "./AdminReportsBoard";
import { parseAdminReportQuery } from "./adminReports";

export const metadata: Metadata = { title: "신고함 | PIXEL MART 관리자" };

// 주소창 쿼리(?status=&type=&page=)는 요청마다 달라서 Suspense 안에서 읽는다 (문의 답변 화면과 같은 방식)
async function ReportsContent({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const query = parseAdminReportQuery(await searchParams);
  // 탭 · 종류 · 쪽이 바뀌면 key가 바뀌어 목록을 처음부터 다시 그린다
  return <AdminReportsBoard key={`${query.status}|${query.type}|${query.page}`} {...query} />;
}

// 관리자 신고함 (#103)
export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return <Suspense fallback={<div role="status" aria-label="신고함 준비 중" className="space-y-3">
    <div className="h-8 w-40 animate-pulse rounded bg-panel" />
    <div className="h-32 w-full animate-pulse rounded-xl bg-panel" />
  </div>}>
    <ReportsContent searchParams={searchParams} />
  </Suspense>;
}
