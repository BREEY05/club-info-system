import { createContext, useContext } from 'react';

/** 本地模式：永远已登录，没有角色体系，本机即管理员。 */
export interface AuthSession {
  enabled: false;
  email: string | null;
  role: 'admin' | null;
}

export const OFFLINE_SESSION: AuthSession = { enabled: false, email: null, role: 'admin' };

export interface SessionContextValue {
  session: AuthSession;
  /** 本地模式恒为 true：本机使用者拥有一切权限 */
  isAdmin: boolean;
}

const SessionContext = createContext<SessionContextValue>({ session: OFFLINE_SESSION, isAdmin: true });

export const SessionProvider = SessionContext.Provider;

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

export function isAdminRole(role: 'admin' | 'member' | null | undefined): boolean {
  return role === 'admin';
}

export function roleLabel(role: 'admin' | 'member' | null | undefined): string {
  if (role === 'admin') return '管理员';
  if (role === 'member') return '成员';
  return '本机';
}
