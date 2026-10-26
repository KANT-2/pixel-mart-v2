import { notFound } from "next/navigation"; // 주문번호 형식이 아니면 같은 폴더의 not-found.tsx를 보여준다
import { Suspense } from "react";
import OrderDetailScreen from "@/app/admin/orders/[id]/OrderDetailScreen"; // 실제 상세 화면 (클라이언트)

// API가 꺼져 있어도(mock 모드) 상세 경로를 최소 1개 미리 만들어 둔다
export function generateStaticParams() {
  return [{ id: "1042" }];
}

// 주문 하나의 데이터는 로그인한 관리자만 보므로 서버에서 안 불러오고, 번호만 확인한 뒤 클라이언트 화면에 넘긴다.
export default function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetailQuery params={params} />
    </Suspense>
  );
}

async function OrderDetailQuery({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  const { id } = await params; // Next 16: params는 Promise
  const orderId = Number(id); // 주문번호는 항상 숫자
  if (!Number.isInteger(orderId) || orderId <= 0) notFound(); // 숫자가 아니면 바로 "없는 주문" 화면
  return <OrderDetailScreen key={orderId} id={orderId} />;
}

function OrderDetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="주문 상세 불러오는 중">
      <div className="h-8 w-48 animate-pulse rounded bg-panel" />
      <div className="h-24 animate-pulse rounded-xl bg-panel" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-panel" />
        <div className="h-40 animate-pulse rounded-xl bg-panel" />
      </div>
    </div>
  );
}
