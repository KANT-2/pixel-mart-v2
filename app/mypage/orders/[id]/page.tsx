import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import OrderDetail from "@/components/orders/OrderDetail";
import { OrderSkeleton } from "@/components/orders/OrderStates";
import { parseOrderId } from "@/utils/orders";

export const metadata: Metadata = { title: "주문 상세 | PIXEL MART" };

// 개인 주문 ID는 빌드에서 조회하지 않고 Suspense 안에서 요청 시 해석합니다.
export default function OrderDetailPage({ params, searchParams }: PageProps<"/mypage/orders/[id]">) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <PageHeader back={{ href: "/mypage/orders", label: "주문 내역" }} kicker="ORDER LOG" title="주문 상세" />
      <Suspense fallback={<OrderSkeleton />}>
        <OrderQuery params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function OrderQuery({ params, searchParams }: PageProps<"/mypage/orders/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const orderId = parseOrderId(id);
  if (orderId === null) notFound();
  return <OrderDetail key={orderId} id={orderId} placed={query.placed === "1"} />;
}
