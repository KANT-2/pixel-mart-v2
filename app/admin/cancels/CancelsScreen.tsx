"use client"; // 쿼리 읽기·상태·이벤트가 많아 전체를 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 주문 상세로 이동
import { useRouter, useSearchParams } from "next/navigation"; // 주소 쿼리 읽기·바꾸기
import { useCallback, useEffect, useRef, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable"; // 공용 표
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import EmptyRow from "@/components/admin/EmptyRow"; // 공용 빈 상태 한 줄
import AdminPagination from "@/components/admin/Pagination"; // 공용 페이지 이동 (수정하지 않고 그대로 재사용)
import StatusFilter from "@/components/admin/StatusFilter"; // 공용 상태 탭 (수정하지 않고 그대로 재사용)
import { ApiError } from "@/lib/api";
import { approveAdminCancel, getAdminCancelCounts, getAdminCancelRequests, rejectAdminCancel } from "@/lib/admin";
import type { AdminCancelCounts, AdminCancelRequest, AdminCancelStatus, Page } from "@/types/admin";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";

const BASE_PATH = "/admin/cancels"; // 이 화면의 주소

// 취소 요청 상태 배지 색 — OrderStatusBadge는 주문 상태(paid 등) 전용이라 여기서 따로 만든다
const CANCEL_BADGE: Record<AdminCancelStatus, string> = {
  requested: "border-pink/30 bg-pink/10 text-pink",
  approved: "border-mint/30 bg-mint/10 text-mint",
  rejected: "border-line bg-panel-2 text-dim",
};

// 요약 카드 3개 — 눌러서 그 상태로 필터, 다시 누르면 해제
const CARDS: { status: AdminCancelStatus; countKey: keyof AdminCancelCounts; label: string; hint: string }[] = [
  { status: "requested", countKey: "requested", label: "취소 요청중", hint: "승인 또는 거절이 필요해요" },
  { status: "approved", countKey: "approved", label: "취소 승인", hint: "주문 취소와 재고 복구가 끝났어요" },
  { status: "rejected", countKey: "rejected", label: "취소 거절", hint: "주문이 원래 단계로 돌아갔어요" },
];

// 상태 탭 — "전체"는 StatusFilter가 직접 그려 주므로 나머지 3개만 넘긴다
function buildTabOptions(counts: AdminCancelCounts | null) {
  return [
    { value: "requested", label: "취소 요청중", count: counts?.requested },
    { value: "approved", label: "취소 승인", count: counts?.approved },
    { value: "rejected", label: "취소 거절", count: counts?.rejected },
  ];
}

// 처리 버튼을 누르면 어떤 요청을, 승인/거절 중 뭘로 처리할지 담는 상태
interface ConfirmAction { cancel: AdminCancelRequest; type: "approve" | "reject" }

export default function CancelsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") as AdminCancelStatus | null) ?? undefined; // 지금 선택된 상태 (없으면 전체)
  const page = Math.max(1, Number(searchParams.get("page")) || 1); // 지금 쪽 번호

  const [data, setData] = useState<Page<AdminCancelRequest> | null>(null); // 취소 요청 목록 결과
  const [counts, setCounts] = useState<AdminCancelCounts | null>(null); // 카드·탭 건수
  const [loading, setLoading] = useState(true); // 불러오는 중인지
  const [loadError, setLoadError] = useState<string | null>(null); // 목록 조회 실패 메시지

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null); // 승인·거절 확인창 대상
  const [processing, setProcessing] = useState(false); // 처리 중인지
  const [actionError, setActionError] = useState<string | null>(null); // 처리 실패 메시지
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // 성공 안내 문구
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 쿼리 일부만 바꾸고 나머지는 유지하면서 이동한다 (값이 없으면 그 쿼리를 지운다)
  const changeQuery = useCallback((patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const search = params.toString();
    router.push(search ? `${BASE_PATH}?${search}` : BASE_PATH, { scroll: false });
  }, [searchParams, router]);

  // 처음 들어왔을 때 주소에 상태 쿼리가 아예 없으면 "대기 중"을 기본으로 보여 준다 (한 번만 보정, 이후 "전체"를 눌러도 다시 강제하지 않는다)
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current) return;
    appliedDefault.current = true;
    if (!searchParams.has("status")) router.replace(`${BASE_PATH}?status=requested`, { scroll: false });
  }, [searchParams, router]);

  // 목록 + 건수를 함께 불러온다
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [listResult, countsResult] = await Promise.all([
        getAdminCancelRequests({ status, page, size: 5 }),
        getAdminCancelCounts(),
      ]);
      if (signal.aborted) return;
      setData(listResult);
      setCounts(countsResult);
    } catch (cause) {
      if (signal.aborted) return;
      setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // 화면을 떠나면 성공 메시지 타이머도 정리한다
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  function toggleCard(cardStatus: AdminCancelStatus) {
    changeQuery({ status: status === cardStatus ? undefined : cardStatus, page: undefined }); // 같은 카드를 또 누르면 해제
  }

  async function confirmProcess() {
    if (!confirmAction) return;
    const { cancel, type } = confirmAction;
    setProcessing(true);
    setActionError(null);
    try {
      if (type === "approve") {
        await approveAdminCancel(cancel.id);
        setSuccessMessage(`#${cancel.orderId} 주문의 취소를 승인했어요. 재고가 복구되고 구매자에게 알림을 보냈어요.`);
      } else {
        await rejectAdminCancel(cancel.id);
        setSuccessMessage("취소 요청을 거절했어요. 주문이 원래 단계로 돌아갔고 구매자에게 알림을 보냈어요.");
      }
      setConfirmAction(null);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMessage(null), 3000); // 3초 후 사라짐
      void load(new AbortController().signal); // 목록·건수 다시 불러오기 — 처리된 요청은 "대기 중" 탭에서 자연히 빠진다
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setProcessing(false);
    }
  }

  const columns: AdminTableColumn<AdminCancelRequest>[] = [
    { header: "요청번호", render: (cancel) => <span className="font-bold text-ink">#{cancel.id}</span> },
    { header: "주문번호", render: (cancel) => <Link href={`/admin/orders/${cancel.orderId}`} className="font-bold text-mint hover:underline">#{cancel.orderId}</Link> },
    { header: "주문자", render: (cancel) => <div><p className="font-bold text-ink">{cancel.buyerNickname}</p><p className="text-xs text-dim">{formatDate(cancel.createdAt)}</p></div> },
    // 취소 사유 열: span의 max-width는 인라인 요소라 적용되지 않아 긴 글이 표를 늘렸다 — block + 고정 width로 칸 너비를 확정한다
    { header: "취소 사유", render: (cancel) => <div className="line-clamp-2 break-words sm:w-72 [overflow-wrap:anywhere]" title={cancel.reason}>{cancel.reason}</div> },
    { header: "금액", align: "right", render: (cancel) => <span className="font-bold">{formatPrice(cancel.totalPrice)}</span> },
    { header: "상태", render: (cancel) => <span className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-bold ${CANCEL_BADGE[cancel.status]}`}>{cancel.statusLabel}</span> },
    {
      header: "처리",
      render: (cancel) =>
        cancel.status === "requested" ? (
          <div className="flex gap-1.5">
            <button type="button" aria-label={`요청 ${cancel.id} 승인`} onClick={() => setConfirmAction({ cancel, type: "approve" })} className="btn-lime min-h-11 px-3 text-xs font-bold text-lime-ink">승인</button>
            <button type="button" aria-label={`요청 ${cancel.id} 거절`} onClick={() => setConfirmAction({ cancel, type: "reject" })} className="btn-pixel min-h-11 border-pink px-3 text-xs font-bold text-pink">거절</button>
          </div>
        ) : (
          <span className="text-xs text-dim">처리 완료</span>
        ),
    },
  ];

  if (!data && loading) return <CancelsSkeleton />; // 처음 불러오는 중

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">취소 요청</h1>
        <p className="mt-1 text-sm text-sub">구매자의 취소 요청을 승인하거나 거절해요. 승인하면 주문이 취소되고 재고가 되돌아와요.</p>
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
          <button type="button" onClick={() => void load(new AbortController().signal)} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CARDS.map((card) => {
          const count = counts?.[card.countKey] ?? 0;
          const active = status === card.status;
          return (
            <button
              key={card.status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleCard(card.status)}
              className={`pixel-panel p-3 text-left ${active ? "border-mint" : ""}`}
            >
              <p className="text-xs text-dim">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.status === "requested" && count > 0 ? "text-pink" : "text-ink"}`}>{count}</p>
              <p className="mt-1 text-xs text-dim">{card.hint}</p>
            </button>
          );
        })}
      </div>

      <StatusFilter options={buildTabOptions(counts)} basePath={BASE_PATH} totalCount={counts?.total} />

      {data && (
        <>
          <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>
          <AdminTable
            columns={columns}
            rows={data.items}
            rowKey={(cancel) => cancel.id}
            mobileCards
            empty={
              <EmptyRow
                colSpan={columns.length}
                message="처리할 취소 요청이 없어요."
                action={{ label: "전체 보기", onClick: () => changeQuery({ status: undefined, page: undefined }) }}
              />
            }
          />
          <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={BASE_PATH} query={{ status }} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction
            ? confirmAction.type === "approve"
              ? `#${confirmAction.cancel.orderId} 주문의 취소를 승인할까요?`
              : `#${confirmAction.cancel.orderId} 주문의 취소 요청을 거절할까요?`
            : ""
        }
        description={
          confirmAction
            ? confirmAction.type === "approve"
              ? "주문이 취소되고 상품 재고가 되돌아와요. 구매자에게 알림이 가요. 한 번 승인하면 되돌릴 수 없어요."
              : "주문이 취소 요청 전 단계로 돌아가고 재고는 그대로예요. 구매자에게 알림이 가요."
            : undefined
        }
        confirmLabel={processing ? "처리 중…" : confirmAction?.type === "approve" ? "승인하기" : "거절하기"}
        danger={confirmAction?.type === "reject"}
        onConfirm={() => { if (!processing) void confirmProcess(); }}
        onClose={() => { if (!processing) setConfirmAction(null); }}
      />
    </div>
  );
}

function CancelsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="취소 요청 목록 불러오는 중">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-panel" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
