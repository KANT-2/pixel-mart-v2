"use client"; // 결제창 열고 닫기 · 승인 진행을 브라우저에서 보여 준다

import { useEffect, useRef } from "react";
import PixelCloseIcon from "@/components/PixelCloseIcon";
import { formatPrice } from "@/utils/formatPrice";

interface PaymentSheetProps {
  amount: number;
  methodLabel: string;
  busy: boolean;
  error: string | null;
  onPay: () => void;
  onClose: () => void;
}

/** PIXEL PAY 결제창 — 금액·수단을 한 번 더 보여 주고 승인 버튼을 누르면 주문이 만들어진다 (가상 결제) */
export default function PaymentSheet({ amount, methodLabel, busy, error, onPay, onClose }: PaymentSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} aria-labelledby="payment-sheet-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto w-[min(26rem,calc(100vw-2rem))] pixel-panel p-0 text-ink backdrop:bg-black/60">
    <div className="flex items-center justify-between border-b border-line px-5 py-3">
      <p className="font-pixel text-xs tracking-wider text-mint" aria-hidden="true">PIXEL PAY</p>
      <button type="button" disabled={busy} onClick={onClose} aria-label="결제창 닫기" className="grid size-9 place-items-center rounded-lg hover:bg-panel-2 disabled:opacity-40"><PixelCloseIcon className="size-4" /></button>
    </div>
    <div className="px-5 py-6 text-center">
      <h2 id="payment-sheet-title" className="text-sm text-sub">결제할 금액</h2>
      <p className="mt-2 text-3xl font-extrabold text-lime">{formatPrice(amount)}</p>
      <p className="mt-2 text-sm text-sub">{methodLabel}</p>
      <div className="mt-6 min-h-6" role="status">
        {busy && <span className="inline-flex items-center gap-2 text-sm text-mint">
          <span aria-hidden="true" className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-pulse bg-mint" style={{ animationDelay: `${i * 150}ms` }} />)}</span>
          결제 승인 중…
        </span>}
        {!busy && error && <span className="text-sm text-pink">{error}</span>}
      </div>
      <button type="button" disabled={busy} onClick={onPay}
        className="mt-4 min-h-12 w-full btn-lime px-4 py-3 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "승인 중…" : `${formatPrice(amount)} 결제 승인`}</button>
      <p className="mt-3 text-xs text-dim">승인해도 실제 결제는 일어나지 않아요.</p>
    </div>
  </dialog>;
}
