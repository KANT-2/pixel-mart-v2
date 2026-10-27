"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import RecentlyViewedPanel from "@/components/products/RecentlyViewedPanel";
import RecentlyViewedQuickMenu from "@/components/products/RecentlyViewedQuickMenu";
import RecentlyViewedSpeedDial from "@/components/products/RecentlyViewedSpeedDial";
import { readRecent, subscribeRecent, writeRecent } from "@/lib/recentlyViewedStore";
import { currentProductIdFromPath, excludeCurrentProduct, parseRecent } from "@/utils/recentlyViewed";

// 데스크톱(퀵메뉴) ↔ 모바일(스피드 다이얼) 전환 기준 — 1440px. 본문(max-w-6xl=1152px)과 24px 이상 떨어지는지는
// PR 설명에 계산을 남겼다. 둘 다 항상 그려두고 Tailwind 반응형 클래스로만 하나를 display:none 시킨다
// (JS로 화면 폭을 읽지 않아 hydration 깜빡임이 없고, 숨긴 쪽은 display:none이라 접근성 트리·탭 순서에서도 빠진다)
const DESKTOP_VISIBLE = "hidden min-[1440px]:flex";
const MOBILE_VISIBLE = "flex min-[1440px]:hidden";

// 오른쪽 퀵메뉴(데스크톱) / 스피드 다이얼(모바일) + 최근 본 상품 패널 — /admin 화면에서는 보이지 않는다
export default function RecentlyViewedWidget() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeRecent, readRecent, () => "[]");
  const items = useMemo(() => parseRecent(raw), [raw]);
  const currentId = currentProductIdFromPath(pathname);
  // 데스크톱 퀵메뉴만 "지금 보는 상품"을 뺀다 — 모바일 스피드 다이얼은 전체 기준 그대로(items)
  const itemsExcludingCurrent = useMemo(() => excludeCurrentProduct(items, currentId), [items, currentId]);

  // 이미지 로딩 실패한 상품 id — 두 메뉴가 같은 캐시를 공유(부모에서 한 번만 들고 내려준다)
  const [brokenIds, setBrokenIds] = useState<Set<number>>(() => new Set());
  const onImageError = (id: number) => setBrokenIds((prev) => new Set(prev).add(id));

  const [panelOpen, setPanelOpen] = useState(false);
  // 패널을 연 트리거(데스크톱 "전체 보기" 또는 모바일 메인 버튼) — 닫을 때 여기로 초점을 되돌린다
  const lastTrigger = useRef<HTMLElement | null>(null);

  function openPanel(trigger: HTMLElement) {
    lastTrigger.current = trigger;
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    lastTrigger.current?.focus();
  }

  if (pathname?.startsWith("/admin")) return null;

  return <>
    <RecentlyViewedQuickMenu className={DESKTOP_VISIBLE} items={itemsExcludingCurrent} onOpenPanel={openPanel} onClearAll={() => writeRecent([])} />
    <RecentlyViewedSpeedDial className={MOBILE_VISIBLE} items={items} brokenIds={brokenIds} onImageError={onImageError} onOpenPanel={openPanel} />
    {panelOpen && <RecentlyViewedPanel onClose={closePanel} />}
  </>;
}
