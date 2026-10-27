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
  if (userId === null) return <QuestCard kicker="PLAYER 1 · QUEST 1" text="로그인하고 첫 구매 시" reward="1,000P" href="/login?next=/" action="로그인" />;
  const mine = result?.userId === userId ? result : null;
  if (!mine?.quest) return null; // 불러오는 중이거나 모두 깸

  const { step, number, total, progress } = mine.quest;
  return <QuestCard kicker={`PLAYER 1 · QUEST ${number}/${total}${progress ? ` · ${progress.current}/${progress.goal}` : ""}`}
    text={step.text} reward={step.reward} href={step.href} action={step.action} />;
}

interface QuestCardProps { kicker: string; text: string; reward: string; href: string; action: string; }

function QuestCard({ kicker, text, reward, href, action }: QuestCardProps) {
  return (
    <aside className={styles.quest} aria-label="지금 퀘스트">
      {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 아이콘 */}
      <img src="/images/logo-invader.svg" alt="" className={styles.questIcon} />
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[11px] tracking-wider text-dim">{kicker}</p>
        <p className="truncate text-sm font-semibold text-ink">{text} <b className="text-lime">{reward}</b> 받기</p>
      </div>
      <Link href={href} className={styles.questBtn}>{action}</Link>
    </aside>
  );
}
