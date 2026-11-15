import { api } from './client';

export interface ResetDataResult {
  deletedSchedules: number;
  deletedUsers: number;
}

export async function resetData(): Promise<ResetDataResult> {
  return api.delete('/data/reset');
}
