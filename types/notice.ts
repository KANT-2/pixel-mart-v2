// types/notice.ts — 공지 타입. #95(공지 API)가 아직 없고 docs/tasks/ADMIN_API.md 5절도 저장소에 없어서,
// backend/app/models/notice.py의 Notice 모델 필드를 그대로 가져와 썼다(사용자 확인).
// 화면은 이 타입을 통해서만 필드에 접근하게 해서, 나중에 실제 계약이 다르게 나와도 여기 한 곳만 고치면 되게 한다.
export interface Notice {
  id: number;
  title: string;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
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
