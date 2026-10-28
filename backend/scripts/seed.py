"""상품·카테고리 시드 데이터 넣기 (여러 번 실행해도 같은 결과)

실행 (backend 폴더에서):  python -m scripts.seed
데이터 원본은 프론트의 data/*.ts → `node backend/scripts/export_seed.mjs` 로 backend/seed/*.json 갱신
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert

from app.core.db import SessionLocal, engine
from app.models import Category, Faq, Keyboard, KeycapSpec, Notice, Product
from app.services.rarity import rarity_of
from scripts.seed_local import seed_local

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


# 처음 여는 사이트의 공지 — 공지가 하나도 없을 때만 넣는다 (관리자가 고치거나 지운 공지는 다시 만들지 않음)
NOTICES = [
    {
        "title": "PIXEL MART 2차 오픈 안내",
        "content": "PIXEL MART가 새로워졌어요.\n\n"
        "- 이메일로 가입하고 로그인할 수 있어요.\n"
        "- 주문서에서 배송지 · 쿠폰 · 적립금 · 결제수단을 한 번에 고를 수 있어요.\n"
        "- 배송 조회, 구매 확정, 반품 · 교환 신청을 마이페이지에서 할 수 있어요.\n"
        "- 가입하면 웰컴 쿠폰을 드려요.",
        "is_pinned": True,
    },
    {
        "title": "배송 · 무료 배송 기준 안내",
        "content": "상품 합계 30,000원 이상이면 무료 배송, 미만이면 배송비 3,000원이에요.\n"
        "주문 완료 → 상품 준비중 → 배송중 → 배송 완료 순서로 진행되고, 단계가 바뀔 때마다 알림을 보내 드려요.\n"
        "배송 완료 뒤 구매 확정을 누르면 결제 금액의 1%가 적립돼요.",
        "is_pinned": False,
    },
    {
        "title": "PIXEL LOCAL 거래 · 교환 이용 수칙",
        "content": "동네 이웃과 안전하게 주고받기 위해 지켜 주세요.\n\n"
        "- 거래글에 전화번호 · 메신저 아이디 같은 연락처를 쓰지 않아요.\n"
        "- 교환은 앱 안의 교환 신청 · 수락 · 받았어요 순서로 진행해요.\n"
        "- 운영 정책에 맞지 않는 글은 숨겨질 수 있어요. 불편한 글은 신고해 주세요.",
        "is_pinned": False,
    },
]


def load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def main() -> None:
    categories = load("categories.json")
    products = load("products.json")
    faqs = load("faqs.json")
    keyboards = load("keyboards.json")
    keycap_specs = load("keycap_specs.json")
    slug_by_name = {c["name"]: c["slug"] for c in categories}

    async with SessionLocal() as db:
        for order, c in enumerate(categories):
            values = {"slug": c["slug"], "name": c["name"], "description": c["description"], "sort_order": order}
            stmt = insert(Category).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Category.slug], set_=values))

        for p in products:
            values = {
                "id": p["id"],
                "name": p["name"],
                "price": p["price"],
                "category_slug": slug_by_name[p["category"]],
                "image_url": p["imageUrl"],
                "description": p["description"],
                "is_new": p.get("isNew", False),
            }
            # 재실행해도 주문으로 줄어든 기존 재고와 관리자가 바꾼 등급은 보존한다 (처음 넣을 때만 가격대로 등급).
            stmt = insert(Product).values(**values, stock=30, rarity=rarity_of(p["price"]))
            await db.execute(stmt.on_conflict_do_update(index_elements=[Product.id], set_=values))

        # id를 직접 넣었으므로 다음 자동 번호를 최대값 뒤로 맞춤
        await db.execute(
            text("SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products))")
        )
        for order, f in enumerate(faqs):
            values = {**f, "sort_order": order}
            stmt = insert(Faq).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Faq.id], set_=values))
        await db.execute(text("SELECT setval(pg_get_serial_sequence('faqs', 'id'), (SELECT MAX(id) FROM faqs))"))
        if not await db.scalar(select(func.count()).select_from(Notice)):
            db.add_all(Notice(**n, is_published=True) for n in NOTICES)
        # 키캡 호환성: Mock 키보드와 키캡 상품의 규격 (상품이 먼저 들어간 뒤에 넣는다)
        for k in keyboards:
            values = {
                "id": k["id"],
                "maker": k["maker"],
                "model": k["model"],
                "layout": k["layout"],
                "stem": k["stem"],
                "profile_support": k["profileSupport"],
                "esc_size": k["escSize"],
                "spacebar_size": k["spacebarSize"],
                "has_arrow_cluster": k["hasArrowCluster"],
            }
            stmt = insert(Keyboard).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Keyboard.id], set_=values))
        await db.execute(
            text("SELECT setval(pg_get_serial_sequence('keyboards', 'id'), (SELECT MAX(id) FROM keyboards))")
        )
        for s in keycap_specs:
            values = {
                "product_id": s["productId"],
                "profile": s["profile"],
                "stem": s["stem"],
                "key_sizes": s["keySizes"],
            }
            stmt = insert(KeycapSpec).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[KeycapSpec.product_id], set_=values))
        local_summary = await seed_local(db)
        await db.commit()

    await engine.dispose()
    print(
        f"시드 완료: 카테고리 {len(categories)}개, 상품 {len(products)}개, FAQ {len(faqs)}개, "
        f"키보드 {len(keyboards)}개, 키캡 규격 {len(keycap_specs)}개, {local_summary}"
    )


if __name__ == "__main__":
    asyncio.run(main())
