"use client"; // 상태·이벤트가 많아 전체를 클라이언트 컴포넌트로 만든다 (#101·#102와 같은 구조)

import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog"; // 공용 확인창 (수정하지 않고 그대로 재사용)
import FaqForm from "@/components/admin/FaqForm";
import { ApiError } from "@/lib/api";
import { deleteFaq, getAdminFaqs, updateFaq } from "@/lib/adminFaqs";
import type { Faq } from "@/types/faq";
import { reorderFaqs, type SortOrderPatch } from "@/utils/faqs";

// FAQ 등록·수정 폼을 열어 둘 때, 어떤 모드인지와(등록/수정) 대상 FAQ를 담는다
type FormState = { mode: "create" } | { mode: "edit"; faq: Faq };

export default function FaqsScreen() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false); // 드래그 순서 저장 중 — 끝날 때까지 추가 드래그 막는다
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // 목록 아래쪽 FAQ의 "수정"을 눌러도 폼(화면 위쪽)이 바로 보이게 스크롤한다 (AdminBadgesBoard와 같은 방식)
  useEffect(() => { if (formState) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [formState]);

  // 마우스는 바로 드래그, 터치는 꾸욱 눌러야 드래그 시작(스크롤과 헷갈리지 않게). 키보드(Tab+Space+화살표)도 지원
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setFaqs(await getAdminFaqs());
    } catch (cause) {
      setLoadError(cause instanceof ApiError ? cause.message : "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 목록을 새로 부를 때마다 로딩 상태를 바로 켜야 한다
    void load();
  }, [load]);

  function onSaved(saved: Faq) {
    const verb = formState?.mode === "create" ? "등록" : "수정";
    setFormState(null);
    setSuccessMessage(`"${saved.question}" FAQ를 ${verb}했어요.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    void load();
  }

  async function persistReorder(patches: SortOrderPatch[]) {
    setActionError(null);
    setReordering(true);
    try {
      // 두 번째 이후 PATCH가 실패해도 앞선 것은 이미 반영됐을 수 있어, 끝나면 항상 서버에서 다시 불러와 맞춘다
      for (const patch of patches) {
        await updateFaq(patch.id, { sortOrder: patch.sortOrder });
      }
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "순서를 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setReordering(false);
      void load();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!faqs || !over || active.id === over.id) return;
    const fromIndex = faqs.findIndex((faq) => faq.id === active.id);
    const toIndex = faqs.findIndex((faq) => faq.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const nextOrder = arrayMove(faqs, fromIndex, toIndex);
    setFaqs(nextOrder); // 서버 응답 기다리지 않고 바로 화면에 반영(낙관적 업데이트)
    const patches = reorderFaqs(nextOrder);
    if (patches.length > 0) void persistReorder(patches);
  }

  async function confirmRemove() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteFaq(confirmDelete.id);
      setSuccessMessage(`"${confirmDelete.question}" FAQ를 삭제했어요.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setConfirmDelete(null);
      void load();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  if (!faqs && loading) return <FaqsSkeleton />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">FAQ 관리</h1>
          <p className="mt-1 text-sm text-sub">자주 묻는 질문을 등록하고, 드래그로 순서를 정리해요.</p>
        </div>
        <button type="button" onClick={() => setFormState({ mode: "create" })} className="btn-lime min-h-11 px-4 text-sm font-bold">+ FAQ 등록</button>
      </header>

      {successMessage && <p role="status" className="rounded-lg border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{successMessage}</p>}
      {actionError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-3">
          <p className="text-sm text-pink">{actionError}</p>
          <button type="button" onClick={() => setActionError(null)} aria-label="오류 메시지 닫기" className="btn-pixel min-h-11 min-w-11 px-2 text-sm font-bold">✕</button>
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-pink/30 bg-panel p-4">
          <p className="text-sm text-pink">{loadError}</p>
          <button type="button" onClick={() => void load()} className="btn-pixel min-h-11 px-4 text-sm font-bold">다시 시도</button>
        </div>
      )}

      <div ref={formRef} className="scroll-mt-24">
        {formState && (
          <FaqForm
            mode={formState.mode}
            faq={formState.mode === "edit" ? formState.faq : undefined}
            faqs={faqs ?? []}
            onSaved={onSaved}
            onCancel={() => setFormState(null)}
          />
        )}
      </div>

      {faqs && (
        faqs.length === 0 ? (
          <p className="pixel-panel p-10 text-center text-sm text-sub">등록된 FAQ가 없어요. &quot;FAQ 등록&quot;으로 첫 질문을 올려보세요.</p>
        ) : (
          // 드래그로 순서를 바꾸는 화면이라 표 대신, 375px부터 1280px까지 같은 카드 목록을 쓴다(가로 스크롤 없음)
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={faqs.map((faq) => faq.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <SortableFaqRow
                    key={faq.id}
                    faq={faq}
                    disabled={reordering}
                    onEdit={() => setFormState({ mode: "edit", faq })}
                    onDelete={() => setConfirmDelete(faq)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete ? `"${confirmDelete.question}" FAQ를 삭제할까요?` : ""}
        description="삭제하면 되돌릴 수 없어요."
        confirmLabel={deleting ? "삭제 중…" : "삭제"}
        danger
        onConfirm={() => { if (!deleting) void confirmRemove(); }}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
      />
    </div>
  );
}

interface SortableFaqRowProps {
  faq: Faq;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableFaqRow({ faq, disabled, onEdit, onDelete }: SortableFaqRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: faq.id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="pixel-panel flex items-start gap-3 p-3">
      {/* 마우스: 바로 드래그 / 터치: 꾸욱 누르면 드래그 시작 / 키보드: 포커스 후 Space로 집고 화살표로 이동, Space로 놓기 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="드래그해서 순서 바꾸기"
        className="btn-pixel mt-0.5 flex h-9 w-9 shrink-0 touch-none cursor-grab items-center justify-center text-base active:cursor-grabbing disabled:opacity-40"
      >
        ≡
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-dim">{faq.category}</p>
        <p className="break-words font-bold text-ink [overflow-wrap:anywhere]">{faq.question}</p>
        <p className="line-clamp-2 break-words text-xs text-sub [overflow-wrap:anywhere]">{faq.answer}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <button type="button" onClick={onEdit} className="btn-pixel min-h-9 whitespace-nowrap px-2.5 text-xs font-bold">수정</button>
        <button type="button" onClick={onDelete} className="btn-pixel min-h-9 whitespace-nowrap border-pink px-2.5 text-xs font-bold text-pink">삭제</button>
      </div>
    </div>
  );
}

function FaqsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="FAQ 목록 불러오는 중">
      <div className="h-8 w-40 animate-pulse rounded bg-panel" />
      <div className="h-64 animate-pulse rounded-xl bg-panel" />
    </div>
  );
}
