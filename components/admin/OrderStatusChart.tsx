import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다
import type { AdminOrderStatusCounts } from "@/types/admin";

interface OrderStatusChartProps {
  counts: AdminOrderStatusCounts; // 주문 상태 6종 건수
}

// 배송 완료 색 — rarity.ts가 UNIQUE 등급에 금색을 쓰고 있어, 바로 옆 재고 목록의 등급 표시와 헷갈리지 않게 따로 정의한다
const DELIVERED_COLOR = "#4a4770";

// 흐름 4단계만 막대에 들어간다 — 색·이름을 늘 같이 보여줘서 색만으로 구분하지 않는다
const FLOW_STAGES = [
  { key: "paid", label: "주문 완료", color: "var(--color-lime)", textColor: "var(--color-lime-ink)" },
  { key: "preparing", label: "상품 준비중", color: "var(--color-mint)", textColor: "var(--color-lime-ink)" },
  { key: "shipping", label: "배송중", color: "var(--color-violet)", textColor: "#ffffff" },
  { key: "delivered", label: "배송 완료", color: DELIVERED_COLOR, textColor: "#ffffff" },
] as const;

const MIN_LABEL_PERCENT = 8; // 이보다 좁은 구간은 막대 안 숫자를 생략한다(글자가 깨져 보이는 걸 막는다)

export default function OrderStatusChart({ counts }: OrderStatusChartProps) {
  // 막대 퍼센트의 분모 — 흐름 4단계 합(취소 요청·취소 완료는 뺀다)
  const flowTotal = FLOW_STAGES.reduce((sum, stage) => sum + counts[stage.key], 0);
  const grandTotal = flowTotal + counts.cancelRequested + counts.cancelled; // 취소까지 합친 전체 주문 수

  if (grandTotal === 0) {
    return (
      <section className="pixel-panel p-4">
        <h2 className="text-sm font-bold text-ink">주문 단계별 현황</h2>
        <p className="mt-6 text-center text-sm text-dim">아직 들어온 주문이 없어요</p>
      </section>
    );
  }

  // 막대 위 한 줄 요약 — 준비를 시작해야 할 주문이 있는지
  const headline = counts.paid > 0 ? `주문 완료 ${counts.paid}건이 준비 시작을 기다려요` : "처리를 기다리는 주문이 없어요";

  return (
    <section className="pixel-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">주문 단계별 현황</h2>
        <span className="text-xs text-dim">진행 주문 {flowTotal}건</span>
      </div>
      <p className="mt-1 text-xs text-sub">{headline}</p>

      {/* 가로 누적 막대 — 건수 비례 폭, 0건인 단계는 칸을 만들지 않는다 */}
      <div className="mt-3 flex h-8 overflow-hidden rounded-md border border-line">
        {flowTotal === 0 ? (
          <div className="h-full w-full bg-panel-2" />
        ) : (
          FLOW_STAGES.map((stage) => {
            const count = counts[stage.key];
            if (count === 0) return null;
            const percent = (count / flowTotal) * 100;
            return (
              <Link
                key={stage.key}
                href={`/admin/orders?status=${stage.key}`}
                style={{ width: `${percent}%`, backgroundColor: stage.color, color: stage.textColor }}
                className="flex h-full items-center justify-center text-xs font-bold"
                aria-label={`${stage.label} ${count}건 (${Math.round(percent)}%)`}
              >
                {percent >= MIN_LABEL_PERCENT ? count : ""}
              </Link>
            );
          })
        )}
      </div>

      {/* 단계별 행 — 색·이름·비율·건수를 항상 같이 보여준다 */}
      <ul className="mt-3 space-y-1.5">
        {FLOW_STAGES.map((stage) => {
          const count = counts[stage.key];
          const percent = flowTotal === 0 ? 0 : Math.round((count / flowTotal) * 100);
          return (
            <li key={stage.key}>
              <Link href={`/admin/orders?status=${stage.key}`} className="flex items-center gap-2 text-xs hover:text-ink">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-sub">{stage.label}</span>
                <span className="text-dim">{percent}%</span>
                <span className="ml-auto font-bold text-ink">{count}건</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* 흐름 밖 칩 — 취소 요청·취소 완료는 막대 분모에서 뺀다 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/admin/cancels?status=requested" className="rounded-full border border-pink/30 px-3 py-1 text-xs text-pink hover:bg-pink/10">
          취소 요청 {counts.cancelRequested}건
        </Link>
        <Link href="/admin/orders?status=cancelled" className="rounded-full border border-line px-3 py-1 text-xs text-dim hover:text-ink">
          취소 완료 {counts.cancelled}건
        </Link>
      </div>
    </section>
  );
}
