from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query

from app.schemas.common import Page


@dataclass(frozen=True)
class PaginationParams:
    page: int = 1
    size: int = 12

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
) -> PaginationParams:
    return PaginationParams(page=page, size=size)


Pagination = Annotated[PaginationParams, Depends(get_pagination)]

__all__ = ["Page", "Pagination", "PaginationParams", "get_pagination"]
