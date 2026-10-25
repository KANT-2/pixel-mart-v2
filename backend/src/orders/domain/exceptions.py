class EmptyCart(Exception):
    """장바구니에 주문할 품목이 없을 때 발생한다."""

    def __init__(self) -> None:
        super().__init__("장바구니가 비어 있어요.")


class OutOfStock(Exception):
    """주문에 필요한 재고가 부족할 때 발생한다."""

    def __init__(self, remaining: int) -> None:
        message = "품절된 상품이에요." if remaining == 0 else f"재고가 부족해요. (남은 수량 {remaining}개)"
        super().__init__(message)
        self.remaining = remaining
