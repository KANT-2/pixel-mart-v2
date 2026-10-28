"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { ApiError } from "@/lib/api";
import BadgeForm from "./BadgeForm";
import BadgeGrant from "./BadgeGrant";
import BadgeHolders from "./BadgeHolders";
import { adminBadgesApi, badgeStateLabel, type ApiAdminBadge, type ApiAdminBadgeList } from "./adminBadges";

// 위쪽에 하나만 펼치는 작업 칸 — 만들기 · 고치기 · 주기 · 받은 사람
type Panel = { mode: "create" } | { mode: "edit" | "grant" | "holders"; badge: ApiAdminBadge };

const LOAD_ERROR = "뱃지 목록을 불러오지 못했어요. 다시 시도해 주세요.";

// 관리자 뱃지 — 이벤트 뱃지(만들기 · 고치기 · 주기 · 회수) 위, 자동 뱃지(받은 사람 보기) 아래
export default function AdminBadgesBoard() {
  const [data, setData] = useState<ApiAdminBadgeList | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [deleting, setDeleting] = useState<ApiAdminBadge | null>(null); // 삭제 확인창 대상
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    Promise.all([adminBadgesApi.list(controller.signal), adminBadgesApi.images(controller.signal).catch(() => [] as string[])]).then(
      ([list, pictures]) => { if (!controller.signal.aborted) { setData(list); setImages(pictures); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(cause instanceof ApiError ? cause.message : LOAD_ERROR); setLoading(false); } },
    );
    return () => controller.abort();
  }, []);

  // 펼친 작업 칸이 보이게 위로 스크롤
  useEffect(() => { if (panel) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [panel]);

  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminBadgesApi.list(signal);
      if (!signal.aborted) setData(next);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof ApiError ? cause.message : LOAD_ERROR);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  function open(next: Panel) { setNotice(null); setPanel(next); }
  function done(message: string, keepPanel = false) {
    setNotice(message);
    if (!keepPanel) setPanel(null);
    void reload();
  }

  // 확인창에서 [삭제] → 받은 기록도 함께 지운다 (이벤트 뱃지만)
  async function remove() {
    if (!deleting || busy) return;
    const badge = deleting;
    setBusy(true); setNotice(null); setError(null);
    try {
      const res = await adminBadgesApi.remove(badge.code);
      setDeleting(null);
      if (panel && panel.mode !== "create" && panel.badge.code === badge.code) setPanel(null);
      done(`'${badge.name}' ${res.message}`, true);
    } catch (cause) {
      setDeleting(null);
      setError(cause instanceof ApiError ? cause.message : "뱃지를 삭제하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 404) void reload(); // 이미 지워진 뱃지
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink">뱃지</h1>
        <p className="mt-1 text-sm text-sub">이벤트 뱃지를 만들어 손님에게 주고, 받은 사람을 확인하고, 필요 없으면 삭제해요. 자동 뱃지는 활동 기록으로 정해져서 고치거나 지울 수 없어요.</p>
      </div>
      <button type="button" onClick={() => open({ mode: "create" })} className="btn-lime min-h-11 px-4 text-sm font-bold text-lime-ink">이벤트 뱃지 만들기</button>
    </header>

    {notice && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</p>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading} onClick={() => void reload()} className="btn-pixel min-h-11 shrink-0 px-4 text-sm font-bold">다시 시도</button>
    </div>}

    <div ref={panelRef} className="scroll-mt-24">
      {panel?.mode === "create" && <BadgeForm images={images} onCancel={() => setPanel(null)} onSaved={(badge) => done(`'${badge.name}' 이벤트 뱃지를 만들었어요. 이제 [주기]로 손님에게 줄 수 있어요.`)} />}
      {panel?.mode === "edit" && <BadgeForm key={panel.badge.code} badge={panel.badge} images={images} onCancel={() => setPanel(null)} onSaved={(badge) => done(`'${badge.name}' 뱃지를 고쳤어요.`)} />}
      {panel?.mode === "grant" && <BadgeGrant key={panel.badge.code} badge={panel.badge} onCancel={() => setPanel(null)} onGranted={(message) => done(message)} />}
      {panel?.mode === "holders" && <BadgeHolders key={panel.badge.code} badge={panel.badge} onClose={() => setPanel(null)} onRevoked={(message) => done(message, true)} />}
    </div>

    {loading && !data ? <div aria-label="뱃지 목록 불러오는 중" className="h-64 animate-pulse rounded-xl bg-panel" />
      : data && <>
        <BadgeSection title="이벤트 뱃지" count={data.event.length} empty="아직 이벤트 뱃지가 없어요. [이벤트 뱃지 만들기]로 시작해 보세요.">
          {data.event.map((badge) => <BadgeCard key={badge.code} badge={badge}>
            <button type="button" onClick={() => open({ mode: "edit", badge })} className="min-h-9 btn-pixel px-2.5 text-xs font-bold">고치기</button>
            {badge.isActive && <button type="button" onClick={() => open({ mode: "grant", badge })} className="min-h-9 btn-pixel px-2.5 text-xs font-bold text-lime">주기</button>}
            <button type="button" onClick={() => open({ mode: "holders", badge })} className="min-h-9 btn-pixel px-2.5 text-xs font-bold">받은 사람</button>
            <button type="button" disabled={busy} onClick={() => { setNotice(null); setDeleting(badge); }} className="min-h-9 btn-pixel px-2.5 text-xs font-bold text-pink disabled:opacity-50">삭제</button>
          </BadgeCard>)}
        </BadgeSection>
        <BadgeSection title="자동 뱃지" count={data.auto.length} empty="자동 뱃지가 없어요.">
          {data.auto.map((badge) => <BadgeCard key={badge.code} badge={badge}>
            <button type="button" onClick={() => open({ mode: "holders", badge })} className="min-h-9 btn-pixel px-2.5 text-xs font-bold">받은 사람</button>
          </BadgeCard>)}
        </BadgeSection>
      </>}

    <ConfirmDialog open={Boolean(deleting)} title={deleting ? `'${deleting.name}' 뱃지를 삭제할까요?` : ""}
      description={deleting?.holderCount ? `받은 ${deleting.holderCount}명에게서도 사라지고, 되돌릴 수 없어요. 잠시 안 보이게만 하려면 [고치기]에서 꺼 두세요.` : "되돌릴 수 없어요. 잠시 안 보이게만 하려면 [고치기]에서 꺼 두세요."}
      confirmLabel={busy ? "삭제 중…" : "삭제"} danger
      onConfirm={() => void remove()} onClose={() => { if (!busy) setDeleting(null); }} />
  </div>;
}

function BadgeSection({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return <section aria-label={title}>
    <h2 className="mb-3 text-base font-bold text-ink">{title} <span className="text-sm font-normal text-dim">{count}종</span></h2>
    {count ? <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</ul> : <p className="pixel-panel p-6 text-center text-sm text-sub">{empty}</p>}
  </section>;
}

function BadgeCard({ badge, children }: { badge: ApiAdminBadge; children: React.ReactNode }) {
  const off = badge.kind === "event" && !badge.isActive;
  return <li className={`pixel-panel flex min-w-0 flex-col p-4 ${off ? "opacity-70" : ""}`}>
    <div className="flex items-start gap-3">
      <PixelAvatar src={badge.image} alt="" className={`size-12 shrink-0 ${off ? "grayscale" : ""}`} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="break-words font-bold text-ink">{badge.name}</span>
          <span className={`rounded border px-1.5 text-[10px] font-bold ${badge.kind === "auto" ? "border-line text-dim" : badge.isActive ? "border-mint/40 text-mint" : "border-line text-dim"}`}>{badgeStateLabel(badge)}</span>
        </p>
        <p className="mt-1 break-words text-xs leading-snug text-sub">{badge.description}</p>
        <p className="mt-1 text-xs text-dim">받은 사람 <strong className="text-ink">{badge.holderCount}</strong>명</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap justify-end gap-1.5">{children}</div>
  </li>;
}
