import Link from "next/link";

export interface LegalSection { title: string; items: string[]; }

interface LegalDocumentProps {
  kicker: string; // 위쪽 픽셀 글씨 (예: TERMS)
  title: string;
  intro: string;
  updated: string; // 시행일
  sections: LegalSection[];
  other: { href: string; label: string }; // 함께 볼 문서
}

/** 이용약관 · 개인정보처리방침 공용 틀 (#108) — 조항 목록 + 목차 */
export default function LegalDocument({ kicker, title, intro, updated, sections, other }: LegalDocumentProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">{kicker}</p>
        <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">{intro}</p>
        <p className="mt-4 rounded-lg border border-line bg-panel px-4 py-3 text-xs leading-relaxed text-dim">
          PIXEL MART는 교육용 프로젝트예요. 실제 판매·결제가 이루어지지 않으며, 이 문서는 서비스 동작을 설명하기 위한 예시예요. · 시행일 {updated}
        </p>
      </header>

      <nav aria-label="목차" className="mb-8 pixel-panel p-5">
        <p className="mb-3 font-pixel text-xs tracking-widest text-violet">▶ CONTENTS</p>
        <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#section-${index + 1}`} className="text-sub underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-6">
        {sections.map((section, index) => (
          <section key={section.title} id={`section-${index + 1}`} aria-labelledby={`section-${index + 1}-title`} className="scroll-mt-24 pixel-panel p-5 sm:p-6">
            <h2 id={`section-${index + 1}-title`} className="text-lg font-bold">
              <span className="mr-2 font-pixel text-mint">{String(index + 1).padStart(2, "0")}</span>{section.title}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-sub marker:text-dim">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={other.href} className="btn-pixel px-4 py-3 text-sm font-bold">{other.label} 보기</Link>
        <Link href="/help" className="btn-pixel px-4 py-3 text-sm font-bold">고객센터</Link>
      </div>
    </div>
  );
}
