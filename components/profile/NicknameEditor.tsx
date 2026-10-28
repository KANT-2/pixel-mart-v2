"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import NicknameField, { type NicknameStatus } from "@/components/profile/NicknameField";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

/** 마이페이지 요약 카드의 닉네임 — 이름 옆에서 바로 바꾼다. 닉네임은 하나뿐이라 입력하는 동안 사용 가능 여부와 추천안을 보여 준다 */
export default function NicknameEditor() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<NicknameStatus>("empty");
  const [rejected, setRejected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);

  if (!user) return null;
  const canSave = !busy && (status === "available" || status === "error");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !canSave) return;
    const nickname = text.trim();
    lock.current = true; setBusy(true); setError(null);
    try {
      updateUser(await api.patch<ApiUser>("/users/me", { nickname }));
      setEditing(false); setSaved(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) setRejected(nickname);
      else setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "저장하지 못했어요.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (!editing) return <div>
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 truncate text-xl font-extrabold">{user.nickname}</p>
      <button type="button" onClick={() => { setText(user.nickname); setRejected(null); setError(null); setSaved(false); setEditing(true); }} className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-sub underline-offset-2 hover:text-mint hover:underline focus-visible:outline-2 focus-visible:outline-mint">이름 바꾸기</button>
    </div>
    {saved && <p role="status" className="text-xs text-mint">닉네임을 바꿨어요.</p>}
  </div>;

  return <form onSubmit={save} aria-label="닉네임 바꾸기" className="mt-1">
    <label htmlFor="nickname-edit" className="sr-only">새 닉네임</label>
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <NicknameField id="nickname-edit" value={text} onChange={(next) => { setText(next); setError(null); }} current={user.nickname} disabled={busy} onStatus={setStatus} rejected={rejected} />
      </div>
      <button type="submit" disabled={!canSave} className="btn-lime h-11 shrink-0 px-4 text-sm font-bold disabled:opacity-50">{busy ? "저장 중…" : "저장"}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)} className="btn-pixel h-11 shrink-0 px-3 text-sm font-bold">취소</button>
    </div>
    {error && <p role="alert" className="mt-1 text-sm text-pink">{error}</p>}
    <p className="mt-2 text-xs leading-relaxed text-dim">닉네임은 다른 플레이어와 겹칠 수 없어요. 거래·위시 글에는 &lsquo;닉네임 공개&rsquo;를 켰을 때만 보여요.</p>
  </form>;
}
