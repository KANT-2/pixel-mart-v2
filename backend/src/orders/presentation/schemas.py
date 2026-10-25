from datetime import datetime
from typing import Annotated, Literal

from pydantic import StringConstraints

from app.models.order import Order, OrderItem, OrderStatusHistory
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut
from src.orders.domain.order import STATUS_LABELS

RecipientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
OrderStatus = Literal["paid", "preparing", "shipping", "delivered", "cancel_requested", "cancelled"]


class OrderCreate(CamelModel):
    recipient_name: RecipientName
    address: Address


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
    total_price: int
    recipient_name: str
    address: str
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
            total_price=order.total_price,
            recipient_name=order.recipient_name,
            address=order.address,
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
            total_price=order.total_price,
            created_at=order.created_at,
            title=first.product.name + (f" 외 {others}건" if others else ""),
            image_url=first.product.image_url,
            item_count=len(order.items),
        )
