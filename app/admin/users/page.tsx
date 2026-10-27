import type { Metadata } from "next";
import { Suspense } from "react";
import AdminUsersBoard from "./AdminUsersBoard";
import { parseAdminUserQuery } from "./adminUsers";

export const metadata: Metadata = { title: "사용자 관리 | PIXEL MART 관리자" };

// 주소창 쿼리(?status=&role=&q=&page=)는 요청마다 달라서 Suspense 안에서 읽는다 (신고함과 같은 방식)
async function UsersContent({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const query = parseAdminUserQuery(await searchParams);
  return <AdminUsersBoard key={`${query.status}|${query.role}|${query.q}|${query.page}`} {...query} />;
}

// 관리자 사용자 관리 (#103)
export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return <Suspense fallback={<div role="status" aria-label="사용자 관리 화면 준비 중" className="space-y-3">
    <div className="h-8 w-40 animate-pulse rounded bg-panel" />
    <div className="h-64 w-full animate-pulse rounded-xl bg-panel" />
  </div>}>
    <UsersContent searchParams={searchParams} />
  </Suspense>;
}
