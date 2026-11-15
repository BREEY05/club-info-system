import { WEEKDAY_LABELS, type Weekday } from '@cims/shared';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarClock, ClipboardList, TrendingUp, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchMemberStats, fetchOverview, fetchSlotStats, statsKeys } from '../api/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { roleLabel } from '../components/pages/members/MemberFormDialog';
import { WeekSwitcher } from '../components/schedule/WeekSwitcher';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useSemester } from '../hooks/useSemester';
import { useWeekParam } from '../hooks/useWeek';
import { cn } from '../lib/cn';

/** 统计：负责人关心的几个数——人齐不齐、课表填没填、什么时候有空。 */
export default function StatsPage() {
  const semesterQuery = useSemester();
  const weeks = semesterQuery.data?.weeks ?? [];
  const currentWeek = weeks.find((item) => item.isCurrent) ?? weeks[0];
  const { week: weekParam, setWeek } = useWeekParam(semesterQuery.data?.semester.totalWeeks);
  const weekNo = weekParam ?? currentWeek?.weekNo ?? undefined;
  const selectedWeek = weeks.find((item) => item.weekNo === weekNo) ?? currentWeek;

  const overviewQuery = useQuery({
    queryKey: statsKeys.overview(weekNo),
    queryFn: () => fetchOverview(weekNo),
    staleTime: 30_000,
  });
  const membersQuery = useQuery({ queryKey: statsKeys.members, queryFn: fetchMemberStats, staleTime: 30_000 });
  const slotsQuery = useQuery({ queryKey: statsKeys.slots(weekNo), queryFn: () => fetchSlotStats(weekNo), staleTime: 30_000 });

  const overview = overviewQuery.data;
  const members = membersQuery.data ?? [];
  const slots = slotsQuery.data ?? [];

  const byWeekday = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const items = slots.filter((slot) => slot.weekday === weekday);
    const allFree = items.filter((slot) => slot.busy === 0 && slot.free > 0).length;
    return { weekday: weekday as Weekday, total: items.length, allFree };
  });
  const maxAllFree = Math.max(...byWeekday.map((item) => item.allFree), 1);

  if (semesterQuery.isPending || overviewQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fillRate =
    overview && overview.club.members > 0 ? Math.round((overview.club.timetableFilled / overview.club.members) * 100) : 0;

  const practiceTotal = overview?.practice.problems ?? 0;
  const practiceRate = practiceTotal > 0 ? Math.round(((overview?.practice.solved ?? 0) / practiceTotal) * 100) : 0;
  const totalParticipations = members.reduce((sum, member) => sum + member.activities, 0);
  const memberAvgActivities = members.length > 0 ? (totalParticipations / members.length).toFixed(1) : '0';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="统计"
        title="社团运行情况"
        description="课表填得全不全、哪天最容易凑齐人、刷题练到哪了，一页看完。"
        actions={weeks.length > 0 ? <WeekSwitcher week={selectedWeek} weeks={weeks} onChange={setWeek} /> : null}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Users className="h-4 w-4" aria-hidden />}
          label="在册成员"
          value={overview?.club.members ?? 0}
          hint={overview ? `${overview.club.timetableFilled} 人已录课表` : ''}
        />
        <KpiCard
          icon={<ClipboardList className="h-4 w-4" aria-hidden />}
          label="课表完整度"
          value={`${fillRate}%`}
          hint={
            overview && overview.club.members === 0
              ? '还没有成员'
              : overview && overview.club.timetableEmpty > 0
                ? `${overview.club.timetableEmpty} 人还没录`
                : '已全部录入'
          }
          tone={fillRate === 100 ? 'mint' : fillRate >= 60 ? 'amber' : 'danger'}
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
          label={`第 ${overview?.week.weekNo ?? '-'} 周全员空闲`}
          value={`${overview?.week.fullyFreeCells ?? 0} 段`}
          hint="全员都没课的时段数"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          label="刷题进度"
          value={`${overview?.practice.solved ?? 0}/${overview?.practice.problems ?? 0}`}
          hint={`共提交 ${overview?.practice.submissions ?? 0} 次`}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-ink">成员课表填写情况</div>
            <Badge tone="outline">{members.length} 人</Badge>
          </div>
          {members.length === 0 ? (
            <p className="mt-3 text-xs text-muted">还没有成员。</p>
          ) : (
            <div className="mt-2 flex flex-col divide-y divide-line">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: member.color }} aria-hidden />
                    <span className="truncate text-ink">{member.name}</span>
                    <Badge tone="neutral">{roleLabel(member.role)}</Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-muted">
                    {member.schedules === 0 ? <Badge tone="danger">未录课表</Badge> : <span>{member.schedules} 节课</span>}
                    {member.busiestWeekday ? (
                      <span className="text-subtle">最忙 {WEEKDAY_LABELS[member.busiestWeekday as Weekday]}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <BarChart3 className="h-4 w-4 text-brand" aria-hidden />
            哪天最容易凑齐人
          </div>
          <p className="mt-1 text-2xs text-subtle">按「全员都空」的时段数量排序</p>
          {slots.length === 0 ? (
            <EmptyState compact title="暂无数据" description="先创建学期与时间段。" className="mt-3" />
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {byWeekday.map((item) => (
                <div key={item.weekday} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-2xs text-muted">{WEEKDAY_LABELS[item.weekday]}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                    <div
                      className={cn('h-full rounded-full', item.allFree === 0 ? 'bg-slate-200' : 'bg-brand')}
                      style={{ width: `${Math.round((item.allFree / maxAllFree) * 100)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-2xs text-muted">
                    {item.allFree}/{item.total} 段
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <CalendarClock className="h-4 w-4 text-brand" aria-hidden />
              活动开展情况
            </div>
            <Link to="/activities" className="text-2xs text-brand hover:underline">
              去活动页 →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <StatBlock label="全部" value={overview?.activities.total ?? 0} />
            <StatBlock label="待进行" value={overview?.activities.upcoming ?? 0} tone="amber" />
            <StatBlock label="已完成" value={overview?.activities.done ?? 0} tone="mint" />
          </div>
          <p className="mt-3 text-2xs leading-5 text-subtle">
            {(overview?.activities.total ?? 0) === 0
              ? '还没有活动记录。可以先去「空闲时间」找一个全员都空的时段，一键排活动。'
              : `平均每位成员参与 ${memberAvgActivities} 场活动。`}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
              刷题训练情况
            </div>
            <Link to="/practice" className="text-2xs text-brand hover:underline">
              去题库 →
            </Link>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-2xs text-muted">
              <span>
                已通过 <span className="text-sm font-semibold text-ink">{overview?.practice.solved ?? 0}</span> /{' '}
                {overview?.practice.problems ?? 0} 题
              </span>
              <span>提交 {overview?.practice.submissions ?? 0} 次</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${practiceRate}%` }} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="mint">已通过 {overview?.practice.solved ?? 0} 题</Badge>
            <Badge tone="amber">练过未过 {overview?.practice.attempted ?? 0} 题</Badge>
            <Badge tone="neutral">待开始 {Math.max((overview?.practice.problems ?? 0) - (overview?.practice.solved ?? 0) - (overview?.practice.attempted ?? 0), 0)} 题</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBlock({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'mint' | 'amber' }) {
  const valueClass = { neutral: 'text-ink', mint: 'text-mint', amber: 'text-amber' }[tone];
  return (
    <div className="rounded-control border border-line bg-canvas px-2 py-2">
      <div className={cn('text-lg font-semibold tabular-nums', valueClass)}>{value}</div>
      <div className="text-2xs text-subtle">{label}</div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'brand' | 'mint' | 'amber' | 'danger';
}) {
  const toneClass = {
    brand: 'text-brand bg-brand-soft',
    mint: 'text-mint bg-emerald-50',
    amber: 'text-amber bg-amber-50',
    danger: 'text-danger bg-red-50',
  }[tone];
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneClass)}>{icon}</span>
        <span className="text-2xs text-muted">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-2xs text-subtle">{hint}</div> : null}
    </Card>
  );
}
