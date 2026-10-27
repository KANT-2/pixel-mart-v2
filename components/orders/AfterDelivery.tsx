"use client"; // 구매 확정 · 반품/교환 신청 버튼

import Link from "next/link";
import { useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { ordersApi } from "@/lib/orders";
import type { ApiOrderDetail } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import { afterDeliveryActions, RETURN_KIND_LABEL, RETURN_STATUS_LABEL } from "@/utils/shop";

interface AfterDeliveryProps {
  order: ApiOrderDetail;
  disabled: boolean;
  onChanged: () => Promise<void>;
}

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint";
type Kind = "return" | "exchange";

/** 배송 완료 뒤 — 구매 확정(1% 적립) 또는 반품·교환 신청, 신청 결과 안내 */
export default function AfterDelivery({ order, disabled, onChanged }: AfterDeliveryProps) {
  const id = useId();
  const [kind, setKind] = useState<Kind | null>(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { canConfirm, canReturn } = afterDeliveryActions(order);
  const request = order.returnRequest;

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      const message = await action();
      setNotice(message);
      setKind(null);
      setConfirming(false);
      setReason("");
      await onChanged();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const confirm = () => run(async () => {
    const result = await ordersApi.confirm(order.id);
    return result.reward > 0 ? `구매를 확정했어요. 적립금 ${result.reward.toLocaleString("ko-KR")}P가 쌓였어요.` : "구매를 확정했어요.";
  });
  const submitReturn = (event: React.FormEvent) => {
    event.preventDefault();
    if (!kind) return;
    const text = reason.trim();
    if (Array.from(text).length < 2) { setError("사유를 2자 이상 적어 주세요."); return; }
    void run(async () => (await ordersApi.requestReturn(order.id, kind, text)).message);
  };

  const locked = disabled || busy;
  if (!canConfirm && !canReturn && !request && !order.confirmedAt && !notice) return null;

  return <section aria-labelledby={`${id}-title`} className="pixel-panel p-5 sm:p-6">
    <h2 id={`${id}-title`} className="text-lg font-extrabold">{order.confirmedAt ? "구매 확정" : "받은 상품은 어떠세요?"}</h2>
    {notice && <p role="status" className="mt-3 rounded-lg border border-mint/30 bg-mint/5 p-3 text-sm text-mint">{notice}</p>}
    {order.confirmedAt && <p className="mt-2 text-sm text-sub">
      <time dateTime={order.confirmedAt}>{formatDate(order.confirmedAt)}</time>에 구매를 확정했어요. 리뷰로 다른 사람에게 알려 주세요.
    </p>}
    {request && <div className="mt-3 rounded-lg border border-line bg-panel-2 p-4 text-sm">
      <p className="font-bold">{RETURN_KIND_LABEL[request.kind]} 신청 · <span className={request.status === "rejected" ? "text-pink" : "text-mint"}>{RETURN_STATUS_LABEL[request.status]}</span></p>
      <p className="mt-1 break-words text-sub">사유: {request.reason}</p>
      <p className="mt-1 text-xs text-dim">
        {request.status === "requested" && "관리자가 확인하면 알림으로 알려 드려요."}
        {request.status === "approved" && request.kind === "return" && "반품이 끝나 결제가 환불됐어요. 쓴 적립금·쿠폰도 돌려드렸어요."}
        {request.status === "approved" && request.kind === "exchange" && "새 상품을 준비해서 다시 보내 드려요."}
        {request.status === "rejected" && "신청이 거절돼 배송 완료 상태로 돌아왔어요. 궁금한 점은 고객센터로 문의해 주세요."}
      </p>
    </div>}
    {(canConfirm || canReturn) && <>
      <p className="mt-2 text-sm leading-relaxed text-sub">상품에 문제가 없으면 구매를 확정해 주세요. 결제 금액의 1%를 적립금으로 드려요. 확정한 뒤에는 반품·교환을 할 수 없어요.</p>
      {kind === null && !confirming && <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={locked} onClick={() => setConfirming(true)} className={`btn-lime px-4 py-2.5 text-sm font-bold text-lime-ink disabled:opacity-50 ${focusClass}`}>구매 확정</button>
        <button type="button" disabled={locked} onClick={() => setKind("exchange")} className={`btn-pixel px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${focusClass}`}>교환 신청</button>
        <button type="button" disabled={locked} onClick={() => setKind("return")} className={`btn-pixel px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${focusClass}`}>반품 신청</button>
      </div>}
      {confirming && <div className="mt-4 rounded-lg border border-mint/30 bg-panel-2 p-4">
        <p className="text-sm font-bold">구매를 확정할까요?</p>
        <p className="mt-1 text-xs text-sub">확정하면 반품·교환을 신청할 수 없어요.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={locked} onClick={() => void confirm()} className={`btn-lime px-4 py-2 text-sm font-bold text-lime-ink disabled:opacity-50 ${focusClass}`}>{busy ? "확정 중…" : "확정하기"}</button>
          <button type="button" disabled={locked} onClick={() => setConfirming(false)} className={`rounded-lg border border-line px-4 py-2 text-sm text-sub ${focusClass}`}>닫기</button>
        </div>
      </div>}
      {kind && <form onSubmit={submitReturn} noValidate className="mt-4 space-y-3">
        <label htmlFor={`${id}-reason`} className="block text-sm font-semibold">{RETURN_KIND_LABEL[kind]} 사유</label>
        <textarea id={`${id}-reason`} rows={3} maxLength={200} value={reason} disabled={locked}
          onChange={(event) => { setReason(event.target.value); setError(null); }}
          placeholder={kind === "exchange" ? "예) 받은 색상이 주문과 달라요" : "예) 상품이 파손돼서 왔어요"}
          className={`block w-full resize-y pixel-input px-3 py-3 text-sm text-ink placeholder:text-dim ${focusClass}`} />
        <p className="text-xs text-dim">{kind === "return" ? "반품이 승인되면 결제 금액이 환불되고, 쓴 적립금·쿠폰도 돌려드려요." : "교환이 승인되면 새 상품을 다시 보내 드려요."}</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={locked} className={`rounded-lg border border-pink/30 bg-pink/10 px-4 py-2.5 text-sm font-bold text-pink disabled:opacity-50 ${focusClass}`}>{busy ? "신청 중…" : `${RETURN_KIND_LABEL[kind]} 신청하기`}</button>
          <button type="button" disabled={locked} onClick={() => { setKind(null); setError(null); }} className={`rounded-lg border border-line px-4 py-2.5 text-sm text-sub ${focusClass}`}>닫기</button>
        </div>
      </form>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
    {order.confirmedAt && <Link href="/mypage/points" className={`mt-4 inline-flex text-sm text-sub underline-offset-4 hover:text-ink hover:underline ${focusClass}`}>적립금 내역 보기</Link>}
  </section>;
}
