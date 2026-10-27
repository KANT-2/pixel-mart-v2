"use client";
// NOTE: 실제 공지 API(#95)가 붙으면 이 컴포넌트는 그대로 두되, 데이터 출처(lib/notices.ts)만 서버 API로 바뀐다.
// 지금은 mocks/notices.ts의 메모리를 /admin/notices·/notices와 공유해야 해서 클라이언트 컴포넌트로 만들었다
// (서버 컴포넌트와 클라이언트 컴포넌트는 별도 모듈 그래프라 같은 파일을 import해도 배열이 공유되지 않는다).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getPublicNotices } from "@/lib/notices";
import type { Notice } from "@/types/notice";
import { cycleIndex, pinnedPublishedNotices } from "@/utils/notices";

// app/page.tsx의 SectionTitle("▶ QUEST · RECOMMENDED")과 같은 라벨 클래스 — 새 키프레임 없이 그대로 재사용(prefers-reduced-motion에서는 motion-safe: 덕분에 자동으로 멈춘다)
const LABEL_CLASS = "font-pixel text-xs tracking-widest text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]";
// 히어로 캐러셀의 ‹ › 버튼과 같은 모양(components/home/HomeCarousel.tsx) — 같은 Tailwind 클래스를 그대로 복사
const ARROW_CLASS = "grid size-8 shrink-0 place-items-center text-xl text-sub hover:text-mint focus-visible:outline-2 focus-visible:outline-mint";

type Status = "loading" | "empty" | "ready";

export default function NoticeBanner() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const targets = pinnedPublishedNotices(await getPublicNotices());
      setNotices(targets);
      setStatus(targets.length > 0 ? "ready" : "empty");
    } catch (cause) {
      // 배너는 꾸밈 정보라 실패해도 조용히 숨긴다(에러 문구로 공간을 차지하지 않는다)
      if (!(cause instanceof ApiError)) throw cause;
      setStatus("empty");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페이지에 들어오면 바로 대상 공지를 불러온다
    void load();
  }, [load]);

  const current = notices[index];
  const show = status === "ready" && !!current;

  return (
    // 로딩·빈 상태·닫힘 전환이 레이아웃을 덜 튀게, grid-template-rows를 0fr↔1fr로 트랜지션한다(높이를 몰라도 부드럽게 접힌다)
    <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: status === "loading" || show ? "1fr" : "0fr" }}>
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 md:px-8">
          {status === "loading" && <div className="h-5 w-full animate-pulse rounded bg-panel" />}

          {show && current && (
            <>
              <p className={`${LABEL_CLASS} shrink-0`}>▶ NOTICE</p>
              <Link href={`/notices/${current.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-ink hover:text-mint">
                {current.title}
              </Link>

              {notices.length > 1 && (
                // 제목이 flex-1 min-w-0로 알아서 줄어드니, 375px에서도 따로 줄바꿈 없이 한 줄에 같이 선다
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="이전 공지" onClick={() => setIndex((value) => cycleIndex(value, notices.length, -1))} className={ARROW_CLASS}>‹</button>
                  <span className="whitespace-nowrap text-xs text-dim">{index + 1} / {notices.length}</span>
                  <button type="button" aria-label="다음 공지" onClick={() => setIndex((value) => cycleIndex(value, notices.length, 1))} className={ARROW_CLASS}>›</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
