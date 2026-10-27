import { api } from "@/lib/api";
import type { ApiProduct, Page } from "@/types/api";

/** 검색어 자동완성 (#108) — 상품 이름 후보 몇 개만 */
export const SUGGEST_LIMIT = 6;
export const SUGGEST_DELAY_MS = 250; // 글자를 칠 때마다 부르지 않고 잠깐 멈췄을 때만
export const SUGGEST_MAX_LENGTH = 50; // 검색창 maxLength와 같다

/** 후보를 찾을 검색어 — 앞뒤 공백을 빼고, 비었으면 null */
export function suggestQuery(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  return Array.from(value).slice(0, SUGGEST_MAX_LENGTH).join("");
}

/** 서버 상품 검색(이름·설명)을 그대로 써서 앞쪽 몇 개만 받아 온다 */
export async function suggestProducts(query: string, signal?: AbortSignal): Promise<ApiProduct[]> {
  const timeout = AbortSignal.timeout(5000);
  const params = new URLSearchParams({ q: query, size: String(SUGGEST_LIMIT) });
  const page = await api.get<Page<ApiProduct>>(`/products?${params}`, {
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  return page.items.slice(0, SUGGEST_LIMIT);
}

/** 후보 이름에서 검색어와 같은 부분을 굵게 보여 주려고 나눈다 (대소문자 무시, 처음 한 번만) */
export function highlightParts(name: string, query: string): { text: string; match: boolean }[] {
  const index = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return [{ text: name, match: false }];
  return [
    { text: name.slice(0, index), match: false },
    { text: name.slice(index, index + query.length), match: true },
    { text: name.slice(index + query.length), match: false },
  ].filter((part) => part.text);
}

/** ↑↓로 후보 사이를 옮길 때 다음 칸 (-1은 '아무것도 고르지 않음', 끝에서 처음으로 돈다) */
export function nextActive(current: number, count: number, key: "ArrowDown" | "ArrowUp"): number {
  if (count <= 0) return -1;
  if (key === "ArrowDown") return current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}
