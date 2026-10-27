// types/notice.ts — 공지 타입. 백엔드 admin_content API(#95, backend/src/admin_content/presentation/schemas.py)와
// 필드 이름을 맞춘다. 화면은 이 타입을 통해서만 필드에 접근한다.
// 손님용 응답은 관리자용보다 필드가 적다(실제 API 계약) — 용도별로 타입을 나눈다.

// 손님 목록 한 줄 — GET /api/notices (NoticeListOut, content 없음)
export interface NoticeSummary {
  id: number;
  title: string;
  isPinned: boolean;
  createdAt: string;
}

// 손님 상세 — GET /api/notices/{id} (NoticeOut, isPublished 없음 — 공개 상세는 어차피 게시중인 것만 보여준다)
export interface NoticeDetail extends NoticeSummary {
  content: string;
  updatedAt: string;
}

// 관리자 목록·폼 — GET/POST/PATCH /api/admin/notices (AdminNoticeOut)
export interface AdminNotice extends NoticeDetail {
  isPublished: boolean;
}

export interface NoticeQuery {
  pinned?: boolean;
  page?: number;
  size?: number;
}

export interface NoticeCreateInput {
  title: string;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
}

export interface NoticeUpdateInput {
  title?: string;
  content?: string;
  isPinned?: boolean;
  isPublished?: boolean;
}
