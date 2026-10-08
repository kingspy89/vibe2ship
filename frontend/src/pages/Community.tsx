import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent } from '../components/ui/Card';
import { MessageSquare, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Community() {
  const [recentIssues, setRecentIssues] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('created_at', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      setRecentIssues(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Community Feed</h1>
        <p className="text-sm text-slate-400 mt-1">See what's happening around your neighborhood.</p>
      </div>

      <div className="space-y-4">
        {recentIssues.length === 0 ? (
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardContent className="p-10 text-center text-slate-500">
              No recent activity in your community.
            </CardContent>
          </Card>
        ) : (
          recentIssues.map((issue) => (
            <Card key={issue.id} className="bg-[#1C1D26] border-slate-800/50 hover:border-indigo-500/30 transition-colors cursor-pointer" onClick={() => navigate(`/issue/${issue.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <Activity className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-200">A citizen reported an issue</span>
                      <span className="text-xs text-slate-500 ml-auto">{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{issue.auto_description || issue.description || 'Issue reported without description.'}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded-full border ${issue.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : issue.status === 'Community Verified' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {issue.status}
                      </span>
                      <span className="text-slate-400 capitalize bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/50">{issue.category.replace('_', ' ')}</span>
                      
                      <div className="flex items-center text-slate-500 ml-auto">
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        <span>{issue.report_count || 1} {issue.report_count === 1 ? 'report' : 'reports'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
