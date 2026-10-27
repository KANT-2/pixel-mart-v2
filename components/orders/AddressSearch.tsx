"use client"; // 우편번호 검색 창(외부 스크립트)을 브라우저에서 띄운다

import { useEffect, useRef, useState } from "react";
import PixelCloseIcon from "@/components/PixelCloseIcon";

// 카카오(다음) 우편번호 서비스 — 키 없이 쓰는 공개 스크립트
const POSTCODE_SCRIPT = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

interface PostcodeData { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string; apartment: string; }
interface PostcodeWindow { daum?: { Postcode: new (options: { oncomplete: (data: PostcodeData) => void; width: string; height: string }) => { embed: (el: HTMLElement) => void } } }

let loading: Promise<void> | null = null;
function loadPostcode(): Promise<void> {
  if ((window as PostcodeWindow).daum?.Postcode) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = POSTCODE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { loading = null; reject(new Error("load failed")); };
    document.head.appendChild(script);
  });
  return loading;
}

export interface FoundAddress { postalCode: string; address: string; }

/** "주소 검색" 버튼 — 고르면 우편번호·도로명 주소를 돌려준다. 검색 창을 못 불러오면 직접 입력 안내 */
export default function AddressSearch({ onSelect, disabled }: { onSelect: (found: FoundAddress) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    let cancelled = false;
    loadPostcode().then(() => {
      const Postcode = (window as PostcodeWindow).daum?.Postcode;
      if (cancelled || !Postcode || !box.current) return;
      box.current.replaceChildren();
      new Postcode({
        width: "100%",
        height: "100%",
        oncomplete: (data) => {
          // 아파트·건물 이름은 괄호로 붙여 집 찾기 쉽게
          const extra = data.apartment === "Y" && data.buildingName ? ` (${data.buildingName})` : "";
          onSelect({ postalCode: data.zonecode, address: (data.roadAddress || data.jibunAddress) + extra });
          setOpen(false);
        },
      }).embed(box.current);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, onSelect]);

  return <>
    <button type="button" disabled={disabled} onClick={() => { setFailed(false); setOpen(true); }}
      className="btn-pixel shrink-0 px-4 text-sm font-bold disabled:opacity-50">주소 검색</button>
    {open && <dialog ref={dialog} aria-label="주소 검색" onClose={() => setOpen(false)}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] pixel-panel p-0 text-ink backdrop:bg-black/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-bold">주소 검색</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="grid size-9 place-items-center rounded-lg hover:bg-panel-2"><PixelCloseIcon className="size-4" /></button>
      </div>
      {failed
        ? <p role="alert" className="p-6 text-sm text-sub">주소 검색을 불러오지 못했어요. 창을 닫고 우편번호와 주소를 직접 입력해 주세요.</p>
        : <div ref={box} className="h-[28rem] bg-white" />}
    </dialog>}
  </>;
}
