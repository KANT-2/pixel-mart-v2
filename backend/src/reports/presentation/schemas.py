from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from src.reports.domain.report import Reason, ReportRow, TargetType


class ReportIn(CamelModel):
    """신고하기 — 대상 · 사유 · 메모(0~200자). avatar의 targetId는 사용자 id"""

    target_type: TargetType
    target_id: int = Field(ge=1)
    reason: Reason
    memo: str = Field(default="", max_length=200)


class ReportCreatedOut(CamelModel):
    id: int
    status: Literal["open"] = "open"


class ResolveIn(CamelModel):
    """hide: 대상을 숨김 · dismiss: 그대로 두기"""

    action: Literal["hide", "dismiss"]
    memo: str | None = Field(default=None, max_length=200)


class AdminReportOut(CamelModel):
    """관리자 신고함 한 줄 — 대상 하나에 한 줄 (id · memo · reporterNickname은 가장 최근 신고)"""

    id: int
    target_type: TargetType
    target_id: int
    target_preview: str
    reason: Reason
    memo: str
    reporter_nickname: str
    report_count: int
    status: str
    created_at: datetime

    @classmethod
    def from_domain(cls, row: ReportRow) -> "AdminReportOut":
        return cls(**row.__dict__)
