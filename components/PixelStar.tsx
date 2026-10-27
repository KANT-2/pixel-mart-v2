// 공지의 "중요(고정)" 표시용 픽셀 별 아이콘.
// components/PixelIcon.tsx의 기존 별(hero-star.svg)과 같은 5x5 픽셀 사각형 격자 방식이지만,
// 그 파일은 흰색으로 고정돼 있어 재사용할 수 없어서(상품 등급 금색과도 겹치면 안 됨) 라임색으로 새로 만들었다.
interface PixelStarProps {
  className?: string;
  /** false면 sr-only 글자·title을 안 붙인다 — 바로 옆에 "중요 공지" 글자가 이미 보일 때(상세 화면) 중복 안내를 막는다 */
  withLabel?: boolean;
}

export default function PixelStar({ className = "size-4", withLabel = true }: PixelStarProps) {
  const icon = (
    // 5점 별 실루엣(픽셀 격자 7x7) — 검은 테두리·음영·눈 없이 라임색 단색으로, 작은 아이콘 크기에서도 별 모양이 보이게 단순화했다
    <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={`inline-block motion-safe:animate-pulse [image-rendering:pixelated] ${className}`}>
      <g fill="var(--color-lime)">
        <rect x="3" y="0" width="1" height="1" />
        <rect x="2" y="1" width="3" height="1" />
        <rect x="1" y="2" width="5" height="1" />
        <rect x="0" y="3" width="7" height="1" />
        <rect x="2" y="4" width="3" height="1" />
        <rect x="1" y="5" width="2" height="1" />
        <rect x="4" y="5" width="2" height="1" />
        <rect x="0" y="6" width="2" height="1" />
        <rect x="5" y="6" width="2" height="1" />
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
