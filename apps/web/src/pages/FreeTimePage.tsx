import type { BoardCell, Weekday } from '@cims/shared';
import { WEEKDAY_LABELS, addDays } from '@cims/shared';
import { CalendarPlus, Sparkles, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { ActivityFormDialog } from '../components/pages/activities/ActivityFormDialog';
import { WeekSwitcher } from '../components/schedule/WeekSwitcher';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useCreateActivity } from '../hooks/useActivities';
import { useAggregateBoardWithin } from '../hooks/useAggregateBoard';
import { useSemester } from '../hooks/useSemester';
import { useUsers } from '../hooks/useUsers';
import { useWeekParam } from '../hooks/useWeek';
import { cn } from '../lib/cn';
import { getErrorMessage } from '../lib/errors';
import type { ActivityInput } from '../api/activities';

interface Candidate {
  weekday: Weekday;
  slotId: number;
  label: string;
  startTime: string | null;
  endTime: string | null;
  freeCount: number;
  total: number;
  freeNames: string[];
  busyNames: string[];
}

/** 找时间：选定要参加的人，列出本周他们全都空着的时段，一键排活动。 */
export default function FreeTimePage() {
  const semesterQuery = useSemester();
  const usersQuery = useUsers(false);
  const semester = semesterQuery.data?.semester;
  const weeks = semesterQuery.data?.weeks ?? [];
  const currentWeek = weeks.find((item) => item.isCurrent) ?? weeks[0];
  const { week: weekParam, setWeek } = useWeekParam(semester?.totalWeeks);
  const weekNo = weekParam ?? currentWeek?.weekNo ?? null;
  const selectedWeek = weeks.find((item) => item.weekNo === weekNo) ?? currentWeek;

  const members = usersQuery.data ?? [];
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const attendeeIds = members.filter((member) => !excluded.has(member.id)).map((member) => member.id);

  const boardQuery = useAggregateBoardWithin(weekNo, attendeeIds.length > 0 ? attendeeIds : null);
  const board = boardQuery.data;
  const createMutation = useCreateActivity();

  const [preset, setPreset] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAllPerfect, setShowAllPerfect] = useState(false);

  const usersById = useMemo(() => new Map((board?.users ?? []).map((user) => [user.id, user])), [board?.users]);

  const candidates = useMemo<Candidate[]>(() => {
    if (!board) return [];
    const slots = [...board.slots].sort((a, b) => a.sortOrder - b.sortOrder);
    const result: Candidate[] = [];
    for (const slot of slots) {
      for (const weekday of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
        const cell: BoardCell | undefined = board.cells.find((item) => item.weekday === weekday && item.slotId === slot.id);
        const total = cell?.totalUsers ?? board.users.length;
        const freeCount = cell?.freeCount ?? total;
        if (total === 0) continue;
        result.push({
          weekday,
          slotId: slot.id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          freeCount,
          total,
          freeNames: (cell?.freeUserIds ?? []).map((id) => usersById.get(id)?.name ?? '成员'),
          busyNames: (cell?.occupiedUserIds ?? []).map((id) => usersById.get(id)?.name ?? '成员'),
        });
      }
    }
    return result;
  }, [board, usersById]);

  const perfect = candidates.filter((item) => item.freeCount === item.total);
  const visiblePerfect = showAllPerfect ? perfect : perfect.slice(0, 9);
  const partial = candidates
    .filter((item) => item.freeCount < item.total && item.freeCount > 0)
    .sort((a, b) => b.freeCount - a.freeCount)
    .slice(0, 6);

  function scheduleFor(candidate: Candidate) {
    if (!board) return;
    const date = addDays(board.week.startDate, candidate.weekday - 1);
    setFormError(null);
    setPreset({
      date,
      startTime: candidate.startTime ?? '',
      endTime: candidate.endTime ?? '',
    });
  }

  function submitActivity(input: ActivityInput) {
    setFormError(null);
    createMutation.mutate(input, {
      onSuccess: () => setPreset(null),
      onError: (error) => setFormError(getErrorMessage(error)),
    });
  }

  function toggleMember(id: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (semesterQuery.isPending || usersQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="空闲时间"
        title="找共同空闲"
        description="选出要参加的人，这里会列出本周所有人都空着的时段；点一下就按这个时间建活动。"
        actions={weeks.length > 0 ? <WeekSwitcher week={selectedWeek} weeks={weeks} onChange={setWeek} /> : null}
      />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Users className="h-3.5 w-3.5" aria-hidden />
            参加人（{attendeeIds.length}/{members.length}）
          </span>
          {members.map((member) => {
            const selected = !excluded.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMember(member.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  selected ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-subtle line-through',
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: member.color }} aria-hidden />
                {member.name}
              </button>
            );
          })}
          {members.length === 0 ? <span className="text-xs text-subtle">还没有成员</span> : null}
        </div>
      </Card>

      {boardQuery.isPending ? (
        <Skeleton className="h-52 w-full" />
      ) : attendeeIds.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" aria-hidden />} title="至少选一个人" description="取消全选后就没有可统计的对象了。" />
      ) : perfect.length === 0 && partial.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" aria-hidden />}
          title="这一周没有大家都空的时段"
          description="试试减少参加人，或者换到别的周次；也可以先补录成员的课表再来看。"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-ink">全员都空</span>
              <Badge tone="mint">{perfect.length} 个时段</Badge>
            </div>
            {perfect.length === 0 ? (
              <p className="text-xs text-muted">没有全员都空的时段，看看下面的部分空闲。</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visiblePerfect.map((candidate) => (
                    <Card key={candidate.weekday + '-' + candidate.slotId} className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">
                          {WEEKDAY_LABELS[candidate.weekday]} · {candidate.label}
                        </div>
                        <div className="text-2xs text-subtle">
                          {candidate.startTime ? `${candidate.startTime}–${candidate.endTime ?? ''}` : '未设时间'}
                          {' · '}
                          全员 {candidate.total} 人有空
                        </div>
                      </div>
                      <Button size="sm" variant="soft" iconLeft={<CalendarPlus className="h-3.5 w-3.5" aria-hidden />} onClick={() => scheduleFor(candidate)}>
                        排活动
                      </Button>
                    </Card>
                  ))}
                </div>
                {perfect.length > 9 ? (
                  <div className="mt-2 flex justify-center">
                    <Button size="sm" variant="ghost" onClick={() => setShowAllPerfect((prev) => !prev)}>
                      {showAllPerfect ? '收起' : `展开其余 ${perfect.length - 9} 个时段`}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {partial.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-ink">部分人有空</span>
                <Badge tone="amber">前 {partial.length} 个</Badge>
              </div>
              <div className="flex flex-col gap-1.5">
                {partial.map((candidate) => (
                  <Card key={candidate.weekday + '-' + candidate.slotId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-ink">
                        {WEEKDAY_LABELS[candidate.weekday]} · {candidate.label}
                        <span className="ml-2 text-2xs font-normal text-muted">
                          {candidate.freeCount}/{candidate.total} 人有空
                        </span>
                      </div>
                      <div className="truncate text-2xs text-subtle">有课：{candidate.busyNames.join('、')}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => scheduleFor(candidate)}>
                      仍然排
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <ActivityFormDialog
        open={preset !== null}
        onClose={() => setPreset(null)}
        members={members}
        preset={preset ?? undefined}
        submitting={createMutation.isPending}
        error={formError}
        onSubmit={submitActivity}
      />
    </div>
  );
}
