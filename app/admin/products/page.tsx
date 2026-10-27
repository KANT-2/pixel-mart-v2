import { Suspense } from "react"; // useSearchParams를 쓰는 클라이언트 화면은 Suspense로 감싸야 한다
import ProductsScreen from "@/app/admin/products/ProductsScreen";
import { getCategories } from "@/lib/products"; // 손님 화면과 같은 공개 카테고리 — 등록·수정 폼의 분류 select에 쓴다

// 상품 목록(재고·숨김 등)은 로그인한 관리자만 보는 데이터라 ProductsScreen(클라이언트)에서 lib/admin.ts로 불러온다.
// 분류(카테고리)는 공개 데이터라 서버에서 미리 가져와 내려준다 — 백엔드가 꺼져도 폴백 목록으로 폼이 동작한다.
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <CategoriesBoundary />
    </Suspense>
  );
}

async function CategoriesBoundary() {
  const { data: categories } = await getCategories();
  return <ProductsScreen categories={categories} />;
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
