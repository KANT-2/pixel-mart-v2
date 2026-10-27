from datetime import datetime
from typing import Protocol

from src.reports.domain.exceptions import AlreadyReported, ReportAlreadyHandled, ReportNotFound, ReportTargetNotFound
from src.reports.domain.report import (
    Action,
    Reason,
    ReportRow,
    ReportTarget,
    TargetType,
    check_can_report,
    hidden_notice,
    resolved_status,
)


class Reports(Protocol):
    async def target(self, target_type: TargetType, target_id: int) -> ReportTarget | None: ...
    async def has_open(self, reporter_id: int, target_type: TargetType, target_id: int) -> bool: ...
    async def add(
        self, reporter_id: int, target_type: TargetType, target_id: int, reason: Reason, memo: str
    ) -> int: ...
    async def report_status(self, report_id: int) -> tuple[TargetType, int, str] | None: ...
    async def hide(self, target: ReportTarget) -> None: ...
    async def close_open(
        self, target_type: TargetType, target_id: int, status: str, admin_id: int, now: datetime
    ) -> list[int]: ...
    async def notify_owner(self, target: ReportTarget, title: str, href: str, ref_key: str) -> None: ...
    async def notify_reporter(self, reporter_id: int, hidden: bool, ref_key: str) -> None: ...
    async def row(self, report_id: int) -> ReportRow: ...
    async def list_grouped(
        self, status: str, target_type: TargetType | None, offset: int, limit: int
    ) -> tuple[list[ReportRow], int]: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class ReportService:
    def __init__(self, reports: Reports, tx: Transaction) -> None:
        self.reports = reports
        self.tx = tx

    async def report(self, reporter_id: int, target_type: TargetType, target_id: int, reason: Reason, memo: str) -> int:
        target = await self.reports.target(target_type, target_id)
        if target is None:
            raise ReportTargetNotFound()
        check_can_report(target, reporter_id)
        if await self.reports.has_open(reporter_id, target_type, target_id):
            raise AlreadyReported()
        try:
            report_id = await self.reports.add(reporter_id, target_type, target_id, reason, memo)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return report_id

    async def list_reports(
        self, status: str, target_type: TargetType | None, page: int, size: int
    ) -> tuple[list[ReportRow], int]:
        return await self.reports.list_grouped(status, target_type, (page - 1) * size, size)

    async def resolve(self, report_id: int, action: Action, admin_id: int, now: datetime) -> ReportRow:
        """숨김(hide)이면 대상을 숨기고 주인에게 알림. 같은 대상의 열린 신고는 모두 같이 처리하고 신고자들에게 알림."""
        found = await self.reports.report_status(report_id)
        if found is None:
            raise ReportNotFound()
        target_type, target_id, status = found
        if status != "open":
            raise ReportAlreadyHandled()
        ref_key = f"report:{report_id}"
        try:
            target = await self.reports.target(target_type, target_id)
            if action == "hide" and target is not None:
                await self.reports.hide(target)
                title, href = hidden_notice(target)
                await self.reports.notify_owner(target, title, href, ref_key)
            reporters = await self.reports.close_open(target_type, target_id, resolved_status(action), admin_id, now)
            for reporter_id in reporters:
                await self.reports.notify_reporter(reporter_id, action == "hide", ref_key)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return await self.reports.row(report_id)
