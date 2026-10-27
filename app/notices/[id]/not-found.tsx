import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";

export default function NoticeNotFound() {
  return <GameOverScreen headline="GAME OVER" code="404" title="공지를 찾을 수 없습니다" message="삭제됐거나 숨김 처리된 공지예요.">
    <Link href="/notices" className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 공지 목록으로</Link>
    <Link href="/" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">홈으로</Link>
  </GameOverScreen>;
}
