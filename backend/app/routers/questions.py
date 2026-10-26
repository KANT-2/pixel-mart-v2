from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.deps import CurrentUser, DbSession
from app.schemas.question import AnswerIn, QuestionOut
from app.services.questions import AlreadyAnsweredError, answer_question, get_question

# 상품 문의 목록·쓰기·삭제는 4계층(src/questions/presentation/router.py)으로 옮겼다 (#30)
# 아래 개발용 답변은 #31 관리자 답변 API로 바뀌면 지운다
dev_router = APIRouter(prefix="/dev/questions", tags=["dev"])


@dev_router.post("/{question_id}/answer", response_model=QuestionOut, summary="[로컬 전용] 문의에 답변 달기")
async def answer(question_id: int, body: AnswerIn, user: CurrentUser, db: DbSession):
    # 판매자 화면이 없어서 로컬에서는 로그인한 누구나 답변을 달 수 있다
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    question = await get_question(db, question_id)
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "문의를 찾을 수 없습니다.")
    try:
        question = await answer_question(db, question, body.answer)
    except AlreadyAnsweredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 답변이 달린 문의입니다.") from None
    # 비밀글 내용은 작성자가 아닌 사람에게 돌려주지 않는다
    return QuestionOut.from_model(question, user.id)
