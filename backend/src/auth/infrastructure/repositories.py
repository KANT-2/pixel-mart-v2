from datetime import datetime

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, ProductQuestion, Report, Review, TradePost
from app.models.user import User
from app.services import notifications
from app.services.search import LIKE_ESCAPE, like_pattern
from src.auth.domain.account import Account
from src.auth.domain.member import MemberSummary
from src.auth.infrastructure.models import TokenBlacklist


def _to_account(user: User) -> Account:
    return Account(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        password_hash=user.password_hash,
        role=user.role,
    )


class UserRepository:
    """users 테이블 ↔ Account 변환. commit은 서비스가 한다."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_email(self, email: str) -> Account | None:
        user = await self.session.scalar(select(User).where(func.lower(User.email) == email.lower()))
        return _to_account(user) if user else None

    async def get_by_id(self, user_id: int) -> Account | None:
        user = await self.session.get(User, user_id)
        return _to_account(user) if user else None

    async def get_active_by_email(self, email: str) -> Account | None:
        """탈퇴하지 않은 계정만 — 비밀번호 재설정용"""
        query = select(User).where(func.lower(User.email) == email.lower(), User.deleted_at.is_(None))
        user = await self.session.scalar(query)
        return _to_account(user) if user else None

    async def set_password_hash(self, user_id: int, password_hash: str) -> None:
        user = await self.session.get(User, user_id)
        if user is not None:
            user.password_hash = password_hash

    async def email_exists(self, email: str) -> bool:
        query = select(User.id).where(func.lower(User.email) == email.lower()).limit(1)
        return await self.session.scalar(query) is not None

    async def nickname_exists(self, nickname: str) -> bool:
        # 기존 닉네임 규칙(app/services/nickname.py)과 같이 대소문자 구분 없이 비교
        query = select(User.id).where(func.lower(User.nickname) == nickname.lower()).limit(1)
        return await self.session.scalar(query) is not None

    async def add(self, account: Account) -> Account:
        user = User(email=account.email, nickname=account.nickname, password_hash=account.password_hash)
        self.session.add(user)
        await self.session.flush()  # id·role 기본값을 받아 온다
        return _to_account(user)


class MemberRepository:
    """관리자 회원 목록 — 닉네임·이메일 부분 일치 + 역할 필터 + 페이지"""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(
        self, q: str | None, role: str | None, suspended: bool | None, offset: int, limit: int
    ) -> tuple[list[MemberSummary], int]:
        conditions = []
        if q:
            pattern = like_pattern(q)
            conditions.append(
                or_(User.nickname.ilike(pattern, escape=LIKE_ESCAPE), User.email.ilike(pattern, escape=LIKE_ESCAPE))
            )
        if role:
            conditions.append(User.role == role)
        if suspended is not None:
            conditions.append(User.suspended.is_(suspended))
        total = await self.session.scalar(select(func.count()).select_from(User).where(*conditions))
        rows = await self.session.execute(
            _with_counts()
            .where(*conditions)
            .order_by(User.created_at.desc(), User.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [_to_summary(u, orders, reports) for u, orders, reports in rows], total or 0

    async def get(self, user_id: int) -> MemberSummary | None:
        row = (await self.session.execute(_with_counts().where(User.id == user_id))).first()
        return _to_summary(*row) if row else None

    async def set_suspended(self, user_id: int, suspended: bool) -> MemberSummary:
        await self.session.execute(update(User).where(User.id == user_id).values(suspended=suspended))
        await self.session.flush()
        self.session.expire_all()
        return await self.get(user_id)

    async def clear_avatar(self, user_id: int) -> MemberSummary:
        await self.session.execute(update(User).where(User.id == user_id).values(avatar_url=None))
        await self.session.flush()
        self.session.expire_all()
        return await self.get(user_id)

    async def notify_avatar_reset(self, user_id: int, ref_key: str, memo: str | None) -> None:
        """본인에게 알림 (ADMIN_API.md 8장 — 같은 아바타는 한 번만)"""
        body = f"사유: {memo}" if memo else "운영 정책에 맞지 않아 기본 모습으로 바꿨어요."
        await notifications.notify(
            self.session, user_id, "avatar_reset", "아바타가 기본 모습으로 바뀌었어요", body, "/mypage/avatar", ref_key
        )


def _with_counts():
    """회원 한 줄 + 주문 수 + 그 회원 콘텐츠(아바타 · 거래글 · 리뷰 · 문의)에 걸린 열린 신고 수"""
    order_count = select(func.count()).where(Order.user_id == User.id).correlate(User).scalar_subquery()
    owned = or_(
        (Report.target_type == "avatar") & (Report.target_id == User.id),
        (Report.target_type == "trade")
        & Report.target_id.in_(select(TradePost.id).where(TradePost.user_id == User.id)),
        (Report.target_type == "review") & Report.target_id.in_(select(Review.id).where(Review.user_id == User.id)),
        (Report.target_type == "question")
        & Report.target_id.in_(select(ProductQuestion.id).where(ProductQuestion.user_id == User.id)),
    )
    report_count = select(func.count()).where(Report.status == "open", owned).correlate(User).scalar_subquery()
    return select(User, order_count, report_count)


def _to_summary(user: User, order_count: int = 0, report_count: int = 0) -> MemberSummary:
    return MemberSummary(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        role=user.role,
        google_linked=user.google_sub is not None,
        created_at=user.created_at,
        avatar_url=user.avatar_url,
        suspended=user.suspended,
        withdrawn=user.deleted_at is not None,
        order_count=order_count or 0,
        report_count=report_count or 0,
    )


class TokenBlacklistRepository:
    """로그아웃한 토큰의 jti 목록."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, jti: str, expires_at: datetime) -> None:
        # 같은 토큰으로 두 번 로그아웃해도 오류 없이 그대로 둔다
        query = (
            insert(TokenBlacklist).values(jti=jti, expires_at=expires_at).on_conflict_do_nothing(index_elements=["jti"])
        )
        await self.session.execute(query)

    async def contains(self, jti: str) -> bool:
        query = select(TokenBlacklist.id).where(TokenBlacklist.jti == jti).limit(1)
        return await self.session.scalar(query) is not None

    async def delete_expired(self, now: datetime) -> int:
        # 도메인 규칙(can_forget_blacklisted)과 같은 기준: 만료 시각이 now보다 "이전"인 줄만
        result = await self.session.execute(delete(TokenBlacklist).where(TokenBlacklist.expires_at < now))
        return result.rowcount or 0
