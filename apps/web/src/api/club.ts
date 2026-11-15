import type { ClubInfo } from '@cims/shared';
import { api } from './client';

export type ClubPatch = Partial<Pick<ClubInfo, 'name' | 'description' | 'ownerName' | 'contact'>>;

export const clubKeys = { all: ['club'] as const };

export async function fetchClub(): Promise<ClubInfo> {
  const data = await api.get<{ club: ClubInfo }>('/org');
  return data.club;
}

export async function updateClub(patch: ClubPatch): Promise<ClubInfo> {
  const data = await api.patch<{ club: ClubInfo }>('/org', patch);
  return data.club;
}
