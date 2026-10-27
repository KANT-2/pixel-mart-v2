"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyRow from "@/components/admin/EmptyRow";
import AdminPagination from "@/components/admin/Pagination";
import { useAuth } from "@/components/AuthProvider";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { ApiError } from "@/lib/api";
import type { Page } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import {
  ADMIN_USERS_PATH, SEARCH_LIMIT, actionLabel, adminUsersApi, adminUsersHref, confirmText, doneText, emptyMessage, roleOptions, signupLabel, statusOptions, userActions, userState,
  type AdminUserAction, type AdminUserQuery, type ApiAdminUser,
} from "./adminUsers";

const LOAD_ERROR = "회원 목록을 불러오지 못했어요. 다시 시도해 주세요.";
const errorText = (cause: unknown, fallback = LOAD_ERROR) => (cause instanceof ApiError ? cause.message : fallback);
const TONE = { mint: "border-mint/30 bg-mint/10 text-mint", pink: "border-pink/40 bg-pink/10 text-pink", dim: "border-line bg-panel-2 text-dim", lime: "border-lime/40 bg-lime/10 text-lime" };

// 상태 탭 · 역할 칩 · 검색 · 표 · 쪽 이동 — 주소창 쿼리가 바뀌면 page.tsx가 key로 새로 그린다
export default function AdminUsersBoard({ status, role, q, page }: AdminUserQuery) {
  const router = useRouter();
  const { user: me, refresh: refreshAuth } = useAuth();
  const [data, setData] = useState<Page<ApiAdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [pending, setPending] = useState<{ user: ApiAdminUser; action: AdminUserAction } | null>(null); // 확인 창 대상
  const [busy, setBusy] = useState(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminUsersApi.list({ status, role, q, page }, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(errorText(cause)); setLoading(false); } },
    );
    return () => controller.abort();
  }, [status, role, q, page]);

  // 처리 뒤·다시 시도 — 같은 조건으로 다시 받아 온다 (이번 쪽이 비면 앞 쪽으로)
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminUsersApi.list({ status, role, q, page }, signal);
      if (signal.aborted) return;
      if (!next.items.length && page > 1) { router.replace(adminUsersHref({ status, role, q, page: Math.max(1, Math.min(page - 1, next.totalPages || 1)) })); return; }
      setData(next);
    } catch (cause) {
      if (!signal.aborted) setError(errorText(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  // 확인 창에서 [정지하기]/[정지 해제]/[초기화하기] → 서버 처리 → 목록 다시 받기
  async function run() {
    if (!pending || busy) return;
    const { user, action } = pending;
    setBusy(true); setNotice(null); setError(null);
    try {
      if (action === "avatar") await adminUsersApi.resetAvatar(user.id);
      else await adminUsersApi.setSuspended(user.id, action === "suspend");
      setPending(null);
      setNotice(doneText(user, action));
      void reload();
    } catch (cause) {
      setPending(null);
      setError(errorText(cause, "처리하지 못했어요. 다시 시도해 주세요."));
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
      else if (cause instanceof ApiError && (cause.status === 400 || cause.status === 404)) void reload(); // 그 사이 탈퇴했거나 관리자가 된 계정
    } finally {
      setBusy(false);
    }
  }

  const go = (next: Partial<AdminUserQuery>) => router.push(adminUsersHref({ status, role, q, ...next, page: 1 }), { scroll: false });
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: search });
  }

  const dialog = pending ? confirmText(pending.user, pending.action) : null;
  const columns: AdminTableColumn<ApiAdminUser>[] = [
    {
      header: "회원",
      className: "min-w-[14rem]",
      render: (user) => <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded border border-line bg-night">
          {user.avatarUrl ? <PixelAvatar src={user.avatarUrl} alt="" className="size-10" /> : <span className="text-[10px] text-dim">기본</span>}
        </span>
        <div className="min-w-0 text-xs">
          <p className="break-words text-sm font-bold text-ink">{user.nickname}{me?.id === user.id && <span className="ml-1.5 text-xs font-normal text-dim">(나)</span>}</p>
          <p className="break-all text-dim">{user.email}</p>
        </div>
      </div>,
    },
    { header: "가입", render: (user) => <div className="whitespace-nowrap text-xs"><p className="text-sub">{signupLabel(user.signupMethod)}</p><time dateTime={user.createdAt} className="text-dim">{formatDate(user.createdAt).slice(0, 10)}</time></div> },
    { header: "주문", align: "right", render: (user) => <span className="text-sm">{user.orderCount}</span> },
    { header: "신고", align: "right", render: (user) => <span className={`text-sm ${user.reportCount > 0 ? "font-bold text-pink" : "text-dim"}`}>{user.reportCount}</span> },
    {
      header: "상태",
      render: (user) => {
        const state = userState(user);
        return <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${TONE[state.tone]}`}>{state.label}</span>;
      },
    },
    {
      header: "동작",
      render: (user) => {
        const actions = userActions(user, me?.id);
        if (!actions.length) return <span className="text-xs text-dim">—</span>;
        return <div className="flex flex-wrap gap-1.5">
          {actions.map((action) => <button key={action} type="button" disabled={busy} onClick={() => { setNotice(null); setPending({ user, action }); }}
            className={`btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold disabled:opacity-50 ${action === "suspend" ? "text-pink" : ""}`}>
            {actionLabel[action]}
          </button>)}
        </div>;
      },
    },
  ];

  return <div className="space-y-5">
    <header>
      <h1 className="text-xl font-bold text-ink">사용자 관리</h1>
      <p className="mt-1 text-sm text-sub">회원을 찾아 정지하거나 아바타를 기본 모습으로 바꿔요. 관리자 · 탈퇴 계정과 나 자신은 정지할 수 없어요.</p>
    </header>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="회원 상태" className="segmented h-11 self-start">
        {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => { if (option.value !== status) go({ status: option.value }); }} className="text-sm font-bold">{option.label}</button>)}
      </div>
      <form role="search" onSubmit={submitSearch} className="flex min-w-0 gap-2 lg:w-96">
        <label htmlFor="admin-user-search" className="sr-only">닉네임 · 이메일 검색</label>
        <input id="admin-user-search" type="search" value={search} maxLength={SEARCH_LIMIT} onChange={(event) => setSearch(event.target.value)} placeholder="닉네임 · 이메일" className="min-h-11 min-w-0 flex-1 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
        <button type="submit" className="min-h-11 btn-pixel shrink-0 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mint">검색</button>
      </form>
    </div>
    <div role="group" aria-label="회원 역할" className="flex gap-2 overflow-x-auto pb-1">
      <RoleChip active={role === null} label="역할 전체" onClick={() => go({ role: null })} />
      {roleOptions.map((option) => <RoleChip key={option.value} active={role === option.value} label={option.label} onClick={() => go({ role: option.value })} />)}
    </div>
    {q && <p className="text-sm text-sub">
      <span className="font-bold text-ink">{q}</span> 검색 결과{data ? ` ${data.total}명` : ""} · <button type="button" onClick={() => go({ q: "" })} className="min-h-11 underline underline-offset-4 hover:text-ink">검색 지우기</button>
    </p>}

    {notice && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</p>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading} onClick={() => void reload()} className="btn-pixel min-h-11 shrink-0 px-4 text-sm font-bold">다시 시도</button>
    </div>}

    {loading && !data && !error ? <div aria-label="회원 목록 불러오는 중" className="h-64 animate-pulse rounded-xl bg-panel" />
      : data && <>
        <p className="text-xs text-dim">총 {data.total}명 · {data.page} / {data.totalPages} 페이지</p>
        <div aria-busy={loading}>
          <AdminTable columns={columns} rows={data.items} rowKey={(user) => user.id} mobileCards
            empty={<EmptyRow colSpan={columns.length} message={emptyMessage({ status, role, q })} action={status !== "all" || role || q ? { label: "필터 초기화", onClick: () => router.push(ADMIN_USERS_PATH) } : undefined} />} />
        </div>
        <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={ADMIN_USERS_PATH}
          query={{ status: status === "all" ? undefined : status, role: role ?? undefined, q: q || undefined }} />
      </>}

    <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description}
      confirmLabel={busy ? "처리 중…" : dialog?.confirm} danger={dialog?.danger}
      onConfirm={() => void run()} onClose={() => { if (!busy) setPending(null); }} />
  </div>;
}

function RoleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold ${active ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"}`}>
    {label}
  </button>;
}
