// lib/adminNotices.ts — 관리자 공지 CRUD. lib/notices.ts(손님용 공개 조회, 서버 전용)와는 별도로 둔다.
// 공지 API(#95)는 이미 머지돼 있어서 mock 분기 없이 항상 실제 서버만 부른다.
import { api } from "@/lib/api";
import type { Page } from "@/types/api";
import type { AdminNotice, NoticeCreateInput, NoticeUpdateInput } from "@/types/notice";

export function getAdminNotices(page = 1, size = 20): Promise<Page<AdminNotice>> {
  return api.get(`/admin/notices?page=${page}&size=${size}`);
}

export function createNotice(input: NoticeCreateInput): Promise<AdminNotice> {
  return api.post("/admin/notices", input);
}

export function updateNotice(id: number, changes: NoticeUpdateInput): Promise<AdminNotice> {
  return api.patch(`/admin/notices/${id}`, changes);
}

export function deleteNotice(id: number): Promise<void> {
  return api.delete(`/admin/notices/${id}`);
}
