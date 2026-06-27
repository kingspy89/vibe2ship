import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, getDocs, where, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export function Admin() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        issue_id: doc.id,
        ...doc.data()
      })) as Issue[];
      
      // Sort by priority_score descending
      setIssues(issuesData.sort((a, b) => b.priority_score - a.priority_score));
    });
    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'issues', id), {
        status: newStatus,
        updated_at: Date.now()
      });
      
      const issueObj = issues.find(i => i.issue_id === id);
      const issueTitle = issueObj ? issueObj.auto_title : 'Issue';

      const userIds = new Set<string>();

      const reportsQuery = query(collection(db, 'reports'), where('issue_id', '==', id));
      const reportsSnap = await getDocs(reportsQuery);
      reportsSnap.forEach(doc => userIds.add(doc.data().user_id));

      const verificationsQuery = query(collection(db, 'verifications'), where('issue_id', '==', id));
      const verificationsSnap = await getDocs(verificationsQuery);
      verificationsSnap.forEach(doc => userIds.add(doc.data().user_id));

      for (const userId of Array.from(userIds)) {
        if (!userId) continue;
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.email) {
            await addDoc(collection(db, 'mail'), {
              to: userData.email,
              message: {
                subject: `Status Update: ${issueTitle}`,
                text: `The status of an issue you reported or verified (${issueTitle}) has changed to: ${newStatus}.`,
                html: `<p>The status of an issue you reported or verified (<strong>${issueTitle}</strong>) has changed to: <strong>${newStatus}</strong>.</p>`
              }
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Authority Triage Queue</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and resolve reported community issues</p>
        </div>
        <p className="text-xs text-indigo-400 font-semibold px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">Sorted by AI Priority Score</p>
      </div>

      <div className="flex flex-col gap-4">
        {issues.map((issue) => (
          <Card key={issue.issue_id} className="bg-[#1C1D26] border-slate-800/50 overflow-hidden transition-all hover:border-slate-700/50 shadow-xl">
            <div className="flex flex-col md:flex-row">
              {/* Left sidebar priority indicator */}
              <div className={`w-2 shrink-0 ${issue.severity_score >= 4 ? 'bg-red-500' : issue.severity_score === 3 ? 'bg-amber-500' : 'bg-blue-500'}`} />
              
              <CardContent className="flex-1 p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Core Info */}
                <div className="md:col-span-5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/30 uppercase text-[10px] font-bold">
                      {issue.category.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-bold ${issue.status === 'Resolved' ? 'text-emerald-400 border-emerald-950/60 bg-emerald-950/20' : 'text-slate-400 border-slate-800'}`}>
                      {issue.status}
                    </Badge>
                  </div>
                  <Link to={`/issue/${issue.issue_id}`} className="block group">
                    <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">{issue.auto_title}</h3>
                  </Link>
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">{issue.auto_description}</p>
                </div>

                {/* AI Triage Data */}
                <div className="md:col-span-4 space-y-2 bg-[#12131A] p-4 rounded-lg border border-slate-800/60">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Severity:</span>
                    <span className="font-bold text-red-400">{issue.severity_score}/5</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-400">Reports Merged:</span>
                    <span className="font-bold text-white">{issue.report_count}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic border-t border-slate-800/60 pt-2 mt-2 leading-normal">
                    "{issue.severity_justification}"
                  </p>
                </div>

                {/* Actions */}
                <div className="md:col-span-3 flex flex-col justify-center space-y-2">
                  {issue.status !== 'Acknowledged' && issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'Acknowledged')} size="sm" variant="outline" className="w-full border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white">
                      Acknowledge
                    </Button>
                  )}
                  {issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'In Progress')} size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                      Mark In Progress
                    </Button>
                  )}
                  {issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'Resolved')} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                      Resolve Issue
                    </Button>
                  )}
                </div>

              </CardContent>
            </div>
          </Card>
        ))}
        {issues.length === 0 && (
          <div className="text-center p-12 text-slate-500 border border-slate-800 border-dashed rounded-lg bg-[#1C1D26]/50">
            No issues reported yet.
          </div>
        )}
      </div>
    </div>
  );
}
