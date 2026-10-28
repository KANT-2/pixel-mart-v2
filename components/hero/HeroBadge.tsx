"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import PixelIcon from "@/components/PixelIcon";
import { localApi } from "@/lib/local";
import type { ApiBadge } from "@/types/api";
import styles from "./HeroStage.module.css";

// 받아 온 값이 누구 것인지 같이 기억 — 계정이 바뀌면 이전 사람 뱃지를 보여 주지 않는다
interface MineResult { userId: number; badge: ApiBadge | null; }

/** 메인 무대 HUD의 대표 뱃지 — 로그인하면 하트 아래에, 누르면 퀘스트 · 뱃지 화면으로 (뱃지가 없으면 첫 뱃지 안내) */
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
        const badge = book.items.find((item) => item.earned && item.code === book.featured) ?? null;
        setMine({ userId, badge });
      },
      () => undefined, // 꾸밈 정보라 실패하면 조용히 숨긴다
    );
    return () => controller.abort();
  }, [userId]);

  const own = mine && mine.userId === userId ? mine : null;
  if (loading || userId === null || !own) return null;
  return <Link href="/mypage/quests" className={styles.badgeChip}
    aria-label={own.badge ? `대표 뱃지 ${own.badge.name} — 퀘스트 · 뱃지 보기` : "첫 뱃지 받으러 퀘스트 · 뱃지 보기"}>
    {own.badge ? <PixelAvatar src={own.badge.image} className={styles.badgeIcon} /> : <PixelIcon name="star" className={styles.badgeIcon} />}
    <span className={styles.badgeName}>{own.badge ? own.badge.name : "첫 뱃지 받기"}</span>
  </Link>;
}
