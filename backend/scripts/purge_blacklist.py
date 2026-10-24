"""backend에서 uv run python -m scripts.purge_blacklist 로 실행한다.

로그아웃한 토큰 중 이미 만료된 것의 블랙리스트 줄만 지워요 (만료 전 줄은 남겨서 같은 토큰 401이 그대로).
"""

import asyncio

from app.core.db import SessionLocal, engine
from src.auth.application.service import AuthService
from src.auth.infrastructure.repositories import TokenBlacklistRepository, UserRepository


async def purge() -> int:
    async with SessionLocal() as db:
        service = AuthService(UserRepository(db), TokenBlacklistRepository(db), db)
        removed = await service.purge_expired_blacklist()
    # jti·사용자 정보는 찍지 않고 개수만
    print(f"만료된 토큰 {removed}개를 블랙리스트에서 정리했어요.")
    return removed


async def main() -> None:
    try:
        await purge()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
