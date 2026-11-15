import type { FastifyPluginAsync } from 'fastify';
import { parseBody } from '../lib/validate.ts';
import { requireOrg } from '../services/orgContext.ts';
import { clubPatchSchema, getClub, updateClub } from '../services/clubService.ts';

/**
 * 社团档案。本地单机只有一个社团，不再有多组织搜索、邀请码、加入申请与审批。
 */
export const orgRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => ({ data: { club: getClub(requireOrg(request)) } }));

  app.patch('/', async (request) => {
    const patch = parseBody(clubPatchSchema, request.body ?? {});
    return { data: { club: updateClub(requireOrg(request), patch) } };
  });
};
