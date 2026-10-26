"use client"; // 주소창 쿼리를 읽고 바꿔야 하니 클라이언트 컴포넌트로 만든다

import { useRouter, useSearchParams } from "next/navigation"; // 쿼리 읽기·이동

interface StatusOption {
  value: string; // 쿼리에 들어갈 값 (예: "paid")
  label: string; // 화면에 보이는 한글 이름 (예: "결제완료")
  count?: number; // 칩 안에 작게 보여줄 건수 — 안 넘기면 숫자를 안 보여준다
}

interface StatusFilterProps {
  options: StatusOption[]; // 상태 선택지 — 주문/취소요청마다 다르게 넘겨준다
  basePath: string; // 필터가 걸릴 목록 경로 (예: "/admin/orders")
  totalCount?: number; // "전체" 칩에 보여줄 건수 — 안 넘기면 숫자를 안 보여준다
}

// 상태별로 목록을 걸러 보는 공용 필터 — 주문(AdminOrderStatus)·취소요청(AdminCancelStatus) 모두에서 재사용한다
export default function StatusFilter({ options, basePath, totalCount }: StatusFilterProps) {
  const router = useRouter(); // 주소 이동
  const searchParams = useSearchParams(); // 지금 주소의 쿼리
  const current = searchParams.get("status") ?? ""; // 선택된 상태 — 없으면 "전체"

  // 상태를 바꾸면 해당 쿼리로 이동한다. 필터가 바뀌었으니 페이지는 1쪽으로 되돌린다
  function change(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("status", value); // 값이 있으면 쿼리에 넣는다
    else params.delete("status"); // "전체"면 쿼리에서 지운다
    params.delete("page"); // 필터가 바뀌면 1쪽부터 다시 본다
    const search = params.toString();
    router.push(search ? `${basePath}?${search}` : basePath, { scroll: false });
  }

  return (
    // 칩 사이 간격이 있는 알약(pill) 모양 — 전역 .segmented(막대 모양)는 다른 화면도 같이 쓰므로 안 건드리고, 여기서만 모양을 새로 만든다
    <div role="group" aria-label="상태 필터" className="flex flex-wrap gap-2">
      {/* 전체 버튼 — 값이 비어 있으면 선택된 상태 */}
      <PillButton pressed={current === ""} onClick={() => change("")} label="전체" count={totalCount} />
      {options.map((option) => (
        <PillButton key={option.value} pressed={current === option.value} onClick={() => change(option.value)} label={option.label} count={option.count} />
      ))}
    </div>
  );
}

// 칩 하나 — 선택 상태면 연두 채움, 아니면 어두운 테두리만
function PillButton({ pressed, onClick, label, count }: { pressed: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 text-sm font-bold ${
        pressed ? "border-lime bg-lime text-lime-ink" : "border-line text-sub hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 text-xs ${pressed ? "bg-black/10" : "bg-panel-2 text-dim"}`}>{count}</span>
      )}
    </button>
  );
}
