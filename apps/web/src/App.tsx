import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LocalSession } from './auth/LocalSession';
import DashboardPage from './pages/DashboardPage';
import OrgPage from './pages/OrgPage';
import PracticePage from './pages/PracticePage';
import ProblemPage from './pages/ProblemPage';
import RecommendPage from './pages/RecommendPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';
import SubmissionHistoryPage from './pages/SubmissionHistoryPage';
import TemplatesPage from './pages/TemplatesPage';
import UsersPage from './pages/UsersPage';

/** 路由表：/ 为排课表总览，/practice 为刷题判题，未知路径回总览。 */
export default function App() {
  return (
    <LocalSession>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/slots" element={<TemplatesPage />} />
          <Route path="/templates" element={<Navigate to="/slots" replace />} />
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/org" element={<OrgPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/history" element={<SubmissionHistoryPage />} />
          <Route path="/practice/:problemId" element={<ProblemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LocalSession>
  );
}
