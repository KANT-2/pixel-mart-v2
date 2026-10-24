"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ApiUser } from "@/types/api";

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  /** 로그아웃·만료된 토큰으로 확인했을 때 "다시 로그인해 주세요." (로그인 화면·사용자 메뉴에 표시) */
  notice: string | null;
  /** 개발용 이메일 로그인 (로컬 전용) */
  login: (email: string, nickname?: string) => Promise<void>;
  /** 이메일·비밀번호 로그인 → /api/auth/token (OAuth2 form) */
  passwordLogin: (email: string, password: string) => Promise<void>;
  /** 이메일 가입 → 바로 로그인 */
  signup: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateUser: (nextUser: ApiUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const mutating = useRef(false);

  const updateUser = useCallback((nextUser: ApiUser) => {
    // 로그아웃 중이거나 다른 사용자의 오래된 저장 응답이면 반영하지 않습니다.
    if (mutating.current) return;
    ++sequence.current;
    setUser((current) => current?.id === nextUser.id ? nextUser : current);
  }, []);

  const refresh = useCallback((signal?: AbortSignal): Promise<void> => {
    if (mutating.current) return Promise.resolve();
    const request = ++sequence.current;
    const timeout = AbortSignal.timeout(5000);
    return api.get<ApiUser>("/auth/me", { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout }).then((nextUser) => {
      if (signal?.aborted || request !== sequence.current) return;
      setUser(nextUser);
      setError(null);
    }).catch((cause: unknown) => {
      if (signal?.aborted || request !== sequence.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUser(null);
        setError(null);
        // 토큰이 있었는데 거절됐을 때만 서버가 "다시 로그인해 주세요."를 보낸다 (그냥 비로그인은 안내 없음)
        setNotice(cause.message.startsWith("다시 로그인") ? cause.message : null);
      } else {
        setError("로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.");
      }
    }).finally(() => {
      if (!signal?.aborted && request === sequence.current) setLoading(false);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  /** 로그인·가입처럼 사용자를 바꾸는 요청 — 동시에 하나만, 끝나면 최신 사용자로 */
  const mutate = useCallback(async (run: () => Promise<ApiUser | null>) => {
    if (mutating.current) return;
    mutating.current = true;
    ++sequence.current;
    setPending(true);
    try {
      setUser(await run());
      setError(null);
      setNotice(null);
    } finally {
      mutating.current = false;
      setPending(false);
      setLoading(false);
    }
  }, []);

  const login = useCallback((email: string, nickname?: string) => mutate(
    () => api.post<ApiUser>("/auth/dev-login", { email, ...(nickname ? { nickname } : {}) }),
  ), [mutate]);

  const passwordLogin = useCallback((email: string, password: string) => mutate(async () => {
    // 토큰은 서버가 httpOnly 쿠키(pm_session)로도 심어 주므로 화면은 응답 본문을 저장하지 않는다
    await api.postForm("/auth/token", { username: email, password });
    return api.get<ApiUser>("/auth/me", { cache: "no-store" });
  }), [mutate]);

  const signup = useCallback((email: string, password: string, nickname: string) => mutate(async () => {
    await api.post<ApiUser>("/auth/signup", { email, password, nickname });
    await api.postForm("/auth/token", { username: email, password });
    return api.get<ApiUser>("/auth/me", { cache: "no-store" });
  }), [mutate]);

  const logout = useCallback(() => mutate(async () => {
    await api.post("/auth/logout");
    return null;
  }), [mutate]);

  return <AuthContext.Provider value={{ user, loading, pending, error, notice, login, passwordLogin, signup, logout, refresh, updateUser }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  return context;
}
