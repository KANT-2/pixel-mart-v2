"use client";

import Link from "next/link";
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
import {
  ADMIN_REVIEWS_PATH, RATINGS, SEARCH_LIMIT, adminReviewsApi, adminReviewsHref, confirmText, contentPreview, doneText, emptyMessage, statusOptions,
  type AdminReviewQuery, type ApiAdminReview,
} from "./adminReviews";
import AdminReviewReply from "./AdminReviewReply";

const LOAD_ERROR = "리뷰 목록을 불러오지 못했어요. 다시 시도해 주세요.";
const errorText = (cause: unknown, fallback = LOAD_ERROR) => (cause instanceof ApiError ? cause.message : fallback);

// 상태 탭 · 별점/사진 칩 · 검색 · 표 · 쪽 이동 — 주소창 쿼리가 바뀌면 page.tsx가 key로 새로 그린다
export default function AdminReviewsBoard({ status, rating, photo, q, page }: AdminReviewQuery) {
  const router = useRouter();
  const { refresh: refreshAuth } = useAuth();
  const [data, setData] = useState<Page<ApiAdminReview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState(q);
  const [pending, setPending] = useState<{ review: ApiAdminReview; hide: boolean } | null>(null); // 확인 창 대상
  const [busy, setBusy] = useState(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminReviewsApi.list({ status, rating, photo, q, page }, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(errorText(cause)); setLoading(false); } },
    );
    return () => controller.abort();
  }, [status, rating, photo, q, page]);

  // 처리 뒤·다시 시도 — 같은 조건으로 다시 받아 온다 (이번 쪽이 비면 앞 쪽으로)
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminReviewsApi.list({ status, rating, photo, q, page }, signal);
      if (signal.aborted) return;
      if (!next.items.length && page > 1) { router.replace(adminReviewsHref({ status, rating, photo, q, page: Math.max(1, Math.min(page - 1, next.totalPages || 1)) })); return; }
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
    const { review, hide } = pending;
    setBusy(true); setNotice(null); setError(null);
    try {
      await adminReviewsApi.setHidden(review.id, hide);
      setPending(null);
      setNotice(doneText(review, hide));
      void reload();
    } catch (cause) {
      setPending(null);
      setError(errorText(cause, "리뷰 상태를 바꾸지 못했어요. 다시 시도해 주세요."));
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
      else if (cause instanceof ApiError && cause.status === 404) void reload(); // 그 사이 작성자가 지운 리뷰
    } finally {
      setBusy(false);
    }
  }

  const go = (next: Partial<AdminReviewQuery>) => router.push(adminReviewsHref({ status, rating, photo, q, ...next, page: 1 }), { scroll: false });
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: search });
  }

  const dialog = pending ? confirmText(pending.review, pending.hide) : null;
  const filtered = status !== "all" || rating !== null || photo || Boolean(q);
  const columns: AdminTableColumn<ApiAdminReview>[] = [
    {
      header: "상품",
      className: "min-w-[9rem]",
      render: (review) => <Link href={`/products/${review.productId}`} className="break-words text-xs font-bold text-sub underline-offset-2 hover:text-ink hover:underline">{review.productName}</Link>,
    },
    { header: "별점", render: (review) => <span aria-label={`별점 ${review.rating}점`} className="whitespace-nowrap text-sm text-lime">{"★".repeat(review.rating)}<span className="text-dim">{"★".repeat(5 - review.rating)}</span></span> },
    {
      header: "내용",
      className: "min-w-[14rem]",
      render: (review) => <div className="min-w-0">
        <p title={review.content} className="break-words text-sm text-ink">{contentPreview(review.content)}</p>
        {review.imageUrls.length > 0 && <div className="mt-1.5 flex gap-1.5">
          {review.imageUrls.map((src, index) => <a key={index} href={src} target="_blank" rel="noreferrer" aria-label={`사진 ${index + 1} 크게 보기`} className="block size-10 overflow-hidden rounded border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- 리뷰 사진은 data URL */}
            <img src={src} alt="" className="size-full object-cover" />
          </a>)}
        </div>}
        <AdminReviewReply review={review} onSaved={() => { setNotice("답글을 저장했어요."); void reload(); }} onRemoved={() => { setNotice("답글을 삭제했어요."); void reload(); }} onAuthExpired={() => void refreshAuth()} />
      </div>,
    },
    {
      header: "작성자",
      className: "min-w-[10rem]",
      render: (review) => <div className="min-w-0 text-xs">
        <p className="break-words font-bold text-sub">{review.nickname}</p>
        <p className="break-all text-dim">{review.authorEmail}</p>
      </div>,
    },
    { header: "등록", render: (review) => <time dateTime={review.createdAt} className="whitespace-nowrap text-xs text-dim">{formatDate(review.createdAt)}</time> },
    {
      header: "상태",
      render: (review) => <span className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${review.isHidden ? "border-pink/40 bg-pink/10 text-pink" : "border-mint/30 bg-mint/10 text-mint"}`}>{review.isHidden ? "숨김" : "공개"}</span>,
    },
    {
      header: "동작",
      render: (review) => <button type="button" disabled={busy} onClick={() => { setNotice(null); setPending({ review, hide: !review.isHidden }); }}
        className={`btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold disabled:opacity-50 ${review.isHidden ? "" : "text-pink"}`}>
        {review.isHidden ? "다시 보이기" : "숨김"}
      </button>,
    },
  ];

  return <div className="space-y-5">
    <header>
      <h1 className="text-xl font-bold text-ink">리뷰 관리</h1>
      <p className="mt-1 text-sm text-sub">상품 리뷰를 살펴보고 숨기거나 다시 보이게 해요. 숨긴 리뷰는 상품 페이지와 평균 별점에서 빠져요.</p>
    </header>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="리뷰 상태" className="segmented h-11 self-start">
        {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => { if (option.value !== status) go({ status: option.value }); }} className="text-sm font-bold">{option.label}</button>)}
      </div>
      <form role="search" onSubmit={submitSearch} className="flex min-w-0 gap-2 lg:w-96">
        <label htmlFor="admin-review-search" className="sr-only">상품 이름 · 내용 · 닉네임 · 이메일 검색</label>
        <input id="admin-review-search" type="search" value={search} maxLength={SEARCH_LIMIT} onChange={(event) => setSearch(event.target.value)} placeholder="상품 · 내용 · 닉네임 · 이메일" className="min-h-11 min-w-0 flex-1 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
        <button type="submit" className="min-h-11 btn-pixel shrink-0 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mint">검색</button>
      </form>
    </div>
    <div role="group" aria-label="별점 · 사진" className="flex gap-2 overflow-x-auto pb-1">
      <Chip active={rating === null} label="별점 전체" onClick={() => go({ rating: null })} />
      {RATINGS.map((value) => <Chip key={value} active={rating === value} label={`★ ${value}`} onClick={() => go({ rating: value })} />)}
      <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-line" />
      <Chip active={photo} label="사진 리뷰만" onClick={() => go({ photo: !photo })} />
    </div>
    {q && <p className="text-sm text-sub">
      <span className="font-bold text-ink">{q}</span> 검색 결과{data ? ` ${data.total}건` : ""} · <button type="button" onClick={() => go({ q: "" })} className="min-h-11 underline underline-offset-4 hover:text-ink">검색 지우기</button>
    </p>}

    {notice && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</p>}
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading} onClick={() => void reload()} className="btn-pixel min-h-11 shrink-0 px-4 text-sm font-bold">다시 시도</button>
    </div>}

    {loading && !data && !error ? <div aria-label="리뷰 목록 불러오는 중" className="h-64 animate-pulse rounded-xl bg-panel" />
      : data && <>
        <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>
        <div aria-busy={loading}>
          <AdminTable columns={columns} rows={data.items} rowKey={(review) => review.id} mobileCards
            empty={<EmptyRow colSpan={columns.length} message={emptyMessage({ status, rating, photo, q })} action={filtered ? { label: "필터 초기화", onClick: () => router.push(ADMIN_REVIEWS_PATH) } : undefined} />} />
        </div>
        <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={ADMIN_REVIEWS_PATH}
          query={{ status: status === "all" ? undefined : status, rating: rating ? String(rating) : undefined, photo: photo ? "1" : undefined, q: q || undefined }} />
      </>}

    <ConfirmDialog open={Boolean(dialog)} title={dialog?.title ?? ""} description={dialog?.description}
      confirmLabel={busy ? "처리 중…" : dialog?.confirm} danger={pending?.hide}
      onConfirm={() => void change()} onClose={() => { if (!busy) setPending(null); }} />
  </div>;
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold ${active ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"}`}>
    {label}
  </button>;
}
