// lib/notices.ts — 손님용 공지 조회(공개 API, 인증 불필요). 서버 컴포넌트에서만 쓴다(lib/products.ts와 같은 패턴).
// 관리자 CRUD는 lib/adminNotices.ts에 따로 있다(로그인 쿠키가 필요해 클라이언트 컴포넌트에서 호출).
import { cacheLife } from "next/cache";
import { ApiError, serverFetch } from "@/lib/api";
import type { Page } from "@/types/api";
import type { NoticeDetail, NoticeQuery, NoticeSummary } from "@/types/notice";

// 배포 백엔드(Render)까지 왕복이 요청마다 0.2초쯤 걸려, 공지는 "minutes"(1분마다 백그라운드 갱신)로 캐시한다.
// 페이지 셸에 내용이 미리 들어가 클릭 즉시 보이고, 관리자가 고친 공지는 1분 남짓 뒤에 반영된다.

function toQuery(params: NoticeQuery): string {
  const search = new URLSearchParams();
  if (params.pinned !== undefined) search.set("pinned", String(params.pinned));
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  const text = search.toString();
  return text ? `?${text}` : "";
}

// 서버가 게시중인 공지만, 고정 먼저·최신순으로 이미 정렬해서 준다
export async function getNotices(params: NoticeQuery = {}): Promise<Page<NoticeSummary>> {
  "use cache";
  cacheLife("minutes");
  return serverFetch<Page<NoticeSummary>>(`/notices${toQuery(params)}`);
}

/** 없거나 숨김인 공지(404)는 null — 캐시 경계를 넘으며 에러 클래스가 바뀌어도 판단이 흔들리지 않게 값으로 돌려준다 */
export async function getNotice(id: number): Promise<NoticeDetail | null> {
  "use cache";
  cacheLife("minutes");
  try {
    return await serverFetch<NoticeDetail>(`/notices/${id}`);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}
