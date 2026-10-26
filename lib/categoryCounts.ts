import type { ApiCategory } from "@/types/api";

/** 필터 바 한 줄 — 맨 앞 '전체'는 slug 없음 */
export interface CategoryCount { slug?: string; name: string; count: number; }

/** 카테고리 하나(또는 전체)의 상품 수를 알려 주는 함수 — slug가 없으면 전체 */
export type CountOf = (slug?: string) => Promise<number>;

/**
 * 필터 바 카테고리별 상품 수 (#35)
 * 전체 + 카테고리마다 countOf를 동시에 불러, 서버 순서 그대로 [전체, ...카테고리]로 돌려준다
 */
export async function categoryCounts(categories: Pick<ApiCategory, "slug" | "name">[], countOf: CountOf): Promise<CategoryCount[]> {
  const [all, ...each] = await Promise.all([countOf(), ...categories.map((item) => countOf(item.slug))]);
  return [{ name: "전체", count: all }, ...categories.map((item, index) => ({ slug: item.slug, name: item.name, count: each[index] }))];
}
