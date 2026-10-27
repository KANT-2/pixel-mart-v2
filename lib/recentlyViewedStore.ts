// 최근 본 상품 localStorage 저장소 — 버튼(점·배지·썸네일)과 패널(목록) 둘 다 같은 저장소를 구독한다
import { RECENT_CHANGE_EVENT, RECENT_KEY, type RecentItem } from "@/utils/recentlyViewed";

export function readRecent(): string {
  try { return localStorage.getItem(RECENT_KEY) ?? "[]"; } catch { return "[]"; }
}

export function writeRecent(list: RecentItem[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(RECENT_CHANGE_EVENT));
  } catch { /* 저장소를 못 쓰면 무시 */ }
}

export function subscribeRecent(onChange: () => void) {
  window.addEventListener(RECENT_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 본 상품도 반영
  return () => {
    window.removeEventListener(RECENT_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
