import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthProvider';
import { Issue } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';

export function MyIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, 'issues'), where('user_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        issue_id: doc.id,
        ...doc.data()
      })) as Issue[];
      setIssues(issuesData.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">My Reported Issues</h1>
        <p className="text-sm text-slate-400 mt-1">Track the status of the issues you have reported.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[#1C1D26] border-slate-800/50">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="h-6 w-20 bg-slate-800 rounded-full animate-pulse"></div>
                  <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                </div>
                <div className="h-5 w-3/4 bg-slate-800 rounded animate-pulse mb-2"></div>
                <div className="h-5 w-1/2 bg-slate-800 rounded animate-pulse mb-4"></div>
                <div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse mb-4"></div>
                <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center">
                  <div className="h-4 w-20 bg-slate-800 rounded animate-pulse"></div>
                  <div className="h-4 w-16 bg-slate-800 rounded animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardContent className="p-8 text-center text-slate-400">
            You have not reported any issues yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {issues.map(issue => (
            <Card key={issue.issue_id} className="bg-[#1C1D26] border-slate-800/50 hover:border-indigo-500/30 transition-colors cursor-pointer" onClick={() => navigate(`/issue/${issue.issue_id}`)}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${issue.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : issue.status === 'Community Verified' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    {issue.status}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(issue.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <h3 className="text-sm font-semibold text-slate-200 mb-2 line-clamp-2" title={issue.auto_title}>{issue.auto_title || issue.auto_description}</h3>
                
                <div className="flex items-center text-xs text-slate-400 mb-4">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  <span className="truncate">{issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}</span>
                </div>
                
                <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center text-xs">
                  <span className="text-slate-500 capitalize">{issue.category.replace('_', ' ')}</span>
                  <span className="text-indigo-400 font-medium">Severity: {issue.severity_score}/5</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
