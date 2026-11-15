import type { BoardCell, Weekday } from '@cims/shared';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@cims/shared';
import { CalendarDays, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PersonalBoardPanel } from '../components/pages/dashboard/PersonalBoardPanel';
import { RefreshButton } from '../components/schedule/RefreshButton';
import { ScheduleSkeleton } from '../components/schedule/ScheduleSkeleton';
import { WeekSwitcher } from '../components/schedule/WeekSwitcher';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useAggregateBoard } from '../hooks/useBoard';
import { useSemester } from '../hooks/useSemester';
import { useUsers } from '../hooks/useUsers';
import { useWeekParam } from '../hooks/useWeek';
import { cn } from '../lib/cn';

/**
 * 课表：两种视图
 * - 合并视图：一眼看出哪个时段谁有空，用于排活动
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
  const [cell, setCell] = useState<BoardCell | null>(null);

  // 当前查看的成员写进 URL（?member=3），刷新或分享链接都能回到同一张课表
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

  const boardQuery = useAggregateBoard(selectedUserId === null ? weekNo : null);
  const board = boardQuery.data;
  const users = usersQuery.data ?? [];
  const usersById = useMemo(() => new Map((board?.users ?? []).map((user) => [user.id, user])), [board?.users]);

  const slots = board?.slots ?? [];
  const cellMap = useMemo(() => {
    const map = new Map<string, BoardCell>();
    for (const item of board?.cells ?? []) map.set(item.weekday + ':' + item.slotId, item);
    return map;
  }, [board?.cells]);

  const selectedMember = users.find((user) => user.id === selectedUserId) ?? null;

  if (semesterQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <ScheduleSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="课表"
        title="成员课表"
        description="先把每个成员的课录进来；合并视图会告诉你哪个时段谁有空，安排活动就不用一个个问了。"
        actions={<RefreshButton />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {weeks.length > 0 ? (
          <WeekSwitcher week={selectedWeek} weeks={weeks} onChange={setWeek} />
        ) : (
          <span className="text-xs text-muted">还没有学期，请先到「设置」里创建学期。</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={selectedUserId === null ? 'primary' : 'secondary'}
            iconLeft={<Users className="h-3.5 w-3.5" aria-hidden />}
            onClick={() => selectMember(null)}
          >
            合并视图
          </Button>
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
      </div>

      {selectedUserId !== null ? (
        <Card className="overflow-hidden">
          <PersonalBoardPanel
            key={selectedUserId}
            userId={selectedUserId}
            week={weekNo}
            editable
            onSaved={() => void boardQuery.refetch()}
          />
        </Card>
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
          description="到「设置 → 时间段」里定义社团常用的时间块（例如「午休 12:30–13:30」）。"
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="font-medium text-ink">{board.week.weekNo} 周</span>
              <span>{board.week.startDate} ~ {board.week.endDate}</span>
              <Badge tone="outline">{board.users.length} 人</Badge>
            </div>
            <div className="flex items-center gap-2 text-2xs text-subtle">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" aria-hidden />全员有空
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-100" aria-hidden />部分有空
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-100" aria-hidden />都有课
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-line bg-canvas text-2xs text-subtle">
                  <th className="w-[132px] px-3 py-2 text-left font-medium">时间段</th>
                  {WEEKDAY_ORDER.map((weekday) => (
                    <th key={weekday} className="px-1 py-2 text-center font-medium">
                      {WEEKDAY_LABELS[weekday as Weekday]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5">
                      <div className="text-xs font-medium text-ink">{slot.label}</div>
                      <div className="text-2xs text-subtle">
                        {slot.startTime ? `${slot.startTime}–${slot.endTime ?? ''}` : `${slot.durationMin} 分钟`}
                      </div>
                    </td>
                    {WEEKDAY_ORDER.map((weekday) => {
                      const item = cellMap.get(weekday + ':' + slot.id);
                      const total = item?.totalUsers ?? board.users.length;
                      const free = item?.freeCount ?? total;
                      const allFree = total > 0 && free === total;
                      const noneFree = free === 0;
                      return (
                        <td key={weekday} className="p-0.5">
                          <button
                            type="button"
                            onClick={() => item && setCell(item)}
                            className={cn(
                              'flex h-10 w-full flex-col items-center justify-center rounded-md text-2xs transition-colors',
                              allFree
                                ? 'bg-emerald-50 text-mint hover:bg-emerald-100'
                                : noneFree
                                  ? 'bg-red-50 text-danger hover:bg-red-100'
                                  : 'bg-amber-50 text-amber hover:bg-amber-100',
                            )}
                            title={allFree ? '全员有空' : `空闲 ${free}/${total}`}
                          >
                            <span className="text-sm font-semibold leading-4">{free}</span>
                            <span className="leading-3 opacity-70">/ {total}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line px-3 py-2 text-2xs text-subtle">
            格子里是「有空人数 / 总人数」，点开可以看具体是谁。
          </div>
        </Card>
      )}

      <Dialog
        open={cell !== null}
        onClose={() => setCell(null)}
        size="sm"
        title={`${cell ? WEEKDAY_LABELS[cell.weekday as Weekday] : ''} · ${cell ? slots.find((slot) => slot.id === cell.slotId)?.label ?? '' : ''}`}
      >
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <div className="mb-1 font-medium text-ink">有空（{cell?.freeCount ?? 0}）</div>
            <div className="flex flex-wrap gap-1">
              {(cell?.freeUserIds ?? []).map((id) => (
                <Badge key={id} tone="mint">
                  {usersById.get(id)?.name ?? '成员'}
                </Badge>
              ))}
              {(cell?.freeUserIds ?? []).length === 0 ? <span className="text-subtle">没有</span> : null}
            </div>
          </div>
          <div>
            <div className="mb-1 font-medium text-ink">有课（{cell?.occupiedUserIds.length ?? 0}）</div>
            <div className="flex flex-wrap gap-1">
              {(cell?.occupiedUserIds ?? []).map((id) => (
                <Badge key={id} tone="neutral">
                  {usersById.get(id)?.name ?? '成员'}
                </Badge>
              ))}
              {(cell?.occupiedUserIds ?? []).length === 0 ? <span className="text-subtle">没有</span> : null}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
