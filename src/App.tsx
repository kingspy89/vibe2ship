import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Report } from './pages/Report';
import { MapView } from './pages/MapView';
import { IssueDetail } from './pages/IssueDetail';
import { Admin } from './pages/Admin';
import { Impact } from './pages/Impact';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './components/AuthProvider';

import { Leaderboard } from './pages/Leaderboard';
import { Settings } from './pages/Settings';
import { MyIssues } from './pages/MyIssues';
import { Notifications } from './pages/Notifications';
import { Analytics } from './pages/Analytics';
import { Community } from './pages/Community';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!user) return <Login />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!user || !isAdmin) return <div className="p-8 text-center text-red-500">Access Denied: Admins Only</div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
            <Route path="/report" element={<RequireAuth><Report /></RequireAuth>} />
            <Route path="/map" element={<RequireAuth><MapView /></RequireAuth>} />
            <Route path="/issue/:id" element={<RequireAuth><IssueDetail /></RequireAuth>} />
            <Route path="/my-issues" element={<RequireAuth><MyIssues /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/impact" element={<RequireAuth><Impact /></RequireAuth>} />
            <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
            <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
            <Route path="/community" element={<RequireAuth><Community /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
