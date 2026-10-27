"use client"; // 로그인 사용자 배송지를 불러오고 고친다

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import LoginRequiredNotice from "@/components/LoginRequiredNotice";
import ShippingFields from "@/components/orders/ShippingFields";
import { addressesApi } from "@/lib/addresses";
import { ApiError } from "@/lib/api";
import type { ApiAddress } from "@/types/api";
import { type ShippingErrors, type ShippingForm, validateShipping } from "@/utils/shop";

interface Draft { id: number | null; label: string; form: ShippingForm; isDefault: boolean; }
const EMPTY: ShippingForm = { recipientName: "", phone: "", postalCode: "", address: "", addressDetail: "" };
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint";

/** 내 배송지 — 추가·수정·삭제·기본 배송지 지정 (주문서에서 바로 불러 쓴다) */
export default function AddressBook() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<{ userId: number; items: ApiAddress[] } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<ShippingErrors & { label?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    addressesApi.list(controller.signal).then((items) => setRows({ userId, items }))
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "배송지를 불러오지 못했어요."); });
    return () => controller.abort();
  }, [userId]);

  if (loading) return <div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />;
  if (!user) return <LoginRequiredNotice message="로그인하면 배송지를 저장해 둘 수 있어요." next="/mypage/addresses" />;
  const items = rows?.userId === userId ? rows.items : null;
  if (!items) return error ? <p role="alert" className="pixel-panel p-6 text-sm text-pink">{error}</p> : <div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />;

  async function act(action: () => Promise<ApiAddress[] | null>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setRows({ userId: userId as number, items: next ?? await addressesApi.list() });
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const validation = validateShipping(draft.form);
    const label = draft.label.trim();
    const nextErrors = { ...validation.errors, ...(label ? {} : { label: "배송지 이름을 입력해 주세요." }) };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const input = { label, ...validation.values, isDefault: draft.isDefault };
    void act(() => (draft.id === null ? addressesApi.add(input) : addressesApi.update(draft.id, input)));
  }

  const edit = (row: ApiAddress) => {
    setErrors({});
    setDraft({ id: row.id, label: row.label, isDefault: row.isDefault,
      form: { recipientName: row.recipientName, phone: row.phone, postalCode: row.postalCode, address: row.address, addressDetail: row.addressDetail } });
  };

  return <div className="space-y-4">
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    {items.length === 0 && !draft && <div className="pixel-panel px-5 py-12 text-center">
      <p className="text-sm text-sub">저장한 배송지가 없어요. 추가해 두면 주문서에 바로 채워져요.</p>
    </div>}
    <ul className="space-y-3">
      {items.map((row) => <li key={row.id} className="pixel-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold">{row.label}{row.isDefault && <span className="ml-2 rounded border border-mint/40 px-1.5 py-0.5 text-xs text-mint">기본</span>}</p>
            <p className="mt-2 text-sm">{row.recipientName} <span className="text-sub">{row.phone}</span></p>
            <p className="mt-1 break-words text-sm text-sub">[{row.postalCode}] {row.address} {row.addressDetail}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!row.isDefault && <button type="button" disabled={busy}
              onClick={() => void act(() => addressesApi.update(row.id, { label: row.label, recipientName: row.recipientName, phone: row.phone, postalCode: row.postalCode, address: row.address, addressDetail: row.addressDetail, isDefault: true }))}
              className={`rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:text-ink disabled:opacity-50 ${focusClass}`}>기본으로</button>}
            <button type="button" disabled={busy} onClick={() => edit(row)} className={`rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:text-ink disabled:opacity-50 ${focusClass}`}>수정</button>
            <button type="button" disabled={busy} onClick={() => void act(async () => { await addressesApi.remove(row.id); return null; })}
              className={`rounded-lg border border-pink/30 px-3 py-1.5 text-xs text-pink disabled:opacity-50 ${focusClass}`} aria-label={`${row.label} 배송지 삭제`}>삭제</button>
          </div>
        </div>
      </li>)}
    </ul>
    {draft ? <form onSubmit={save} noValidate className="pixel-panel space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{draft.id === null ? "새 배송지" : "배송지 수정"}</h2>
      <div>
        <label htmlFor="address-label" className="mb-2 block text-sm font-semibold">배송지 이름</label>
        <input id="address-label" maxLength={20} value={draft.label} disabled={busy} placeholder="예) 집, 회사"
          onChange={(event) => { setDraft({ ...draft, label: event.target.value }); setErrors((current) => ({ ...current, label: undefined })); }}
          aria-invalid={Boolean(errors.label)} className="w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet" />
        {errors.label && <p className="mt-2 text-sm text-pink">{errors.label}</p>}
      </div>
      <ShippingFields idPrefix="address" value={draft.form} errors={errors} disabled={busy}
        onChange={(form, changed) => { setDraft({ ...draft, form }); setErrors((current) => (changed === "search" ? { ...current, postalCode: undefined, address: undefined } : { ...current, [changed]: undefined })); }} />
      <label className="flex items-center gap-2 text-sm text-sub">
        <input type="checkbox" checked={draft.isDefault} disabled={busy} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} className="size-4 accent-lime" />
        기본 배송지로 지정
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-lime px-5 py-2.5 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "저장 중…" : "저장"}</button>
        <button type="button" disabled={busy} onClick={() => setDraft(null)} className="rounded-lg border border-line px-5 py-2.5 text-sm text-sub">취소</button>
      </div>
    </form> : items.length < 10 && <button type="button" onClick={() => { setErrors({}); setDraft({ id: null, label: items.length ? "" : "집", form: EMPTY, isDefault: items.length === 0 }); }}
      className="w-full btn-pixel py-3 text-sm font-bold">+ 배송지 추가</button>}
  </div>;
}
