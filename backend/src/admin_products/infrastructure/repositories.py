from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Product
from src.admin_products.domain.product import AdminProduct, ProductDraft


def _to_domain(product: Product) -> AdminProduct:
    return AdminProduct(
        id=product.id,
        name=product.name,
        price=product.price,
        category=product.category.name,
        category_slug=product.category_slug,
        image_url=product.image_url,
        description=product.description,
        is_new=product.is_new,
        stock=product.stock,
        rarity=product.rarity,
        is_hidden=product.is_hidden,
    )


class AdminProductRepository:
    """상품 ORM과 관리자 상품 유스케이스를 연결한다. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def category_exists(self, category_slug: str) -> bool:
        return await self.session.scalar(select(Category.slug).where(Category.slug == category_slug)) is not None

    async def create(self, draft: ProductDraft) -> AdminProduct:
        product = Product(**draft.__dict__)
        self.session.add(product)
        await self.session.flush()
        saved = await self.get(product.id)
        assert saved is not None
        return saved

    async def get(self, product_id: int) -> AdminProduct | None:
        product = await self.session.scalar(
            select(Product).where(Product.id == product_id).execution_options(populate_existing=True)
        )
        return None if product is None else _to_domain(product)

    async def update(self, product_id: int, changes: dict[str, object]) -> None:
        product = await self.session.get(Product, product_id)
        assert product is not None
        for field, value in changes.items():
            setattr(product, field, value)
        await self.session.flush()

    async def list(
        self,
        query: str | None,
        category: str | None,
        rarity: str | None,
        hidden: bool | None,
        sold_out: bool | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AdminProduct], int]:
        filters = []
        if query:
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            filters.append(
                or_(Product.name.ilike(pattern, escape="\\"), Product.description.ilike(pattern, escape="\\"))
            )
        if category:
            filters.append(Product.category_slug == category)
        if rarity:
            filters.append(Product.rarity == rarity)
        if hidden is not None:
            filters.append(Product.is_hidden.is_(hidden))
        if sold_out is True:
            filters.append(Product.stock == 0)
        elif sold_out is False:
            filters.append(Product.stock > 0)

        total = await self.session.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
        rows = (
            await self.session.scalars(
                select(Product)
                .where(*filters)
                .order_by(Product.created_at.desc(), Product.id.desc())
                .offset(offset)
                .limit(limit)
                .execution_options(populate_existing=True)
            )
        ).all()
        return [_to_domain(product) for product in rows], total
