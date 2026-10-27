import { api } from "@/lib/api";

/** 신고 · 탈퇴 (#107) — 탐험가 API #86 · #87 */
export type ReportTargetType = "trade" | "review" | "question" | "avatar";
export type ReportReason = "spam" | "abuse" | "privacy" | "inappropriate" | "etc";

export const REPORT_MEMO_LIMIT = 200; // 서버 ReportIn.memo와 같다
export const WITHDRAW_WORD = "탈퇴"; // 서버 WithdrawRequest.confirm과 같다

// 사유 선택지 — 서버 Reason 값과 순서
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "광고 · 도배" },
  { value: "abuse", label: "욕설 · 비방" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "etc", label: "기타" },
];

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  trade: "거래글",
  review: "리뷰",
  question: "문의",
  avatar: "아바타",
};

export interface ReportInput { targetType: ReportTargetType; targetId: number; reason: ReportReason; memo: string; }

function options(): RequestInit {
  return { cache: "no-store", signal: AbortSignal.timeout(10000) };
}

export const reportsApi = {
  create: (input: ReportInput) => api.post<{ id: number; status: "open" }>("/reports", { ...input, memo: input.memo.trim() }, options()),
  withdraw: () => api.post<{ message: string }>("/users/me/withdraw", { confirm: WITHDRAW_WORD }, options()),
};

/** 신고 버튼은 로그인 + 내 것이 아님 + 보이는 글일 때만 */
export function canReport(target: { isMine?: boolean | null; hidden?: boolean | null; isSample?: boolean | null }, signedIn: boolean) {
  return signedIn && target.isMine !== true && target.hidden !== true && target.isSample !== true;
}

/** 탈퇴 확인 입력 — 앞뒤 공백만 무시하고 정확히 '탈퇴' */
export const withdrawConfirmed = (text: string) => text.trim() === WITHDRAW_WORD;

/** 메모 글자 수 검사 */
export function validateReportMemo(memo: string): string | null {
  return Array.from(memo.trim()).length > REPORT_MEMO_LIMIT ? `메모는 ${REPORT_MEMO_LIMIT}자 이내로 적어 주세요.` : null;
}
