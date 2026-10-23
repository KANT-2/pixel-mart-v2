"use client"; // 열고 닫는 상태와 키보드 이벤트를 다루니 클라이언트 컴포넌트로 만든다

import { useEffect, useId } from "react"; // id는 접근성용 aria-labelledby 연결에 쓴다

interface ConfirmDialogProps {
  open: boolean; // 열려 있는지 여부 — false면 아무것도 그리지 않는다
  title: string; // 다이얼로그 제목
  description?: string; // 제목 아래 설명 (선택)
  confirmLabel?: string; // 확인 버튼 글자 (기본값 "확인")
  cancelLabel?: string; // 취소 버튼 글자 (기본값 "취소")
  danger?: boolean; // true면 확인 버튼을 위험(삭제 등) 느낌으로 보여 준다
  onConfirm: () => void; // 확인 버튼을 눌렀을 때
  onClose: () => void; // 취소·배경 클릭·Esc로 닫을 때
}

// 중요한 동작(승인/거절 등) 전에 한 번 더 물어보는 작은 모달 — 주문·취소요청 화면에서 공용으로 쓴다
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId(); // 제목 요소의 id — dialog와 연결한다

  // Esc 키를 누르면 닫는다 — 열려 있을 때만 리스너를 붙인다
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close); // 언마운트·닫힘 시 리스너 정리
  }, [open, onClose]);

  if (!open) return null; // 닫혀 있으면 그리지 않는다

  return (
    // 화면 전체를 덮는 어두운 배경 — 배경을 직접 누르면 닫는다
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose(); // 패널이 아니라 배경을 눌렀을 때만 닫는다
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="pixel-panel w-full max-w-sm p-5">
        <h2 id={titleId} className="text-base font-bold text-ink">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-sub">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-pixel px-4 py-2 text-sm font-bold">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus // 다이얼로그가 열리면 확인 버튼에 초점을 둔다
            className={danger ? "btn-pixel border-pink px-4 py-2 text-sm font-bold text-pink" : "btn-lime px-4 py-2 text-sm font-bold"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
