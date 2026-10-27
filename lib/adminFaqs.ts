// lib/adminFaqs.ts — 관리자 FAQ CRUD. lib/faqs.ts(손님용 공개 조회, 팀원 파일)와는 별도로 둔다.
// FAQ 관리 API(#95)는 이미 머지돼 있어서, 상품(#101)처럼 mock 분기 없이 항상 실제 서버만 부른다.
import { api } from "@/lib/api";
import type { Faq, FaqCreateInput, FaqUpdateInput } from "@/types/faq";

export function getAdminFaqs(): Promise<Faq[]> {
  return api.get("/admin/faqs");
}

export function createFaq(input: FaqCreateInput): Promise<Faq> {
  return api.post("/admin/faqs", input);
}

export function updateFaq(id: number, changes: FaqUpdateInput): Promise<Faq> {
  return api.patch(`/admin/faqs/${id}`, changes);
}

export function deleteFaq(id: number): Promise<void> {
  return api.delete(`/admin/faqs/${id}`);
}
