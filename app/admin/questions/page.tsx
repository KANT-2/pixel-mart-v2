import AdminQuestionsBoard from "./AdminQuestionsBoard";
import { parseAdminQuestionQuery } from "./adminQuestions";

// 관리자 문의 답변 화면 — 주소창 쿼리(?status=&q=&page=)를 읽어 목록에 넘긴다
export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  const query = parseAdminQuestionQuery(await searchParams);
  // 필터·검색·쪽이 바뀌면 key가 바뀌어 목록을 처음부터 다시 그린다
  return <AdminQuestionsBoard key={`${query.status}|${query.q}|${query.page}`} {...query} />;
}
