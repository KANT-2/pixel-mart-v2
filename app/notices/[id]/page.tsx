"use client";
// NOTE: 실제 공지 API(#95)가 붙으면 이 페이지를 서버 컴포넌트로 되돌릴 것(그때는 Next 16 규칙대로
// params를 Promise로 받아 <Suspense> 안쪽 자식에서 await한다).
// 지금은 mocks/notices.ts의 메모리를 /admin/notices와 공유하려고 클라이언트 전용으로 만들어서,
// 동적 경로 id도 서버의 params Promise 대신 useParams()로 받는다 — AGENTS.md 기본 패턴과 다른 임시 예외.

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import PixelStar from "@/components/PixelStar";
import { ApiError } from "@/lib/api";
import { getPublicNotice, getPublicNotices } from "@/lib/notices";
import type { Notice } from "@/types/notice";
import { adjacentNotices, formatNoticeDate, sortNotices } from "@/utils/notices";

interface Adjacent { older: Notice | null; newer: Notice | null }

// useParams()는 빌드 시 미리 그릴 수 없는 값이라(Cache Components), Suspense로 감싸야 한다
export default function NoticeDetailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10"><div className="h-40 animate-pulse rounded-xl bg-panel" /></div>}>
      <NoticeDetailContent />
    </Suspense>
  );
}

function NoticeDetailContent() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [adjacent, setAdjacent] = useState<Adjacent>({ older: null, newer: null });
  const [notFoundError, setNotFoundError] = useState(false); // 공지가 없거나 숨김 상태일 때(404)
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setNotFoundError(false);
    try {
      const [detail, all] = await Promise.all([getPublicNotice(id), getPublicNotices()]);
      setNotice(detail);
      setAdjacent(adjacentNotices(sortNotices(all), id));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) setNotFoundError(true);
      else setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, [id]);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소의 id 자체가 잘못됐으면 바로 "없음" 화면을 켠다
      setNotFoundError(true);
      return;
    }
    void load();
  }, [id, load]);

  if (notFoundError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">공지를 찾을 수 없어요</h1>
        <p className="mt-3 text-sm text-sub">삭제됐거나 숨김 처리된 공지예요.</p>
        <Link href="/notices" className="btn-lime mt-6 inline-block px-6 py-3 font-bold text-lime-ink">공지 목록으로</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs text-dim">
        <Link href="/" className="hover:text-mint">홈</Link> / <Link href="/notices" className="hover:text-mint">NOTICE</Link>
      </p>

      {loadError && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
          <p className="text-sm text-pink">{loadError}</p>
          <button type="button" onClick={() => void load()} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      {!notice && !loadError && <div className="mt-6 h-40 animate-pulse rounded-xl bg-panel" role="status" aria-label="공지 불러오는 중" />}

      {/* 사이트 상품 카드와 같은 테두리·색(pixel-panel) — 제목·날짜·본문·이전/다음 글만 담는다 */}
      {notice && (
        <div className="pixel-panel mt-6 p-5 sm:p-6">
          {notice.isPinned && (
            <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-lime">
              <PixelStar className="size-4" withLabel={false} />
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
            <AdjacentLink label="이전 글" notice={adjacent.older} />
            <AdjacentLink label="다음 글" notice={adjacent.newer} />
          </div>
        </div>
      )}

      {notice && (
        <Link href="/notices" className="btn-pixel mt-6 inline-flex min-h-11 items-center px-4 text-sm font-bold">목록으로 돌아가기</Link>
      )}
    </div>
  );
}

function AdjacentLink({ label, notice }: { label: string; notice: Notice | null }) {
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
