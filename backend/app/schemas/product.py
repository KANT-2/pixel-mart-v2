
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
    """상품 목록·상세 응답 — 로그인 사용자 찜 여부 포함"""

    is_wished: bool = False


class RarityOut(CamelModel):
    """관리자 지정 등급과 공개 상품 개수"""

    key: Rarity
    label: str
    count: int
