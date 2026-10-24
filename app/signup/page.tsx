import type { Metadata } from "next";
import { Suspense } from "react";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "회원가입 | PIXEL MART" };

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  return <SignupForm next={typeof params.next === "string" ? params.next : undefined} />;
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
    <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">NEW PLAYER</p>
    <h1 className="text-3xl font-extrabold">플레이어 등록</h1>
    <p className="mb-8 mt-3 text-sm text-sub">PIXEL MART에서 쓸 계정과 닉네임을 정해 주세요. 닉네임은 다른 플레이어와 겹치지 않아야 해요.</p>
    <Suspense fallback={<div role="status" aria-label="가입 화면 준비 중" className="h-96 animate-pulse rounded-xl bg-panel" />}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  </section>;
}
