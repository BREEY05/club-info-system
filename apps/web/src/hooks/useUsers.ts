import type { AppUser, UserInput } from '@cims/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPersonalBoard } from '../api/board';
import { createUser, deleteUser, fetchUsers, reorderUsers, updateUser, userKeys } from '../api/users';

/** 成员列表（默认含已离社成员，管理页需要看到全部） */
export function useUsers(includeInactive = true) {
  return useQuery({
    queryKey: userKeys.list(includeInactive),
    queryFn: () => fetchUsers(includeInactive),
    staleTime: 30_000,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: userKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['board'] });
  void queryClient.invalidateQueries({ queryKey: ['schedules'] });
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
  void queryClient.invalidateQueries({ queryKey: ['club'] });
  void queryClient.invalidateQueries({ queryKey: ['activities'] });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserInput) => createUser(input),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; patch: Partial<UserInput> }) => updateUser(input.id, input.patch),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useReorderUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => reorderUsers(ids),
    onSuccess: () => invalidateAll(queryClient),
  });
}

/** 成员课表（周视图） */
export function useMemberBoard(userId: number | null, week: number | null) {
  return useQuery({
    queryKey: ['board', 'personal', userId ?? 'none', week ?? 'current'],
    queryFn: () => fetchPersonalBoard(userId as number, week ?? undefined),
    enabled: userId !== null,
    staleTime: 15_000,
  });
}

export type { AppUser };
