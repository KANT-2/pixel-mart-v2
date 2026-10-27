from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.models.order import Order, OrderItem, OrderStatusHistory
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut
from src.addresses.presentation.schemas import AddressDetail, Phone, PostalCode
from src.orders.domain.order import STATUS_LABELS
from src.orders.domain.shipping import COURIER_LABELS, PAYMENT_LABELS

RecipientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
OrderStatus = Literal[
    "paid",
    "preparing",
    "shipping",
    "delivered",
    "cancel_requested",
    "cancelled",
    "return_requested",
    "returned",
    "exchange_requested",
]
PaymentMethod = Literal["card", "easy_pay", "transfer"]
DeliveryMemo = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class OrderCreate(CamelModel):
    recipient_name: RecipientName
    address: Address
    # 연락처·우편번호는 주문서 화면에서 필수 — 예전 클라이언트·테스트 호환을 위해 API에서는 생략 가능
    phone: Phone | None = None
    postal_code: PostalCode | None = None
    address_detail: AddressDetail = ""
    delivery_memo: DeliveryMemo = ""
    payment_method: PaymentMethod = "card"
    points_used: int = Field(default=0, ge=0)
    user_coupon_id: int | None = None
    save_address: bool = False  # 이 배송지를 기본 배송지로 저장


class ReturnRequestOut(CamelModel):
    id: int
    kind: str  # return | exchange
    reason: str
    status: str  # requested | approved | rejected
    created_at: datetime


class OrderItemOut(CamelModel):
    product: ProductOut
    quantity: int
    unit_price: int
    subtotal: int

    @classmethod
    def from_model(cls, item: OrderItem) -> "OrderItemOut":
        return cls(
            product=ProductOut.from_model(item.product),
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.unit_price * item.quantity,
        )


class OrderOut(CamelModel):
    id: int
    status: str
    status_label: str
    items_price: int
    shipping_fee: int
    points_used: int
    coupon_discount: int
    coupon_name: str | None
    total_price: int
    recipient_name: str
    address: str
    phone: str
    postal_code: str
    address_detail: str
    delivery_memo: str
    payment_method: str
    payment_label: str
    courier: str | None
    courier_label: str | None
    tracking_number: str | None
    confirmed_at: datetime | None
    return_request: ReturnRequestOut | None  # 가장 최근 반품·교환 신청
    created_at: datetime
    items: list[OrderItemOut]

    @classmethod
    def from_model(cls, order: Order) -> "OrderOut":
        items = [OrderItemOut.from_model(item) for item in order.items]
        return cls(
            id=order.id,
            status=order.status,
            status_label=STATUS_LABELS[order.status],
            items_price=sum(item.subtotal for item in items),
            shipping_fee=order.shipping_fee,
            points_used=order.points_used,
            coupon_discount=order.coupon_discount,
            coupon_name=order.coupon_name,
            total_price=order.total_price,
            recipient_name=order.recipient_name,
            address=order.address,
            phone=order.phone,
            postal_code=order.postal_code,
            address_detail=order.address_detail,
            delivery_memo=order.delivery_memo,
            payment_method=order.payment_method,
            payment_label=PAYMENT_LABELS.get(order.payment_method, order.payment_method),
            courier=order.courier,
            courier_label=COURIER_LABELS.get(order.courier) if order.courier else None,
            tracking_number=order.tracking_number,
            confirmed_at=order.confirmed_at,
            return_request=(
                ReturnRequestOut.model_validate(order.return_requests[-1], from_attributes=True)
                if order.return_requests
                else None
            ),
            created_at=order.created_at,
            items=items,
        )


class OrderStatusEntryOut(CamelModel):
    status: str
    label: str
    changed_at: datetime

    @classmethod
    def from_model(cls, entry: OrderStatusHistory) -> "OrderStatusEntryOut":
        return cls(status=entry.status, label=STATUS_LABELS[entry.status], changed_at=entry.changed_at)


class OrderDetailOut(OrderOut):
    timeline: list[OrderStatusEntryOut]

    @classmethod
    def from_model(cls, order: Order) -> "OrderDetailOut":
        return cls(
            **OrderOut.from_model(order).model_dump(),
            timeline=[OrderStatusEntryOut.from_model(entry) for entry in order.history],
        )


class OrderSummaryOut(CamelModel):
    id: int
    status: str
    status_label: str
    items_price: int
    shipping_fee: int
    points_used: int
    total_price: int
    created_at: datetime
    title: str
    image_url: str
    item_count: int

    @classmethod
    def from_model(cls, order: Order) -> "OrderSummaryOut":
        first = order.items[0]
        others = len(order.items) - 1
        items_price = sum(item.unit_price * item.quantity for item in order.items)
        return cls(
            id=order.id,
            status=order.status,
            status_label=STATUS_LABELS[order.status],
            items_price=items_price,
            shipping_fee=order.shipping_fee,
            points_used=order.points_used,
            total_price=order.total_price,
            created_at=order.created_at,
            title=first.product.name + (f" 외 {others}건" if others else ""),
            image_url=first.product.image_url,
            item_count=len(order.items),
        )
