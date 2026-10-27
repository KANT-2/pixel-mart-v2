"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import PixelCloseIcon from "@/components/PixelCloseIcon";
import PixelDotsIcon from "@/components/PixelDotsIcon";
import PixelQuestionMark from "@/components/PixelQuestionMark";
import { useScrollLagTransform } from "@/components/products/useScrollLagTransform";
import type { RecentItem } from "@/utils/recentlyViewed";

// 메뉴 항목을 배열로 정의 — 나중에 항목을 추가하려면 이 배열에 한 줄만 더하면 된다.
// href가 있으면 링크, 없으면 버튼으로 그려진다. 버튼 클릭 동작은 ref를 읽어야 해서(아래 selectRecentlyViewed)
// 데이터에 함수로 넣지 않고 key로 분기한다 — 린트가 "렌더 중 ref 접근"으로 오해하는 걸 피하기 위함
interface SpeedDialItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: string | null;
  href?: string;
}

// 8x11 격자라 정사각형 size-*는 비율이 뒤틀린다 — 높이만 지정하고 너비는 비율대로(w-auto)
const QuestionMarkIcon = <PixelQuestionMark className="h-5 w-auto" />;

const ClockIcon = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M8 1v7l4 2" /><circle cx="8" cy="8" r="6.5" />
  </svg>
);

interface RecentlyViewedSpeedDialProps {
  /** 부모가 "min-[1440px]:hidden" 같은 표시 여부 클래스를 내려준다 — 이 컴포넌트 자체는 항상 그려진다 */
  className: string;
  /** 모바일은 "지금 보는 상품 제외" 규칙 없이 전체 기준 */
  items: RecentItem[];
  brokenIds: Set<number>;
  onImageError: (id: number) => void;
  onOpenPanel: (trigger: HTMLElement) => void;
}

/** 작은 화면(1440px 미만)에서 오른쪽 아래에 뜨는 스피드 다이얼 — 메인 버튼 → FAQ·최근 본 상품 */
export default function RecentlyViewedSpeedDial({ className, items, brokenIds, onImageError, onOpenPanel }: RecentlyViewedSpeedDialProps) {
  const latest = items[0] ?? null;
  const showThumbnail = latest !== null && !brokenIds.has(latest.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // 스크롤할 때 살짝 늦게 따라오는 느낌 — position: fixed라 정적으로 보이던 것을 보완
  useScrollLagTransform(menuRef);

  // 메뉴가 열려 있을 때 바깥을 누르면(터치 포함) 닫는다 — 메뉴 영역 안쪽은 닫지 않는다
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  // Esc로 메뉴 닫기. 정리 함수는 메뉴가 닫힐 때(이유 상관없이) 실행되므로 그때 메인 버튼으로 초점을 되돌린다
  useEffect(() => {
    if (!menuOpen) return;
    const triggerButton = trigger.current;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      triggerButton?.focus();
    };
  }, [menuOpen]);

  // 렌더 중에 만드는 배열 안 클로저에서 ref.current를 직접 읽으면 린트가 "렌더 중 ref 접근"으로 오해하므로,
  // ref를 읽는 핸들러는 컴포넌트 본문에 별도 함수로 뺀다(클릭할 때만 실행되는 건 동일)
  function selectRecentlyViewed() {
    setMenuOpen(false);
    // 패널을 닫으면 돌아올 곳은 이 작은 버튼이 아니라 메인 버튼 — 메뉴가 접히면 이 버튼 자체가 사라지기 때문
    const mainButton = trigger.current;
    if (mainButton) onOpenPanel(mainButton);
  }

  const dialItems: SpeedDialItem[] = [
    { key: "faq", label: "FAQ", icon: QuestionMarkIcon, href: "/help" },
    {
      key: "recently-viewed",
      label: "최근 본 상품",
      icon: showThumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- 버튼 아이콘, 상품 카드와 같은 일반 img
        <img src={latest.imageUrl} alt="" onError={() => onImageError(latest.id)} className="size-full object-cover" />
      ) : ClockIcon,
      badge: items.length > 0 ? (items.length > 9 ? "9+" : String(items.length)) : null,
    },
  ];

  return (
    <div ref={menuRef} className={`fixed right-4 z-[60] flex-col items-end gap-3 ${className}`} style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
      {menuOpen && (
        <ul id={menuId} className="flex flex-col items-end gap-3">
          {dialItems.map((item, index) => (
            <li key={item.key} className="motion-safe:animate-[dial-rise_220ms_cubic-bezier(0.16,1,0.3,1)_backwards] flex items-center gap-2"
              style={{ animationDelay: `${(dialItems.length - 1 - index) * 60}ms` }}>
              <span className="pixel-panel whitespace-nowrap px-3 py-1.5 text-sm font-semibold">{item.label}</span>
              {item.href ? (
                <Link href={item.href} aria-label={item.label} onClick={() => setMenuOpen(false)}
                  className="btn-pixel relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full">
                  {item.icon}
                </Link>
              ) : (
                <button type="button" aria-label={item.label} onClick={selectRecentlyViewed}
                  className="btn-pixel relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full">
                  {item.icon}
                  {item.badge && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-pink text-[11px] font-bold text-night">
                      {item.badge}
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        ref={trigger}
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
        className="btn-pixel relative grid size-14 place-items-center rounded-full"
      >
        {menuOpen ? <PixelCloseIcon className="h-6 w-auto" /> : <PixelDotsIcon className="h-6 w-auto" />}
        {!menuOpen && items.length > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 size-2.5 rounded-full bg-pink" />
        )}
      </button>
    </div>
  );
}
