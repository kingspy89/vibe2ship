import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Report } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function Impact() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let issuesLoaded = false;
    let reportsLoaded = false;

    const checkLoading = () => {
      if (issuesLoaded && reportsLoaded) setLoading(false);
    };

    const unsubIssues = onSnapshot(query(collection(db, 'issues')), (snapshot) => {
      const issuesData = snapshot.docs.map(doc => doc.data() as Issue);
      setIssues(issuesData);
      issuesLoaded = true;
      checkLoading();
    });
    
    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setTotalReports(snapshot.docs.length);
      reportsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubIssues();
      unsubReports();
    };
  }, []);

  const categoryCounts = issues.reduce((acc, curr) => {
    const cat = (curr.category || '').replace('_', ' ');
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.keys(categoryCounts).map(k => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: categoryCounts[k]
  }));
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const statusCounts = issues.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.keys(statusCounts).map(k => ({
    name: k,
    value: statusCounts[k]
  }));

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Impact Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Measuring civic efficiency through AI</p>
        </div>
        
        <Card className="bg-[#1C1D26] border-slate-800/50 text-white shadow-lg">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-slate-800">
              <div className="pt-4 md:pt-0 flex flex-col justify-center items-center md:items-start">
                <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-4"></div>
                <div className="h-12 w-20 bg-slate-800 rounded animate-pulse"></div>
              </div>
              <div className="pt-4 md:pt-0 md:pl-8 flex flex-col justify-center items-center md:items-start">
                <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-4"></div>
                <div className="h-12 w-20 bg-slate-800 rounded animate-pulse"></div>
              </div>
              <div className="pt-4 md:pt-0 md:pl-8 flex flex-col justify-center items-center md:items-start">
                <div className="h-6 w-36 bg-slate-800 rounded animate-pulse mb-3"></div>
                <div className="h-4 w-full bg-slate-800 rounded animate-pulse mb-1"></div>
                <div className="h-4 w-2/3 bg-slate-800 rounded animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader>
              <div className="h-6 w-40 bg-slate-800 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="h-72 flex justify-center items-center">
              <div className="w-40 h-40 rounded-full border-8 border-slate-800 border-t-slate-700 animate-spin"></div>
            </CardContent>
          </Card>

          <Card className="bg-[#1C1D26] border-slate-800/50">
            <CardHeader>
              <div className="h-6 w-40 bg-slate-800 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent className="h-72 flex flex-col justify-end space-y-4">
              <div className="w-[80%] h-12 bg-slate-800 rounded animate-pulse"></div>
              <div className="w-[50%] h-12 bg-slate-800 rounded animate-pulse"></div>
              <div className="w-[30%] h-12 bg-slate-800 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Impact Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">Measuring civic efficiency through AI</p>
      </div>

      {/* Hero KPI: Deduplication */}
      <Card className="bg-[#1C1D26] border-slate-800/50 text-white shadow-lg">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="pt-4 md:pt-0">
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Raw Citizen Reports</p>
              <div className="text-5xl font-extrabold text-white">{totalReports}</div>
            </div>
            <div className="pt-4 md:pt-0 md:pl-8">
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">AI-Triaged Issues</p>
              <div className="text-5xl font-extrabold text-indigo-400">{issues.length}</div>
            </div>
            <div className="pt-4 md:pt-0 md:pl-8 flex flex-col justify-center">
              <div className="text-emerald-400 font-medium text-lg">
                {issues.length > 0 && totalReports > 0 ? Math.round((1 - (issues.length / totalReports)) * 100) : 0}% noise reduction
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Saved hours of manual municipal triage by automatically clustering duplicates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-200">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-[#1C1D26] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-slate-200">Issue Status Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} cursor={{fill: '#334155'}} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
