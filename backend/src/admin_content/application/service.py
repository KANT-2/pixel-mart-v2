from typing import Protocol

from src.admin_content.domain.content import Faq, FaqNotFound, Notice, NoticeNotFound


class Content(Protocol):
    async def list_notices(
        self, published: bool | None, pinned: bool | None, offset: int, limit: int
    ) -> tuple[list[Notice], int]: ...
    async def get_notice(self, notice_id: int, published: bool | None = None) -> Notice | None: ...
    async def create_notice(self, values: dict[str, object], user_id: int) -> Notice: ...
    async def update_notice(self, notice_id: int, values: dict[str, object]) -> None: ...
    async def delete_notice(self, notice_id: int) -> None: ...
    async def list_faqs(self) -> list[Faq]: ...
    async def get_faq(self, faq_id: int) -> Faq | None: ...
    async def create_faq(self, values: dict[str, object]) -> Faq: ...
    async def update_faq(self, faq_id: int, values: dict[str, object]) -> None: ...
    async def delete_faq(self, faq_id: int) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class ContentService:
    def __init__(self, content: Content, tx: Transaction) -> None:
        self.content = content
        self.tx = tx

    async def list_public_notices(self, pinned: bool | None, page: int, size: int) -> tuple[list[Notice], int]:
        return await self.content.list_notices(True, pinned, (page - 1) * size, size)

    async def get_public_notice(self, notice_id: int) -> Notice:
        notice = await self.content.get_notice(notice_id, published=True)
        if notice is None:
            raise NoticeNotFound()
        return notice

    async def list_admin_notices(self, page: int, size: int) -> tuple[list[Notice], int]:
        return await self.content.list_notices(None, None, (page - 1) * size, size)

    async def create_notice(self, values: dict[str, object], user_id: int) -> Notice:
        try:
            notice = await self.content.create_notice(values, user_id)
            await self.tx.commit()
            return notice
        except Exception:
            await self.tx.rollback()
            raise

    async def update_notice(self, notice_id: int, values: dict[str, object]) -> Notice:
        if await self.content.get_notice(notice_id) is None:
            raise NoticeNotFound()
        try:
            await self.content.update_notice(notice_id, values)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        notice = await self.content.get_notice(notice_id)
        assert notice is not None
        return notice

    async def delete_notice(self, notice_id: int) -> None:
        if await self.content.get_notice(notice_id) is None:
            raise NoticeNotFound()
        try:
            await self.content.delete_notice(notice_id)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def list_faqs(self) -> list[Faq]:
        return await self.content.list_faqs()

    async def create_faq(self, values: dict[str, object]) -> Faq:
        try:
            faq = await self.content.create_faq(values)
            await self.tx.commit()
            return faq
        except Exception:
            await self.tx.rollback()
            raise

    async def update_faq(self, faq_id: int, values: dict[str, object]) -> Faq:
        if await self.content.get_faq(faq_id) is None:
            raise FaqNotFound()
        try:
            await self.content.update_faq(faq_id, values)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        faq = await self.content.get_faq(faq_id)
        assert faq is not None
        return faq

    async def delete_faq(self, faq_id: int) -> None:
        if await self.content.get_faq(faq_id) is None:
            raise FaqNotFound()
        try:
            await self.content.delete_faq(faq_id)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
