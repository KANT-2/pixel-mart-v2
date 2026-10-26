"use client"; // 데이터를 직접 불러오고 버튼을 다뤄야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import OrderStatusBadge from "@/components/orders/OrderStatusBadge"; // 다른 화면이 이미 만든 상태 배지 — 읽기 전용으로 가져다 쓴다
import { ApiError } from "@/lib/api";
import { advanceAdminOrder, getAdminOrder } from "@/lib/admin";
import type { AdminOrderDetail, AdminOrderItem, AdminOrderStatus } from "@/types/admin";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";

interface OrderDetailScreenProps { id: number }

// 한 칸씩만 진행하는 배송 단계 — mocks/admin.ts·백엔드와 같은 순서
const FLOW: AdminOrderStatus[] = ["paid", "preparing", "shipping", "delivered"];
const NEXT_BUTTON_LABEL: Partial<Record<AdminOrderStatus, string>> = { paid: "준비 시작", preparing: "배송 시작", shipping: "배송 완료" };
const NEXT_STATUS_LABEL: Partial<Record<AdminOrderStatus, string>> = { paid: "상품 준비중", preparing: "배송중", shipping: "배송 완료" };

export default function OrderDetailScreen({ id }: OrderDetailScreenProps) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false); // 주문이 아예 없을 때(404)
  const [loadError, setLoadError] = useState<string | null>(null); // 그 외 조회 실패
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    setNotFoundError(false);
    try {
      const detail = await getAdminOrder(id);
      if (signal.aborted) return;
      setOrder(detail);
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 404) setNotFoundError(true);
      else setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주문을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  async function confirmAdvance() {
    setAdvancing(true);
    setActionError(null);
    try {
      const updated = await advanceAdminOrder(id);
      setOrder(updated);
      setConfirmOpen(false);
      setSuccessMessage(`"${updated.statusLabel}"으로 넘겼어요. 구매자에게 알림을 보냈어요.`);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMessage(null), 3000);
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setAdvancing(false);
    }
  }

  if (notFoundError) {
    return (
      <div className="pixel-panel px-5 py-16 text-center">
        <h2 className="text-xl font-bold text-ink">주문을 찾을 수 없어요</h2>
        <p className="mt-3 text-sm text-sub">주문 번호를 다시 확인해 주세요.</p>
        <Link href="/admin/orders" className="btn-lime mt-6 inline-block px-6 py-3 font-bold text-lime-ink">주문 목록으로</Link>
      </div>
    );
  }

  if (!order && loading) {
    return (
      <div className="space-y-4" role="status" aria-label="주문 상세 불러오는 중">
        <div className="h-8 w-48 animate-pulse rounded bg-panel" />
        <div className="h-24 animate-pulse rounded-xl bg-panel" />
      </div>
    );
  }

  if (!order) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
        <p className="text-sm text-pink">{loadError}</p>
        <button type="button" onClick={() => void load(new AbortController().signal)} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
      </div>
    );
  }

  const nextButtonLabel = NEXT_BUTTON_LABEL[order.status];
  const itemColumns: AdminTableColumn<AdminOrderItem>[] = [
    { header: "상품명", render: (item) => item.productName },
    { header: "수량", align: "right", render: (item) => `${item.quantity}개` },
    { header: "단가", align: "right", render: (item) => formatPrice(item.unitPrice) },
    { header: "금액", align: "right", render: (item) => formatPrice(item.unitPrice * item.quantity) },
  ];
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6 pb-24"> {/* 아래쪽 고정 액션 바에 내용이 가리지 않게 여백을 둔다 */}
      <Link href="/admin/orders" className="inline-block text-sm text-sub hover:text-ink">← 주문 목록</Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-ink">주문 #{order.id}</h1>
        <OrderStatusBadge status={order.status} label={order.statusLabel} />
        <time dateTime={order.createdAt} className="text-sm text-dim">{formatDate(order.createdAt)}</time>
      </header>

      {successMessage && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{successMessage}</p>}
      {actionError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-3">
          <p className="text-sm text-pink">{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} aria-label="오류 메시지 닫기" className="btn-pixel min-h-11 min-w-11 px-2 text-sm font-bold">✕</button>
        </div>
      )}

      {/* 배송 진행 막대 — 취소 요청/취소된 주문은 안내 박스로 대신한다 */}
      {order.status === "cancel_requested" || order.status === "cancelled" ? (
        <div className="pixel-panel p-4 text-sm text-sub">
          {order.status === "cancel_requested"
            ? "취소 요청이 들어온 주문이에요. 배송 단계는 멈춰 있고, 취소 요청 화면에서 처리해요."
            : "취소가 승인된 주문이에요. 더 진행되지 않아요."}
        </div>
      ) : (
        <ol aria-label="배송 진행 단계" className="flex items-center gap-1">
          {FLOW.map((step, index) => {
            const currentIndex = FLOW.indexOf(order.status);
            const reached = currentIndex >= index; // 지난 단계·현재 단계
            const current = currentIndex === index;
            return (
              <li key={step} className="flex min-w-0 flex-1 items-center gap-1">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${reached ? "bg-lime text-lime-ink" : "border border-line text-dim"}`}>
                  {reached && !current ? "✓" : index + 1}
                </span>
                <span className={`truncate text-xs ${current ? "font-bold text-ink" : reached ? "text-sub" : "text-dim"}`}>
                  {["결제완료", "상품 준비중", "배송중", "배송 완료"][index]}
                </span>
                {index < FLOW.length - 1 && <span aria-hidden="true" className={`h-0.5 min-w-2 flex-1 ${currentIndex > index ? "bg-lime" : "bg-line"}`} />}
              </li>
            );
          })}
        </ol>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="pixel-panel p-4">
          <h2 className="text-sm font-bold text-ink">받는 사람</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-dim">이름</dt><dd>{order.recipientName}</dd></div>
            <div><dt className="text-dim">주소</dt><dd className="whitespace-pre-line break-words">{order.address}</dd></div>
            <div><dt className="text-dim">주문자</dt><dd>{order.buyerNickname} · {order.buyerEmail}</dd></div>
          </dl>
        </section>
        <section className="pixel-panel p-4">
          <h2 className="text-sm font-bold text-ink">결제 금액</h2>
          <p className="mt-3 text-2xl font-bold text-lime">{formatPrice(order.totalPrice)}</p>
          <p className="mt-1 text-xs text-dim">상품 {order.items.length}종 · 총 {totalQuantity}개</p>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">주문 상품</h2>
        <AdminTable columns={itemColumns} rows={order.items} rowKey={(item) => item.productName} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">상태 이력</h2>
        <ul className="space-y-2">
          {order.timeline.map((entry, index) => {
            const isCancelRelated = entry.status === "cancel_requested" || entry.status === "cancelled";
            return (
              <li key={`${entry.status}-${index}`} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${isCancelRelated ? "bg-pink" : "bg-mint"}`} />
                <span className="font-bold text-ink">{entry.label}</span>
                <time dateTime={entry.changedAt} className="text-xs text-dim">{formatDate(entry.changedAt)}</time>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 하단 고정 액션 바 */}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-panel p-4 md:-mx-6">
        {nextButtonLabel ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-sub">다음 단계: {NEXT_STATUS_LABEL[order.status]} · 넘기면 구매자에게 알림이 가요.</p>
            <button type="button" onClick={() => setConfirmOpen(true)} className="btn-lime min-h-11 px-5 text-sm font-bold text-lime-ink">
              {nextButtonLabel} →
            </button>
          </div>
        ) : (
          <p className="text-sm text-dim">
            {order.status === "delivered" && "모두 끝난 주문이에요."}
            {order.status === "cancelled" && "취소된 주문이에요."}
            {order.status === "cancel_requested" && "취소 요청에서 처리해요."}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`#${order.id} 주문을 넘길까요?`}
        description={`"${order.statusLabel}"에서 "${NEXT_STATUS_LABEL[order.status]}" 단계로 바뀌고, 구매자에게 알림이 가요.`}
        confirmLabel={advancing ? "처리 중…" : "넘기기"}
        onConfirm={() => { if (!advancing) void confirmAdvance(); }}
        onClose={() => { if (!advancing) setConfirmOpen(false); }}
      />
    </div>
  );
}
