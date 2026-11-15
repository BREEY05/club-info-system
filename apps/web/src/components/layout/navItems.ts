import {
  BarChart3,
  Building2,
  CalendarDays,
  Clock3,
  Code2,
  History,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
}

/**
 * 导航分组：主功能排课表（FreeShift 体系），附功能刷题判题（BlueBridge 体系）。
 * 本地单用户运行，所有页面都可访问，没有角色过滤。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'schedule',
    title: '排课表',
    items: [
      { to: '/', label: '排课表', description: '我的课程安排', icon: LayoutGrid, end: true },
      { to: '/users', label: '成员', description: '成员资料与个人表', icon: Users },
      { to: '/slots', label: '时间段', description: '模板与我的表', icon: Clock3 },
      { to: '/recommend', label: '推荐', description: '共同空闲与加权', icon: Sparkles },
      { to: '/stats', label: '统计', description: '公平性与负载', icon: BarChart3 },
      { to: '/org', label: '社团', description: '组织信息与成员', icon: Building2 },
      { to: '/settings', label: '设置', description: '学期与数据', icon: Settings },
    ],
  },
  {
    key: 'judge',
    title: '刷题',
    items: [
      { to: '/practice', label: '题库', description: '做题与判题', icon: Code2, end: true },
      { to: '/practice/history', label: '提交记录', description: '历史评测结果', icon: History },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** 本地模式没有角色差异，直接返回全部导航 */
export function visibleNavItems(_isAdmin = true): NavItem[] {
  return NAV_ITEMS;
}

export const BRAND_ICON = CalendarDays;
