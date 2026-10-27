"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { ApiError } from "@/lib/api";
import { MAX_GRANT, MEMO_LIMIT, addRecipient, adminBadgesApi, grantResultText, type ApiAdminBadge, type BadgeGrantCandidate } from "./adminBadges";

interface BadgeGrantProps {
  badge: ApiAdminBadge;
  onGranted: (message: string) => void;
  onCancel: () => void;
}

// 이벤트 뱃지 주기 — 닉네임·이메일로 찾아 [추가] → 받을 사람(최대 50명) + 메모 → 확인 창 → 주기
export default function BadgeGrant({ badge, onGranted, onCancel }: BadgeGrantProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BadgeGrantCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<BadgeGrantCandidate[]>([]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    searchInput.current?.focus();
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    const signal = lifetime.current?.signal;
    if (!q || !signal) return;
    setSearching(true); setError(null);
    try {
      const page = await adminBadgesApi.searchUsers(q, signal);
      if (!signal.aborted) setResults(page.items);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof ApiError ? cause.message : "회원을 찾지 못했어요. 다시 시도해 주세요.");
    } finally {
      if (!signal.aborted) setSearching(false);
    }
  }

  function add(user: BadgeGrantCandidate) {
    const next = addRecipient(picked, user);
    setPicked(next.list);
    setError(next.error);
  }

  async function grant() {
    setConfirming(false);
    if (busy || !picked.length) return;
    setBusy(true); setError(null);
    try {
      const result = await adminBadgesApi.grant(badge.code, picked.map((user) => user.id), memo);
      onGranted(grantResultText(badge.name, result));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "뱃지를 주지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return <section aria-labelledby={`${id}-title`} className="pixel-panel space-y-4 p-5">
    <h2 id={`${id}-title`} className="text-base font-bold text-ink">&apos;{badge.name}&apos; 뱃지 주기</h2>

    <form role="search" onSubmit={search} className="flex min-w-0 gap-2">
      <label htmlFor={`${id}-q`} className="sr-only">받을 사람 찾기 (닉네임 · 이메일)</label>
      <input ref={searchInput} id={`${id}-q`} type="search" value={query} maxLength={100} disabled={busy} onChange={(event) => setQuery(event.target.value)}
        placeholder="받을 사람 찾기 (닉네임 · 이메일)" className="min-h-11 min-w-0 flex-1 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
      <button type="submit" disabled={busy || searching} className="min-h-11 btn-pixel shrink-0 px-4 text-sm font-bold disabled:opacity-50">{searching ? "찾는 중…" : "찾기"}</button>
    </form>

    {results && (results.length ? <ul aria-label="찾은 회원" className="max-h-60 divide-y divide-line/60 overflow-y-auto rounded border border-line">
      {results.map((user) => {
        const added = picked.some((item) => item.id === user.id);
        return <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="block break-words font-bold text-ink">{user.nickname}</span>
            <span className="block break-all text-xs text-dim">{user.email}</span>
          </span>
          <button type="button" disabled={busy || added || user.withdrawn} onClick={() => add(user)} className="min-h-9 btn-pixel shrink-0 px-3 text-xs font-bold disabled:opacity-50">
            {user.withdrawn ? "탈퇴" : added ? "추가됨" : "추가"}
          </button>
        </li>;
      })}
    </ul> : <p className="text-sm text-dim">찾은 회원이 없어요.</p>)}

    <div>
      <p className="mb-2 text-sm font-semibold">받을 사람 <span className="font-normal text-dim">{picked.length} / {MAX_GRANT}명</span></p>
      {picked.length ? <ul aria-label="받을 사람" className="flex flex-wrap gap-2">
        {picked.map((user) => <li key={user.id} className="flex items-center gap-1 rounded-full border border-lime/40 bg-panel-2 py-1 pl-3 pr-1 text-xs">
          {user.nickname}
          <button type="button" disabled={busy} onClick={() => setPicked((list) => list.filter((item) => item.id !== user.id))} aria-label={`${user.nickname} 빼기`}
            className="grid size-7 place-items-center rounded-full text-dim hover:text-pink">✕</button>
        </li>)}
      </ul> : <p className="text-sm text-dim">위에서 찾아 [추가]해 주세요.</p>}
    </div>

    <div>
      <label htmlFor={`${id}-memo`} className="mb-1 block text-sm font-semibold">메모 <span className="font-normal text-dim">(선택 · 받는 사람 도감과 받은 사람 목록에 보여요)</span></label>
      <textarea id={`${id}-memo`} value={memo} rows={2} maxLength={MEMO_LIMIT} disabled={busy} onChange={(event) => setMemo(event.target.value)}
        placeholder="예: 할로윈 이벤트 참여 감사해요!" className="w-full min-w-0 resize-y pixel-input p-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
      <p className="mt-1 text-right text-xs text-dim">{Array.from(memo).length} / {MEMO_LIMIT}자</p>
    </div>

    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !picked.length} onClick={() => setConfirming(true)} className="min-h-11 btn-lime px-5 text-sm font-bold text-lime-ink disabled:opacity-50">
        {busy ? "주는 중…" : `${picked.length}명에게 주기`}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 btn-pixel px-4 text-sm font-bold text-sub disabled:opacity-50">닫기</button>
    </div>

    <ConfirmDialog open={confirming} title={`'${badge.name}' 뱃지를 ${picked.length}명에게 줄까요?`}
      description="받는 사람에게 알림이 가요. 이미 가진 사람은 건너뛰어요." confirmLabel="주기"
      onConfirm={() => void grant()} onClose={() => setConfirming(false)} />
  </section>;
}
