from typing import Protocol

from src.admin_trades.domain.moderation import AdminTradeStatus, TradeNotFound, TradeState, moderate, newly_hidden


class AdminTrades(Protocol):
    async def state(self, post_id: int) -> TradeState | None: ...
    async def set_state(self, post_id: int, status: str, hidden_by_admin: bool) -> None: ...
    async def notify_hidden(self, post: TradeState) -> None: ...


class Transaction(Protocol):
    async def commit(self) -> None: ...
    async def rollback(self) -> None: ...


class AdminTradeService:
    def __init__(self, trades: AdminTrades, tx: Transaction) -> None:
        self.trades = trades
        self.tx = tx

    async def change_status(self, post_id: int, target: AdminTradeStatus) -> None:
        post = await self.trades.state(post_id)
        if post is None:
            raise TradeNotFound()
        status, hidden_by_admin = moderate(post, target)
        try:
            await self.trades.set_state(post_id, status, hidden_by_admin)
            if newly_hidden(post, target):
                await self.trades.notify_hidden(post)
            await self.tx.commit()
        except Exception:
            await self.tx.rollback()
            raise
