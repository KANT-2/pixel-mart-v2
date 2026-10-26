from typing import Annotated

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.schemas.common import CamelModel
from src.admin_products.domain.product import AdminProduct, ProductDraft, Rarity

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
ImageUrl = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]


class ProductCreateIn(CamelModel):
    name: Name
    price: Annotated[int, Field(ge=100, le=1_000_000)]
    category_slug: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
    description: Description
    image_url: ImageUrl
    is_new: bool = False
    stock: Annotated[int, Field(ge=0, le=9_999)]
    rarity: Rarity = "common"

    @field_validator("image_url")
    @classmethod
    def image_must_be_site_path(cls, value: str) -> str:
        if not value.startswith("/images/"):
            raise ValueError("상품 이미지는 /images/ 경로만 쓸 수 있어요.")
        return value

    def to_draft(self) -> ProductDraft:
        return ProductDraft(**self.model_dump())


class ProductUpdateIn(CamelModel):
    name: Name | None = None
    price: Annotated[int, Field(ge=100, le=1_000_000)] | None = None
    category_slug: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)] | None = None
    description: Description | None = None
    image_url: ImageUrl | None = None
    is_new: bool | None = None
    stock: Annotated[int, Field(ge=0, le=9_999)] | None = None
    rarity: Rarity | None = None
    is_hidden: bool | None = None

    @field_validator("image_url")
    @classmethod
    def image_must_be_site_path(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith("/images/"):
            raise ValueError("상품 이미지는 /images/ 경로만 쓸 수 있어요.")
        return value

    @model_validator(mode="after")
    def require_values_for_changed_fields(self) -> "ProductUpdateIn":
        if not self.model_fields_set:
            raise ValueError("바꿀 상품 정보를 보내 주세요.")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("상품 정보는 null로 바꿀 수 없어요.")
        return self

    def changes(self) -> dict[str, object]:
        return {field: getattr(self, field) for field in self.model_fields_set}


class AdminProductOut(CamelModel):
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
    is_hidden: bool

    @classmethod
    def from_domain(cls, product: AdminProduct) -> "AdminProductOut":
        return cls(**product.__dict__)
