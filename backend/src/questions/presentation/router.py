from math import ceil
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.deps import ActiveUser, AdminUser, CurrentUser, DbSession, OptionalUser
from app.schemas.common import Message, Page
from src.auth.domain.account import ADMIN_ROLE
from src.questions.application.service import QuestionService
from src.questions.infrastructure.repositories import QuestionRepository
from src.questions.presentation.schemas import AdminQuestionOut, AnswerIn, QuestionIn, QuestionOut

router = APIRouter(tags=["questions"])
# 관리자 API — 관리자가 아니거나 로그인하지 않았으면 404 (AdminUser), 로그아웃한 토큰은 401
admin_router = APIRouter(prefix="/admin/questions", tags=["admin"])


def _service(db: DbSession) -> QuestionService:
    return QuestionService(QuestionRepository(db), db)


@router.get(
    "/products/{product_id}/questions",
    response_model=Page[QuestionOut],
    summary="상품 문의 목록 (최신순 · 답변 여부 필터 · 비밀글은 작성자·관리자만 내용을 봄)",
)
async def list_questions(
    product_id: int,
    db: DbSession,
    user: OptionalUser,
    answered: Annotated[bool | None, Query(description="true 답변 완료만 · false 답변 대기만 · 비우면 전체")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
) -> Page[QuestionOut]:
    viewer_id = user.id if user else None
    is_admin = user is not None and user.role == ADMIN_ROLE
    rows, total = await _service(db).list_for_product(product_id, viewer_id, is_admin, answered, page, size)
    return Page[QuestionOut](
        items=[QuestionOut.from_view(view) for view in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.post(
    "/products/{product_id}/questions",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
    summary="문의 쓰기 (로그인 필요)",
)
async def create_question(product_id: int, body: QuestionIn, user: ActiveUser, db: DbSession) -> QuestionOut:
    view = await _service(db).ask(user.id, product_id, body.title, body.content, body.is_secret)
    return QuestionOut.from_view(view)


@router.delete("/questions/{question_id}", response_model=Message, summary="내 문의 삭제 (답변 전에만)")
async def delete_question(question_id: int, user: CurrentUser, db: DbSession) -> Message:
    await _service(db).delete(question_id, user.id)
    return Message(message="문의를 삭제했어요.")


@admin_router.get(
    "",
    response_model=Page[AdminQuestionOut],
    summary="[관리자] 문의 목록 (답변 여부 필터 · 상품 이름/제목 검색 · 비밀글 내용도 보임)",
)
async def list_admin_questions(
    admin: AdminUser,
    db: DbSession,
    answered: Annotated[bool | None, Query(description="false 답변 대기만 · true 답변 완료만 · 비우면 전체")] = None,
    q: Annotated[str | None, Query(max_length=100, description="상품 이름 또는 문의 제목")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 20,
) -> Page[AdminQuestionOut]:
    query = q.strip() if q and q.strip() else None
    rows, total = await _service(db).list_for_admin(admin.id, answered, query, page, size)
    return Page[AdminQuestionOut](
        items=[AdminQuestionOut.from_admin_view(view) for view in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@admin_router.post(
    "/{question_id}/answer",
    response_model=QuestionOut,
    summary="[관리자] 문의 답변 (한 번만 · 작성자에게 알림)",
)
async def answer_question(question_id: int, body: AnswerIn, admin: AdminUser, db: DbSession) -> QuestionOut:
    view = await _service(db).answer(question_id, body.answer, admin.id)
    return QuestionOut.from_view(view)
