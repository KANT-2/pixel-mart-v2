"""backend에서 uv run python -m scripts.make_admin 이메일 로 실행한다."""

import argparse
import asyncio

from sqlalchemy import select

from app.core.db import SessionLocal, engine
from app.models import User


async def make_admin(email: str) -> bool:
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            print("해당 이메일의 계정이 없어요. 먼저 가입하거나 로그인해 주세요.")
            return False
        user.role = "admin"
        await db.commit()
        print("관리자 권한을 설정했어요.")
        return True


async def main(email: str) -> None:
    try:
        await make_admin(email)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="기존 계정에 관리자 권한을 설정해요.")
    parser.add_argument("email")
    asyncio.run(main(parser.parse_args().email))
