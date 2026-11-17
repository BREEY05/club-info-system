import type { DayPart, SlotInput, TimeSlot } from '@cims/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchTemplateDetail, replaceSlots, templateKeys } from '../api/templates';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useSemester } from '../hooks/useSemester';
import { getErrorMessage } from '../lib/errors';

const DAY_PARTS: { value: DayPart; label: string }[] = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

interface DraftRow {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  dayPart: DayPart;
  durationMin: number;
}

function toDraft(slot: TimeSlot, index: number): DraftRow {
  return {
    key: 's' + slot.id + '-' + index,
    label: slot.label,
    startTime: slot.startTime ?? '',
    endTime: slot.endTime ?? '',
    dayPart: slot.dayPart,
    durationMin: slot.durationMin,
  };
}

function guessDuration(start: string, end: string, fallback: number): number {
  if (!start || !end) return fallback;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : fallback;
}

/** 时间段：社团一周用哪几个时间块（课表、活动都按它对齐）。 */
export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const semesterQuery = useSemester();
  const semester = semesterQuery.data?.semester;
  const templateId = semester?.activeTemplateId ?? null;

  const detailQuery = useQuery({
    queryKey: templateKeys.detail(templateId ?? 0),
    queryFn: () => fetchTemplateDetail(templateId as number),
    enabled: templateId !== null,
  });

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!detailQuery.data) return;
    setRows(detailQuery.data.slots.map(toDraft));
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: SlotInput[]) => replaceSlots(templateId as number, payload),
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError)),
  });

  function patchRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          next.durationMin = guessDuration(next.startTime, next.endTime, next.durationMin);
        }
        return next;
      }),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: 's-new-' + Date.now(),
        label: `第 ${prev.length + 1} 段`,
        startTime: '',
        endTime: '',
        dayPart: 'afternoon',
        durationMin: 90,
      },
    ]);
  }

  function save() {
    setError(null);
    const payload: SlotInput[] = rows.map((row, index) => ({
      label: row.label.trim() || `第 ${index + 1} 段`,
      startTime: row.startTime || null,
      endTime: row.endTime || null,
      dayPart: row.dayPart,
      durationMin: guessDuration(row.startTime, row.endTime, row.durationMin),
      sortOrder: index + 1,
    }));
    saveMutation.mutate(payload);
  }

  if (semesterQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (templateId === null) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="时间段" title="时间块" />
        <EmptyState
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
          title="当前学期还没有时间表"
          description="先在「设置」里创建学期，系统会自动生成一套默认时间段，然后回到这里调整。"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="时间段"
        title="时间块"
        description="社团一周按这些时间块对齐：成员课表、空闲统计、活动时间都基于它们。"
        actions={
          <>
            <Button
              variant="secondary"
              iconLeft={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => void detailQuery.refetch()}
            >
              刷新
            </Button>
            <Button
              iconLeft={<Save className="h-4 w-4" aria-hidden />}
              onClick={save}
              loading={saveMutation.isPending}
              disabled={rows.length === 0}
            >
              {saved ? '已保存' : '保存'}
            </Button>
          </>
        }
      />

      {error ? <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-danger">{error}</p> : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Clock3 className="h-4 w-4 text-brand" aria-hidden />
            {detailQuery.data?.template.name ?? '时间表'}
            <Badge tone="outline">{rows.length} 个时间段</Badge>
          </div>
          <Button variant="ghost" size="sm" iconLeft={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={addRow}>
            添加时间段
          </Button>
        </div>

        {detailQuery.isPending ? (
          <div className="p-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState compact title="还没有时间段" description="点右上角「添加时间段」开始定义。" />
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="bg-canvas text-2xs text-subtle">
              <tr>
                <th className="w-[28%] px-3 py-2 text-left font-medium">名称</th>
                <th className="px-3 py-2 text-left font-medium">开始</th>
                <th className="px-3 py-2 text-left font-medium">结束</th>
                <th className="px-3 py-2 text-left font-medium">时段</th>
                <th className="px-3 py-2 text-left font-medium">时长</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  <td className="px-3 py-1.5">
                    <Input value={row.label} maxLength={20} onChange={(event) => patchRow(row.key, { label: event.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input type="time" value={row.startTime} onChange={(event) => patchRow(row.key, { startTime: event.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input type="time" value={row.endTime} onChange={(event) => patchRow(row.key, { endTime: event.target.value })} />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={row.dayPart} onChange={(event) => patchRow(row.key, { dayPart: event.target.value as DayPart })}>
                      {DAY_PARTS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="tabular text-xs text-muted">
                      {row.startTime && row.endTime ? `${row.durationMin} 分钟` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      aria-label="删除时间段"
                      className="rounded-control p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                      onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-line px-4 py-2 text-2xs text-subtle">
          时长按开始 / 结束时间自动计算。建议按社团实际作息设置，例如「午休 12:30–13:30」「晚上 19:00–21:00」；改完点右上角保存。
        </div>
      </Card>
    </div>
  );
}
