from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import AdminUser, DbSession
from app.schemas.common import Message, Page
from src.admin_content.application.service import ContentService
from src.admin_content.infrastructure.repositories import ContentRepository
from src.admin_content.presentation.schemas import (
    AdminFaqOut,
    AdminNoticeOut,
    FaqIn,
    FaqUpdateIn,
    NoticeIn,
    NoticeListOut,
    NoticeOut,
    NoticeUpdateIn,
)

router = APIRouter(tags=["notices"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])


def _service(db: DbSession) -> ContentService:
    return ContentService(ContentRepository(db), db)


@router.get("/notices", response_model=Page[NoticeListOut])
async def list_notices(
    db: DbSession,
    pinned: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
):
    rows, total = await _service(db).list_public_notices(pinned, page, size)
    return Page[NoticeListOut](
        items=[NoticeListOut.from_domain(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/notices/{notice_id}", response_model=NoticeOut)
async def get_notice(notice_id: int, db: DbSession) -> NoticeOut:
    return NoticeOut.from_domain(await _service(db).get_public_notice(notice_id))


@admin_router.get("/notices", response_model=Page[AdminNoticeOut])
async def list_admin_notices(
    _admin: AdminUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
):
    rows, total = await _service(db).list_admin_notices(page, size)
    return Page[AdminNoticeOut](
        items=[AdminNoticeOut.from_domain(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@admin_router.post("/notices", response_model=AdminNoticeOut, status_code=status.HTTP_201_CREATED)
async def create_notice(body: NoticeIn, admin: AdminUser, db: DbSession) -> AdminNoticeOut:
    return AdminNoticeOut.from_domain(await _service(db).create_notice(body.values(), admin.id))


@admin_router.patch("/notices/{notice_id}", response_model=AdminNoticeOut)
async def update_notice(notice_id: int, body: NoticeUpdateIn, _admin: AdminUser, db: DbSession) -> AdminNoticeOut:
    return AdminNoticeOut.from_domain(await _service(db).update_notice(notice_id, body.values()))


@admin_router.delete("/notices/{notice_id}", response_model=Message)
async def delete_notice(notice_id: int, _admin: AdminUser, db: DbSession) -> Message:
    await _service(db).delete_notice(notice_id)
    return Message(message="공지를 삭제했어요.")


@admin_router.get("/faqs", response_model=list[AdminFaqOut])
async def list_faqs(_admin: AdminUser, db: DbSession) -> list[AdminFaqOut]:
    return [AdminFaqOut.from_domain(faq) for faq in await _service(db).list_faqs()]


@admin_router.post("/faqs", response_model=AdminFaqOut, status_code=status.HTTP_201_CREATED)
async def create_faq(body: FaqIn, _admin: AdminUser, db: DbSession) -> AdminFaqOut:
    return AdminFaqOut.from_domain(await _service(db).create_faq(body.values()))


@admin_router.patch("/faqs/{faq_id}", response_model=AdminFaqOut)
async def update_faq(faq_id: int, body: FaqUpdateIn, _admin: AdminUser, db: DbSession) -> AdminFaqOut:
    return AdminFaqOut.from_domain(await _service(db).update_faq(faq_id, body.values()))


@admin_router.delete("/faqs/{faq_id}", response_model=Message)
async def delete_faq(faq_id: int, _admin: AdminUser, db: DbSession) -> Message:
    await _service(db).delete_faq(faq_id)
    return Message(message="FAQ를 삭제했어요.")
