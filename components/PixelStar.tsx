// 공지의 "중요(고정)" 표시용 픽셀 별 아이콘.
// "소원 성취" 뱃지(tools/gen_badges.py의 STAR 도트, public/images/badges)와 같은 별 모양을 가져오되,
// 뱃지는 외곽선·명암·분홍 눈 포인트가 있는 여러 색이라 여기서는 그 칸을 전부 라임 단색으로 합치고, 눈(P) 자리도 구멍처럼 보이지 않게 같이 채웠다.
interface PixelStarProps {
  className?: string;
  /** false면 sr-only 글자·title을 안 붙인다 — 바로 옆에 "중요 공지" 글자가 이미 보일 때(상세 화면) 중복 안내를 막는다 */
  withLabel?: boolean;
}

export default function PixelStar({ className = "h-4 w-auto", withLabel = true }: PixelStarProps) {
  const icon = (
    // 뱃지 STAR 도트(16x14)를 그대로 쓰되 단색·눈 없이 — 작은 아이콘 크기에서도 별 모양이 또렷하게 보인다
    <svg viewBox="0 0 16 14" shapeRendering="crispEdges" aria-hidden="true" className={`inline-block motion-safe:animate-pulse [image-rendering:pixelated] ${className}`}>
      <g fill="var(--color-lime)">
        <rect x="7" y="0" width="2" height="1" />
        <rect x="6" y="1" width="4" height="1" />
        <rect x="6" y="2" width="4" height="1" />
        <rect x="5" y="3" width="6" height="1" />
        <rect x="0" y="4" width="16" height="1" />
        <rect x="0" y="5" width="16" height="1" />
        <rect x="1" y="6" width="14" height="1" />
        <rect x="2" y="7" width="12" height="1" />
        <rect x="3" y="8" width="10" height="1" />
        <rect x="3" y="9" width="10" height="1" />
        <rect x="2" y="10" width="12" height="1" />
        <rect x="2" y="11" width="5" height="1" />
        <rect x="9" y="11" width="5" height="1" />
        <rect x="1" y="12" width="4" height="1" />
        <rect x="11" y="12" width="4" height="1" />
        <rect x="1" y="13" width="3" height="1" />
        <rect x="12" y="13" width="3" height="1" />
      </g>
    </svg>
  );

  if (!withLabel) return icon;

  return (
    <span className="inline-flex shrink-0" title="중요 공지">
      {icon}
      <span className="sr-only">중요 공지</span>
    </span>
  );
}
