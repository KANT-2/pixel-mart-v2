from datetime import UTC, datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, status
from pydantic import Field, StringConstraints

from app.deps import AdminUser, CurrentUser, DbSession
from app.schemas.common import CamelModel, Message, Page
from app.schemas.local import BadgeBookItemOut, BadgeBookOut, BadgeProgressOut
from src.auth.domain.withdrawal import display_nickname
from src.badges.application.service import BadgeService
from src.badges.domain.badge import MAX_GRANT, BadgeInfo, Book
from src.badges.infrastructure.repositories import BadgeRepository
from src.common.pagination import Pagination

router = APIRouter(prefix="/users/me", tags=["badges"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


def service(db: DbSession) -> BadgeService:
    return BadgeService(BadgeRepository(db), db)


def book_out(book: Book) -> BadgeBookOut:
    items = [
        BadgeBookItemOut(
            code=i.info.code,
            icon=i.info.icon,
            image=i.info.image,
            name=i.info.name,
            description=i.info.description,
            earned=i.earned,
            kind=i.info.kind,
            earned_at=i.earned_at,
            is_new=i.is_new,
            is_weekly=i.is_weekly,
            progress=BadgeProgressOut(current=i.progress.current, goal=i.progress.goal) if i.progress else None,
            granted_memo=i.granted_memo,
        )
        for i in book.items
    ]
    return BadgeBookOut(earned_count=book.earned_count, total=len(items), featured=book.featured, items=items)


class FeaturedIn(CamelModel):
    code: str | None = Field(description="대표로 고를 뱃지 코드, null이면 자동(가장 받기 어려운 것)")


@router.patch("/featured-badge", response_model=BadgeBookOut, summary="대표 뱃지 고르기 (받은 뱃지만)")
async def set_featured(body: FeaturedIn, user: CurrentUser, db: DbSession):
    return book_out(await service(db).set_featured(user.id, body.code, datetime.now(UTC)))


class BadgeAdminOut(CamelModel):
    code: str
    name: str
    description: str
    image: str
    kind: Literal["auto", "event"]
    is_active: bool
    holder_count: int


class BadgeAdminListOut(CamelModel):
    auto: list[BadgeAdminOut]
    event: list[BadgeAdminOut]


class EventBadgeIn(CamelModel):
    name: Name
    description: Description
    image: str = Field(examples=["/images/badges/santa.png"])
    is_active: bool = True


class EventBadgePatch(CamelModel):
    name: Name | None = None
    description: Description | None = None
    image: str | None = None
    is_active: bool | None = None


class GrantIn(CamelModel):
    user_ids: list[int] = Field(min_length=1, max_length=MAX_GRANT)
    memo: str | None = Field(default=None, max_length=200)


class GrantOut(CamelModel):
    granted: int
    skipped: int


class HolderOut(CamelModel):
    user_id: int
    nickname: str
    earned_at: datetime
    granted_by_nickname: str | None
    memo: str | None


def admin_out(info: BadgeInfo, holders: int) -> BadgeAdminOut:
    return BadgeAdminOut(
        code=info.code,
        name=info.name,
        description=info.description,
        image=info.image,
        kind=info.kind,
        is_active=info.is_active,
        holder_count=holders,
    )


@admin_router.get("/badges", response_model=BadgeAdminListOut, summary="[관리자] 뱃지 목록 (자동 · 이벤트)")
async def list_badges(_admin: AdminUser, db: DbSession):
    auto, event = await service(db).admin_list()
    return BadgeAdminListOut(auto=[admin_out(b, n) for b, n in auto], event=[admin_out(b, n) for b, n in event])


@admin_router.post(
    "/badges", response_model=BadgeAdminOut, status_code=status.HTTP_201_CREATED, summary="[관리자] 이벤트 뱃지 만들기"
)
async def create_badge(body: EventBadgeIn, admin: AdminUser, db: DbSession):
    info = await service(db).create_event(body.name, body.description, body.image, body.is_active, admin.id)
    return admin_out(info, 0)


@admin_router.patch(
    "/badges/{code}", response_model=BadgeAdminOut, summary="[관리자] 이벤트 뱃지 고치기 (자동 뱃지 400)"
)
async def update_badge(code: str, body: EventBadgePatch, _admin: AdminUser, db: DbSession):
    svc = service(db)
    info = await svc.update_event(code, body.model_dump(exclude_none=True))
    counts = await svc.badges.holder_counts()
    return admin_out(info, counts.get(code, 0))


@admin_router.get("/badge-images", response_model=list[str], summary="[관리자] 고를 수 있는 뱃지 그림")
async def badge_images(_admin: AdminUser, db: DbSession):
    return await BadgeRepository(db).images()


@admin_router.post("/badges/{code}/grant", response_model=GrantOut, summary="[관리자] 이벤트 뱃지 주기 (최대 50명)")
async def grant_badge(code: str, body: GrantIn, admin: AdminUser, db: DbSession):
    granted, skipped = await service(db).grant(code, body.user_ids, body.memo, admin.id)
    return GrantOut(granted=granted, skipped=skipped)


@admin_router.get("/badges/{code}/holders", response_model=Page[HolderOut], summary="[관리자] 뱃지 받은 사람")
async def badge_holders(code: str, _admin: AdminUser, db: DbSession, pagination: Pagination):
    await service(db).find(code)  # 없는 뱃지는 404
    rows, total = await BadgeRepository(db).holders(code, (pagination.page - 1) * pagination.size, pagination.size)
    return Page[HolderOut](
        items=[
            HolderOut(
                user_id=uid,
                nickname=display_nickname(nick, deleted_at),
                earned_at=earned_at,
                granted_by_nickname=granter,
                memo=memo,
            )
            for uid, nick, deleted_at, earned_at, granter, memo in rows
        ],
        total=total,
        page=pagination.page,
        size=pagination.size,
        total_pages=max(1, ceil(total / pagination.size)),
    )


@admin_router.delete("/badges/{code}/holders/{user_id}", response_model=Message, summary="[관리자] 이벤트 뱃지 회수")
async def revoke_badge(code: str, user_id: int, _admin: AdminUser, db: DbSession):
    await service(db).revoke(code, user_id)
    return Message(message="뱃지를 회수했어요.")
