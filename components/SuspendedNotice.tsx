"use client"; // 로그인한 내 계정 상태를 읽는다

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/** 이용이 정지된 계정이면 헤더 아래에 한 줄 안내 — 쓰기 버튼을 누르고 나서야 403을 보지 않게 (#88) */
export default function SuspendedNotice() {
  const { user } = useAuth();
  if (!user?.suspended) return null;
  return (
    <div role="status" className="border-b border-pink/40 bg-panel">
      <p className="mx-auto max-w-6xl px-4 py-2.5 text-sm text-pink">
        이용이 정지된 계정이에요. 상품 구경·주문은 할 수 있지만 거래글 · 교환 신청 · 선물 · 리뷰 · 문의는 쓸 수 없어요.{" "}
        <Link href="/help" className="underline underline-offset-4 hover:text-ink">고객센터</Link>
      </p>
    </div>
  );
}
