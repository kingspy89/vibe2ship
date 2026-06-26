import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc } from 'firebase/firestore';
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
    } catch (e) {
      console.error(e);
      alert("Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Authority Triage Queue</h1>
        <p className="text-sm text-slate-500">Sorted by AI Priority Score</p>
      </div>

      <div className="flex flex-col gap-4">
        {issues.map((issue) => (
          <Card key={issue.issue_id} className="overflow-hidden transition-all hover:shadow-md">
            <div className="flex flex-col md:flex-row">
              {/* Left sidebar priority indicator */}
              <div className={`w-2 ${issue.severity_score >= 4 ? 'bg-red-500' : issue.severity_score === 3 ? 'bg-amber-500' : 'bg-blue-500'}`} />
              
              <CardContent className="flex-1 p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Core Info */}
                <div className="md:col-span-5 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 shadow-none border-none">
                      {issue.category.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={issue.status === 'Resolved' ? 'text-emerald-600 border-emerald-200' : ''}>
                      {issue.status}
                    </Badge>
                  </div>
                  <Link to={`/issue/${issue.issue_id}`} className="hover:underline">
                    <h3 className="text-lg font-semibold text-slate-900">{issue.auto_title}</h3>
                  </Link>
                  <p className="text-sm text-slate-600 line-clamp-2">{issue.auto_description}</p>
                </div>

                {/* AI Triage Data */}
                <div className="md:col-span-4 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">Severity:</span>
                    <span className="font-bold">{issue.severity_score}/5</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">Reports Merged:</span>
                    <span className="font-bold">{issue.report_count}</span>
                  </div>
                  <p className="text-xs text-slate-500 italic border-t border-slate-200 pt-2 mt-2">
                    "{issue.severity_justification}"
                  </p>
                </div>

                {/* Actions */}
                <div className="md:col-span-3 flex flex-col justify-center space-y-2">
                  {issue.status !== 'Acknowledged' && issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'Acknowledged')} size="sm" variant="outline" className="w-full">
                      Acknowledge
                    </Button>
                  )}
                  {issue.status !== 'In Progress' && issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'In Progress')} size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                      Mark In Progress
                    </Button>
                  )}
                  {issue.status !== 'Resolved' && (
                    <Button onClick={() => handleStatusUpdate(issue.issue_id, 'Resolved')} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      Resolve Issue
                    </Button>
                  )}
                </div>

              </CardContent>
            </div>
          </Card>
        ))}
        {issues.length === 0 && (
          <div className="text-center p-12 text-slate-500 border border-dashed rounded-lg">
            No issues reported yet.
          </div>
        )}
      </div>
    </div>
  );
}
