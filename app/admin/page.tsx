import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다

// 관리자 대시보드 자리표시 — 실제 통계·요약은 다음 이슈에서 만든다
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">관리자 대시보드</h1>
      <p className="mt-1 text-sm text-sub">대시보드 내용은 다음 이슈에서 채울 예정이에요. 아래에서 바로 가고 싶은 화면을 골라 주세요.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/orders" className="pixel-panel block p-4 hover:border-violet">
          <p className="font-bold text-ink">주문</p>
          <p className="mt-1 text-xs text-sub">주문 목록·상태 변경</p>
        </Link>
        <Link href="/admin/cancels" className="pixel-panel block p-4 hover:border-violet">
          <p className="font-bold text-ink">취소 요청</p>
          <p className="mt-1 text-xs text-sub">취소 승인·거절</p>
        </Link>
        <Link href="/admin/questions" className="pixel-panel block p-4 hover:border-violet">
          <p className="font-bold text-ink">문의</p>
          <p className="mt-1 text-xs text-sub">상품 문의 답변</p>
        </Link>
      </div>
    </div>
  );
}
