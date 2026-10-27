import { api } from "@/lib/api";
import { REPORT_REASONS, REPORT_TARGET_LABEL, type ReportReason, type ReportTargetType } from "@/lib/reports";
import type { Page } from "@/types/api";

/** 관리자 신고함 한 줄 — 대상 하나에 한 줄, id · memo · 신고자는 가장 최근 신고 (#87 AdminReportOut) */
export interface ApiAdminReport {
  id: number;
  targetType: ReportTargetType;
  targetId: number;
  /** 신고된 글 앞부분 (아바타면 그림 주소) */
  targetPreview: string;
  reason: ReportReason;
  memo: string;
  reporterNickname: string;
  reportCount: number;
  status: AdminReportStatus;
  createdAt: string;
}

export type AdminReportStatus = "open" | "resolved" | "dismissed";
export type AdminReportAction = "hide" | "dismiss";
export interface AdminReportQuery { status: AdminReportStatus; type: ReportTargetType | null; page: number; }

export const ADMIN_REPORTS_PATH = "/admin/reports";
export const ADMIN_REPORT_PAGE_SIZE = 20;

// 상태 탭 — 처음 들어오면 "처리 대기"(관리자가 처리할 것부터)
export const statusOptions: { value: AdminReportStatus; label: string }[] = [
  { value: "open", label: "처리 대기" },
  { value: "resolved", label: "숨김 처리" },
  { value: "dismissed", label: "그대로 둠" },
];

// 종류 칩 — 서버 TargetType 순서
export const typeOptions: { value: ReportTargetType; label: string }[] = (["question", "review", "trade", "avatar"] as const)
  .map((value) => ({ value, label: REPORT_TARGET_LABEL[value] }));

const STATUSES = statusOptions.map((option) => option.value);
const TYPES = typeOptions.map((option) => option.value);

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** 주소창 쿼리(?status=&type=&page=)를 안전한 값으로 — 이상한 값은 기본값으로 */
export function parseAdminReportQuery(params: RawParams): AdminReportQuery {
  const rawStatus = first(params.status);
  const rawType = first(params.type);
  const page = Number(first(params.page));
  return {
    status: STATUSES.find((value) => value === rawStatus) ?? "open",
    type: TYPES.find((value) => value === rawType) ?? null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** 화면 주소 — 기본값(처리 대기 · 전체 종류 · 1쪽)은 빼서 짧게 */
export function adminReportsHref({ status = "open", type = null, page = 1 }: Partial<AdminReportQuery>) {
  const params = new URLSearchParams();
  if (status !== "open") params.set("status", status);
  if (type) params.set("type", type);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${ADMIN_REPORTS_PATH}?${search}` : ADMIN_REPORTS_PATH;
}

/** 서버 API 주소 — 서버는 종류를 targetType으로 받는다 */
export function adminReportsApiPath({ status, type, page }: AdminReportQuery) {
  const params = new URLSearchParams({ status });
  if (type) params.set("targetType", type);
  params.set("page", String(page));
  params.set("size", String(ADMIN_REPORT_PAGE_SIZE));
  return `/admin/reports?${params}`;
}

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

// 관리자 신고 API (#87) — 관리자가 아니면 서버가 404, 이미 처리된 신고는 409
export const adminReportsApi = {
  list: (query: AdminReportQuery, signal?: AbortSignal) => api.get<Page<ApiAdminReport>>(adminReportsApiPath(query), options(signal)),
  resolve: (reportId: number, action: AdminReportAction) =>
    api.post<ApiAdminReport>(`/admin/reports/${reportId}/resolve`, { action }, options()),
};

export const reasonLabel = (reason: string) => REPORT_REASONS.find((item) => item.value === reason)?.label ?? "기타";
export const targetLabel = (type: ReportTargetType) => REPORT_TARGET_LABEL[type] ?? "글";
export const statusLabel = (status: string) => statusOptions.find((item) => item.value === status)?.label ?? status;

/** 확인 창 문구 — 숨기면 손님 화면에서 바로 사라지니 무엇이 일어나는지 먼저 알려 준다 */
export function confirmText(report: Pick<ApiAdminReport, "targetType" | "reportCount">, action: AdminReportAction) {
  const label = targetLabel(report.targetType);
  const together = report.reportCount > 1 ? ` 같은 ${label}에 들어온 신고 ${report.reportCount}건이 함께 처리돼요.` : "";
  if (action === "hide") {
    if (report.targetType === "avatar") {
      return { title: "이 아바타를 기본 모습으로 바꿀까요?", description: `아바타가 바로 기본 모습으로 바뀌고, 주인에게 알림이 가요.${together}`, confirm: "기본으로 바꾸기" };
    }
    return { title: `이 ${label}을(를) 숨길까요?`, description: `손님 화면에서 바로 사라지고, 작성자에게 알림이 가요.${together}`, confirm: "숨기기" };
  }
  return { title: "신고를 그대로 둘까요?", description: `${label}은(는) 그대로 보이고, 신고한 사람에게 처리 결과 알림이 가요.${together}`, confirm: "그대로 두기" };
}

/** 처리 뒤 안내 문구 */
export function doneText(report: Pick<ApiAdminReport, "targetType">, action: AdminReportAction) {
  if (action === "dismiss") return "신고를 그대로 두었어요.";
  return report.targetType === "avatar" ? "아바타를 기본 모습으로 바꿨어요." : `${targetLabel(report.targetType)}을(를) 숨겼어요.`;
}

/** 빈 목록 안내 */
export function emptyMessage({ status, type }: Pick<AdminReportQuery, "status" | "type">) {
  const what = type ? `${targetLabel(type)} ` : "";
  if (status === "open") return { title: `처리할 ${what}신고가 없어요`, body: "손님이 신고하면 여기에 보여요." };
  if (status === "resolved") return { title: `숨김 처리한 ${what}신고가 없어요`, body: "신고를 숨김 처리하면 여기에 모여요." };
  return { title: `그대로 둔 ${what}신고가 없어요`, body: "신고를 그대로 두면 여기에 모여요." };
}
