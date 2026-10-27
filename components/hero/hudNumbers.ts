/** 메인 무대 HUD 숫자 — 비로그인은 시안 그대로, 로그인은 하트(/api/users/me/activity)와 적립금(/api/users/me/points) */
export interface HudNumbers { hearts: number; coins: number; }

/** 비로그인 손님에게 보여 주는 시안 숫자 (이슈 규칙: 비로그인은 지금처럼) */
export const GUEST_HUD: HudNumbers = { hearts: 2, coins: 3 };

/** 하트 뒤 "×N" (이웃 카드와 같은 표기) */
export const heartText = (hearts: number) => `×${hearts}`;
/** 코인(적립금) 뒤 "× 003" — 세 자리 맞춤, 1000 이상은 "× 1,000"처럼 쉼표 */
export const coinText = (coins: number) => `× ${coins >= 1000 ? coins.toLocaleString("ko-KR") : String(coins).padStart(3, "0")}`;
/** 화면낭독기용 문장 — 로그인한 내 숫자일 때만 */
export const hudLabel = ({ hearts, coins }: HudNumbers) => `내 하트 ${hearts}개, 적립금 ${coins.toLocaleString("ko-KR")}P`;

/**
 * 지금 보여 줄 숫자
 * - 로그인 확인 중: null (빈칸)
 * - 비로그인: 시안 숫자
 * - 로그인: 내 숫자를 받아 왔으면 그 값, 받는 중이거나 실패면 null (빈칸)
 */
export function hudNumbersFor(authLoading: boolean, signedIn: boolean, mine: HudNumbers | null): HudNumbers | null {
  if (authLoading) return null;
  if (!signedIn) return GUEST_HUD;
  return mine;
}
