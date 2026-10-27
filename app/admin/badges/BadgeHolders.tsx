"use client";

import { useEffect, useId, useRef, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ApiError } from "@/lib/api";
import type { Page } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import { adminBadgesApi, type ApiAdminBadge, type ApiBadgeHolder } from "./adminBadges";

interface BadgeHoldersProps {
  badge: ApiAdminBadge;
  onRevoked: (message: string) => void; // 회수하면 목록의 받은 사람 수도 다시 받는다
  onClose: () => void;
}

// 뱃지 받은 사람 — 이벤트 뱃지는 한 명씩 [회수] (자동 뱃지는 기록으로 정해져서 회수 없음)
export default function BadgeHolders({ badge, onRevoked, onClose }: BadgeHoldersProps) {
  const id = useId();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<ApiBadgeHolder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiBadgeHolder | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // 회수 뒤 같은 쪽을 다시 부르기
  const lifetime = useRef<AbortController | null>(null);
  const event = badge.kind === "event";

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminBadgesApi.holders(badge.code, page, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); setError(null); } },
      (cause) => { if (!controller.signal.aborted) { setError(cause instanceof ApiError ? cause.message : "받은 사람을 불러오지 못했어요."); setLoading(false); } },
    );
    return () => controller.abort();
  }, [badge.code, page, version]);

  function go(next: number) { setLoading(true); setPage(next); }

  async function revoke() {
    if (!revoking || busy) return;
    const target = revoking;
    setBusy(true); setError(null);
    try {
      await adminBadgesApi.revoke(badge.code, target.userId);
      setRevoking(null);
      onRevoked(`${target.nickname} 님의 '${badge.name}' 뱃지를 회수했어요.`);
      setLoading(true);
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      else setVersion((value) => value + 1);
    } catch (cause) {
      setRevoking(null);
      setError(cause instanceof ApiError ? cause.message : "회수하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby={`${id}-title`} className="pixel-panel space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={`${id}-title`} className="text-base font-bold text-ink">&apos;{badge.name}&apos; 받은 사람{data ? ` ${data.total}명` : ""}</h2>
      <button type="button" onClick={onClose} className="min-h-9 btn-pixel px-3 text-xs font-bold">닫기</button>
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    {loading && !data ? <div className="h-32 animate-pulse rounded bg-panel-2" />
      : data && (data.items.length ? <ul aria-busy={loading} className="divide-y divide-line/60 rounded border border-line">
        {data.items.map((holder) => <li key={holder.userId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="break-words font-bold text-ink">{holder.nickname} <span className="text-xs font-normal text-dim">#{holder.userId}</span></p>
            <p className="text-xs text-dim">
              <time dateTime={holder.earnedAt}>{formatDate(holder.earnedAt)}</time>
              {holder.grantedByNickname && ` · ${holder.grantedByNickname} 님이 줌`}
            </p>
            {holder.memo && <p className="mt-0.5 break-words text-xs text-sub">메모: {holder.memo}</p>}
          </div>
          {event && <button type="button" disabled={busy} onClick={() => setRevoking(holder)} className="min-h-9 btn-pixel shrink-0 px-3 text-xs font-bold text-pink disabled:opacity-50">회수</button>}
        </li>)}
      </ul> : <p className="text-sm text-dim">아직 받은 사람이 없어요.</p>)}

    {data && data.totalPages > 1 && <div className="flex items-center justify-center gap-2 text-sm">
      <button type="button" disabled={page <= 1 || loading} onClick={() => go(page - 1)} className="min-h-9 btn-pixel px-3 text-xs font-bold disabled:opacity-40">‹ 이전</button>
      <span className="text-dim">{page} / {data.totalPages}</span>
      <button type="button" disabled={page >= data.totalPages || loading} onClick={() => go(page + 1)} className="min-h-9 btn-pixel px-3 text-xs font-bold disabled:opacity-40">다음 ›</button>
    </div>}

    <ConfirmDialog open={Boolean(revoking)} title={revoking ? `${revoking.nickname} 님의 '${badge.name}' 뱃지를 회수할까요?` : ""}
      description="그 사람 도감에서 바로 사라지고, 대표 뱃지였다면 자동으로 바뀌어요." confirmLabel={busy ? "회수 중…" : "회수하기"} danger
      onConfirm={() => void revoke()} onClose={() => { if (!busy) setRevoking(null); }} />
  </section>;
}
