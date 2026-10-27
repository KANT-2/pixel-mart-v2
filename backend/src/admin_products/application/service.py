from typing import Protocol

from src.admin_products.domain.exceptions import AdminProductNotFound, InvalidProductCategory
from src.admin_products.domain.product import AdminProduct, ProductDraft


class Products(Protocol):
    async def category_exists(self, category_slug: str) -> bool: ...
    async def create(self, draft: ProductDraft) -> AdminProduct: ...
    async def get(self, product_id: int) -> AdminProduct | None: ...
    async def update(self, product_id: int, changes: dict[str, object]) -> None: ...
    async def list(
        self,
        query: str | None,
        category: str | None,
        rarity: str | None,
        hidden: bool | None,
        sold_out: bool | None,
        offset: int,
        limit: int,
    ) -> tuple[list[AdminProduct], int]: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AdminProductService:
    def __init__(self, products: Products, tx: Transaction) -> None:
        self.products = products
        self.tx = tx

    async def list_products(
        self,
        query: str | None,
        category: str | None,
        rarity: str | None,
        hidden: bool | None,
        sold_out: bool | None,
        page: int,
        size: int,
    ) -> tuple[list[AdminProduct], int]:
        return await self.products.list(query, category, rarity, hidden, sold_out, (page - 1) * size, size)

    async def create_product(self, draft: ProductDraft) -> AdminProduct:
        await self._ensure_category(draft.category_slug)
        try:
            product = await self.products.create(draft)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        return product

    async def update_product(self, product_id: int, changes: dict[str, object]) -> AdminProduct:
        if "category_slug" in changes:
            await self._ensure_category(str(changes["category_slug"]))
        product = await self.products.get(product_id)
        if product is None:
            raise AdminProductNotFound()
        if "stock_set" in changes:
            # 절대 재고 설정값을 DB 컬럼명으로 바꾼다.
            stock_set = int(changes["stock_set"])
            changes = {key: value for key, value in changes.items() if key != "stock_set"}
            changes["stock"] = stock_set
        elif "stock" in changes:
            # 재입고 수량은 기존대로 현재 재고에 더한다.
            changes = {**changes, "stock": product.stock + int(changes["stock"])}
        try:
            await self.products.update(product_id, changes)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
        product = await self.products.get(product_id)
        if product is None:
            raise AdminProductNotFound()
        return product

    async def _ensure_category(self, category_slug: str) -> None:
        if not await self.products.category_exists(category_slug):
            raise InvalidProductCategory()
