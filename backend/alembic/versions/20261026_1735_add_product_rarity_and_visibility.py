"""add product rarity and visibility

Revision ID: e74971cc6d7f
Revises: d6cb42e32a1b
Create Date: 2026-10-26 17:35:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e74971cc6d7f"
down_revision: str | None = "d6cb42e32a1b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("rarity", sa.String(length=10), server_default="common", nullable=False),
    )
    op.add_column(
        "products",
        sa.Column("is_hidden", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.execute(
        """
        UPDATE products
        SET rarity = CASE
            WHEN price < 10000 THEN 'common'
            WHEN price < 20000 THEN 'rare'
            WHEN price < 30000 THEN 'epic'
            ELSE 'unique'
        END
        """
    )


def downgrade() -> None:
    op.drop_column("products", "is_hidden")
    op.drop_column("products", "rarity")
