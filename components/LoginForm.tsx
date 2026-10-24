"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, api } from "@/lib/api";
import NicknameField from "@/components/profile/NicknameField";
import { safeNextPath } from "@/utils/safeNextPath";

interface LoginFormProps { next?: string; devLoginEnabled: boolean; }

export default function LoginForm({ next, devLoginEnabled }: LoginFormProps) {
  const { user, loading, pending, error: authError, notice, login, passwordLogin, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [rejected, setRejected] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const router = useRouter();
  const destination = safeNextPath(next);
  useEffect(() => { if (!loading && user) router.replace(destination); }, [user, loading, destination, router]);
  // 구글 키가 설정된 서버에서만 버튼을 켠다 (키 없는 PC·백엔드 꺼짐은 계속 "준비 중")
  useEffect(() => {
    api.get<{ google: boolean }>("/auth/providers").then((p) => setGoogleEnabled(p.google)).catch(() => setGoogleEnabled(false));
  }, []);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setError(null);
    try { await passwordLogin(String(data.get("email") ?? "").trim(), String(data.get("password") ?? "")); }
    catch (cause) {
      // 없는 이메일·틀린 비밀번호 모두 서버가 같은 문구("이메일 또는 비밀번호가 맞지 않아요.")를 보낸다
      setError(cause instanceof ApiError ? cause.message : "로그인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  async function submitDev(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setDevError(null);
    const name = nickname.trim();
    try { await login(String(data.get("dev-email") ?? "").trim(), name || undefined); }
    catch (cause) {
      // 새 계정인데 닉네임이 겹치면 가입되지 않는다 — 추천 닉네임 칩으로 다시 고르기
      if (cause instanceof ApiError && cause.status === 409) { setRejected(name); return; }
      setDevError(cause instanceof ApiError ? cause.message : "로그인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  if (loading || user) return <div role="status" aria-label={user ? "원래 페이지로 이동 중" : "로그인 상태 확인 중"} className="h-80 animate-pulse rounded-xl bg-panel" />;

  const signupHref = next ? `/signup?next=${encodeURIComponent(destination)}` : "/signup";

  return <div className="space-y-6">
    {notice && <p role="alert" className="pixel-panel border-pink/60 p-4 text-sm font-semibold text-pink">{notice}</p>}
    {authError && <div role="status" className="pixel-panel p-4 text-sm text-sub">{authError}
      <button type="button" onClick={() => void refresh()} className="ml-2 underline">다시 확인</button>
    </div>}
    <form onSubmit={submitPassword} className="pixel-panel p-5">
      <label htmlFor="email" className="mb-2 block text-sm font-semibold">이메일</label>
      <input id="email" name="email" type="email" required maxLength={320} autoComplete="email" disabled={pending}
        className="mb-4 w-full pixel-input px-3 py-3 text-ink" placeholder="player@example.com" />
      <label htmlFor="password" className="mb-2 block text-sm font-semibold">비밀번호</label>
      <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" disabled={pending}
        className="mb-5 w-full pixel-input px-3 py-3 text-ink" placeholder="8자 이상" />
      {error && <p role="alert" className="mb-4 text-sm text-pink">{error}</p>}
      <button type="submit" disabled={pending} className="w-full btn-lime px-4 py-3 font-bold text-lime-ink disabled:opacity-50">{pending ? "로그인 중…" : "로그인"}</button>
      <p className="mt-4 text-center text-sm text-sub">처음 왔나요? <Link href={signupHref} className="font-semibold text-mint underline">이메일로 가입하기</Link></p>
    </form>
    <div>
      {googleEnabled ? <a href="/api/auth/google/login" className="flex h-12 w-full items-center justify-center btn-pixel font-semibold">Google로 계속하기</a> : <>
        <button type="button" disabled aria-disabled="true" className="h-12 w-full cursor-not-allowed btn-pixel font-semibold text-dim">Google로 계속하기</button>
        <p className="mt-2 text-center text-sm text-dim">Google 로그인은 준비 중이에요.</p>
      </>}
    </div>
    {devLoginEnabled && <details className="pixel-panel p-5">
      <summary className="cursor-pointer text-sm font-bold">개발용 이메일 로그인 (비밀번호 없이)</summary>
      <form onSubmit={submitDev} className="mt-4">
        <p className="mb-5 text-xs text-sub">로컬 개발 환경에서 사용하는 임시 로그인입니다.</p>
        <label htmlFor="dev-email" className="mb-2 block text-sm font-semibold">이메일</label>
        <input id="dev-email" name="dev-email" type="email" required maxLength={320} autoComplete="email" disabled={pending}
          className="mb-4 w-full pixel-input px-3 py-3 text-ink" placeholder="player@example.com" />
        <label htmlFor="nickname" className="mb-2 block text-sm font-semibold">닉네임 <span className="font-normal text-dim">(처음 가입할 때만 · 비우면 이메일 앞부분)</span></label>
        <div className="mb-5">
          <NicknameField id="nickname" value={nickname} onChange={(value) => { setNickname(value); setDevError(null); }} disabled={pending} rejected={rejected} placeholder="나의 플레이어 이름" />
        </div>
        {devError && <p role="alert" className="mb-4 text-sm text-pink">{devError}</p>}
        <button type="submit" disabled={pending} className="w-full btn-pixel px-4 py-3 font-bold disabled:opacity-50">{pending ? "로그인 중…" : "개발용으로 로그인"}</button>
      </form>
    </details>}
  </div>;
}
