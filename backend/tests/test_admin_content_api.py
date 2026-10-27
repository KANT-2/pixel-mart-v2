import uuid

import pytest
from sqlalchemy import text

from app.core.db import engine
from tests.conftest import headers, login


@pytest.fixture
async def content_ids():
    notices: list[int] = []
    faqs: list[int] = []
    yield notices, faqs
    async with engine.begin() as connection:
        await connection.execute(text("DELETE FROM notices WHERE id = ANY(:ids)"), {"ids": notices or [-1]})
        await connection.execute(text("DELETE FROM faqs WHERE id = ANY(:ids)"), {"ids": faqs or [-1]})


async def test_draft_notice_stays_private_until_published(client, content_ids):
    notices, _ = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    created = await client.post(
        "/api/admin/notices",
        json={"title": f"점검 안내 {uuid.uuid4().hex[:8]}", "content": "오늘 밤 점검합니다."},
        headers=headers(admin),
    )
    assert created.status_code == 201
    notice = created.json()
    notices.append(notice["id"])
    assert notice["isPublished"] is False
    assert (await client.get(f"/api/notices/{notice['id']}")).status_code == 404
    admin_list = await client.get("/api/admin/notices", headers=headers(admin))
    assert notice["id"] in [item["id"] for item in admin_list.json()["items"]]

    published = await client.patch(
        f"/api/admin/notices/{notice['id']}",
        json={"isPublished": True, "isPinned": True},
        headers=headers(admin),
    )
    assert published.status_code == 200
    public = await client.get("/api/notices", params={"pinned": "true"})
    assert notice["id"] in [item["id"] for item in public.json()["items"]]
    assert (await client.get(f"/api/notices/{notice['id']}")).json()["content"] == "오늘 밤 점검합니다."

    unpublished = await client.patch(
        f"/api/admin/notices/{notice['id']}",
        json={"isPublished": False},
        headers=headers(admin),
    )
    assert unpublished.status_code == 200
    assert (await client.get(f"/api/notices/{notice['id']}")).status_code == 404
    assert notice["id"] not in [item["id"] for item in (await client.get("/api/notices")).json()["items"]]


async def test_public_notices_put_pinned_first_and_paginate(client, content_ids):
    notices, _ = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    for pinned in (False, True):
        response = await client.post(
            "/api/admin/notices",
            json={
                "title": f"정렬 확인 {uuid.uuid4().hex[:8]}",
                "content": "공지 내용",
                "isPublished": True,
                "isPinned": pinned,
            },
            headers=headers(admin),
        )
        assert response.status_code == 201
        notices.append(response.json()["id"])

    listing = (await client.get("/api/notices", params={"size": 60})).json()
    ids = [row["id"] for row in listing["items"]]
    assert ids.index(notices[1]) < ids.index(notices[0])
    assert set(listing["items"][0]) == {"id", "title", "isPinned", "createdAt"}
    pinned_only = (await client.get("/api/notices", params={"pinned": True, "size": 60})).json()
    assert notices[1] in [row["id"] for row in pinned_only["items"]]
    assert notices[0] not in [row["id"] for row in pinned_only["items"]]
    page = (await client.get("/api/notices", params={"page": 2, "size": 1})).json()
    assert (page["page"], page["size"], page["totalPages"]) == (2, 1, max(1, listing["total"]))


async def test_admin_notice_access_and_validation(client, content_ids):
    notices, _ = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    created = await client.post(
        "/api/admin/notices",
        json={"title": f"권한 확인 {uuid.uuid4().hex[:8]}", "content": "내용"},
        headers=headers(admin),
    )
    assert created.status_code == 201
    notice_id = created.json()["id"]
    notices.append(notice_id)
    assert (await client.patch(f"/api/admin/notices/{notice_id}", json={}, headers=headers(admin))).status_code == 422
    null_title = await client.patch(f"/api/admin/notices/{notice_id}", json={"title": None}, headers=headers(admin))
    assert null_title.status_code == 422
    blank_title = await client.post(
        "/api/admin/notices", json={"title": " ", "content": "내용"}, headers=headers(admin)
    )
    assert blank_title.status_code == 422
    missing = await client.patch("/api/admin/notices/999999999", json={"title": "없음"}, headers=headers(admin))
    assert missing.status_code == 404
    assert (await client.get("/api/notices", params={"page": 0})).status_code == 422

    member = await login(client, "content-member@pixelmart.test")
    client.cookies.clear()
    assert (await client.get("/api/admin/notices", headers=headers(member))).status_code == 404
    forbidden = await client.patch(f"/api/admin/notices/{notice_id}", json={"title": "변경"}, headers=headers(member))
    assert forbidden.status_code == 404
    assert (await client.get("/api/admin/notices")).status_code == 401


async def test_admin_can_delete_notice(client, content_ids):
    notices, _ = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    created = await client.post(
        "/api/admin/notices",
        json={"title": f"삭제 확인 {uuid.uuid4().hex[:8]}", "content": "내용", "isPublished": True},
        headers=headers(admin),
    )
    assert created.status_code == 201
    notice_id = created.json()["id"]
    notices.append(notice_id)
    assert (await client.delete(f"/api/admin/notices/{notice_id}", headers=headers(admin))).status_code == 200
    assert (await client.get(f"/api/notices/{notice_id}")).status_code == 404
    assert (await client.delete(f"/api/admin/notices/{notice_id}", headers=headers(admin))).status_code == 404


async def test_admin_manages_faqs(client, content_ids):
    _, faqs = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    category = f"테스트-{uuid.uuid4().hex[:8]}"
    created = await client.post(
        "/api/admin/faqs",
        json={"category": category, "question": "교환은 되나요?", "answer": "가능합니다.", "sortOrder": 3},
        headers=headers(admin),
    )
    assert created.status_code == 201
    faq = created.json()
    faqs.append(faq["id"])
    public = await client.get("/api/faqs", params={"category": category})
    assert [item["id"] for item in public.json()] == [faq["id"]]

    updated = await client.patch(f"/api/admin/faqs/{faq['id']}", json={"sortOrder": 1}, headers=headers(admin))
    assert (updated.status_code, updated.json()["sortOrder"]) == (200, 1)
    listed = await client.get("/api/admin/faqs", headers=headers(admin))
    assert any(item["id"] == faq["id"] and item["sortOrder"] == 1 for item in listed.json())
    assert (await client.delete(f"/api/admin/faqs/{faq['id']}", headers=headers(admin))).status_code == 200
    assert (await client.get("/api/faqs", params={"category": category})).json() == []
    missing = await client.patch(
        f"/api/admin/faqs/{faq['id']}",
        json={"answer": "다시"},
        headers=headers(admin),
    )
    assert missing.status_code == 404


async def test_admin_faq_access_and_validation(client, content_ids):
    _, faqs = content_ids
    admin = await login(client, "content-admin@pixelmart.test", admin=True)
    created = await client.post(
        "/api/admin/faqs",
        json={"category": f"검증-{uuid.uuid4().hex[:8]}", "question": "질문", "answer": "답변"},
        headers=headers(admin),
    )
    assert created.status_code == 201
    faq_id = created.json()["id"]
    faqs.append(faq_id)
    assert (await client.patch(f"/api/admin/faqs/{faq_id}", json={}, headers=headers(admin))).status_code == 422
    null_order = await client.patch(f"/api/admin/faqs/{faq_id}", json={"sortOrder": None}, headers=headers(admin))
    assert null_order.status_code == 422
    invalid = await client.post(
        "/api/admin/faqs",
        json={"category": " ", "question": "질문", "answer": "답변"},
        headers=headers(admin),
    )
    assert invalid.status_code == 422

    member = await login(client, "content-member@pixelmart.test")
    client.cookies.clear()
    assert (await client.get("/api/admin/faqs", headers=headers(member))).status_code == 404
    assert (await client.delete(f"/api/admin/faqs/{faq_id}", headers=headers(member))).status_code == 404
    assert (await client.get("/api/admin/faqs")).status_code == 401
