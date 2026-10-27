import type { AdminLowStockProduct } from "@/types/admin";
import { rarityInfo, type Rarity } from "@/utils/gameItem"; // 등급 라벨·색은 기존 유틸을 읽기만 한다

interface LowStockListProps {
  products: AdminLowStockProduct[]; // 재고 10개 이하, 재고순 최대 20개(숨김 제외)
}

const LOW_STOCK_BAR_MAX = 10; // 재고 부족 기준 — 막대의 100% 기준(백엔드 LOW_STOCK_THRESHOLD와 같은 값)

// 남은 수량으로 긴급도 글자를 고른다 — 색만으로 구분하지 않도록 항상 글자와 같이 보여준다
function urgencyOf(stock: number): { label: string; className: string } {
  if (stock === 0) return { label: "품절", className: "text-pink" };
  if (stock <= 3) return { label: "곧 품절", className: "text-pink" };
  return { label: "주의", className: "text-sub" };
}

export default function LowStockList({ products }: LowStockListProps) {
  if (products.length === 0) {
    return (
      <section className="pixel-panel p-4">
        <h2 className="text-sm font-bold text-ink">재고 부족 상품</h2>
        <p className="mt-6 text-center text-sm text-dim">재고가 부족한 상품이 없어요</p>
      </section>
    );
  }

  const soldOut = products.filter((product) => product.stock === 0).length; // 품절 개수
  const urgent = products.filter((product) => product.stock <= 3).length; // 품절 포함, 3개 이하 개수

  return (
    <section className="pixel-panel p-4">
      <h2 className="text-sm font-bold text-ink">재고 부족 상품</h2>
      <p className="mt-1 text-xs text-sub">품절 {soldOut}개 · 3개 이하 {urgent}개 — 먼저 입고해 주세요</p>

      {/* 고정 높이 안에서 스크롤 — 키보드로도 스크롤할 수 있게 tabIndex를 둔다 */}
      <div
        tabIndex={0}
        role="region"
        aria-label="재고 부족 상품 목록"
        className="mt-3 max-h-[290px] space-y-2 overflow-y-auto pr-1 focus:outline-2 focus:outline-violet"
      >
        {products.map((product) => {
          const rarity = rarityInfo(product.rarity as Rarity); // 등급 라벨·색(백엔드가 4종 중 하나만 준다)
          const urgency = urgencyOf(product.stock);
          const barPercent = Math.min(100, (product.stock / LOW_STOCK_BAR_MAX) * 100);
          return (
            <div key={product.id} className="rounded-lg border border-line p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-ink">{product.name}</p>
                <span className="shrink-0 text-xs font-bold" style={{ color: rarity.color }}>{rarity.label}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                <span className={`font-bold ${urgency.className}`}>{urgency.label}</span>
                <span className="text-dim">남은 {product.stock}개</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full bg-pink" style={{ width: `${barPercent}%` }} />
              </div>
              {/* /admin/products가 아직 없어 눌러도 갈 곳이 없다 — 비활성 + 준비 중 표기 */}
              <button
                type="button"
                disabled
                title="상품 관리 화면이 아직 준비 중이에요"
                className="btn-pixel mt-2 min-h-9 w-full px-3 text-xs font-bold opacity-50"
              >
                입고하기 (준비 중)
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-dim">
        <span>총 {products.length}개</span>
        {/* 상품 관리 화면이 아직 없어 링크 대신 비활성 문구만 둔다 */}
        <span className="opacity-50">상품 관리에서 전체 보기 → (준비 중)</span>
      </div>
    </section>
  );
}
