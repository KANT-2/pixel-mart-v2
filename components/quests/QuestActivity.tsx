"use client"; // 내 선물·매칭·거래 수를 불러온다

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PixelIcon, { type PixelIconName } from "@/components/PixelIcon";
import { giftApi } from "@/lib/gifts";
import { localApi } from "@/lib/local";

interface Counts { userId: number; gifts: number; matches: number; trades: number; }

/** 내 퀘스트 — 지금 확인할 일 3칸 (받을 선물 · 이어진 매칭 · 진행 중 거래) */
export default function QuestActivity() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [counts, setCounts] = useState<Counts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    Promise.all([giftApi.list("received", controller.signal), localApi.matches(controller.signal), localApi.myTrades(controller.signal)])
      .then(([gifts, matches, trades]) => setCounts({
        userId,
        gifts: gifts.filter((gift) => gift.status === "pending").length,
        matches: matches.length,
        trades: trades.filter((trade) => trade.status === "open").length,
      }))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [userId]);

  if (userId === null) return null;
  const mine = counts?.userId === userId ? counts : null;
  const cards: { href: string; icon: PixelIconName; label: string; value: number | undefined; empty: string; action: string }[] = [
    { href: "/mypage/gifts", icon: "gift", label: "받을 선물", value: mine?.gifts, empty: "도착한 선물이 없어요", action: "선물함 열기" },
    { href: "/local/trades/mine", icon: "heart", label: "이어진 매칭", value: mine?.matches, empty: "내 WISH와 맞는 글이 아직 없어요", action: "매칭 보기" },
    { href: "/local/trades/mine", icon: "sword", label: "진행 중 거래", value: mine?.trades, empty: "진행 중인 거래가 없어요", action: "내 거래 관리" },
  ];

  return <section aria-labelledby="quest-activity" className="mt-8">
    <h2 id="quest-activity" className="mb-3 font-bold">지금 확인할 일</h2>
    {failed ? <p role="alert" className="pixel-panel p-5 text-sm text-sub">활동을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      : <ul className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => <li key={card.label}>
          <Link href={card.href} className="flex h-full flex-col pixel-panel p-4 hover:border-mint/50 focus-visible:outline-2 focus-visible:outline-mint">
            <span className="flex items-center gap-2 text-sm text-sub"><PixelIcon name={card.icon} className="size-5" />{card.label}</span>
            <span className="mt-2 text-3xl font-extrabold text-mint">{card.value === undefined ? <span className="inline-block h-8 w-8 animate-pulse rounded bg-panel-2" /> : card.value}</span>
            <span className="mt-2 flex-1 text-xs text-sub">{card.value === 0 ? card.empty : ""}</span>
            <span className="mt-3 text-xs font-bold text-mint">{card.action} ›</span>
          </Link>
        </li>)}
      </ul>}
  </section>;
}
