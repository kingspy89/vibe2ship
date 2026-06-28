import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, getDocs, where, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Wrench, CheckCircle2, Truck, FileText, Sparkles, Clock, MapPin } from 'lucide-react';

const getSolutionBlueprint = (category: string) => {
  switch (category) {
    case 'pothole':
      return [
        { label: "Dispatch repair crew with asphalt cold-mix compound", detail: "Requires pothole filling rig and safety traffic cones." },
        { label: "Clear loose asphalt debris and seal the cavity", detail: "Compact patch material and apply binding sealant." },
        { label: "Verify surface level flatness and capture post-fix photo", detail: "Ensure no height disparity that can damage tires." }
      ];
    case 'garbage':
      return [
        { label: "Schedule waste collection vehicle for bulk pick-up", detail: "Specify standard loader or hazardous waste containment if needed." },
        { label: "Clean and sanitize the accumulation site", detail: "Apply eco-friendly odor neutralizer and wash down concrete." },
        { label: "Erect illegal dumping notice or surveillance alert sign", detail: "Prevent immediate re-accumulation at the ward node." }
      ];
    case 'streetlight':
      return [
        { label: "Verify light pole junction board electrical connections", detail: "Test for line grounding, short circuits or wiring corrosion." },
        { label: "Replace light fixture lamp bulb or LED photodiode cell", detail: "Install energy-efficient municipal standard luminaries." },
        { label: "Sync timer/photocell settings with dusk-to-dawn standard", detail: "Confirm automatic triggering is operational." }
      ];
    case 'water_leakage':
      return [
        { label: "Locate and shut off the nearest distribution isolation valve", detail: "Limit clean water loss and flooding pressure on surrounding roads." },
        { label: "Excavate the pipeline node and replace corroded joints", detail: "Apply reinforced sleeve clamps and wrap with pipe sealant." },
        { label: "Pressurize system and test for seal integrity", detail: "Verify zero dampness under 1.5x operating pressure." }
      ];
    default:
      return [
        { label: "Dispatch field crew to survey the reported node location", detail: "Record initial photos and assess tools required." },
        { label: "Perform specialized site repair and clearance", detail: "Coordinate with corresponding municipal utility branch." },
        { label: "Submit resolution log and update citizen notification loop", detail: "Publish progress update to the public feed." }
      ];
  }
};

export function Admin() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean[]>>({});
  const [notesText, setNotesText] = useState('');

  const selectedIssue = issues.find(i => i.issue_id === selectedIssueId);

  useEffect(() => {
    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({
        issue_id: doc.id,
        ...doc.data()
      })) as Issue[];
      
      // Sort by priority_score descending
      const sorted = issuesData.sort((a, b) => b.priority_score - a.priority_score);
      setIssues(sorted);

      // Auto-select first issue if none is selected
      if (sorted.length > 0 && !selectedIssueId) {
        setSelectedIssueId(sorted[0].issue_id);
      }
    });
    return () => unsubscribe();
  }, [selectedIssueId]);

  // Sync notes text and initialize steps when selected issue changes
  useEffect(() => {
    if (selectedIssue) {
      setNotesText(selectedIssue.resolution_notes || '');
    } else {
      setNotesText('');
    }
  }, [selectedIssueId]);

  const handleStepToggle = (issueId: string, stepIndex: number) => {
    setCompletedSteps(prev => {
      const steps = prev[issueId] ? [...prev[issueId]] : [false, false, false];
      steps[stepIndex] = !steps[stepIndex];
      return { ...prev, [issueId]: steps };
    });
  };

  const getStepsForIssue = (issueId: string) => {
    return completedSteps[issueId] || [false, false, false];
  };

  const handleStatusUpdate = async (id: string, newStatus: string, notes?: string) => {
    try {
      await updateDoc(doc(db, 'issues', id), {
        status: newStatus,
        resolution_notes: notes || '',
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
        if (!userId || userId === 'anonymous') continue;

        // Create in-app notification
        await addDoc(collection(db, 'notifications'), {
          user_id: userId,
          title: `Status Update: ${issueTitle}`,
          message: `The status of the issue has changed to: '${newStatus}'.${notes ? ` Notes: ${notes}` : ''}`,
          issue_id: id,
          read: false,
          created_at: Date.now()
        });

        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.email) {
            await addDoc(collection(db, 'mail'), {
              to: userData.email,
              message: {
                subject: `Status Update: ${issueTitle}`,
                text: `The status of an issue you reported or verified (${issueTitle}) has changed to: ${newStatus}.${notes ? `\n\nOfficial resolution details:\n${notes}` : ''}`,
                html: `<p>The status of an issue you reported or verified (<strong>${issueTitle}</strong>) has changed to: <strong>${newStatus}</strong>.</p>${notes ? `<p><strong>Official resolution details:</strong><br/>${notes.replace(/\n/g, '<br/>')}</p>` : ''}`
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Wrench className="h-6 w-6 text-indigo-400" />
            Authority Triage & Solution Workbench
          </h1>
          <p className="text-sm text-slate-400 mt-1">Select and resolve community issues with targeted action plans</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 font-semibold text-xs">
            Sorted by AI Priority
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 font-semibold text-xs">
            Auto-Deduplicated
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Priority Queue (col-span-5) */}
        <div className="lg:col-span-5 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Priority Queue ({issues.length})</div>
          {issues.map((issue) => {
            const isSelected = issue.issue_id === selectedIssueId;
            const steps = getStepsForIssue(issue.issue_id);
            const doneCount = steps.filter(Boolean).length;
            
            return (
              <div 
                key={issue.issue_id} 
                onClick={() => setSelectedIssueId(issue.issue_id)}
                className={`cursor-pointer rounded-xl border transition-all duration-200 overflow-hidden shadow-md flex ${
                  isSelected 
                    ? 'bg-indigo-950/10 border-indigo-500/60 ring-1 ring-indigo-500/40 shadow-indigo-950/40' 
                    : 'bg-[#1C1D26] border-slate-800/60 hover:border-slate-700/60 hover:bg-[#22232D]'
                }`}
              >
                {/* Priority Score color bar */}
                <div className={`w-1.5 shrink-0 ${
                  issue.severity_score >= 4 ? 'bg-red-500' : issue.severity_score === 3 ? 'bg-amber-500' : 'bg-blue-500'
                }`} />

                <div className="p-4 flex-1 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <Badge className="bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:bg-slate-800 uppercase text-[9px] font-bold">
                      {issue.category.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className={`text-[9px] font-bold ${
                      issue.status === 'Resolved' ? 'text-emerald-400 border-emerald-950/60 bg-emerald-950/20' : 
                      issue.status === 'In Progress' ? 'text-amber-400 border-amber-950/60 bg-amber-950/20' : 'text-slate-400 border-slate-800'
                    }`}>
                      {issue.status}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-100 line-clamp-1">{issue.auto_title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-normal">{issue.auto_description}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/50 pt-2 mt-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-indigo-400" />
                      <span>Priority Score: <strong className="text-indigo-400">{issue.priority_score.toFixed(0)}</strong></span>
                    </div>
                    {doneCount > 0 && (
                      <span className="text-indigo-300 font-semibold">{doneCount}/3 actions</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {issues.length === 0 && (
            <div className="text-center p-12 text-slate-500 border border-slate-800 border-dashed rounded-lg bg-[#1C1D26]/50">
              No issues reported yet.
            </div>
          )}
        </div>

        {/* Right Side: Solution Triage Workbench (col-span-7) */}
        <div className="lg:col-span-7 h-full">
          {selectedIssue ? (
            <Card className="bg-[#1C1D26] border-slate-800/60 shadow-2xl flex flex-col h-full overflow-hidden">
              <CardContent className="p-6 space-y-6">
                
                {/* Workbench Header */}
                <div className="space-y-2 border-b border-slate-800/60 pb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 uppercase text-[10px] font-bold">
                          {selectedIssue.category.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] font-bold ${
                          selectedIssue.status === 'Resolved' ? 'text-emerald-400 border-emerald-950/60 bg-emerald-950/20' : 
                          selectedIssue.status === 'In Progress' ? 'text-amber-400 border-amber-950/60 bg-amber-950/20' : 'text-slate-400 border-slate-800'
                        }`}>
                          {selectedIssue.status}
                        </Badge>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight">{selectedIssue.auto_title}</h2>
                    </div>
                    <div className="bg-[#12131A] border border-slate-800 rounded-xl p-3 text-center shrink-0">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">AI Score</p>
                      <p className="text-2xl font-black text-indigo-400">{selectedIssue.priority_score.toFixed(0)}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed bg-[#12131A]/40 p-3 rounded-lg border border-slate-800/40">
                    {selectedIssue.auto_description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-indigo-500" /> Lat: {selectedIssue.lat.toFixed(6)}, Lng: {selectedIssue.lng.toFixed(6)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Updated: {new Date(selectedIssue.updated_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* AI Diagnostic Diagnosis */}
                <div className="bg-indigo-950/10 border border-indigo-900/30 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Diagnostic & Triage Reasoning
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{selectedIssue.severity_justification}"
                  </p>
                  <div className="flex gap-4 pt-1 text-[11px]">
                    <span className="text-slate-400">Hazard Level: <strong className="text-red-400">{selectedIssue.severity_score}/5</strong></span>
                    <span className="text-slate-400">Total Merged Citations: <strong className="text-white">{selectedIssue.report_count} reports</strong></span>
                  </div>
                </div>

                {/* Targeted Solution Blueprint */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-indigo-400" />
                    Targeted Solution Blueprint
                  </h3>
                  
                  <div className="space-y-2">
                    {getSolutionBlueprint(selectedIssue.category).map((step, idx) => {
                      const isDone = getStepsForIssue(selectedIssue.issue_id)[idx];
                      return (
                        <div 
                          key={idx} 
                          onClick={() => handleStepToggle(selectedIssue.issue_id, idx)}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isDone 
                              ? 'bg-emerald-950/10 border-emerald-900/30 text-slate-200' 
                              : 'bg-[#12131A] border-slate-800/80 text-slate-300 hover:border-slate-800'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isDone ? (
                              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 fill-emerald-500/10" />
                            ) : (
                              <div className="h-4.5 w-4.5 rounded-full border border-slate-600 hover:border-indigo-400" />
                            )}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {step.label}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                              {step.detail}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action logs input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    Official Resolution Work Log
                  </label>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Describe the solution steps executed (e.g. patched pothole with cold-mix asphalt, replaced LED modules)..."
                    className="w-full bg-[#12131A] border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 min-h-[70px] resize-none leading-relaxed"
                  />
                </div>

                {/* Control Actions Panel */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {selectedIssue.status !== 'Acknowledged' && selectedIssue.status !== 'In Progress' && selectedIssue.status !== 'Resolved' && (
                    <Button 
                      onClick={() => handleStatusUpdate(selectedIssue.issue_id, 'Acknowledged')} 
                      variant="outline" 
                      className="flex-1 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white text-xs font-bold py-2.5"
                    >
                      Acknowledge Issue
                    </Button>
                  )}
                  {selectedIssue.status !== 'In Progress' && selectedIssue.status !== 'Resolved' && (
                    <Button 
                      onClick={() => handleStatusUpdate(selectedIssue.issue_id, 'In Progress')} 
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
                    >
                      <Truck className="h-4 w-4" />
                      Deploy Field Team
                    </Button>
                  )}
                  {selectedIssue.status !== 'Resolved' && (
                    <Button 
                      onClick={() => handleStatusUpdate(selectedIssue.issue_id, 'Resolved', notesText)} 
                      disabled={!notesText.trim()}
                      className={`flex-1 text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
                        notesText.trim() 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' 
                          : 'bg-emerald-950/20 text-emerald-700/60 border border-emerald-950/40 cursor-not-allowed'
                      }`}
                      title={!notesText.trim() ? "Please write a resolution log to resolve this issue" : ""}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete & Notify Citizens
                    </Button>
                  )}
                </div>

              </CardContent>
            </Card>
          ) : (
            <div className="h-[450px] flex flex-col items-center justify-center border border-dashed border-slate-800/60 rounded-2xl bg-[#1C1D26]/40 p-8 text-center space-y-4">
              <div className="p-4 bg-[#12131A] rounded-full border border-slate-800/50">
                <Wrench className="h-10 w-10 text-slate-500 animate-pulse" />
              </div>
              <div>
                <h3 className="text-slate-300 font-bold text-base">Triage & Solution Workbench</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto leading-normal">
                  Select a reported ticket from the Priority Queue to view automated diagnosis, execute action items, and log resolutions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
