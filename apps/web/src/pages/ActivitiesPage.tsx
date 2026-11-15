import type { Activity, ActivityStatus } from '@cims/shared';
import { CalendarPlus, CheckCircle2, MapPin, Pencil, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { ActivityFormDialog, kindLabel, statusLabel } from '../components/pages/activities/ActivityFormDialog';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';
import { useActivities, useCreateActivity, useDeleteActivity, useUpdateActivity } from '../hooks/useActivities';
import { useUsers } from '../hooks/useUsers';
import { getErrorMessage } from '../lib/errors';
import type { ActivityInput } from '../api/activities';

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatDate(date: string): string {
  const parsed = new Date(date + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日 ${WEEKDAY[parsed.getDay()]}`;
}

function statusTone(status: ActivityStatus) {
  if (status === 'done') return 'mint' as const;
  if (status === 'canceled') return 'neutral' as const;
  return 'brand' as const;
}

const FILTERS: { value: 'all' | ActivityStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'planned', label: '待进行' },
  { value: 'done', label: '已完成' },
  { value: 'canceled', label: '已取消' },
];

export default function ActivitiesPage() {
  const activitiesQuery = useActivities({});
  const usersQuery = useUsers();
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();
  const deleteMutation = useDeleteActivity();

  const [filter, setFilter] = useState<'all' | ActivityStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [removing, setRemoving] = useState<Activity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const members = usersQuery.data ?? [];
  const memberName = useMemo(() => new Map(members.map((member) => [member.id, member.name])), [members]);

  const activities = activitiesQuery.data ?? [];
  const visible = filter === 'all' ? activities : activities.filter((item) => item.status === filter);
  const upcoming = activities.filter((item) => item.status === 'planned');

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(activity: Activity) {
    setEditing(activity);
    setFormError(null);
    setFormOpen(true);
  }

  function submit(input: ActivityInput) {
    setFormError(null);
    const onError = (error: unknown) => setFormError(getErrorMessage(error));
    if (editing) {
      updateMutation.mutate({ id: editing.id, patch: input }, { onSuccess: () => setFormOpen(false), onError });
      return;
    }
    createMutation.mutate(input, { onSuccess: () => setFormOpen(false), onError });
  }

  function markDone(activity: Activity) {
    updateMutation.mutate({ id: activity.id, patch: { status: 'done' } });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="活动"
        title="活动排期"
        description="社团例会、培训、比赛报名…统一记在这里，谁参加、在哪、什么状态一目了然。"
        actions={
          <Button iconLeft={<CalendarPlus className="h-4 w-4" aria-hidden />} onClick={openCreate}>
            新建活动
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} size="sm" ariaLabel="按状态筛选" />
        <div className="text-xs text-muted">
          共 {activities.length} 场 · 待进行 {upcoming.length} 场
        </div>
      </div>

      {activitiesQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
          title={activities.length === 0 ? '还没有活动' : '这个状态下没有活动'}
          description={
            activities.length === 0
              ? '先建一个本周例会，把参与人勾上，之后在「空闲时间」里找大家都有空的时段会更方便。'
              : '换个筛选条件看看。'
          }
          action={
            activities.length === 0 ? (
              <Button size="sm" onClick={openCreate}>
                新建活动
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((activity) => (
            <Card key={activity.id} className="p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{activity.title}</span>
                    <Badge tone={statusTone(activity.status)}>{statusLabel(activity.status)}</Badge>
                    <Badge tone="outline">{kindLabel(activity.kind)}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{formatDate(activity.date)}</span>
                    {activity.startTime ? (
                      <span>
                        {activity.startTime}
                        {activity.endTime ? '–' + activity.endTime : ''}
                      </span>
                    ) : null}
                    {activity.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {activity.location}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" aria-hidden />
                      {activity.participantIds.length > 0
                        ? activity.participantIds
                            .slice(0, 4)
                            .map((id) => memberName.get(id) ?? '已删除')
                            .join('、') + (activity.participantIds.length > 4 ? ` 等 ${activity.participantIds.length} 人` : '')
                        : '未指定参与人'}
                    </span>
                  </div>
                  {activity.note ? <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">{activity.note}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {activity.status === 'planned' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                      onClick={() => markDone(activity)}
                    >
                      完成
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" iconLeft={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={() => openEdit(activity)}>
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-red-50"
                    iconLeft={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    onClick={() => setRemoving(activity)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ActivityFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        activity={editing}
        members={members}
        submitting={createMutation.isPending || updateMutation.isPending}
        error={formError}
        onSubmit={submit}
      />

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="删除活动"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (!removing) return;
                deleteMutation.mutate(removing.id, { onSuccess: () => setRemoving(null) });
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">确定删除「{removing?.title}」吗？删除后无法恢复。</p>
      </Dialog>
    </div>
  );
}
