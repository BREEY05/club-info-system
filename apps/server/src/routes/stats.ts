import type { FastifyPluginAsync } from 'fastify';
import { toInt } from '../lib/params.ts';
import { requireOrg } from '../services/orgContext.ts';
import { getMemberStats, getOverview, getSlotStats } from '../services/statsService.ts';

/** 社团经营指标：总览、成员课表完整度、一周空闲分布。 */
export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async (request) => {
    const query = request.query as Record<string, unknown>;
    return { data: getOverview(requireOrg(request), toInt(query.week, undefined)) };
  });

  app.get('/members', async (request) => ({ data: { members: getMemberStats(requireOrg(request)) } }));

  app.get('/slots', async (request) => {
    const query = request.query as Record<string, unknown>;
    return { data: { slots: getSlotStats(requireOrg(request), toInt(query.week, undefined)) } };
  });
};
