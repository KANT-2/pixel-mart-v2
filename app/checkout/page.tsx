import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import CheckoutContents from "@/components/orders/CheckoutContents";

export const metadata: Metadata = { title: "주문하기 | PIXEL MART" };

export default function CheckoutPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <PageHeader back={{ href: "/cart", label: "장바구니" }} kicker="READY TO EQUIP" title="주문하기" description="배송지와 할인을 확인하고 결제해 주세요. 장바구니에 담긴 상품 전체를 주문해요." />
      <CheckoutContents />
    </section>
  );
}
