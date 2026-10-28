# 배송 단계 진행 알림을 응답 이후(BackgroundTasks)에 보낸다 (이슈 #99)
# 요청 세션(db: DbSession)은 응답이 끝나면 닫히므로, 여기서는 반드시 새 세션을 직접 연다.
import logging

from app.core.db import SessionLocal
from app.services import notifications
from src.orders.domain.order import STATUS_LABELS  # 한글 라벨 — 읽기만 한다(수정 금지 파일)

logger = logging.getLogger(__name__)


async def send_advance_notification(order_id: int, new_status: str, user_id: int) -> None:
    """배송 단계가 바뀐 뒤 구매자에게 알림을 보낸다.

    원자성을 포기했으므로(상태 변경과 별도 트랜잭션), 여기서 실패해도 상태 변경 자체는 이미 끝난 뒤다.
    요청을 다시 실패시킬 수 없어 예외를 밖으로 던지지 않고 로그만 남긴다(재시도·큐는 이번 범위 밖).
    """
    try:
        async with SessionLocal() as session:
            await notifications.notify(
                session,
                user_id,
                f"order_{new_status}",
                "배송 상태가 바뀌었어요",
                f"주문번호 {order_id} · {STATUS_LABELS[new_status]}",
                f"/mypage/orders/{order_id}",
                f"order:{order_id}:{new_status}",
            )
            await session.commit()
    except Exception:
        logger.exception("배송 단계 진행 알림 보내기 실패 — order_id=%s, new_status=%s", order_id, new_status)
