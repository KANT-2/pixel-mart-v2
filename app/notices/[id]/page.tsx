// 공지 API(#95)가 실제 서버에 연결돼 있고 인증 없이 보는 공개 데이터라, 서버 컴포넌트로 만든다
// (목업 메모리를 관리자 화면과 공유하려고 클라이언트 전용으로 만들었던 이전 버전과 다름).
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import PixelStar from "@/components/PixelStar";
import { getNotice, getNotices } from "@/lib/notices";
import type { NoticeSummary } from "@/types/notice";
import { adjacentNotices, formatNoticeDate } from "@/utils/notices";

// 게시 중인 공지는 빌드 때 미리 만들어 첫 클릭부터 바로 보이게 한다.
// 공지 API가 꺼져 있어도(빌드 환경 등) 상세 경로를 최소 1개 미리 만들어 둔다
export async function generateStaticParams() {
  const list = await getNotices({ size: 60 }).catch(() => null);
  const ids = list?.items.map((notice) => ({ id: String(notice.id) })) ?? [];
  return ids.length > 0 ? ids : [{ id: "1" }];
}

export default function NoticeDetailPage({ params }: PageProps<"/notices/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<NoticeDetailSkeleton />}>
        <NoticeDetailContent params={params} />
      </Suspense>
    </div>
  );
}

async function NoticeDetailContent({ params }: { params: PageProps<"/notices/[id]">["params"] }) {
  const { id } = await params; // Next 16: params는 Promise
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId) || noticeId <= 0) notFound(); // 숫자가 아니면 바로 "없는 공지" 화면

  // 본문과 이전/다음 글 계산용 목록을 동시에 받는다(차례로 받으면 백엔드 왕복이 두 번 쌓임).
  // 목록은 공지 수가 많지 않은 전제로 한 번에 넉넉히 받아온다(60개 넘으면 범위 밖 글은 못 찾음)
  const [notice, list] = await Promise.all([getNotice(noticeId), getNotices({ size: 60 })]);
  if (!notice) notFound(); // 삭제됐거나 숨김 상태
  const { older, newer } = adjacentNotices(list.items, noticeId);

  return (
    <>
      <p className="text-xs text-dim">
        <Link href="/" className="hover:text-mint">홈</Link> / <Link href="/notices" className="hover:text-mint">NOTICE</Link>
      </p>

      {/* 사이트 상품 카드와 같은 테두리·색(pixel-panel) — 제목·날짜·본문·이전/다음 글만 담는다 */}
      <div className="pixel-panel mt-6 p-5 sm:p-6">
        {notice.isPinned && (
          <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-lime">
            <PixelStar className="h-4 w-auto" withLabel={false} />
            중요 공지
          </span>
        )}
        <h1 className="break-words text-2xl font-bold text-ink [overflow-wrap:anywhere]">{notice.title}</h1>
        <p className="mt-2 text-xs text-dim">{formatNoticeDate(notice.createdAt)}</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-sub">
          {/* 줄바꿈마다 문단으로 — HTML을 해석하지 않고 글자 그대로만 보여준다(XSS 안전) */}
          {notice.content.split("\n").map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{paragraph}</p>
          ))}
        </div>

        <div className="mt-8 space-y-2 border-t border-line pt-4 text-sm">
          <AdjacentLink label="이전 글" notice={older} />
          <AdjacentLink label="다음 글" notice={newer} />
        </div>
      </div>

      <Link href="/notices" className="btn-pixel mt-6 inline-flex min-h-11 items-center px-4 text-sm font-bold">목록으로 돌아가기</Link>
    </>
  );
}

function AdjacentLink({ label, notice }: { label: string; notice: NoticeSummary | null }) {
  if (!notice) {
    return (
      <p className="flex items-center gap-2 text-dim">
        <span className="w-14 shrink-0 font-bold">{label}</span>
        <span>없음</span>
      </p>
    );
  }
  return (
    <Link href={`/notices/${notice.id}`} className="flex items-center gap-2 hover:text-mint">
      <span className="w-14 shrink-0 font-bold text-ink">{label}</span>
      <span className="truncate">{notice.title}</span>
    </Link>
  );
}

function NoticeDetailSkeleton() {
  return <div className="h-40 animate-pulse rounded-xl bg-panel" role="status" aria-label="공지 불러오는 중" />;
}
