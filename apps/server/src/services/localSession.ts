/**
 * 本地模式身份：
 * 单机单用户运行，不需要登录与授权，全部请求都视为本组织的负责人（管理员）。
 * 保留邮箱概念仅用于数据库中「我的表 / 成员」的归属字段。
 */
import { get } from '../db/index.ts';
import { defaultOrgId } from './context.ts';

export interface LocalIdentity {
  email: string;
  role: 'admin';
  enabled: false;
}

export function localOwnerEmail(): string {
  const row = get<{ owner_email: string }>('SELECT owner_email FROM organization WHERE id = ?', [defaultOrgId()]);
  return row?.owner_email ?? 'local@club';
}

export function localIdentity(): LocalIdentity {
  return { email: localOwnerEmail(), role: 'admin', enabled: false };
}
