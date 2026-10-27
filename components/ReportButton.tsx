"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { canReport, REPORT_MEMO_LIMIT, REPORT_REASONS, REPORT_TARGET_LABEL, reportsApi, validateReportMemo, type ReportReason, type ReportTargetType } from "@/lib/reports";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: number;
  isMine?: boolean | null;
  hidden?: boolean | null;
  isSample?: boolean | null;
  className?: string;
}

/** 신고 버튼 + 사유 고르기 창 (#107) — 로그인했고 남의 글일 때만 보인다 */
export default function ReportButton({ targetType, targetId, isMine, hidden, isSample, className = "" }: ReportButtonProps) {
  const { user, refresh: refreshAuth } = useAuth();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const label = REPORT_TARGET_LABEL[targetType];

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, busy]);

  if (!canReport({ isMine, hidden, isSample }, Boolean(user))) return null;

  function close() {
    if (busy) return;
    setOpen(false);
    trigger.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!reason) { setError("신고 사유를 골라 주세요."); return; }
    const memoError = validateReportMemo(memo);
    if (memoError) { setError(memoError); return; }
    setBusy(true); setError(null);
    try {
      await reportsApi.create({ targetType, targetId, reason, memo });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "신고를 보내지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button ref={trigger} type="button" onClick={() => { setOpen(true); setError(null); }} disabled={done}
      aria-label={done ? `이 ${label} 신고 접수됨` : `이 ${label} 신고하기`}
      className={`mt-3 inline-flex min-h-9 items-center rounded px-2 text-xs text-dim underline-offset-4 hover:text-pink hover:underline disabled:no-underline disabled:hover:text-dim focus-visible:outline-2 focus-visible:outline-mint ${className}`}>
      {done ? "신고 접수됨" : "신고"}
    </button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-3 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="pixel-panel w-full max-w-sm p-5 text-left">
        <h2 id={`${id}-title`} className="text-base font-bold text-ink">{done ? `${label} 신고 완료` : `이 ${label}을(를) 신고할까요?`}</h2>
        {done ? <>
          <p role="status" className="mt-3 text-sm text-mint">신고가 접수됐어요. 관리자가 확인한 뒤 조치할게요.</p>
          <div className="mt-5 flex justify-end"><button type="button" onClick={close} autoFocus className="btn-pixel px-4 py-2 text-sm font-bold">닫기</button></div>
        </> : <form onSubmit={submit} noValidate>
          <fieldset disabled={busy} className="mt-3">
            <legend className="mb-2 text-sm text-sub">사유를 골라 주세요</legend>
            <div className="grid gap-1">
              {REPORT_REASONS.map((item, index) => <label key={item.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-panel-2">
                <input ref={index === 0 ? first : undefined} type="radio" name={`${id}-reason`} value={item.value} checked={reason === item.value}
                  onChange={() => { setReason(item.value); setError(null); }} className="size-4 accent-mint" />{item.label}
              </label>)}
            </div>
            <label htmlFor={`${id}-memo`} className="mb-1 mt-3 block text-sm text-sub">자세한 내용 (선택)</label>
            <textarea id={`${id}-memo`} value={memo} rows={3} maxLength={REPORT_MEMO_LIMIT} onChange={(event) => setMemo(event.target.value)}
              className="w-full min-w-0 resize-y pixel-input p-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
            <p className="mt-1 text-right text-xs text-dim">{Array.from(memo).length} / {REPORT_MEMO_LIMIT}자</p>
          </fieldset>
          {error && <p role="alert" className="mt-2 text-sm text-pink">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close} disabled={busy} className="btn-pixel px-4 py-2 text-sm font-bold">취소</button>
            <button type="submit" disabled={busy} className="btn-pixel border-pink px-4 py-2 text-sm font-bold text-pink disabled:opacity-50">{busy ? "보내는 중…" : "신고하기"}</button>
          </div>
        </form>}
      </div>
    </div>}
  </>;
}
