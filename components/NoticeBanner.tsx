"use client";
// NOTE: 공지 API(#95)는 이미 실제 서버에 연결돼 있다. 이 배너만 계속 클라이언트 컴포넌트로 남은 이유는
// 여러 고정 공지를 ‹ › 로 넘기는 인터랙션(상태)이 있어서다 — 공개 API라 인증은 필요 없고,
// HomeCarousel.tsx가 하듯 클라이언트에서 직접 불러온다(serverFetch는 서버 전용이라 여기서 못 쓴다).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Page } from "@/types/api";
import type { NoticeSummary } from "@/types/notice";
import { cycleIndex } from "@/utils/notices";

// app/page.tsx의 SectionTitle("▶ QUEST · RECOMMENDED")과 같은 라벨 클래스 — 새 키프레임 없이 그대로 재사용(prefers-reduced-motion에서는 motion-safe: 덕분에 자동으로 멈춘다)
// 375px에서는 자간(tracking-widest)이 자리를 많이 차지해서 좁은 화면에서만 좁히고, sm 이상에서는 원래대로 둔다
const LABEL_CLASS = "font-pixel text-xs tracking-normal sm:tracking-widest text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]";
// 히어로 캐러셀의 ‹ › 버튼과 같은 모양(components/home/HomeCarousel.tsx) — 같은 Tailwind 클래스를 쓰되, 375px에서는 버튼을 더 작게 줄인다
const ARROW_CLASS = "grid size-6 shrink-0 place-items-center text-base text-sub hover:text-mint focus-visible:outline-2 focus-visible:outline-mint sm:size-8 sm:text-xl";

type Status = "loading" | "empty" | "ready";

export default function NoticeBanner() {
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      // 서버가 게시중+고정인 것만, 이미 정렬해서 준다
      const result = await api.get<Page<NoticeSummary>>("/notices?pinned=true&size=5");
      setNotices(result.items);
      setStatus(result.items.length > 0 ? "ready" : "empty");
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
    // 로딩·빈 상태 전환이 레이아웃을 덜 튀게, grid-template-rows를 0fr↔1fr로 트랜지션한다(높이를 몰라도 부드럽게 접힌다)
    <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: status === "loading" || show ? "1fr" : "0fr" }}>
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1.5 gap-y-1.5 px-4 py-2.5 sm:gap-x-3 md:px-8">
          {status === "loading" && <div className="h-5 w-full animate-pulse rounded bg-panel" />}

          {show && current && (
            <>
              <p className={`${LABEL_CLASS} shrink-0`}>▶ NOTICE</p>
              <Link href={`/notices/${current.id}`} className="min-w-0 flex-1 truncate text-sm font-bold text-ink hover:text-mint">
                {current.title}
              </Link>

              {notices.length > 1 && (
                // 제목이 flex-1 min-w-0로 알아서 줄어드니, 375px에서도 따로 줄바꿈 없이 한 줄에 같이 선다.
                // 버튼 사이 간격(gap)도 375px에서는 바짝 붙여서 공지 제목이 잘릴 자리를 더 확보한다
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  <button type="button" aria-label="이전 공지" onClick={() => setIndex((value) => cycleIndex(value, notices.length, -1))} className={ARROW_CLASS}>‹</button>
                  <span className="whitespace-nowrap text-xs text-dim">{index + 1}/{notices.length}</span>
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
