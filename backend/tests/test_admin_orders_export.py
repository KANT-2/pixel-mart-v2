# CSV 내보내기 + 배송 단계 알림(BackgroundTasks 분리) 테스트 — 이슈 #99
#
# httpx 테스트 클라이언트(ASGITransport)는 BackgroundTasks를 응답을 돌려주기 전에 실행해 버려서,
# "응답을 먼저 보내고 알림은 그 이후에" 라는 시간 순서 자체를 직접 재는 테스트는 만들 수 없다(이 환경의 한계).
# 대신 advance_order(알림을 더는 만들지 않음)와 send_advance_notification(자기 세션으로 알림을 만들고 커밋)을
# 나눠서, "알림 로직이 응답을 만드는 경로에서 완전히 분리됐다"는 걸 각각 확인한다.
import csv
import io
import uuid

import pytest
from sqlalchemy import delete, select, text

from app.core.db import SessionLocal, engine
from app.models import Notification, Order, User
from app.models.product import Category, Product
from src.admin_orders.infrastructure.background import send_advance_notification
from tests.conftest import headers, login
from tests.test_admin_orders_api import _make_order_scenario, admin_token


@pytest.fixture
async def tag():
    # test_admin_orders_api.py의 tag 픽스처와 같은 방식 — 같은 모듈에서 바로 import하면
    # 함수 인자 이름(tag)이 import한 이름을 가린다고 ruff가 오해해서(F811), 여기서 똑같이 둔다
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM orders LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    value = uuid.uuid4().hex[:8]
    yield value
    async with SessionLocal() as session:
        await session.execute(delete(User).where(User.email.like(f"adminorders-{value}%@pixelmart.test")))
        await session.execute(delete(Product).where(Product.category_slug.like(f"adminorders-{value}%")))
        await session.execute(delete(Category).where(Category.slug.like(f"adminorders-{value}%")))
        await session.commit()


async def test_export_csv_has_bom_header_and_applies_status_filter(client, tag):
    scenario = await _make_order_scenario(tag, order_status="delivered")
    other = await _make_order_scenario(f"{tag}other", order_status="paid")
    token = await admin_token(client, tag)

    # q=tag로 같이 좁혀서 이 테스트가 만든 두 주문만 보게 한다 — status만으로 거르면 다른 테스트가
    # 이미 만들어 둔(아직 지워지지 않은) delivered 주문들까지 같이 나온다
    res = await client.get(
        "/api/admin/orders/export.csv", params={"status": "delivered", "q": tag}, headers=headers(token)
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]

    body = res.content.decode("utf-8")
    assert body.startswith("﻿")  # 엑셀에서 한글이 깨지지 않도록 하는 BOM
    # 부분 문자열(in line)로 주문번호를 찾으면, 모든 주문의 total_price가 13_000으로 같아서
    # 다른 주문번호가 우연히 "13000" 안의 숫자와 겹쳐 실패할 수 있다 — 주문번호 칸만 정확히 비교한다
    rows = list(csv.reader(io.StringIO(body.removeprefix("﻿"))))
    header, order_number_column = rows[0], [row[0] for row in rows[1:]]
    assert header[:3] == ["주문번호", "주문일시", "상태"]
    assert str(scenario.order_id) in order_number_column
    assert str(other.order_id) not in order_number_column  # 상태 필터가 그대로 적용됨


async def test_export_csv_search_by_nickname_matches_list_filter(client, tag):
    scenario = await _make_order_scenario(tag, nickname=f"내보내기검색{tag}")
    token = await admin_token(client, tag)

    res = await client.get("/api/admin/orders/export.csv", params={"q": f"내보내기검색{tag}"}, headers=headers(token))
    body = res.content.decode("utf-8")
    assert str(scenario.order_id) in body


async def test_export_csv_no_login_is_401(client, tag):
    res = await client.get("/api/admin/orders/export.csv")
    assert res.status_code == 401


async def test_export_csv_non_admin_is_404(client, tag):
    token = await login(client, f"adminorders-{tag}-export-user@pixelmart.test", f"일반내보내기{tag}")
    client.cookies.clear()
    res = await client.get("/api/admin/orders/export.csv", headers=headers(token))
    assert res.status_code == 404


async def test_send_advance_notification_creates_notification_with_its_own_session(tag):
    scenario = await _make_order_scenario(tag, order_status="paid")
    async with SessionLocal() as session:
        order = await session.get(Order, scenario.order_id)
        user_id = order.user_id

    ref_key = f"order:{scenario.order_id}:preparing"
    await send_advance_notification(scenario.order_id, "preparing", user_id)

    async with SessionLocal() as session:
        notification = await session.scalar(select(Notification).where(Notification.ref_key == ref_key))
    assert notification is not None
    assert notification.title == "배송 상태가 바뀌었어요"


async def test_send_advance_notification_swallows_exceptions(tag, monkeypatch):
    # 알림이 실패해도(예: 알림 서버 문제) 상태 변경은 이미 끝난 뒤라 예외를 밖으로 던지지 않고 로그만 남긴다
    scenario = await _make_order_scenario(tag, order_status="paid")
    async with SessionLocal() as session:
        order = await session.get(Order, scenario.order_id)
        user_id = order.user_id

    async def boom(*args, **kwargs):
        raise RuntimeError("알림 서버가 잠깐 멈췄다고 가정한다")

    monkeypatch.setattr("src.admin_orders.infrastructure.background.notifications.notify", boom)

    await send_advance_notification(scenario.order_id, "preparing", user_id)  # 예외 없이 끝나야 한다
