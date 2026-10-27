from datetime import datetime

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductQuestion, Report, Review, TradePost, User
from app.services import notifications
from src.auth.domain.withdrawal import display_nickname
from src.reports.domain.report import ReportRow, ReportTarget, TargetType, preview


class ReportRepository:
    """reports 테이블과 신고 대상(거래글 · 리뷰 · 문의 · 아바타)을 다룬다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def target(self, target_type: TargetType, target_id: int) -> ReportTarget | None:
        if target_type == "trade":
            post = await self.session.get(TradePost, target_id)
            if post is None or post.is_sample:
                return None
            text = f"{post.item_name} · {post.content}" if post.content else post.item_name
            return ReportTarget("trade", post.id, post.user_id, preview(text))
        if target_type == "review":
            review = await self.session.get(Review, target_id)
            if review is None:
                return None
            return ReportTarget("review", review.id, review.user_id, preview(review.content), review.product_id)
        if target_type == "question":
            question = await self.session.get(ProductQuestion, target_id)
            if question is None:
                return None
            text = f"{question.title} · {question.content}"
            return ReportTarget("question", question.id, question.user_id, preview(text), question.product_id)
        user = await self.session.get(User, target_id)
        if user is None or user.avatar_url is None:
            return None
        return ReportTarget("avatar", user.id, user.id, user.avatar_url)  # 관리자가 그림을 바로 보도록 주소 그대로

    async def has_open(self, reporter_id: int, target_type: TargetType, target_id: int) -> bool:
        found = await self.session.scalar(
            select(Report.id).where(
                Report.reporter_id == reporter_id,
                Report.target_type == target_type,
                Report.target_id == target_id,
                Report.status == "open",
            )
        )
        return found is not None

    async def add(self, reporter_id: int, target_type: TargetType, target_id: int, reason: str, memo: str) -> int:
        report = Report(reporter_id=reporter_id, target_type=target_type, target_id=target_id, reason=reason, memo=memo)
        self.session.add(report)
        await self.session.flush()
        return report.id

    async def report_status(self, report_id: int) -> tuple[TargetType, int, str] | None:
        report = await self.session.get(Report, report_id)
        return (report.target_type, report.target_id, report.status) if report else None

    async def hide(self, target: ReportTarget) -> None:
        if target.type == "trade":
            stmt = update(TradePost).values(status="hidden", hidden_by_admin=True).where(TradePost.id == target.id)
        elif target.type == "review":
            stmt = update(Review).values(is_hidden=True).where(Review.id == target.id)
        elif target.type == "question":
            stmt = update(ProductQuestion).values(is_hidden=True).where(ProductQuestion.id == target.id)
        else:
            stmt = update(User).values(avatar_url=None).where(User.id == target.id)
        await self.session.execute(stmt)

    async def close_open(
        self, target_type: TargetType, target_id: int, status: str, admin_id: int, now: datetime
    ) -> list[int]:
        """같은 대상의 열린 신고를 모두 처리하고, 신고한 사람 id들을 돌려준다."""
        rows = await self.session.scalars(
            update(Report)
            .where(Report.target_type == target_type, Report.target_id == target_id, Report.status == "open")
            .values(status=status, resolved_at=now, resolved_by=admin_id)
            .returning(Report.reporter_id)
        )
        return sorted(set(rows))

    async def notify_owner(self, target: ReportTarget, title: str, href: str, ref_key: str) -> None:
        body = "신고가 접수되어 운영 정책에 따라 숨겼어요."
        await notifications.notify(self.session, target.owner_id, "report_hidden", title, body, href, ref_key)

    async def notify_reporter(self, reporter_id: int, hidden: bool, ref_key: str) -> None:
        body = "신고하신 내용을 숨겼어요." if hidden else "검토 결과 그대로 두기로 했어요."
        await notifications.notify(
            self.session, reporter_id, "report_done", "신고하신 내용을 처리했어요", body, None, ref_key
        )

    async def row(self, report_id: int) -> ReportRow:
        report = await self.session.get(Report, report_id, populate_existing=True)
        count = await self.session.scalar(
            select(func.count()).where(
                Report.target_type == report.target_type,
                Report.target_id == report.target_id,
                Report.status == report.status,
            )
        )
        return await self._to_row(report, count or 0)

    async def list_grouped(
        self, status: str, target_type: TargetType | None, offset: int, limit: int
    ) -> tuple[list[ReportRow], int]:
        """대상 하나에 한 줄. 신고 수 많은 순 → 최신순"""
        conditions = [Report.status == status]
        if target_type:
            conditions.append(Report.target_type == target_type)
        grouped = (
            select(func.max(Report.id).label("latest"), func.count().label("cnt"))
            .where(*conditions)
            .group_by(Report.target_type, Report.target_id)
        )
        total = await self.session.scalar(select(func.count()).select_from(grouped.subquery()))
        page = (
            await self.session.execute(grouped.order_by(desc("cnt"), desc("latest")).offset(offset).limit(limit))
        ).all()
        rows = []
        for latest, cnt in page:
            rows.append(await self._to_row(await self.session.get(Report, latest), cnt))
        return rows, total or 0

    async def _to_row(self, report: Report, count: int) -> ReportRow:
        reporter = await self.session.get(User, report.reporter_id)
        target = await self.target(report.target_type, report.target_id)
        return ReportRow(
            id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            target_preview=target.preview if target else "(삭제되었거나 이미 숨긴 내용)",
            reason=report.reason,
            memo=report.memo,
            reporter_nickname=display_nickname(reporter.nickname, reporter.deleted_at) if reporter else "",
            report_count=count,
            status=report.status,
            created_at=report.created_at,
        )
