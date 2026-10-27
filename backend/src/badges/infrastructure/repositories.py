from pathlib import Path

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BadgeDefinition, User, UserBadge
from app.services import badges as auto
from app.services import notifications
from src.badges.domain.badge import EVENT_ICON, BadgeInfo, Owned

# 사이트 안 그림만 고를 수 있게 (public/images/badges/*.png)
BADGE_IMAGE_DIR = Path(__file__).resolve().parents[4] / "public" / "images" / "badges"


def _auto_info(b: auto.Badge) -> BadgeInfo:
    return BadgeInfo(b.code, b.name, b.description, b.image, b.icon, b.rank, "auto")


def _event_info(d: BadgeDefinition) -> BadgeInfo:
    return BadgeInfo(d.code, d.name, d.description, d.image, EVENT_ICON, d.rank, "event", d.is_active)


class BadgeRepository:
    """자동 뱃지(app/services/badges.py) + 저장 기록(user_badges) + 이벤트 뱃지(badge_defs). commit은 서비스"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def sync(self, user_id: int) -> None:
        await notifications.check_badges(self.session, user_id)

    async def records(self, user_id: int) -> tuple[dict[str, int], bool]:
        """진행 막대에 쓸 기록과 이번 주 큰손 여부"""
        user = await self.session.get(User, user_id)
        stats = (await auto.stats_for(self.session, [user]))[user_id]
        fields = ("orders", "trades", "reviews", "categories", "gifts", "hearts")
        return {f: getattr(stats, f) for f in fields}, stats.top_buyer

    async def owned(self, user_id: int) -> dict[str, Owned]:
        rows = await self.session.scalars(select(UserBadge).where(UserBadge.user_id == user_id))
        return {r.code: Owned(r.code, r.earned_at, r.memo) for r in rows}

    async def auto_badges(self) -> list[BadgeInfo]:
        return [_auto_info(b) for b in auto.BADGES]

    async def event_badges(self) -> list[BadgeInfo]:
        rows = await self.session.scalars(
            select(BadgeDefinition).order_by(BadgeDefinition.created_at, BadgeDefinition.code)
        )
        return [_event_info(d) for d in rows]

    async def featured_choice(self, user_id: int) -> str | None:
        return await self.session.scalar(select(User.featured_badge).where(User.id == user_id))

    async def set_featured(self, user_id: int, code: str | None) -> None:
        await self.session.execute(update(User).where(User.id == user_id).values(featured_badge=code))

    async def holder_counts(self) -> dict[str, int]:
        rows = await self.session.execute(select(UserBadge.code, func.count()).group_by(UserBadge.code))
        return dict(rows.all())

    async def create_event(self, info: BadgeInfo, admin_id: int) -> None:
        self.session.add(
            BadgeDefinition(
                code=info.code,
                name=info.name,
                description=info.description,
                image=info.image,
                rank=info.rank,
                is_active=info.is_active,
                created_by=admin_id,
            )
        )
        await self.session.flush()

    async def update_event(self, code: str, changes: dict) -> None:
        if changes:
            await self.session.execute(update(BadgeDefinition).where(BadgeDefinition.code == code).values(**changes))

    async def grantable(self, code: str, user_ids: list[int]) -> list[int]:
        """있는 · 탈퇴 안 한 · 아직 안 가진 사용자만"""
        if not user_ids:
            return []
        have = select(UserBadge.user_id).where(UserBadge.code == code)
        rows = await self.session.scalars(
            select(User.id).where(User.id.in_(user_ids), User.deleted_at.is_(None), User.id.not_in(have))
        )
        return sorted(rows)

    async def grant(self, info: BadgeInfo, user_ids: list[int], memo: str | None, admin_id: int) -> None:
        if not user_ids:
            return
        await self.session.execute(
            insert(UserBadge)
            .values([{"user_id": u, "code": info.code, "granted_by": admin_id, "memo": memo} for u in user_ids])
            .on_conflict_do_nothing(index_elements=["user_id", "code"])
        )
        for user_id in user_ids:
            await notifications.notify(
                self.session,
                user_id,
                "badge",
                f"🎪 이벤트 뱃지를 받았어요: {info.name}",
                info.description,
                notifications.BADGES_HREF,
                f"badge:{info.code}",
            )

    async def revoke(self, code: str, user_id: int) -> bool:
        result = await self.session.execute(
            delete(UserBadge).where(UserBadge.code == code, UserBadge.user_id == user_id)
        )
        # 그 뱃지가 대표였으면 자동(가장 어려운 것)으로 되돌린다
        await self.session.execute(
            update(User).where(User.id == user_id, User.featured_badge == code).values(featured_badge=None)
        )
        return result.rowcount > 0

    async def images(self) -> list[str]:
        if not BADGE_IMAGE_DIR.is_dir():
            return []
        return sorted(f"/images/badges/{p.name}" for p in BADGE_IMAGE_DIR.glob("*.png"))

    async def holders(self, code: str, offset: int, limit: int) -> tuple[list[tuple], int]:
        granter = User.__table__.alias("granter")
        total = await self.session.scalar(select(func.count()).where(UserBadge.code == code))
        rows = await self.session.execute(
            select(
                UserBadge.user_id,
                User.nickname,
                User.deleted_at,
                UserBadge.earned_at,
                granter.c.nickname,
                UserBadge.memo,
            )
            .join(User, User.id == UserBadge.user_id)
            .outerjoin(granter, granter.c.id == UserBadge.granted_by)
            .where(UserBadge.code == code)
            .order_by(UserBadge.earned_at.desc(), UserBadge.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(rows.all()), total or 0
