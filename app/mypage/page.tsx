import type { Metadata } from "next";
import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import AvatarShortcut from "@/components/avatar/AvatarShortcut";
import NicknameEditor from "@/components/profile/NicknameEditor";
import BadgeBook from "@/components/profile/BadgeBook";
import PasswordSection from "@/components/profile/PasswordSection";
import WithdrawSection from "@/components/profile/WithdrawSection";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";

export const metadata: Metadata = { title: "마이페이지 | PIXEL MART" };

const SHORTCUTS = [
  { href: "/mypage/orders", label: "주문 내역", icon: <span className="font-pixel text-xs text-mint">BOX</span> },
  { href: "/mypage/points", label: "적립금", icon: <PixelIcon name="coin" className="size-7" /> },
  { href: "/mypage/coupons", label: "쿠폰함", icon: <span className="font-pixel text-sm text-lime">%</span> },
  { href: "/mypage/addresses", label: "배송지", icon: <span className="font-pixel text-[10px] text-mint">HOME</span> },
  { href: "/mypage/gifts", label: "선물함", icon: <PixelIcon name="chest" className="size-7" /> },
  { href: "/mypage/wishlist", label: "찜한 아이템", icon: <HeartIcon /> },
];

function HeartIcon() {
  return <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges" className="text-pink"><path d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z" /></svg>;
}

export default function MyPage() {
  return <section className="mx-auto max-w-xl px-4 py-20 text-center">
    <p className="stage-kicker mb-3 font-pixel text-mint">MY PLAYER</p>
    <h1 className="mb-4 text-3xl font-extrabold">마이페이지</h1>
    <p className="mb-8 text-sub">주문·적립금·쿠폰·배송지·선물·찜과 내 프로필, 활동 뱃지를 모아 보세요.</p>
    <LoginRequiredNotice next="/mypage" message="로그인하면 내 프로필·주문·선물·찜을 볼 수 있어요." />
    {/* 자주 찾는 곳은 맨 위 한 줄로 — 긴 뱃지 도감을 지나지 않게 */}
    <nav aria-label="마이페이지 바로가기" className="mb-6 grid grid-cols-3 gap-3">
      {SHORTCUTS.map((item) => <Link key={item.href} href={item.href}
        className="flex flex-col items-center gap-2 pixel-panel px-2 py-4 text-sm font-bold hover:border-mint/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
        <span aria-hidden="true" className="grid size-11 place-items-center rounded-lg bg-panel-2">{item.icon}</span>
        {item.label}
      </Link>)}
    </nav>
    <NicknameEditor />
    <AvatarShortcut />
    <Link href="/local/settings" className="mb-6 flex items-center gap-4 pixel-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 font-pixel text-mint">LOC</span>
      <span><span className="block font-bold">내 동네·취향·공개 설정 →</span><span className="mt-1 block text-sm text-sub">우리 동네와 취향, 그리고 취향·닉네임·이웃 카드를 다른 사람에게 보여 줄지 정하세요.</span></span>
    </Link>
    <BadgeBook />
    <PasswordSection />
    <Link href="/products" className="inline-block btn-pixel px-6 py-3 font-semibold">상품 둘러보기</Link>
    <WithdrawSection />
  </section>;
}
