"use client"; // 쿼리 읽기·상태·이벤트가 많아 전체를 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 상세 화면 이동
import { useRouter, useSearchParams } from "next/navigation"; // 주소 쿼리 읽기·바꾸기
import { useCallback, useEffect, useRef, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable"; // 공용 표
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import EmptyRow from "@/components/admin/EmptyRow"; // 공용 빈 상태 한 줄
import AdminPagination from "@/components/admin/Pagination"; // 공용 페이지 이동 (수정하지 않고 그대로 재사용)
import StatusFilter from "@/components/admin/StatusFilter"; // 공용 상태 탭 (수정하지 않고 그대로 재사용)
import OrderStatusBadge from "@/components/orders/OrderStatusBadge"; // 다른 화면이 이미 만든 상태 배지 — 읽기 전용으로 가져다 쓴다
import { ApiError } from "@/lib/api";
import { advanceAdminOrder, getAdminOrderCounts, getAdminOrders } from "@/lib/admin";
import type { AdminOrderCounts, AdminOrderStatus, AdminOrderSummary, Page } from "@/types/admin";
import { formatPrice } from "@/utils/formatPrice";

const BASE_PATH = "/admin/orders"; // 이 화면의 주소

// 다음 단계로 넘길 수 있는 상태의 "버튼 글자"와 "넘어갈 상태의 한글 이름" — 이슈가 정한 문구 그대로
const NEXT_BUTTON_LABEL: Partial<Record<AdminOrderStatus, string>> = { paid: "준비 시작", preparing: "배송 시작", shipping: "배송 완료" };
const NEXT_STATUS_LABEL: Partial<Record<AdminOrderStatus, string>> = { paid: "상품 준비중", preparing: "배송중", shipping: "배송 완료" };

// 요약 카드 4개 — 눌러서 그 상태로 필터, 다시 누르면 해제
const CARDS: { status: AdminOrderStatus; countKey: keyof AdminOrderCounts; label: string; hint: string }[] = [
  { status: "paid", countKey: "paid", label: "처리 필요", hint: "주문 완료 · 준비를 시작해 주세요" }, // statusLabel("주문 완료")과 문구를 맞춘다
  { status: "preparing", countKey: "preparing", label: "상품 준비중", hint: "포장이 끝나면 배송을 시작해 주세요" },
  { status: "shipping", countKey: "shipping", label: "배송중", hint: "도착하면 배송완료로 넘겨주세요" },
  { status: "cancel_requested", countKey: "cancelRequested", label: "취소 요청", hint: "취소 요청 화면에서 처리해요" },
];

// 상태 탭 — "전체"는 StatusFilter가 직접 그려 주므로 나머지 5개만 넘긴다 (취소됨은 탭에 없음, 전체에서만 보임)
function buildTabOptions(counts: AdminOrderCounts | null) {
  return [
    { value: "paid", label: "주문 완료", count: counts?.paid }, // statusLabel("주문 완료")과 문구를 맞춘다
    { value: "preparing", label: "상품 준비중", count: counts?.preparing },
    { value: "shipping", label: "배송중", count: counts?.shipping },
    { value: "delivered", label: "배송 완료", count: counts?.delivered },
    { value: "cancel_requested", label: "취소 요청", count: counts?.cancelRequested },
  ];
}

export default function OrdersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get("status") as AdminOrderStatus | null) ?? undefined; // 지금 선택된 상태 (없으면 전체)
  const q = searchParams.get("q") ?? ""; // 지금 검색어
  const page = Math.max(1, Number(searchParams.get("page")) || 1); // 지금 쪽 번호

  const [data, setData] = useState<Page<AdminOrderSummary> | null>(null); // 주문 목록 결과
  const [counts, setCounts] = useState<AdminOrderCounts | null>(null); // 카드·탭 건수
  const [loading, setLoading] = useState(true); // 불러오는 중인지
  const [loadError, setLoadError] = useState<string | null>(null); // 목록 조회 실패 메시지

  const [searchText, setSearchText] = useState(q); // 검색창에 입력 중인 글자
  const [confirmOrder, setConfirmOrder] = useState<AdminOrderSummary | null>(null); // 다음 단계 확인창 대상
  const [advancing, setAdvancing] = useState(false); // 다음 단계 처리 중인지
  const [actionError, setActionError] = useState<string | null>(null); // 다음 단계 실패 메시지
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

  // 목록 + 건수를 함께 불러온다
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [listResult, countsResult] = await Promise.all([
        getAdminOrders({ status, q: q || undefined, page, size: 5 }),
        getAdminOrderCounts(),
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
  }, [status, q, page]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // 주소의 검색어가 바뀌면(뒤로가기 등) 검색창 글자도 맞춘다 — 렌더링 중에 바로 맞춰서 effect를 안 쓴다
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearchText(q);
  }

  // 검색창에 입력하고 0.4초 멈추면 주소를 바꾼다(=1쪽으로 이동해서 다시 불러온다)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText !== q) changeQuery({ q: searchText || undefined, page: undefined });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText, q, changeQuery]);

  // 화면을 떠나면 성공 메시지 타이머도 정리한다
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  function toggleCard(cardStatus: AdminOrderStatus) {
    changeQuery({ status: status === cardStatus ? undefined : cardStatus, page: undefined }); // 같은 카드를 또 누르면 해제
  }

  async function confirmAdvance() {
    if (!confirmOrder) return;
    setAdvancing(true);
    setActionError(null);
    try {
      const updated = await advanceAdminOrder(confirmOrder.id);
      setConfirmOrder(null);
      setSuccessMessage(`#${updated.id} 주문을 "${updated.statusLabel}"으로 넘겼어요. 구매자에게 알림을 보냈어요.`);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccessMessage(null), 3000); // 3초 후 사라짐
      void load(new AbortController().signal); // 목록·건수 다시 불러오기
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setAdvancing(false);
    }
  }

  // "다음 단계" 칸에 보여줄 버튼 또는 안내 문구
  function renderNextStep(order: AdminOrderSummary) {
    const buttonLabel = NEXT_BUTTON_LABEL[order.status];
    if (buttonLabel) {
      return (
        <button type="button" onClick={() => setConfirmOrder(order)} className="btn-pixel min-h-11 whitespace-nowrap px-3 text-xs font-bold">
          {buttonLabel}
        </button>
      );
    }
    if (order.status === "delivered") return <span className="whitespace-nowrap text-xs text-dim">모두 끝난 주문</span>;
    if (order.status === "cancelled") return <span className="whitespace-nowrap text-xs text-dim">취소된 주문</span>;
    return <span className="whitespace-nowrap text-xs text-pink">취소 요청에서 처리</span>; // cancel_requested
  }

  const columns: AdminTableColumn<AdminOrderSummary>[] = [
    { header: "주문번호", render: (order) => <Link href={`/admin/orders/${order.id}`} className="font-bold text-mint hover:underline">#{order.id}</Link> },
    { header: "주문자", render: (order) => <div><p className="font-bold text-ink">{order.buyerNickname}</p><p className="text-xs text-dim">{order.buyerEmail}</p></div> },
    { header: "상품", render: (order) => <span className="break-words">{order.title}</span> },
    { header: "금액", align: "right", render: (order) => <span className="font-bold">{formatPrice(order.totalPrice)}</span> },
    { header: "상태", render: (order) => <OrderStatusBadge status={order.status} label={order.statusLabel} /> },
    { header: "다음 단계", render: renderNextStep },
  ];

  if (!data && loading) return <OrdersSkeleton />; // 처음 불러오는 중

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-ink">주문 관리</h1>
        <p className="mt-1 text-sm text-sub">상태를 확인하고, 버튼 한 번으로 다음 단계로 넘겨요.</p>
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

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <p className={`mt-1 text-2xl font-bold ${card.status === "cancel_requested" && count > 0 ? "text-pink" : "text-ink"}`}>{count}</p>
              <p className="mt-1 text-xs text-dim">{card.hint}</p>
            </button>
          );
        })}
      </div>

      <StatusFilter options={buildTabOptions(counts)} basePath={BASE_PATH} totalCount={counts?.total} />

      {/* 검색 입력 */}
      <div>
        <label htmlFor="order-search" className="sr-only">주문 검색</label>
        <input
          id="order-search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="주문번호 · 닉네임 · 이메일로 검색"
          className="pixel-input h-11 w-full max-w-sm px-3 text-sm"
        />
      </div>

      {data && (
        <>
          <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>
          <AdminTable
            columns={columns}
            rows={data.items}
            rowKey={(order) => order.id}
            mobileCards
            empty={
              <EmptyRow
                colSpan={columns.length}
                message="조건에 맞는 주문이 없어요."
                action={{ label: "필터 초기화", onClick: () => changeQuery({ status: undefined, q: undefined, page: undefined }) }}
              />
            }
          />
          <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={BASE_PATH} query={{ status, q: q || undefined }} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmOrder}
        title={confirmOrder ? `#${confirmOrder.id} 주문을 넘길까요?` : ""}
        description={confirmOrder ? `"${confirmOrder.statusLabel}"에서 "${NEXT_STATUS_LABEL[confirmOrder.status]}" 단계로 바뀌고, 구매자에게 알림이 가요.` : undefined}
        confirmLabel={advancing ? "처리 중…" : "넘기기"}
        onConfirm={() => { if (!advancing) void confirmAdvance(); }}
        onClose={() => { if (!advancing) setConfirmOrder(null); }}
      />
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="주문 목록 불러오는 중">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-panel" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
