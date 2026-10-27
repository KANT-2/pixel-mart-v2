"use client"; // 내 선물 · 교환 신청 수를 불러오고 메뉴를 여닫는다

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { giftApi } from "@/lib/gifts";
import { localApi } from "@/lib/local";

interface Counts { userId: number; requests: number; gifts: number; }

/** PIXEL LOCAL 탭 줄 오른쪽 "내 활동" — 흩어진 내 글 · 교환 신청 · 선물함 · 동네 설정을 한 버튼으로 */
export default function LocalActivityMenu() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // 화면을 옮길 때마다 다시 센다 (교환 수락 · 선물 받기 뒤 숫자가 맞게)
  useEffect(() => {
    if (userId === null) return;
    const controller = new AbortController();
    Promise.all([localApi.tradeRequests("received", controller.signal), giftApi.list("received", controller.signal)])
      .then(([requests, gifts]) => setCounts({
        userId,
        requests: requests.filter((request) => request.status === "pending").length,
        gifts: gifts.filter((gift) => gift.status === "pending").length,
      }))
      .catch(() => {}); // 숫자는 꾸밈이라 실패해도 메뉴는 그대로
    return () => controller.abort();
  }, [userId, pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  if (userId === null) return null;
  const mine = counts?.userId === userId ? counts : null;
  const total = (mine?.requests ?? 0) + (mine?.gifts ?? 0);
  const close = () => setOpen(false);
  const item = "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-panel-2";
  const badge = (n: number) => n > 0 && <b className="font-pixel text-xs text-pink">{n > 9 ? "9+" : n}</b>;

  return (
    <div ref={root} className="relative shrink-0"
      onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); close(); } }}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}
        aria-label={total ? `내 활동, 확인할 것 ${total}개` : "내 활동"}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-3 text-sm sm:gap-1.5 sm:px-3 font-semibold text-sub hover:text-ink aria-expanded:border-mint/50 aria-expanded:text-mint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint">
        내 활동{badge(total)}<span aria-hidden="true" className="hidden sm:inline">▾</span>
      </button>
      {open && <div id={panelId} className="absolute right-0 top-full z-40 mt-2 w-56 pixel-panel p-2 shadow-lg">
        <Link href="/local/trades/mine#trade-requests" onClick={close} className={item}>내 글·교환 신청{badge(mine?.requests ?? 0)}</Link>
        <Link href="/mypage/gifts" onClick={close} className={item}>선물함{badge(mine?.gifts ?? 0)}</Link>
        <Link href="/local/trades/new?kind=want" onClick={close} className={item}>내 WISH 올리기</Link>
        <Link href="/local/settings" onClick={close} className={`${item} mt-1 border-t border-line text-sub`}>동네·취향 설정</Link>
      </div>}
    </div>
  );
}
