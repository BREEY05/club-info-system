import type { Activity, ActivityKind, ActivityStatus, AppUser } from '@cims/shared';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input, Select, Textarea } from '../../ui/Input';
import { cn } from '../../../lib/cn';
import type { ActivityInput } from '../../../api/activities';

export const ACTIVITY_KINDS: { value: ActivityKind; label: string }[] = [
  { value: 'meeting', label: '例会' },
  { value: 'training', label: '培训/训练' },
  { value: 'event', label: '活动' },
  { value: 'other', label: '其他' },
];

export const ACTIVITY_STATUSES: { value: ActivityStatus; label: string }[] = [
  { value: 'planned', label: '待进行' },
  { value: 'done', label: '已完成' },
  { value: 'canceled', label: '已取消' },
];

export function kindLabel(kind: ActivityKind): string {
  return ACTIVITY_KINDS.find((item) => item.value === kind)?.label ?? '其他';
}

export function statusLabel(status: ActivityStatus): string {
  return ACTIVITY_STATUSES.find((item) => item.value === status)?.label ?? '待进行';
}

export interface ActivityFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** 传入则为编辑 */
  activity?: Activity | null;
  members: AppUser[];
  /** 预填日期与时间，用于「从空闲时段排活动」 */
  preset?: { date?: string; startTime?: string; endTime?: string };
  submitting?: boolean;
  error?: string | null;
  onSubmit: (input: ActivityInput) => void;
}

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const EMPTY = {
  title: '',
  kind: 'meeting' as ActivityKind,
  status: 'planned' as ActivityStatus,
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  note: '',
  participantIds: [] as number[],
};

export function ActivityFormDialog({
  open,
  onClose,
  activity,
  members,
  preset,
  submitting = false,
  error,
  onSubmit,
}: ActivityFormDialogProps) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setForm({
        title: activity.title,
        kind: activity.kind,
        status: activity.status,
        date: activity.date,
        startTime: activity.startTime,
        endTime: activity.endTime,
        location: activity.location,
        note: activity.note,
        participantIds: activity.participantIds,
      });
      return;
    }
    setForm({
      ...EMPTY,
      date: preset?.date ?? todayIso(),
      startTime: preset?.startTime ?? '',
      endTime: preset?.endTime ?? '',
      participantIds: members.filter((member) => member.isActive).map((member) => member.id),
    });
  }, [open, activity, preset, members]);

  const activeMembers = useMemo(() => members.filter((member) => member.isActive), [members]);

  function toggleMember(id: number) {
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(id)
        ? prev.participantIds.filter((item) => item !== id)
        : [...prev.participantIds, id],
    }));
  }

  function submit() {
    onSubmit({
      title: form.title.trim(),
      kind: form.kind,
      status: form.status,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim(),
      note: form.note.trim(),
      participantIds: form.participantIds,
    });
  }

  const valid = form.title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={activity ? '编辑活动' : '新建活动'}
      description="活动的参与人从成员名单里选择，方便你知道谁该到。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!valid}>
            {activity ? '保存' : '创建'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">活动名称</span>
          <Input
            autoFocus
            value={form.title}
            maxLength={60}
            placeholder="例如：第 8 周例会"
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">类型</span>
            <Select
              value={form.kind}
              onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as ActivityKind }))}
            >
              {ACTIVITY_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">状态</span>
            <Select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ActivityStatus }))}
            >
              {ACTIVITY_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">日期</span>
            <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">开始</span>
            <Input type="time" value={form.startTime} onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">结束</span>
            <Input type="time" value={form.endTime} onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))} />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">地点</span>
          <Input
            value={form.location}
            maxLength={60}
            placeholder="例如：实验楼 302"
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">参与人（{form.participantIds.length}）</span>
            <div className="flex items-center gap-2 text-2xs">
              <button
                type="button"
                className="text-brand hover:underline"
                onClick={() => setForm((prev) => ({ ...prev, participantIds: activeMembers.map((member) => member.id) }))}
              >
                全选
              </button>
              <button
                type="button"
                className="text-muted hover:underline"
                onClick={() => setForm((prev) => ({ ...prev, participantIds: [] }))}
              >
                清空
              </button>
            </div>
          </div>
          <div className="scrollbar-thin flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-control border border-line bg-canvas p-2">
            {activeMembers.map((member) => {
              const selected = form.participantIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    selected ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink',
                  )}
                >
                  {member.name}
                </button>
              );
            })}
            {activeMembers.length === 0 ? <span className="px-1 py-1 text-xs text-subtle">还没有成员，先去「成员」里添加</span> : null}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">备注</span>
          <Textarea
            value={form.note}
            maxLength={500}
            placeholder="议程、需要带的东西…"
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        </label>
      </div>
    </Dialog>
  );
}
