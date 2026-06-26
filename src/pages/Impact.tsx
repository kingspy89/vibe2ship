import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Report } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

export function Impact() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalReports, setTotalReports] = useState(0);

  useEffect(() => {
    const unsubIssues = onSnapshot(query(collection(db, 'issues')), (snapshot) => {
      const issuesData = snapshot.docs.map(doc => doc.data() as Issue);
      setIssues(issuesData);
    });
    
    // To get actual total reports we'd query the reports collection. 
    // For the dashboard, we can just sum the report_count on issues for simplicity and performance
    const unsubReports = onSnapshot(query(collection(db, 'issues')), (snapshot) => {
      let sum = 0;
      snapshot.docs.forEach(doc => {
        sum += (doc.data().report_count || 1);
      });
      setTotalReports(sum);
    });

    return () => {
      unsubIssues();
      unsubReports();
    };
  }, []);

  const categoryCounts = issues.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.keys(categoryCounts).map(k => ({
    name: k,
    value: categoryCounts[k]
  }));
  const COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#64748b'];

  const statusCounts = issues.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.keys(statusCounts).map(k => ({
    name: k,
    value: statusCounts[k]
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Impact Dashboard</h1>
        <p className="text-sm text-slate-500">Measuring civic efficiency through AI</p>
      </div>

      {/* Hero KPI: Deduplication */}
      <Card className="bg-slate-900 text-white border-none shadow-lg">
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
                {issues.length > 0 ? Math.round((1 - (issues.length / totalReports)) * 100) : 0}% noise reduction
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Saved hours of manual municipal triage by automatically clustering duplicates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Issues by Category</CardTitle>
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
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue Status Funnel</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
