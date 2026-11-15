import type { AppUser, UserInput } from '@cims/shared';
import { api } from './client';

export const userKeys = {
  all: ['users'] as const,
  list: (includeInactive = true) => ['users', includeInactive ? 'all' : 'active'] as const,
};

export async function fetchUsers(includeInactive = true): Promise<AppUser[]> {
  const data = await api.get<{ users: AppUser[] }>('/users', { include_inactive: includeInactive ? 1 : 0 });
  return data.users;
}

export async function createUser(input: UserInput): Promise<AppUser> {
  const data = await api.post<{ user: AppUser }>('/users', input);
  return data.user;
}

export async function updateUser(id: number, patch: Partial<UserInput>): Promise<AppUser> {
  const data = await api.patch<{ user: AppUser }>('/users/' + id, patch);
  return data.user;
}

/** 彻底删除成员：连同其课表与活动参与记录一起清掉 */
export async function deleteUser(id: number): Promise<void> {
  await api.delete('/users/' + id + '?hard=1');
}

export async function reorderUsers(ids: number[]): Promise<AppUser[]> {
  const data = await api.put<{ users: AppUser[] }>('/users/order', { ids });
  return data.users;
}
