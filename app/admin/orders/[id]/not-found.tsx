import Link from "next/link"; // 목록으로 돌아가는 링크

// 주문번호 형식이 아닌 경로(/admin/orders/abc 등)에서 보여주는 화면
export default function AdminOrderNotFound() {
  return (
    <div className="pixel-panel px-5 py-16 text-center">
      <h2 className="text-xl font-bold text-ink">주문을 찾을 수 없어요</h2>
      <p className="mt-3 text-sm text-sub">주문 번호를 다시 확인해 주세요.</p>
      <Link href="/admin/orders" className="btn-lime mt-6 inline-block px-6 py-3 font-bold text-lime-ink">
        주문 목록으로
      </Link>
    </div>
  );
}
