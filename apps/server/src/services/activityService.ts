import { z } from 'zod';
import type { Activity } from '@cims/shared';
import { all, get, run, transaction } from '../db/index.ts';
import { AppError, notFound } from '../lib/errors.ts';
import { mapActivity, type ActivityRow } from '../lib/mappers.ts';

/** 社团活动 / 例会：一人维护，参与人来自成员列表。 */

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const activityInputSchema = z.object({
  title: z.string().trim().min(1, '活动名称不能为空').max(60, '活动名称不能超过 60 个字符'),
  kind: z.enum(['meeting', 'training', 'event', 'other']).optional(),
  status: z.enum(['planned', 'done', 'canceled']).optional(),
  date: z.string().trim().regex(dateRe, '日期格式应为 YYYY-MM-DD'),
  startTime: z.string().trim().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, '开始时间格式应为 HH:MM').optional(),
  endTime: z.string().trim().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, '结束时间格式应为 HH:MM').optional(),
  location: z.string().trim().max(60, '地点不能超过 60 个字符').optional(),
  participantIds: z.array(z.number().int().positive()).max(200).optional(),
  note: z.string().trim().max(500, '备注不能超过 500 个字符').optional(),
});

export const activityPatchSchema = activityInputSchema.partial();

export type ActivityInput = z.infer<typeof activityInputSchema>;
export type ActivityPatch = z.infer<typeof activityPatchSchema>;

function participantsOf(ids: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rows = all<{ activity_id: number; user_id: number }>(
    'SELECT activity_id, user_id FROM activity_member WHERE activity_id IN (' + placeholders + ') ORDER BY user_id',
    ids,
  );
  for (const row of rows) {
    const list = map.get(Number(row.activity_id)) ?? [];
    list.push(Number(row.user_id));
    map.set(Number(row.activity_id), list);
  }
  return map;
}

export interface ActivityQuery {
  from?: string;
  to?: string;
  status?: 'planned' | 'done' | 'canceled';
  limit?: number;
}

export function listActivities(orgId: number, query: ActivityQuery = {}): Activity[] {
  const where = ['org_id = ?'];
  const params: (string | number)[] = [orgId];
  if (query.from) {
    where.push('activity_date >= ?');
    params.push(query.from);
  }
  if (query.to) {
    where.push('activity_date <= ?');
    params.push(query.to);
  }
  if (query.status) {
    where.push('status = ?');
    params.push(query.status);
  }
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 500) : 500;
  const rows = all<ActivityRow>(
    'SELECT * FROM activity WHERE ' + where.join(' AND ') + ' ORDER BY activity_date ASC, start_time ASC LIMIT ' + limit,
    params,
  );
  const participants = participantsOf(rows.map((row) => Number(row.id)));
  return rows.map((row) => mapActivity(row, participants.get(Number(row.id)) ?? []));
}

export function getActivity(id: number, orgId: number): Activity {
  const row = get<ActivityRow>('SELECT * FROM activity WHERE id = ? AND org_id = ?', [id, orgId]);
  if (!row) throw notFound('活动');
  const participants = participantsOf([id]);
  return mapActivity(row, participants.get(id) ?? []);
}

function writeParticipants(activityId: number, ids: number[]): void {
  run('DELETE FROM activity_member WHERE activity_id = ?', [activityId]);
  for (const userId of Array.from(new Set(ids))) {
    run('INSERT OR IGNORE INTO activity_member (activity_id, user_id) VALUES (?, ?)', [activityId, userId]);
  }
}

export function createActivity(input: ActivityInput, orgId: number): Activity {
  if (input.startTime && input.endTime && input.endTime < input.startTime) {
    throw new AppError(422, 'VALIDATION_ERROR', '结束时间不能早于开始时间');
  }
  const id = transaction(() => {
    const result = run(
      `INSERT INTO activity (org_id, title, kind, status, activity_date, start_time, end_time, location, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        input.title,
        input.kind ?? 'meeting',
        input.status ?? 'planned',
        input.date,
        input.startTime ?? '',
        input.endTime ?? '',
        input.location ?? '',
        input.note ?? '',
      ],
    );
    const newId = Number(result.lastInsertRowid);
    writeParticipants(newId, input.participantIds ?? []);
    return newId;
  });
  return getActivity(id, orgId);
}

export function updateActivity(id: number, patch: ActivityPatch, orgId: number): Activity {
  const existing = getActivity(id, orgId);
  const start = patch.startTime ?? existing.startTime;
  const end = patch.endTime ?? existing.endTime;
  if (start && end && end < start) throw new AppError(422, 'VALIDATION_ERROR', '结束时间不能早于开始时间');

  transaction(() => {
    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [column, value] of [
      ['title', patch.title],
      ['kind', patch.kind],
      ['status', patch.status],
      ['activity_date', patch.date],
      ['start_time', patch.startTime],
      ['end_time', patch.endTime],
      ['location', patch.location],
      ['note', patch.note],
    ] as const) {
      if (value !== undefined) {
        sets.push(column + ' = ?');
        params.push(value);
      }
    }
    if (sets.length > 0) {
      run(
        'UPDATE activity SET ' + sets.join(', ') + ", updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
        [...params, id],
      );
    }
    if (patch.participantIds !== undefined) writeParticipants(id, patch.participantIds);
  });
  return getActivity(id, orgId);
}

export function deleteActivity(id: number, orgId: number): void {
  getActivity(id, orgId);
  run('DELETE FROM activity WHERE id = ? AND org_id = ?', [id, orgId]);
}
