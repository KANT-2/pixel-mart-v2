"use client"; // 주소창 쿼리를 읽고 바꿔야 하니 클라이언트 컴포넌트로 만든다

import { useRouter, useSearchParams } from "next/navigation"; // 쿼리 읽기·이동

interface StatusOption {
  value: string; // 쿼리에 들어갈 값 (예: "paid")
  label: string; // 화면에 보이는 한글 이름 (예: "결제완료")
}

interface StatusFilterProps {
  options: StatusOption[]; // 상태 선택지 — 주문/취소요청마다 다르게 넘겨준다
  basePath: string; // 필터가 걸릴 목록 경로 (예: "/admin/orders")
}

// 상태별로 목록을 걸러 보는 공용 필터 — 주문(AdminOrderStatus)·취소요청(AdminCancelStatus) 모두에서 재사용한다
export default function StatusFilter({ options, basePath }: StatusFilterProps) {
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
    <div role="group" aria-label="상태 필터" className="segmented">
      {/* 전체 버튼 — 값이 비어 있으면 선택된 상태 */}
      <button type="button" aria-pressed={current === ""} onClick={() => change("")}>
        전체
      </button>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={current === option.value} onClick={() => change(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
