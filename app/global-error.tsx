"use client";

import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";
import "./globals.css";

// 루트 레이아웃(헤더·로그인 상태)까지 깨졌을 때 — 레이아웃을 대신하므로 html·body를 직접 그린다
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="ko" className="h-full">
    <body className="flex min-h-full flex-col bg-night font-sans text-ink antialiased">
      <main className="flex-1">
        <GameOverScreen headline="ERROR!" title="잠시 문제가 생겼어요" message="다시 시도해도 안 되면 잠시 뒤에 홈에서 다시 시작해 주세요.">
          <button type="button" onClick={() => retry()} className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 다시 시도 CONTINUE</button>
          <Link href="/" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">홈으로</Link>
        </GameOverScreen>
      </main>
    </body>
  </html>;
}
