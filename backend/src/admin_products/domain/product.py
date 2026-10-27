from dataclasses import dataclass
from typing import Literal

Rarity = Literal["common", "rare", "epic", "unique"]


@dataclass(frozen=True)
class ProductDraft:
    name: str
    price: int
    category_slug: str
    description: str
    image_url: str
    is_new: bool
    stock: int
    rarity: Rarity


@dataclass(frozen=True)
class AdminProduct:
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
