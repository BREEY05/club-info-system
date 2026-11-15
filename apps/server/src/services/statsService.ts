import type { AppUser, MemberRole } from '@cims/shared';
import { all, get, type SqlValue } from '../db/index.ts';
import { getActiveSemester, getSemesterSlots, listActiveUsers, resolveWeek } from './context.ts';
import { listProblems } from '../judge/problems.ts';

/** 面向社团负责人的经营指标：成员、课表完整度、空闲分布、活动、刷题。 */

export interface StatsOverview {
  club: { members: number; timetableFilled: number; timetableEmpty: number };
  week: { weekNo: number; totalCells: number; freeCells: number; fullyFreeCells: number };
  activities: { total: number; upcoming: number; done: number };
  practice: { problems: number; attempted: number; solved: number; submissions: number };
}

export interface MemberStat {
  id: number;
  name: string;
  role: MemberRole;
  color: string;
  schedules: number;
  busiestWeekday: number | null;
  activities: number;
}

export interface SlotFreeStat {
  weekday: number;
  slotId: number;
  label: string;
  dayPart: string;
  startTime: string | null;
  endTime: string | null;
  busy: number;
  free: number;
}

function scalar(sql: string, params: SqlValue[] = []): number {
  const row = get<{ n: number | null }>(sql, params);
  return Number(row?.n ?? 0);
}

export function getOverview(orgId: number, weekNo?: number): StatsOverview {
  const semester = getActiveSemester(orgId);
  const week = resolveWeek(semester, weekNo);
  const slots = getSemesterSlots(semester);
  const members = listActiveUsers(orgId);

  const membersWithSchedule = new Set(
    all<{ user_id: number }>(
      'SELECT DISTINCT user_id FROM schedule WHERE semester_id = ?',
      [semester.id],
    ).map((row) => Number(row.user_id)),
  );
  const filled = members.filter((member) => membersWithSchedule.has(member.id)).length;

  const busyCells = all<{ weekday: number; slot_id: number; n: number }>(
    `SELECT weekday, slot_id, COUNT(DISTINCT user_id) AS n
       FROM schedule_occurrence
      WHERE semester_id = ? AND week_no = ?
      GROUP BY weekday, slot_id`,
    [semester.id, week.weekNo],
  );
  const totalCells = slots.length * 7;
  let freeCells = 0;
  let fullyFreeCells = 0;
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    for (const slot of slots) {
      const busy = Number(busyCells.find((row) => row.weekday === weekday && row.slot_id === slot.id)?.n ?? 0);
      const free = Math.max(members.length - busy, 0);
      freeCells += free;
      if (members.length > 0 && busy === 0) fullyFreeCells += 1;
    }
  }

  return {
    club: { members: members.length, timetableFilled: filled, timetableEmpty: members.length - filled },
    week: { weekNo: week.weekNo, totalCells, freeCells, fullyFreeCells },
    activities: {
      total: scalar('SELECT COUNT(*) AS n FROM activity WHERE org_id = ?', [orgId]),
      upcoming: scalar(
        "SELECT COUNT(*) AS n FROM activity WHERE org_id = ? AND status = 'planned' AND activity_date >= date('now')",
        [orgId],
      ),
      done: scalar("SELECT COUNT(*) AS n FROM activity WHERE org_id = ? AND status = 'done'", [orgId]),
    },
    practice: {
      problems: listProblems().problems.length,
      attempted: scalar('SELECT COUNT(DISTINCT problem_id) AS n FROM judge_submission WHERE status = ?', ['done']),
      solved: scalar("SELECT COUNT(DISTINCT problem_id) AS n FROM judge_submission WHERE verdict = 'AC'", []),
      submissions: scalar('SELECT COUNT(*) AS n FROM judge_submission', []),
    },
  };
}

export function getMemberStats(orgId: number): MemberStat[] {
  const semester = getActiveSemester(orgId);
  const members = listActiveUsers(orgId);
  const scheduleRows = all<{ user_id: number; weekday: number; n: number }>(
    `SELECT user_id, weekday, COUNT(*) AS n
       FROM schedule WHERE semester_id = ?
      GROUP BY user_id, weekday`,
    [semester.id],
  );
  const activityRows = all<{ user_id: number; n: number }>(
    'SELECT user_id, COUNT(*) AS n FROM activity_member GROUP BY user_id',
  );

  return members.map((member: AppUser) => {
    const own = scheduleRows.filter((row) => Number(row.user_id) === member.id);
    const schedules = own.reduce((sum, row) => sum + Number(row.n), 0);
    const busiest = own.reduce<{ weekday: number; n: number } | null>(
      (best, row) => (best === null || Number(row.n) > best.n ? { weekday: Number(row.weekday), n: Number(row.n) } : best),
      null,
    );
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      color: member.color,
      schedules,
      busiestWeekday: busiest?.weekday ?? null,
      activities: Number(activityRows.find((row) => Number(row.user_id) === member.id)?.n ?? 0),
    };
  });
}

/** 一周内每个时段的占用情况，用来回答「什么时候人最齐」。 */
export function getSlotStats(orgId: number, weekNo?: number): SlotFreeStat[] {
  const semester = getActiveSemester(orgId);
  const week = resolveWeek(semester, weekNo);
  const slots = getSemesterSlots(semester);
  const members = listActiveUsers(orgId);
  const busyCells = all<{ weekday: number; slot_id: number; n: number }>(
    `SELECT weekday, slot_id, COUNT(DISTINCT user_id) AS n
       FROM schedule_occurrence
      WHERE semester_id = ? AND week_no = ?
      GROUP BY weekday, slot_id`,
    [semester.id, week.weekNo],
  );

  const result: SlotFreeStat[] = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    for (const slot of slots) {
      const busy = Number(busyCells.find((row) => row.weekday === weekday && row.slot_id === slot.id)?.n ?? 0);
      result.push({
        weekday,
        slotId: slot.id,
        label: slot.label,
        dayPart: slot.dayPart,
        startTime: slot.startTime,
        endTime: slot.endTime,
        busy,
        free: Math.max(members.length - busy, 0),
      });
    }
  }
  return result;
}
