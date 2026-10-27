import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  back?: { href: string; label: string };
  kicker: string; // 영문 장식 라벨 (font-pixel)
  title: string;
  description?: ReactNode;
  actions?: ReactNode; // 제목 오른쪽 버튼
}

/** 마이페이지·주문 화면 공통 머리말 — 뒤로 가기 · 장식 라벨 · 제목 · 설명을 같은 간격으로 */
export default function PageHeader({ back, kicker, title, description, actions }: PageHeaderProps) {
  return <header className="mb-8">
    {back && <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true">←</span>{back.label}
    </Link>}
    <div className={`flex flex-wrap items-end justify-between gap-4 ${back ? "mt-5" : ""}`}>
      <div className="min-w-0">
        <p className="stage-kicker mb-2 font-pixel text-sm text-mint" aria-hidden="true">{kicker}</p>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {description && <p className="mt-3 text-sm leading-relaxed text-sub">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  </header>;
}
