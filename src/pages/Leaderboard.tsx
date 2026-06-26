import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent } from '../components/ui/Card';
import { Trophy } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    // Basic implementation: fetch reports and group by user_id
    const unsubReports = onSnapshot(query(collection(db, 'reports')), (reportsSnap) => {
      const userPoints: Record<string, number> = {};
      reportsSnap.forEach(doc => {
        const data = doc.data();
        const uid = data.user_id;
        if (uid) {
          userPoints[uid] = (userPoints[uid] || 0) + 10;
        }
      });

      // Also get users to map displayNames
      const unsubUsers = onSnapshot(query(collection(db, 'users')), (usersSnap) => {
        const userMap: Record<string, any> = {};
        usersSnap.forEach(doc => {
          userMap[doc.id] = doc.data();
        });

        const leaderboardData = Object.keys(userPoints).map(uid => ({
          id: uid,
          name: userMap[uid]?.displayName || userMap[uid]?.email?.split('@')[0] || (uid === 'anonymous' ? 'Anonymous Citizen' : 'Civic Hero'),
          points: userPoints[uid],
        })).sort((a, b) => b.points - a.points);
        
        setUsers(leaderboardData);
      });
      return () => unsubUsers();
    });

    return () => unsubReports();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Community Leaderboard</h1>
        <p className="text-sm text-slate-400 mt-1">Top Civic Heroes making a difference</p>
      </div>
      
      <Card className="bg-[#1C1D26] border-slate-800/50">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No data available. Be the first to report an issue!</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {users.map((u, index) => (
                <div key={u.id} className={`flex items-center p-4 transition-colors ${u.id === user?.uid ? 'bg-indigo-500/10' : 'hover:bg-slate-800/30'}`}>
                  <div className="w-12 text-center font-bold text-slate-400">
                    {index === 0 ? <Trophy className="h-6 w-6 text-amber-400 mx-auto" /> : `#${index + 1}`}
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-700 overflow-hidden mx-4">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} alt="avatar" />
                  </div>
                  <div className="flex-grow">
                    <div className="font-semibold text-slate-200">
                      {u.name} {u.id === user?.uid && <span className="text-[10px] text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded-full ml-2">You</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-indigo-400">{u.points.toLocaleString()} pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
