"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/** 로그인이 필요한 화면 위쪽 안내 — 로그아웃·만료면 "다시 로그인해 주세요."를 함께 보여 준다 */
export default function LoginRequiredNotice({ next, message }: { next: string; message: string }) {
  const { user, loading, notice } = useAuth();
  if (loading || user) return null;
  return <div role="status" className="mb-6 pixel-panel p-5 text-left">
    {notice && <p className="mb-1 text-sm font-semibold text-pink">{notice}</p>}
    <p className="text-sm text-sub">{message}</p>
    <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-lime mt-4 inline-flex min-h-11 items-center px-5 font-bold text-lime-ink">로그인</Link>
  </div>;
}
