import type { Metadata } from "next";
import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import AvatarShortcut from "@/components/avatar/AvatarShortcut";
import NicknameEditor from "@/components/profile/NicknameEditor";
import BadgeBook from "@/components/profile/BadgeBook";
import WithdrawSection from "@/components/profile/WithdrawSection";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";

export const metadata: Metadata = { title: "마이페이지 | PIXEL MART" };

export default function MyPage() {
  return <section className="mx-auto max-w-xl px-4 py-20 text-center">
    <p className="stage-kicker mb-3 font-pixel text-mint">MY PLAYER</p>
    <h1 className="mb-4 text-3xl font-extrabold">마이페이지</h1>
    <p className="mb-8 text-sub">내 프로필과 활동 뱃지를 모아 보세요.</p>
    <LoginRequiredNotice next="/mypage" message="로그인하면 내 프로필·주문·선물·찜을 볼 수 있어요." />
    <NicknameEditor />
    <AvatarShortcut />
    <BadgeBook />
    <Link href="/local/settings" className="mb-6 flex items-center gap-4 pixel-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 font-pixel text-mint">LOC</span>
      <span><span className="block font-bold">내 동네·취향·공개 설정 →</span><span className="mt-1 block text-sm text-sub">우리 동네와 취향, 그리고 취향·닉네임·이웃 카드를 다른 사람에게 보여 줄지 정하세요.</span></span>
    </Link>
    <Link href="/mypage/orders" className="mb-6 flex items-center gap-4 pixel-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 font-pixel text-mint">BOX</span>
      <span><span className="block font-bold">주문 내역 보기 →</span><span className="mt-1 block text-sm text-sub">주문한 아이템과 배송 진행 상황을 확인하세요.</span></span>
    </Link>
    <Link href="/mypage/gifts" className="mb-6 flex items-center gap-4 pixel-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2"><PixelIcon name="chest" className="size-9" /></span>
      <span><span className="block font-bold">선물함 →</span><span className="mt-1 block text-sm text-sub">이웃에게 받은 선물을 받거나, 보낸 선물 상태를 확인하세요.</span></span>
    </Link>
    <Link href="/mypage/wishlist" className="mb-6 flex items-center gap-4 pixel-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 text-pink" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z" /></svg>
      </span>
      <span><span className="block font-bold">찜한 아이템 보기 →</span><span className="mt-1 block text-sm text-sub">마음에 드는 아이템을 한곳에 모아 보세요.</span></span>
    </Link>
    <Link href="/products" className="inline-block btn-pixel px-6 py-3 font-semibold">상품 둘러보기</Link>
    <WithdrawSection />
  </section>;
}
