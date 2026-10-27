/** 메인 퀘스트 카드 — 뱃지 도감으로 지금 할 퀘스트 하나를 고른다 (다 깨면 카드 숨김) */

export interface HeroQuestStep {
  code: string; // 뱃지 코드 — 받으면 클리어
  text: string; // 카드 문구
  reward: string; // 굵게 보여 줄 보상
  href: string;
  action: string; // 버튼 글자
}

// 쇼핑 → 동네 → WISH → 거래 → 리뷰 → 선물 순서로 자연스럽게 사이트를 한 바퀴 돌게
export const HERO_QUESTS: HeroQuestStep[] = [
  { code: "first_order", text: "첫 구매 완료 시", reward: "1,000P", href: "/products", action: "쇼핑하기" },
  { code: "local", text: "내 동네·취향 등록하고", reward: "뱃지", href: "/local/settings", action: "등록하기" },
  { code: "first_want", text: "갖고 싶은 아이템 WISH 올리고", reward: "뱃지", href: "/local/trades/new?kind=want", action: "WISH 쓰기" },
  { code: "first_trade", text: "동네에서 첫 교환·거래 완료하고", reward: "뱃지", href: "/local/trades", action: "거래소 가기" },
  { code: "reviewer", text: "리뷰 3개 쓰고", reward: "뱃지", href: "/mypage/orders", action: "리뷰 쓰기" },
  { code: "santa", text: "이웃에게 선물 3번 하고", reward: "뱃지", href: "/local/wish-map", action: "선물하기" },
];

interface BookItem { code: string; earned: boolean; progress?: { current: number; goal: number } | null; }

export interface HeroQuestNow {
  step: HeroQuestStep;
  number: number; // 몇 번째 퀘스트인지 (1부터)
  total: number;
  progress: { current: number; goal: number } | null; // 여러 번 해야 하는 퀘스트만
}

/** 아직 못 깬 첫 퀘스트 — 모두 깼으면 null */
export function currentHeroQuest(items: readonly BookItem[]): HeroQuestNow | null {
  const byCode = new Map(items.map((item) => [item.code, item]));
  const index = HERO_QUESTS.findIndex((step) => !byCode.get(step.code)?.earned);
  if (index < 0) return null;
  const progress = byCode.get(HERO_QUESTS[index].code)?.progress ?? null;
  return { step: HERO_QUESTS[index], number: index + 1, total: HERO_QUESTS.length, progress: progress && progress.goal > 1 ? progress : null };
}
