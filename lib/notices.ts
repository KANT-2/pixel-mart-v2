// lib/notices.ts — 손님용 공지 조회(공개 API, 인증 불필요). 서버 컴포넌트에서만 쓴다(lib/products.ts와 같은 패턴).
// 관리자 CRUD는 lib/adminNotices.ts에 따로 있다(로그인 쿠키가 필요해 클라이언트 컴포넌트에서 호출).
import { cache } from "react";
import { serverFetch } from "@/lib/api";
import type { Page } from "@/types/api";
import type { NoticeDetail, NoticeQuery, NoticeSummary } from "@/types/notice";

function toQuery(params: NoticeQuery): string {
  const search = new URLSearchParams();
  if (params.pinned !== undefined) search.set("pinned", String(params.pinned));
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  const text = search.toString();
  return text ? `?${text}` : "";
}

// 서버가 게시중인 공지만, 고정 먼저·최신순으로 이미 정렬해서 준다
export const getNotices = cache((params: NoticeQuery = {}): Promise<Page<NoticeSummary>> => {
  return serverFetch<Page<NoticeSummary>>(`/notices${toQuery(params)}`);
});

export const getNotice = cache((id: number): Promise<NoticeDetail> => {
  return serverFetch<NoticeDetail>(`/notices/${id}`);
});
