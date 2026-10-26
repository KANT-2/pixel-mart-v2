"use client"; // 로그인 상태(useAuth)를 읽어야 하니 클라이언트 컴포넌트로 만든다

import Link from "next/link"; // 화면 이동은 next/link의 Link만 쓴다
import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider"; // 로그인 상태를 알려 주는 공용 훅

interface AdminGuardProps {
  children: ReactNode; // 관리자 확인이 끝나면 보여 줄 실제 화면
}

// /admin 아래 화면을 감싸서 "로딩 / 비로그인 / 권한 없음 / 관리자" 4가지 상태를 보여 준다
export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth(); // 로그인 여부와 확인 중인지를 가져온다

  // 1) 로그인 확인이 아직 끝나지 않았으면 스켈레톤을 보여 준다
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        <div className="h-8 w-40 animate-pulse rounded bg-panel" />
        <div className="h-32 w-full animate-pulse rounded bg-panel" />
      </div>
    );
  }

  // 2) 로그인이 안 되어 있으면 로그인 안내를 보여 준다
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-center">
        <p className="text-lg font-bold text-ink">관리자만 들어올 수 있어요</p>
        <p className="mt-1 text-sm text-sub">로그인 후 다시 시도해 주세요.</p>
        <Link href="/login?next=/admin" className="btn-lime mt-4 inline-block px-4 py-2 text-sm font-bold">
          로그인하러 가기
        </Link>
      </div>
    );
  }

  // role이 "admin"이 아니면(값이 없는 경우 포함) 권한 없음으로 본다 — role은 선택값이라 옵셔널 체이닝으로 읽는다
  const isNotAdmin = user?.role !== "admin";

  // 3) 로그인은 했지만 관리자가 아니면 권한 없음 안내를 보여 준다
  if (isNotAdmin) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-center">
        <p className="text-lg font-bold text-ink">권한이 없어요</p>
        <p className="mt-1 text-sm text-sub">관리자만 볼 수 있는 화면이에요.</p>
        <Link href="/" className="btn-pixel mt-4 inline-block px-4 py-2 text-sm font-bold">
          홈으로 가기
        </Link>
      </div>
    );
  }

  // 4) 관리자면 실제 화면을 보여 준다
  return <>{children}</>;
}
