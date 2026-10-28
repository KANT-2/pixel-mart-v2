"use client";

import { useState, type FormEvent } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/utils/formatDate";
import { adminReviewsApi, type ApiAdminReview } from "./adminReviews";

const LIMIT = 500;

interface Props {
  review: ApiAdminReview;
  onSaved: () => void;
  onRemoved: () => void;
  onAuthExpired: () => void;
}

export default function AdminReviewReply({ review, onSaved, onRemoved, onAuthExpired }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(reply: string | null) {
    if (busy) return;
    const value = reply?.trim() ?? null;
    if (value !== null && (!value || Array.from(value).length > LIMIT)) {
      setError(`답글을 1~${LIMIT}자로 입력해 주세요.`);
      return;
    }
    setBusy(true); setError(null);
    try {
      await adminReviewsApi.setReply(review.id, value);
      setEditing(false); setConfirming(false);
      if (value === null) onRemoved(); else onSaved();
    } catch (cause) {
      setConfirming(false);
      setError(cause instanceof ApiError ? cause.message : "답글을 저장하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) onAuthExpired();
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(draft);
  }

  return <div className="mt-3 border-t border-line pt-3">
    {review.reply && !editing && <div className="border-l-2 border-mint bg-panel-2 p-3">
      <p className="text-xs font-bold text-mint">판매자 답글{review.repliedAt && <time dateTime={review.repliedAt} className="ml-2 font-normal text-dim">{formatDate(review.repliedAt)}</time>}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-sub">{review.reply}</p>
    </div>}
    {editing ? <form onSubmit={submit} className="space-y-2">
      <label htmlFor={`review-reply-${review.id}`} className="block text-xs font-bold text-sub">판매자 답글</label>
      <textarea id={`review-reply-${review.id}`} value={draft} maxLength={LIMIT} rows={3} disabled={busy}
        onChange={(event) => setDraft(event.target.value)} className="pixel-input w-full p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !draft.trim()} className="btn-lime min-h-9 px-3 text-xs font-bold disabled:opacity-50">{busy ? "저장 중…" : "답글 저장"}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null); }} className="btn-pixel min-h-9 px-3 text-xs">취소</button>
      </div>
    </form> : <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => { setDraft(review.reply ?? ""); setError(null); setEditing(true); }} className="btn-pixel min-h-9 px-3 text-xs font-bold">{review.reply ? "답글 수정" : "답글 쓰기"}</button>
      {review.reply && <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="btn-pixel min-h-9 px-3 text-xs text-pink">답글 삭제</button>}
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-pink">{error}</p>}
    <ConfirmDialog open={confirming} title="답글을 삭제할까요?" description="손님 상품 페이지에서도 답글이 사라져요." confirmLabel={busy ? "삭제 중…" : "삭제"} danger
      onConfirm={() => void save(null)} onClose={() => { if (!busy) setConfirming(false); }} />
  </div>;
}
