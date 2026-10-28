"use client";

import Link from "next/link";
import { useEffect, useId } from "react";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";
import { TRADE_CONDITIONS, TRADE_METHODS } from "@/utils/localTrades";
import { kindLabel, tradeAction, tradeState, type AdminTradeTarget, type ApiAdminTrade } from "./adminTrades";

const TONE = { mint: "border-mint/30 bg-mint/10 text-mint", pink: "border-pink/40 bg-pink/10 text-pink", dim: "border-line bg-panel-2 text-dim" };

interface TradeDetailDialogProps {
  post: ApiAdminTrade;
  busy: boolean;
  onAction: (target: AdminTradeTarget) => void;
  onClose: () => void;
}

// 거래글 전체 내용 — 목록은 앞부분만 보여 주니, 줄을 누르면 본문 전체와 거래 정보를 여기서 본다
export default function TradeDetailDialog({ post, busy, onAction, onClose }: TradeDetailDialogProps) {
  const titleId = useId();
  const state = tradeState(post);
  const target = tradeAction(post);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  const rows: [string, string][] = [
    ["작성자", `${post.authorNickname} · ${post.authorEmail}`],
    ["지역", post.regionName],
    ["희망가", post.price !== null ? formatPrice(post.price) : "가격 제안"],
    ["상태", TRADE_CONDITIONS.find((item) => item.value === post.condition)?.label ?? "—"],
    ["거래 방식", TRADE_METHODS.find((item) => item.value === post.tradeMethod)?.label ?? post.tradeMethod],
    ["등록", formatDate(post.createdAt)],
  ];

  return <div className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-3 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="pixel-panel flex max-h-[90vh] w-full max-w-lg flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-line px-2 py-0.5 font-pixel text-[10px] text-sub">{kindLabel(post.kind)}</span>
            <span className={`rounded-md border px-2 py-0.5 text-xs font-bold ${TONE[state.tone]}`}>{state.label}</span>
            <span className="text-xs text-dim">#{post.id}</span>
          </p>
          <h2 id={titleId} className="mt-2 break-words text-lg font-bold text-ink">{post.itemName}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="btn-pixel grid size-10 shrink-0 place-items-center text-sm font-bold">✕</button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        <p className="mb-1 text-xs font-bold text-dim">내용</p>
        {post.content.trim()
          ? <p className="whitespace-pre-wrap break-words rounded-lg border border-line bg-panel-2 p-3 text-sm leading-relaxed text-ink">{post.content}</p>
          : <p className="rounded-lg border border-line bg-panel-2 p-3 text-sm text-dim">내용 없이 물건 이름만 올린 글이에요.</p>}

        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rows.map(([label, value]) => <div key={label} className="contents">
            <dt className="text-dim">{label}</dt>
            <dd className="break-words text-sub">{value}</dd>
          </div>)}
          {post.product && <div className="contents">
            <dt className="text-dim">연결 상품</dt>
            <dd className="break-words"><Link href={`/products/${post.product.id}`} className="text-mint underline-offset-2 hover:underline">{post.product.name}</Link></dd>
          </div>}
        </dl>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-pixel px-4 py-2 text-sm font-bold">닫기</button>
        {target
          ? <button type="button" disabled={busy} onClick={() => onAction(target)} className={`btn-pixel px-4 py-2 text-sm font-bold disabled:opacity-50 ${target === "hidden" ? "border-pink text-pink" : ""}`}>{target === "hidden" ? "숨김" : "다시 보이기"}</button>
          : <span className="self-center text-xs text-dim">글쓴이가 직접 숨긴 글이에요</span>}
      </div>
    </div>
  </div>;
}
