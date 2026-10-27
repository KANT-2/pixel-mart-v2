import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = { title: "새 비밀번호 | PIXEL MART" };

async function ResetContent({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const params = await searchParams;
  return <ResetPasswordForm token={typeof params.token === "string" && params.token ? params.token : null} />;
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
    <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">NEW KEY</p>
    <h1 className="text-3xl font-extrabold">새 비밀번호</h1>
    <p className="mb-8 mt-3 text-sm text-sub">링크는 30분 동안, 한 번만 쓸 수 있어요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-xl bg-panel" />}>
      <ResetContent searchParams={searchParams} />
    </Suspense>
  </section>;
}
