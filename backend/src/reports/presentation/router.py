from datetime import UTC, datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from app.deps import ActiveUser, AdminUser, DbSession
from app.schemas.common import Page
from src.common.pagination import Pagination
from src.reports.application.service import ReportService
from src.reports.domain.report import TargetType
from src.reports.infrastructure.repositories import ReportRepository
from src.reports.presentation.schemas import AdminReportOut, ReportCreatedOut, ReportIn, ResolveIn

router = APIRouter(prefix="/reports", tags=["reports"])
admin_router = APIRouter(prefix="/admin/reports", tags=["admin"])


def _service(db: DbSession) -> ReportService:
    return ReportService(ReportRepository(db), db)


@router.post("", response_model=ReportCreatedOut, status_code=status.HTTP_201_CREATED, summary="신고하기")
async def create_report(body: ReportIn, user: ActiveUser, db: DbSession):
    report_id = await _service(db).report(user.id, body.target_type, body.target_id, body.reason, body.memo)
    return ReportCreatedOut(id=report_id)


@admin_router.get("", response_model=Page[AdminReportOut], summary="[관리자] 신고함 (대상별로 묶어 신고 많은 순)")
async def list_reports(
    _admin: AdminUser,
    db: DbSession,
    pagination: Pagination,
    status_: Annotated[Literal["open", "resolved", "dismissed"], Query(alias="status")] = "open",
    target_type: Annotated[TargetType | None, Query(alias="targetType")] = None,
):
    rows, total = await _service(db).list_reports(status_, target_type, pagination.page, pagination.size)
    return Page[AdminReportOut](
        items=[AdminReportOut.from_domain(r) for r in rows],
        total=total,
        page=pagination.page,
        size=pagination.size,
        total_pages=max(1, ceil(total / pagination.size)),
    )


@admin_router.post("/{report_id}/resolve", response_model=AdminReportOut, summary="[관리자] 신고 처리 (숨김 · 그대로)")
async def resolve_report(report_id: int, body: ResolveIn, admin: AdminUser, db: DbSession):
    row = await _service(db).resolve(report_id, body.action, admin.id, datetime.now(UTC))
    return AdminReportOut.from_domain(row)
