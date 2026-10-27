"use client"; // 입력값·제출 상태를 다루니 클라이언트 컴포넌트로 만든다

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { createFaq, updateFaq } from "@/lib/adminFaqs";
import type { Faq } from "@/types/faq";
import { FAQ_ANSWER_MAX, FAQ_CATEGORY_MAX, FAQ_QUESTION_MAX, faqCategories, nextSortOrder, validateFaqForm, type FaqFormErrors, type FaqFormValues } from "@/utils/faqs";

interface FaqFormProps {
  mode: "create" | "edit";
  faq?: Faq; // edit일 때만 (현재 값으로 폼을 채운다)
  faqs: Faq[]; // 등록 시 sortOrder 계산 + 분류 추천(datalist)에 쓴다
  onSaved: (faq: Faq) => void;
  onCancel: () => void;
}

const CATEGORY_LIST_ID = "faq-category-options";

// 등록 · 수정 공용 폼 — #101·#102의 ProductForm/NoticeForm과 같은 구조
export default function FaqForm({ mode, faq, faqs, onSaved, onCancel }: FaqFormProps) {
  const [values, setValues] = useState<FaqFormValues>({
    category: faq?.category ?? "",
    question: faq?.question ?? "",
    answer: faq?.answer ?? "",
  });
  const [errors, setErrors] = useState<FaqFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const categoryOptions = faqCategories(faqs);

  function field<K extends keyof FaqFormValues>(key: K, value: FaqFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // 중복 클릭 방지
    setServerError(null);
    const result = validateFaqForm(values);
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    try {
      const payload = { category: values.category.trim(), question: values.question.trim(), answer: values.answer.trim() };
      const saved = mode === "create"
        ? await createFaq({ ...payload, sortOrder: nextSortOrder(faqs) })
        : await updateFaq(faq!.id, payload);
      onSaved(saved);
    } catch (cause) {
      setServerError(cause instanceof ApiError ? cause.message : mode === "create" ? "등록하지 못했어요. 다시 시도해 주세요." : "수정하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="pixel-panel space-y-4 p-4">
      <h2 className="text-base font-bold text-ink">{mode === "create" ? "FAQ 등록" : `#${faq?.id} FAQ 수정`}</h2>

      {serverError && <p role="alert" className="rounded-lg border border-pink/30 bg-panel-2 p-3 text-sm text-pink">{serverError}</p>}

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-ink">분류</span>
        <input
          type="text"
          list={CATEGORY_LIST_ID}
          value={values.category}
          maxLength={FAQ_CATEGORY_MAX}
          onChange={(event) => field("category", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
        {/* 오타로 분류가 갈라지지 않게, 이미 쓰인 분류를 추천만 한다(필터·분류 관리 아님) */}
        <datalist id={CATEGORY_LIST_ID}>
          {categoryOptions.map((category) => <option key={category} value={category} />)}
        </datalist>
        {errors.category && <p className="mt-1 text-xs text-pink">{errors.category}</p>}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-ink">질문</span>
        <input
          type="text"
          value={values.question}
          maxLength={FAQ_QUESTION_MAX}
          onChange={(event) => field("question", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
        {errors.question && <p className="mt-1 text-xs text-pink">{errors.question}</p>}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-ink">답변</span>
        <textarea
          value={values.answer}
          maxLength={FAQ_ANSWER_MAX}
          onChange={(event) => field("answer", event.target.value)}
          rows={5}
          className="pixel-input w-full px-3 py-2 text-sm"
        />
        {errors.answer && <p className="mt-1 text-xs text-pink">{errors.answer}</p>}
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={submitting} className="btn-pixel min-h-11 px-4 text-sm font-bold">
          취소
        </button>
        <button type="submit" disabled={submitting} className="btn-lime min-h-11 px-4 text-sm font-bold">
          {submitting ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
