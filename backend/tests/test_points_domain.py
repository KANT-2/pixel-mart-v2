import pytest

from src.points.domain.rules import InvalidPointUse, validate_point_use


def test_point_use_must_fit_balance_and_order_total():
    validate_point_use(500, 1_000, 15_000)
    with pytest.raises(InvalidPointUse, match="보유 포인트가 부족해요"):
        validate_point_use(1_001, 1_000, 15_000)
    with pytest.raises(InvalidPointUse, match="주문 금액보다 많은 포인트"):
        validate_point_use(16_000, 20_000, 15_000)
