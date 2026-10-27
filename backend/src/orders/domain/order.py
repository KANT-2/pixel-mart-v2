from dataclasses import dataclass

FREE_SHIPPING_MINIMUM = 30_000
SHIPPING_FEE = 3_000

STATUS_LABELS = {
    "paid": "주문 완료",
    "preparing": "상품 준비중",
    "shipping": "배송중",
    "delivered": "배송 완료",
    "cancel_requested": "취소 요청",
    "cancelled": "취소 완료",
    "return_requested": "반품 요청",
    "returned": "반품 완료",
    "exchange_requested": "교환 요청",
}


@dataclass(frozen=True)
class PriceSummary:
    items_price: int
    shipping_fee: int
    free_shipping_left: int

    @property
    def total_price(self) -> int:
        return self.items_price + self.shipping_fee


@dataclass(frozen=True)
class OrderItem:
    product_id: int
    quantity: int
    unit_price: int

    def __post_init__(self) -> None:
        if type(self.quantity) is not int or self.quantity < 1:
            raise ValueError("수량은 1 이상의 정수여야 해요.")
        if type(self.unit_price) is not int or self.unit_price < 0:
            raise ValueError("가격은 0 이상의 정수여야 해요.")

    @property
    def subtotal(self) -> int:
        return self.quantity * self.unit_price


def summarize_prices(items: tuple[OrderItem, ...]) -> PriceSummary:
    items_price = sum(item.subtotal for item in items)
    shipping_fee = 0 if not items or items_price >= FREE_SHIPPING_MINIMUM else SHIPPING_FEE
    return PriceSummary(
        items_price=items_price,
        shipping_fee=shipping_fee,
        free_shipping_left=max(0, FREE_SHIPPING_MINIMUM - items_price),
    )


@dataclass(frozen=True)
class Order:
    items: tuple[OrderItem, ...]

    def __post_init__(self) -> None:
        # 호출부의 목록 변경으로 주문 금액이 달라지지 않도록 품목을 고정한다.
        object.__setattr__(self, "items", tuple(self.items))
        if not self.items:
            raise ValueError("주문 품목이 비어 있어요.")

    @property
    def items_price(self) -> int:
        return self.price_summary.items_price

    @property
    def shipping_fee(self) -> int:
        return self.price_summary.shipping_fee

    @property
    def total_price(self) -> int:
        return self.price_summary.total_price

    @property
    def free_shipping_left(self) -> int:
        return self.price_summary.free_shipping_left

    @property
    def price_summary(self) -> PriceSummary:
        return summarize_prices(self.items)
