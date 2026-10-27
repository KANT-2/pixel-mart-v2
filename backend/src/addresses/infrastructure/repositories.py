from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.addresses.domain.rules import MAX_ADDRESSES
from src.addresses.infrastructure.models import ShippingAddress


class AddressRepository:
    """내 배송지 저장소. commit은 라우터가 한다"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(self, user_id: int) -> list[ShippingAddress]:
        rows = await self.session.scalars(
            select(ShippingAddress)
            .where(ShippingAddress.user_id == user_id)
            .order_by(ShippingAddress.is_default.desc(), ShippingAddress.created_at.desc(), ShippingAddress.id.desc())
        )
        return list(rows)

    async def count(self, user_id: int) -> int:
        return (
            await self.session.scalar(select(func.count(ShippingAddress.id)).where(ShippingAddress.user_id == user_id))
            or 0
        )

    async def get(self, user_id: int, address_id: int) -> ShippingAddress | None:
        return await self.session.scalar(
            select(ShippingAddress).where(ShippingAddress.id == address_id, ShippingAddress.user_id == user_id)
        )

    async def clear_default(self, user_id: int) -> None:
        # 기본 배송지는 한 사람에 하나 — 새 기본을 정하기 전에 기존 표시를 지운다
        await self.session.execute(
            update(ShippingAddress)
            .where(ShippingAddress.user_id == user_id, ShippingAddress.is_default.is_(True))
            .values(is_default=False)
        )
        await self.session.flush()

    async def promote_latest(self, user_id: int) -> None:
        """기본 배송지를 지웠으면 가장 최근 배송지를 기본으로"""
        latest = await self.session.scalar(
            select(ShippingAddress)
            .where(ShippingAddress.user_id == user_id)
            .order_by(ShippingAddress.created_at.desc(), ShippingAddress.id.desc())
            .limit(1)
        )
        if latest is not None:
            latest.is_default = True

    async def save_from_order(
        self, user_id: int, recipient_name: str, phone: str, postal_code: str, address: str, address_detail: str
    ) -> None:
        """주문서의 '기본 배송지로 저장' — 같은 주소가 있으면 그 배송지를 기본으로, 없으면 새로 만든다"""
        same = await self.session.scalar(
            select(ShippingAddress).where(
                ShippingAddress.user_id == user_id,
                ShippingAddress.postal_code == postal_code,
                ShippingAddress.address == address,
                ShippingAddress.address_detail == address_detail,
            )
        )
        if same is None and await self.count(user_id) >= MAX_ADDRESSES:
            return  # 가득 찼으면 주문만 하고 저장은 건너뛴다
        await self.clear_default(user_id)
        if same is not None:
            same.recipient_name, same.phone, same.is_default = recipient_name, phone, True
            return
        self.session.add(
            ShippingAddress(
                user_id=user_id,
                label="기본 배송지",
                recipient_name=recipient_name,
                phone=phone,
                postal_code=postal_code,
                address=address,
                address_detail=address_detail,
                is_default=True,
            )
        )
