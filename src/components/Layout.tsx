import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, PlusCircle, Map as MapIcon, List, 
  ListTodo, Trophy, BarChart2, LineChart, Users, 
  Bell, Settings, ShieldAlert, Star, LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from './AuthProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { VoiceAssistant } from './VoiceAssistant';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  
  const [points, setPoints] = useState(0);
  const [reportsCount, setReportsCount] = useState(0);
  const [verificationsCount, setVerificationsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    const qReports = query(collection(db, 'reports'), where('user_id', '==', user.uid));
    const unsubReports = onSnapshot(qReports, (snap) => {
      setReportsCount(snap.docs.length);
    });

    const qVerifications = query(collection(db, 'verifications'), where('user_id', '==', user.uid));
    const unsubVerifications = onSnapshot(qVerifications, (snap) => {
      setVerificationsCount(snap.docs.length);
    });
    
    return () => {
      unsubReports();
      unsubVerifications();
    };
  }, [user]);

  useEffect(() => {
    setPoints((reportsCount * 10) + (verificationsCount * 5));
  }, [reportsCount, verificationsCount]);

  const level = Math.floor(points / 100) + 1;
  const currentLevelPoints = points % 100;
  const progressPercent = (currentLevelPoints / 100) * 100;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Report an Issue', path: '/report', icon: PlusCircle },
    { name: 'Map View', path: '/map', icon: MapIcon },
    { name: 'My Issues', path: '/my-issues', icon: List },
    ...(isAdmin ? [{ name: 'Priority Queue', path: '/admin', icon: ListTodo }] : []),
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Impact Dashboard', path: '/impact', icon: BarChart2 },
    { name: 'Analytics', path: '/analytics', icon: LineChart },
    { name: 'Community', path: '/community', icon: Users },
    { name: 'Notifications', path: '/notifications', icon: Bell, badge: 3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#12131A] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#12131A] border-r border-slate-800 flex flex-col h-full overflow-y-auto custom-scrollbar">
        <div className="p-6">
          <Link to="/" className="flex items-center space-x-3 mb-6">
            <div className="bg-indigo-600/20 p-2 rounded-lg">
              <ShieldAlert className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block">CivicPulse AI</span>
              <span className="text-xs text-slate-400">Community Hero</span>
            </div>
          </Link>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Don't just report the <br/>pothole — <span className="text-indigo-400 cursor-pointer hover:underline">close it.</span>
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.path 
                  ? "bg-[#2A2B36] text-white" 
                  : "text-slate-400 hover:text-white hover:bg-[#1C1D26]"
              )}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          {/* Impact Card */}
          <div className="bg-[#1C1D26] rounded-xl p-4 mb-4 border border-slate-800/50">
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-10 w-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Star className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Your Impact</div>
                <div className="text-sm font-bold text-white">Level {level}</div>
              </div>
            </div>
            <div className="flex justify-between text-center text-xs mb-3">
              <div>
                <div className="text-white font-bold text-sm">{reportsCount}</div>
                <div className="text-slate-500">Reports</div>
              </div>
              <div>
                <div className="text-white font-bold text-sm">{verificationsCount}</div>
                <div className="text-slate-500">Verifications</div>
              </div>
              <div>
                <div className="text-indigo-400 font-bold text-sm">{points.toLocaleString()}</div>
                <div className="text-slate-500">Points</div>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{points} / {level * 100} XP</span>
              <span className="flex items-center text-amber-400"><Star className="h-3 w-3 mr-1"/> Next Badge: {level >= 5 ? 'Civic Hero' : 'Active Citizen'}</span>
            </div>
          </div>

          {/* User Profile */}
          {user && (
            <div className="flex items-center space-x-3 px-2 mt-4 justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-slate-700 overflow-hidden">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="Avatar" />
                </div>
                <div className="overflow-hidden">
                  <div className="text-sm font-bold text-white truncate max-w-[120px]">{user.displayName || user.email?.split('@')[0]}</div>
                  <div className="text-xs text-slate-400 uppercase">{isAdmin ? "Admin" : "Citizen Hero"}</div>
                </div>
              </div>
              <button onClick={logout} className="text-slate-500 hover:text-white p-2">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>
      </main>
      
      <VoiceAssistant />
    </div>
  );
}
