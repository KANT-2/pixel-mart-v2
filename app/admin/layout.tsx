import type { Metadata } from "next";
import AdminGuard from "@/components/admin/AdminGuard"; // 로그인·권한 확인
import AdminNav from "@/components/admin/AdminNav"; // 왼쪽(모바일은 위쪽) 메뉴

// 관리자 화면 탭 제목 · 검색엔진에 노출하지 않음 (각 화면이 제목을 따로 정하면 그 제목이 우선) (#108)
export const metadata: Metadata = { title: "관리자 | PIXEL MART", robots: { index: false, follow: false } };

// /admin 아래 모든 화면에 공통으로 적용되는 틀 — 권한 확인 후 메뉴 + 내용을 보여 준다
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminGuard>
      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </AdminGuard>
  );
}
