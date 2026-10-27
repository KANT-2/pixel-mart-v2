// 관리자 — 운송장 입력 · 반품/교환 처리 (mock 없이 실제 API만)
import { api } from "@/lib/api";
import { notifyAdminOrderCountsChanged } from "@/lib/admin";
import type { AdminCancelStatus, AdminOrderDetail, AdminReturnRequest, Page } from "@/types/admin";

export function setAdminTracking(id: number, courier: string, trackingNumber: string): Promise<AdminOrderDetail> {
  return api.put<AdminOrderDetail>(`/admin/orders/${id}/tracking`, { courier, trackingNumber });
}

export function getAdminReturnRequests(status: AdminCancelStatus | null, page: number): Promise<Page<AdminReturnRequest>> {
  const query = new URLSearchParams({ page: String(page), size: "10", ...(status ? { status } : {}) });
  return api.get<Page<AdminReturnRequest>>(`/admin/return-requests?${query}`, { cache: "no-store" });
}

export async function resolveAdminReturn(id: number, approve: boolean): Promise<void> {
  await api.post(`/admin/return-requests/${id}/${approve ? "approve" : "reject"}`);
  notifyAdminOrderCountsChanged(); // 처리되면 주문 상태가 바뀌니 사이드바 숫자도 다시 부른다
}
