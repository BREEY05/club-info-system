import {
  BarChart3,
  Building2,
  CalendarDays,
  Clock3,
  Code2,
  History,
  LayoutDashboard,
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
 * 导航：一个社团负责人日常会用到的全部入口。
 * 本机单人使用，没有角色差异，所有页面都可访问。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'work',
    title: '社团工作台',
    items: [
      { to: '/', label: '总览', description: '今天该做什么', icon: LayoutDashboard, end: true },
      { to: '/timetable', label: '课表', description: '成员课表与空档', icon: CalendarDays },
      { to: '/members', label: '成员', description: '社团成员档案', icon: Users },
      { to: '/free', label: '空闲时间', description: '找共同空闲', icon: Sparkles },
      { to: '/activities', label: '活动', description: '例会与活动排期', icon: Clock3 },
      { to: '/stats', label: '统计', description: '课表与运行情况', icon: BarChart3 },
    ],
  },
  {
    key: 'judge',
    title: '刷题训练',
    items: [
      { to: '/practice', label: '题库', description: '做题与判题', icon: Code2, end: true },
      { to: '/practice/history', label: '提交记录', description: '历史评测结果', icon: History },
    ],
  },
  {
    key: 'system',
    title: '系统',
    items: [
      { to: '/club', label: '社团', description: '社团档案', icon: Building2 },
      { to: '/slots', label: '时间段', description: '时间块与学期模板', icon: Clock3 },
      { to: '/settings', label: '设置', description: '学期与数据', icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** 本地模式没有角色差异，直接返回全部导航 */
export function visibleNavItems(_isAdmin = true): NavItem[] {
  return NAV_ITEMS;
}

export const BRAND_ICON = CalendarDays;
