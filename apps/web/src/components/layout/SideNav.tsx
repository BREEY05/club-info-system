import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { BRAND_ICON, NAV_GROUPS } from './navItems';

const BrandIcon = BRAND_ICON;

/** 左侧主导航：排课表为主，刷题为辅 */
export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white">
          <BrandIcon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold tracking-tight text-ink">社团信息化管理系统</span>
          <span className="text-2xs text-subtle">排课表 · 刷题</span>
        </span>
      </div>

      <nav aria-label="主导航" className="scrollbar-thin flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-subtle">{group.title}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-2.5 rounded-control px-3 text-sm transition-colors duration-150',
                    isActive ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-canvas hover:text-ink',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <p className="text-2xs leading-4 text-subtle">纯本地运行 · 数据存放在 data/club.db</p>
      </div>
    </aside>
  );
}
