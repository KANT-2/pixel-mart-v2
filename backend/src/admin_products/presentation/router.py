from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import AdminUser, DbSession
from app.schemas.common import Page
from app.services.rarity import Rarity
from src.admin_products.application.service import AdminProductService
from src.admin_products.infrastructure.repositories import AdminProductRepository
from src.admin_products.presentation.schemas import AdminProductOut, ProductCreateIn, ProductUpdateIn

router = APIRouter(prefix="/admin/products", tags=["admin"])


def _service(db: DbSession) -> AdminProductService:
    return AdminProductService(AdminProductRepository(db), db)


@router.get("", response_model=Page[AdminProductOut], summary="[관리자] 상품 목록 (숨김·품절 포함)")
async def list_products(
    _admin: AdminUser,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=60)] = None,
    category: Annotated[str | None, Query(max_length=30)] = None,
    rarity: Rarity | None = None,
    hidden: bool | None = None,
    sold_out: Annotated[bool | None, Query(alias="soldOut")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
) -> Page[AdminProductOut]:
    query = q.strip() if q and q.strip() else None
    products, total = await _service(db).list_products(query, category, rarity, hidden, sold_out, page, size)
    return Page[AdminProductOut](
        items=[AdminProductOut.from_domain(product) for product in products],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.post("", response_model=AdminProductOut, status_code=status.HTTP_201_CREATED, summary="[관리자] 상품 등록")
async def create_product(body: ProductCreateIn, _admin: AdminUser, db: DbSession) -> AdminProductOut:
    product = await _service(db).create_product(body.to_draft())
    return AdminProductOut.from_domain(product)


@router.patch("/{product_id}", response_model=AdminProductOut, summary="[관리자] 상품 수정 · 숨김 · 재고 조정")
async def update_product(product_id: int, body: ProductUpdateIn, _admin: AdminUser, db: DbSession) -> AdminProductOut:
    product = await _service(db).update_product(product_id, body.changes())
    return AdminProductOut.from_domain(product)
