"use client";

import { useEffect } from "react";
import { readRecent, writeRecent } from "@/lib/recentlyViewedStore";
import { RECENT_MAX, addRecent, parseRecent, type RecentItem } from "@/utils/recentlyViewed";

// current를 객체 하나로 받으면 매 렌더 새 객체라 exhaustive-deps가 전체 객체를 요구해 경고가 난다.
// 실제로 쓰는 값(id 등)을 그대로 props로 받아 deps와 일치시킨다
interface RecentlyViewedTrackerProps {
  productId: number;
  name: string;
  price: number;
  imageUrl: string;
}

/** 상품 상세를 열 때마다 "최근 본 상품"에 기록 — 실제 목록은 오른쪽 아래 위젯(RecentlyViewedWidget)이 보여준다 */
export default function RecentlyViewedTracker({ productId, name, price, imageUrl }: RecentlyViewedTrackerProps) {
  useEffect(() => {
    const item: RecentItem = { id: productId, name, price, imageUrl, viewedAt: Date.now() };
    writeRecent(addRecent(parseRecent(readRecent()), item, RECENT_MAX));
  }, [productId, name, price, imageUrl]);

  return null;
}
