# 관리자 대시보드 요약 API — 숫자 카드 4개를 한 번에 돌려준다. 읽기 전용이라 트랜잭션이 필요 없다.
from fastapi import APIRouter

from app.deps import DbSession
from src.admin_summary.application.service import AdminSummaryService
from src.admin_summary.infrastructure.repositories import AdminSummaryRepository
from src.admin_summary.presentation.schemas import AdminSummaryOut
from src.common.auth import AdminUser  # 관리자가 아니면 404, 로그인 안 했으면 401 (의존성이 알아서 처리)

router = APIRouter(prefix="/admin/summary", tags=["admin"])


@router.get("", response_model=AdminSummaryOut, summary="[관리자] 대시보드 숫자 카드 4개")
async def get_summary(admin: AdminUser, db: DbSession) -> AdminSummaryOut:
    # admin은 의존성이 "관리자만 통과"를 이미 검사했으니, 여기선 그냥 받기만 한다
    service = AdminSummaryService(AdminSummaryRepository(db))
    counts = await service.get_summary()
    return AdminSummaryOut.from_counts(counts)
