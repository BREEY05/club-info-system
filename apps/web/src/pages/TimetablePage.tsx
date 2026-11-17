import type { BoardCell, Weekday } from '@cims/shared';
import { WEEKDAY_LABELS, addDays } from '@cims/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, CheckCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ActivityInput } from '../api/activities';
import { fetchMemberStats, statsKeys } from '../api/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { ActivityFormDialog } from '../components/pages/activities/ActivityFormDialog';
import { PersonalBoardPanel } from '../components/pages/dashboard/PersonalBoardPanel';
import { AggregateGrid } from '../components/schedule/AggregateGrid';
import { CellDrawer } from '../components/schedule/CellDrawer';
import { GridLegend } from '../components/schedule/GridLegend';
import { RefreshButton } from '../components/schedule/RefreshButton';
import { ScheduleFormDialog } from '../components/schedule/ScheduleFormDialog';
import { ScheduleSkeleton } from '../components/schedule/ScheduleSkeleton';
import { WeekSwitcher } from '../components/schedule/WeekSwitcher';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useAggregateBoard, useWeekSchedules } from '../hooks/useBoard';
import { useCreateActivity } from '../hooks/useActivities';
import { useSemester } from '../hooks/useSemester';
import { useUsers } from '../hooks/useUsers';
import { useWeekParam } from '../hooks/useWeek';
import { cn } from '../lib/cn';
import { getErrorMessage } from '../lib/errors';
import { cellKey } from '../lib/schedules';

/**
 * 课表：两个视图
 * - 合并视图：五档热度网格，一眼看出哪个时段谁有空，点格子看名单、直接排活动
 * - 成员课表：逐个成员录入/修改
 */
export default function TimetablePage() {
  const semesterQuery = useSemester();
  const usersQuery = useUsers(false);
  const semester = semesterQuery.data?.semester;
  const weeks = semesterQuery.data?.weeks ?? [];
  const currentWeek = weeks.find((item) => item.isCurrent) ?? weeks[0];
  const { week: weekParam, setWeek } = useWeekParam(semester?.totalWeeks);
  const weekNo = weekParam ?? currentWeek?.weekNo ?? null;
  const selectedWeek = weeks.find((item) => item.weekNo === weekNo) ?? currentWeek;

  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerCell, setDrawerCell] = useState<{ weekday: Weekday; slotId: number } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ weekday: Weekday; slotId: number } | null>(null);
  const [preset, setPreset] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 当前查看的成员写进 URL（?member=3），刷新或收藏都能回到同一张课表
  const memberParam = Number(searchParams.get('member'));
  const selectedUserId = Number.isInteger(memberParam) && memberParam > 0 ? memberParam : null;
  function selectMember(id: number | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === null) next.delete('member');
        else next.set('member', String(id));
        return next;
      },
      { replace: true },
    );
  }

  const boardQuery = useAggregateBoard(weekNo);
  const schedulesQuery = useWeekSchedules(weekNo);
  const memberStatsQuery = useQuery({ queryKey: statsKeys.members, queryFn: fetchMemberStats, staleTime: 30_000 });
  const createActivity = useCreateActivity();

  const board = boardQuery.data;
  const users = usersQuery.data ?? [];
  const usersById = useMemo(() => new Map((board?.users ?? []).map((user) => [user.id, user])), [board?.users]);
  const slots = useMemo(() => [...(board?.slots ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [board?.slots]);
  const cellMap = useMemo(() => {
    const map = new Map<string, BoardCell>();
    for (const item of board?.cells ?? []) map.set(cellKey(item.weekday, item.slotId), item);
    return map;
  }, [board?.cells]);

  const selectedMember = users.find((user) => user.id === selectedUserId) ?? null;
  const totalUsers = board?.users.length ?? users.length;

  // 全员都有空的时段：排活动时优先看这几个
  const fullyFree = useMemo(() => {
    if (!board) return [] as Array<{ weekday: Weekday; slotId: number; label: string; time: string }>;
    return slots
      .flatMap((slot) =>
        ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => {
          const cell = cellMap.get(cellKey(weekday, slot.id));
          const total = cell?.totalUsers ?? totalUsers;
          const free = cell?.freeCount ?? total;
          if (total === 0 || free < total) return null;
          return {
            weekday,
            slotId: slot.id,
            label: slot.label,
            time: slot.startTime ? `${slot.startTime}–${slot.endTime ?? ''}` : `${slot.durationMin} 分钟`,
          };
        }),
      )
      .filter((item): item is { weekday: Weekday; slotId: number; label: string; time: string } => item !== null);
  }, [board, slots, cellMap, totalUsers]);

  const occupiedCells = (board?.cells ?? []).reduce((sum, cell) => sum + cell.occupiedUserIds.length, 0);
  const perMember = totalUsers > 0 ? occupiedCells / totalUsers : 0;
  const busiestWeekday = useMemo(() => {
    const totals = new Map<number, number>();
    for (const cell of board?.cells ?? []) {
      totals.set(cell.weekday, (totals.get(cell.weekday) ?? 0) + cell.occupiedUserIds.length);
    }
    let best: { weekday: number; count: number } | null = null;
    // 按周一到周日顺序比较，人数并列时取靠前的一天
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      const count = totals.get(weekday) ?? 0;
      if (count > 0 && (!best || count > best.count)) best = { weekday, count };
    }
    return best && best.count > 0 ? (best.weekday as Weekday) : null;
  }, [board?.cells]);

  const memberStats = memberStatsQuery.data ?? [];
  const missingTimetable = memberStats.filter((item) => item.schedules === 0).map((item) => item.name);
  const filledCount = memberStats.length - missingTimetable.length;

  const drawerSlot = drawerCell ? slots.find((slot) => slot.id === drawerCell.slotId) : undefined;
  const drawerFreeIds = drawerCell ? (cellMap.get(cellKey(drawerCell.weekday, drawerCell.slotId))?.freeUserIds ?? []) : [];
  const drawerBusyIds = drawerCell ? (cellMap.get(cellKey(drawerCell.weekday, drawerCell.slotId))?.occupiedUserIds ?? []) : [];
  const drawerFreeUsers = drawerFreeIds.map((id) => usersById.get(id)).filter((user) => user !== undefined);
  const drawerBusyUsers = drawerBusyIds.map((id) => usersById.get(id)).filter((user) => user !== undefined);

  function scheduleActivity(weekday: Weekday, startTime: string | null, endTime: string | null) {
    if (!board) return;
    setFormError(null);
    setPreset({
      date: addDays(board.week.startDate, weekday - 1),
      startTime: startTime ?? '',
      endTime: endTime ?? '',
    });
  }

  function submitActivity(input: ActivityInput) {
    setFormError(null);
    createActivity.mutate(input, {
      onSuccess: () => {
        setPreset(null);
        setDrawerCell(null);
      },
      onError: (error) => setFormError(getErrorMessage(error)),
    });
  }

  if (semesterQuery.isPending) return <ScheduleSkeleton />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="课表"
        title="成员课表"
        description="先把每个成员的课录进来；合并视图用颜色标出哪个时段人最齐，排活动不用一个个问。"
        actions={<RefreshButton />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {weeks.length > 0 ? (
          <WeekSwitcher week={selectedWeek} weeks={weeks} onChange={setWeek} />
        ) : (
          <span className="text-xs text-muted">还没有学期，请先到「设置」里创建学期。</span>
        )}
        <div className="flex items-center gap-0.5 rounded-control border border-line bg-canvas p-0.5">
          <button
            type="button"
            onClick={() => selectMember(null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs transition-colors',
              selectedUserId === null ? 'bg-surface font-medium text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            合并视图
          </button>
          <button
            type="button"
            onClick={() => selectMember(selectedUserId ?? users[0]?.id ?? null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs transition-colors',
              selectedUserId !== null ? 'bg-surface font-medium text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            成员课表
          </button>
        </div>
      </div>

      {selectedUserId !== null ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => selectMember(user.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  selectedUserId === user.id
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-surface text-muted hover:text-ink',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: user.color }} aria-hidden />
                {user.name}
              </button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <PersonalBoardPanel
              key={selectedUserId}
              userId={selectedUserId}
              week={weekNo}
              editable
              onSaved={() => void boardQuery.refetch()}
            />
          </Card>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="还没有成员"
          description="先去「成员」里把社团的人加进来，然后就能录课表了。"
          action={
            <Link to="/members">
              <Button size="sm">去添加成员</Button>
            </Link>
          }
        />
      ) : boardQuery.isPending ? (
        <ScheduleSkeleton />
      ) : !board ? (
        <EmptyState
          title="这一周暂时没有数据"
          description={boardQuery.isError ? '读取失败，点右上角刷新重试。' : '换个周次看看。'}
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
      ) : slots.length === 0 ? (
        <EmptyState
          title="还没有时间段"
          description="到「时间段」里定义社团常用的时间块（例如「午休 12:30–13:30」）。"
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-ink">第 {board.week.weekNo} 周</span>
                <span className="tabular text-muted">
                  {board.week.startDate.slice(5)} – {board.week.endDate.slice(5)}
                </span>
                <Badge tone="outline">{totalUsers} 人</Badge>
                <Badge tone="brand">全员有空 {fullyFree.length} 段</Badge>
              </div>
              <GridLegend />
            </div>
            <div className="scrollbar-thin overflow-x-auto px-3 py-3">
              <AggregateGrid
                week={board.week}
                slots={slots}
                cells={board.cells}
                totalUsers={totalUsers}
                batchMode={false}
                selected={new Set<string>()}
                visibleKeys={null}
                onOpenCell={(weekday, slot) => setDrawerCell({ weekday, slotId: slot.id })}
                onCellPointerDown={() => undefined}
                onCellPointerEnter={() => undefined}
                onCellKeyboardToggle={() => undefined}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">全员都有空的时段</span>
                  <Badge tone="mint">{fullyFree.length}</Badge>
                </div>
                <Link to="/free" className="text-2xs text-brand hover:underline">
                  换参加人再找 →
                </Link>
              </div>
              {fullyFree.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted">
                  这周凑不齐人。成员课表补齐后回来看看，或者去「空闲时间」里减少参加人。
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2">
                    {fullyFree.slice(0, 8).map((item) => {
                      const slot = slots.find((entry) => entry.id === item.slotId);
                      return (
                        <button
                          key={cellKey(item.weekday, item.slotId)}
                          type="button"
                          onClick={() => scheduleActivity(item.weekday, slot?.startTime ?? null, slot?.endTime ?? null)}
                          className="group flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-brand hover:bg-brand-soft"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-ink">
                              {WEEKDAY_LABELS[item.weekday]} · {item.label}
                            </span>
                            <span className="tabular block text-2xs text-subtle">{item.time}</span>
                          </span>
                          <CalendarPlus
                            className="h-3.5 w-3.5 shrink-0 text-subtle transition-colors group-hover:text-brand"
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                  {fullyFree.length > 8 ? (
                    <div className="border-t border-line px-4 py-2 text-2xs text-muted">
                      还有 {fullyFree.length - 8} 个时段，去{' '}
                      <Link to="/free" className="text-brand hover:underline">
                        空闲时间
                      </Link>{' '}
                      看全部
                    </div>
                  ) : null}
                </>
              )}
            </Card>

            <Card className="flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="text-sm font-medium text-ink">课表录入进度</span>
                <span className="tabular text-2xs text-muted">
                  {filledCount}/{memberStats.length || totalUsers}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                <div className="flex items-baseline gap-1">
                  <span className="tabular text-2xl font-semibold text-ink">{filledCount}</span>
                  <span className="text-xs text-muted">/ {memberStats.length || totalUsers} 人已录</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      missingTimetable.length === 0 ? 'bg-mint' : filledCount === 0 ? 'bg-danger' : 'bg-amber',
                    )}
                    style={{
                      width: `${memberStats.length ? Math.round((filledCount / memberStats.length) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="rounded-control bg-canvas px-2.5 py-1.5">
                    <div className="text-2xs text-subtle">人均课时 / 周</div>
                    <div className="tabular text-sm font-medium text-ink">{perMember.toFixed(1)} 节</div>
                  </div>
                  <div className="rounded-control bg-canvas px-2.5 py-1.5">
                    <div className="text-2xs text-subtle">最忙的一天</div>
                    <div className="text-sm font-medium text-ink">
                      {busiestWeekday ? WEEKDAY_LABELS[busiestWeekday] : '—'}
                    </div>
                  </div>
                </div>
                {missingTimetable.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-mint">
                    <CheckCheck className="h-4 w-4" aria-hidden />
                    全部成员都已录入课表
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {missingTimetable.map((name) => (
                        <Badge key={name} tone="amber">
                          {name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-2xs leading-5 text-muted">
                      没录课表的成员不会被算进「谁有空」，建议先补齐。右侧「成员课表」里逐个录。
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {drawerCell && drawerSlot && board ? (
        <CellDrawer
          week={board.week}
          weekday={drawerCell.weekday}
          slot={drawerSlot}
          freeUsers={drawerFreeUsers}
          occupiedUsers={drawerBusyUsers}
          schedules={schedulesQuery.data}
          schedulesLoading={schedulesQuery.isPending}
          onClose={() => setDrawerCell(null)}
          onPickUser={(user) => {
            setDrawerCell(null);
            selectMember(user.id);
          }}
          onAddSchedule={() => setScheduleForm({ weekday: drawerCell.weekday, slotId: drawerCell.slotId })}
        />
      ) : null}

      {scheduleForm && board ? (
        <ScheduleFormDialog
          mode="create"
          defaultWeekday={scheduleForm.weekday}
          defaultSlotId={scheduleForm.slotId}
          defaultStartWeek={board.week.weekNo}
          users={users}
          slots={slots}
          weeks={weeks}
          totalWeeks={semester?.totalWeeks ?? weeks.length}
          onClose={() => setScheduleForm(null)}
          onSaved={() => {
            setScheduleForm(null);
            void boardQuery.refetch();
            void schedulesQuery.refetch();
          }}
        />
      ) : null}

      <ActivityFormDialog
        open={preset !== null}
        onClose={() => setPreset(null)}
        members={users}
        preset={preset ?? undefined}
        submitting={createActivity.isPending}
        error={formError}
        onSubmit={submitActivity}
      />
    </div>
  );
}
