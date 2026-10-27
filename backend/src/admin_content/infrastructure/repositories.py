from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Faq, Notice
from src.admin_content.domain.content import Faq as FaqView
from src.admin_content.domain.content import Notice as NoticeView


def _notice(row: Notice) -> NoticeView:
    return NoticeView(row.id, row.title, row.content, row.is_pinned, row.is_published, row.created_at, row.updated_at)


def _faq(row: Faq) -> FaqView:
    return FaqView(row.id, row.category, row.question, row.answer, row.sort_order)


class ContentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_notices(
        self, published: bool | None, pinned: bool | None, offset: int, limit: int
    ) -> tuple[list[NoticeView], int]:
        filters = []
        if published is not None:
            filters.append(Notice.is_published.is_(published))
        if pinned is not None:
            filters.append(Notice.is_pinned.is_(pinned))
        total = await self.session.scalar(select(func.count()).select_from(Notice).where(*filters)) or 0
        rows = await self.session.scalars(
            select(Notice)
            .where(*filters)
            .order_by(Notice.is_pinned.desc(), Notice.created_at.desc(), Notice.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [_notice(row) for row in rows], total

    async def get_notice(self, notice_id: int, published: bool | None = None) -> NoticeView | None:
        filters = [Notice.id == notice_id]
        if published is not None:
            filters.append(Notice.is_published.is_(published))
        row = await self.session.scalar(select(Notice).where(*filters).execution_options(populate_existing=True))
        return None if row is None else _notice(row)

    async def create_notice(self, values: dict[str, object], user_id: int) -> NoticeView:
        row = Notice(**values, created_by=user_id)
        self.session.add(row)
        await self.session.flush()
        saved = await self.get_notice(row.id)
        assert saved is not None
        return saved

    async def update_notice(self, notice_id: int, values: dict[str, object]) -> None:
        row = await self.session.get(Notice, notice_id)
        assert row is not None
        for field, value in values.items():
            setattr(row, field, value)
        await self.session.flush()

    async def delete_notice(self, notice_id: int) -> None:
        row = await self.session.get(Notice, notice_id)
        assert row is not None
        await self.session.delete(row)

    async def list_faqs(self) -> list[FaqView]:
        rows = await self.session.scalars(select(Faq).order_by(Faq.category, Faq.sort_order, Faq.id))
        return [_faq(row) for row in rows]

    async def get_faq(self, faq_id: int) -> FaqView | None:
        row = await self.session.scalar(select(Faq).where(Faq.id == faq_id).execution_options(populate_existing=True))
        return None if row is None else _faq(row)

    async def create_faq(self, values: dict[str, object]) -> FaqView:
        row = Faq(**values)
        self.session.add(row)
        await self.session.flush()
        saved = await self.get_faq(row.id)
        assert saved is not None
        return saved

    async def update_faq(self, faq_id: int, values: dict[str, object]) -> None:
        row = await self.session.get(Faq, faq_id)
        assert row is not None
        for field, value in values.items():
            setattr(row, field, value)
        await self.session.flush()

    async def delete_faq(self, faq_id: int) -> None:
        row = await self.session.get(Faq, faq_id)
        assert row is not None
        await self.session.delete(row)
