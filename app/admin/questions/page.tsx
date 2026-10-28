import type { Metadata } from "next";
import { Suspense } from "react";
import AdminQuestionsBoard from "./AdminQuestionsBoard";
import { parseAdminQuestionQuery } from "./adminQuestions";

export const metadata: Metadata = { title: "문의 관리 | PIXEL MART 관리자" };

// 주소창 쿼리(?status=&q=&page=)는 요청마다 달라서 Suspense 안에서 읽는다 (cacheComponents 규칙, signup·lookbook과 같은 방식)
async function QuestionsContent({ searchParams }: Pick<PageProps<"/admin/questions">, "searchParams">) {
  const query = parseAdminQuestionQuery(await searchParams);
  // 필터·검색·쪽이 바뀌면 key가 바뀌어 목록을 처음부터 다시 그린다
  return <AdminQuestionsBoard key={`${query.status}|${query.q}|${query.page}`} {...query} />;
}

// 관리자 문의 답변 화면
export default function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  return <Suspense fallback={<div role="status" aria-label="문의 답변 화면 준비 중" className="space-y-3">
    <div className="h-8 w-40 animate-pulse rounded bg-panel" />
    <div className="h-32 w-full animate-pulse rounded-xl bg-panel" />
  </div>}>
    <QuestionsContent searchParams={searchParams} />
  </Suspense>;
}
