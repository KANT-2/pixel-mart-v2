import PixelAvatar from "@/components/avatar/PixelAvatar";
import { formatDate } from "@/utils/formatDate";
import { reasonLabel, statusLabel, targetLabel, type AdminReportAction, type ApiAdminReport } from "./adminReports";

interface AdminReportCardProps {
  report: ApiAdminReport;
  busy: boolean; // 다른 신고를 처리하는 중이면 버튼을 잠근다
  onAction: (action: AdminReportAction) => void; // 확인 창은 목록(AdminReportsBoard)이 띄운다
}

// 신고 한 줄(대상 하나) — 종류 · 신고 수 · 신고된 내용 · 최근 사유와 메모, 처리 대기면 [그대로 두기] [숨기기]
export default function AdminReportCard({ report, busy, onAction }: AdminReportCardProps) {
  const open = report.status === "open";
  const avatar = report.targetType === "avatar";
  return <li className="min-w-0 pixel-panel p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="rounded border border-line px-2 py-1 font-bold text-sub">{targetLabel(report.targetType)}</span>
        <span className={`rounded border px-2 py-1 font-bold ${report.reportCount > 1 ? "border-pink/50 text-pink" : "border-line text-dim"}`}>신고 {report.reportCount}건</span>
        {!open && <span className={`rounded border px-2 py-1 ${report.status === "resolved" ? "border-pink/30 text-pink" : "border-mint/30 text-mint"}`}>{statusLabel(report.status)}</span>}
      </div>
      <time dateTime={report.createdAt} className="text-dim">{formatDate(report.createdAt)}</time>
    </div>

    {/* 신고된 내용 — 아바타는 그림, 나머지는 글 앞부분 */}
    {avatar ? <div className="mt-3 flex items-center gap-3">
      <PixelAvatar src={report.targetPreview} alt="신고된 아바타" className="size-16 shrink-0 rounded border border-line bg-night" />
      <p className="text-xs text-dim">사용자 #{report.targetId}의 아바타</p>
    </div> : <blockquote className="mt-3 border-l-2 border-line pl-3">
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink">{report.targetPreview || "(내용 없음)"}</p>
      <p className="mt-1 text-xs text-dim">{targetLabel(report.targetType)} #{report.targetId}</p>
    </blockquote>}

    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-dim">최근 사유</dt>
      <dd className="min-w-0 break-words text-sub">{reasonLabel(report.reason)} · {report.reporterNickname}</dd>
      {report.memo && <>
        <dt className="text-dim">메모</dt>
        <dd className="min-w-0 whitespace-pre-line break-words text-sub">{report.memo}</dd>
      </>}
    </dl>

    {open && <div className="mt-4 flex flex-wrap justify-end gap-2">
      <button type="button" disabled={busy} onClick={() => onAction("dismiss")} className="min-h-11 btn-pixel px-4 text-sm font-bold text-sub disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-mint">그대로 두기</button>
      <button type="button" disabled={busy} onClick={() => onAction("hide")} className="min-h-11 btn-pixel border-pink px-4 text-sm font-bold text-pink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-mint">{avatar ? "기본으로 바꾸기" : "숨기기"}</button>
    </div>}
  </li>;
}
