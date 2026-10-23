import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다

interface AdminPaginationProps {
  currentPage: number; // 지금 보고 있는 쪽
  totalPages: number; // 전체 쪽수
  basePath: string; // 목록 경로 (예: "/admin/orders")
  query?: Record<string, string | undefined>; // 페이지를 넘겨도 같이 유지할 다른 쿼리 (예: { status: "paid" })
}

// 1 … 4 5 6 7 8 … 15 — 현재 페이지 앞뒤로 5칸을 이어서 보여 주고, 처음·끝은 항상 보인다 (components/Pagination.tsx와 같은 방식)
const WINDOW = 5;
function getPageNumbers(current: number, total: number): (number | "…")[] {
  const from = Math.max(1, Math.min(current - Math.floor(WINDOW / 2), total - WINDOW + 1));
  const to = Math.min(total, from + WINDOW - 1);
  const pages: (number | "…")[] = [];
  if (from > 1) pages.push(1);
  if (from > 2) pages.push(from === 3 ? 2 : "…");
  for (let page = from; page <= to; page++) pages.push(page);
  if (to < total - 1) pages.push(to === total - 2 ? total - 1 : "…");
  if (to < total) pages.push(total);
  return pages;
}

// 주문·취소요청 목록 공용 페이지 이동 — 상태 필터 등 다른 쿼리는 유지한 채 page만 바꾼다
export default function AdminPagination({ currentPage, totalPages, basePath, query = {} }: AdminPaginationProps) {
  if (totalPages <= 1) return null; // 쪽이 하나뿐이면 아무것도 보여 주지 않는다

  // page 쪽 번호에 맞는 주소를 만든다 — 1쪽이면 page 쿼리를 아예 뺀다
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value); // 비어 있지 않은 값만 유지한다
    }
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const baseClass = "grid h-11 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold sm:min-w-11";
  const stepClass = "flex h-11 items-center gap-1 rounded-lg px-3 text-sm font-bold";

  return (
    <nav aria-label="페이지 이동" className="mt-6 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {currentPage > 1 ? (
          <Link href={pageHref(currentPage - 1)} aria-label="이전 페이지" className={`${stepClass} btn-pixel text-sub hover:text-ink`}>
            ‹<span className="hidden sm:inline">이전</span>
          </Link>
        ) : (
          <span aria-hidden="true" className={`${stepClass} text-dim/40`}>
            ‹<span className="hidden sm:inline">이전</span>
          </span>
        )}

        {getPageNumbers(currentPage, totalPages).map((page, index) =>
          page === "…" ? (
            <span key={`gap-${index}`} className={`${baseClass} text-dim`}>
              …
            </span>
          ) : (
            <Link
              key={page}
              href={pageHref(page)}
              aria-current={page === currentPage ? "page" : undefined}
              className={`${baseClass} transition-colors ${page === currentPage ? "btn-lime text-lime-ink" : "btn-pixel text-sub hover:text-ink"}`}
            >
              {page}
            </Link>
          ),
        )}

        {currentPage < totalPages ? (
          <Link href={pageHref(currentPage + 1)} aria-label="다음 페이지" className={`${stepClass} btn-pixel text-sub hover:text-ink`}>
            <span className="hidden sm:inline">다음</span>›
          </Link>
        ) : (
          <span aria-hidden="true" className={`${stepClass} text-dim/40`}>
            <span className="hidden sm:inline">다음</span>›
          </span>
        )}
      </div>
      <p className="text-xs text-dim">
        <span className="font-bold text-sub">{currentPage}</span> / {totalPages} 페이지
      </p>
    </nav>
  );
}
