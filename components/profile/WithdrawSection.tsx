"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { reportsApi, WITHDRAW_WORD, withdrawConfirmed } from "@/lib/reports";

/** 마이페이지 맨 아래 '회원 탈퇴' (#107) — 주의 문구 + '탈퇴' 직접 입력 → 로그아웃 상태로 홈 */
export default function WithdrawSection() {
  const { user, loading, refresh: refreshAuth } = useAuth();
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const ready = withdrawConfirmed(text);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (loading || !user) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try {
      await reportsApi.withdraw();
      await refreshAuth(); // 서버가 쿠키를 지웠으니 로그아웃 상태로 바뀐다
      router.replace("/");
    } catch (cause) {
      // 진행 중인 주문이 있거나 관리자 계정이면 서버가 400과 이유를 알려 준다
      setError(cause instanceof ApiError ? cause.message : "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return <section aria-labelledby={`${id}-title`} className="mt-10 border-t border-line pt-8 text-left">
    <h2 id={`${id}-title`} className="text-sm font-bold text-sub">회원 탈퇴</h2>
    {!open ? <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-11 btn-pixel border-pink/50 px-4 text-sm font-bold text-pink">회원 탈퇴</button>
      : <form onSubmit={submit} noValidate className="mt-3 rounded-lg border border-pink/40 bg-panel p-5">
        <p className="text-sm font-bold text-pink">탈퇴하면 되돌릴 수 없어요.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-sub marker:text-dim">
          <li>바로 로그아웃되고, 이 계정으로는 다시 로그인할 수 없어요. (같은 이메일로 새로 가입은 할 수 있어요)</li>
          <li>장바구니 · 찜 · 알림 · 취향 · 활동 점수 · 뱃지가 지워지고, 내 거래글은 숨겨져요.</li>
          <li>남긴 리뷰 · 문의는 &apos;탈퇴한 모험가&apos;로 표시돼요.</li>
          <li>배송이 끝나지 않은 주문이 있으면 탈퇴할 수 없어요.</li>
        </ul>
        <label htmlFor={`${id}-confirm`} className="mb-2 mt-4 block text-sm">확인을 위해 <strong className="text-pink">{WITHDRAW_WORD}</strong>를 입력해 주세요</label>
        <input ref={input} id={`${id}-confirm`} value={text} onChange={(event) => { setText(event.target.value); setError(null); }} disabled={busy}
          autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-full min-w-0 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
        {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-pink">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={!ready || busy} className="min-h-11 btn-pixel border-pink px-4 text-sm font-bold text-pink disabled:opacity-40">{busy ? "처리 중…" : "탈퇴하기"}</button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setText(""); setError(null); }} className="min-h-11 btn-pixel px-4 text-sm font-bold text-sub">취소</button>
        </div>
      </form>}
  </section>;
}
