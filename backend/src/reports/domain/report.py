from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from src.reports.domain.exceptions import CannotReport

TargetType = Literal["trade", "review", "question", "avatar"]
Reason = Literal["spam", "abuse", "privacy", "inappropriate", "etc"]
Action = Literal["hide", "dismiss"]
PREVIEW_LENGTH = 60


@dataclass(frozen=True)
class ReportTarget:
    """신고 대상 한 건. owner_id는 그 글을 쓴 사람(아바타면 그 사용자)."""

    type: TargetType
    id: int
    owner_id: int
    preview: str
    product_id: int | None = None


@dataclass(frozen=True)
class ReportRow:
    """관리자 신고함 한 줄 — 대상 하나에 한 줄 (가장 최근 신고 기준)."""

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


def check_can_report(target: ReportTarget, reporter_id: int) -> None:
    if target.owner_id == reporter_id:
        raise CannotReport()


def resolved_status(action: Action) -> str:
    """숨김이면 resolved, 그대로 두면 dismissed"""
    return "resolved" if action == "hide" else "dismissed"


def preview(text: str) -> str:
    return text[:PREVIEW_LENGTH]


def hidden_notice(target: ReportTarget) -> tuple[str, str]:
    """숨긴 대상의 주인에게 보낼 알림 (제목, 누르면 갈 곳) — ADMIN_API.md 8장"""
    if target.type == "trade":
        return "거래글이 운영 정책으로 숨겨졌어요", "/local/trades/mine"
    if target.type == "review":
        return "작성한 리뷰가 운영 정책으로 숨겨졌어요", f"/products/{target.product_id}"
    if target.type == "question":
        return "작성한 문의가 운영 정책으로 숨겨졌어요", f"/products/{target.product_id}"
    return "아바타가 기본 모습으로 바뀌었어요", "/mypage/avatar"
