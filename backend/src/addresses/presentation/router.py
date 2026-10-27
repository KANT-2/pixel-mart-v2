# 내 배송지 — 주문서에서 불러 쓰는 주소록 (기본 배송지 1개)
from fastapi import APIRouter, HTTPException, status

from app.schemas.common import Message
from src.addresses.domain.rules import MAX_ADDRESSES
from src.addresses.infrastructure.models import ShippingAddress
from src.addresses.infrastructure.repositories import AddressRepository
from src.addresses.presentation.schemas import AddressIn, AddressOut
from src.common.auth import CurrentUser, DbSession

router = APIRouter(prefix="/users/me/addresses", tags=["addresses"])


async def _list(repo: AddressRepository, user_id: int) -> list[AddressOut]:
    return [AddressOut.from_model(row) for row in await repo.list_for_user(user_id)]


@router.get("", response_model=list[AddressOut], summary="내 배송지 목록 (기본 배송지 먼저)")
async def list_addresses(user: CurrentUser, db: DbSession) -> list[AddressOut]:
    return await _list(AddressRepository(db), user.id)


@router.post("", response_model=list[AddressOut], status_code=status.HTTP_201_CREATED, summary="배송지 추가")
async def add_address(body: AddressIn, user: CurrentUser, db: DbSession) -> list[AddressOut]:
    repo = AddressRepository(db)
    count = await repo.count(user.id)
    if count >= MAX_ADDRESSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"배송지는 {MAX_ADDRESSES}개까지 저장할 수 있어요.")
    is_default = body.is_default or count == 0  # 첫 배송지는 자동으로 기본
    if is_default:
        await repo.clear_default(user.id)
    db.add(ShippingAddress(user_id=user.id, **body.model_dump(exclude={"is_default"}), is_default=is_default))
    await db.commit()
    return await _list(repo, user.id)


@router.put("/{address_id}", response_model=list[AddressOut], summary="배송지 수정 (기본 배송지 지정 포함)")
async def update_address(address_id: int, body: AddressIn, user: CurrentUser, db: DbSession) -> list[AddressOut]:
    repo = AddressRepository(db)
    row = await repo.get(user.id, address_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "배송지를 찾을 수 없어요.")
    if body.is_default and not row.is_default:
        await repo.clear_default(user.id)
        row.is_default = True
    for field, value in body.model_dump(exclude={"is_default"}).items():
        setattr(row, field, value)
    await db.commit()
    return await _list(repo, user.id)


@router.delete("/{address_id}", response_model=Message, summary="배송지 삭제 (기본이면 최근 배송지가 기본이 된다)")
async def delete_address(address_id: int, user: CurrentUser, db: DbSession) -> Message:
    repo = AddressRepository(db)
    row = await repo.get(user.id, address_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "배송지를 찾을 수 없어요.")
    was_default = row.is_default
    await db.delete(row)
    await db.flush()
    if was_default:
        await repo.promote_latest(user.id)
    await db.commit()
    return Message(message="배송지를 지웠어요.")
