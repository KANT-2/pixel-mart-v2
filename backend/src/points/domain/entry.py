from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PointEntry:
    id: int
    order_id: int
    kind: str
    amount: int
    created_at: datetime
