"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EmptyRow from "@/components/admin/EmptyRow";
import AdminPagination from "@/components/admin/Pagination";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import type { Page } from "@/types/api";
import { formatDate } from "@/utils/formatDate";
import TradeDetailDialog from "./TradeDetailDialog";
import {
  ADMIN_TRADES_PATH, SEARCH_LIMIT, adminTradesApi, adminTradesHref, confirmText, contentPreview, doneText, emptyMessage, kindLabel, kindOptions, statusOptions, tradeAction, tradeState,
  type AdminTradeQuery, type AdminTradeTarget, type ApiAdminTrade,
} from "./adminTrades";

const LOAD_ERROR = "거래글 목록을 불러오지 못했어요. 다시 시도해 주세요.";
const errorText = (cause: unknown, fallback = LOAD_ERROR) => (cause instanceof ApiError ? cause.message : fallback);
const TONE = { mint: "border-mint/30 bg-mint/10 text-mint", pink: "border-pink/40 bg-pink/10 text-pink", dim: "border-line bg-panel-2 text-dim" };

// 상태 탭 · 종류 칩 · 검색 · 표 · 쪽 이동 — 주소창 쿼리가 바뀌면 page.tsx가 key로 새로 그린다
export default function AdminTradesBoard({ status, kind, q, page }: AdminTradeQuery) {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [data, setData] = useState<Page<ApiAdminTrade> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [pending, setPending] = useState<{ post: ApiAdminTrade; target: AdminTradeTarget } | null>(null); // 확인 창 대상
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ApiAdminTrade | null>(null); // 전체 내용을 펼친 글
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminTradesApi.list({ status, kind, q, page }, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(errorText(cause)); setLoading(false); } },
    );
    return () => controller.abort();
  }, [status, kind, q, page]);

  // 처리 뒤·다시 시도 — 같은 조건으로 다시 받아 온다 (이번 쪽이 비면 앞 쪽으로)
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminTradesApi.list({ status, kind, q, page }, signal);
      if (signal.aborted) return;
      if (!next.items.length && page > 1) { router.replace(adminTradesHref({ status, kind, q, page: Math.max(1, Math.min(page - 1, next.totalPages || 1)) })); return; }
      setData(next);
    } catch (cause) {
      if (!signal.aborted) setError(errorText(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  // 확인 창에서 [숨기기]/[다시 보이기] → 서버 처리 → 목록 다시 받기
  async function change() {
    if (!pending || busy) return;
    const { post, target } = pending;
    setBusy(true); setNotice(null); setError(null);
    try {
      await adminTradesApi.change(post.id, target);
      setPending(null);
      setNotice(doneText(post, target));
      void reload();
    } catch (cause) {
      setPending(null);
      setError(errorText(cause, "거래글 상태를 바꾸지 못했어요. 다시 시도해 주세요."));
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
      else if (cause instanceof ApiError && (cause.status === 400 || cause.status === 404)) void reload(); // 그 사이 글쓴이가 숨겼거나 지운 글
    } finally {
      setBusy(false);
    }
  }

  const go = (next: Partial<AdminTradeQuery>) => router.push(adminTradesHref({ status, kind, q, ...next, page: 1 }), { scroll: false });
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: search });
  }

  const dialog = pending ? confirmText(pending.post, pending.target) : null;
  const columns: AdminTableColumn<ApiAdminTrade>[] = [
    { header: "종류", render: (post) => <span className="whitespace-nowrap rounded border border-line px-2 py-1 font-pixel text-[10px] text-sub">{kindLabel(post.kind)}</span> },
    {
      header: "물건",
      className: "min-w-[12rem]",
      render: (post) => <button type="button" onClick={() => { setNotice(null); setViewing(post); }} aria-haspopup="dialog" aria-label={`${post.itemName} 글 전체 보기`}
        className="group block w-full min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-mint">
        <p className="break-words font-bold text-ink underline-offset-2 group-hover:underline">{post.itemName}</p>
        {post.content && <p className="mt-0.5 break-words text-xs text-dim">{contentPreview(post.content)}</p>}
        <p className="mt-0.5 text-[11px] font-bold text-mint">전체 보기 ›</p>
      </button>,
    },
    {
      header: "작성자",
      render: (post) => <div className="min-w-0 text-xs">
        <p className="break-words font-bold text-sub">{post.authorNickname}</p>
        <p className="break-all text-dim">{post.authorEmail}</p>
      </div>,
    },
    { header: "지역", render: (post) => <span className="whitespace-nowrap text-xs text-sub">{post.regionName}</span> },
    { header: "등록", render: (post) => <time dateTime={post.createdAt} className="whitespace-nowrap text-xs text-dim">{formatDate(post.createdAt)}</time> },
    {
      header: "상태",
      render: (post) => {
        const state = tradeState(post);
        return <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${TONE[state.tone]}`}>{state.label}</span>;
      },
    },
    {
      header: "동작",
      render: (post) => {
        const target = tradeAction(post);
        if (!target) return <span className="text-xs text-dim" title="글쓴이가 직접 숨긴 글은 다시 보이게 할 수 없어요">—</span>;
        return <button type="button" disabled={busy} onClick={() => { setNotice(null); setPending({ post, target }); }}
          className={`btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold disabled:opacity-50 ${target === "hidden" ? "text-pink" : ""}`}>
          {target === "hidden" ? "숨김" : "다시 보이기"}
        </button>;
      },
    },
  ];

  return <div className="space-y-5">
    <header>
      <h1 className="text-xl font-bold text-ink">거래글 관리</h1>
      <p className="mt-1 text-sm text-sub">PIXEL LOCAL 거래·교환 글을 살펴보고 숨기거나 다시 보이게 해요. 물건 이름을 누르면 글 전체 내용을 볼 수 있어요. 글쓴이가 직접 숨긴 글은 다시 보이게 할 수 없어요.</p>
    </header>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="거래글 상태" className="segmented h-11 self-start">
        {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => { if (option.value !== status) go({ status: option.value }); }} className="text-sm font-bold">{option.label}</button>)}
      </div>
      <form role="search" onSubmit={submitSearch} className="flex min-w-0 gap-2 lg:w-96">
        <label htmlFor="admin-trade-search" className="sr-only">물건 이름 · 내용 · 닉네임 · 이메일 검색</label>
        <input id="admin-trade-search" type="search" value={search} maxLength={SEARCH_LIMIT} onChange={(event) => setSearch(event.target.value)} placeholder="물건 · 내용 · 닉네임 · 이메일" className="min-h-11 min-w-0 flex-1 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
        <button type="submit" className="min-h-11 btn-pixel shrink-0 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mint">검색</button>
      </form>
    </div>
    <div role="group" aria-label="거래글 종류" className="flex gap-2 overflow-x-auto pb-1">
      <KindChip active={kind === null} label="종류 전체" onClick={() => go({ kind: null })} />
      {kindOptions.map((option) => <KindChip key={option.value} active={kind === option.value} label={option.label} onClick={() => go({ kind: option.value })} />)}
    </div>
    {q && <p className="text-sm text-sub">
      <span className="font-bold text-ink">{q}</span> 검색 결과{data ? ` ${data.total}건` : ""} · <button type="button" onClick={() => go({ q: "" })} className="min-h-11 underline underline-offset-4 hover:text-ink">검색 지우기</button>
    </p>}

    {notice && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</p>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading} onClick={() => void reload()} className="btn-pixel min-h-11 shrink-0 px-4 text-sm font-bold">다시 시도</button>
    </div>}

    {loading && !data && !error ? <div aria-label="거래글 목록 불러오는 중" className="h-64 animate-pulse rounded-xl bg-panel" />
      : data && <>
        <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>
        <div aria-busy={loading}>
          <AdminTable columns={columns} rows={data.items} rowKey={(post) => post.id} mobileCards
            empty={<EmptyRow colSpan={columns.length} message={emptyMessage({ status, kind, q })} action={status !== "all" || kind || q ? { label: "필터 초기화", onClick: () => router.push(ADMIN_TRADES_PATH) } : undefined} />} />
        </div>
        <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={ADMIN_TRADES_PATH}
          query={{ status: status === "all" ? undefined : status, kind: kind ?? undefined, q: q || undefined }} />
      </>}

    {viewing && <TradeDetailDialog post={viewing} busy={busy} onClose={() => setViewing(null)}
      onAction={(target) => { setViewing(null); setPending({ post: viewing, target }); }} />}

    <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description}
      confirmLabel={busy ? "처리 중…" : dialog?.confirm} danger={pending?.target === "hidden"}
      onConfirm={() => void change()} onClose={() => { if (!busy) setPending(null); }} />
  </div>;
}

function KindChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold ${active ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"}`}>
    {label}
  </button>;
}
