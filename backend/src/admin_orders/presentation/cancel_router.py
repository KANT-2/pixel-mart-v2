# 관리자 취소 요청 API — 목록·승인·거절. 비즈니스 규칙·commit/rollback은 전부 AdminOrderService에 맡긴다.
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbSession
from app.schemas.common import Message, Page
from src.admin_orders.application.service import AdminOrderService
from src.admin_orders.infrastructure.repositories import AdminOrderRepository
from src.admin_orders.presentation.cancel_schemas import AdminCancelRequestOut, CancelStatus
from src.common.auth import AdminUser  # 관리자가 아니면 404, 로그인 안 했으면 401 (의존성이 알아서 처리)

# 이슈 #23 경로 그대로 — /api/admin/cancel-requests
router = APIRouter(prefix="/admin/cancel-requests", tags=["admin"])


def _service(db: DbSession) -> AdminOrderService:
    # orders/presentation/router.py의 _service(db)와 같은 모양 — 세션 하나로 레포지토리·서비스를 만든다
    return AdminOrderService(AdminOrderRepository(db), db)


@router.get("", response_model=Page[AdminCancelRequestOut], summary="[관리자] 취소 요청 목록 (상태 필터·페이지)")
async def list_cancel_requests(
    admin: AdminUser,
    db: DbSession,
    request_status: Annotated[CancelStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
) -> Page[AdminCancelRequestOut]:
    # admin은 의존성이 "관리자만 통과"를 이미 검사했으니, 여기선 그냥 받기만 한다
    rows, total = await AdminOrderRepository(db).list_cancel_requests(request_status, (page - 1) * size, size)
    return Page[AdminCancelRequestOut](
        items=[AdminCancelRequestOut.from_row(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.post("/{request_id}/approve", response_model=Message, summary="[관리자] 취소 승인")
async def approve_cancel_request(request_id: int, admin: AdminUser, db: DbSession) -> Message:
    # 승인 실패(없음 404·이미 처리 409)는 서비스가 예외를 올리고, errors.py의 전역 핸들러가 응답으로 바꿔 준다
    await _service(db).approve_cancel(request_id)
    return Message(message="취소를 승인했어요.")


@router.post("/{request_id}/reject", response_model=Message, summary="[관리자] 취소 거절")
async def reject_cancel_request(request_id: int, admin: AdminUser, db: DbSession) -> Message:
    await _service(db).reject_cancel(request_id)
    return Message(message="취소를 거절했어요.")
