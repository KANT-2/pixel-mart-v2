"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { ApiError } from "@/lib/api";
import { DESCRIPTION_LIMIT, NAME_LIMIT, adminBadgesApi, badgeChanges, imageName, validateBadgeInput, type ApiAdminBadge, type EventBadgeInput } from "./adminBadges";

interface BadgeFormProps {
  badge?: ApiAdminBadge; // 있으면 고치기, 없으면 만들기
  images: string[];
  onSaved: (badge: ApiAdminBadge, created: boolean) => void;
  onCancel: () => void;
}

// 이벤트 뱃지 만들기 · 고치기 — 이름 · 설명 · 그림(서버 목록에서) · 사용 여부
export default function BadgeForm({ badge, images, onSaved, onCancel }: BadgeFormProps) {
  const id = useId();
  const before: EventBadgeInput = { name: badge?.name ?? "", description: badge?.description ?? "", image: badge?.image ?? "", isActive: badge?.isActive ?? true };
  const [input, setInput] = useState<EventBadgeInput>(before);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => { nameInput.current?.focus(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const message = validateBadgeInput(input, images);
    if (message) { setError(message); return; }
    setBusy(true); setError(null);
    try {
      if (badge) {
        const changes = badgeChanges(before, input);
        if (!changes) { onCancel(); return; }
        onSaved(await adminBadgesApi.update(badge.code, changes), false);
      } else {
        onSaved(await adminBadgesApi.create({ ...input, name: input.name.trim(), description: input.description.trim() }), true);
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "저장하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  const set = (patch: Partial<EventBadgeInput>) => { setInput((current) => ({ ...current, ...patch })); setError(null); };

  return <form onSubmit={submit} noValidate aria-labelledby={`${id}-title`} className="pixel-panel space-y-4 p-5">
    <h2 id={`${id}-title`} className="text-base font-bold text-ink">{badge ? `'${badge.name}' 뱃지 고치기` : "이벤트 뱃지 만들기"}</h2>
    <fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-semibold">이름</label>
          <input ref={nameInput} id={`${id}-name`} value={input.name} maxLength={NAME_LIMIT} onChange={(event) => set({ name: event.target.value })}
            className="min-h-11 w-full min-w-0 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
          <p className="mt-1 text-right text-xs text-dim">{Array.from(input.name).length} / {NAME_LIMIT}자</p>
        </div>
        <div>
          <label htmlFor={`${id}-desc`} className="mb-1 block text-sm font-semibold">설명</label>
          <input id={`${id}-desc`} value={input.description} maxLength={DESCRIPTION_LIMIT} onChange={(event) => set({ description: event.target.value })}
            placeholder="예: 10월 할로윈 이벤트 참여" className="min-h-11 w-full min-w-0 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
          <p className="mt-1 text-right text-xs text-dim">{Array.from(input.description).length} / {DESCRIPTION_LIMIT}자</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">그림</legend>
        {images.length ? <div role="radiogroup" aria-label="뱃지 그림" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {images.map((image) => <label key={image} title={imageName(image)}
            className={`grid cursor-pointer place-items-center rounded border-2 p-1.5 ${input.image === image ? "border-lime bg-panel-2" : "border-line hover:border-violet"}`}>
            <input type="radio" name={`${id}-image`} value={image} checked={input.image === image} onChange={() => set({ image })} className="sr-only" />
            <PixelAvatar src={image} alt={imageName(image)} className="size-8" />
          </label>)}
        </div> : <p className="text-sm text-dim">고를 수 있는 그림을 불러오지 못했어요.</p>}
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={input.isActive} onChange={(event) => set({ isActive: event.target.checked })} className="size-4 accent-mint" />
        사용 중 <span className="text-xs text-dim">(끄면 새로 줄 수는 없고, 이미 받은 사람 도감에는 남아요)</span>
      </label>
    </fieldset>

    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={busy} className="min-h-11 btn-lime px-5 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "저장 중…" : badge ? "저장" : "만들기"}</button>
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 btn-pixel px-4 text-sm font-bold text-sub disabled:opacity-50">취소</button>
    </div>
  </form>;
}
