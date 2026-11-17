import { useQuery } from '@tanstack/react-query';
import { Check, Copy, HardDrive } from 'lucide-react';
import { useState } from 'react';
import { fetchMetaInfo } from '../../../api/export';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';

/** 关于本程序：版本 + 数据文件在哪 + 备份提醒（不暴露接口、时区这类开发信息） */
export function RuntimeInfoPanel() {
  const query = useQuery({ queryKey: ['meta'], queryFn: fetchMetaInfo, staleTime: 300_000, retry: 1 });
  const [copied, setCopied] = useState(false);

  async function copyPath() {
    const path = query.data?.dataPath;
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <HardDrive className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-xs font-semibold text-ink">关于本程序</h2>
      </div>

      <div className="space-y-3 px-4 py-3">
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xs text-subtle">版本</span>
              <span className="tabular text-xs font-medium text-ink">{query.data?.version ?? '—'}</span>
            </div>
            <div>
              <div className="text-2xs text-subtle">数据文件</div>
              <div className="mt-1 flex items-start gap-1.5">
                <code
                  className="min-w-0 flex-1 break-all rounded-control bg-canvas px-2 py-1.5 text-2xs leading-4 text-muted"
                  title={query.data?.dataPath ?? undefined}
                >
                  {query.data?.dataPath ?? '读取失败'}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="复制数据文件路径"
                  onClick={() => void copyPath()}
                  iconLeft={
                    copied ? <Check className="h-3.5 w-3.5 text-mint" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />
                  }
                >
                  {copied ? '已复制' : '复制'}
                </Button>
              </div>
            </div>
            <p className="text-2xs leading-5 text-muted">
              所有数据都只存在这个文件里。定期把 <code className="rounded bg-canvas px-1 py-0.5 text-ink">data</code>{' '}
              文件夹复制到别处即完成备份；把整个程序文件夹拷到另一台电脑即可搬家。
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
