// lib/notices.ts — 손님용 공지 조회(공개 API, 인증 불필요). 서버 컴포넌트에서만 쓴다(lib/products.ts와 같은 패턴).
// 관리자 CRUD는 lib/adminNotices.ts에 따로 있다(로그인 쿠키가 필요해 클라이언트 컴포넌트에서 호출).
import { cacheLife } from "next/cache";
import { ApiError, serverFetch } from "@/lib/api";
import type { Page } from "@/types/api";
import type { NoticeDetail, NoticeQuery, NoticeSummary } from "@/types/notice";

// 배포 백엔드(Render)까지 왕복이 요청마다 0.2초쯤 걸려, 공지는 "minutes"(1분마다 백그라운드 갱신)로 캐시한다.
// 페이지 셸에 내용이 미리 들어가 클릭 즉시 보이고, 관리자가 고친 공지는 1분 남짓 뒤에 반영된다.
//
// 백엔드에 닿지 못하면(빌드 환경 · 잠든 Render) 캐시 안에서 throw하지 않는다 — "use cache" 안의 오류는 빌드를 멈추기 때문.
// 대신 "seconds"로 아주 짧게 캐시한 실패 값을 돌려준다: 이 수명은 미리 만들기에서 빠져(요청 때 다시 시도) 빌드가 통과하고,
// 요청 중에 실패하면 아래 공개 함수가 throw해 공통 오류 화면(app/error.tsx)으로 간다.
const UNAVAILABLE = { unavailable: true } as const;
type Unavailable = typeof UNAVAILABLE;

function toQuery(params: NoticeQuery): string {
  const search = new URLSearchParams();
  if (params.pinned !== undefined) search.set("pinned", String(params.pinned));
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  const text = search.toString();
  return text ? `?${text}` : "";
}

function orThrow<T>(value: T | Unavailable): T {
  if (value && typeof value === "object" && "unavailable" in value) throw new Error("공지를 불러오지 못했습니다");
  return value as T;
}

async function cachedNotices(params: NoticeQuery): Promise<Page<NoticeSummary> | Unavailable> {
  "use cache";
  try {
    const page = await serverFetch<Page<NoticeSummary>>(`/notices${toQuery(params)}`);
    cacheLife("minutes");
    return page;
  } catch {
    cacheLife("seconds");
    return UNAVAILABLE;
  }
}

async function cachedNotice(id: number): Promise<NoticeDetail | null | Unavailable> {
  "use cache";
  try {
    const notice = await serverFetch<NoticeDetail>(`/notices/${id}`);
    cacheLife("minutes");
    return notice;
  } catch (cause) {
    // 없거나 숨김인 공지(404)는 null — 캐시 경계를 넘으며 에러 클래스가 바뀌어도 판단이 흔들리지 않게 값으로 돌려준다
    if (cause instanceof ApiError && cause.status === 404) {
      cacheLife("minutes");
      return null;
    }
    cacheLife("seconds");
    return UNAVAILABLE;
  }
}

// 서버가 게시중인 공지만, 고정 먼저·최신순으로 이미 정렬해서 준다
export async function getNotices(params: NoticeQuery = {}): Promise<Page<NoticeSummary>> {
  return orThrow(await cachedNotices(params));
}

export async function getNotice(id: number): Promise<NoticeDetail | null> {
  return orThrow(await cachedNotice(id));
}
