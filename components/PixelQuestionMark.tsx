interface PixelQuestionMarkProps {
  className?: string;
}

// FAQ 메뉴용 픽셀 물음표 — 8x11 격자를 그대로 1x1 rect로 그린다 (칸마다 3px → 24x33)
export default function PixelQuestionMark({ className = "" }: PixelQuestionMarkProps) {
  return (
    <svg viewBox="0 0 8 11" width="24" height="33" shapeRendering="crispEdges" aria-hidden="true"
      className={`inline-block [image-rendering:pixelated] ${className}`}>
      <g fill="currentColor">
        <rect x="2" y="0" width="4" height="1" />
        <rect x="1" y="1" width="6" height="1" />
        <rect x="0" y="2" width="2" height="1" />
        <rect x="6" y="2" width="2" height="1" />
        <rect x="0" y="3" width="2" height="1" />
        <rect x="6" y="3" width="2" height="1" />
        <rect x="6" y="4" width="2" height="1" />
        <rect x="5" y="5" width="2" height="1" />
        <rect x="3" y="6" width="3" height="1" />
        <rect x="3" y="7" width="2" height="1" />
        <rect x="3" y="9" width="2" height="1" />
        <rect x="3" y="10" width="2" height="1" />
      </g>
    </svg>
  );
}
