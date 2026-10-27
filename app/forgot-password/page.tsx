import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = { title: "비밀번호 찾기 | PIXEL MART" };

export default function ForgotPasswordPage() {
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
    <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">LOST KEY</p>
    <h1 className="text-3xl font-extrabold">비밀번호 찾기</h1>
    <p className="mb-8 mt-3 text-sm text-sub">가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내 드려요.</p>
    <ForgotPasswordForm />
  </section>;
}
