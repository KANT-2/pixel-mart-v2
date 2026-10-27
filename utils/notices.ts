// utils/notices.ts — 공지 폼 검증과 정렬·날짜 계산 순수 함수. tests/notices.test.mjs에서 테스트한다.
import type { Notice } from "@/types/notice";

export const NOTICE_TITLE_MAX = 100;
const RECENT_DAYS = 7;

export interface NoticeFormValues { title: string; content: string }
export interface NoticeFormErrors { title?: string; content?: string }

// 등록·수정 폼 공용 검증 — 제목·내용이 비어 있으면 저장하지 않는다
export function validateNoticeForm(values: NoticeFormValues): { valid: boolean; errors: NoticeFormErrors } {
  const errors: NoticeFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = "제목을 입력해 주세요.";
  else if (title.length > NOTICE_TITLE_MAX) errors.title = `제목은 ${NOTICE_TITLE_MAX}자 이내로 입력해 주세요.`;
  if (!values.content.trim()) errors.content = "내용을 입력해 주세요.";
  return { valid: Object.keys(errors).length === 0, errors };
}

// 작성 7일 이내인지 — NEW 배지 판별. 테스트하기 쉽게 기준 시각(now)을 인자로 받는다
export function isRecentNotice(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const diffDays = (now.getTime() - created) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < RECENT_DAYS;
}

// 화면 표시용 날짜 — "2026.10.26" (시:분은 보여주지 않는다)
export function formatNoticeDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "-";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

// 공지 정렬 — 고정 공지가 먼저, 그 안에서는 최신순. 관리자 목록·손님 목록이 같은 규칙을 쓴다
export function sortNotices(notices: Notice[]): Notice[] {
  return [...notices].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

// 상세 화면의 "이전 글(더 오래된 글)·다음 글(더 최신 글)" — sorted는 sortNotices() 결과를 그대로 넘긴다
export function adjacentNotices(sorted: Notice[], currentId: number): { older: Notice | null; newer: Notice | null } {
  const index = sorted.findIndex((notice) => notice.id === currentId);
  if (index === -1) return { older: null, newer: null };
  return { older: sorted[index + 1] ?? null, newer: sorted[index - 1] ?? null };
}
