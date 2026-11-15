import type { Activity, ActivityKind, ActivityStatus } from '@cims/shared';
import { api } from './client';

export interface ActivityInput {
  title: string;
  kind?: ActivityKind;
  status?: ActivityStatus;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  participantIds?: number[];
  note?: string;
}

export const activityKeys = {
  all: ['activities'] as const,
  list: (params?: { from?: string; to?: string; status?: ActivityStatus }) => ['activities', params ?? {}] as const,
};

export async function fetchActivities(params: { from?: string; to?: string; status?: ActivityStatus; limit?: number } = {}) {
  const data = await api.get<{ activities: Activity[] }>('/activities', params);
  return data.activities;
}

export async function createActivity(input: ActivityInput): Promise<Activity> {
  const data = await api.post<{ activity: Activity }>('/activities', input);
  return data.activity;
}

export async function updateActivity(id: number, patch: Partial<ActivityInput>): Promise<Activity> {
  const data = await api.patch<{ activity: Activity }>('/activities/' + id, patch);
  return data.activity;
}

export async function deleteActivity(id: number): Promise<void> {
  await api.delete('/activities/' + id);
}
