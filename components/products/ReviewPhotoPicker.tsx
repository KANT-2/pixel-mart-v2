"use client"; // 고른 사진을 브라우저에서 줄여 data URL로 만든다

import { useId, useState } from "react";
import PixelCloseIcon from "@/components/PixelCloseIcon";

export const MAX_REVIEW_PHOTOS = 3;
const MAX_SIDE = 800; // 긴 변 — 서버 한도(장당 약 300KB) 안에 들어가게
const MAX_CHARS = 390_000;

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // 화질을 조금씩 낮춰 한도 안에 맞춘다
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error("too large");
}

interface ReviewPhotoPickerProps { photos: string[]; onChange: (photos: string[]) => void; disabled?: boolean; }

/** 포토 리뷰 — 최대 3장, 원본은 올리지 않고 줄인 사진만 보낸다 */
export default function ReviewPhotoPicker({ photos, onChange, disabled }: ReviewPhotoPickerProps) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = photos.length >= MAX_REVIEW_PHOTOS;

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_REVIEW_PHOTOS - photos.length);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) { setError("사진 파일만 올릴 수 있어요."); continue; }
      try { added.push(await shrink(file)); } catch { setError("사진을 불러오지 못했어요. 다른 사진을 골라 주세요."); }
    }
    onChange([...photos, ...added]);
    setBusy(false);
  }

  return <div className="mt-5">
    <p className="mb-2 text-sm font-semibold">사진 <span className="font-normal text-dim">(선택 · 최대 {MAX_REVIEW_PHOTOS}장)</span></p>
    <div className="flex flex-wrap gap-2">
      {photos.map((photo, index) => <div key={index} className="relative size-20">
        {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저에서 줄인 data URL 미리보기 */}
        <img src={photo} alt={`첨부 사진 ${index + 1}`} className="size-20 rounded-lg border border-line object-cover" />
        <button type="button" disabled={disabled} onClick={() => onChange(photos.filter((_, i) => i !== index))} aria-label={`사진 ${index + 1} 빼기`}
          className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-line bg-panel text-sub hover:text-ink"><PixelCloseIcon className="size-2.5" /></button>
      </div>)}
      {!full && <label htmlFor={`${id}-file`} className={`grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line text-center text-xs text-sub hover:border-mint/60 hover:text-mint ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "줄이는 중…" : <span><span aria-hidden="true" className="block font-pixel text-lg">+</span>사진 추가</span>}
      </label>}
      <input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || busy || full} onChange={(event) => void pick(event)} className="sr-only" />
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-pink">{error}</p>}
  </div>;
}
