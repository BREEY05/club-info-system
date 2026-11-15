import type { FastifyPluginAsync } from 'fastify';
import { toId, toInt } from '../lib/params.ts';
import { parseBody } from '../lib/validate.ts';
import { requireOrg } from '../services/orgContext.ts';
import {
  activityInputSchema,
  activityPatchSchema,
  createActivity,
  deleteActivity,
  getActivity,
  listActivities,
  updateActivity,
} from '../services/activityService.ts';

const STATUSES = ['planned', 'done', 'canceled'] as const;

/** 活动 / 例会：负责人一个人排期，参与人从成员里挑。 */
export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => {
    const query = request.query as Record<string, unknown>;
    const status =
      typeof query.status === 'string' && (STATUSES as readonly string[]).includes(query.status)
        ? (query.status as (typeof STATUSES)[number])
        : undefined;
    return {
      data: {
        activities: listActivities(requireOrg(request), {
          from: typeof query.from === 'string' ? query.from : undefined,
          to: typeof query.to === 'string' ? query.to : undefined,
          status,
          limit: toInt(query.limit, undefined),
        }),
      },
    };
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { data: { activity: getActivity(toId(id), requireOrg(request)) } };
  });

  app.post('/', async (request, reply) => {
    const input = parseBody(activityInputSchema, request.body ?? {});
    reply.status(201);
    return { data: { activity: createActivity(input, requireOrg(request)) } };
  });

  app.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const patch = parseBody(activityPatchSchema, request.body ?? {});
    return { data: { activity: updateActivity(toId(id), patch, requireOrg(request)) } };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    deleteActivity(toId(id), requireOrg(request));
    return reply.status(204).send();
  });
};
