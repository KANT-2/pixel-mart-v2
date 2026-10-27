"use client";
// NOTE: 실제 공지 API(#95)가 붙으면 이 페이지를 서버 컴포넌트로 되돌릴 것.
// 지금은 mocks/notices.ts의 메모리 배열을 관리자 화면(/admin/notices)과 같은 브라우저 모듈에서
// 공유해야 "관리자가 숨기면 손님 화면에도 반영된다"가 성립해서, 예외적으로 클라이언트 컴포넌트로 만들었다.
// (서버 컴포넌트와 클라이언트 컴포넌트는 별도 모듈 그래프라 같은 파일을 import해도 배열이 공유되지 않는다.)

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PixelStar from "@/components/PixelStar";
import { ApiError } from "@/lib/api";
import { getPublicNotices } from "@/lib/notices";
import type { Notice } from "@/types/notice";
import { formatNoticeDate, isRecentNotice, sortNotices } from "@/utils/notices";

// "▶ 라벨" 글꼴·크기·색·깜빡임은 app/page.tsx의 SectionTitle("▶ QUEST · RECOMMENDED")과 같은 클래스를 그대로 재사용한다
// (목록 안의 각 줄에는 깜빡임을 넣지 않고, 맨 위 라벨 하나에만 쓴다)
const SECTION_LABEL_CLASS = "font-pixel text-xs tracking-widest text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]";

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setNotices(sortNotices(await getPublicNotices())); // 고정 공지가 맨 위, 나머지는 최신순
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페이지에 들어오면 바로 목록을 불러온다
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className={SECTION_LABEL_CLASS}>▶ NOTICE</h1>

      {loadError && (
        <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
          <p className="text-sm text-pink">{loadError}</p>
          <button type="button" onClick={() => void load()} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      {!notices && !loadError && (
        <div className="mt-6 space-y-3" role="status" aria-label="공지 목록 불러오는 중">
          {[0, 1, 2].map((key) => <div key={key} className="h-16 animate-pulse rounded-xl bg-panel" />)}
        </div>
      )}

      {notices && notices.length === 0 && (
        <div className="mt-10 text-center">
          <p className="font-pixel text-sm text-dim">NO NOTICE YET</p>
          <p className="mt-2 text-sm text-sub">아직 올라온 공지가 없어요.</p>
        </div>
      )}

      {notices && notices.length > 0 && (
        <ul className="mt-6 divide-y divide-line">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link
                href={`/notices/${notice.id}`}
                className="flex flex-col gap-1 py-4 hover:text-mint sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {/* 아이콘 칸 폭을 고정해서, 별이 없는 공지도 제목 시작 위치가 같게 맞춘다 */}
                  <span className="flex w-5 shrink-0 items-center justify-center">
                    {notice.isPinned && <PixelStar className="size-4" />}
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
      )}
    </div>
  );
}
