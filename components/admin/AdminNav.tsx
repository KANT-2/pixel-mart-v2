"use client"; // 현재 경로를 읽어야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다 (API 리다이렉트만 예외)
import { usePathname } from "next/navigation"; // 지금 보고 있는 경로를 읽는 훅

// 메뉴 한 칸의 모양 — 라벨과 이동할 경로
interface AdminMenuItem {
  label: string; // 화면에 보이는 한글 이름
  href: string; // 이동할 경로
  exact?: boolean; // true면 경로가 완전히 같을 때만 강조 (대시보드용)
}

// 관리자 메뉴 4개 — 대시보드, 주문, 취소 요청, 문의
const MENU: AdminMenuItem[] = [
  { label: "대시보드", href: "/admin", exact: true }, // /admin 은 정확히 일치할 때만 강조
  { label: "주문", href: "/admin/orders" }, // /admin/orders 와 그 하위 경로에서 강조
  { label: "취소 요청", href: "/admin/cancels" }, // /admin/cancels 와 그 하위 경로에서 강조
  { label: "문의", href: "/admin/questions" }, // /admin/questions 와 그 하위 경로에서 강조
];

export default function AdminNav() {
  const pathname = usePathname(); // 현재 경로 문자열

  // 메뉴가 현재 경로와 맞는지 판단 — 대시보드만 정확히 일치, 나머지는 하위 경로도 포함
  const isActive = (item: AdminMenuItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    // 헤더와 같은 틀(아래쪽 테두리 + 패널 배경), 좁은 화면에서는 가로 스크롤 한 줄, md 이상에서는 세로 사이드바
    <nav aria-label="관리자 메뉴" className="border-b border-line bg-panel md:w-48 md:shrink-0 md:border-b-0 md:border-r">
      <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
        {MENU.map((item) => (
          <li key={item.href} className="shrink-0 md:shrink">
            <Link
              href={item.href} // 메뉴 클릭 시 이동할 경로
              aria-current={isActive(item) ? "page" : undefined} // 현재 메뉴면 aria-current="page" — globals.css가 알아서 강조 스타일을 준다
              className="btn-pixel block whitespace-nowrap px-3 py-2 text-sm font-bold md:w-full md:text-center"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
