"use client"; // 이메일 가입 계정만 — 지금 비밀번호 확인 후 새 비밀번호 저장

import { useId, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { passwordApi } from "@/lib/password";

const input = "w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet";

/** 마이페이지 '비밀번호 변경' — 구글 가입자는 비밀번호가 없어 보이지 않는다 */
export default function PasswordSection() {
  const { user, loading } = useAuth();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (loading || !user?.hasPassword) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (next.length < 8) { setMessage({ ok: false, text: "새 비밀번호는 8자 이상이어야 해요." }); return; }
    if (next !== again) { setMessage({ ok: false, text: "새 비밀번호가 서로 달라요." }); return; }
    setBusy(true);
    setMessage(null);
    try {
      const result = await passwordApi.change(current, next);
      setMessage({ ok: true, text: result.message });
      setCurrent(""); setNext(""); setAgain("");
      setOpen(false);
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof ApiError ? cause.message : "바꾸지 못했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  return <section aria-labelledby={`${id}-title`} className="mb-6 pixel-panel p-5 text-left">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id={`${id}-title`} className="font-bold">비밀번호</h2>
        <p className="mt-1 text-sm text-sub">이메일로 가입한 계정의 비밀번호를 바꿔요.</p>
      </div>
      {!open && <button type="button" onClick={() => { setOpen(true); setMessage(null); }} className="btn-pixel px-4 py-2 text-sm font-bold">비밀번호 변경</button>}
    </div>
    {message && <p role={message.ok ? "status" : "alert"} className={`mt-3 text-sm ${message.ok ? "text-mint" : "text-pink"}`}>{message.text}</p>}
    {open && <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label htmlFor={`${id}-current`} className="mb-1.5 block text-sm font-semibold">지금 비밀번호</label>
        <input id={`${id}-current`} type="password" autoComplete="current-password" value={current} disabled={busy} onChange={(event) => setCurrent(event.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor={`${id}-next`} className="mb-1.5 block text-sm font-semibold">새 비밀번호 <span className="font-normal text-dim">(8자 이상)</span></label>
        <input id={`${id}-next`} type="password" autoComplete="new-password" value={next} disabled={busy} onChange={(event) => setNext(event.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor={`${id}-again`} className="mb-1.5 block text-sm font-semibold">새 비밀번호 확인</label>
        <input id={`${id}-again`} type="password" autoComplete="new-password" value={again} disabled={busy} onChange={(event) => setAgain(event.target.value)} className={input} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !current || !next} className="btn-lime px-5 py-2.5 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "바꾸는 중…" : "바꾸기"}</button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-line px-5 py-2.5 text-sm text-sub">취소</button>
      </div>
    </form>}
  </section>;
}
