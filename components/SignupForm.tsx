"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import EmailSignupForm from "@/components/EmailSignupForm";
import NicknameField, { type NicknameStatus } from "@/components/profile/NicknameField";
import { api, ApiError } from "@/lib/api";
import type { ApiSignupPending, ApiUser } from "@/types/api";

/** 구글 확인 뒤 새 사용자의 닉네임 고르기 — 고른 닉네임이 사용 가능해야 계정이 만들어진다.
 * 구글 가입 대기 정보가 없으면 이메일 가입 폼을 보여 준다. */
export default function SignupForm({ next }: { next?: string }) {
  const { updateUser, refresh } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<ApiSignupPending | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<NicknameStatus>("empty");
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get<ApiSignupPending>("/auth/google/signup", { cache: "no-store", signal: controller.signal })
      .then((data) => { setPending(data); setText(data.googleName); })
      .catch(() => { if (!controller.signal.aborted) setMissing(true); });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nickname = text.trim();
    if (lock.current || busy || status !== "available") return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const user = await api.post<ApiUser>("/auth/google/signup", { nickname });
      updateUser(user);
      await refresh();
      router.replace("/");
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setRejected(nickname);
      else setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "가입하지 못했어요. 다시 시도해 주세요.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (missing) return <EmailSignupForm next={next} />;
  if (!pending) return <div role="status" aria-label="가입 정보 확인 중" className="h-64 animate-pulse rounded-xl bg-panel" />;

  return <form onSubmit={submit} className="pixel-panel space-y-5 p-5">
    <div>
      <p className="font-pixel text-[11px] tracking-widest text-dim">ACCOUNT</p>
      <p className="mt-1 truncate text-sm text-sub">{pending.email}</p>
    </div>
    <div>
      <label htmlFor="signup-nickname" className="mb-2 block text-sm font-semibold">닉네임</label>
      <NicknameField id="signup-nickname" value={text} onChange={(next) => { setText(next); setError(null); }} disabled={busy}
        onStatus={setStatus} rejected={rejected} placeholder="나의 플레이어 이름" />
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <button type="submit" disabled={busy || status !== "available"} className="btn-lime h-12 w-full font-extrabold disabled:opacity-50">
      {busy ? "가입 중…" : "▶ 이 이름으로 시작하기"}
    </button>
    <p className="text-xs text-dim">닉네임은 나중에 마이페이지에서 바꿀 수 있어요.</p>
  </form>;
}
