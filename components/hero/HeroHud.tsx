"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { localApi } from "@/lib/local";
import { coinText, heartText, hudLabel, hudNumbersFor, type HudNumbers } from "./hudNumbers";
import styles from "./HeroStage.module.css";

// 받아 온 값이 누구 것인지 같이 기억 — 계정이 바뀌면 이전 사람 숫자를 보여 주지 않는다
interface MineResult { userId: number; numbers: HudNumbers | null; }

/** 메인 무대 HUD — 비로그인은 시안 숫자, 로그인은 내 하트·코인 (받는 중·실패는 빈칸) */
export default function HeroHud() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [mine, setMine] = useState<MineResult | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    localApi.myActivity(controller.signal).then(
      (activity) => { if (!controller.signal.aborted) setMine({ userId, numbers: { hearts: activity.hearts, coins: activity.coins } }); },
      () => { if (!controller.signal.aborted) setMine({ userId, numbers: null }); },
    );
    return () => controller.abort();
  }, [userId]);

  const own = mine && mine.userId === userId ? mine.numbers : null;
  const numbers = hudNumbersFor(loading, userId !== null, own);

  return <>
    <span className={`${styles.hud} ${styles.hudHeart}`} aria-hidden="true">{numbers && heartText(numbers.hearts)}</span>
    <span className={`${styles.hud} ${styles.hudCoin}`} aria-hidden="true">{numbers && coinText(numbers.coins)}</span>
    {userId !== null && own && <span className="sr-only">{hudLabel(own)}</span>}
  </>;
}
