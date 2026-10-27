from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

from app.schemas.common import CamelModel
from src.addresses.domain.rules import check_postal_code, normalize_phone
from src.addresses.infrastructure.models import ShippingAddress

Phone = Annotated[str, StringConstraints(strip_whitespace=True, max_length=20), AfterValidator(normalize_phone)]
PostalCode = Annotated[str, StringConstraints(max_length=10), AfterValidator(check_postal_code)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
RecipientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
AddressDetail = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class AddressIn(CamelModel):
    label: Label
    recipient_name: RecipientName
    phone: Phone
    postal_code: PostalCode
    address: Address
    address_detail: AddressDetail = ""
    is_default: bool = False


class AddressOut(CamelModel):
    id: int
    label: str
    recipient_name: str
    phone: str
    postal_code: str
    address: str
    address_detail: str
    is_default: bool
    created_at: datetime

    @classmethod
    def from_model(cls, row: ShippingAddress) -> "AddressOut":
        return cls(
            id=row.id,
            label=row.label,
            recipient_name=row.recipient_name,
            phone=row.phone,
            postal_code=row.postal_code,
            address=row.address,
            address_detail=row.address_detail,
            is_default=row.is_default,
            created_at=row.created_at,
        )
