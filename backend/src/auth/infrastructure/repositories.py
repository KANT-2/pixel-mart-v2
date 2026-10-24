from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
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

    async def search(self, q: str | None, role: str | None, offset: int, limit: int) -> tuple[list[MemberSummary], int]:
        conditions = []
        if q:
            pattern = like_pattern(q)
            conditions.append(
                or_(User.nickname.ilike(pattern, escape=LIKE_ESCAPE), User.email.ilike(pattern, escape=LIKE_ESCAPE))
            )
        if role:
            conditions.append(User.role == role)
        total = await self.session.scalar(select(func.count()).select_from(User).where(*conditions))
        rows = await self.session.scalars(
            select(User).where(*conditions).order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit)
        )
        members = [
            MemberSummary(
                id=u.id,
                email=u.email,
                nickname=u.nickname,
                role=u.role,
                google_linked=u.google_sub is not None,
                created_at=u.created_at,
            )
            for u in rows
        ]
        return members, total or 0


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
