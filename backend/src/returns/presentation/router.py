# 배송 완료 뒤 API — 내 주문 구매 확정 · 반품/교환 신청, 관리자 반품/교환 목록·승인·거절
from datetime import datetime
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from pydantic import StringConstraints

from app.schemas.common import CamelModel, Message, Page
from src.common.auth import ActiveUser, AdminUser, DbSession
from src.returns.application.service import ReturnService
from src.returns.infrastructure.repositories import ReturnRepository, ReturnRequestRow

router = APIRouter(prefix="/orders", tags=["orders"])
admin_router = APIRouter(prefix="/admin/return-requests", tags=["admin"])

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
RequestStatus = Literal["requested", "approved", "rejected"]


class ReturnRequestIn(CamelModel):
    kind: Literal["return", "exchange"]
    reason: Reason


class ConfirmOut(CamelModel):
    message: str
    reward: int  # 구매 확정으로 쌓인 적립금


class AdminReturnRequestOut(CamelModel):
    id: int
    order_id: int
    kind: str
    reason: str
    status: str
    created_at: datetime
    order_status: str
    buyer_nickname: str
    total_price: int

    @classmethod
    def from_row(cls, row: ReturnRequestRow) -> "AdminReturnRequestOut":
        return cls(**row.__dict__)


def _service(db: DbSession) -> ReturnService:
    return ReturnService(ReturnRepository(db), db)


@router.post("/{order_id}/confirm", response_model=ConfirmOut, summary="구매 확정 (배송 완료 주문 · 결제 금액 1% 적립)")
async def confirm_order(order_id: int, user: ActiveUser, db: DbSession) -> ConfirmOut:
    reward = await _service(db).confirm(user.id, order_id)
    return ConfirmOut(message="구매를 확정했어요.", reward=reward)


@router.post(
    "/{order_id}/return-requests",
    response_model=Message,
    status_code=status.HTTP_201_CREATED,
    summary="반품·교환 신청 (배송 완료 · 구매 확정 전)",
)
async def request_return(order_id: int, body: ReturnRequestIn, user: ActiveUser, db: DbSession) -> Message:
    await _service(db).request(user.id, order_id, body.kind, body.reason)
    return Message(message="반품 신청을 접수했어요." if body.kind == "return" else "교환 신청을 접수했어요.")


@admin_router.get("", response_model=Page[AdminReturnRequestOut], summary="[관리자] 반품·교환 신청 목록")
async def list_return_requests(
    admin: AdminUser,
    db: DbSession,
    request_status: Annotated[RequestStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
) -> Page[AdminReturnRequestOut]:
    rows, total = await _service(db).list_requests(request_status, page, size)
    return Page[AdminReturnRequestOut](
        items=[AdminReturnRequestOut.from_row(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@admin_router.post("/{request_id}/approve", response_model=Message, summary="[관리자] 반품·교환 승인")
async def approve_return_request(request_id: int, admin: AdminUser, db: DbSession) -> Message:
    await _service(db).resolve(request_id, approve=True)
    return Message(message="신청을 승인했어요.")


@admin_router.post("/{request_id}/reject", response_model=Message, summary="[관리자] 반품·교환 거절")
async def reject_return_request(request_id: int, admin: AdminUser, db: DbSession) -> Message:
    await _service(db).resolve(request_id, approve=False)
    return Message(message="신청을 거절했어요.")
