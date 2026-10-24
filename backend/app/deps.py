"""라우터에서 공통으로 쓰는 의존성

사용 예:
    @router.get("/me")
    async def me(user: CurrentUser, db: DbSession): ...

로그인 확인은 src/common/auth.py 한 곳에서 한다 (Bearer·쿠키, 블랙리스트면 401) — 기존 라우터도 같은 검사를 받는다.
"""

from src.common.auth import AdminUser, CurrentUser, DbSession, OptionalUser

__all__ = ["AdminUser", "CurrentUser", "DbSession", "OptionalUser"]
