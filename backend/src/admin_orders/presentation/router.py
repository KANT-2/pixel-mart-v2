# 관리자 주문 API — 목록·상세·단계 넘기기. 비즈니스 규칙·commit/rollback은 전부 AdminOrderService에 맡긴다.
import csv
import io
from collections.abc import AsyncIterator
from datetime import timedelta, timezone
from math import ceil
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query
from fastapi.responses import StreamingResponse

from app.deps import DbSession
from app.schemas.common import Page
from src.admin_orders.application.service import AdminOrderService
from src.admin_orders.domain.csv_export import sanitize_csv_cell
from src.admin_orders.domain.exceptions import InvalidTransition, OrderNotFound
from src.admin_orders.infrastructure.background import send_advance_notification
from src.admin_orders.infrastructure.repositories import AdminOrderRepository, AdminOrderRow
from src.admin_orders.presentation.schemas import (
    AdminOrderDetailOut,
    AdminOrderStatus,
    AdminOrderSummaryOut,
    TrackingIn,
)
from src.common.auth import AdminUser  # 관리자가 아니면 404, 로그인 안 했으면 401 (의존성이 알아서 처리)
from src.orders.domain.order import STATUS_LABELS  # 한글 라벨 — 읽기만 한다(수정 금지 파일)

# 이슈 #22 경로 그대로 — /api/admin/orders
router = APIRouter(prefix="/admin/orders", tags=["admin"])

KST = timezone(timedelta(hours=9))  # app/services/badges.py와 같은 값 — CSV 주문일시를 한국 시간으로 보여준다
CSV_HEADERS = ["주문번호", "주문일시", "상태", "구매자 닉네임", "구매자 이메일", "수령인", "배송주소", "상품", "금액"]


def _service(db: DbSession) -> AdminOrderService:
    # orders/presentation/router.py, cancel_router.py의 _service(db)와 같은 모양
    return AdminOrderService(AdminOrderRepository(db), db)


def _csv_line(fields: list[str]) -> str:
    buffer = io.StringIO()
    csv.writer(buffer).writerow(fields)
    return buffer.getvalue()


async def _orders_csv_rows(rows: list[AdminOrderRow]) -> AsyncIterator[str]:
    # 데이터가 많아지면 지금처럼 전체를 한 번에 조회하는 대신 서버 커서 스트리밍(AsyncSession.stream)으로 전환
    yield "﻿"  # 엑셀에서 한글이 깨지지 않도록 BOM(utf-8-sig)
    yield _csv_line(CSV_HEADERS)
    for row in rows:
        order = row.order
        items_summary = ", ".join(f"{item.product.name} x{item.quantity}" for item in order.items)
        fields = [
            str(order.id),
            order.created_at.astimezone(KST).strftime("%Y-%m-%d %H:%M:%S"),
            STATUS_LABELS[order.status],
            row.buyer_nickname,
            row.buyer_email,
            order.recipient_name,
            order.address,
            items_summary,
            str(order.total_price),
        ]
        yield _csv_line([sanitize_csv_cell(field) for field in fields])


@router.get("", response_model=Page[AdminOrderSummaryOut], summary="[관리자] 주문 목록 (상태 필터·검색·페이지)")
async def list_orders(
    admin: AdminUser,
    db: DbSession,
    order_status: Annotated[AdminOrderStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100, description="주문번호 또는 닉네임·이메일 부분 일치")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
) -> Page[AdminOrderSummaryOut]:
    # admin은 의존성이 "관리자만 통과"를 이미 검사했으니, 여기선 그냥 받기만 한다
    query = q.strip() if q and q.strip() else None
    rows, total = await _service(db).list_orders(order_status, query, page, size)
    return Page[AdminOrderSummaryOut](
        items=[AdminOrderSummaryOut.from_row(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


# "/{order_id}"(int)보다 먼저 등록해야 "export.csv"가 order_id로 오인되지 않는다
@router.get("/export.csv", summary="[관리자] 주문 CSV 내려받기 (상태 필터·검색은 목록과 동일하게 적용)")
async def export_orders_csv(
    admin: AdminUser,
    db: DbSession,
    order_status: Annotated[AdminOrderStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=100, description="주문번호 또는 닉네임·이메일 부분 일치")] = None,
) -> StreamingResponse:
    query = q.strip() if q and q.strip() else None
    rows = await _service(db).export_orders(order_status, query)
    return StreamingResponse(
        _orders_csv_rows(rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


@router.get("/{order_id}", response_model=AdminOrderDetailOut, summary="[관리자] 주문 상세")
async def get_order_detail(order_id: int, admin: AdminUser, db: DbSession) -> AdminOrderDetailOut:
    # 없는 주문이면 서비스가 OrderNotFound를 올리고, errors.py의 전역 핸들러가 404로 바꿔 준다
    row = await _service(db).get_order(order_id)
    return AdminOrderDetailOut.from_row(row)


@router.post("/{order_id}/advance", response_model=AdminOrderDetailOut, summary="[관리자] 배송 단계 진행")
async def advance_order(
    order_id: int, admin: AdminUser, db: DbSession, background_tasks: BackgroundTasks
) -> AdminOrderDetailOut:
    # 더 못 넘기면 InvalidTransition(409), 없으면 OrderNotFound(404) — 둘 다 전역 핸들러가 처리한다
    service = _service(db)
    new_status, user_id = await service.advance_order(order_id)
    # 구매자 알림은 응답 이후에 보낸다(이슈 #99) — 상태 변경과는 더 이상 한 트랜잭션이 아니다
    background_tasks.add_task(send_advance_notification, order_id, new_status, user_id)
    row = await service.get_order(order_id)  # 바뀐 상세를 다시 읽어 돌려준다
    return AdminOrderDetailOut.from_row(row)


# 운송장을 넣을 수 있는 상태 — 상품을 보낼 준비가 됐거나 이미 보낸 주문
TRACKABLE = ("preparing", "shipping", "delivered")


@router.put("/{order_id}/tracking", response_model=AdminOrderDetailOut, summary="[관리자] 택배사·운송장 번호 입력")
async def set_tracking(order_id: int, body: TrackingIn, admin: AdminUser, db: DbSession) -> AdminOrderDetailOut:
    repo = AdminOrderRepository(db)
    order = await repo.get_order_for_update(order_id)
    if order is None:
        raise OrderNotFound()
    if order.status not in TRACKABLE:
        await db.rollback()
        raise InvalidTransition("상품 준비중부터 운송장을 넣을 수 있어요.")
    order.courier, order.tracking_number = body.courier, body.tracking_number
    await db.commit()
    return AdminOrderDetailOut.from_row(await _service(db).get_order(order_id))
