import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { closeDb } from '../src/db/index.ts';

const API = '/api/v1';

let app: FastifyInstance;

beforeEach(async () => {
  closeDb();
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  closeDb();
});

async function createUser(name: string, payload: Record<string, unknown> = {}): Promise<any> {
  const res = await app.inject({ method: 'POST', url: API + '/users', payload: { name, ...payload } });
  expect(res.statusCode).toBe(201);
  return res.json().data.user;
}

describe('club profile', () => {
  it('GET /org 返回本机社团档案与成员数', async () => {
    await createUser('小林');
    const res = await app.inject({ method: 'GET', url: API + '/org' });
    expect(res.statusCode).toBe(200);
    const club = res.json().data.club;
    expect(typeof club.name).toBe('string');
    expect(club.memberCount).toBeGreaterThanOrEqual(1);
    expect(club).not.toHaveProperty('code');
    expect(club).not.toHaveProperty('ownerEmail');
  });

  it('PATCH /org 只改档案字段', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: API + '/org',
      payload: { name: '程序设计协会', ownerName: '张同学', contact: '13800138000', description: '每周一次集训' },
    });
    expect(res.statusCode).toBe(200);
    const club = res.json().data.club;
    expect(club.name).toBe('程序设计协会');
    expect(club.ownerName).toBe('张同学');
    expect(club.description).toBe('每周一次集训');
  });

  it('成员支持社团档案字段', async () => {
    const user = await createUser('阿哲', {
      role: 'minister',
      grade: '2024 级',
      major: '软件工程',
      phone: '13900139000',
    });
    expect(user.role).toBe('minister');
    expect(user.grade).toBe('2024 级');
    expect(user.phone).toBe('13900139000');
  });

  it('电话字段拒绝非法字符', async () => {
    const res = await app.inject({ method: 'POST', url: API + '/users', payload: { name: '坏号码', phone: 'abc' } });
    expect(res.statusCode).toBe(422);
  });
});

describe('activities', () => {
  it('创建活动、带参与人、可改状态与删除', async () => {
    const a = await createUser('小林');
    const b = await createUser('阿哲');

    const created = await app.inject({
      method: 'POST',
      url: API + '/activities',
      payload: {
        title: '第 8 周例会',
        date: '2026-11-20',
        startTime: '19:00',
        endTime: '20:30',
        location: '实验楼 302',
        participantIds: [a.id, b.id],
        note: '讲下周比赛',
      },
    });
    expect(created.statusCode).toBe(201);
    const activity = created.json().data.activity;
    expect(activity.title).toBe('第 8 周例会');
    expect(activity.status).toBe('planned');
    expect(activity.participantIds).toHaveLength(2);

    const patched = await app.inject({
      method: 'PATCH',
      url: API + '/activities/' + activity.id,
      payload: { status: 'done', participantIds: [a.id] },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.activity.status).toBe('done');
    expect(patched.json().data.activity.participantIds).toEqual([a.id]);

    const list = await app.inject({ method: 'GET', url: API + '/activities?status=done' });
    expect(list.json().data.activities).toHaveLength(1);

    const removed = await app.inject({ method: 'DELETE', url: API + '/activities/' + activity.id });
    expect(removed.statusCode).toBe(204);
    const after = await app.inject({ method: 'GET', url: API + '/activities' });
    expect(after.json().data.activities).toHaveLength(0);
  });

  it('结束时间早于开始时间返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: API + '/activities',
      payload: { title: '时间反了', date: '2026-11-20', startTime: '20:00', endTime: '19:00' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('日期格式不合法返回 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: API + '/activities',
      payload: { title: '日期错', date: '2026/11/20' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('删除成员时级联清理活动参与记录', async () => {
    const member = await createUser('临时成员');
    const created = await app.inject({
      method: 'POST',
      url: API + '/activities',
      payload: { title: '例会', date: '2026-11-21', participantIds: [member.id] },
    });
    const activity = created.json().data.activity;
    expect(activity.participantIds).toEqual([member.id]);

    await app.inject({ method: 'DELETE', url: API + '/users/' + member.id + '?hard=1' });
    const detail = await app.inject({ method: 'GET', url: API + '/activities/' + activity.id });
    expect(detail.json().data.activity.participantIds).toEqual([]);
  });
});

describe('stats', () => {
  it('overview 汇总成员、课表、活动与刷题', async () => {
    const member = await createUser('小林');
    const semester = (await app.inject({ method: 'GET', url: API + '/semester' })).json().data.semester;
    const slots = (await app.inject({ method: 'GET', url: API + '/templates/' + semester.activeTemplateId })).json().data.slots;

    await app.inject({
      method: 'POST',
      url: API + '/schedules',
      payload: { userId: member.id, weekday: 2, slotId: slots[0].id, startWeek: 1, endWeek: 4, parity: 'all' },
    });
    await app.inject({ method: 'POST', url: API + '/activities', payload: { title: '例会', date: '2026-11-25' } });

    const res = await app.inject({ method: 'GET', url: API + '/stats/overview' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.club.members).toBeGreaterThanOrEqual(1);
    expect(data.club.timetableFilled).toBeGreaterThanOrEqual(1);
    expect(data.activities.total).toBeGreaterThanOrEqual(1);
    expect(typeof data.week.fullyFreeCells).toBe('number');
    expect(data.practice.problems).toBeGreaterThan(0);
  });

  it('members 统计每人课表条数与最忙日', async () => {
    const member = await createUser('阿哲');
    const semester = (await app.inject({ method: 'GET', url: API + '/semester' })).json().data.semester;
    const slots = (await app.inject({ method: 'GET', url: API + '/templates/' + semester.activeTemplateId })).json().data.slots;
    await app.inject({
      method: 'POST',
      url: API + '/schedules',
      payload: { userId: member.id, weekday: 3, slotId: slots[0].id, startWeek: 1, endWeek: 4, parity: 'all' },
    });

    const res = await app.inject({ method: 'GET', url: API + '/stats/members' });
    const row = res.json().data.members.find((item: { id: number }) => item.id === member.id);
    expect(row.schedules).toBeGreaterThanOrEqual(1);
    expect(row.busiestWeekday).toBe(3);
    expect(row.role).toBe('member');
  });

  it('slots 给出每个时段的占用与空闲人数', async () => {
    await createUser('小林');
    const res = await app.inject({ method: 'GET', url: API + '/stats/slots' });
    expect(res.statusCode).toBe(200);
    const slots = res.json().data.slots;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toHaveProperty('busy');
    expect(slots[0]).toHaveProperty('free');
    expect(slots[0].busy + slots[0].free).toBeGreaterThanOrEqual(1);
  });

  it('旧的公平性接口已经下线', async () => {
    const res = await app.inject({ method: 'GET', url: API + '/stats/fairness' });
    expect(res.statusCode).toBe(404);
  });
});
