"use client"; // 입력값·제출 상태를 다루니 클라이언트 컴포넌트로 만든다

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { createNotice, updateNotice } from "@/lib/adminNotices";
import type { AdminNotice } from "@/types/notice";
import { NOTICE_CONTENT_MAX, NOTICE_TITLE_MAX, validateNoticeForm, type NoticeFormErrors, type NoticeFormValues } from "@/utils/notices";

interface NoticeFormProps {
  mode: "create" | "edit";
  notice?: AdminNotice; // edit일 때만 (현재 값으로 폼을 채운다)
  onSaved: (notice: AdminNotice) => void;
  onCancel: () => void;
}

// 등록 · 수정 공용 폼 — #101의 ProductForm과 같은 구조
export default function NoticeForm({ mode, notice, onSaved, onCancel }: NoticeFormProps) {
  const [values, setValues] = useState<NoticeFormValues>({ title: notice?.title ?? "", content: notice?.content ?? "" });
  const [isPinned, setIsPinned] = useState(notice?.isPinned ?? false);
  const [isPublished, setIsPublished] = useState(notice?.isPublished ?? true);
  const [errors, setErrors] = useState<NoticeFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function field<K extends keyof NoticeFormValues>(key: K, value: NoticeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // 중복 클릭 방지
    setServerError(null);
    const result = validateNoticeForm(values);
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    try {
      const payload = { title: values.title.trim(), content: values.content.trim(), isPinned, isPublished };
      const saved = mode === "create" ? await createNotice(payload) : await updateNotice(notice!.id, payload);
      onSaved(saved);
    } catch (cause) {
      setServerError(cause instanceof ApiError ? cause.message : mode === "create" ? "등록하지 못했어요. 다시 시도해 주세요." : "수정하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="pixel-panel space-y-4 p-4">
      <h2 className="text-base font-bold text-ink">{mode === "create" ? "새 공지 쓰기" : `#${notice?.id} 공지 수정`}</h2>

      {serverError && <p role="alert" className="rounded-lg border border-pink/30 bg-panel-2 p-3 text-sm text-pink">{serverError}</p>}

      <label className="block text-sm">
        <span className="mb-1 flex items-center justify-between font-bold text-ink">
          <span>제목</span>
          <span className="text-xs font-normal text-dim">{values.title.length}/{NOTICE_TITLE_MAX}</span>
        </span>
        <input
          type="text"
          value={values.title}
          maxLength={NOTICE_TITLE_MAX}
          onChange={(event) => field("title", event.target.value)}
          className="pixel-input h-11 w-full px-3 text-sm"
        />
        {errors.title && <p className="mt-1 text-xs text-pink">{errors.title}</p>}
      </label>

      <label className="block text-sm">
        <span className="mb-1 flex items-center justify-between font-bold text-ink">
          <span>내용</span>
          <span className="text-xs font-normal text-dim">{values.content.length}/{NOTICE_CONTENT_MAX}</span>
        </span>
        <textarea
          value={values.content}
          maxLength={NOTICE_CONTENT_MAX}
          onChange={(event) => field("content", event.target.value)}
          rows={6}
          className="pixel-input w-full px-3 py-2 text-sm"
        />
        {errors.content && <p className="mt-1 text-xs text-pink">{errors.content}</p>}
      </label>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input type="checkbox" checked={isPinned} onChange={(event) => setIsPinned(event.target.checked)} className="h-4 w-4" />
        중요 공지로 상단 고정
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-bold text-ink">게시 상태</span>
        <select
          value={isPublished ? "published" : "hidden"}
          onChange={(event) => setIsPublished(event.target.value === "published")}
          className="pixel-input h-11 w-full px-3 text-sm"
        >
          <option value="published">게시</option>
          <option value="hidden">숨김</option>
        </select>
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
