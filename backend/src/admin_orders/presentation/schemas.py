# 관리자 주문 API 응답 모양 — orders/presentation/schemas.py의 OrderOut/OrderDetailOut을 그대로 본뜬다
from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel
from src.admin_orders.infrastructure.repositories import AdminOrderRow
from src.orders.domain.order import STATUS_LABELS  # 한글 라벨 — 읽기만 한다(수정 금지 파일)

# 목록 ?status= 쿼리로 받을 수 있는 값 — 주문 상태 6종
AdminOrderStatus = Literal["paid", "preparing", "shipping", "delivered", "cancel_requested", "cancelled"]


class AdminOrderSummaryOut(CamelModel):
    """주문 목록 한 줄 — 받는 사람·주소는 들어가지 않는다(상세에서만 보여 준다)"""

    id: int  # 주문 id
    status: str  # paid / preparing / shipping / delivered / cancel_requested / cancelled
    status_label: str  # 화면에 보여 줄 한글 이름
    buyer_nickname: str  # 주문자 닉네임
    buyer_email: str  # 주문자 이메일
    title: str  # 상품 요약 — "OO 외 N개"
    total_price: int  # 주문 금액(원)
    created_at: datetime  # 주문 시각

    @classmethod
    def from_row(cls, row: AdminOrderRow) -> "AdminOrderSummaryOut":
        # 레포지토리가 돌려준 row(주문 + 주문자 닉네임·이메일)를 API 응답 모양으로 옮긴다
        order = row.order
        first = order.items[0]  # 주문은 항상 품목이 1개 이상이다(비어 있는 주문은 만들 수 없음)
        others = len(order.items) - 1
        return cls(
            id=order.id,
            status=order.status,
            status_label=STATUS_LABELS[order.status],
            buyer_nickname=row.buyer_nickname,
            buyer_email=row.buyer_email,
            title=first.product.name + (f" 외 {others}개" if others else ""),
            total_price=order.total_price,
            created_at=order.created_at,
        )


class AdminOrderItemOut(CamelModel):
    """상세에서만 보여 주는 품목 한 줄 — 상품명·수량·단가"""

    product_name: str
    quantity: int
    unit_price: int


class AdminOrderStatusEntryOut(CamelModel):
    """상세에서만 보여 주는 상태 이력(타임라인) 한 줄"""

    status: str
    label: str
    changed_at: datetime


class AdminOrderDetailOut(AdminOrderSummaryOut):
    """주문 상세 — 목록 항목 + 받는 사람·주소·품목 목록·상태 이력"""

    recipient_name: str
    address: str
    items: list[AdminOrderItemOut]
    timeline: list[AdminOrderStatusEntryOut]

    @classmethod
    def from_row(cls, row: AdminOrderRow) -> "AdminOrderDetailOut":
        order = row.order
        return cls(
            **AdminOrderSummaryOut.from_row(row).model_dump(),
            recipient_name=order.recipient_name,
            address=order.address,
            items=[
                AdminOrderItemOut(product_name=item.product.name, quantity=item.quantity, unit_price=item.unit_price)
                for item in order.items
            ],
            timeline=[
                AdminOrderStatusEntryOut(
                    status=entry.status, label=STATUS_LABELS[entry.status], changed_at=entry.changed_at
                )
                for entry in order.history
            ],
        )
