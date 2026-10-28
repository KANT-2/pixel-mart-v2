from datetime import datetime
from typing import Protocol

from src.badges.domain.badge import (
    EVENT_ICON,
    WEEKLY,
    BadgeInfo,
    BadgeNotFound,
    BadgeRuleError,
    Book,
    BookItem,
    NotHolder,
    Owned,
    check_can_feature,
    check_event_badge,
    is_new,
    next_event_code,
    progress_of,
    resolve_featured,
)


class Badges(Protocol):
    async def sync(self, user_id: int) -> None: ...
    async def records(self, user_id: int) -> tuple[dict[str, int], bool]: ...
    async def owned(self, user_id: int) -> dict[str, Owned]: ...
    async def auto_badges(self) -> list[BadgeInfo]: ...
    async def event_badges(self) -> list[BadgeInfo]: ...
    async def featured_choice(self, user_id: int) -> str | None: ...
    async def set_featured(self, user_id: int, code: str | None) -> None: ...
    async def holder_counts(self) -> dict[str, int]: ...
    async def create_event(self, info: BadgeInfo, admin_id: int) -> None: ...
    async def update_event(self, code: str, changes: dict) -> None: ...
    async def grantable(self, code: str, user_ids: list[int]) -> list[int]: ...
    async def grant(self, info: BadgeInfo, user_ids: list[int], memo: str | None, admin_id: int) -> None: ...
    async def revoke(self, code: str, user_id: int) -> bool: ...
    async def delete_event(self, code: str) -> int: ...
    async def images(self) -> list[str]: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class BadgeService:
    def __init__(self, badges: Badges, tx: Transaction) -> None:
        self.badges = badges
        self.tx = tx

    async def _commit(self) -> None:
        try:
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise

    async def book(self, user_id: int, now: datetime) -> Book:
        """내 도감: 자동 19종 + 내가 받은 이벤트 뱃지 (안 받은 이벤트 뱃지는 모르게)"""
        await self.badges.sync(user_id)  # 도감을 먼저 열어도 받은 뱃지가 저장되게
        await self._commit()
        records, weekly = await self.badges.records(user_id)
        owned = await self.badges.owned(user_id)
        events = [b for b in await self.badges.event_badges() if b.code in owned]
        items = []
        for info in [*await self.badges.auto_badges(), *events]:
            mine = owned.get(info.code)
            earned = mine is not None or (info.code == WEEKLY and weekly)
            items.append(
                BookItem(
                    info=info,
                    earned=earned,
                    earned_at=mine.earned_at if mine else None,
                    is_new=is_new(mine.earned_at if mine else None, now),
                    is_weekly=info.code == WEEKLY,
                    progress=progress_of(info.code, records),
                    granted_memo=mine.memo if mine else None,
                )
            )
        featured = resolve_featured(await self.badges.featured_choice(user_id), [i.info for i in items if i.earned])
        return Book(items=items, featured=featured)

    async def set_featured(self, user_id: int, code: str | None, now: datetime) -> Book:
        book = await self.book(user_id, now)
        if code is not None:
            check_can_feature(code, {i.info.code for i in book.items if i.earned})
        await self.badges.set_featured(user_id, code)
        await self._commit()
        return await self.book(user_id, now)

    async def admin_list(self) -> tuple[list[tuple[BadgeInfo, int]], list[tuple[BadgeInfo, int]]]:
        counts = await self.badges.holder_counts()
        auto = [(b, counts.get(b.code, 0)) for b in await self.badges.auto_badges()]
        event = [(b, counts.get(b.code, 0)) for b in await self.badges.event_badges()]
        return auto, event

    async def find(self, code: str) -> BadgeInfo:
        for info in [*await self.badges.auto_badges(), *await self.badges.event_badges()]:
            if info.code == code:
                return info
        raise BadgeNotFound()

    async def _check_image(self, image: str) -> None:
        if image not in await self.badges.images():
            raise BadgeRuleError("고를 수 있는 그림이 아니에요.")

    async def create_event(self, name: str, description: str, image: str, is_active: bool, admin_id: int) -> BadgeInfo:
        await self._check_image(image)
        existing = [b.code for b in await self.badges.event_badges()]
        info = BadgeInfo(next_event_code(existing), name, description, image, EVENT_ICON, 10, "event", is_active)
        await self.badges.create_event(info, admin_id)
        await self._commit()
        return info

    async def update_event(self, code: str, changes: dict) -> BadgeInfo:
        check_event_badge(await self.find(code), "update")
        if "image" in changes:
            await self._check_image(changes["image"])
        await self.badges.update_event(code, changes)
        await self._commit()
        return await self.find(code)

    async def grant(self, code: str, user_ids: list[int], memo: str | None, admin_id: int) -> tuple[int, int]:
        """이미 가진 사람 · 없는 사람 · 탈퇴 계정은 건너뛴다 → (준 수, 건너뛴 수)"""
        info = await self.find(code)
        check_event_badge(info, "grant")
        targets = await self.badges.grantable(code, sorted(set(user_ids)))
        await self.badges.grant(info, targets, memo, admin_id)
        await self._commit()
        return len(targets), len(user_ids) - len(targets)

    async def revoke(self, code: str, user_id: int) -> None:
        check_event_badge(await self.find(code), "revoke")
        if not await self.badges.revoke(code, user_id):
            raise NotHolder()
        await self._commit()

    async def delete_event(self, code: str) -> int:
        """이벤트 뱃지를 지운다 — 받은 사람 기록도 함께 (지운 사람 수)"""
        check_event_badge(await self.find(code), "delete")
        removed = await self.badges.delete_event(code)
        await self._commit()
        return removed
