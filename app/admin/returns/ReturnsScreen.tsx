"use client"; // 목록 불러오기·승인/거절 버튼

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyRow from "@/components/admin/EmptyRow";
import { ApiError } from "@/lib/api";
import { getAdminReturnRequests, resolveAdminReturn } from "@/lib/adminReturns";
import type { AdminCancelStatus, AdminReturnRequest, Page } from "@/types/admin";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";
import { RETURN_KIND_LABEL, RETURN_STATUS_LABEL } from "@/utils/shop";

// 요약 카드 3개 — 취소 요청 화면과 같은 모양, 눌러서 그 상태로 거른다 (다시 누르면 전체)
const CARDS: { status: AdminCancelStatus; label: string; hint: string }[] = [
  { status: "requested", label: "처리 대기", hint: "승인 또는 거절이 필요해요" },
  { status: "approved", label: "승인", hint: "환불 또는 재배송을 시작했어요" },
  { status: "rejected", label: "거절", hint: "주문이 배송 완료로 돌아갔어요" },
];
const BADGE: Record<AdminCancelStatus, string> = {
  requested: "border-pink/30 bg-pink/10 text-pink",
  approved: "border-mint/30 bg-mint/10 text-mint",
  rejected: "border-line bg-panel-2 text-dim",
};

interface Action { request: AdminReturnRequest; approve: boolean }

/** 반품·교환 신청 — 반품 승인은 환불(재고·적립금·쿠폰 복구), 교환 승인은 재배송 준비, 거절은 배송 완료로 */
export default function ReturnsScreen() {
  const [status, setStatus] = useState<AdminCancelStatus | null>("requested");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ key: string; page: Page<AdminReturnRequest> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [counts, setCounts] = useState<Record<AdminCancelStatus, number> | null>(null);
  const key = `${status}:${page}:${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all(CARDS.map((card) => getAdminReturnRequests(card.status, 1)))
      .then(([requested, approved, rejected]) => { if (!cancelled) setCounts({ requested: requested.total, approved: approved.total, rejected: rejected.total }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    getAdminReturnRequests(status, page)
      .then((result) => { if (!cancelled) { setData({ key, page: result }); setError(null); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof ApiError ? cause.message : "불러오지 못했어요."); });
    return () => { cancelled = true; };
  }, [status, page, key]);

  async function resolve() {
    if (!action) return;
    setBusy(true);
    try {
      await resolveAdminReturn(action.request.id, action.approve);
      setNotice(`#${action.request.orderId} ${RETURN_KIND_LABEL[action.request.kind]} 신청을 ${action.approve ? "승인" : "거절"}했어요. 구매자에게 알림이 갔어요.`);
      setAction(null);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "처리하지 못했어요.");
      setAction(null);
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.key === key ? data.page : null;
  const columns: AdminTableColumn<AdminReturnRequest>[] = [
    { header: "주문", render: (row) => <Link href={`/admin/orders/${row.orderId}`} className="font-bold text-mint underline-offset-2 hover:underline">#{row.orderId}</Link> },
    { header: "종류", render: (row) => RETURN_KIND_LABEL[row.kind] },
    { header: "사유", className: "max-w-64", render: (row) => <span className="break-words">{row.reason}</span> },
    { header: "주문자", render: (row) => row.buyerNickname },
    { header: "금액", align: "right", render: (row) => formatPrice(row.totalPrice) },
    { header: "신청", render: (row) => formatDate(row.createdAt) },
    { header: "상태", render: (row) => <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${BADGE[row.status]}`}>{RETURN_STATUS_LABEL[row.status]}</span> },
    { header: "처리", render: (row) => row.status === "requested" ? <div className="flex gap-1.5">
      <button type="button" onClick={() => setAction({ request: row, approve: true })} className="btn-lime min-h-9 px-3 text-xs font-bold text-lime-ink">승인</button>
      <button type="button" onClick={() => setAction({ request: row, approve: false })} className="btn-pixel min-h-9 border-pink/60 px-3 text-xs font-bold text-pink">거절</button>
    </div> : <span className="text-xs text-dim">처리됨</span> },
  ];

  return <div className="space-y-4">
    <header>
      <h1 className="text-xl font-bold text-ink">반품·교환</h1>
      <p className="mt-1 text-sm text-sub">배송 완료 뒤 구매 확정 전에 들어온 신청이에요. 반품을 승인하면 환불과 재고·적립금·쿠폰 복구가, 교환을 승인하면 재배송 준비가 시작돼요.</p>
    </header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const count = counts?.[card.status] ?? 0;
        const active = status === card.status;
        return <button key={card.status} type="button" aria-pressed={active} onClick={() => { setStatus(active ? null : card.status); setPage(1); }}
          className={`pixel-panel p-3 text-left ${active ? "border-mint" : ""}`}>
          <p className="text-xs text-dim">{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.status === "requested" && count > 0 ? "text-pink" : "text-ink"}`}>{count}</p>
          <p className="mt-1 text-xs text-dim">{card.hint}</p>
        </button>;
      })}
    </div>
    <p className="text-xs text-dim">
      {status ? `${CARDS.find((card) => card.status === status)?.label} 신청만 보는 중 · ` : "전체 신청 · "}
      {status && <button type="button" onClick={() => { setStatus(null); setPage(1); }} className="text-mint underline underline-offset-2">전체 보기</button>}
      {rows && !status && `총 ${rows.total}건`}
    </p>
    {notice && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-pink/30 bg-panel p-3 text-sm text-pink">{error}</p>}
    {!rows ? <div role="status" aria-label="불러오는 중" className="h-48 animate-pulse rounded-xl bg-panel" />
      : <AdminTable columns={columns} rows={rows.items} rowKey={(row) => row.id} mobileCards
        empty={<EmptyRow colSpan={columns.length} message={status === "requested" ? "처리할 신청이 없어요." : "신청이 없어요."} />} />}
    {rows && rows.totalPages > 1 && <div className="flex items-center justify-center gap-3 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-pixel min-h-9 px-3 disabled:opacity-40">이전</button>
      <span className="text-sub">{page} / {rows.totalPages}</span>
      <button type="button" disabled={page >= rows.totalPages} onClick={() => setPage(page + 1)} className="btn-pixel min-h-9 px-3 disabled:opacity-40">다음</button>
    </div>}
    <ConfirmDialog open={action !== null}
      title={action ? `#${action.request.orderId} ${RETURN_KIND_LABEL[action.request.kind]} 신청을 ${action.approve ? "승인" : "거절"}할까요?` : ""}
      description={!action ? undefined : !action.approve ? "주문이 배송 완료 상태로 돌아가요."
        : action.request.kind === "return" ? "주문이 반품 완료가 되고, 재고·적립금·쿠폰을 돌려줘요." : "주문이 상품 준비중으로 돌아가 다시 배송해요."}
      confirmLabel={busy ? "처리 중…" : action?.approve ? "승인" : "거절"} danger={action ? !action.approve : false}
      onConfirm={() => { if (!busy) void resolve(); }} onClose={() => { if (!busy) setAction(null); }} />
  </div>;
}
