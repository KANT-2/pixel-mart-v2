from dataclasses import dataclass

# 결제는 가상 결제 — 고른 수단만 기록해서 주문 상세에 보여 준다
PAYMENT_LABELS = {
    "card": "신용·체크카드",
    "easy_pay": "간편결제",
    "transfer": "계좌이체",
}

# 관리자가 운송장을 넣을 수 있는 택배사
COURIER_LABELS = {
    "cj": "CJ대한통운",
    "post": "우체국택배",
    "hanjin": "한진택배",
    "lotte": "롯데택배",
    "logen": "로젠택배",
}


@dataclass(frozen=True)
class ShippingInfo:
    recipient_name: str
    address: str
    phone: str = ""
    postal_code: str = ""
    address_detail: str = ""
    delivery_memo: str = ""
    payment_method: str = "card"
