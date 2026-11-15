import { z } from 'zod';
import type { ClubInfo } from '@cims/shared';
import { get, run } from '../db/index.ts';
import { notFound } from '../lib/errors.ts';

/** 社团档案：本机只有一个社团，没有成员加入、没有审批、没有邀请码。 */

export interface ClubRow {
  id: number;
  name: string;
  description: string;
  owner_name: string;
  contact: string;
  created_at: string;
}

export const clubPatchSchema = z.object({
  name: z.string().trim().min(1, '社团名称不能为空').max(60, '社团名称不能超过 60 个字符').optional(),
  description: z.string().trim().max(500, '简介不能超过 500 个字符').optional(),
  ownerName: z.string().trim().max(30, '负责人姓名不能超过 30 个字符').optional(),
  contact: z.string().trim().max(60, '联系方式不能超过 60 个字符').optional(),
});

export type ClubPatch = z.infer<typeof clubPatchSchema>;

export function getClub(orgId: number): ClubInfo {
  const row = get<ClubRow>('SELECT * FROM organization WHERE id = ?', [orgId]);
  if (!row) throw notFound('社团');
  const members = get<{ n: number }>('SELECT COUNT(*) AS n FROM app_user WHERE org_id = ? AND is_active = 1', [orgId]);
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description ?? '',
    ownerName: row.owner_name ?? '',
    contact: row.contact ?? '',
    createdAt: row.created_at,
    memberCount: Number(members?.n ?? 0),
  };
}

export function updateClub(orgId: number, patch: ClubPatch): ClubInfo {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  for (const [column, value] of [
    ['name', patch.name],
    ['description', patch.description],
    ['owner_name', patch.ownerName],
    ['contact', patch.contact],
  ] as const) {
    if (value !== undefined) {
      sets.push(column + ' = ?');
      params.push(value);
    }
  }
  if (sets.length > 0) run('UPDATE organization SET ' + sets.join(', ') + ' WHERE id = ?', [...params, orgId]);
  return getClub(orgId);
}
