"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TradeStatus } from "@/types/api";
import { localButton } from "@/components/local/LocalStates";

export type TradeAction = "done" | "hidden" | "delete";
const CONFIRM: Record<TradeAction, { title: string; body: string }> = {
  done: { title: "거래를 완료할까요?", body: "게시판과 매칭에서 빠지고 내 글에는 기록이 남아요." },
  hidden: { title: "이 글을 숨길까요?", body: "게시판과 매칭에서 빠지고 내 글에는 기록이 남아요." },
  delete: { title: "이 글을 삭제할까요?", body: "되돌릴 수 없어요. 대기 중인 교환 신청은 취소되고 상대에게 알림이 가요." },
};
interface TradeStatusButtonsProps { status: TradeStatus; disabled: boolean; pending: boolean; onConfirm: (action: TradeAction) => Promise<void>; }
export default function TradeStatusButtons({ status, disabled, pending, onConfirm }: TradeStatusButtonsProps) {
  const [target, setTarget] = useState<TradeAction | null>(null);
  const confirm = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  useEffect(() => { if (target) confirm.current?.focus(); }, [target]);
  function cancel() { if (!disabled) { setTarget(null); requestAnimationFrame(() => trigger.current?.focus()); } }
  return <div className="mt-4 border-t border-line pt-4" onKeyDown={(event) => { if (event.key === "Escape" && target) { event.preventDefault(); cancel(); } }}>
    <div className="flex flex-wrap gap-2">{status === "open" && <button type="button" disabled={disabled || Boolean(target)} onClick={(event) => { trigger.current = event.currentTarget; setTarget("done"); }} className={localButton}>거래 완료</button>}
      {status !== "hidden" && <button type="button" disabled={disabled || Boolean(target)} onClick={(event) => { trigger.current = event.currentTarget; setTarget("hidden"); }} className={localButton}>숨기기</button>}
      <button type="button" disabled={disabled || Boolean(target)} onClick={(event) => { trigger.current = event.currentTarget; setTarget("delete"); }} className={`${localButton} text-pink`}>삭제</button>
    </div>
    {target && <div role="group" aria-labelledby={id} className="mt-3 rounded-lg bg-panel-2 p-4"><p id={id} className="text-sm font-bold">{CONFIRM[target].title}</p><p className="mt-2 text-xs text-sub">{CONFIRM[target].body}</p>
      <div className="mt-3 flex gap-2"><button ref={confirm} type="button" disabled={disabled} onClick={() => void onConfirm(target)} className={localButton}>{pending ? "처리 중…" : "확인"}</button><button type="button" disabled={disabled} onClick={cancel} className={localButton}>취소</button></div>
    </div>}
  </div>;
}
