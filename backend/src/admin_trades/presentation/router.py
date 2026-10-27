from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from pydantic import Field

from app.deps import AdminUser, DbSession
from app.models import TradePost
from app.routers.local_trades import post_out
from app.schemas.common import CamelModel, Page
from app.schemas.local import TradePostOut
from app.services.regions import RegionTree, load_tree
from src.admin_trades.application.service import AdminTradeService
from src.admin_trades.domain.moderation import AdminTradeStatus
from src.admin_trades.infrastructure.repositories import AdminTradeRepository
from src.auth.domain.withdrawal import display_nickname
from src.common.pagination import Pagination

router = APIRouter(prefix="/admin/trades", tags=["admin"])


class AdminTradeOut(TradePostOut):
    """거래글 + 관리용 정보 (관리자만 보는 작성자 이메일 포함)"""

    author_nickname: str
    author_email: str


class AdminTradeStatusIn(CamelModel):
    status: AdminTradeStatus
    memo: str | None = Field(default=None, max_length=200)


def _out(post: TradePost, tree: RegionTree) -> AdminTradeOut:
    withdrawn = post.author.deleted_at is not None
    return AdminTradeOut(
        **post_out(post, tree, None).model_dump(),
        author_nickname=display_nickname(post.author.nickname, post.author.deleted_at),
        author_email="탈퇴한 계정" if withdrawn else post.author.email,
    )


@router.get("", response_model=Page[AdminTradeOut], summary="[관리자] 거래글 목록 (샘플 제외 · 상태 · 종류 · 검색)")
async def list_trades(
    _admin: AdminUser,
    db: DbSession,
    pagination: Pagination,
    status: Literal["open", "done", "hidden"] | None = None,
    kind: Literal["have", "want", "sell"] | None = None,
    q: Annotated[str | None, Query(max_length=100, description="물건 이름 · 내용 · 닉네임 · 이메일")] = None,
):
    keyword = q.strip() if q and q.strip() else None
    posts, total = await AdminTradeRepository(db).search(
        status, kind, keyword, (pagination.page - 1) * pagination.size, pagination.size
    )
    tree = await load_tree(db)
    return Page[AdminTradeOut](
        items=[_out(p, tree) for p in posts],
        total=total,
        page=pagination.page,
        size=pagination.size,
        total_pages=max(1, ceil(total / pagination.size)),
    )


@router.patch("/{post_id}", response_model=AdminTradeOut, summary="[관리자] 거래글 숨김 · 다시 보이기")
async def change_trade_status(post_id: int, body: AdminTradeStatusIn, _admin: AdminUser, db: DbSession):
    repo = AdminTradeRepository(db)
    await AdminTradeService(repo, db).change_status(post_id, body.status)
    return _out(await repo.get(post_id), await load_tree(db))
