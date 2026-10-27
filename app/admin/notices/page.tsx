import { Suspense } from "react"; // #101(app/admin/products)과 같은 틀
import NoticesScreen from "@/app/admin/notices/NoticesScreen";

// 공지 목록은 로그인한 관리자만 보는 데이터라 서버에서 안 불러오고, NoticesScreen(클라이언트)에서 lib/notices.ts로 불러온다.
// AdminGuard(레이아웃)가 이미 로그인·권한을 확인했으니 이 페이지는 틀만 잡는다.
export default function AdminNoticesPage() {
  return (
    <Suspense fallback={<NoticesSkeleton />}>
      <NoticesScreen />
    </Suspense>
  );
}

function NoticesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
