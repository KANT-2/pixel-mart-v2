"use client"; // 로그인 사용자 숫자(적립금·쿠폰·진행 중 주문)를 불러온다

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import NicknameEditor from "@/components/profile/NicknameEditor";
import PencilIcon from "@/components/profile/PencilIcon";
import { api } from "@/lib/api";
import { couponsApi } from "@/lib/coupons";
import { pointsApi } from "@/lib/points";
import type { ApiOrderSummary, Page } from "@/types/api";

interface Numbers { userId: number; points: number | null; coupons: number | null; activeOrders: number | null; }
const ACTIVE = ["paid", "preparing", "shipping"] as const; // 배송이 끝나지 않은 주문

/** 마이페이지 맨 위 — 내 캐릭터 · 닉네임(여기서 바로 바꿈) + 자주 보는 숫자 3개 (누르면 그 화면으로) */
export default function MyPageSummary() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [numbers, setNumbers] = useState<Numbers | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    const init: RequestInit = { cache: "no-store", signal: controller.signal };
    const settle = <T,>(promise: Promise<T>) => promise.then((value) => value, () => null);
    void Promise.all([
      settle(pointsApi.balance(controller.signal).then((row) => row.balance)),
      settle(couponsApi.list(controller.signal).then((rows) => rows.filter((row) => row.status === "available").length)),
      settle(Promise.all(ACTIVE.map((status) => api.get<Page<ApiOrderSummary>>(`/orders?status=${status}&size=1`, init))).then((pages) => pages.reduce((sum, page) => sum + page.total, 0))),
    ]).then(([points, coupons, activeOrders]) => { if (!controller.signal.aborted) setNumbers({ userId, points, coupons, activeOrders }); });
    return () => controller.abort();
  }, [userId]);

  if (loading) return <div role="status" aria-label="불러오는 중" className="mb-8 h-40 animate-pulse rounded-xl bg-panel" />;
  if (!user) return <div className="mb-8"><LoginRequiredNotice next="/mypage" message="로그인하면 내 주문·적립금·쿠폰·선물을 볼 수 있어요." /></div>;
  const mine = numbers?.userId === user.id ? numbers : null;
  const stats = [
    { href: "/mypage/orders", label: "배송 중", value: mine?.activeOrders, unit: "건" },
    { href: "/mypage/points", label: "적립금", value: mine?.points, unit: "P" },
    { href: "/mypage/coupons", label: "쿠폰", value: mine?.coupons, unit: "장" },
  ];

  return <section aria-label="내 요약" className="mb-8 grid gap-4 pixel-panel p-5 sm:p-6 md:grid-cols-2 md:items-center">
    <div className="flex min-w-0 items-start gap-4">
      <Link href="/mypage/avatar" aria-label="픽셀 아바타 바꾸기" className="group relative grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 hover:ring-2 hover:ring-mint/50 focus-visible:outline-2 focus-visible:outline-mint">
        {user.avatarUrl ? <PixelAvatar src={user.avatarUrl} className="size-12" />
          // eslint-disable-next-line @next/next/no-img-element -- 기본 픽셀 캐릭터
          : <img src="/images/hero-slime.svg" alt="" className="size-10 object-contain" />}
        <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 grid size-6 place-items-center rounded-md border border-line bg-night text-sub group-hover:border-mint/60 group-hover:text-mint"><PencilIcon className="size-3" /></span>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-xs text-dim" aria-hidden="true">PLAYER</p>
        <NicknameEditor />
        <p className="truncate text-xs text-sub">{user.email}</p>
      </div>
    </div>
    <dl className="grid grid-cols-3 gap-2">
      {stats.map((stat) => <Link key={stat.href} href={stat.href} className="rounded-lg border border-line bg-panel-2 px-3 py-3 hover:border-mint/50 focus-visible:outline-2 focus-visible:outline-mint">
        <dt className="truncate text-xs text-sub">{stat.label}</dt>
        <dd className="mt-1 text-lg font-extrabold text-ink sm:text-xl">
          {stat.value === undefined ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-panel" /> : stat.value === null ? "-" : <>{stat.value.toLocaleString("ko-KR")}<span className="ml-0.5 text-xs font-bold text-sub">{stat.unit}</span></>}
        </dd>
      </Link>)}
    </dl>
  </section>;
}
