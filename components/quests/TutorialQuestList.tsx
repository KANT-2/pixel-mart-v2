"use client"; // 내 뱃지 도감(로그인 사용자)으로 진행을 읽는다

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { localApi } from "@/lib/local";
import type { ApiBadgeBookItem } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import { HERO_QUESTS, type HeroQuestStep } from "@/utils/heroQuest";

interface BookResult { userId: number; items: ApiBadgeBookItem[]; }
type Tab = "doing" | "done";

/** 내 퀘스트 화면 위 — 진행 중 | 완료 탭 (퀘스트가 늘어나도 진행 중 목록은 깰수록 줄어든다) */
export default function TutorialQuestList() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [book, setBook] = useState<BookResult | null>(null);
  const [tab, setTab] = useState<Tab>("doing");

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    localApi.myBadges(controller.signal).then((data) => setBook({ userId, items: data.items })).catch(() => {});
    return () => controller.abort();
  }, [userId]);

  const mine = book?.userId === userId ? book : null;
  if (!mine) return null; // 비로그인 · 불러오는 중이면 아래 오늘의 퀘스트만
  const byCode = new Map(mine.items.map((item) => [item.code, item]));
  const doing = HERO_QUESTS.filter((step) => !byCode.get(step.code)?.earned);
  // 완료는 최근에 깬 것부터
  const done = HERO_QUESTS.filter((step) => byCode.get(step.code)?.earned)
    .sort((a, b) => (byCode.get(b.code)?.earnedAt ?? "").localeCompare(byCode.get(a.code)?.earnedAt ?? ""));

  return (
    <section aria-labelledby="tutorial-quests">
      <div className="pixel-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="tutorial-quests" className="font-bold">퀘스트</h2>
          <div role="group" aria-label="퀘스트 보기" className="segmented h-9 text-xs font-bold">
            <button type="button" aria-pressed={tab === "doing"} onClick={() => setTab("doing")}>진행 중 {doing.length}</button>
            <button type="button" aria-pressed={tab === "done"} onClick={() => setTab("done")}>완료 {done.length}</button>
          </div>
        </div>

        {tab === "doing" && (doing.length === 0
          ? <p className="py-6 text-center text-sm text-sub">지금 할 수 있는 퀘스트를 모두 깼어요. 새 퀘스트가 생기면 여기에 나와요.</p>
          : <ol className="space-y-2">
            {doing.map((step, index) => <li key={step.code}>
              <QuestRow step={step} item={byCode.get(step.code)} current={index === 0} />
            </li>)}
          </ol>)}

        {tab === "done" && (done.length === 0
          ? <p className="py-6 text-center text-sm text-sub">아직 깬 퀘스트가 없어요. 진행 중 탭의 첫 퀘스트부터 해 보세요.</p>
          : <ul className="divide-y divide-line">
            {done.map((step) => {
              const earnedAt = byCode.get(step.code)?.earnedAt;
              return <li key={step.code} className="flex items-center gap-3 py-2.5 text-sm">
                <span aria-hidden="true" className="w-3 shrink-0 text-xs text-mint">✓</span>
                <span className="min-w-0 flex-1 text-sub">{step.text} <b className="text-ink">{step.reward}</b> 받기</span>
                {earnedAt && <span className="shrink-0 text-xs text-dim">{formatDate(earnedAt)}</span>}
              </li>;
            })}
          </ul>)}
      </div>
    </section>
  );
}

interface QuestRowProps { step: HeroQuestStep; item?: ApiBadgeBookItem; current: boolean; }

/** 진행 중 한 줄 — 맨 위(지금 할 것)만 강조하고 버튼을 붙인다 */
function QuestRow({ step, item, current }: QuestRowProps) {
  const progress = item?.progress && item.progress.goal > 1 ? item.progress : null;
  return (
    <div className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${current ? "border-mint/60 bg-panel-2" : "border-line"}`}>
      <span aria-hidden="true" className={`w-3 shrink-0 text-xs ${current ? "text-lime" : "text-dim"}`}>{current ? "▶" : "·"}</span>
      <span className={`min-w-0 flex-1 ${current ? "text-ink" : "text-sub"}`}>
        {current && <span className="mr-1.5 font-pixel text-[10px] text-mint">NOW</span>}
        {step.text} <b className="text-lime">{step.reward}</b> 받기
      </span>
      {progress && <span className="shrink-0 text-xs text-dim">{progress.current}/{progress.goal}</span>}
      {current
        ? <Link href={step.href} className="btn-lime shrink-0 px-3 py-1.5 text-xs font-bold text-lime-ink">{step.action}</Link>
        : <Link href={step.href} className="shrink-0 text-xs text-dim underline-offset-4 hover:text-ink hover:underline">가기</Link>}
    </div>
  );
}
