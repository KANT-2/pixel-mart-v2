"use client"; // 운송장 번호 복사 버튼

import { useState } from "react";
import { trackingUrl } from "@/utils/shop";

interface TrackingInfoProps { courier: string | null; courierLabel: string | null; trackingNumber: string | null; }

/** 택배사 · 운송장 번호 · 배송 조회 링크 */
export default function TrackingInfo({ courier, courierLabel, trackingNumber }: TrackingInfoProps) {
  const [copied, setCopied] = useState(false);
  if (!trackingNumber) return null;
  const url = trackingUrl(courier, trackingNumber);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 복사가 막힌 브라우저는 번호를 직접 보면 된다 */ }
  };
  return <div>
    <dt className="text-sub">운송장</dt>
    <dd className="mt-1">
      <p className="font-semibold">{courierLabel ?? "택배"} <span className="font-mono">{trackingNumber}</span></p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="rounded-lg border border-line px-3 py-1.5 text-xs text-sub hover:text-ink">{copied ? "복사했어요" : "번호 복사"}</button>
        {url && <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-mint/40 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/10">배송 조회 ↗</a>}
      </div>
    </dd>
  </div>;
}
