// lib/notices.ts — 공지 API(#95)가 아직 없어서 전부 mocks/notices.ts만 쓴다.
// lib/admin.ts와 달리 USE_MOCK 스위치가 없는 이유: 손님용 조회까지 이 파일이 같이 맡고 있어서,
// 백엔드가 생기면 관리자용·손님용 API 모양을 함께 확인한 뒤 이 파일 전체를 다시 짠다.
import * as mock from "@/mocks/notices";
import type { Notice, NoticeCreateInput, NoticeUpdateInput } from "@/types/notice";

// ---------- 관리자용 ----------
export function getAdminNotices(): Promise<Notice[]> {
  return mock.listAll();
}

export function createNotice(input: NoticeCreateInput): Promise<Notice> {
  return mock.create(input);
}

export function updateNotice(id: number, changes: NoticeUpdateInput): Promise<Notice> {
  return mock.update(id, changes);
}

export function deleteNotice(id: number): Promise<void> {
  return mock.remove(id);
}

// ---------- 손님용 (게시중인 공지만) ----------
export function getPublicNotices(): Promise<Notice[]> {
  return mock.listPublished();
}

export function getPublicNotice(id: number): Promise<Notice> {
  return mock.getPublished(id);
}
