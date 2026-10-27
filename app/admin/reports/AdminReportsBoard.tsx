"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import AdminPagination from "@/components/admin/Pagination";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import type { ReportTargetType } from "@/lib/reports";
import type { Page } from "@/types/api";
import AdminReportCard from "./AdminReportCard";
import {
  ADMIN_REPORTS_PATH, adminReportsApi, adminReportsHref, confirmText, doneText, emptyMessage, statusOptions, typeOptions,
  type AdminReportAction, type AdminReportQuery, type ApiAdminReport,
} from "./adminReports";

const LOAD_ERROR = "신고 목록을 불러오지 못했어요. 다시 시도해 주세요.";
const errorText = (cause: unknown, fallback = LOAD_ERROR) => (cause instanceof ApiError ? cause.message : fallback);

// 상태 탭 · 종류 칩 · 목록 · 쪽 이동 — 주소창 쿼리가 바뀌면 page.tsx가 key로 새로 그린다
export default function AdminReportsBoard({ status, type, page }: AdminReportQuery) {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [data, setData] = useState<Page<ApiAdminReport> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ report: ApiAdminReport; action: AdminReportAction } | null>(null); // 확인 창 대상
  const [busy, setBusy] = useState(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminReportsApi.list({ status, type, page }, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(errorText(cause)); setLoading(false); } },
    );
    return () => controller.abort();
  }, [status, type, page]);

  // 처리 뒤·다시 시도 — 같은 조건으로 다시 받아 온다 (이번 쪽이 비면 앞 쪽으로)
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminReportsApi.list({ status, type, page }, signal);
      if (signal.aborted) return;
      if (!next.items.length && page > 1) { router.replace(adminReportsHref({ status, type, page: Math.max(1, Math.min(page - 1, next.totalPages || 1)) })); return; }
      setData(next);
    } catch (cause) {
      if (!signal.aborted) setError(errorText(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  // 확인 창에서 [숨기기]/[그대로 두기] → 서버 처리 → 목록 다시 받기
  async function resolve() {
    if (!pending || busy) return;
    const { report, action } = pending;
    setBusy(true); setNotice(null); setError(null);
    try {
      await adminReportsApi.resolve(report.id, action);
      setPending(null);
      setNotice(doneText(report, action));
      void reload();
    } catch (cause) {
      setPending(null);
      setError(errorText(cause, "신고를 처리하지 못했어요. 다시 시도해 주세요."));
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
      else if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) void reload(); // 이미 처리됐거나 사라진 신고
    } finally {
      setBusy(false);
    }
  }

  const go = (next: Partial<AdminReportQuery>) => router.push(adminReportsHref({ status, type, ...next, page: 1 }), { scroll: false });
  const empty = emptyMessage({ status, type });
  const dialog = pending ? confirmText(pending.report, pending.action) : null;

  return <div>
    <h1 className="text-xl font-bold text-ink">신고함</h1>
    <p className="mt-1 text-sm text-sub">손님이 신고한 문의 · 리뷰 · 거래글 · 아바타를 확인하고 숨기거나 그대로 둬요. 같은 대상의 신고는 한 줄로 묶여요.</p>

    <div className="mt-5 space-y-3">
      <div role="group" aria-label="처리 상태" className="segmented h-11 self-start">
        {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => { if (option.value !== status) go({ status: option.value }); }} className="text-sm font-bold">{option.label}</button>)}
      </div>
      <div role="group" aria-label="신고 대상 종류" className="flex gap-2 overflow-x-auto pb-1">
        <TypeChip active={type === null} label="전체" onClick={() => go({ type: null })} />
        {typeOptions.map((option) => <TypeChip key={option.value} active={type === option.value} label={option.label} onClick={() => go({ type: option.value as ReportTargetType })} />)}
      </div>
    </div>

    <div className="mt-5 space-y-3">
      {notice && <p role="status" className="rounded-xl border border-mint/30 bg-panel p-4 text-sm text-mint">{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">
        <p>{error}</p>
        <button type="button" disabled={loading} onClick={() => void reload()} className="mt-2 min-h-11 font-bold underline underline-offset-4">다시 시도</button>
      </div>}
      {loading && !data && !error ? <div aria-label="신고 목록 불러오는 중" className="space-y-3">
        {[0, 1, 2].map((index) => <div key={index} className="h-40 animate-pulse rounded-xl bg-panel" />)}
      </div> : data && (data.items.length ? <>
        <p className="text-xs text-dim">총 {data.total}건</p>
        <ul aria-label="신고 목록" aria-busy={loading} className="space-y-3">
          {data.items.map((report) => <AdminReportCard key={report.id} report={report} busy={busy} onAction={(action) => { setNotice(null); setPending({ report, action }); }} />)}
        </ul>
      </> : <div className="pixel-panel p-8 text-center">
        <p className="font-bold text-ink">{empty.title}</p>
        <p className="mt-2 text-sm text-sub">{empty.body}</p>
      </div>)}
    </div>

    {data && <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={ADMIN_REPORTS_PATH} query={{ status: status === "open" ? undefined : status, type: type ?? undefined }} />}

    <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description}
      confirmLabel={busy ? "처리 중…" : dialog?.confirm} danger={pending?.action === "hide"}
      onConfirm={() => void resolve()} onClose={() => { if (!busy) setPending(null); }} />
  </div>;
}

function TypeChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold ${active ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"}`}>
    {label}
  </button>;
}
