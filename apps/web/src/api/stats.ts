import type { MemberRole } from '@cims/shared';
import { api } from './client';

export interface StatsOverview {
  club: { members: number; timetableFilled: number; timetableEmpty: number };
  week: { weekNo: number; totalCells: number; freeCells: number; fullyFreeCells: number };
  activities: { total: number; upcoming: number; done: number };
  practice: { problems: number; attempted: number; solved: number; submissions: number };
}

export interface MemberStat {
  id: number;
  name: string;
  role: MemberRole;
  color: string;
  schedules: number;
  busiestWeekday: number | null;
  activities: number;
}

export interface SlotStat {
  weekday: number;
  slotId: number;
  label: string;
  dayPart: string;
  startTime: string | null;
  endTime: string | null;
  busy: number;
  free: number;
}

export const statsKeys = {
  all: ['stats'] as const,
  overview: (week?: number) => ['stats', 'overview', week ?? 'current'] as const,
  members: ['stats', 'members'] as const,
  slots: (week?: number) => ['stats', 'slots', week ?? 'current'] as const,
};

export async function fetchOverview(week?: number): Promise<StatsOverview> {
  return api.get<StatsOverview>('/stats/overview', { week });
}

export async function fetchMemberStats(): Promise<MemberStat[]> {
  const data = await api.get<{ members: MemberStat[] }>('/stats/members');
  return data.members;
}

export async function fetchSlotStats(week?: number): Promise<SlotStat[]> {
  const data = await api.get<{ slots: SlotStat[] }>('/stats/slots', { week });
  return data.slots;
}
