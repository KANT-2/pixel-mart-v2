from dataclasses import dataclass

FREE_SHIPPING_MINIMUM = 30_000
SHIPPING_FEE = 3_000


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
        return sum(item.subtotal for item in self.items)

    @property
    def shipping_fee(self) -> int:
        return 0 if self.items_price >= FREE_SHIPPING_MINIMUM else SHIPPING_FEE

    @property
    def total_price(self) -> int:
        return self.items_price + self.shipping_fee

    @property
    def free_shipping_left(self) -> int:
        return max(0, FREE_SHIPPING_MINIMUM - self.items_price)
