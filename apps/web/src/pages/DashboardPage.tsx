import { WEEKDAY_LABELS, type Weekday } from '@cims/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, CalendarDays, CircleCheck, Code2, Sparkles, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { judgeApi } from '../api/judge';
import { fetchMemberStats, fetchOverview, statsKeys } from '../api/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { statusLabel } from '../components/pages/activities/ActivityFormDialog';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { useActivities } from '../hooks/useActivities';
import { useClub } from '../hooks/useClub';
import { cn } from '../lib/cn';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatDate(date: string): string {
  const parsed = new Date(date + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return date;
  const weekday = parsed.getDay() === 0 ? 7 : parsed.getDay();
  return `${parsed.getMonth() + 1}/${parsed.getDate()} ${WEEKDAY_LABELS[weekday as Weekday]}`;
}

/** 总览：今天该干什么、本周什么时候人最齐、刷题练到哪。 */
export default function DashboardPage() {
  const clubQuery = useClub();
  const overviewQuery = useQuery({ queryKey: statsKeys.overview(), queryFn: () => fetchOverview(), staleTime: 30_000 });
  const membersQuery = useQuery({ queryKey: statsKeys.members, queryFn: fetchMemberStats, staleTime: 30_000 });
  const activitiesQuery = useActivities({ status: 'planned', limit: 5 });
  const submissionsQuery = useQuery({
    queryKey: ['judge', 'submissions', 'recent'],
    queryFn: () => judgeApi.submissions(undefined, 5),
    staleTime: 20_000,
  });

  const club = clubQuery.data;
  const overview = overviewQuery.data;
  const members = membersQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const submissions = submissionsQuery.data?.submissions ?? [];
  const missingTimetable = members.filter((member) => member.schedules === 0);

  const fillRate =
    overview && overview.club.members > 0 ? Math.round((overview.club.timetableFilled / overview.club.members) * 100) : 0;

  // 待办：把「该动手了」的事集中到一处，负责人一进首页就知道先做哪件
  const fullyFree = overview?.week.fullyFreeCells ?? 0;
  const upcoming = overview?.activities.upcoming ?? 0;
  const untouchedProblems = Math.max(
    (overview?.practice.problems ?? 0) - (overview?.practice.solved ?? 0) - (overview?.practice.attempted ?? 0),
    0,
  );
  const todos: Array<{ key: string; text: string; action: string; to: string; tone: 'warn' | 'info' }> = [];
  if (members.length === 0) {
    todos.push({ key: 'members', text: '还没添加任何成员，先把社团名单建起来', action: '加成员', to: '/members', tone: 'warn' });
  } else if (missingTimetable.length > 0) {
    todos.push({
      key: 'timetable',
      text: `${missingTimetable.length} 位成员还没录课表，空闲时段会算不准`,
      action: '去录课表',
      to: '/timetable',
      tone: 'warn',
    });
  }
  if (members.length > 0 && fullyFree > 0 && upcoming === 0) {
    todos.push({
      key: 'activity',
      text: `本周有 ${fullyFree} 个全员空闲时段，还没有安排活动`,
      action: '排活动',
      to: '/free',
      tone: 'info',
    });
  }
  if ((overview?.practice.attempted ?? 0) > 0) {
    todos.push({
      key: 'practice',
      text: `${overview?.practice.attempted} 道题做过但还没通过`,
      action: '继续做',
      to: '/practice/history',
      tone: 'warn',
    });
  }
  if (untouchedProblems > 0) {
    todos.push({ key: 'untouched', text: `题库里还有 ${untouchedProblems} 道题没开始`, action: '去题库', to: '/practice', tone: 'info' });
  }

  if (clubQuery.isPending || overviewQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={club?.name ?? '我的社团'}
        title={`${greeting()}${club?.ownerName ? '，' + club.ownerName : ''}`}
        description={`今天是 ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}，第 ${overview?.week.weekNo ?? '-'} 教学周。`}
        actions={
          <>
            <Link to="/activities">
              <Button variant="secondary" iconLeft={<CalendarDays className="h-4 w-4" aria-hidden />}>
                排活动
              </Button>
            </Link>
            <Link to="/members">
              <Button iconLeft={<UserPlus className="h-4 w-4" aria-hidden />}>加成员</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" aria-hidden />} label="在册成员" value={overview?.club.members ?? 0} to="/members" />
        <Stat
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          label="本周全员空闲"
          value={`${overview?.week.fullyFreeCells ?? 0} 段`}
          to="/free"
          tone={(overview?.week.fullyFreeCells ?? 0) > 0 ? 'mint' : 'amber'}
        />
        <Stat icon={<CalendarDays className="h-4 w-4" aria-hidden />} label="待进行活动" value={overview?.activities.upcoming ?? 0} to="/activities" />
        <Stat
          icon={<Code2 className="h-4 w-4" aria-hidden />}
          label="刷题通过"
          value={`${overview?.practice.solved ?? 0}/${overview?.practice.problems ?? 0}`}
          to="/practice"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="text-sm font-medium text-ink">接下来的活动</div>
              <Link to="/activities" className="text-2xs text-brand hover:underline">
                全部 →
              </Link>
            </div>
            {activities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <CalendarDays className="h-5 w-5 text-subtle" aria-hidden />
                <p className="text-xs text-muted">还没有安排活动。先去「空闲时间」看看大家什么时候有空。</p>
                <Link to="/free">
                  <Button size="sm" variant="soft" iconLeft={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
                    找共同空闲
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{activity.title}</div>
                      <div className="text-2xs text-subtle">
                        {formatDate(activity.date)}
                        {activity.startTime ? ` · ${activity.startTime}${activity.endTime ? '–' + activity.endTime : ''}` : ''}
                        {activity.location ? ` · ${activity.location}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="outline">{activity.participantIds.length} 人</Badge>
                      <Badge tone="brand">{statusLabel(activity.status)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flex flex-col">
            <div className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">待办提醒</div>
            {todos.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-xs text-mint">
                <CircleCheck className="h-4 w-4" aria-hidden />
                该做的都做完了，本周没有待处理事项。
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {todos.map((todo) => (
                  <li key={todo.key}>
                    <Link to={todo.to} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-canvas">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', todo.tone === 'warn' ? 'bg-amber' : 'bg-brand')} aria-hidden />
                        <span className="truncate text-xs text-ink">{todo.text}</span>
                      </span>
                      <span className="shrink-0 text-2xs text-brand">{todo.action} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-ink">课表完整度</div>
              <Badge tone={fillRate === 100 ? 'mint' : fillRate >= 60 ? 'amber' : 'danger'}>{fillRate}%</Badge>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
              <div
                className={cn('h-full rounded-full', fillRate === 100 ? 'bg-mint' : fillRate >= 60 ? 'bg-amber' : 'bg-danger')}
                style={{ width: `${fillRate}%` }}
              />
            </div>
            {missingTimetable.length > 0 ? (
              <div className="mt-2 text-2xs leading-5 text-muted">
                还没录课表：
                {missingTimetable
                  .slice(0, 5)
                  .map((member) => member.name)
                  .join('、')}
                {missingTimetable.length > 5 ? ` 等 ${missingTimetable.length} 人` : ''}
                <Link to="/timetable" className="ml-1 text-brand hover:underline">
                  去录 →
                </Link>
              </div>
            ) : (
              <div className="mt-2 text-2xs text-mint">全部成员都已录入课表</div>
            )}
          </Card>

          <Card className="flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="text-sm font-medium text-ink">最近提交</div>
              <Link to="/practice/history" className="text-2xs text-brand hover:underline">
                全部 →
              </Link>
            </div>
            {submissions.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted">
                还没刷过题
                <Link to="/practice" className="inline-flex items-center gap-0.5 text-brand hover:underline">
                  去题库 <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {submissions.map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate text-ink">{submission.problemTitle}</div>
                      <div className="text-2xs text-subtle">{submission.language}</div>
                    </div>
                    <Badge tone={submission.verdict === 'AC' ? 'mint' : submission.verdict ? 'danger' : 'neutral'}>
                      {submission.verdict ?? submission.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  to,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  to: string;
  tone?: 'brand' | 'mint' | 'amber' | 'danger';
}) {
  const toneClass = {
    brand: 'text-brand bg-brand-soft',
    mint: 'text-mint bg-emerald-50',
    amber: 'text-amber bg-amber-50',
    danger: 'text-danger bg-red-50',
  }[tone];
  return (
    <Link to={to} className="block">
      <Card className="p-3.5 transition-colors hover:border-brand/40">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneClass)}>{icon}</span>
          <span className="text-2xs text-muted">{label}</span>
        </div>
        <div className="mt-2 text-xl font-semibold tracking-tight text-ink">{value}</div>
      </Card>
    </Link>
  );
}
