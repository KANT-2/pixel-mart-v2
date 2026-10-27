import type { Metadata } from "next";
import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import OrderList from "@/components/orders/OrderList";
import { OrderSkeleton } from "@/components/orders/OrderStates";
import { parseOrderPage } from "@/utils/orders";

export const metadata: Metadata = { title: "주문 내역 | PIXEL MART" };

export default function OrdersPage({ searchParams }: PageProps<"/mypage/orders">) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
      <PageHeader back={{ href: "/mypage", label: "마이페이지" }} kicker="MY ORDERS" title="주문 내역" description="주문한 아이템의 배송·구매 확정·반품을 여기서 확인해요." />
      <Suspense fallback={<OrderSkeleton />}>
        <OrdersQuery searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

interface OrdersQueryProps { searchParams: PageProps<"/mypage/orders">["searchParams"]; }

async function OrdersQuery({ searchParams }: OrdersQueryProps) {
  const { page } = await searchParams;
  const currentPage = parseOrderPage(page);
  return <OrderList key={currentPage} page={currentPage} />;
}
