
from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession, OptionalUser
from app.models import Category, Product, User, Wishlist
from app.schemas.common import Page
from app.schemas.product import CategoryOut, ProductWithWishOut, RarityOut
from app.services.rarity import BY_KEY, TIERS
from app.services.search import LIKE_ESCAPE, like_pattern

router = APIRouter(tags=["products"])

# 인기순 = 찜 많은 순
WISH_COUNT = (
    select(func.count())
    .select_from(Wishlist)
    .where(Wishlist.product_id == Product.id)
    .scalar_subquery()
)

SORTS = {
    "new": (Product.is_new.desc(), Product.id.desc()),
    "price_asc": (Product.price.asc(), Product.id.asc()),
    "price_desc": (Product.price.desc(), Product.id.asc()),
    "popular": (WISH_COUNT.desc(), Product.id.asc()),
    "id": (Product.id.asc(),),
}


async def wished_ids(
    db: DbSession,
    user: User | None,
    product_ids: list[int],
) -> set[int]:
    if user is None or not product_ids:
        return set()

    rows = await db.scalars(
        select(Wishlist.product_id).where(
            Wishlist.user_id == user.id,
            Wishlist.product_id.in_(product_ids),
        )
    )
    return set(rows)


def with_wish(product: Product, wished: set[int]) -> ProductWithWishOut:
    return ProductWithWishOut.from_model(product).model_copy(
        update={"is_wished": product.id in wished}
    )


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: DbSession):
    result = await db.scalars(
        select(Category).order_by(Category.sort_order)
    )
    return result.all()


def category_filter(category: str | None) -> list:
    slugs = [
        slug.strip()
        for slug in (category or "").split(",")
        if slug.strip()
    ]
    return [Product.category_slug.in_(slugs)] if slugs else []


@router.get(
    "/rarities",
    response_model=list[RarityOut],
    summary="관리자 지정 등급별 상품 개수",
)
async def list_rarities(
    db: DbSession,
    category: Annotated[
        str | None,
        Query(
            max_length=200,
            description="이 카테고리 안에서만 개수 세기",
        ),
    ] = None,
):
    # 숨긴 상품은 일반 사용자용 등급 개수에서 제외한다.
    filters = [
        Product.is_hidden.is_(False),
        *category_filter(category),
    ]

    out = []

    for tier in TIERS:
        count = await db.scalar(
            select(func.count())
            .select_from(Product)
            .where(*filters, Product.rarity == tier.key)
        ) or 0

        out.append(
            RarityOut(
                key=tier.key,
                label=tier.label,
                count=count,
            )
        )

    return out


@router.get(
    "/products",
    response_model=Page[ProductWithWishOut],
)
async def list_products(
    db: DbSession,
    user: OptionalUser,
    category: Annotated[
        str | None,
        Query(
            max_length=200,
            description="카테고리 slug, 쉼표로 여러 개",
        ),
    ] = None,
    q: Annotated[
        str | None,
        Query(max_length=50, description="상품명·설명 검색어"),
    ] = None,
    min_price: Annotated[
        int | None,
        Query(alias="minPrice", ge=0),
    ] = None,
    max_price: Annotated[
        int | None,
        Query(alias="maxPrice", ge=0),
    ] = None,
    is_new: Annotated[
        bool | None,
        Query(alias="isNew"),
    ] = None,
    rarity: Annotated[
        str | None,
        Query(
            max_length=60,
            description="등급, 쉼표로 여러 개 선택 가능",
        ),
    ] = None,
    sort: Literal[
        "id",
        "new",
        "price_asc",
        "price_desc",
        "popular",
    ] = "id",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    if (
        min_price is not None
        and max_price is not None
        and min_price > max_price
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "최소 가격이 최대 가격보다 클 수 없습니다.",
        )

    # 일반 상품 목록과 검색에서는 숨긴 상품을 제외한다.
    filters = [
        Product.is_hidden.is_(False),
        *category_filter(category),
    ]

    if rarity:
        keys = [
            key.strip().lower()
            for key in rarity.split(",")
            if key.strip()
        ]

        if unknown := [key for key in keys if key not in BY_KEY]:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"알 수 없는 등급입니다: {', '.join(unknown)}",
            )

        if keys:
            # 가격이 아닌 products.rarity 컬럼으로 필터링한다.
            filters.append(Product.rarity.in_(keys))

    if q:
        keyword = like_pattern(q.strip())
        filters.append(
            or_(
                Product.name.ilike(
                    keyword,
                    escape=LIKE_ESCAPE,
                ),
                Product.description.ilike(
                    keyword,
                    escape=LIKE_ESCAPE,
                ),
            )
        )

    if min_price is not None:
        filters.append(Product.price >= min_price)

    if max_price is not None:
        filters.append(Product.price <= max_price)

    if is_new is not None:
        filters.append(Product.is_new.is_(is_new))

    total = await db.scalar(
        select(func.count())
        .select_from(Product)
        .where(*filters)
    ) or 0

    products = (
        await db.scalars(
            select(Product)
            .where(*filters)
            .order_by(*SORTS[sort])
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    wished = await wished_ids(
        db,
        user,
        [product.id for product in products],
    )

    return Page[ProductWithWishOut](
        items=[with_wish(product, wished) for product in products],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get(
    "/products/{product_id}",
    response_model=ProductWithWishOut,
)
async def get_product(
    product_id: int,
    db: DbSession,
    user: OptionalUser,
):
    product = await db.get(Product, product_id)

    # 존재하지 않는 상품과 숨긴 상품 모두 404로 처리한다.
    if product is None or product.is_hidden:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "상품을 찾을 수 없습니다.",
        )

    wished = await wished_ids(db, user, [product.id])
    return with_wish(product, wished)
