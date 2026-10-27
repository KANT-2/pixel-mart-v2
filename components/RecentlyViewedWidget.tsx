"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import PixelQuestionMark from "@/components/PixelQuestionMark";
import RecentlyViewedPanel from "@/components/products/RecentlyViewedPanel";
import { readRecent, subscribeRecent } from "@/lib/recentlyViewedStore";
import { parseRecent } from "@/utils/recentlyViewed";

// 메뉴 항목을 배열로 정의 — 나중에 항목을 추가하려면 이 배열에 한 줄만 더하면 된다.
// href가 있으면 링크, 없으면 onSelect를 부르는 버튼으로 그려진다
interface SpeedDialItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: string | null;
  href?: string;
  onSelect?: () => void;
}

// 8x11 격자라 정사각형 size-*는 비율이 뒤틀린다 — 높이만 지정하고 너비는 비율대로(w-auto)
const QuestionMarkIcon = <PixelQuestionMark className="h-5 w-auto" />;

const ClockIcon = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <path d="M8 1v7l4 2" /><circle cx="8" cy="8" r="6.5" />
  </svg>
);

// 오른쪽 아래 스피드 다이얼(메인 버튼 + 펼쳐지는 메뉴) + 최근 본 상품 패널 — /admin 화면에서는 보이지 않는다
export default function RecentlyViewedWidget() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeRecent, readRecent, () => "[]");
  const items = useMemo(() => parseRecent(raw), [raw]);
  const latest = items[0] ?? null;
  // 이미지 로딩 실패한 상품 id만 기억 — latest가 바뀌면 별도 reset 없이 자연히 다시 시도한다
  const [brokenIds, setBrokenIds] = useState<Set<number>>(() => new Set());
  const showThumbnail = latest !== null && !brokenIds.has(latest.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 다른 화면으로 이동하면(pathname이 바뀌면) 메뉴를 접는다 — effect 대신 렌더 중 state 비교로 처리한다
  // (ref는 렌더 중 읽고 쓰면 안 되므로 React가 권장하는 대로 state로 이전 값을 들고 있는다)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (menuOpen) setMenuOpen(false);
  }

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

  if (pathname?.startsWith("/admin")) return null;

  const dialItems: SpeedDialItem[] = [
    { key: "faq", label: "FAQ", icon: QuestionMarkIcon, href: "/help" },
    {
      key: "recently-viewed",
      label: "최근 본 상품",
      icon: showThumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- 버튼 아이콘, 상품 카드와 같은 일반 img
        <img src={latest.imageUrl} alt="" onError={() => setBrokenIds((prev) => new Set(prev).add(latest.id))} className="size-full object-cover" />
      ) : ClockIcon,
      badge: items.length > 0 ? (items.length > 9 ? "9+" : String(items.length)) : null,
      onSelect: () => { setMenuOpen(false); setPanelOpen(true); },
    },
  ];

  return <>
    <div ref={menuRef} className="fixed right-4 z-[60] flex flex-col items-end gap-3" style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
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
                <button type="button" aria-label={item.label} onClick={item.onSelect}
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
        {/* "+"를 45도 돌리면 그대로 "×" 모양이 된다 — 글자를 바꾸지 않고 회전만 해서 자연스럽게 변한다 */}
        <span aria-hidden="true" className={`text-2xl font-bold leading-none transition-transform duration-200 motion-reduce:transition-none ${menuOpen ? "rotate-45" : "rotate-0"}`}>+</span>
        {!menuOpen && items.length > 0 && (
          <span aria-hidden="true" className="absolute right-1 top-1 size-2.5 rounded-full bg-pink" />
        )}
      </button>
    </div>

    {panelOpen && <RecentlyViewedPanel onClose={() => setPanelOpen(false)} />}
  </>;
}
