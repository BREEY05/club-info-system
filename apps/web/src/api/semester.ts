import type { SemesterOverview } from '@cims/shared';
import { api } from './client';

export function fetchSemester(): Promise<SemesterOverview> {
  return api.get<SemesterOverview>('/semester');
}
