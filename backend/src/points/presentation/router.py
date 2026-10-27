from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.common import Page
from src.points.application.service import PointService
from src.points.infrastructure.repositories import PointRepository
from src.points.presentation.schemas import PointBalanceOut, PointTransactionOut

router = APIRouter(prefix="/users/me/points", tags=["points"])


def _service(db: DbSession) -> PointService:
    return PointService(PointRepository(db))


@router.get("", response_model=PointBalanceOut, summary="내 구매 포인트 잔액")
async def get_point_balance(user: CurrentUser, db: DbSession) -> PointBalanceOut:
    return PointBalanceOut(balance=await _service(db).balance(user.id))


@router.get("/history", response_model=Page[PointTransactionOut], summary="내 구매 포인트 적립·사용 기록")
async def list_point_history(
    user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
) -> Page[PointTransactionOut]:
    rows, total = await _service(db).history(user.id, page, size)
    return Page[PointTransactionOut](
        items=[PointTransactionOut.from_domain(row) for row in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )
