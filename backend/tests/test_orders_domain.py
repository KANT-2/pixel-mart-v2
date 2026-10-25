import ast
from pathlib import Path

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.common.errors import domain_error_handler
from src.main import app as production_app
from src.orders.domain.exceptions import OutOfStock
from src.orders.domain.order import Order, OrderItem, summarize_prices
from src.orders.domain.stock import StockItem


@pytest.mark.parametrize(
    ("price", "shipping", "left"),
    [(29_000, 3_000, 1_000), (29_999, 3_000, 1), (30_000, 0, 0), (30_001, 0, 0)],
)
def test_shipping_boundary(price, shipping, left):
    order = Order((OrderItem(1, 1, price),))
    assert order.items_price == price
    assert order.shipping_fee == shipping
    assert order.total_price == price + shipping
    assert order.free_shipping_left == left


def test_order_sums_quantity_and_prices_and_copies_input():
    items = [OrderItem(1, 2, 10_000), OrderItem(2, 1, 9_999)]
    order = Order(items)
    items.clear()
    assert order.items_price == 29_999
    assert order.total_price == 32_999


def test_empty_order_is_rejected():
    with pytest.raises(ValueError, match="비어"):
        Order(())


def test_empty_price_summary_does_not_charge_shipping():
    prices = summarize_prices(())
    assert prices.items_price == 0
    assert prices.shipping_fee == 0
    assert prices.free_shipping_left == 30_000
    assert prices.total_price == 0


@pytest.mark.parametrize("quantity", [0, -1, 1.5, True])
def test_invalid_quantities_cannot_change_stock(quantity):
    stock = StockItem(1, 2)
    for action in (stock.take, stock.restore):
        with pytest.raises(ValueError):
            action(quantity)
        assert stock.stock == 2
    with pytest.raises(ValueError):
        OrderItem(1, quantity, 100)


@pytest.mark.parametrize("price", [-1, 1.5, True])
def test_invalid_unit_price_is_rejected(price):
    with pytest.raises(ValueError):
        OrderItem(1, 1, price)


@pytest.mark.parametrize("stock", [-1, 1.5, True])
def test_invalid_initial_stock_is_rejected(stock):
    with pytest.raises(ValueError):
        StockItem(1, stock)


@pytest.mark.parametrize(
    ("remaining", "message"),
    [(2, "재고가 부족해요. (남은 수량 2개)"), (0, "품절된 상품이에요.")],
)
def test_insufficient_stock_preserves_stock(remaining, message):
    item = StockItem(1, remaining)
    with pytest.raises(OutOfStock) as error:
        item.take(3)
    assert str(error.value) == message
    assert error.value.remaining == remaining
    assert item.stock == remaining


def test_take_exact_stock_then_restore():
    item = StockItem(1, 2)
    item.take(2)
    assert item.stock == 0
    item.restore(2)
    assert item.stock == 2


async def test_out_of_stock_uses_production_handler_and_returns_409():
    assert production_app.exception_handlers[OutOfStock] is domain_error_handler
    app = FastAPI()
    app.add_exception_handler(OutOfStock, domain_error_handler)

    @app.get("/probe")
    async def probe():
        StockItem(1, 0).take(1)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/probe")
    assert response.status_code == 409
    assert response.json() == {"detail": "품절된 상품이에요."}


def test_domain_imports_only_standard_library_and_own_domain():
    root = Path(__file__).resolve().parents[1] / "src" / "orders" / "domain"
    for path in root.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Import):
                assert all(alias.name.split(".")[0] == "dataclasses" for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.level == 0:
                assert node.module == "dataclasses"
