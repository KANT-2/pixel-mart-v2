// 최근 본 아이템 — 브라우저(localStorage)에만, 상품 카드에 필요한 최소 정보만 저장한다

export interface RecentItem {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  viewedAt?: number; // 기록 시각(ms, KST 묶음에 쓴다) — 옛 데이터는 없을 수 있다
}

export interface RecentGroup {
  label: string;
  items: RecentItem[];
}

export const RECENT_KEY = "pixelmart:recently-viewed:v1";
export const RECENT_MAX = 20;
export const RECENT_CHANGE_EVENT = "recently-viewed-changed"; // 위젯이 이 이벤트를 받아 새로고침 없이 다시 읽는다

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 저장된 문자열을 목록으로 — 깨졌거나 모양이 다르면 버린다. viewedAt이 없는 옛 데이터는 버리지 않고 그대로 둔다 */
export function parseRecent(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((item): item is RecentItem => typeof item === "object" && item !== null
        && Number.isSafeInteger((item as RecentItem).id) && typeof (item as RecentItem).name === "string"
        && typeof (item as RecentItem).price === "number" && typeof (item as RecentItem).imageUrl === "string")
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        viewedAt: typeof item.viewedAt === "number" && Number.isFinite(item.viewedAt) ? item.viewedAt : undefined,
      }))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** 방금 본 상품을 맨 앞으로 (이미 있으면 옮기고, 최대 개수 유지) */
export function addRecent(list: RecentItem[], item: RecentItem, max = RECENT_MAX): RecentItem[] {
  return [item, ...list.filter((entry) => entry.id !== item.id)].slice(0, max);
}

export function removeRecent(list: RecentItem[], id: number): RecentItem[] {
  return list.filter((entry) => entry.id !== id);
}

// KST 기준 날짜 키("YYYY-MM-DD") — 호스트 시간대와 무관하게 ms에 9시간을 더해 UTC 날짜를 읽는다
function kstDayKey(ms: number): string {
  const shifted = new Date(ms + KST_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function formatDayLabel(key: string): string {
  const [year, month, day] = key.split("-");
  return `${year.slice(2)}.${month}.${day}`;
}

/** 패널에 보여 줄 날짜별 묶음 — "오늘/어제/YY.MM.DD" 최신순, viewedAt이 없는 항목은 맨 아래 "이전 기록" */
export function groupByDay(list: RecentItem[], now: Date): RecentGroup[] {
  const todayKey = kstDayKey(now.getTime());
  const yesterdayKey = kstDayKey(now.getTime() - DAY_MS);
  const byDay = new Map<string, RecentItem[]>();
  const unknown: RecentItem[] = [];

  for (const item of list) {
    if (typeof item.viewedAt !== "number") { unknown.push(item); continue; }
    const key = kstDayKey(item.viewedAt);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  const groups: RecentGroup[] = [...byDay.keys()]
    .sort((a, b) => b.localeCompare(a)) // "YYYY-MM-DD" 문자열은 그대로 최신순 정렬된다
    .map((key) => ({
      label: key === todayKey ? "오늘" : key === yesterdayKey ? "어제" : formatDayLabel(key),
      items: byDay.get(key)!,
    }));

  if (unknown.length > 0) groups.push({ label: "이전 기록", items: unknown });
  return groups;
}
