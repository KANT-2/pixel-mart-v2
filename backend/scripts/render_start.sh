#!/usr/bin/env bash
# Render 시작 명령 — 마이그레이션 · 시드(재실행 안전) → 관리자 지정(ADMIN_EMAIL) → 시연 데이터(SHOWCASE_EMAIL) → 서버
set -e
uv run --no-sync alembic upgrade head
uv run --no-sync python -m scripts.seed
uv run --no-sync python -m scripts.seed_demo
if [ -n "$ADMIN_EMAIL" ]; then uv run --no-sync python -m scripts.make_admin "$ADMIN_EMAIL" || true; fi
# 발표 시연 데이터(주문 · 리뷰 · 문의 · 선물 · 교환 신청) — SHOWCASE_EMAIL 계정으로 한 번 로그인한 뒤부터
if [ -n "$SHOWCASE_EMAIL" ]; then uv run --no-sync python -m scripts.seed_showcase "$SHOWCASE_EMAIL" || true; fi
# 프록시(https) 뒤에서 원래 주소를 알도록 — uvicorn이 FORWARDED_ALLOW_IPS를 읽는다
export FORWARDED_ALLOW_IPS="*"
exec uv run --no-sync uvicorn src.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers
