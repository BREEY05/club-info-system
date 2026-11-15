import type { AppUser, MemberRole, UserInput } from '@cims/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input, Select, Textarea } from '../../ui/Input';

export const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'leader', label: '负责人' },
  { value: 'minister', label: '部长' },
  { value: 'staff', label: '干事' },
  { value: 'member', label: '社员' },
];

export function roleLabel(role: MemberRole | undefined): string {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? '社员';
}

export interface MemberFormDialogProps {
  open: boolean;
  onClose: () => void;
  member?: AppUser | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (input: UserInput) => void;
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function MemberFormDialog({ open, onClose, member, submitting, error, onSubmit }: MemberFormDialogProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [grade, setGrade] = useState('');
  const [major, setMajor] = useState('');
  const [phone, setPhone] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? '');
    setRole(member?.role ?? 'member');
    setGrade(member?.grade ?? '');
    setMajor(member?.major ?? '');
    setPhone(member?.phone ?? '');
    setJoinedAt(member?.joinedAt || today());
    setNote(member?.note ?? '');
    setIsActive(member?.isActive ?? true);
  }, [open, member]);

  function submit() {
    onSubmit({
      name: name.trim(),
      role,
      grade: grade.trim(),
      major: major.trim(),
      phone: phone.trim(),
      joinedAt,
      note: note.trim(),
      isActive,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={member ? '编辑成员' : '添加成员'}
      description="成员信息只存在本机，用于排课表和安排活动时知道是谁。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} loading={submitting} disabled={name.trim().length === 0}>
            {member ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <p className="rounded-control bg-red-50 px-3 py-2 text-xs text-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">姓名</span>
            <Input autoFocus value={name} maxLength={50} placeholder="张三" onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">职务</span>
            <Select value={role} onChange={(event) => setRole(event.target.value as MemberRole)}>
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">年级</span>
            <Input value={grade} maxLength={20} placeholder="2024 级" onChange={(event) => setGrade(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">专业 / 班级</span>
            <Input value={major} maxLength={40} placeholder="计算机科学与技术 2 班" onChange={(event) => setMajor(event.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">联系电话</span>
            <Input value={phone} maxLength={20} placeholder="13800138000" onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">入社时间</span>
            <Input type="date" value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">备注</span>
          <Textarea value={note} maxLength={200} placeholder="擅长的方向、负责的事务…" onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-brand" />
          在册（取消勾选表示已退社，历史课表保留）
        </label>
      </div>
    </Dialog>
  );
}
