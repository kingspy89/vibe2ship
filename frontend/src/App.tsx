import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#12131A] text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <span className="text-sm font-medium">Initializing CivicPulse...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#12131A] text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <span className="text-sm font-medium">Verifying Credentials...</span>
        </div>
      </div>
    );
  }
  if (!user || !isAdmin) return <div className="flex h-screen w-full items-center justify-center bg-[#12131A] text-red-400 font-medium">Access Denied: Admins Only</div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/map" element={<MapView />} />
                  <Route path="/issue/:id" element={<IssueDetail />} />
                  <Route path="/my-issues" element={<MyIssues />} />
                  <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                  <Route path="/impact" element={<Impact />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            </RequireAuth>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
