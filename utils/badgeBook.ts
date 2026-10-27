/** 뱃지 도감 화면 계산 (#106) — 진행 막대 칸 · 개별 진행도 · 카드 표시 */

export interface BookCountLike { earnedCount: number; total: number }
export interface BadgeItemLike {
  earned: boolean;
  isNew?: boolean;
  isWeekly?: boolean;
  progress?: { current: number; goal: number } | null;
}

/** 맨 위 픽셀 칸 막대 — 뱃지 수만큼 칸, 받은 만큼 채움 (범위를 벗어난 값은 잘라 냄) */
export function progressCells({ earnedCount, total }: BookCountLike): boolean[] {
  const size = Math.max(0, Math.floor(total));
  const filled = Math.min(size, Math.max(0, Math.floor(earnedCount)));
  return Array.from({ length: size }, (_, index) => index < filled);
}

/** 아직 못 받은 뱃지의 진행도 — 받았거나 진행도가 없으면 null, 넘친 값은 목표에서 멈춤 */
export function itemProgress(item: BadgeItemLike): { current: number; goal: number; percent: number } | null {
  if (item.earned || !item.progress || item.progress.goal <= 0) return null;
  const goal = item.progress.goal;
  const current = Math.min(goal, Math.max(0, item.progress.current));
  return { current, goal, percent: Math.round((current / goal) * 100) };
}

/** 카드 오른쪽 위 작은 표시 — NEW는 받은 뱃지에만, '이번 주'는 동네 큰손에만 */
export function badgeTags(item: BadgeItemLike): string[] {
  const tags: string[] = [];
  if (item.earned && item.isNew) tags.push("NEW");
  if (item.isWeekly) tags.push("이번 주");
  return tags;
}

/** '대표로' 버튼 — 받은 뱃지이고 지금 대표가 아닐 때만 */
export const canFeature = (item: BadgeItemLike & { code: string }, featured: string | null | undefined) =>
  item.earned && item.code !== featured;
