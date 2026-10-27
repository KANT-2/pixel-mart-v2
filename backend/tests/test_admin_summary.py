# 관리자 대시보드 요약 API 테스트 — test_admin_orders_api.py와 같은 패턴(실제 로컬 DB·실제 HTTP 호출)
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, text

from app.core.db import SessionLocal, engine
from app.models import CancelRequest, Order, OrderItem, OrderStatusHistory, User
from app.models.product import Category, Product
from app.models.question import ProductQuestion
from src.admin_summary.application.service import kst_today_start
from src.admin_summary.infrastructure.repositories import AdminSummaryRepository
from tests.conftest import headers, login


# kst_today_start는 DB 없이도 순수하게 확인할 수 있다 — now를 주입해 "현재 시각"에 의존하지 않는다
def test_kst_today_start_truncates_to_kst_midnight():
    # UTC 2024-01-01 15:30 == KST 2024-01-02 00:30 → KST 자정은 2024-01-02 00:00(KST)
    now = datetime(2024, 1, 1, 15, 30, tzinfo=UTC)
    start = kst_today_start(now)
    assert start == datetime(2024, 1, 2, 0, 0, tzinfo=timezone(timedelta(hours=9)))


def test_kst_today_start_is_idempotent_within_same_kst_day():
    # 같은 KST 날짜 안에서는 몇 시에 넣어도 같은 자정이 나온다
    morning = datetime(2024, 1, 2, 0, 1, tzinfo=UTC)  # KST 09:01
    night = datetime(2024, 1, 2, 14, 59, tzinfo=UTC)  # KST 23:59
    assert kst_today_start(morning) == kst_today_start(night)


@dataclass(frozen=True)
class Scenario:
    product_id: int
    order_id: int
    question_id: int


@pytest.fixture
async def tag():
    # 로컬 DB가 없거나 마이그레이션 전이면 건너뛴다 (다른 admin_orders 테스트와 같은 방식)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM orders LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    # 이 테스트가 만든 데이터만 지운다 (주문·품목·이력·취소요청은 User 삭제 시 CASCADE로 같이 지워진다)
    async with SessionLocal() as session:
        await session.execute(delete(ProductQuestion).where(ProductQuestion.title.like(f"adminsummary-{value}%")))
        await session.execute(delete(User).where(User.email.like(f"adminsummary-{value}%@pixelmart.test")))
        await session.execute(delete(Product).where(Product.category_slug.like(f"adminsummary-{value}%")))
        await session.execute(delete(Category).where(Category.slug.like(f"adminsummary-{value}%")))
        await session.commit()


async def _make_scenario(tag: str) -> Scenario:
    """오늘 들어온 preparing 주문 1건 + requested 취소 요청 1건 + 미답변 문의 1건을 만든다"""
    category_slug = f"adminsummary-{tag}"
    async with SessionLocal() as session:
        session.add(Category(slug=category_slug, name=f"관리자요약테스트{tag}", description="", sort_order=999))
        buyer = User(email=f"adminsummary-{tag}-buyer@pixelmart.test", nickname=f"구매자{tag}", password_hash=None)
        product = Product(
            name=f"관리자 요약 테스트 상품 {tag}",
            stock=10,
            price=5_000,
            category_slug=category_slug,
            image_url="/images/products/test-only.png",
            description="테스트 전용",
            is_new=False,
        )
        session.add_all([buyer, product])
        await session.flush()
        order = Order(
            user_id=buyer.id,
            status="preparing",
            shipping_fee=3_000,
            total_price=13_000,
            recipient_name="홍길동",
            address="서울시 픽셀로 8",
            items=[OrderItem(product_id=product.id, quantity=2, unit_price=5_000)],
            history=[OrderStatusHistory(status="paid"), OrderStatusHistory(status="preparing")],
        )
        session.add(order)
        await session.flush()
        cancel_order = Order(
            user_id=buyer.id,
            status="cancel_requested",
            shipping_fee=3_000,
            total_price=13_000,
            recipient_name="홍길동",
            address="서울시 픽셀로 8",
            items=[OrderItem(product_id=product.id, quantity=1, unit_price=5_000)],
            history=[OrderStatusHistory(status="paid"), OrderStatusHistory(status="cancel_requested")],
        )
        session.add(cancel_order)
        await session.flush()
        session.add(CancelRequest(order_id=cancel_order.id, reason="단순 변심", status="requested"))
        question = ProductQuestion(
            product_id=product.id,
            user_id=buyer.id,
            title=f"adminsummary-{tag} 문의",
            content="아직 답변이 없는 문의예요",
            answer=None,
        )
        session.add(question)
        await session.flush()
        await session.commit()
        return Scenario(product.id, order.id, question.id)


async def admin_token(client, tag: str) -> str:
    token = await login(client, f"adminsummary-{tag}-boss@pixelmart.test", f"관리{tag}", admin=True)
    client.cookies.clear()
    return token


async def test_summary_counts_match_actual_data(client, tag):
    await _make_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/summary", headers=headers(token))
    assert res.status_code == 200
    body = res.json()

    # 방금 만든 시나리오가 각 숫자에 최소 1씩은 반영되어 있어야 한다(다른 테스트 데이터와 공존 가능)
    assert body["ordersToday"] >= 2  # preparing 주문 + cancel_requested 주문 둘 다 "오늘"
    assert body["preparingOrders"] >= 1
    assert body["pendingCancelRequests"] >= 1
    assert body["unansweredQuestions"] >= 1


async def test_no_login_is_401(client):
    res = await client.get("/api/admin/summary")
    assert res.status_code == 401


async def test_non_admin_user_gets_404(client, tag):
    token = await login(client, f"adminsummary-{tag}-user@pixelmart.test", f"일반{tag}")
    client.cookies.clear()
    res = await client.get("/api/admin/summary", headers=headers(token))
    assert res.status_code == 404


# 기존 4개 필드가 그대로인지 확인하는 회귀 테스트 — 응답 모양을 넓히면서 기존 필드를 지우지 않았는지 본다
async def test_existing_four_fields_are_unchanged(client, tag):
    await _make_scenario(tag)
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/summary", headers=headers(token))
    body = res.json()
    for key in ("ordersToday", "preparingOrders", "pendingCancelRequests", "unansweredQuestions"):
        assert key in body
        assert isinstance(body[key], int)


async def test_order_status_counts_has_all_six_statuses_and_reflects_scenario(client, tag):
    await _make_scenario(tag)  # preparing 주문 1건 + cancel_requested 주문 1건을 만든다
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/summary", headers=headers(token))
    counts = res.json()["orderStatusCounts"]
    # 6개 키가 전부 있어야 한다(0건인 상태도 빠지면 안 된다)
    assert set(counts.keys()) == {"paid", "preparing", "shipping", "delivered", "cancelRequested", "cancelled"}
    assert counts["preparing"] >= 1
    assert counts["cancelRequested"] >= 1


async def test_low_stock_products_via_api_respects_limit_and_excludes_hidden_and_above_threshold(client, tag):
    # API 전체 한도(20개)와 겹치지 않게, 레포지토리를 직접 호출해 정렬·임계값·숨김 제외를 확정적으로 확인한다
    category_slug = f"adminsummary-{tag}"
    async with SessionLocal() as session:
        session.add(Category(slug=category_slug, name=f"관리자요약재고테스트{tag}", description="", sort_order=999))
        await session.flush()
        def product(name: str, stock: int, *, hidden: bool = False) -> Product:
            return Product(
                name=name, stock=stock, price=1_000, category_slug=category_slug,
                image_url="/x.png", description="", is_new=False, is_hidden=hidden,
            )

        zero = product(f"재고0-{tag}", 0)
        one = product(f"재고1-{tag}", 1)
        ten = product(f"재고10-{tag}", 10)
        eleven = product(f"재고11-{tag}", 11)  # 임계값(10) 초과 — 제외
        hidden = product(f"숨김재고0-{tag}", 0, hidden=True)  # 숨김 — 재고가 적어도 제외
        session.add_all([zero, one, ten, eleven, hidden])
        await session.flush()
        ids = {"zero": zero.id, "one": one.id, "ten": ten.id, "eleven": eleven.id, "hidden": hidden.id}
        await session.commit()

    # 20개 한도와 상관없이 큰 limit으로 직접 불러 정렬·제외 규칙을 확인한다(기존 DB 데이터와 섞여도 안정적)
    async with SessionLocal() as session:
        rows = await AdminSummaryRepository(session).low_stock_products(threshold=10, limit=10_000)
    row_ids = [row.id for row in rows]
    assert ids["eleven"] not in row_ids  # 임계값 초과는 제외
    assert ids["hidden"] not in row_ids  # 숨김 상품은 제외

    our_rows = [row for row in rows if row.id in (ids["zero"], ids["one"], ids["ten"])]
    assert [row.id for row in our_rows] == [ids["zero"], ids["one"], ids["ten"]]  # 재고 오름차순 위치
    assert [row.stock for row in our_rows] == [0, 1, 10]
    assert all(row.rarity == "common" for row in our_rows)  # 기본 등급

    # API 응답은 언제나 20개를 넘지 않는다(전체 데이터 기준)
    token = await admin_token(client, tag)
    res = await client.get("/api/admin/summary", headers=headers(token))
    assert len(res.json()["lowStockProducts"]) <= 20
