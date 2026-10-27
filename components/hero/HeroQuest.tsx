"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { Page } from "@/types/api";
import styles from "./HeroStage.module.css";

interface QuestProgress {
  userId: number;
  ordered: boolean; // 주문을 한 번이라도 했으면 첫 구매 퀘스트 완료
  balance: number; // 보유 구매 포인트
}

/** 무대 아래 퀘스트 카드 — 비로그인이면 로그인 유도, 첫 구매 전이면 쇼핑 유도, 첫 구매 후엔 완료 + 보유 포인트 */
export default function HeroQuest() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<QuestProgress | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const options = { cache: "no-store" as const, signal: controller.signal };
    Promise.all([
      api.get<Page<unknown>>("/orders?size=1", options),
      api.get<{ balance: number }>("/users/me/points", options),
    ])
      .then(([orders, points]) => setProgress({ userId: user.id, ordered: orders.total > 0, balance: points.balance }))
      .catch(() => {}); // 못 불러오면 기본 안내 그대로
    return () => controller.abort();
  }, [user]);

  const mine = user && progress?.userId === user.id ? progress : null;
  const cleared = !!mine?.ordered;

  return (
    <aside className={styles.quest} aria-label="내 혜택">
      {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 아이콘 */}
      <img src="/images/logo-invader.svg" alt="" className={styles.questIcon} />
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[11px] tracking-wider text-dim">PLAYER 1 · {cleared ? "QUEST CLEAR" : "QUEST 0/1"}</p>
        <p className="truncate text-sm font-semibold text-ink">
          {!user ? <>로그인하고 첫 구매 시 <b className="text-lime">1,000P</b> 받기</>
            : cleared ? <>첫 구매 완료! 보유 포인트 <b className="text-lime">{mine.balance.toLocaleString()}P</b></>
              : <>첫 구매 완료 시 <b className="text-lime">1,000P</b> 받기</>}
        </p>
      </div>
      <Link href={user ? "/products" : "/login?next=/"} className={styles.questBtn}>{user ? "쇼핑하기" : "로그인"}</Link>
    </aside>
  );
}
