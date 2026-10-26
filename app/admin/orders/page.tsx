import { Suspense } from "react"; // useSearchParams를 쓰는 클라이언트 화면은 Suspense로 감싸야 한다
import OrdersScreen from "@/app/admin/orders/OrdersScreen"; // 실제 목록 화면 (클라이언트)

// 로그인한 관리자만 보는 데이터라 서버에서 안 불러오고, 전부 OrdersScreen(클라이언트)에서 lib/admin.ts로 불러온다.
// AdminGuard(레이아웃)가 이미 로그인·권한을 확인했으니 이 페이지는 틀만 잡는다.
export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersScreen />
    </Suspense>
  );
}

// OrdersScreen이 처음 뜨기 전(또는 useSearchParams 경계) 보여줄 뼈대 화면
function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-panel" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
