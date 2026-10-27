FIRST_PURCHASE_BONUS = 1_000


class InvalidPointUse(Exception):
    pass


def validate_point_use(requested: int, balance: int, order_total: int) -> None:
    if type(requested) is not int or requested < 0:
        raise InvalidPointUse("사용 포인트는 0 이상의 정수여야 해요.")
    if requested > balance:
        raise InvalidPointUse("보유 포인트가 부족해요.")
    if requested > order_total:
        raise InvalidPointUse("주문 금액보다 많은 포인트를 사용할 수 없어요.")
