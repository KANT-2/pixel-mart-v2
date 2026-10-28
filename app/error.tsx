"use client";

import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";

// 기술적인 오류 내용(error.message)은 화면에 보여 주지 않는다 — 원인은 서버·브라우저 로그로 확인
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <GameOverScreen headline="ERROR!" title="화면을 불러오지 못했어요" message="잠시 후 다시 시도해 주세요. 계속되면 홈에서 다시 시작해 주세요.">
    <button type="button" onClick={() => retry()}className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 다시 시도 CONTINUE</button>
    <Link href="/" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">홈으로</Link>
  </GameOverScreen>;
}
