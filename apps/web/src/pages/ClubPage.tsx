import { Building2, HardDrive, Save, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useClub, useUpdateClub } from '../hooks/useClub';
import { getErrorMessage } from '../lib/errors';

/** 社团档案：本机唯一的社团，负责人一个人维护。 */
export default function ClubPage() {
  const clubQuery = useClub();
  const updateMutation = useUpdateClub();
  const club = clubQuery.data;

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!club) return;
    setName(club.name);
    setOwnerName(club.ownerName);
    setContact(club.contact);
    setDescription(club.description);
  }, [club]);

  const dirty =
    club !== undefined &&
    (name !== club.name || ownerName !== club.ownerName || contact !== club.contact || description !== club.description);

  function save() {
    setError(null);
    updateMutation.mutate(
      { name: name.trim(), ownerName: ownerName.trim(), contact: contact.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setSaved(true);
          window.setTimeout(() => setSaved(false), 2000);
        },
        onError: (mutationError) => setError(getErrorMessage(mutationError)),
      },
    );
  }

  if (clubQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="社团"
        title="社团档案"
        description="这些信息只保存在本机，用于本系统内部展示，不会上传到任何服务器。"
        actions={
          <Button
            iconLeft={<Save className="h-4 w-4" aria-hidden />}
            onClick={save}
            loading={updateMutation.isPending}
            disabled={!dirty}
          >
            {saved ? '已保存' : '保存'}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Building2 className="h-4 w-4 text-brand" aria-hidden />
            基本信息
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {error ? <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-danger">{error}</p> : null}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">社团名称</span>
              <Input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">负责人</span>
                <Input value={ownerName} maxLength={30} placeholder="你的名字" onChange={(event) => setOwnerName(event.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted">联系方式</span>
                <Input value={contact} maxLength={60} placeholder="手机 / 微信 / QQ" onChange={(event) => setContact(event.target.value)} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">社团简介</span>
              <Textarea
                value={description}
                maxLength={500}
                placeholder="社团定位、主要活动、招新要求…"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="text-sm font-medium text-ink">概况</div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-muted">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  在册成员
                </span>
                <Badge tone="brand">{club?.memberCount ?? 0} 人</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" aria-hidden />
                  负责人
                </span>
                <span>{ownerName || '未填写'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>创建时间</span>
                <span>{club ? new Date(club.createdAt).toLocaleDateString('zh-CN') : '—'}</span>
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <Link to="/members" className="text-xs text-brand hover:underline">
                去管理成员 →
              </Link>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <HardDrive className="h-4 w-4 text-muted" aria-hidden />
              数据存放
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              成员、课表、活动、刷题记录全部在程序目录下的 <code className="rounded bg-canvas px-1 py-0.5 text-2xs">data/club.db</code> 里。
              备份就是复制这个文件；换电脑时连同 <code className="rounded bg-canvas px-1 py-0.5 text-2xs">problems/</code> 一起拷走即可。
            </p>
            <div className="mt-3">
              <Link to="/settings" className="text-xs text-brand hover:underline">
                备份与恢复 →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
