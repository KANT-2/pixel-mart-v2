"use client";

import Link from "next/link";
import { useRef } from "react";
import PixelQuestionMark from "@/components/PixelQuestionMark";
import { useScrollLagTransform } from "@/components/products/useScrollLagTransform";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import type { RecentItem } from "@/utils/recentlyViewed";

interface RecentlyViewedQuickMenuProps {
  /** 부모가 "hidden min-[1440px]:flex" 같은 표시 여부 클래스를 내려준다 — 이 컴포넌트 자체는 항상 그려진다 */
  className: string;
  /** 지금 보는 상품은 이미 빠진 목록 — 개수·썸네일 모두 이 기준 */
  items: RecentItem[];
  onOpenPanel: (trigger: HTMLElement) => void;
  onClearAll: () => void;
}

const THUMB_COUNT = 3;

/** 데스크톱(1440px 이상)에서 화면 오른쪽 여백에 고정되는 퀵메뉴 — FAQ + 최근 본 상품 미리보기 */
export default function RecentlyViewedQuickMenu({ className, items, onOpenPanel, onClearAll }: RecentlyViewedQuickMenuProps) {
  const thumbs = items.slice(0, THUMB_COUNT);
  const openPanelButton = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // 화면 가장자리에 딱 붙어 보이지 않게 16px→24px로 띄우고, 스크롤할 때 살짝 늦게 따라오는 느낌을 더한다
  useScrollLagTransform(navRef);

  return (
    <nav ref={navRef} aria-label="퀵메뉴" className={`fixed right-35 top-40 z-[60] w-[104px] flex-col gap-3 overflow-y-auto ${className}`}
      style={{ maxHeight: "calc(100vh - 6rem - 1rem)" }}>
      <Link href="/help" className="btn-pixel flex flex-col items-center gap-1 px-2 py-3 text-center text-xs font-bold">
        <PixelQuestionMark className="h-5 w-auto" />
        FAQ
      </Link>

      <div className="pixel-panel flex flex-col gap-2 p-3 text-xs">
        <p className="font-bold text-ink">최근 본 상품 <span className="font-normal text-dim">· {items.length}</span></p>

        {thumbs.length === 0 ? (
          <p className="text-dim">아직 본 상품이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {thumbs.map((thumb) => {
              const rarity = rarityOf(thumb.price);
              return (
                <li key={thumb.id} className="group relative">
                  <Link href={`/products/${thumb.id}`} aria-label={thumb.name}
                    className="item-slot block size-16 overflow-hidden p-1 focus-visible:outline-2 focus-visible:outline-mint"
                    style={{ ["--rarity" as string]: rarity.color }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 상품 카드와 같은 일반 img */}
                    <img src={thumb.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
                  </Link>
                  {/* 말풍선 — 썸네일 왼쪽(화면 안쪽)에 떠서 화면 밖으로 안 나간다. 마우스 호버 또는 키보드 포커스에서만 보임 */}
                  <div role="tooltip" className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded border-2 border-frame bg-night px-2 py-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="block font-semibold text-ink">{thumb.name}</span>
                    <span className="block font-bold text-lime">{formatPrice(thumb.price)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button ref={openPanelButton} type="button" onClick={() => openPanelButton.current && onOpenPanel(openPanelButton.current)}
          className="btn-pixel mt-1 px-2 py-2 text-xs font-bold">전체 보기</button>
        {items.length > 0 && (
          <button type="button" onClick={onClearAll} className="text-[11px] text-sub hover:text-ink">전체 삭제</button>
        )}
      </div>
    </nav>
  );
}
