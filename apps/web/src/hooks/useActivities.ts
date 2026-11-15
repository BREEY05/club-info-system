import type { ActivityStatus } from '@cims/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activityKeys,
  createActivity,
  deleteActivity,
  fetchActivities,
  updateActivity,
  type ActivityInput,
} from '../api/activities';

export function useActivities(params: { from?: string; to?: string; status?: ActivityStatus; limit?: number } = {}) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => fetchActivities(params),
    staleTime: 20_000,
  });
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: activityKeys.all });
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivityInput) => createActivity(input),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; patch: Partial<ActivityInput> }) => updateActivity(input.id, input.patch),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteActivity(id),
    onSuccess: () => invalidate(queryClient),
  });
}
