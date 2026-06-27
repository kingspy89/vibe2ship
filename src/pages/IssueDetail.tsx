import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Report } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ThumbsUp, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export function IssueDetail() {
  const { id } = useParams<{id: string}>();
  const { user } = useAuth();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    if (!id) return;
    
    // Subscribe to issue
    const unsubIssue = onSnapshot(doc(db, 'issues', id), (doc) => {
      if (doc.exists()) {
        setIssue({ issue_id: doc.id, ...doc.data() } as Issue);
      }
    });

    // Subscribe to reports
    const q = query(collection(db, 'reports'), where('issue_id', '==', id));
    const unsubReports = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(d => ({ report_id: d.id, ...d.data() })) as Report[];
      setReports(reportsData.sort((a, b) => b.created_at - a.created_at));
    });

    return () => {
      unsubIssue();
      unsubReports();
    };
  }, [id]);

  const handleVerify = async (type: 'confirm' | 'already_fixed' | 'not_accurate') => {
    if (!id || !issue) return;
    try {
      // Add verification
      await addDoc(collection(db, 'verifications'), {
        issue_id: id,
        user_id: user?.uid || 'anonymous',
        type,
        created_at: Date.now()
      });

      if (type === 'already_fixed' && issue.status !== 'Resolved') {
        await updateDoc(doc(db, 'issues', id), {
          status: 'Resolved',
          updated_at: Date.now()
        });
      } else if (type === 'confirm' && (issue.status === 'Reported' || issue.status === 'Resolved')) {
        await updateDoc(doc(db, 'issues', id), {
          status: 'Community Verified',
          updated_at: Date.now()
        });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to verify.");
    }
  };

  if (!issue) return <div className="p-12 text-center text-slate-500 animate-pulse">Loading issue details...</div>;

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Left Column: Photos & Details */}
      <div className="md:col-span-2 space-y-6">
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl text-white font-bold">{issue.auto_title}</CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="outline" className="capitalize border-slate-700 text-slate-300">{issue.category.replace('_', ' ')}</Badge>
                  <span className="text-sm text-slate-500 font-normal">
                    Reported {formatDistanceToNow(issue.created_at)} ago
                  </span>
                </div>
              </div>
              <Badge className={`text-sm ${issue.status === 'Resolved' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>
                {issue.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-slate-300 leading-relaxed text-sm">{issue.auto_description}</p>
            
            {/* Gallery */}
            <div className="grid grid-cols-2 gap-4">
              {reports.map((report) => (
                <div key={report.report_id} className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                  <img src={report.photo_url || "https://placehold.co/600x400?text=No+Photo"} alt="Report" className="w-full h-full object-cover" />
                  {report.raw_caption && (
                    <div className="absolute bottom-0 w-full bg-black/60 p-2 text-xs text-white backdrop-blur-sm">
                      "{report.raw_caption}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Verification Actions */}
        <Card className="bg-indigo-950/20 border-indigo-900/40">
          <CardHeader>
            <CardTitle className="text-lg text-indigo-300">Community Verification</CardTitle>
          </CardHeader>
          <CardContent>
            {issue.status !== 'Resolved' ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleVerify('confirm')} className="bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
                  <ThumbsUp className="h-4 w-4 mr-2" /> Confirm it's still there
                </Button>
                <Button onClick={() => handleVerify('already_fixed')} variant="outline" className="text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/30 hover:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Already Fixed
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 items-center">
                <p className="text-sm text-slate-400 w-full mb-2">This issue is marked as resolved. Is it still a problem?</p>
                <Button onClick={() => handleVerify('confirm')} variant="outline" className="text-red-400 border-red-900/60 hover:bg-red-950/30 hover:text-red-300">
                  <AlertTriangle className="h-4 w-4 mr-2" /> Actually, it's still there
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: AI Insights & Status */}
      <div className="space-y-6">
        <Card className="border-l-4 border-l-red-500 bg-[#1C1D26] border-slate-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-red-400 text-lg">
              <AlertTriangle className="h-5 w-5 mr-2" /> 
              Severity {issue.severity_score}/5
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 font-medium">AI Justification:</p>
            <p className="text-sm text-slate-300 mt-1">{issue.severity_justification}</p>
            <div className="mt-4 pt-4 border-t border-slate-800/50">
              <div className="text-3xl font-bold text-white">{issue.report_count}</div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Duplicate Reports Merged</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center text-slate-200">
              <ShieldCheck className="h-5 w-5 mr-2 text-indigo-400" />
              Resolution Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['Reported', 'Community Verified', 'Acknowledged', 'In Progress', 'Resolved'].map((step, i) => {
                const statusOrder = ['Reported', 'Community Verified', 'Acknowledged', 'In Progress', 'Resolved'];
                const currentIndex = statusOrder.indexOf(issue.status);
                const isPast = i <= currentIndex;
                const isCurrent = i === currentIndex;
                
                return (
                  <div key={step} className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isPast ? 'bg-indigo-500' : 'bg-slate-800'}`} />
                    <span className={`text-sm ${isCurrent ? 'font-bold text-indigo-400' : isPast ? 'text-slate-300' : 'text-slate-500'}`}>
                      {step}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
