"use client";

import { useCallback, useState } from "react";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { useAuth } from "@/components/AuthProvider";
import { LocalError } from "@/components/local/LocalStates";
import { useLocalResource } from "@/components/local/useLocalResource";
import { ApiError } from "@/lib/api";
import { localApi } from "@/lib/local";
import { badgeTags, canFeature, itemProgress, progressCells } from "@/utils/badgeBook";

/** 마이페이지 뱃지 도감 — 받은 뱃지는 밝게, 아직인 뱃지는 흐리게 조건과 함께 */
export default function BadgeBook() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <BadgeGrid />;
}

function BadgeGrid() {
  const load = useCallback((signal: AbortSignal) => localApi.myBadges(signal), []);
  const book = useLocalResource(load);
  const [saving, setSaving] = useState<string | null>(null); // 저장 중인 뱃지 코드 ("auto" = 자동으로 돌리기)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const data = book.data;
  const featuredName = data?.items.find((item) => item.code === data.featured)?.name;

  // 대표 뱃지 고르기 (#106) — 서버가 새 도감을 돌려주니 그걸로 바로 바꾼다 (이웃 카드도 서버 값으로 바뀜)
  async function feature(code: string | null) {
    if (saving) return;
    setSaving(code ?? "auto"); setMessage(null);
    try {
      const next = await localApi.setFeaturedBadge(code);
      book.replace(next);
      const name = next.items.find((item) => item.code === next.featured)?.name;
      setMessage({ text: code ? `대표 뱃지를 바꿨어요 — ${name ?? "뱃지"}` : "대표 뱃지를 자동으로 돌렸어요.", error: false });
    } catch (cause) {
      setMessage({ text: cause instanceof ApiError ? cause.message : "대표 뱃지를 바꾸지 못했어요. 다시 시도해 주세요.", error: true });
    } finally {
      setSaving(null);
    }
  }

  return <section aria-label="뱃지 도감" className="pixel-panel mb-6 p-5 text-left">
    <div className="flex items-center justify-between gap-3">
      <p className="font-pixel text-[11px] tracking-widest text-lime">▶ BADGES</p>
      {data && <p className="text-sm text-sub"><strong className="text-ink">{data.earnedCount}</strong> / {data.total}</p>}
    </div>
    {book.loading && !data ? <div className="mt-3 h-40 animate-pulse rounded-lg bg-panel-2" />
      : book.error && !data ? <div className="mt-3"><LocalError message={book.error} onRetry={book.refresh} /></div>
      : data && <>
        {/* 도감 진행 막대 — 뱃지 수만큼 픽셀 칸 */}
        <div role="progressbar" aria-label="뱃지 도감 진행" aria-valuemin={0} aria-valuemax={data.total} aria-valuenow={data.earnedCount}
          aria-valuetext={`${data.total}개 중 ${data.earnedCount}개 받음`} className="mt-3 flex gap-0.5 rounded border-2 border-line bg-night p-1">
          {progressCells(data).map((filled, index) => <span key={index} className={`h-3 min-w-0 flex-1 ${filled ? "bg-lime" : "bg-panel-2"}`} />)}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-sub">대표 뱃지 <strong className="text-ink">{featuredName ?? "아직 없음"}</strong></p>
          {data.earnedCount > 0 && <button type="button" onClick={() => feature(null)} disabled={Boolean(saving)}
            className="min-h-9 rounded px-2 text-xs text-dim underline-offset-4 hover:text-ink hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-mint">
            {saving === "auto" ? "바꾸는 중…" : "자동으로 돌리기"}
          </button>}
        </div>
        <p role={message?.error ? "alert" : "status"} className={`min-h-5 text-xs ${message?.error ? "text-pink" : "text-mint"}`}>{message?.text}</p>

        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.items.map((badge) => {
            const isFeatured = badge.earned && badge.code === data.featured;
            const progress = itemProgress(badge);
            const tags = badgeTags(badge);
            return <li key={badge.code} title={badge.description}
              className={`flex flex-col rounded-lg border p-2.5 ${isFeatured ? "border-lime bg-panel-2" : badge.earned ? "border-lime/40 bg-panel-2" : "border-line bg-night"}`}>
              <p className="flex items-center gap-2 text-sm font-bold">
                <PixelAvatar src={badge.image} className={`size-8 shrink-0 ${badge.earned ? "" : "opacity-40 grayscale"}`} />
                <span className={`truncate ${badge.earned ? "" : "text-sub"}`}>{badge.name}</span>
                <span className="sr-only">{badge.earned ? "받음" : "아직 못 받음"}</span>
              </p>
              {tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">
                {tags.map((tag) => <span key={tag} className={`rounded border px-1 font-pixel text-[9px] leading-4 ${tag === "NEW" ? "border-pink/60 text-pink" : "border-mint/60 text-mint"}`}>{tag}</span>)}
              </p>}
              <p className={`mt-1 text-[11px] leading-snug ${badge.earned ? "text-sub" : "text-dim"}`}>{badge.description}</p>
              {badge.grantedMemo && <p className="mt-1 break-words text-[11px] leading-snug text-mint">&ldquo;{badge.grantedMemo}&rdquo;</p>}
              {progress && <div className="mt-2">
                <div role="progressbar" aria-label={`${badge.name} 진행`} aria-valuemin={0} aria-valuemax={progress.goal} aria-valuenow={progress.current}
                  className="h-1.5 overflow-hidden rounded-sm bg-panel-2">
                  <div className="h-full bg-mint/70" style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-0.5 text-right text-[10px] text-dim">{progress.current} / {progress.goal}</p>
              </div>}
              <div className="mt-auto pt-2">
                {isFeatured ? <p className="text-xs font-bold text-lime">★ 대표</p>
                  : canFeature(badge, data.featured) && <button type="button" onClick={() => feature(badge.code)} disabled={Boolean(saving)}
                    aria-label={`${badge.name}을(를) 대표 뱃지로`}
                    className="min-h-8 btn-pixel px-2 text-xs font-bold disabled:opacity-50">
                    {saving === badge.code ? "바꾸는 중…" : "대표로"}
                  </button>}
              </div>
            </li>;
          })}
        </ul>
        <p className="mt-3 text-xs text-dim">대표 뱃지는 이웃 카드에 보여요. 고르지 않으면 받은 뱃지 중 가장 받기 어려운 뱃지가 대표가 돼요.</p>
      </>}
  </section>;
}
