"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import AdminPagination from "@/components/admin/Pagination";
import { ApiError } from "@/lib/api";
import type { Page } from "@/types/api";
import AdminQuestionCard from "./AdminQuestionCard";
import { ADMIN_QUESTIONS_PATH, SEARCH_LIMIT, adminQuestionsApi, adminQuestionsHref, emptyMessage, statusOptions, type AdminQuestionQuery, type ApiAdminQuestion } from "./adminQuestions";

const LOAD_ERROR = "문의 목록을 불러오지 못했어요. 다시 시도해 주세요.";
const errorText = (cause: unknown) => (cause instanceof ApiError ? cause.message : LOAD_ERROR);

// 필터 · 검색 · 목록 · 쪽 이동 — 주소창 쿼리가 바뀌면 page.tsx가 key로 새로 그린다
export default function AdminQuestionsBoard({ status, q, page }: AdminQuestionQuery) {
  const router = useRouter();
  const [data, setData] = useState<Page<ApiAdminQuestion> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null); // 답변 입력창은 한 번에 하나만 연다
  const [search, setSearch] = useState(q);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    adminQuestionsApi.list({ status, q, page }, controller.signal).then(
      (next) => { if (!controller.signal.aborted) { setData(next); setLoading(false); } },
      (cause) => { if (!controller.signal.aborted) { setError(errorText(cause)); setLoading(false); } },
    );
    return () => controller.abort();
  }, [status, q, page]);

  // 답변 등록 뒤·다시 시도 — 같은 조건으로 다시 받아 온다 (이번 쪽이 비면 앞 쪽으로)
  async function reload() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setLoading(true); setError(null);
    try {
      const next = await adminQuestionsApi.list({ status, q, page }, signal);
      if (signal.aborted) return;
      if (!next.items.length && page > 1) { router.replace(adminQuestionsHref({ status, q, page: Math.max(1, Math.min(page - 1, next.totalPages || 1)) })); return; }
      setData(next);
    } catch (cause) {
      if (!signal.aborted) setError(errorText(cause));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }

  function changeStatus(next: AdminQuestionQuery["status"]) {
    if (next !== status) router.push(adminQuestionsHref({ status: next, q }), { scroll: false });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(adminQuestionsHref({ status, q: search }), { scroll: false });
  }

  function answered() {
    setOpenId(null);
    setNotice("답변을 등록했어요. 손님에게 알림이 갔어요.");
    void reload();
  }

  const empty = emptyMessage({ status, q });

  return <div>
    <h1 className="text-xl font-bold text-ink">문의 관리</h1>
    <p className="mt-1 text-sm text-sub">손님이 남긴 상품 문의에 답변하고, 운영 정책에 맞지 않는 문의는 숨기거나 삭제해요. 답변을 고치려면 삭제 후 다시 등록해요.</p>

    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="답변 상태 필터" className="segmented h-11 self-start">
        {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => changeStatus(option.value)} className="text-sm font-bold">{option.label}</button>)}
      </div>
      <form role="search" onSubmit={submitSearch} className="flex min-w-0 gap-2 sm:w-80">
        <label htmlFor="admin-question-search" className="sr-only">상품 이름 또는 문의 제목 검색</label>
        <input id="admin-question-search" type="search" value={search} maxLength={SEARCH_LIMIT} onChange={(event) => setSearch(event.target.value)} placeholder="상품 이름 · 문의 제목" className="min-h-11 min-w-0 flex-1 pixel-input px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
        <button type="submit" className="min-h-11 btn-pixel shrink-0 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-mint">검색</button>
      </form>
    </div>
    {q && <p className="mt-3 text-sm text-sub">
      <span className="font-bold text-ink">{q}</span> 검색 결과{data ? ` ${data.total}건` : ""} · <button type="button" onClick={() => router.push(adminQuestionsHref({ status }), { scroll: false })} className="min-h-11 underline underline-offset-4 hover:text-ink">검색 지우기</button>
    </p>}

    <div className="mt-5 space-y-3">
      {notice && <p role="status" className="rounded-xl border border-mint/30 bg-panel p-4 text-sm text-mint">{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">
        <p>{error}</p>
        <button type="button" disabled={loading} onClick={() => void reload()} className="mt-2 min-h-11 font-bold underline underline-offset-4">다시 시도</button>
      </div>}
      {loading && !data && !error ? <div aria-label="문의 목록 불러오는 중" className="space-y-3">
        {[0, 1, 2].map((index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-panel" />)}
      </div> : data && (data.items.length ? <ul aria-label="문의 목록" aria-busy={loading} className="space-y-3">
        {data.items.map((question) => <AdminQuestionCard key={question.id} question={question}
          open={openId === question.id} onOpen={() => { setNotice(null); setOpenId(question.id); }} onClose={() => setOpenId(null)}
          onAnswered={answered} onStale={() => { setOpenId(null); void reload(); }}
          onModerated={(message) => { setOpenId(null); setNotice(message); void reload(); }} />)}
      </ul> : <div className="pixel-panel p-8 text-center">
        <p className="font-bold text-ink">{empty.title}</p>
        <p className="mt-2 text-sm text-sub">{empty.body}</p>
      </div>)}
    </div>

    {data && <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={ADMIN_QUESTIONS_PATH} query={{ status: status === "waiting" ? undefined : status, q: q || undefined }} />}
  </div>;
}
