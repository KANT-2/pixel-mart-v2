interface PixelCloseIconProps {
  className?: string;
}

// 닫기(X)용 픽셀 아이콘 — 7x7 격자를 그대로 1x1 rect로 그린다 (칸마다 3px → 21x21)
export default function PixelCloseIcon({ className = "" }: PixelCloseIconProps) {
  return (
    <svg viewBox="0 0 7 7" width="21" height="21" shapeRendering="crispEdges" aria-hidden="true"
      className={`inline-block [image-rendering:pixelated] ${className}`}>
      <g fill="currentColor">
        <rect x="0" y="0" width="2" height="1" />
        <rect x="5" y="0" width="2" height="1" />
        <rect x="0" y="1" width="3" height="1" />
        <rect x="4" y="1" width="3" height="1" />
        <rect x="1" y="2" width="5" height="1" />
        <rect x="2" y="3" width="3" height="1" />
        <rect x="1" y="4" width="5" height="1" />
        <rect x="0" y="5" width="3" height="1" />
        <rect x="4" y="5" width="3" height="1" />
        <rect x="0" y="6" width="2" height="1" />
        <rect x="5" y="6" width="2" height="1" />
      </g>
    </svg>
  );
}
