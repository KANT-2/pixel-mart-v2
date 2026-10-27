"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { localApi } from "@/lib/local";
import { currentHeroQuest, type HeroQuestNow } from "@/utils/heroQuest";
import styles from "./HeroStage.module.css";

// 받아 온 값이 누구 것인지 같이 기억 — 계정이 바뀌면 이전 사람 퀘스트를 보여 주지 않는다
interface QuestResult { userId: number; quest: HeroQuestNow | null; }

/** 무대 아래 퀘스트 카드 — 비로그인이면 로그인 유도, 로그인하면 아직 못 깬 다음 퀘스트 하나 (다 깨면 숨김) */
export default function HeroQuest() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState<QuestResult | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    // 뱃지 도감 = 퀘스트 진행 기록 (받은 뱃지 · 진행 막대)
    localApi.myBadges(controller.signal)
      .then((book) => setResult({ userId, quest: currentHeroQuest(book.items) }))
      .catch(() => {}); // 못 불러오면 카드를 띄우지 않는다
    return () => controller.abort();
  }, [userId]);

  if (loading) return null;
  if (userId === null) return <QuestCard kicker="QUEST 1" text="로그인하고 첫 구매 시" reward="1,000P" href="/login?next=/" action="로그인" />;
  const mine = result?.userId === userId ? result : null;
  if (!mine?.quest) return null; // 불러오는 중이거나 모두 깸

  // 퀘스트는 계속 늘어나니 전체 개수 대신 지금 몇 번째인지만
  const { step, number, progress } = mine.quest;
  return <QuestCard kicker={`QUEST ${number}${progress ? ` · ${progress.current}/${progress.goal}` : ""}`} kickerHref="/mypage/quests"
    text={step.text} reward={step.reward} href={step.href} action={step.action} />;
}

interface QuestCardProps { kicker: string; kickerHref?: string; text: string; reward: string; href: string; action: string; }

function QuestCard({ kicker, kickerHref, text, reward, href, action }: QuestCardProps) {
  const prefix = <span className="hidden sm:inline">PLAYER 1 · </span>; // 좁은 화면에서는 한 줄에 들어가게 뺀다
  return (
    <aside className={styles.quest} aria-label="지금 퀘스트">
      {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 아이콘 */}
      <img src="/images/logo-invader.svg" alt="" className={styles.questIcon} />
      <div className="min-w-0 flex-1">
        {/* 진행 표시만 눌러도 내 퀘스트 전체로 — 카드에 막대를 더 얹지 않고 가볍게 */}
        {kickerHref
          ? <Link href={kickerHref} className="font-pixel text-[11px] tracking-wider text-dim hover:text-mint">{prefix}{kicker}<span className="hidden text-mint sm:inline"> · 전체 보기</span> ›</Link>
          : <p className="font-pixel text-[11px] tracking-wider text-dim">{prefix}{kicker}</p>}
        <p className="truncate text-sm font-semibold text-ink">{text} <b className="text-lime">{reward}</b> 받기</p>
      </div>
      <Link href={href} className={styles.questBtn}>{action}</Link>
    </aside>
  );
}
