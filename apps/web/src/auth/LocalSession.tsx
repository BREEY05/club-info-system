import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import { OFFLINE_SESSION, SessionProvider, type AuthSession } from './session';

/**
 * 本地模式外壳：不再有登录页。
 * 只向服务端确认一次「本机身份」（默认组织负责人邮箱），用于「我的表」等归属判断。
 */
export function LocalSession({ children }: { children: ReactNode }) {
  const sessionQuery = useQuery({
    queryKey: ['local-session'],
    queryFn: () => api.get<AuthSession>('/auth/session'),
    staleTime: Infinity,
    retry: 1,
  });

  const session: AuthSession = sessionQuery.data
    ? { enabled: false, email: sessionQuery.data.email ?? null, role: 'admin' }
    : OFFLINE_SESSION;

  return <SessionProvider value={{ session, isAdmin: true }}>{children}</SessionProvider>;
}
