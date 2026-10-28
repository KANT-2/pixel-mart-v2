import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import PixelIcon from "@/components/PixelIcon";
import MyPageSummary from "@/components/profile/MyPageSummary";
import PasswordSection from "@/components/profile/PasswordSection";
import WithdrawSection from "@/components/profile/WithdrawSection";

export const metadata: Metadata = { title: "마이페이지 | PIXEL MART" };

interface MenuItem { href: string; label: string; hint: string; icon: ReactNode }

const pixelText = (text: string, color = "text-mint") => <span className={`font-pixel text-[10px] ${color}`}>{text}</span>;

// 홈 퀘스트 카드와 같은 인베이더 아이콘
function QuestIcon() {
  // eslint-disable-next-line @next/next/no-img-element -- 작은 픽셀 SVG
  return <img src="/images/logo-invader.svg" alt="" className="size-6 [image-rendering:pixelated]" />;
}

// 쇼핑에 필요한 곳과 PIXEL LOCAL 활동을 나눠서 — 찾는 곳이 한눈에 보이게
const GROUPS: { title: string; kicker: string; items: MenuItem[] }[] = [
  {
    title: "쇼핑",
    kicker: "SHOP",
    items: [
      { href: "/mypage/orders", label: "주문 내역", hint: "배송 조회 · 구매 확정 · 취소/반품", icon: pixelText("BOX") },
      { href: "/mypage/wishlist", label: "찜한 아이템", hint: "모아 둔 아이템", icon: <PixelIcon name="heart" className="size-6" /> },
      { href: "/mypage/coupons", label: "쿠폰함", hint: "쿠폰 확인 · 코드 등록", icon: <span className="font-pixel text-sm text-lime">%</span> },
      { href: "/mypage/points", label: "적립금", hint: "적립·사용 기록", icon: <PixelIcon name="coin" className="size-6" /> },
      { href: "/mypage/addresses", label: "배송지 관리", hint: "기본 배송지 · 자주 쓰는 주소", icon: pixelText("HOME") },
    ],
  },
  {
    title: "활동",
    kicker: "PIXEL LOCAL",
    items: [
      { href: "/mypage/quests", label: "퀘스트 · 뱃지", hint: "지금 할 퀘스트와 모은 뱃지", icon: <QuestIcon /> },
      { href: "/mypage/gifts", label: "선물함", hint: "이웃과 주고받은 선물", icon: <PixelIcon name="gift" className="size-6" /> },
      { href: "/local/trades/mine#trade-requests", label: "내 글 · 교환 신청", hint: "WISH·HAVE 글과 받은 교환 신청", icon: <PixelIcon name="sword" className="size-6" /> },
      { href: "/local/settings", label: "동네 · 취향 · 공개 설정", hint: "우리 동네, 취향, 이웃에게 보일 정보", icon: pixelText("LOC") },
    ],
  },
];

export default function MyPage() {
  return <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
    <PageHeader kicker="MY PLAYER" title="마이페이지" />
    <MyPageSummary />
    <div className="grid gap-6 md:grid-cols-2">
      {GROUPS.map((group) => <nav key={group.title} aria-label={group.title} className="pixel-panel p-2">
        <p className="flex items-baseline gap-2 px-3 pb-2 pt-3">
          <span className="font-bold">{group.title}</span>
          <span className="font-pixel text-[10px] text-dim" aria-hidden="true">{group.kicker}</span>
        </p>
        <ul>
          {group.items.map((item) => <li key={item.href}>
            <Link href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-panel-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-panel-2">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{item.label}</span>
                <span className="block truncate text-xs text-sub">{item.hint}</span>
              </span>
              <span aria-hidden="true" className="text-dim">›</span>
            </Link>
          </li>)}
        </ul>
      </nav>)}
    </div>

    <h2 className="mb-4 mt-10 flex items-baseline gap-2 font-bold">계정 <span className="font-pixel text-[10px] text-dim" aria-hidden="true">ACCOUNT</span></h2>
    <PasswordSection />
    <WithdrawSection />
  </section>;
}
