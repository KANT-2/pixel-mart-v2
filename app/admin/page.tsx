"use client"; // 숫자를 직접 불러와야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다
import { useCallback, useEffect, useState } from "react";
import LowStockList from "@/components/admin/LowStockList";
import OrderStatusChart from "@/components/admin/OrderStatusChart";
import { ApiError } from "@/lib/api";
import { getAdminSummary } from "@/lib/admin";
import type { AdminSummary } from "@/types/admin";

// 숫자 카드 4개의 키 — AdminSummary 중 숫자 필드만 (orderStatusCounts·lowStockProducts는 따로 그린다)
type SummaryCardKey = "ordersToday" | "preparingOrders" | "pendingCancelRequests" | "unansweredQuestions";

// 카드 4개 정의
interface SummaryCard {
  key: SummaryCardKey; // summary 객체에서 꺼낼 숫자 키
  label: string; // 카드 제목
  href: string; // 눌렀을 때 이동할 주소 (#98: 실제 화면이 받는 쿼리에 맞춤)
  hint: string; // 건수가 있을 때 보여줄 안내
  emptyHint: string; // 0건일 때 보여줄 안내
}

// 숫자 카드 4개 — 순서는 이슈 #98 본문과 같다
const CARDS: SummaryCard[] = [
  { key: "ordersToday", label: "오늘 들어온 주문", href: "/admin/orders", hint: "오늘 들어온 주문이에요.", emptyHint: "오늘 들어온 주문이 없어요." },
  { key: "preparingOrders", label: "배송 준비중", href: "/admin/orders?status=preparing", hint: "준비를 시작해 주세요.", emptyHint: "준비 중인 주문이 없어요." },
  { key: "pendingCancelRequests", label: "취소 요청 대기", href: "/admin/cancels?status=requested", hint: "승인·거절을 기다리고 있어요.", emptyHint: "처리할 취소 요청이 없어요." },
  { key: "unansweredQuestions", label: "미답변 문의", href: "/admin/questions", hint: "답변을 기다리고 있어요.", emptyHint: "답변할 문의가 없어요." },
];

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null); // 숫자 4개
  const [loading, setLoading] = useState(true); // 처음 불러오는 중인지
  const [error, setError] = useState<string | null>(null); // 조회 실패 메시지

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getAdminSummary()); // 숫자 4개를 한 번에 받아온다
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면에 들어오자마자 로딩 상태로 바로 불러온다
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-ink">관리자 대시보드</h1>
      <p className="mt-1 text-sm text-sub">오늘 처리할 일을 숫자로 확인하고, 카드를 눌러 바로 이동해 주세요.</p>

      {error && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
          <p className="text-sm text-pink">{error}</p>
          <button type="button" onClick={() => void load()} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      {!error && loading && (
        <>
          {/* 숫자 4개가 올 자리를 뼈대로 먼저 보여준다 — 넓은 화면 4열, 1100px 이하 2×2, 480px 이하는 간격만 줄어든다 */}
          <div
            className="mt-6 grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4 max-[480px]:gap-2"
            role="status"
            aria-label="대시보드 숫자 불러오는 중"
          >
            {CARDS.map((card) => (
              <div key={card.key} className="pixel-panel h-24 animate-pulse p-4" />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="pixel-panel h-72 animate-pulse p-4" />
            <div className="pixel-panel h-72 animate-pulse p-4" />
          </div>
        </>
      )}

      {!error && !loading && summary && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4 max-[480px]:gap-2">
            {CARDS.map((card) => {
              const count = summary[card.key]; // 이 카드의 숫자
              return (
                <Link key={card.key} href={card.href} className="pixel-panel block p-4 hover:border-violet">
                  <p className="text-xs text-dim">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-ink">{count}</p>
                  <p className="mt-1 text-xs text-sub">{count === 0 ? card.emptyHint : card.hint}</p>
                </Link>
              );
            })}
          </div>

          {/* 숫자 카드 아래 두 영역 — 좁아지면 위아래로 쌓인다(lg 이상에서만 나란히) */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrderStatusChart counts={summary.orderStatusCounts} />
            <LowStockList products={summary.lowStockProducts} />
          </div>
        </>
      )}
    </div>
  );
}
