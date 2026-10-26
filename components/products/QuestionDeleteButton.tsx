"use client";

import { useEffect, useId, useRef, useState } from "react";

interface QuestionDeleteButtonProps { disabled: boolean; pending: boolean; onConfirm: () => Promise<void>; }

// 되돌릴 수 없는 행동이라 btn-lime 대신 btn-pixel + 분홍 테두리, 확인 한 번 더 (RULES 2장)
export default function QuestionDeleteButton({ disabled, pending, onConfirm }: QuestionDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const id = useId();
  useEffect(() => {
    if (confirming) confirm.current?.focus();
    else if (returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; }
  }, [confirming]);
  function cancel() { if (!disabled) { returnFocus.current = true; setConfirming(false); } }
  const buttonClass = "min-h-11 btn-pixel px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
  return <div className="mt-4" onKeyDown={(event) => { if (event.key === "Escape" && confirming) { event.preventDefault(); cancel(); } }}>
    <button ref={trigger} type="button" aria-label="내 문의 삭제" aria-expanded={confirming} aria-controls={confirming ? id : undefined} disabled={disabled || confirming} onClick={() => setConfirming(true)} className={`${buttonClass} border-pink/40 text-sub`}>삭제</button>
    {confirming && <div id={id} role="group" aria-labelledby={`${id}-question`} className="mt-3 rounded-lg border border-pink/30 bg-panel-2 p-4">
      <p id={`${id}-question`} className="text-sm font-bold">이 문의를 삭제할까요? 삭제하면 되돌릴 수 없어요.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button ref={confirm} type="button" disabled={disabled} onClick={() => void onConfirm()} className={`${buttonClass} border-pink/60 text-pink`}>{pending ? "삭제 중…" : "삭제하기"}</button>
        <button type="button" disabled={disabled} onClick={cancel} className={`${buttonClass} text-sub`}>취소</button>
      </div>
    </div>}
  </div>;
}
