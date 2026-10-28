"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { localApi } from "@/lib/local";
import type { ApiBadge } from "@/types/api";
import styles from "./HeroStage.module.css";

// 받아 온 값이 누구 것인지 같이 기억 — 계정이 바뀌면 이전 사람 뱃지를 보여 주지 않는다
interface MineResult { userId: number; badge: ApiBadge | null; }

/** 메인 무대 HUD의 장착 뱃지 — 하트 아래 뱃지 아이콘만, 누르면 퀘스트 · 뱃지 화면 (대표 뱃지가 없으면 안 보임) */
export default function HeroBadge() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [mine, setMine] = useState<MineResult | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    localApi.myBadges(controller.signal).then(
      (book) => {
        if (controller.signal.aborted) return;
        setMine({ userId, badge: book.items.find((item) => item.earned && item.code === book.featured) ?? null });
      },
      () => undefined, // 꾸밈 정보라 실패하면 조용히 숨긴다
    );
    return () => controller.abort();
  }, [userId]);

  const badge = mine && mine.userId === userId ? mine.badge : null;
  if (loading || !badge) return null;
  return <Link href="/mypage/quests" className={styles.badge} aria-label={`장착한 뱃지 ${badge.name} — 퀘스트 · 뱃지 보기`} title={badge.description}>
    {/* eslint-disable-next-line @next/next/no-img-element -- 작은 픽셀 뱃지 그림 */}
    <img src={badge.image} alt="" className={styles.badgeIcon} />
  </Link>;
}
