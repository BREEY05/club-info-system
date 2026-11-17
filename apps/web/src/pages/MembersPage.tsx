import type { AppUser, UserInput } from '@cims/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMemberStats, statsKeys } from '../api/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { MemberFormDialog, roleLabel } from '../components/pages/members/MemberFormDialog';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../hooks/useUsers';
import { getErrorMessage } from '../lib/errors';

const ROLE_TONE = {
  leader: 'brand',
  minister: 'amber',
  staff: 'mint',
  member: 'neutral',
} as const;

/** 成员管理：社团成员档案，不含任何登录/邀请概念。 */
export default function MembersPage() {
  const usersQuery = useUsers(true);
  const memberStatsQuery = useQuery({ queryKey: statsKeys.members, queryFn: fetchMemberStats, staleTime: 30_000 });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [keyword, setKeyword] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [removing, setRemoving] = useState<AppUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const members = usersQuery.data ?? [];
  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      [member.name, member.grade, member.major, member.phone, member.note]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [members, keyword]);

  const activeCount = members.filter((member) => member.isActive).length;
  const schedulesById = useMemo(
    () => new Map((memberStatsQuery.data ?? []).map((item) => [item.id, item.schedules])),
    [memberStatsQuery.data],
  );
  const missingCount = members.filter((member) => member.isActive && (schedulesById.get(member.id) ?? 0) === 0).length;

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(member: AppUser) {
    setEditing(member);
    setFormError(null);
    setFormOpen(true);
  }

  function submit(input: UserInput) {
    setFormError(null);
    const onError = (error: unknown) => setFormError(getErrorMessage(error));
    if (editing) {
      updateMutation.mutate({ id: editing.id, patch: input }, { onSuccess: () => setFormOpen(false), onError });
      return;
    }
    createMutation.mutate(input, { onSuccess: () => setFormOpen(false), onError });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="成员"
        title="社团成员"
        description={`在册 ${activeCount} 人${missingCount > 0 ? ` · ${missingCount} 人还没录课表` : ' · 课表已全部录入'}。课表和活动参与人都从这份名单里取。`}
        actions={
          <Button iconLeft={<UserPlus className="h-4 w-4" aria-hidden />} onClick={openCreate}>
            添加成员
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input className="pl-8" placeholder="搜索姓名、年级、专业、电话" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
      </div>

      {usersQuery.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-5 w-5" aria-hidden />}
          title={members.length === 0 ? '还没有成员' : '没有匹配的成员'}
          description={members.length === 0 ? '先把社团成员加进来，之后就能录课表、排活动。' : '换个关键词试试。'}
          action={
            members.length === 0 ? (
              <Button size="sm" onClick={openCreate}>
                添加第一个成员
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-2xs font-medium uppercase tracking-wide text-subtle">
                <th className="w-[24%] px-3 py-2">姓名</th>
                <th className="w-[13%] px-3 py-2">职务</th>
                <th className="w-[20%] px-3 py-2">年级 / 专业</th>
                <th className="w-[16%] px-3 py-2">联系电话</th>
                <th className="w-[12%] px-3 py-2">课表</th>
                <th className="w-[11%] px-3 py-2">入社</th>
                <th className="w-[7%] px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id} className="border-b border-line last:border-0 hover:bg-canvas/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold text-white" style={{ background: member.color }}>
                        {member.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm text-ink">{member.name}</div>
                        {member.note ? <div className="truncate text-2xs text-subtle">{member.note}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={ROLE_TONE[member.role]}>{roleLabel(member.role)}</Badge>
                    {!member.isActive ? <Badge tone="neutral" className="ml-1">已退社</Badge> : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {member.grade || '—'}
                    {member.major ? <span className="text-subtle"> · {member.major}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{member.phone || '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {!member.isActive ? (
                      <span className="text-subtle">—</span>
                    ) : (schedulesById.get(member.id) ?? 0) === 0 ? (
                      <Link to={`/timetable?member=${member.id}`} className="text-amber hover:underline">
                        未录入
                      </Link>
                    ) : (
                      <span className="tabular text-muted">{schedulesById.get(member.id)} 节</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{member.joinedAt || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        aria-label="编辑"
                        className="rounded-control p-1.5 text-muted hover:bg-canvas hover:text-ink"
                        onClick={() => openEdit(member)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label="删除"
                        className="rounded-control p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                        onClick={() => setRemoving(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <MemberFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        member={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        error={formError}
        onSubmit={submit}
      />

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="删除成员"
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
        <p className="text-sm text-muted">
          确定删除「{removing?.name}」吗？该成员的课表和活动参与记录会一起删除。如果只是退社，建议在编辑里取消「在册」。
        </p>
      </Dialog>
    </div>
  );
}
