from app.models import Product
from app.schemas.common import CamelModel
from app.services.rarity import Rarity


class CategoryOut(CamelModel):
    slug: str
    name: str
    description: str


class ProductOut(CamelModel):
    """프론트 상품 정보와 같은 모양 + categorySlug"""

    id: int
    name: str
    price: int
    category: str
    category_slug: str
    image_url: str
    description: str
    is_new: bool
    stock: int
    rarity: Rarity

    @classmethod
    def from_model(cls, product: Product) -> "ProductOut":
        return cls(
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
        )


class ProductWithWishOut(ProductOut):
    """상품 목록·상세 응답 — 로그인한 사용자의 찜 여부 포함"""

    is_wished: bool = False


class RarityOut(CamelModel):
    """등급별 카테고리 — 현재 가격 기준 응답, 다음 단계에서 변경"""

    key: Rarity
    label: str
    min_price: int
    max_price: int | None
    count: int
