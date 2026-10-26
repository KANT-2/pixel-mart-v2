# 관리자 주문 API — 목록·상세·단계 넘기기. 비즈니스 규칙·commit/rollback은 전부 AdminOrderService에 맡긴다.
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import DbSession
from app.schemas.common import Page
from src.admin_orders.application.service import AdminOrderService
from src.admin_orders.infrastructure.repositories import AdminOrderRepository
from src.admin_orders.presentation.schemas import AdminOrderDetailOut, AdminOrderStatus, AdminOrderSummaryOut
from src.common.auth import AdminUser  # 관리자가 아니면 404, 로그인 안 했으면 401 (의존성이 알아서 처리)

# 이슈 #22 경로 그대로 — /api/admin/orders
router = APIRouter(prefix="/admin/orders", tags=["admin"])


def _service(db: DbSession) -> AdminOrderService:
    # orders/presentation/router.py, cancel_router.py의 _service(db)와 같은 모양
    return AdminOrderService(AdminOrderRepository(db), db)


@router.get("", response_model=Page[AdminOrderSummaryOut], summary="[관리자] 주문 목록 (상태 필터·검색·페이지)")
async def list_orders(
    admin: AdminUser,
    db: DbSession,
    order_status: Annotated[AdminOrderStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100, description="주문번호 또는 닉네임·이메일 부분 일치")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
) -> Page[AdminOrderSummaryOut]:
    # admin은 의존성이 "관리자만 통과"를 이미 검사했으니, 여기선 그냥 받기만 한다
    query = q.strip() if q and q.strip() else None
    rows, total = await _service(db).list_orders(order_status, query, page, size)
    return Page[AdminOrderSummaryOut](
        items=[AdminOrderSummaryOut.from_row(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/{order_id}", response_model=AdminOrderDetailOut, summary="[관리자] 주문 상세")
async def get_order_detail(order_id: int, admin: AdminUser, db: DbSession) -> AdminOrderDetailOut:
    # 없는 주문이면 서비스가 OrderNotFound를 올리고, errors.py의 전역 핸들러가 404로 바꿔 준다
    row = await _service(db).get_order(order_id)
    return AdminOrderDetailOut.from_row(row)


@router.post("/{order_id}/advance", response_model=AdminOrderDetailOut, summary="[관리자] 배송 단계 진행")
async def advance_order(order_id: int, admin: AdminUser, db: DbSession) -> AdminOrderDetailOut:
    # 더 못 넘기면 InvalidTransition(409), 없으면 OrderNotFound(404) — 둘 다 전역 핸들러가 처리한다
    service = _service(db)
    await service.advance_order(order_id)
    row = await service.get_order(order_id)  # 바뀐 상세를 다시 읽어 돌려준다
    return AdminOrderDetailOut.from_row(row)
