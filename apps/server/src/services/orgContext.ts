import type { FastifyRequest } from 'fastify';
import { all, get } from '../db/index.ts';
import { defaultOrgId } from './context.ts';
import { localOwnerEmail } from './localSession.ts';

/**
 * 本地模式的请求上下文。
 * 没有登录态：所有请求都以本机管理员身份操作默认组织。
 */

/** 当前请求的身份邮箱（本地模式恒为默认组织负责人）。 */
export function requestEmail(_request: FastifyRequest): string {
  return localOwnerEmail();
}

/** 本地模式视为管理员，保留本机全部管理能力。 */
export function isAdminRequest(_request: FastifyRequest): boolean {
  return true;
}

/** 本地模式只有一个组织，没有「会话中切换组织」的概念。 */
export function selectedOrgId(_request: FastifyRequest): number | null {
  return null;
}

/** 该邮箱可访问的组织 id 列表。 */
export function accessibleOrgIds(email: string): number[] {
  const owned = all<{ id: number }>('SELECT id FROM organization WHERE owner_email = ? ORDER BY id', [email]);
  const joined = all<{ id: number }>("SELECT org_id AS id FROM org_member WHERE email = ? AND status = 'approved' ORDER BY org_id", [email]);
  return [...new Set([...owned, ...joined].map((row) => Number(row.id)))];
}

/** 当前生效组织：本地模式恒为默认组织。 */
export function requireOrg(_request: FastifyRequest): number {
  return defaultOrgId();
}

export function orgExists(orgId: number): boolean {
  return Boolean(get('SELECT id FROM organization WHERE id = ?', [orgId]));
}
