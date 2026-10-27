from datetime import datetime

from app.schemas.common import CamelModel
from src.points.domain.entry import PointEntry


class PointBalanceOut(CamelModel):
    balance: int


class PointTransactionOut(CamelModel):
    id: int
    order_id: int
    kind: str
    amount: int
    created_at: datetime

    @classmethod
    def from_domain(cls, record: PointEntry) -> "PointTransactionOut":
        return cls(
            id=record.id,
            order_id=record.order_id,
            kind=record.kind,
            amount=record.amount,
            created_at=record.created_at,
        )
