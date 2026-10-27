import type { Metadata } from "next";
import AdminBadgesBoard from "./AdminBadgesBoard";

export const metadata: Metadata = { title: "뱃지 | PIXEL MART 관리자" };

// 관리자 뱃지 (#103) — 주소창 쿼리가 없어서 바로 클라이언트 화면을 그린다
export default function AdminBadgesPage() {
  return <AdminBadgesBoard />;
}
