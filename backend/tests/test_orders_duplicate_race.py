
import asyncio
from contextlib import suppress

from sqlalchemy import select

from app.models.order import Order
from app.models.product import Product
from src.orders.application.service import OrderService
from src.orders.domain.exceptions import EmptyCart
from src.orders.infrastructure.repositories import OrderRepository
from src.points.infrastructure.repositories import PointRepository
from tests.test_orders_service import order_db as order_db


class PausingOrderRepository(OrderRepository):
    """같은 사용자의 두 요청이 겹치도록 만드는 테스트 전용 Repository."""

    def __init__(
        self,
        session,
        *,
        pause_first: bool,
        first_read: asyncio.Event,
        second_read: asyncio.Event,
        resume_first: asyncio.Event,
    ):
        super().__init__(session)
        self.pause_first = pause_first
        self.first_read = first_read
        self.second_read = second_read
        self.resume_first = resume_first

    async def from_cart(self, user_id: int):
        order = await super().from_cart(user_id)

        if self.pause_first:
            self.first_read.set()
            await self.resume_first.wait()
        else:
            self.second_read.set()

        return order


async def test_same_user_concurrent_orders_do_not_duplicate(order_db):
    """같은 장바구니의 동시 주문은 한 건만 성공해야 한다."""
    sessions, scenario = order_db

    first_read = asyncio.Event()
    second_read = asyncio.Event()
    resume_first = asyncio.Event()

    async def place_order(pause_first: bool):
        async with sessions() as session:
            repository = PausingOrderRepository(
                session,
                pause_first=pause_first,
                first_read=first_read,
                second_read=second_read,
                resume_first=resume_first,
            )

            service = OrderService(repository, session, PointRepository(session))

            return await service.place_order(
                scenario.user_id,
                "홍길동",
                "서울시 픽셀로 8",
            )

    first = asyncio.create_task(place_order(True))
    second = None

    try:
        # 첫 번째 요청이 장바구니를 읽을 때까지 기다린다.
        await asyncio.wait_for(first_read.wait(), timeout=10)

        # 같은 사용자로 두 번째 주문을 시작한다.
        second = asyncio.create_task(place_order(False))

        # 기존 코드에서는 두 번째 요청도 장바구니를
        # 읽을 수 있다. 잠금 적용 후에는 여기서 대기한다.
        with suppress(TimeoutError):
            await asyncio.wait_for(second_read.wait(), timeout=1)

        resume_first.set()

        results = await asyncio.wait_for(
            asyncio.gather(
                first,
                second,
                return_exceptions=True,
            ),
            timeout=20,
        )

    finally:
        resume_first.set()

        tasks = [first]

        if second is not None:
            tasks.append(second)

        pending = [
            task for task in tasks if not task.done()
        ]

        for task in pending:
            task.cancel()

        if pending:
            await asyncio.gather(
                *pending,
                return_exceptions=True,
            )

    successes = [
        result
        for result in results
        if type(result) is int
    ]

    failures = [
        result
        for result in results
        if isinstance(result, BaseException)
    ]

    # 같은 장바구니로는 주문이 한 번만 생성되어야 한다.
    assert len(successes) == 1, f"주문 결과: {results!r}"
    assert len(failures) == 1
    assert isinstance(failures[0], EmptyCart)

    async with sessions() as session:
        orders = list(
            await session.scalars(
                select(Order).where(
                    Order.user_id == scenario.user_id
                )
            )
        )

        stocks = list(
            await session.scalars(
                select(Product.stock)
                .where(Product.id.in_(scenario.product_ids))
                .order_by(Product.id)
            )
        )

    # 원래 장바구니: 상품 A 2개, 상품 B 1개
    # 주문이 한 번만 처리됐다면 재고는 3개, 2개다.
    assert len(orders) == 1
    assert stocks == [3, 2]
