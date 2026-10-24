"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import NicknameField, { type NicknameStatus } from "@/components/profile/NicknameField";
import { ApiError } from "@/lib/api";
import { safeNextPath } from "@/utils/safeNextPath";

/** 이메일 가입 — 가입하면 바로 로그인해서 원래 가려던 곳으로 */
export default function EmailSignupForm({ next }: { next?: string }) {
  const { user, loading, signup } = useAuth();
  const router = useRouter();
  const destination = safeNextPath(next);
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState<NicknameStatus>("empty");
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => { if (!loading && user && !busy) router.replace(destination); }, [user, loading, busy, destination, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || status !== "available") return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("password-confirm") ?? "")) { setError("비밀번호 확인이 맞지 않아요."); return; }
    lock.current = true; setBusy(true); setError(null);
    try {
      await signup(String(data.get("email") ?? "").trim(), password, nickname.trim());
      router.replace(destination);
    } catch (cause) {
      // 닉네임이 그사이 겹치면 추천 칩으로, 이메일 중복·비밀번호 규칙은 서버 문구 그대로
      if (cause instanceof ApiError && cause.status === 409 && cause.message.includes("닉네임")) setRejected(nickname.trim());
      else setError(cause instanceof ApiError ? cause.message : "가입하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (loading) return <div role="status" aria-label="로그인 상태 확인 중" className="h-96 animate-pulse rounded-xl bg-panel" />;

  return <form onSubmit={submit} className="pixel-panel space-y-4 p-5">
    <div>
      <label htmlFor="signup-email" className="mb-2 block text-sm font-semibold">이메일</label>
      <input id="signup-email" name="email" type="email" required maxLength={320} autoComplete="email" disabled={busy}
        className="w-full pixel-input px-3 py-3 text-ink" placeholder="player@example.com" />
    </div>
    <div>
      <label htmlFor="signup-password" className="mb-2 block text-sm font-semibold">비밀번호 <span className="font-normal text-dim">(8자 이상)</span></label>
      <input id="signup-password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy}
        className="w-full pixel-input px-3 py-3 text-ink" />
    </div>
    <div>
      <label htmlFor="signup-password-confirm" className="mb-2 block text-sm font-semibold">비밀번호 확인</label>
      <input id="signup-password-confirm" name="password-confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy}
        className="w-full pixel-input px-3 py-3 text-ink" />
    </div>
    <div>
      <label htmlFor="signup-nickname" className="mb-2 block text-sm font-semibold">닉네임</label>
      <NicknameField id="signup-nickname" value={nickname} onChange={(value) => { setNickname(value); setError(null); }} disabled={busy}
        onStatus={setStatus} rejected={rejected} placeholder="나의 플레이어 이름" />
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <button type="submit" disabled={busy || status !== "available"} className="btn-lime h-12 w-full font-extrabold disabled:opacity-50">
      {busy ? "가입 중…" : "▶ 가입하고 시작하기"}
    </button>
    <p className="text-center text-sm text-sub">이미 계정이 있나요? <Link href={next ? `/login?next=${encodeURIComponent(destination)}` : "/login"} className="font-semibold text-mint underline">로그인</Link></p>
  </form>;
}
