from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.deps import CurrentUser, DbSession
from app.schemas.order import OrderDetailOut
from app.services.orders import CannotAdvanceError, advance_order, get_user_order

dev_router = APIRouter(prefix="/dev/orders", tags=["dev"])


@dev_router.post("/{order_id}/advance", response_model=OrderDetailOut, summary="[로컬 전용] 배송 단계 진행")
async def advance_delivery(order_id: int, user: CurrentUser, db: DbSession):
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    order = await get_user_order(db, user, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없습니다.")
    try:
        order = await advance_order(db, order)
    except CannotAdvanceError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "더 진행할 수 없는 주문입니다.") from None
    return OrderDetailOut.from_model(order)
