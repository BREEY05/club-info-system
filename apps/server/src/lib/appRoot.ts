import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | null = null;

/**
 * 程序根目录。
 *
 * - 绿色版：`app/server.mjs` 旁边有 `portable.json` 标记 → 根目录是 `app` 的上一级，
 *   这样 `data/`、`problems/`、`runtime/` 都跟着程序走，与当前工作目录无关。
 * - 源码运行：`apps/server/src/lib/appRoot.ts` → 往上四级是 monorepo 根。
 * - `CIMS_HOME` 环境变量可以强制指定（便于把数据放到别处）。
 */
export function appRoot(): string {
  if (cached) return cached;
  const override = process.env.CIMS_HOME?.trim();
  if (override) {
    cached = resolve(override);
    return cached;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  if (existsSync(resolve(here, 'portable.json'))) {
    cached = resolve(here, '..');
    return cached;
  }
  cached = resolve(here, '../../../../');
  return cached;
}
