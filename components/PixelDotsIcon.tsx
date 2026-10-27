interface PixelDotsIconProps {
  className?: string;
}

// 스피드 다이얼 메인 버튼(접힌 상태)용 세로 점 3개 — 2x8 격자를 그대로 1x1 rect로 그린다
export default function PixelDotsIcon({ className = "" }: PixelDotsIconProps) {
  return (
    <svg viewBox="0 0 2 8" width="6" height="24" shapeRendering="crispEdges" aria-hidden="true"
      className={`inline-block [image-rendering:pixelated] ${className}`}>
      <g fill="currentColor">
        <rect x="0" y="0" width="2" height="1" />
        <rect x="0" y="1" width="2" height="1" />
        <rect x="0" y="3" width="2" height="1" />
        <rect x="0" y="4" width="2" height="1" />
        <rect x="0" y="6" width="2" height="1" />
        <rect x="0" y="7" width="2" height="1" />
      </g>
    </svg>
  );
}
