"use client"; // 현재 경로를 읽고, 배지 숫자를 직접 불러와야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다 (API 리다이렉트만 예외)
import { usePathname } from "next/navigation"; // 지금 보고 있는 경로를 읽는 훅
import { useEffect, useState } from "react"; // 배지 숫자를 담는 상태, 마운트 시 한 번 불러오기
import { getAdminOrderCounts, onAdminOrderCountsChanged } from "@/lib/admin"; // 배지 숫자를 가져오는 함수 + 갱신 신호 구독
import { getAdminReturnRequests } from "@/lib/adminReturns";
import type { AdminOrderCounts } from "@/types/admin"; // 배지 숫자 타입

// 배지에 쓸 건수 — 주문 건수 두 가지 + 반품·교환 대기
type BadgeKey = keyof Pick<AdminOrderCounts, "paid" | "cancelRequested"> | "returnRequested";

// 메뉴 한 칸의 모양 — 라벨과 이동할 경로
interface AdminMenuItem {
  label: string; // 화면에 보이는 한글 이름
  href: string; // 이동할 경로
  exact?: boolean; // true면 경로가 완전히 같을 때만 강조 (대시보드용)
  badgeKey?: BadgeKey; // 있으면 이 건수를 작은 배지로 보여 준다
}

// 일의 종류별로 묶는다 — 주문 처리 / 고객 응대 / 커뮤니티 관리 / 상품
const GROUPS: { title: string; items: AdminMenuItem[] }[] = [
  { title: "", items: [{ label: "대시보드", href: "/admin", exact: true }] },
  { title: "주문 처리", items: [
    { label: "주문", href: "/admin/orders", badgeKey: "paid" },
    { label: "취소 요청", href: "/admin/cancels", badgeKey: "cancelRequested" },
    { label: "반품·교환", href: "/admin/returns", badgeKey: "returnRequested" },
  ] },
  { title: "고객 응대", items: [
    { label: "상품 문의", href: "/admin/questions" },
    { label: "리뷰", href: "/admin/reviews" },
    { label: "FAQ", href: "/admin/faqs" },
    { label: "공지", href: "/admin/notices" },
  ] },
  { title: "커뮤니티 관리", items: [
    { label: "신고", href: "/admin/reports" },
    { label: "거래글", href: "/admin/trades" },
    { label: "사용자", href: "/admin/users" },
    { label: "뱃지", href: "/admin/badges" },
  ] },
  { title: "상품", items: [{ label: "상품·재고", href: "/admin/products" }] },
];

interface AdminNavProps {
  counts?: AdminOrderCounts; // 밖에서 이미 불러온 건수를 넘겨줄 수도 있다 (안 넘기면 직접 불러온다)
}

export default function AdminNav({ counts: countsProp }: AdminNavProps) {
  const pathname = usePathname(); // 현재 경로 문자열
  const [counts, setCounts] = useState<AdminOrderCounts | undefined>(countsProp); // 배지 숫자
  const [returnRequested, setReturnRequested] = useState(0);

  useEffect(() => {
    let active = true; // 언마운트 후 상태 갱신 방지
    // 건수를 다시 불러와 배지를 최신화하는 함수 — 마운트 시 1회 + 아래 이벤트가 올 때마다 호출한다.
    function refresh(withOrders: boolean) {
      if (withOrders) getAdminOrderCounts().then((next) => { if (active) setCounts(next); }).catch(() => {}); // 배지는 꾸밈 정보라 실패해도 조용히 넘어간다
      getAdminReturnRequests("requested", 1).then((page) => { if (active) setReturnRequested(page.total); }).catch(() => {});
    }
    refresh(!countsProp); // 밖에서 이미 받았으면 주문 건수는 처음엔 다시 안 불러온다
    // 어디서(목록·상세) 주문을 넘기든 lib/admin.ts가 이 이벤트를 쏘면 배지를 다시 불러온다.
    const unsubscribe = onAdminOrderCountsChanged(() => refresh(true));
    return () => { active = false; unsubscribe(); };
  }, [countsProp]);

  // 메뉴가 현재 경로와 맞는지 판단 — 대시보드만 정확히 일치, 나머지는 하위 경로도 포함
  const isActive = (item: AdminMenuItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const badgeOf = (key?: BadgeKey) => (key === "returnRequested" ? returnRequested : key ? counts?.[key] ?? 0 : 0);

  return (
    // 좁은 화면에서는 가로 스크롤 한 줄, md 이상에서는 묶음별 세로 사이드바
    <nav aria-label="관리자 메뉴" className="border-b border-line bg-panel md:flex md:min-h-[70vh] md:w-52 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <div className="flex gap-1 overflow-x-auto p-2 md:flex-col md:gap-4 md:overflow-visible md:p-3">
        {GROUPS.map((group) => <div key={group.title || "home"} className="flex shrink-0 gap-1 md:flex-col">
          {group.title && <p className="hidden px-3 pb-1 font-pixel text-[10px] tracking-wider text-dim md:block" aria-hidden="true">{group.title}</p>}
          <ul className="flex gap-1 md:flex-col">
            {group.items.map((item) => {
              const badge = badgeOf(item.badgeKey);
              const active = isActive(item);
              return <li key={item.href} className="shrink-0">
                <Link href={item.href} aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint ${active ? "bg-panel-2 font-bold text-lime" : "text-sub hover:bg-panel-2 hover:text-ink"}`}>
                  {/* 지금 보는 메뉴는 왼쪽 막대로 표시 (넓은 화면) */}
                  {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 hidden w-1 rounded-r bg-lime md:block" />}
                  <span className="truncate">{item.label}</span>
                  {badge > 0 && <span className="ml-auto rounded-full bg-pink px-1.5 text-xs font-bold text-night">{badge}</span>}
                </Link>
              </li>;
            })}
          </ul>
        </div>)}
      </div>
      <p className="mt-auto hidden px-4 py-3 text-xs text-dim md:block">관리자 모드</p>
    </nav>
  );
}
