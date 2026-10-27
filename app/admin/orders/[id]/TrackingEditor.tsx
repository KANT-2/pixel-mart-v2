"use client"; // 택배사·운송장 입력 폼

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { setAdminTracking } from "@/lib/adminReturns";
import type { AdminOrderDetail } from "@/types/admin";
import { COURIERS } from "@/utils/shop";

interface TrackingEditorProps { order: AdminOrderDetail; onSaved: (order: AdminOrderDetail) => void; }

/** 상품 준비중부터 운송장을 넣는다 — 구매자 주문 상세에 배송 조회 링크로 보인다 */
export default function TrackingEditor({ order, onSaved }: TrackingEditorProps) {
  const [courier, setCourier] = useState(order.courier ?? "cj");
  const [number, setNumber] = useState(order.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = /^\d{9,14}$/.test(number);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await setAdminTracking(order.id, courier, number));
      setMessage({ ok: true, text: "운송장을 저장했어요." });
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof ApiError ? cause.message : "저장하지 못했어요." });
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={save} className="pixel-panel p-4">
    <h2 className="text-sm font-bold text-ink">운송장</h2>
    <p className="mt-1 text-xs text-dim">{order.trackingNumber ? `${order.courierLabel} ${order.trackingNumber}` : "배송을 시작하기 전에 운송장을 넣어 주세요."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <label htmlFor="tracking-courier" className="sr-only">택배사</label>
      <select id="tracking-courier" value={courier} disabled={busy} onChange={(event) => setCourier(event.target.value)} className="pixel-input px-3 py-2 text-sm text-ink">
        {COURIERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <label htmlFor="tracking-number" className="sr-only">운송장 번호</label>
      <input id="tracking-number" inputMode="numeric" maxLength={14} value={number} disabled={busy} placeholder="숫자 9~14자리"
        onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} className="min-w-0 flex-1 pixel-input px-3 py-2 font-mono text-sm text-ink" />
      <button type="submit" disabled={busy || !valid} className="btn-pixel min-h-10 px-4 text-sm font-bold disabled:opacity-50">{busy ? "저장 중…" : "저장"}</button>
    </div>
    {message && <p role={message.ok ? "status" : "alert"} className={`mt-2 text-xs ${message.ok ? "text-mint" : "text-pink"}`}>{message.text}</p>}
  </form>;
}
