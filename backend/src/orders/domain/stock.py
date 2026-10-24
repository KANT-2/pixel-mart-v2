from dataclasses import dataclass

from .exceptions import OutOfStock


@dataclass
class StockItem:
    product_id: int
    stock: int

    def __post_init__(self) -> None:
        if type(self.stock) is not int or self.stock < 0:
            raise ValueError("재고는 0 이상의 정수여야 해요.")

    def take(self, quantity: int) -> None:
        self._validate_quantity(quantity)
        if quantity > self.stock:
            raise OutOfStock(self.stock)
        self.stock -= quantity

    def restore(self, quantity: int) -> None:
        self._validate_quantity(quantity)
        self.stock += quantity

    @staticmethod
    def _validate_quantity(quantity: int) -> None:
        if type(quantity) is not int or quantity < 1:
            raise ValueError("수량은 1 이상의 정수여야 해요.")
