import pytest
from sqlalchemy import text

from app.core.db import engine


@pytest.mark.parametrize(
    ("table", "columns"),
    [
        ("users", {"suspended", "deleted_at", "featured_badge"}),
        ("reviews", {"is_hidden"}),
        ("product_questions", {"is_hidden"}),
        ("trade_posts", {"hidden_by_admin"}),
        ("reports", {"reporter_id", "target_type", "target_id", "reason", "status", "resolved_at", "resolved_by"}),
        ("notices", {"title", "content", "is_pinned", "is_published", "created_by", "updated_at"}),
        ("badge_defs", {"code", "name", "description", "image", "rank", "is_active", "created_by"}),
        ("user_badges", {"user_id", "code", "earned_at", "granted_by", "memo"}),
    ],
)
async def test_additional_quest_schema_is_available(table, columns):
    try:
        async with engine.connect() as connection:
            actual = set(
                await connection.scalars(
                    text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'public' AND table_name = :table"
                    ),
                    {"table": table},
                )
            )
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")

    assert columns <= actual


async def test_reports_prevent_duplicate_open_reports_after_migration():
    async with engine.connect() as connection:
        index = await connection.scalar(
            text(
                "SELECT indexdef FROM pg_indexes "
                "WHERE schemaname = 'public' AND tablename = 'reports' "
                "AND indexname = 'uq_reports_open_reporter_target'"
            )
        )

    assert index is not None
    assert "status" in index and "open" in index
