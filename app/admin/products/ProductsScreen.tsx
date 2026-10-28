"use client"; // 쿼리 읽기·상태·이벤트가 많아 전체를 클라이언트 컴포넌트로 만든다

import { useRouter, useSearchParams } from "next/navigation"; // 주소 쿼리 읽기·바꾸기
import { useCallback, useEffect, useRef, useState } from "react";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable"; // 공용 표
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import EmptyRow from "@/components/admin/EmptyRow"; // 공용 빈 상태 한 줄
import AdminPagination from "@/components/admin/Pagination"; // 공용 페이지 이동 (수정하지 않고 그대로 재사용)
import ProductForm from "@/components/admin/ProductForm";
import StatusFilter from "@/components/admin/StatusFilter"; // 공용 상태 탭(전체/노출/숨김) — 수정하지 않고 그대로 재사용
import { ApiError } from "@/lib/api";
import { getAdminProducts, updateAdminProduct } from "@/lib/admin";
import type { AdminProduct, AdminProductQuery, Page } from "@/types/admin";
import type { ApiCategory } from "@/types/api";
import { stockStatus } from "@/utils/adminProducts";
import { formatPrice } from "@/utils/formatPrice";
import { RARITY_KEYS, rarityInfo, type Rarity } from "@/utils/gameItem";

const BASE_PATH = "/admin/products";

interface ProductsScreenProps { categories: ApiCategory[] }

// 상품 등록·수정 폼을 열어 둘 때, 어떤 모드인지와(등록/수정) 대상 상품을 담는다
type FormState = { mode: "create" } | { mode: "edit"; product: AdminProduct; focusRestock: boolean };

export default function ProductsScreen({ categories }: ProductsScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? ""; // "" 전체, "visible" 노출, "hidden" 숨김
  const rarity = searchParams.get("rarity") ?? "";
  const soldOut = searchParams.get("soldOut") === "1";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [data, setData] = useState<Page<AdminProduct> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState(q);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<AdminProduct | null>(null); // 숨김/다시 보이기 확인 대상
  const [hiding, setHiding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingRarity, setSavingRarity] = useState<number | null>(null); // 등급을 바꾸는 중인 상품 id
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 완료 문구를 3초 보여 준다 — 연달아 바꾸면 앞 타이머를 지워서 새 문구가 바로 사라지지 않게
  function flash(message: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setSuccessMessage(message);
    flashTimer.current = setTimeout(() => setSuccessMessage(null), 3000);
  }

  const changeQuery = useCallback((patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const search = params.toString();
    router.push(search ? `${BASE_PATH}?${search}` : BASE_PATH, { scroll: false });
  }, [searchParams, router]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      const query: AdminProductQuery = {
        q: q || undefined,
        rarity: (rarity || undefined) as AdminProductQuery["rarity"],
        hidden: status === "visible" ? false : status === "hidden" ? true : undefined,
        soldOut: soldOut || undefined,
        page,
        size: 10,
      };
      const result = await getAdminProducts(query);
      if (signal.aborted) return;
      setData(result);
    } catch (cause) {
      if (signal.aborted) return;
      setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [q, status, rarity, soldOut, page]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // 주소의 검색어가 바뀌면(뒤로가기 등) 검색창 글자도 맞춘다
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

  // 목록 아래쪽 상품의 "수정"/"재입고"를 눌러도 폼(화면 위쪽)이 바로 보이게 스크롤한다 (AdminBadgesBoard와 같은 방식)
  useEffect(() => { if (formState) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [formState]);

  function onSaved(saved: AdminProduct) {
    const verb = formState?.mode === "create" ? "등록" : "수정";
    setFormState(null);
    flash(`#${saved.id} "${saved.name}" 상품을 ${verb}했어요.`);
    void load(new AbortController().signal);
  }

  // 표에서 등급을 바로 바꾼다 — 성공하면 그 줄만 고친다 (등급 필터를 켜 둔 상태면 목록을 다시 받는다)
  async function changeRarity(product: AdminProduct, next: Rarity) {
    if (next === product.rarity || savingRarity !== null) return;
    setSavingRarity(product.id);
    setActionError(null);
    try {
      const saved = await updateAdminProduct(product.id, { rarity: next });
      setData((current) => current && { ...current, items: current.items.map((item) => (item.id === saved.id ? saved : item)) });
      flash(`#${product.id} 상품 등급을 ${rarityInfo(next).label}(으)로 바꿨어요.`);
      if (rarity) void load(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "등급을 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSavingRarity(null);
    }
  }

  async function confirmToggleHidden() {
    if (!confirmProduct) return;
    setHiding(true);
    setActionError(null);
    try {
      await updateAdminProduct(confirmProduct.id, { isHidden: !confirmProduct.isHidden });
      flash(confirmProduct.isHidden ? `#${confirmProduct.id} 상품을 다시 보이게 했어요.` : `#${confirmProduct.id} 상품을 숨겼어요.`);
      setConfirmProduct(null);
      void load(new AbortController().signal);
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setHiding(false);
    }
  }

  const columns: AdminTableColumn<AdminProduct>[] = [
    { header: "상품명", render: (product) => <span className="break-words font-bold text-ink">{product.name}</span> },
    { header: "등급", render: (product) => <RarityPicker product={product} saving={savingRarity === product.id} disabled={savingRarity !== null} onChange={(next) => void changeRarity(product, next)} /> },
    { header: "가격", align: "right", render: (product) => <span className="font-bold">{formatPrice(product.price)}</span> },
    { header: "재고", render: (product) => <StockCell stock={product.stock} /> },
    { header: "상태", render: (product) => <VisibilityToggle product={product} onClick={() => setConfirmProduct(product)} /> },
    {
      header: "동작",
      render: (product) => (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setFormState({ mode: "edit", product, focusRestock: false })} className="btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold">수정</button>
          <button type="button" onClick={() => setFormState({ mode: "edit", product, focusRestock: true })} className="btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold">재입고</button>
        </div>
      ),
    },
  ];

  if (!data && loading) return <ProductsSkeleton />;

  return (
    <div className="space-y-2 sm:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">상품 관리</h1>
          <p className="mt-0.5 text-sm text-sub sm:mt-1">상품을 등록하고, 등급·재고·노출 여부를 관리해요. 등급과 상태는 표에서 바로 바꿀 수 있어요.</p>
        </div>
        <button type="button" onClick={() => setFormState({ mode: "create" })} className="btn-lime min-h-11 px-4 text-sm font-bold">상품 등록</button>
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

      <div ref={formRef} className="scroll-mt-24">
        {formState && (
          <ProductForm
            mode={formState.mode}
            product={formState.mode === "edit" ? formState.product : undefined}
            focusRestock={formState.mode === "edit" ? formState.focusRestock : false}
            categories={categories}
            onSaved={onSaved}
            onCancel={() => setFormState(null)}
          />
        )}
      </div>

      <StatusFilter
        options={[{ value: "visible", label: "노출" }, { value: "hidden", label: "숨김" }]}
        basePath={BASE_PATH}
      />

      {/* 등급 필터 — 상태 탭과 다른 쿼리 키를 쓰므로 StatusFilter 대신 직접 그린다. 줄바꿈 대신 가로 스크롤로 한 줄에 보여준다 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-1">
        <FilterChip active={rarity === ""} label="등급 전체" onClick={() => changeQuery({ rarity: undefined, page: undefined })} />
        {RARITY_KEYS.map((key) => (
          <FilterChip key={key} active={rarity === key} label={rarityInfo(key).label} onClick={() => changeQuery({ rarity: rarity === key ? undefined : key, page: undefined })} />
        ))}
      </div>

      {/* 검색과 품절 토글은 성격이 달라 등급 칩과 한 줄에 안 섞고, 대신 같은 줄에 나란히 둬서 줄을 늘리지 않는다 */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="product-search" className="sr-only">상품 검색</label>
        <input
          id="product-search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="상품명으로 검색"
          className="pixel-input h-11 w-full max-w-sm px-3 text-sm"
        />
        <FilterChip active={soldOut} label="품절만 보기" onClick={() => changeQuery({ soldOut: soldOut ? undefined : "1", page: undefined })} />
      </div>

      {data && (
        <>
          <p className="text-xs text-dim">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>

          {/* sm 이상: 표. 375px 같은 좁은 화면에서는 가로 스크롤 대신 카드로 보여준다 */}
          <div className="hidden sm:block">
            <AdminTable
              columns={columns}
              rows={data.items}
              rowKey={(product) => product.id}
              empty={<EmptyRow colSpan={columns.length} message="조건에 맞는 상품이 없어요." action={{ label: "필터 초기화", onClick: () => router.push(BASE_PATH) }} />}
            />
          </div>
          <div className="space-y-3 sm:hidden">
            {data.items.length === 0 ? (
              <p className="pixel-panel p-6 text-center text-sm text-sub">조건에 맞는 상품이 없어요.</p>
            ) : (
              data.items.map((product) => (
                <div key={product.id} className="pixel-panel space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words font-bold text-ink">{product.name}</p>
                    <RarityPicker product={product} saving={savingRarity === product.id} disabled={savingRarity !== null} onChange={(next) => void changeRarity(product, next)} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">{formatPrice(product.price)}</span>
                    <StockCell stock={product.stock} />
                  </div>
                  <VisibilityToggle product={product} onClick={() => setConfirmProduct(product)} />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button type="button" onClick={() => setFormState({ mode: "edit", product, focusRestock: false })} className="btn-pixel min-h-9 flex-1 whitespace-nowrap px-2.5 text-xs font-bold">수정</button>
                    <button type="button" onClick={() => setFormState({ mode: "edit", product, focusRestock: true })} className="btn-pixel min-h-9 flex-1 whitespace-nowrap px-2.5 text-xs font-bold">재입고</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <AdminPagination currentPage={data.page} totalPages={data.totalPages} basePath={BASE_PATH} query={{ q: q || undefined, status: status || undefined, rarity: rarity || undefined, soldOut: soldOut ? "1" : undefined }} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmProduct}
        title={confirmProduct ? `#${confirmProduct.id} "${confirmProduct.name}"을(를) ${confirmProduct.isHidden ? "다시 보이게 할까요?" : "숨길까요?"}` : ""}
        description={confirmProduct?.isHidden ? "숨김을 풀면 손님 상품 목록에 다시 보여요." : "숨기면 손님 상품 목록·검색에서 보이지 않아요."}
        confirmLabel={hiding ? "처리 중…" : "확인"}
        danger={!confirmProduct?.isHidden}
        onConfirm={() => { if (!hiding) void confirmToggleHidden(); }}
        onClose={() => { if (!hiding) setConfirmProduct(null); }}
      />
    </div>
  );
}

// 등급 배지 모양의 선택 상자 — 고르면 바로 저장
function RarityPicker({ product, saving, disabled, onChange }: { product: AdminProduct; saving: boolean; disabled: boolean; onChange: (next: Rarity) => void }) {
  const info = rarityInfo(product.rarity);
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={`#${product.id} ${product.name} 등급`}
        value={product.rarity}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Rarity)}
        className="min-h-9 cursor-pointer appearance-none rounded-md border bg-night py-1 pl-2.5 pr-7 text-xs font-bold hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-mint disabled:cursor-wait disabled:opacity-60"
        style={{ color: info.color, borderColor: info.color }}
      >
        {RARITY_KEYS.map((key) => <option key={key} value={key} style={{ color: "initial" }}>{rarityInfo(key).label}</option>)}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: info.color }}>{saving ? "…" : "▾"}</span>
    </span>
  );
}

// 노출/숨김 배지를 누르면 확인창을 거쳐 바꾼다
function VisibilityToggle({ product, onClick }: { product: AdminProduct; onClick: () => void }) {
  const tone = product.isHidden ? "border-line bg-panel-2 text-dim hover:text-ink" : "border-mint/30 bg-mint/10 text-mint hover:border-mint/60";
  return (
    <button type="button" onClick={onClick} title={product.isHidden ? "눌러서 다시 보이게" : "눌러서 숨기기"}
      aria-label={`#${product.id} ${product.name} ${product.isHidden ? "숨김 상태, 다시 보이게 하기" : "노출 중, 숨기기"}`}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-mint ${tone}`}>
      {product.isHidden ? "숨김" : "노출"}<span aria-hidden="true" className="text-[10px] opacity-70">⇄</span>
    </button>
  );
}

function StockCell({ stock }: { stock: number }) {
  const status = stockStatus(stock);
  return (
    <span className="whitespace-nowrap text-sm">
      {stock}개{status && <span className={`ml-1.5 text-xs font-bold ${status.className}`}>{status.label}</span>}
    </span>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 text-xs font-bold sm:min-h-9 ${active ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"}`}
    >
      {label}
    </button>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="상품 목록 불러오는 중">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
