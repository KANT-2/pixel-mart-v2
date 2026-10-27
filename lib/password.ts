import { api } from "@/lib/api";

/** 비밀번호 변경 · 재설정 (이메일 가입 계정) */
export const passwordApi = {
  change: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/password", { currentPassword, newPassword }),
  requestReset: (email: string) =>
    api.post<{ message: string; resetUrl: string | null }>("/auth/password-reset", { email }),
  reset: (token: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/password-reset/confirm", { token, newPassword }),
};
