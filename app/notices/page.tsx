// 공지 API(#95)가 실제 서버에 연결돼 있고 인증도 필요 없는 공개 데이터라, AGENTS.md 기본 규칙대로
// 서버 컴포넌트에서 불러온다(목업 메모리를 공유하려고 클라이언트로 만들었던 이전 버전과 다름).
import Link from "next/link";
import { Suspense } from "react";
import Pagination from "@/components/Pagination"; // 공개 화면 공용 페이지 이동 (수정하지 않고 그대로 재사용)
import PixelStar from "@/components/PixelStar";
import { getNotices } from "@/lib/notices";
import { formatNoticeDate, isRecentNotice } from "@/utils/notices";

const PAGE_SIZE = 20;

// "▶ 라벨" 글꼴·크기·색·깜빡임은 app/page.tsx의 SectionTitle("▶ QUEST · RECOMMENDED")과 같은 클래스를 그대로 재사용한다
const SECTION_LABEL_CLASS = "font-pixel text-xs tracking-widest text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]";

export default function NoticesPage({ searchParams }: PageProps<"/notices">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className={SECTION_LABEL_CLASS}>▶ NOTICE</h1>
      <Suspense fallback={<NoticesSkeleton />}>
        <NoticesList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NoticesList({ searchParams }: { searchParams: PageProps<"/notices">["searchParams"] }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const result = await getNotices({ page, size: PAGE_SIZE });

  if (result.items.length === 0) {
    return (
      <div className="mt-10 text-center">
        <p className="font-pixel text-sm text-dim">NO NOTICE YET</p>
        <p className="mt-2 text-sm text-sub">아직 올라온 공지가 없어요.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-6 divide-y divide-line">
        {result.items.map((notice) => (
          <li key={notice.id}>
            <Link
              href={`/notices/${notice.id}`}
              className="flex flex-col gap-1 py-4 hover:text-mint sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                {/* 아이콘 칸 폭을 고정해서, 별이 없는 공지도 제목 시작 위치가 같게 맞춘다 */}
                <span className="flex w-5 shrink-0 items-center justify-center">
                  {notice.isPinned && <PixelStar className="h-4 w-auto" />}
                </span>
                <span className="min-w-0 break-words font-bold text-ink [overflow-wrap:anywhere]">{notice.title}</span>
                {isRecentNotice(notice.createdAt) && (
                  <span className="shrink-0 rounded-md bg-pink/10 px-1.5 py-0.5 text-xs font-bold text-pink">NEW</span>
                )}
              </span>
              <span className="shrink-0 pl-7 text-xs text-dim sm:pl-0">{formatNoticeDate(notice.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination currentPage={result.page} totalPages={result.totalPages} basePath="/notices" />
    </>
  );
}

function NoticesSkeleton() {
  return (
    <div className="mt-6 space-y-3" role="status" aria-label="공지 목록 불러오는 중">
      {[0, 1, 2].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-panel" />)}
    </div>
  );
}
