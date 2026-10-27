"use client"; // 현재 경로를 읽고, 배지 숫자를 직접 불러와야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다 (API 리다이렉트만 예외)
import { usePathname } from "next/navigation"; // 지금 보고 있는 경로를 읽는 훅
import { useEffect, useState } from "react"; // 배지 숫자를 담는 상태, 마운트 시 한 번 불러오기
import { getAdminOrderCounts, onAdminOrderCountsChanged } from "@/lib/admin"; // 배지 숫자를 가져오는 함수 + 갱신 신호 구독
import type { AdminOrderCounts } from "@/types/admin"; // 배지 숫자 타입

// 배지에 쓸 건수 키 — AdminOrderCounts의 필드 이름 중 하나
type BadgeKey = keyof Pick<AdminOrderCounts, "paid" | "cancelRequested">;

// 메뉴 한 칸의 모양 — 라벨과 이동할 경로
interface AdminMenuItem {
  label: string; // 화면에 보이는 한글 이름
  href: string; // 이동할 경로
  exact?: boolean; // true면 경로가 완전히 같을 때만 강조 (대시보드용)
  enabled: boolean; // false면 눌러도 이동 안 되는 "준비 중" 메뉴
  badgeKey?: BadgeKey; // 있으면 이 건수를 작은 배지로 보여 준다
}

// 관리자 메뉴 11개를 한 배열에 모아 둔다 — 다른 팀원 화면이 준비되면 여기서 enabled만 true로 바꾸면 된다
const MENU: AdminMenuItem[] = [
  { label: "대시보드", href: "/admin", exact: true, enabled: true },
  { label: "주문", href: "/admin/orders", enabled: true, badgeKey: "paid" },
  { label: "취소 요청", href: "/admin/cancels", enabled: true, badgeKey: "cancelRequested" },
  { label: "문의", href: "/admin/questions", enabled: true },
  { label: "FAQ", href: "/admin/faqs", enabled: true },
  { label: "공지", href: "/admin/notices", enabled: true },
  { label: "신고", href: "/admin/reports", enabled: true },
  { label: "거래글", href: "/admin/trades", enabled: true },
  { label: "사용자", href: "/admin/users", enabled: true },
  { label: "뱃지", href: "/admin/badges", enabled: true },
  { label: "상품", href: "/admin/products", enabled: true },
];

interface AdminNavProps {
  counts?: AdminOrderCounts; // 밖에서 이미 불러온 건수를 넘겨줄 수도 있다 (안 넘기면 직접 불러온다)
}

export default function AdminNav({ counts: countsProp }: AdminNavProps) {
  const pathname = usePathname(); // 현재 경로 문자열
  const [counts, setCounts] = useState<AdminOrderCounts | undefined>(countsProp); // 배지 숫자

  useEffect(() => {
    let active = true; // 언마운트 후 상태 갱신 방지
    // 건수를 다시 불러와 배지를 최신화하는 함수 — 마운트 시 1회 + 아래 이벤트가 올 때마다 호출한다.
    function refresh() {
      getAdminOrderCounts()
        .then((next) => { if (active) setCounts(next); })
        .catch(() => {}); // 배지는 꾸밈 정보라 실패해도 조용히 넘어간다
    }
    if (!countsProp) refresh(); // 밖에서 이미 받았으면 처음엔 다시 안 불러온다
    // 어디서(목록·상세) 주문을 넘기든 lib/admin.ts가 이 이벤트를 쏘면 배지를 다시 불러온다.
    const unsubscribe = onAdminOrderCountsChanged(refresh);
    return () => { active = false; unsubscribe(); };
  }, [countsProp]);

  // 메뉴가 현재 경로와 맞는지 판단 — 대시보드만 정확히 일치, 나머지는 하위 경로도 포함
  const isActive = (item: AdminMenuItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    // 헤더와 같은 틀(아래쪽 테두리 + 패널 배경), 좁은 화면에서는 가로 스크롤 한 줄, md 이상에서는 세로 사이드바
    <nav aria-label="관리자 메뉴" className="border-b border-line bg-panel md:flex md:min-h-[70vh] md:w-48 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <ul className="flex gap-2.5 overflow-x-auto p-2 md:flex-col md:overflow-visible">
        {MENU.map((item) => {
          const badgeCount = item.badgeKey ? counts?.[item.badgeKey] : undefined; // 이 메뉴의 배지 숫자
          const showBadge = !!badgeCount && badgeCount > 0; // 0이면 배지를 숨긴다
          if (!item.enabled) {
            // 비활성 메뉴 — 링크가 아니라 글자만 있는 span, 흐린 색 + "준비 중" 표시. 좁은 화면 한 줄 메뉴에서는 숨겨 쓸 수 있는 메뉴만 보이게
            return (
              <li key={item.href} className="hidden md:block">
                <span className="flex min-h-12 items-center justify-start gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-bold text-dim md:w-full">
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {showBadge && <span className="rounded-full bg-panel-2 px-1.5 text-xs text-dim">{badgeCount}</span>}
                    <span className="text-xs font-normal text-dim">· 준비 중</span>
                  </span>
                </span>
              </li>
            );
          }
          return (
            <li key={item.href} className="shrink-0 md:shrink">
              <Link
                href={item.href} // 메뉴 클릭 시 이동할 경로
                aria-current={isActive(item) ? "page" : undefined} // 현재 메뉴면 aria-current="page" — globals.css가 알아서 강조 스타일을 준다
                className="btn-pixel flex min-h-12 items-center justify-start gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-bold md:w-full"
              >
                <span className="truncate">{item.label}</span>
                {showBadge && <span className="ml-auto rounded-full bg-lime px-1.5 text-xs font-bold text-lime-ink">{badgeCount}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* 사이드바 아래쪽 여백을 채우는 작은 안내 문구 — 좁은 화면(가로 스크롤 한 줄)에서는 안 보여준다 */}
      <p className="mt-auto hidden px-3 py-3 text-xs text-dim md:block">관리자 모드</p>
    </nav>
  );
}
