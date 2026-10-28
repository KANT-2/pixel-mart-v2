/** 수정 버튼용 한 색 픽셀 연필(밑줄 포함) — 글자색(currentColor)을 따라간다 */
export default function PencilIcon({ className = "size-4" }: { className?: string }) {
  return <svg viewBox="0 0 10 10" aria-hidden="true" shapeRendering="crispEdges" className={`shrink-0 ${className}`}><path fill="currentColor" d="M1 5h1v1h-1zM1 6h1v1h-1zM1 7h1v1h-1zM1 9h1v1h-1zM2 4h1v1h-1zM2 5h1v1h-1zM2 6h1v1h-1zM2 7h1v1h-1zM2 9h1v1h-1zM3 3h1v1h-1zM3 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM3 7h1v1h-1zM3 9h1v1h-1zM4 2h1v1h-1zM4 3h1v1h-1zM4 4h1v1h-1zM4 5h1v1h-1zM4 6h1v1h-1zM4 9h1v1h-1zM5 1h1v1h-1zM5 2h1v1h-1zM5 3h1v1h-1zM5 4h1v1h-1zM5 5h1v1h-1zM5 9h1v1h-1zM6 0h1v1h-1zM6 1h1v1h-1zM6 3h1v1h-1zM6 4h1v1h-1zM7 0h1v1h-1zM7 1h1v1h-1zM7 2h1v1h-1zM7 3h1v1h-1zM7 9h1v1h-1zM8 1h1v1h-1zM8 2h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1z" /></svg>;
}
