"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useAuth } from "@/components/AuthProvider";
import PixelIcon from "@/components/PixelIcon";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/utils/formatDate";
import { ANSWER_LIMIT, adminQuestionsApi, remainingAnswerChars, validateAnswer, type ApiAdminQuestion } from "./adminQuestions";

interface AdminQuestionCardProps {
  question: ApiAdminQuestion;
  open: boolean; // 이 카드의 답변 입력창이 열려 있는지 (한 번에 하나만)
  onOpen: () => void;
  onClose: () => void;
  onAnswered: () => void; // 등록 성공 → 목록 다시 받기
  onStale: () => void; // 이미 답변됐거나 지워진 문의 → 목록 다시 받기
}

// 문의 한 개 — 내용 · 상품 · 작성자, 답변 대기면 [답변하기]로 아래에 입력창을 펼친다
export default function AdminQuestionCard({ question, open, onOpen, onClose, onAnswered, onStale }: AdminQuestionCardProps) {
  const { refresh: refreshAuth } = useAuth();
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);
  const remaining = remainingAnswerChars(text);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (open) textarea.current?.focus(); }, [open]);

  // [답변 등록] → 검사 통과하면 확인창부터 (등록하면 수정할 수 없어서)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const { error: message } = validateAnswer(text);
    setError(message);
    if (!message) setConfirming(true);
  }

  async function confirm() {
    setConfirming(false);
    const { value, error: message } = validateAnswer(text);
    if (message || busy) return;
    setBusy(true); setError(null);
    try {
      await adminQuestionsApi.answer(question.id, value);
      if (!alive.current) return;
      setText(""); onAnswered();
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof ApiError ? cause.message : "답변을 저장하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
      else if (cause instanceof ApiError && (cause.status === 404 || cause.status === 409)) onStale();
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return <li className="min-w-0 pixel-panel p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-1 ${question.answered ? "border-mint/30 text-mint" : "border-line text-dim"}`}>{question.answered ? "답변 완료" : "답변 대기"}</span>
        <Link href={`/products/${question.productId}#qna`} className="min-w-0 break-words font-bold text-sub underline-offset-4 hover:text-ink hover:underline">{question.productName}</Link>
      </div>
      {question.createdAt && <time dateTime={question.createdAt} className="text-dim">{formatDate(question.createdAt)}</time>}
    </div>

    <h2 className="mt-3 flex min-w-0 items-center gap-2 font-bold text-ink">
      {question.isSecret && <PixelIcon name="lock" />}<span className="min-w-0 break-words">{question.title}</span>
    </h2>
    <p className="mt-1 break-words text-xs text-dim">작성자 {question.authorNickname}{question.isSecret && " · 비밀글"}</p>
    <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-sub">{question.content}</p>

    {question.answer !== null && <div className="mt-4 border-l-2 border-mint bg-panel-2 p-4">
      <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-mint">
        <span>답변</span>{question.answeredAt && <time dateTime={question.answeredAt} className="font-normal text-dim">{formatDate(question.answeredAt)}</time>}
      </p>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-sub">{question.answer}</p>
    </div>}

    {!question.answered && !open && <button type="button" onClick={onOpen} aria-expanded={false} aria-controls={`${id}-form`} className="mt-4 min-h-11 btn-pixel px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mint">답변하기</button>}

    {!question.answered && open && <form id={`${id}-form`} onSubmit={submit} noValidate className="mt-4 rounded-lg border border-line bg-panel-2 p-4">
      <label htmlFor={`${id}-answer`} className="mb-2 block text-sm font-semibold">답변 내용</label>
      <textarea ref={textarea} id={`${id}-answer`} value={text} rows={4} maxLength={ANSWER_LIMIT} disabled={busy}
        onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); } }}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
        className="w-full min-w-0 resize-y pixel-input p-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
      <p id={`${id}-count`} aria-live="polite" className={`mt-1 text-right text-xs ${remaining <= 20 ? "text-pink" : "text-dim"}`}>남은 글자 {remaining}자</p>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-pink">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="min-h-11 btn-lime px-5 text-sm font-bold text-lime-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">{busy ? "등록 중…" : "답변 등록"}</button>
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 btn-pixel px-4 text-sm font-bold text-sub disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-mint">취소</button>
      </div>
    </form>}

    <ConfirmDialog open={confirming} title="답변을 등록할까요?" description="등록하면 수정할 수 없어요. 손님에게 답변 알림이 가요."
      confirmLabel="등록하기" onConfirm={() => void confirm()} onClose={() => setConfirming(false)} />
  </li>;
}
