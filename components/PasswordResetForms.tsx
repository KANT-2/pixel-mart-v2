"use client"; // 이메일 입력 · 새 비밀번호 저장 폼

import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { passwordApi } from "@/lib/password";

const input = "w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet";

/** 비밀번호 찾기 — 가입 여부와 상관없이 같은 안내 (메일 서버가 없는 로컬에서는 링크를 바로 보여 준다) */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; resetUrl: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await passwordApi.requestReset(email.trim()));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "요청하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const resetPath = result.resetUrl ? new URL(result.resetUrl).pathname + new URL(result.resetUrl).search : null;
    return <div role="status" className="pixel-panel p-5">
      <p className="text-sm leading-relaxed text-sub">{result.message}</p>
      {resetPath && <Link href={resetPath} className="mt-4 flex h-12 items-center justify-center btn-lime text-sm font-bold text-lime-ink">재설정 링크 열기</Link>}
      <Link href="/login" className="mt-4 inline-flex text-sm text-sub underline-offset-4 hover:text-ink hover:underline">로그인으로 돌아가기</Link>
    </div>;
  }
  return <form onSubmit={submit} className="pixel-panel p-5">
    <label htmlFor="reset-email" className="mb-2 block text-sm font-semibold">가입한 이메일</label>
    <input id="reset-email" type="email" required maxLength={320} autoComplete="email" value={email} disabled={busy}
      onChange={(event) => setEmail(event.target.value)} placeholder="player@example.com" className={input} />
    {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
    <button type="submit" disabled={busy || !email.trim()} className="mt-5 w-full btn-lime px-4 py-3 font-bold text-lime-ink disabled:opacity-50">{busy ? "보내는 중…" : "재설정 링크 받기"}</button>
    <p className="mt-4 text-center text-xs text-dim">구글로 가입했다면 비밀번호 없이 Google로 로그인해 주세요.</p>
  </form>;
}

/** 재설정 링크로 들어와 새 비밀번호 저장 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <div role="alert" className="pixel-panel p-5 text-sm text-sub">
    링크가 올바르지 않아요. <Link href="/forgot-password" className="text-mint underline">재설정 링크를 다시 받아 주세요.</Link>
  </div>;
  if (done) return <div role="status" className="pixel-panel p-5">
    <p className="text-sm text-mint">새 비밀번호로 바꿨어요.</p>
    <Link href="/login" className="mt-4 flex h-12 items-center justify-center btn-lime text-sm font-bold text-lime-ink">로그인하기</Link>
  </div>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    if (next.length < 8) { setError("새 비밀번호는 8자 이상이어야 해요."); return; }
    if (next !== again) { setError("새 비밀번호가 서로 달라요."); return; }
    setBusy(true);
    setError(null);
    try {
      await passwordApi.reset(token, next);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4 pixel-panel p-5">
    <div>
      <label htmlFor="reset-next" className="mb-2 block text-sm font-semibold">새 비밀번호 <span className="font-normal text-dim">(8자 이상)</span></label>
      <input id="reset-next" type="password" autoComplete="new-password" value={next} disabled={busy} onChange={(event) => setNext(event.target.value)} className={input} />
    </div>
    <div>
      <label htmlFor="reset-again" className="mb-2 block text-sm font-semibold">새 비밀번호 확인</label>
      <input id="reset-again" type="password" autoComplete="new-password" value={again} disabled={busy} onChange={(event) => setAgain(event.target.value)} className={input} />
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <button type="submit" disabled={busy || !next} className="w-full btn-lime px-4 py-3 font-bold text-lime-ink disabled:opacity-50">{busy ? "저장 중…" : "새 비밀번호 저장"}</button>
  </form>;
}
