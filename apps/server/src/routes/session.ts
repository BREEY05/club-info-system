import type { FastifyInstance } from 'fastify';
import { localIdentity } from '../services/localSession.ts';

/**
 * 本地模式：不安装任何鉴权中间件。
 * 仅提供一个 `GET /api/v1/auth/session` 供前端读取当前身份（永远是本机管理员）。
 */
export function installLocalSession(app: FastifyInstance): void {
  app.get('/api/v1/auth/session', async () => ({ data: localIdentity() }));
}
