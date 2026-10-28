"""add review replies

Revision ID: b7d4e6a19c20
Revises: a07145b560a3
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7d4e6a19c20"
down_revision: str | None = "a07145b560a3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("reviews", sa.Column("reply", sa.String(length=500), nullable=True))
    op.add_column("reviews", sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("reviews", "replied_at")
    op.drop_column("reviews", "reply")
