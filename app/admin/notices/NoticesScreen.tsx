"use client"; // 상태·이벤트가 많아 전체를 클라이언트 컴포넌트로 만든다 (#101 ProductsScreen과 같은 구조)

import { useSearchParams } from "next/navigation"; // 주소 쿼리 읽기(페이지 번호)
import { useCallback, useEffect, useState, type ReactNode } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable"; // 공용 표
import AdminPagination from "@/components/admin/Pagination"; // 공용 페이지 이동 (수정하지 않고 그대로 재사용)
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import EmptyRow from "@/components/admin/EmptyRow"; // 공용 빈 상태 한 줄
import NoticeForm from "@/components/admin/NoticeForm";
import { ApiError } from "@/lib/api";
import { deleteNotice, getAdminNotices, updateNotice } from "@/lib/adminNotices";
import type { Page } from "@/types/api";
import type { AdminNotice } from "@/types/notice";
import { formatNoticeDate } from "@/utils/notices";

const BASE_PATH = "/admin/notices";
const PAGE_SIZE = 20; // 실제 API 기본값과 맞춘다

// 공지 등록·수정 폼을 열어 둘 때, 어떤 모드인지와(등록/수정) 대상 공지를 담는다
type FormState = { mode: "create" } | { mode: "edit"; notice: AdminNotice };

export default function NoticesScreen() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [data, setData] = useState<Page<AdminNotice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminNotice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await getAdminNotices(page, PAGE_SIZE));
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load();
  }, [load]);

  function onSaved(saved: AdminNotice) {
    const verb = formState?.mode === "create" ? "등록" : "수정";
    setFormState(null);
    setSuccessMessage(`"${saved.title}" 공지를 ${verb}했어요.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    void load();
  }

  async function togglePublish(notice: AdminNotice) {
    setActionError(null);
    try {
      await updateNotice(notice.id, { isPublished: !notice.isPublished });
      void load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function confirmRemove() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteNotice(confirmDelete.id);
      setSuccessMessage(`"${confirmDelete.title}" 공지를 삭제했어요.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setConfirmDelete(null);
      void load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  const columns: AdminTableColumn<AdminNotice>[] = [
    { header: "제목", render: (notice) => <div className="w-72 break-words [overflow-wrap:anywhere] font-bold text-ink">{notice.title}</div> },
    { header: "고정", className: "text-center", render: (notice) => (notice.isPinned ? <Badge tone="pin">고정</Badge> : <span className="text-xs text-dim">-</span>) },
    { header: "상태", className: "text-center", render: (notice) => (notice.isPublished ? <Badge tone="published">게시중</Badge> : <Badge tone="hidden">숨김</Badge>) },
    { header: "작성일", render: (notice) => <span className="whitespace-nowrap text-xs text-dim">{formatNoticeDate(notice.createdAt)}</span> },
    {
      header: "동작",
      render: (notice) => (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setFormState({ mode: "edit", notice })} className="btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold">수정</button>
          <button type="button" onClick={() => void togglePublish(notice)} className="btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold">{notice.isPublished ? "숨기기" : "게시하기"}</button>
          <button type="button" onClick={() => setConfirmDelete(notice)} className="btn-pixel min-h-9 whitespace-nowrap border-pink px-2.5 text-xs font-bold text-pink">삭제</button>
        </div>
      ),
    },
  ];

  if (!data && loading) return <NoticesSkeleton />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">공지 관리</h1>
          <p className="mt-1 text-sm text-sub">게시한 공지는 손님 화면의 공지 목록에 바로 보여요. 고정한 공지는 메인 맨 위 배너에도 나와요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFormState({ mode: "create" })} className="btn-lime min-h-11 px-4 text-sm font-bold">+ 새 공지 쓰기</button>
        </div>
      </header>

      {successMessage && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{successMessage}</p>}
      {actionError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-3">
          <p className="text-sm text-pink">{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} aria-label="오류 메시지 닫기" className="btn-pixel min-h-11 min-w-11 px-2 text-sm font-bold">✕</button>
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
          <p className="text-sm text-pink">{loadError}</p>
          <button type="button" onClick={() => void load()} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      {formState && (
        <NoticeForm
          // 폼이 열린 채로 다른 공지의 "수정"을 눌러도 내용이 안 바뀌던 문제 — NoticeForm의 입력값은
          // useState로 한 번만 초기화되니, 대상(id)이 바뀌면 key로 아예 새로 만들어서 다시 채운다
          key={formState.mode === "edit" ? formState.notice.id : "create"}
          mode={formState.mode}
          notice={formState.mode === "edit" ? formState.notice : undefined}
          onSaved={onSaved}
          onCancel={() => setFormState(null)}
        />
      )}

      {data && (
        data.items.length === 0 ? (
          <p className="pixel-panel p-10 text-center text-sm text-sub">등록된 공지가 없어요. &quot;새 공지 쓰기&quot;로 첫 공지를 올려보세요.</p>
        ) : (
          <>
            <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>

            {/* sm 이상: 표. 375px 같은 좁은 화면에서는 가로 스크롤 대신 카드로 보여준다 */}
            <div className="hidden sm:block">
              <AdminTable columns={columns} rows={data.items} rowKey={(notice) => notice.id} empty={<EmptyRow colSpan={columns.length} message="등록된 공지가 없어요." />} />
            </div>
            <div className="space-y-3 sm:hidden">
              {data.items.map((notice) => (
                <div key={notice.id} className="pixel-panel space-y-2 p-3">
                  <p className="break-words font-bold text-ink">{notice.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {notice.isPinned && <Badge tone="pin">고정</Badge>}
                    {notice.isPublished ? <Badge tone="published">게시중</Badge> : <Badge tone="hidden">숨김</Badge>}
                    <span className="text-xs text-dim">{formatNoticeDate(notice.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button type="button" onClick={() => setFormState({ mode: "edit", notice })} className="btn-pixel min-h-9 flex-1 whitespace-nowrap px-2.5 text-xs font-bold">수정</button>
                    <button type="button" onClick={() => void togglePublish(notice)} className="btn-pixel min-h-9 flex-1 whitespace-nowrap px-2.5 text-xs font-bold">{notice.isPublished ? "숨기기" : "게시하기"}</button>
                    <button type="button" onClick={() => setConfirmDelete(notice)} className="btn-pixel min-h-9 flex-1 whitespace-nowrap border-pink px-2.5 text-xs font-bold text-pink">삭제</button>
                  </div>
                </div>
              ))}
            </div>

            <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={BASE_PATH} />
          </>
        )
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? `"${confirmDelete.title}" 공지를 삭제할까요?` : ""}
        description="삭제하면 되돌릴 수 없어요."
        confirmLabel={deleting ? "삭제 중…" : "삭제"}
        danger
        onConfirm={() => { if (!deleting) void confirmRemove(); }}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
      />
    </div>
  );
}

function Badge({ tone, children }: { tone: "pin" | "published" | "hidden"; children: ReactNode }) {
  const cls = tone === "pin" ? "border-lime/30 bg-lime/10 text-lime" : tone === "published" ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-panel-2 text-dim";
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>;
}

function NoticesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="공지 목록 불러오는 중">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
