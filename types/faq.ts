// types/faq.ts — FAQ 타입. 백엔드 admin_content API(#95, backend/src/admin_content/presentation/schemas.py)와
// 필드 이름을 맞춘다. 화면은 이 타입을 통해서만 필드에 접근한다.
export interface Faq {
  id: number;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface FaqCreateInput {
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export interface FaqUpdateInput {
  category?: string;
  question?: string;
  answer?: string;
  sortOrder?: number;
}
