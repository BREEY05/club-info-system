import { Navigate, Route, Routes } from 'react-router-dom';
import { LocalSession } from './auth/LocalSession';
import { AppShell } from './components/layout/AppShell';
import ActivitiesPage from './pages/ActivitiesPage';
import ClubPage from './pages/ClubPage';
import DashboardPage from './pages/DashboardPage';
import FreeTimePage from './pages/FreeTimePage';
import MembersPage from './pages/MembersPage';
import PracticePage from './pages/PracticePage';
import ProblemPage from './pages/ProblemPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import SubmissionHistoryPage from './pages/SubmissionHistoryPage';
import TemplatesPage from './pages/TemplatesPage';
import TimetablePage from './pages/TimetablePage';

/** 路由表：社团工作台（课表/成员/活动/空闲/统计）+ 刷题训练 + 系统设置。 */
export default function App() {
  return (
    <LocalSession>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/free" element={<FreeTimePage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/club" element={<ClubPage />} />
          <Route path="/slots" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/history" element={<SubmissionHistoryPage />} />
          <Route path="/practice/:problemId" element={<ProblemPage />} />
          {/* 旧链接兜底 */}
          <Route path="/users" element={<Navigate to="/members" replace />} />
          <Route path="/org" element={<Navigate to="/club" replace />} />
          <Route path="/recommend" element={<Navigate to="/free" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LocalSession>
  );
}
