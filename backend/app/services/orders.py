from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderStatusHistory, User

# 배송이 진행되는 순서 (취소 흐름은 따로 다룬다)
DELIVERY_FLOW = ("paid", "preparing", "shipping", "delivered")


class CannotAdvanceError(Exception):
    """더 진행할 수 없는 상태 (배송 완료이거나 취소 흐름)"""


def next_status(current: str) -> str:
    """배송 단계의 다음 상태. DB 없이 테스트할 수 있는 순수 함수"""
    if current not in DELIVERY_FLOW or current == DELIVERY_FLOW[-1]:
        raise CannotAdvanceError(current)
    return DELIVERY_FLOW[DELIVERY_FLOW.index(current) + 1]


async def get_order(db: AsyncSession, order_id: int) -> Order:
    return await db.scalar(select(Order).where(Order.id == order_id).execution_options(populate_existing=True))


async def get_user_order(db: AsyncSession, user: User, order_id: int) -> Order | None:
    """내 주문만 돌려준다. 남의 주문은 없는 것처럼(None) 숨긴다"""
    order = await db.scalar(
        select(Order).where(Order.id == order_id, Order.user_id == user.id).execution_options(populate_existing=True)
    )
    return order


async def advance_order(db: AsyncSession, order: Order) -> Order:
    """배송을 다음 단계로 넘기고 타임라인에 기록한다 (한 번의 commit)"""
    new_status = next_status(order.status)
    order.status = new_status
    db.add(OrderStatusHistory(order_id=order.id, status=new_status))
    await db.commit()
    return await get_order(db, order.id)
