"""backfill product rarity

Revision ID: b3f1c2d4e5a6
Revises: a07145b560a3
Create Date: 2026-10-28 11:00:00.000000

빈 DB에 마이그레이션을 먼저 하고 seed로 상품을 넣으면(배포) 등급이 모두 기본값 common으로 남는다.
가격대로 다시 채우되, 이미 common이 아닌 등급(관리자가 정한 값)은 건드리지 않는다.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b3f1c2d4e5a6"
down_revision: str | None = "a07145b560a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE products
        SET rarity = CASE
            WHEN price < 20000 THEN 'rare'
            WHEN price < 30000 THEN 'epic'
            ELSE 'unique'
        END
        WHERE rarity = 'common' AND price >= 10000
        """
    )


def downgrade() -> None:
    # 데이터만 채운 마이그레이션이라 되돌리지 않는다 (관리자가 정한 등급과 구분할 수 없음)
    pass
