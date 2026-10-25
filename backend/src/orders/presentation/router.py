from math import ceil
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CurrentUser, DbSession
from app.schemas.common import Page
from src.orders.application.service import OrderService
from src.orders.infrastructure.repositories import OrderRepository
from src.orders.presentation.schemas import OrderCreate, OrderDetailOut, OrderOut, OrderStatus, OrderSummaryOut

router = APIRouter(prefix="/orders", tags=["orders"])


def _service(db: DbSession) -> OrderService:
    return OrderService(OrderRepository(db), db)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED, summary="장바구니로 가상 주문")
async def create_order(body: OrderCreate, user: CurrentUser, db: DbSession) -> OrderOut:
    service = _service(db)
    order_id = await service.place_order(user.id, body.recipient_name, body.address)
    order = await service.get_order(user.id, order_id)
    if order is None:  # commit 직후 조회이므로 DB 이상 외에는 도달하지 않는다.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없어요.")
    return OrderOut.from_model(order)


@router.get("", response_model=Page[OrderSummaryOut], summary="내 주문 목록")
async def list_orders(
    user: CurrentUser,
    db: DbSession,
    order_status: Annotated[OrderStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
) -> Page[OrderSummaryOut]:
    query = q.strip() if q and q.strip() else None
    rows, total = await _service(db).list_orders(user.id, order_status, query, page, size)
    return Page[OrderSummaryOut](
        items=[OrderSummaryOut.from_model(order) for order in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/{order_id}", response_model=OrderDetailOut, summary="내 주문 상세")
async def get_order_detail(order_id: int, user: CurrentUser, db: DbSession) -> OrderDetailOut:
    order = await _service(db).get_order(user.id, order_id)
    if order is None:  # 남의 주문도 같은 404로 숨긴다.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없어요.")
    return OrderDetailOut.from_model(order)
