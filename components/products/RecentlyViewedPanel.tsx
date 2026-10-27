"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { readRecent, subscribeRecent, writeRecent } from "@/lib/recentlyViewedStore";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import { groupByDay, parseRecent, removeRecent } from "@/utils/recentlyViewed";

interface RecentlyViewedPanelProps {
  onClose: () => void;
}

/** 오른쪽에서 열리는 최근 본 상품 패널 — 모바일은 전체 화면. 열렸을 때만 마운트된다(RecentlyViewedWidget이 조건부 렌더) */
export default function RecentlyViewedPanel({ onClose }: RecentlyViewedPanelProps) {
  const raw = useSyncExternalStore(subscribeRecent, readRecent, () => "[]");
  const items = useMemo(() => parseRecent(raw), [raw]);
  // "오늘/어제" 묶음은 지금 시각이 있어야 함 — Next 16 prerender가 렌더 중 new Date()를 금지하므로 마운트 뒤에만 얻는다
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Next 16 prerender는 렌더 중 new Date() 호출을 금지해서 마운트 뒤 effect에서만 읽을 수 있다
    setNowMs(Date.now());
  }, []);
  const groups = useMemo(() => (nowMs === null ? [] : groupByDay(items, new Date(nowMs))), [items, nowMs]);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  // 패널로 초점 이동 + Esc로 닫기
  useEffect(() => {
    panel.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  // 패널이 열린 동안 뒤의 페이지 스크롤을 막는다
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-night/80"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="pixel-panel flex h-full w-full flex-col focus:outline-none sm:w-96">
        {/* 목록을 스크롤해도 헤더(제목·전체 삭제·닫기)는 그대로 고정되도록 스크롤 영역 바깥에 둔다 */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-frame p-5">
          <h2 id={titleId} className="text-lg font-extrabold">최근 본 상품</h2>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button type="button" onClick={() => writeRecent([])} className="text-sm font-semibold text-sub hover:text-ink">전체 삭제</button>
            )}
            <button type="button" onClick={onClose} aria-label="최근 본 상품 닫기"
              className="btn-pixel grid size-11 shrink-0 place-items-center text-base font-bold">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <p className="text-sm text-sub">아직 본 상품이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 font-pixel text-xs tracking-widest text-dim">{group.label}</h3>
                  <ul className="flex flex-col gap-3">
                    {group.items.map((item) => {
                      const rarity = rarityOf(item.price);
                      return (
                        <li key={item.id} className="flex items-center gap-3">
                          <Link href={`/products/${item.id}`} onClick={onClose}
                            className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-mint">
                            <span className="item-slot block size-14 shrink-0 overflow-hidden p-1" style={{ ["--rarity" as string]: rarity.color }}>
                              {/* eslint-disable-next-line @next/next/no-img-element -- 상품 카드와 같은 일반 img */}
                              <img src={item.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{item.name}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-lime">{formatPrice(item.price)}</span>
                                <span className="rounded border px-1.5 py-0.5 text-[10px] font-bold" style={{ color: rarity.color, borderColor: rarity.color }}>
                                  {rarity.label}
                                </span>
                              </span>
                            </span>
                          </Link>
                          <button type="button" aria-label={`${item.name} 최근 본 상품에서 지우기`}
                            onClick={() => writeRecent(removeRecent(parseRecent(readRecent()), item.id))}
                            className="grid size-8 shrink-0 place-items-center rounded text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-mint">×</button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
