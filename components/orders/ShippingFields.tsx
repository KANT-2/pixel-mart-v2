"use client"; // 입력칸 상태를 부모와 주고받는다

import { useCallback } from "react";
import AddressSearch, { type FoundAddress } from "@/components/orders/AddressSearch";
import { formatPhone, phoneHint, type ShippingErrors, type ShippingForm } from "@/utils/shop";

interface ShippingFieldsProps {
  idPrefix: string;
  value: ShippingForm;
  errors: ShippingErrors;
  onChange: (next: ShippingForm, changed: keyof ShippingForm | "search") => void;
  disabled?: boolean;
}

const input = "w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet aria-invalid:border-pink";

/** 받는 사람 · 연락처 · 우편번호(주소 검색) · 주소 · 상세 주소 — 주문서와 내 배송지 화면이 같이 쓴다 */
export default function ShippingFields({ idPrefix, value, errors, onChange, disabled }: ShippingFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const set = (field: keyof ShippingForm, next: string) => onChange({ ...value, [field]: next }, field);
  const found = useCallback((result: FoundAddress) => {
    onChange({ ...value, postalCode: result.postalCode, address: result.address }, "search");
    // 상세 주소 칸으로 바로 이동
    setTimeout(() => document.getElementById(`${idPrefix}-addressDetail`)?.focus(), 50); // 검색 창이 닫힌 뒤
  }, [idPrefix, onChange, value]);
  const error = (field: keyof ShippingForm) => errors[field] && <p id={id(`${field}-error`)} className="mt-2 text-sm text-pink">{errors[field]}</p>;
  const described = (field: keyof ShippingForm) => (errors[field] ? id(`${field}-error`) : undefined);

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <label htmlFor={id("recipientName")} className="mb-2 block text-sm font-semibold">받는 사람</label>
        <input id={id("recipientName")} name="recipientName" autoComplete="name" maxLength={50} value={value.recipientName} disabled={disabled}
          onChange={(event) => set("recipientName", event.target.value)} aria-invalid={Boolean(errors.recipientName)} aria-describedby={described("recipientName")}
          placeholder="이름" className={input} />
        {error("recipientName")}
      </div>
      <div className="min-w-0">
        <label htmlFor={id("phone")} className="mb-2 block text-sm font-semibold">연락처</label>
        <input id={id("phone")} name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={13} value={value.phone} disabled={disabled}
          onChange={(event) => set("phone", formatPhone(event.target.value))} aria-invalid={Boolean(errors.phone)} aria-describedby={described("phone")}
          placeholder="010-1234-5678" className={input} />
        {error("phone") || (phoneHint(value.phone) && <p role="status" className="mt-2 text-xs text-sub">{phoneHint(value.phone)}</p>)}
      </div>
    </div>
    <div>
      <label htmlFor={id("postalCode")} className="mb-2 block text-sm font-semibold">주소</label>
      <div className="flex gap-2">
        <input id={id("postalCode")} name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={value.postalCode} disabled={disabled}
          onChange={(event) => set("postalCode", event.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.postalCode)} aria-describedby={described("postalCode")}
          placeholder="우편번호" aria-label="우편번호" className={`${input} max-w-36`} />
        <AddressSearch onSelect={found} disabled={disabled} />
      </div>
      {error("postalCode")}
      <input id={id("address")} name="address" autoComplete="address-line1" maxLength={200} value={value.address} disabled={disabled}
        onChange={(event) => set("address", event.target.value)} aria-invalid={Boolean(errors.address)} aria-describedby={described("address")}
        placeholder="도로명 주소" aria-label="도로명 주소" className={`${input} mt-2`} />
      {error("address")}
      <input id={id("addressDetail")} name="addressDetail" autoComplete="address-line2" maxLength={100} value={value.addressDetail} disabled={disabled}
        onChange={(event) => set("addressDetail", event.target.value)} aria-invalid={Boolean(errors.addressDetail)} aria-describedby={described("addressDetail")}
        placeholder="상세 주소 (동·호수, 필수)" aria-label="상세 주소" aria-required="true" className={`${input} mt-2`} />
      {error("addressDetail")}
    </div>
  </div>;
}
